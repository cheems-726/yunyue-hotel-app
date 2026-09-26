// B6 · 数据字典 + 口径静态检查 + M2 术语公式断言（设计收官包第0批）
// 运行：node tests/dataDict.check.mjs   （进 run-all 门禁）
// 字典文档：D:\教学app\数据字典.md（与 DATA_DICT 同源）

// ── 字典（权威口径总表）──
export const DATA_DICT = [
  { key: 'occupancy',       中文名: '出租率',        单位: '0-100（百分比整数）', 权威来源: 'settle() 返回 / 日引擎汇总', 允许用途: '周报/评分/教师端展示', 禁止用途: '组件自行用 occupiedRooms/rooms 重算（口径漂移根源）' },
  { key: 'rooms',           中文名: '房量',          单位: '间（整数）',           权威来源: 'parseRooms(brand.standard)（A3 唯一权威）', 允许用途: '房型结构/在店分摊/投资测算', 禁止用途: 'property.rooms（那是建筑面积话术 72-95，非可排房量）' },
  { key: 'capital',         中文名: '资金',          单位: '元（整数）',           权威来源: 'settle() 返回的 capital（写回 state.capital）', 允许用途: '资金卡/周报期末资金', 禁止用途: '500000−ΣtotalExpenses+Σprofit 等本地公式（双重扣成本已修）' },
  { key: 'goodRate',        中文名: '好评率',        单位: '0-100',                权威来源: 'settle().finalGoodRate（P4 夹取保证 ≥0）', 允许用途: '周报/口碑页/RPG', 禁止用途: '(好评数/评价数) 的组件端重算（与"道歉减半"口径不符）' },
  { key: 'negativeCount',   中文名: '差评数',        单位: '条',                   权威来源: 'settle().negativeCount（P4 后 ≤ reviewCount）', 允许用途: '周报/差评卡目标数', 禁止用途: 'UI 侧自行数星星（星级≤3 是展示口径）' },
  { key: 'handleRate',      中文名: '差评处理率',    单位: '0-100%',               权威来源: 'A4 周快照 handleStats（resolved/(pending+resolved)）', 允许用途: '口碑页/期末 15% 维度/教师端排名', 禁止用途: '实时数口碑页卡片（kept 过滤后只剩当周，会错）' },
  { key: 'attrs',           中文名: '品质/声誉/士气', 单位: '0-100 各项',          权威来源: 'state.attrs（normalizeAttrs 兜底；settle 返回 attrsAfter 写回）', 允许用途: '属性条/飘字/引擎入参', 禁止用途: '从品牌/好评率反推（N2 已统一）' },
  { key: 'classWeek',       中文名: '教学周锚',      单位: '周（1-18）/日（classDay）', 权威来源: '服务端（B2：class_settings，设备时钟零参与）', 允许用途: '结算窗口/事件同步/补算上界', 禁止用途: '本地 new Date() 推算' },
  { key: 'guests(在店)',    中文名: '在店规模',      单位: '间（客房）与 人（估算）严格分列', 权威来源: 'occRooms（间）；fullGuests（人，标注"估算"）', 允许用途: '实时面板（带单位标签）', 禁止用途: '把"间"标成"人"（审计问题①已修）' },
  { key: 'liveReviews',     中文名: '实时评价',      单位: '条（live 标记）',      权威来源: 'liveReview 掷骰（独立流 0x5A17A2）', 允许用途: '口碑页展示/流水', 禁止用途: '计入 pendingNegatives（口径批③：欠账只数结算卡，公平性红线）' },
  { key: 'weeklyExpenses',  中文名: '周成本构成',    单位: '元（分项）',           权威来源: 'settle().weeklyExpenses', 允许用途: '周报成本条形图', 禁止用途: '前端按 65/30/25 元硬编码重算（已修）' },
  { key: 'gop/gopRate',     中文名: '经营毛利/GOP率', 单位: '元 / 0-1',             权威来源: 'settle().gop/gopRate（= 营收 −(变动+营销+OTA佣金+其他部门成本)）', 允许用途: '周报经营明细', 禁止用途: '把租金算进 GOP（口径错）；当利润率用' },
  { key: 'rentCost',        中文名: '租金（独立科目）',单位: '元/周',               权威来源: 'settle().rentCost（房量 × 单房日租 × 7）', 允许用途: '周报成本行 / GOP 口径', 禁止用途: '并回 fixedCost（GOP 口径即错）' },
  { key: 'confidence',      中文名: '数据来源分级',  单位: 'red/yellow/green',     权威来源: 'src/siteLocations.mjs 的 confidence', 允许用途: '选址页角标', 禁止用途: '把「人工分级」当统计数据引用' },
  { key: 'keptRand/guestsRng', 中文名: '随机流',     单位: '—',                    权威来源: '结算 rand（全班同种子）/ guestsRng 独立流 / liveReview 0x5A17A2', 允许用途: '各自领域', 禁止用途: '交叉调用（污染随机序列=破坏全班可比性）' },
]

// ── 静态检查：找"绕过权威来源自己算"的残留 ──
import { readFileSync, readdirSync } from 'node:fs'
import { settle } from '../src/settlement.js'   // 华住 B 分项要在真引擎上验 RevPAR 恒等式

const VIOLATION_PATTERNS = [
  { id: 'V1', desc: '本地重算资金（双重扣成本旧公式）', re: /500000\s*-\s*history\.reduce/g, whitelist: [] },
  { id: 'V2', desc: '房量读 property.rooms（应走 parseRooms）', re: /property\?\.rooms|property\.rooms/g, whitelist: ['src/Claim.jsx'] },   // Claim 物业卡展示话术已标注，允许
  { id: 'V3', desc: '组件端重算成本构成', re: /occupied\s*\*\s*\d+\s*:\s*\d+/g, whitelist: [] },
  // reviewRate.js 的 1 处 = rnd 兜底分支（`typeof rnd === 'function' ? rnd() : Math.random()`），
  // guests.test.mjs 的 T4 断言已精确限制它必须在兜底行 → 这里白名单放行，避免两套口径
  { id: 'V4', desc: '源码出现 Math.random（评价相关模块零容忍，其余 UI 动画允许）', re: /Math\.random/g, whitelist: ['src/HotelStatus.jsx', 'src/App.jsx', 'src/Reputation.jsx', 'src/Establishment.jsx', 'src/WeeklyReport.jsx', 'src/reviewRate.js'] },
  { id: 'V5', desc: '把在店"间"标成"人"', re: /在店客人/, whitelist: [] },
]

const files = readdirSync('src').filter(f => /\.(js|jsx|mjs)$/.test(f) && !f.startsWith('settle-old'))
const codeOnly = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
let violations = []
for (const f of files) {
  const path = 'src/' + f
  const src = codeOnly(readFileSync(path, 'utf8'))   // 剥注释：🔴 注释里提到模式名不算违规
  for (const v of VIOLATION_PATTERNS) {
    if (v.whitelist.includes(path)) continue
    const hits = src.match(v.re)
    if (hits) violations.push({ file: path, id: v.id, desc: v.desc, count: hits.length })
  }
}

// ── M2 · 术语公式断言（酒店专业术语与项目对照缺口表 §四·第一批）──────────
// 原理（防 M1 式假绿）：不是"出现过这个词就算过"，而是【反例模式必须为 0】+【正例模式必须存在】。
// 白名单：确属说明性文案/教学解释的显式豁免（M1 同款机制）。
const TERM_WHITELIST = [
  { file: 'src/Establishment.jsx', reason: '教学解释文案（"RevPAR=ADR×出租率"是公式说明，非计算）' },
]
function whitelisted(file) { return TERM_WHITELIST.some(w => file.startsWith(w.file)) }
const readSrc = (f) => codeOnly(readFileSync(f, 'utf8'))

const termFindings = []
// 断言 A：凡【计算】RevPAR 的地方，必须 ÷ (rooms × 7)（缺口表 A3：行业标准是"每天"）
{
  const filesToCheck = files.map(f => 'src/' + f)
  for (const f of filesToCheck) {
    const src = readSrc(f)
    for (const m of src.matchAll(/.{0,160}(?:RevPAR|revpar).{0,240}/g)) {
      const ctx = m[0]
      // 计算判定放宽：revpar 的计算行是 `revpar = Math.round(totalRevSum / (avgRooms * history.length))`，
      // "revenue|Rev" 在窗口内可能缺失（变量名是 totalRevSum）→ 改为"赋值给 revpar/rev 且含除法"即算计算
      const isComputation = /(revpar|rev)\s*=\s*[^\n]*\/[^\n]*/i.test(ctx) || /(revenue|Rev)\s*\/\s*[\w.()*\s]+(rooms|Rooms)/.test(ctx)
      const divided7 = /\/\s*[^\n]*\b(7|DAYS_PER_WEEK)\b/.test(ctx)
      if (isComputation && !divided7 && !whitelisted(f)) {
        const line = src.slice(0, m.index).split('\n').length
        termFindings.push({ rule: 'A(RevPAR÷7)', file: f, line, ctx: ctx.replace(/\s+/g, ' ').slice(0, 90), expect: 'revenue / (rooms * 7) 或 ADR × OCC' })
      }
    }
  }
}
// 断言 B：ADR 显示不得直接用定价 report.price（应为 客房收入÷售出间夜）
{
  const src = readSrc('src/App.jsx')
  const idx = src.indexOf('ADR')
  if (idx >= 0) {
    const ctx = src.slice(idx, idx + 400)
    if (/report\.price/.test(ctx) && !whitelisted('src/App.jsx')) {
      const line = src.slice(0, idx).split('\n').length
      termFindings.push({ rule: 'B(ADR实收)', file: 'src/App.jsx', line, ctx: 'ADR 卡显示 report.price（定价）', expect: '客房收入 ÷ 售出间夜' })
    }
  }
}
// 断言 C：文案承诺 GOP → 必须存在 GOP 变量（缺口表 B1：Establishment 承诺了、引擎没实现）
// ⚠️ 不受 TERM_WHITELIST 豁免 —— 白名单只用于断言 A 的"公式说明文案"；C 抓的正是"承诺未实现"
{
  const promised = /GOP/.test(codeOnly(readFileSync('src/Establishment.jsx', 'utf8')))
  const implemented = /const\s+gop\b/.test(codeOnly(readFileSync('src/settlement.js', 'utf8')))
  if (promised && !implemented) {
    termFindings.push({ rule: 'C(GOP变量)', file: 'src/settlement.js', line: 0, ctx: 'Establishment.jsx 文案提到 GOP 率，但引擎无 gop 变量/计算', expect: 'gop = revenue − (fixedCost + variableCost + marketingCost + otaCommission)（租金另列）' })
  }
}
// 断言 D：字典每条 { key, 权威来源 } 的实现可找到（抽查核心 4 条的权威实现标识符）
{
  const coreImpl = {
    capital: /setCapital\(result\.capital\)|typeof result\.capital === 'number'/,
    rooms: /parseRooms\(brand\?\.standard\)|parseRooms\(brand\.standard\)/,
    handleRate: /handleStats/,
    weeklyExpenses: /weeklyExpenses/,
  }
  for (const [k, re] of Object.entries(coreImpl)) {
    const entry = DATA_DICT.find(d => d.key === k)
    if (!entry) { termFindings.push({ rule: 'D(字典完整性)', file: 'tests/dataDict.check.mjs', line: 0, ctx: `字典缺 ${k}`, expect: '每条核心概念都在 DATA_DICT' }); continue }
    let found = false
    for (const f of files.map(x => 'src/' + x)) { if (re.test(codeOnly(readFileSync(f, 'utf8')))) { found = true; break } }
    if (!found) termFindings.push({ rule: 'D(权威实现缺失)', file: 'src/', line: 0, ctx: `字典 ${k} 的权威来源在源码找不到实现（${re}）`, expect: '权威来源必须有对应代码' })
  }
}

// ── 华住分项对拍（§五·步骤5 / D16 修正版）────────────────────────────────
// 参照模型（华住官网收益模型）：100 间 / 出租率 90% / ADR 200 元 / 3500 ㎡ / 租金 1.5 元/㎡/天 / 365 天
// ★ 只对拍【可对拍】分项。明确【不对拍】：现金流率 20.8% 与毛利率 55%
//   —— 我们缺【部门成本】模型（variableCost 仅占营收约 19%，华住 55% 毛利率已扣部门成本），
//   属模型范围差异、不是失败；不许为凑 20.8% 调参。放 P3《加盟经济模型》。
export const HUAZHU_BENCH = {
  rooms: 100, occ: 0.9, adr: 200, area: 3500, rentPerSqmDay: 1.5, days: 365,
  费率常量: { 管理费: 0.05, CRS: 0.08, 官方渠道上限: 0.035 },
  参考值: { 年租金: 1916250, RevPAR: 180, 年营收: 6570000, 特许费: 328500, 单房造价: 71800, 华住单房造价: 61000 },
}
const SAME_ORDER = (a, b) => a / b >= 0.5 && a / b <= 2.0   // 同量级判定：0.5×~2.0×
const hzFindings = [], hzNotes = []
{
  const H = HUAZHU_BENCH
  const genSrc = codeOnly(readFileSync('src/settlement.js', 'utf8'))
  // A · 租金公式 = 面积 × 单价 × 天数
  const annualRent = H.area * H.rentPerSqmDay * H.days
  if (annualRent !== H.参考值.年租金) hzFindings.push({ rule: '华住A(租金公式)', ctx: `面积×单价×天数 = ${annualRent}，参考值 ${H.参考值.年租金}`, expect: '3500×1.5×365 = 1,916,250 元 = 191.625 万' })
  // A · 引擎侧对拍：rentCost 推导式实读源码，避免"文档说 65 但代码改过"
  const mRent = /const rentCost = (\d+) \+ \(s\.租金 \|\| 3\) \* (\d+)/.exec(genSrc)
  if (!mRent) hzFindings.push({ rule: '华住A(引擎侧)', ctx: 'settlement.js 找不到 rentCost 推导式（35 + 租金档×10）', expect: '正例模式必须存在' })
  else {
    const rentCost = Number(mRent[1]) + 3 * Number(mRent[2])                    // 租金档 3
    const hzPerRoomDay = annualRent / H.days / H.rooms                          // 华住 52.5 元/间/天
    if (!SAME_ORDER(rentCost, hzPerRoomDay)) hzFindings.push({ rule: '华住A(量级)', ctx: `引擎 rentCost=${rentCost} 元/间/天 vs 华住 ${hzPerRoomDay} 元/间/天 不同量级`, expect: '0.5×~2.0×' })
    else hzNotes.push(`A 租金：引擎 ${rentCost} 元/间/天 ÷ 华住 ${hzPerRoomDay} 元/间/天 = ${(rentCost / hzPerRoomDay).toFixed(2)}× ✅ 同量级（100 间年租金 ${(H.rooms * rentCost * 365 / 10000).toFixed(2)} 万 vs 华住 191.625 万）`)
  }
  // B · RevPAR = ADR × OCC（引擎侧恒等式；★ 这是 T1.1 的回归守卫：÷7 前会差 7 倍）
  if (H.adr * H.occ !== H.参考值.RevPAR) hzFindings.push({ rule: '华住B(RevPAR)', ctx: `ADR×OCC = ${H.adr * H.occ} ≠ ${H.参考值.RevPAR}`, expect: '200 × 0.9 = 180' })
  try {
    const r = settle({ site: { 客流: 5, 房价: 5, 租金: 3, 竞争: 3, 人力: 4, 波动: 2 }, brand: { name: '全季', price: '280-400元', standard: '客房100间起', level: '中档' }, decisions: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', energy: 23, overbook: 0 }, week: 1, attrs: { quality: 80, reputation: 80, morale: 80 } })
    const implied = r.revenue / (r.rooms * 7)                 // 周营收 ÷(房量×7) = 每间每晚营收
    const identity = r.price * (r.occupiedRooms / r.rooms)    // ADR × OCC
    if (Math.abs(implied - identity) > 1) hzFindings.push({ rule: '华住B(引擎侧恒等式)', ctx: `revenue/(rooms×7)=${implied.toFixed(2)} vs ADR×OCC=${identity.toFixed(2)}`, expect: '差 ≤1 元（÷7 口径正确）' })
    else hzNotes.push(`B RevPAR：引擎 revenue/(rooms×7)=${implied.toFixed(2)} === ADR×OCC=${identity.toFixed(2)}（差 ${Math.abs(implied - identity).toFixed(3)}）✅ 恒等式成立 ⇒ ÷7 口径正确（改前会差 7 倍）`)
  } catch (e) {
    hzFindings.push({ rule: '华住B(引擎侧恒等式)', ctx: '跑 settle 失败：' + e.message, expect: '引擎可运行' })
  }
  // C · 费率常量登记（不对拍：引擎的 OTA 佣金是【平台抽成】，与"官方渠道上限 3.5%"不是同一科目）
  hzNotes.push(`C 费率常量：管理费 5% / CRS 8% / 官方渠道上限 3.5% ✅ 已登记；引擎侧 OTA 佣金（平台合作 15% / 直营投放 11%）是 OTA 平台抽成，不同科目 → 不对拍`)
  // D · 特许费 = 营收 × 5%
  const franchise = H.参考值.年营收 * H.费率常量.管理费
  if (franchise !== H.参考值.特许费) hzFindings.push({ rule: '华住D(特许费)', ctx: `${H.参考值.年营收} × 5% = ${franchise} ≠ ${H.参考值.特许费}`, expect: '657 万 × 5% = 32.85 万' })
  if (!/特许费|franchise/i.test(genSrc)) hzNotes.push('D 特许费：参考模型 657万×5% = 32.85 万 ✅ 算术自洽；⚠️ 引擎仍无【特许费】科目（GOP 已于 T1.4/B3 落地，特许费仍缺）→ P3')
  // E · 投资额量级
  if (!SAME_ORDER(H.参考值.单房造价 * H.rooms, H.参考值.华住单房造价 * H.rooms)) hzFindings.push({ rule: '华住E(投资额)', ctx: '单房造价×房量 与华住不同量级', expect: '同量级' })
  else hzNotes.push(`E 投资额：单房造价 7.18万×100 = 718 万 vs 华住 6.1万×100 = 610 万 ⇒ ${(H.参考值.单房造价 / H.参考值.华住单房造价).toFixed(2)}× ✅ 同量级；⚠️ 引擎无【投资额/capex】科目 → P3`)
  hzNotes.push('❌ 不对拍（模型范围差异）：现金流率 20.8% / 毛利率 55% —— 缺部门成本模型，放 P3；不许调参凑')
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('\\').pop())) {
  console.log('▶ B6 数据字典口径检查 + M2 术语公式断言')
  console.log(`  字典条目：${DATA_DICT.length} 项`)
  if (!violations.length) console.log('  ✅ 口径违规：0 处（A1/A3/A4/口径批 的旧口径已全部清除）')
  else {
    console.log(`  ⚠️ 口径违规 ${violations.length} 处：`)
    violations.forEach(v => console.log(`   ${v.id} ${v.file} ×${v.count} — ${v.desc}`))
  }
  console.log(`  术语断言：${termFindings.length === 0 ? '✅ 全绿（RevPAR÷7 / ADR实收 / GOP变量 / 字典实现齐全）' : '✗ ' + termFindings.length + ' 条未兑现：'}`)
  termFindings.forEach(t => console.log(`   [${t.rule}] ${t.file}:${t.line} — ${t.ctx}\n     期望：${t.expect}`))
  console.log(`\n  华住分项对拍（§五·步骤5 · D16 修正版）：${hzFindings.length === 0 ? '✅ A~E 全过' : '✗ ' + hzFindings.length + ' 项不符'}`)
  hzNotes.forEach(n => console.log('   ' + n))
  hzFindings.forEach(t => console.log(`   ✗ [${t.rule}] ${t.ctx}\n     期望：${t.expect}`))
  process.exit((violations.length || termFindings.length || hzFindings.length) ? 1 : 0)
}
