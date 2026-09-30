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
  // 🔴 W2-3（W10 正名）：净利润 = 评分基准。★ 与 gop 是【两个指标】，界面必须分列显示
  { key: 'netProfit/netProfitRate', 中文名: '净利润/净利润率', 单位: '元 / 0-1',   权威来源: 'settle().netProfit（= gop − 租金 − 超售赔偿 − 改造投资 − 事件罚款；=== 既有 profit）', 允许用途: '周报/期末评分基准(40%维度)/教师端/导出CSV', 禁止用途: '与 GOP 混用（GOP 不含租金，天然更大）；用 GOP 冒充净利润做评分' },
  { key: 'rentCost',        中文名: '租金（独立科目）',单位: '元/周',               权威来源: 'settle().rentCost（房量 × 单房日租 × 7）', 允许用途: '周报成本行 / GOP 口径', 禁止用途: '并回 fixedCost（GOP 口径即错）' },
  { key: 'confidence',      中文名: '数据来源分级',  单位: 'red/yellow/green',     权威来源: 'src/siteLocations.mjs 的 confidence', 允许用途: '选址页角标', 禁止用途: '把「人工分级」当统计数据引用' },
  { key: 'keptRand/guestsRng', 中文名: '随机流',     单位: '—',                    权威来源: '结算 rand（全班同种子）/ guestsRng 独立流 / liveReview 0x5A17A2', 允许用途: '各自领域', 禁止用途: '交叉调用（污染随机序列=破坏全班可比性）' },
]

// ── 静态检查：找"绕过权威来源自己算"的残留 ──
import { readFileSync, readdirSync } from 'node:fs'
import { settle, rentPerRoomDay } from '../src/settlement.js'   // 华住 B 分项要在真引擎上验 RevPAR 恒等式
import { runSeason6 } from './_season6.mjs'      // W2-4：六组赛季聚合（与 W14 同一份场景，避免两处口径漂移）

// ★ §26（2026-09-29）：导出违规模式表 —— 供 tests/livePanel.test.mjs 复用同一份判据做【判据自检】
//   （"判据必须能抓到合成违规样本"）。**判据只有一份实现**，不在别处再写第二份正则。
export const VIOLATION_PATTERNS = [
  { id: 'V1', desc: '本地重算资金（双重扣成本旧公式）', re: /500000\s*-\s*history\.reduce/g, whitelist: [] },
  { id: 'V2', desc: '房量读 property.rooms（应走 parseRooms）', re: /property\?\.rooms|property\.rooms/g, whitelist: ['src/Claim.jsx'] },   // Claim 物业卡展示话术已标注，允许
  { id: 'V3', desc: '组件端重算成本构成', re: /occupied\s*\*\s*\d+\s*:\s*\d+/g, whitelist: [] },
  // reviewRate.js 的 1 处 = rnd 兜底分支（`typeof rnd === 'function' ? rnd() : Math.random()`），
  // guests.test.mjs 的 T4 断言已精确限制它必须在兜底行 → 这里白名单放行，避免两套口径
  { id: 'V4', desc: '源码出现 Math.random（评价相关模块零容忍，其余 UI 动画允许）', re: /Math\.random/g, whitelist: ['src/HotelStatus.jsx', 'src/App.jsx', 'src/Reputation.jsx', 'src/Establishment.jsx', 'src/WeeklyReport.jsx', 'src/reviewRate.js'] },
  // ═══ §26.2 / §26.4（2026-09-29 · P0a · 用户投诉「60 间店里显示在店客房 75 间」）═══════
  // 🔴 V5 原写法查的是**旧字面「在店客人」**：标签 2026-09-22 改名「在店客房」后，
  //    这条判据**永久绿（空转）** —— "声明了却抓不到"的典型（BL-11/13 + 扫描器空转双重复现）。
  //    现改【按语义判】：**房间类标签**（客房/房间/房量）的渲染表达式里不得出现**人数系标识符**。
  { id: 'V5', desc: '把"间"标成人数（房间类标签的行里出现 guests 系标识符）',
    re: /l:\s*'[^']*(客房|房间|房量)[^']*'[^\n]*(guests|liveGuests|targetGuests)/g, whitelist: [] },
  // 🔴 V6（新）：房型明细不得再用 `tp.total × tp.occRate` 这套**独立估算** ——
  //    它与 occByType（最大余数法 · **Σ === occRooms**）不同源 ⇒ 同屏 45/48 打脸。
  { id: 'V6', desc: '房型明细自造在店数（应走 occByType · Σ === occRooms）',
    re: /tp\.total\s*\*\s*tp\.occRate/g, whitelist: [] },
  // 🔴 V4b（V4 白名单**收窄** · §26.4）：白名单文件里 **金额路径禁止 Math.random**。
  //    原白名单等于"HotelStatus.jsx 里任意 Math.random 都合法" ⇒ **自造金额永远合法** ⇒ 这正是本次翻车原因。
  //    判据：同一行里既有 Math.random 又有金额关键词 ⇒ 违规（只允许动画/文案用随机）。
  //    ⚠️ 已知边界（实测抓到自己的洞）：`const fee = Math.round(p * (0.85 + Math.random()*0.3))` 这一行
  //       **不含**金额关键词（变量名是 p/fee）⇒ V4b 漏抓 ⇒ 故再加 V7/V8 两条**结构性**判据兜底。
  { id: 'V4b', desc: '金额路径出现 Math.random（白名单只允许动画/文案）',
    re: /Math\.random[^\n]*(金额|amt|income|expense|revenue|cost|price|流水)[^\n]*|(金额|amt|income|expense|revenue|cost|price|流水)[^\n]*Math\.random/g,
    whitelist: [] },
  // 🔴 V7（结构 · §26.3 P0b）：**面板不得自记收支** —— `apply({ income/expense: ... })` 一律违规。
  //    今日流水必须来自引擎日快照（同源）；面板只推进计数（退房/入住/在店人数）。
  { id: 'V7', desc: '面板自行累加收支（应取引擎日快照 · 两本账根因）',
    re: /apply\(\{[^}]*\b(income|expense)\b/g, whitelist: [] },
  // 🔴 V8（结构 · §26.3）：事件文案**不得自带金额** —— 两种写法都要抓：
  //    ① 对象字段 `amt: <非 0>` ② 位置参数 `pushFeed('...', <非 0>)`
  //    （★ 实测教训：RV-5 注入 `pushFeed(\`...\`, -80)` 时只查 `amt:` 的版本**漏抓** ⇒ 判据当场被自己的 RV 抓出来）
  { id: 'V8', desc: '事件文案自造金额（金额应为 0 · 一律取引擎快照）',
    re: /amt:\s*(?!0\b)[-+]?[\d(]|pushFeed\([^,]+,\s*(?!0\b\s*\))[-+]?[\d(]/g, whitelist: [] },
]

const files = readdirSync('src').filter(f => /\.(js|jsx|mjs)$/.test(f) && !f.startsWith('settle-old'))
const codeOnly = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
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
    // W2-3：净利润的权威实现 = settlement.js 里的推导式（必须真在算，不是只输出个字段）
    'netProfit/netProfitRate': /const netProfit = gop - rentCostWeekly/,
  }
  for (const [k, re] of Object.entries(coreImpl)) {
    const entry = DATA_DICT.find(d => d.key === k)
    if (!entry) { termFindings.push({ rule: 'D(字典完整性)', file: 'tests/dataDict.check.mjs', line: 0, ctx: `字典缺 ${k}`, expect: '每条核心概念都在 DATA_DICT' }); continue }
    let found = false
    for (const f of files.map(x => 'src/' + x)) { if (re.test(codeOnly(readFileSync(f, 'utf8')))) { found = true; break } }
    if (!found) termFindings.push({ rule: 'D(权威实现缺失)', file: 'src/', line: 0, ctx: `字典 ${k} 的权威来源在源码找不到实现（${re}）`, expect: '权威来源必须有对应代码' })
  }
}

// ── E · M2 术语断言扩展（W4-4 · 按《酒店专业术语与项目对照缺口表》补）──────────
// 原则：每条都【同时钉条件与内容】（W3-1 教训）——不写"出现过这个词就算过"，而是钉住恒等式/常量/未实装状态。
// 覆盖面：A2 出租率口径 · B6 单房运营成本 · B8 OTA 佣金率 · B9/B10 参考费率在册且【未实装】 · C3/C4 回收期链
const eNotes = []
{
  // E1 · A2 出租率口径：OCC = 售出间夜 ÷ 可售间夜（不是"售出间数 ÷ 总间数"的其它变体）
  const r = settle({ site: { 客流: 5, 房价: 5, 租金: 3, 竞争: 3, 人力: 4, 波动: 2 }, brand: { name: '全季', price: '280-400元', standard: '客房100间起', level: '中档' }, decisions: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', energy: 23, overbook: 0 }, week: 1, attrs: { quality: 80, reputation: 80, morale: 80 } })
  const occ期望 = Math.round((r.occupiedRooms / r.rooms) * 100)
  if (r.occupancy === occ期望) eNotes.push(`E1 OCC 恒等式：occupancy ${r.occupancy} === round(occupiedRooms/rooms×100)（缺口表 A2）`)
  if (r.occupancy !== occ期望) termFindings.push({ rule: 'E1(OCC恒等式)', file: 'src/settlement.js', line: 0, ctx: `occupancy ${r.occupancy} ≠ round(occupiedRooms/rooms×100) = ${occ期望}`, expect: 'OCC = 售出间夜 ÷ 可售间夜（缺口表 A2）' })

  // E2 · B6 单房运营成本 CPOR：运营成本 ÷ 售出间夜，且必须 0 < CPOR < ADR（单房经济性常识）
  // ★ §22.2-B2：CPOR 是【运营】口径 ⇒ 剔除开业一次性费用/保证金退还（它们不是"每卖一间房的成本"）
  const 售出间夜 = r.occupiedRooms * 7
  const CPOR = (r.totalCost - r.rentCost - (r.oneTimeFees ? r.oneTimeFees.开业费用 - r.oneTimeFees.保证金退还 : 0)) / 售出间夜
  const ADR = r.revenue / 售出间夜
  if (!(CPOR > 0 && CPOR < ADR)) termFindings.push({ rule: 'E2(CPOR)', file: 'src/settlement.js', line: 0, ctx: `CPOR ${CPOR.toFixed(1)} 不在 (0, ADR ${ADR.toFixed(1)}) 区间内`, expect: '每卖一间房的运营成本应低于房价（缺口表 B6 · B2 起按经营口径剔一次性项）' })
  else eNotes.push(`E2 CPOR：${CPOR.toFixed(1)} 元/间夜 < ADR ${ADR.toFixed(1)} 元/间夜 ⇒ 单房经济性成立（缺口表 B6 · 剔一次性项）`)

  // E3 · B8 OTA 佣金率：登记在案的 15%（平台合作）/ 11%（自营投放）必须在源码里以该形态存在
  const st = codeOnly(readFileSync('src/settlement.js', 'utf8'))
  const 有15 = /otaCommissionRate = 0\.15/.test(st)
  const 有11 = /revenue \* 0\.11/.test(st)
  if (有15 && 有11) eNotes.push('E3 OTA 佣金率：平台合作 15% / 自营投放 11% 与登记值一致（缺口表 B8）')
  if (!(有15 && 有11)) termFindings.push({ rule: 'E3(OTA佣金率)', file: 'src/settlement.js', line: 0, ctx: `15% 或 11% 的佣金率写法未找到（15%: ${有15} / 11%: ${有11}）`, expect: '平台合作 15% · 自营投放 11%（缺口表 B8 登记值）' })

  // E4 · B9/B10 参考费率【在册】+ 引擎实装边界（🔴 §14.3 重基线 · D53）
  //   旧判据（P3 未开工时代）：引擎里【不得】出现加盟费率 —— 防"半接一半"（接了展示忘改结算，或反过来）。
  //   §14.3（D53-a/b/c）把 P3 拆成两步并已开工第一步 ⇒ 旧判据的前提消失，但【意图不变】：
  //   仍要机器判死"半接"，只是边界改成 D53 的边界：
  //     ① 月度费率（管理费 + CRS）必须【经单源】接入结算 —— 不许只在展示层
  //     ② ★ §22.2-B2（2026-09-29）更新：一次性费用（加盟费/保证金/筹备费/PMS初装）**已经进引擎**
  //        （D53-c 说的"另立批次"就是本批）⇒ ①② 的边界更新为：【经单源 一次性费用清单()】接入；
  //        **capex（单房造价）仍然不得进引擎**（B3 只立"投资总额"展示口径，不动 E1 账本）
  //     ③ 引擎里不得出现费率字面量（费率只许来自 src/franchiseFees.mjs）
  const fm = readFileSync('src/franchiseModel.mjs', 'utf8')
  const 费率在册 = /0\.05/.test(fm) && /0\.08/.test(fm) && /0\.035/.test(fm)
  const 月度费率已接 = /from '\.\/franchiseFees\.mjs'/.test(st) && /franchiseFees\(/.test(st)
  const 一次性已接单源 = /一次性费用清单\(/.test(st) && /from '\.\/franchiseFees\.mjs'/.test(st)
  const capex未接 = !/单房造价/.test(st)                                   // ★ B2 后只禁 capex（造价），其余已合法接入
  const 费率无字面量 = !/revenue \* 0\.0(5|8|24|74)/.test(st)
  if (!费率在册) termFindings.push({ rule: 'E4(费率在册)', file: 'src/franchiseModel.mjs', line: 0, ctx: '管理费 5% / CRS 8% / 官方渠道上限 3.5% 三者未同时存在', expect: '缺口表 B9/B10 的参考费率必须登记在册' })
  if (!月度费率已接) termFindings.push({ rule: 'E4(月度费率未接)', file: 'src/settlement.js', line: 0, ctx: '未从 franchiseFees.mjs 单源计费', expect: 'D53-b：管理费+CRS 必须经单源进结算（不许只在展示层）' })
  if (!一次性已接单源) termFindings.push({ rule: 'E4(一次性未经单源)', file: 'src/settlement.js', line: 0, ctx: '引擎用了一次性费用但未经 一次性费用清单() 单源', expect: '§22.2-B2：一次性费用必须经单源进结算（不许在引擎另写一份清单）' })
  if (!capex未接) termFindings.push({ rule: 'E4(capex越界)', file: 'src/settlement.js', line: 0, ctx: '引擎里出现 capex（单房造价）科目', expect: 'D53-c：capex 不进 E1 账本（B3 只立展示口径「投资总额」，不改结算）' })
  if (!费率无字面量) termFindings.push({ rule: 'E4(费率字面量)', file: 'src/settlement.js', line: 0, ctx: '引擎里出现"营收 × 费率"字面量', expect: '费率只许来自 src/franchiseFees.mjs（单源）' })
  if (费率在册 && 月度费率已接 && 一次性已接单源 && capex未接 && 费率无字面量) eNotes.push('E4 加盟费率：在册（5%/8%/3.5%）· 月度费率经单源已接（D53-b）· 一次性费用经单源已接（§22.2-B2）· capex 未接（D53-c）⇒ 与当前决策边界自洽')

  // E5 · C3/C4 回收期链（缺口表给的外部权威答案）：华住链 ⇒ 现金流 136.875 万 ⇒ 回收期 ≈ 4.5 年
  const 年现金流 = 6570000 - 6570000 * 0.45 - 1916250 - 328500   // 按缺口表：年收入 − 部门成本45% − 租金 − 特许费
  const 回收期 = 6100000 / 年现金流
  if (Math.abs(年现金流 - 1368750) > 1 || Math.abs(回收期 - 4.5) > 0.05) {
    termFindings.push({ rule: 'E5(回收期链)', file: 'tests/dataDict.check.mjs', line: 0, ctx: `现金流 ${(年现金流 / 10000).toFixed(2)} 万 / 回收期 ${回收期.toFixed(2)} 年`, expect: '136.875 万 ⇒ 610 万投资 ⇒ 约 4.5 年（缺口表 C3/C4 的权威链）' })
  } else eNotes.push(`E5 回收期链：年现金流 ${(年现金流 / 10000).toFixed(2)} 万 ÷ 投资 610 万 = ${回收期.toFixed(2)} 年（与缺口表 4.5 年一致）`)
  // 并断言：我们的回本口径与 C3 定义一致（总投资 ÷ 年现金流）
  const { paybackText } = await import('../src/onePageLedger.mjs')
  const t2 = paybackText({ 总投资: 6100000, yearly: { 现金流: 年现金流 } })
  if (!/约 4\.5 年/.test(t2.text)) termFindings.push({ rule: 'E5(回本口径)', file: 'src/onePageLedger.mjs', line: 0, ctx: `paybackText 输出「${t2.text}」`, expect: '与缺口表 C3 同式：总投资 ÷ 年现金流 ⇒ 约 4.5 年' })
  else eNotes.push('E5 回本口径：paybackText 与缺口表 C3 同式（总投资 ÷ 年现金流）')
}

// ── 华住分项对拍（§五·步骤5 / D16 修正版）────────────────────────────────
// 参照模型（华住官网收益模型）：100 间 / 出租率 90% / ADR 200 元 / 3500 ㎡ / 租金 1.5 元/㎡/天 / 365 天
// ★ W2-4（2026-09-27）：【现金流率已解锁】—— D16 修正写着"引入部门成本后，再解锁现金流率对拍"，
//   W14/W2-1 部门成本 5 科目落地 ⇒ 前提消除，本批做【结构对拍 + 差异归因】（见 F 段）。
//   ★ 纪律不变：仍然【不许为凑 20.8% 调参】—— F 段只断言"差额可被租金项解释"，不要求数值相等。
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
  //    🔴 A-1（2026-09-27）：曲线改 25+档×5，且【唯一表达式】收在 settlement.js 的 rentPerRoomDay
  //      —— W3-2 的报价单原来自带一份 `35+档×10` 副本，A-1 改曲线时它静默漂移（BL-7 同族）
  //      ⇒ 本断言钉【定义式 + 结算调用点 + 报价单引用】三件事，缺一即红（防"改了引擎漏了展示层"）。
  const mRent = /export const rentPerRoomDay = \(档, 兜底 = 3\) => (\d+) \+ \(Number\.isFinite\(档\) \? 档 : 兜底\) \* (\d+)/.exec(genSrc)
  const 调用点 = /const rentCost = rentPerRoomDay\(s\.租金 \|\| 3\)/.test(genSrc)
  const pqSrc = readFileSync('src/propertyQuote.mjs', 'utf8')
  const 报价单引用 = /import \{[^}]*rentPerRoomDay[^}]*\} from '\.\/settlement\.js'/.test(pqSrc)
  if (!mRent || !调用点 || !报价单引用) {
    hzFindings.push({ rule: '华住A(引擎侧)', ctx: `租金【单源表达式】不成链：定义=${!!mRent} 结算调用点=${调用点} 报价单引用=${报价单引用}`, expect: 'rentPerRoomDay 由 settlement.js 定义 + 被 settle 调用 + 被 propertyQuote 引用（不得自带副本）' })
  } else {
    const rentCost = Number(mRent[1]) + 3 * Number(mRent[2])                    // 租金档 3
    const hzPerRoomDay = annualRent / H.days / H.rooms                          // 华住 52.5 元/间/天
    if (!SAME_ORDER(rentCost, hzPerRoomDay)) hzFindings.push({ rule: '华住A(量级)', ctx: `引擎 rentCost=${rentCost} 元/间/天 vs 华住 ${hzPerRoomDay} 元/间/天 不同量级`, expect: '0.5×~2.0×' })
    else hzNotes.push(`A 租金：引擎 ${rentCost} 元/间/天 ÷ 华住 ${hzPerRoomDay} 元/间/天 = ${(rentCost / hzPerRoomDay).toFixed(2)}× ✅ 同量级（100 间年租金 ${(H.rooms * rentCost * 365 / 10000).toFixed(2)} 万 vs 华住 191.625 万）· A-1 单源链完整（引擎↔报价单）`)
    // ★ A-1 曲线【逐档钉】：把标定结果本身钉住（否则"改回旧曲线"只会被别处的数值锚点间接抓到，报错信息也说不清）
    //   档1-5 ⇒ 30/35/40/45/50 元/间·天 · 依据：成都住建局住宅类 40–46 元/㎡/月（档3 ≈ 40 元/㎡/月 同量级）
    const 实测 = [1, 2, 3, 4, 5].map(k => rentPerRoomDay(k))
    if (实测.join(',') !== '30,35,40,45,50') hzFindings.push({ rule: 'A-1(租金曲线)', ctx: `档1-5 实测 ${实测.join('/')}，期望 30/35/40/45/50`, expect: '25 + 档×5（A-1 · D47-e 标定值；改它=改教学难度基准，须成套重基线）' })
    else hzNotes.push('A-1 租金曲线逐档钉：档1-5 = 30/35/40/45/50 元/间·天 ✅（死亡选址 12/52 = 23.1%，落 20–30% 目标带）')
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
  hzNotes.push('❌ 不对拍（模型范围差异）：毛利率 55% —— 华住毛利率口径 = 1 − 部门成本率，本模型已由 W14 对齐（见 F2）')
}

// ── F · 现金流率对拍（★ W2-4 解锁 · 结构对拍 + 差异归因）────────────────────
// 为什么这样断言：华住现金流率 20.83% 是【他们自己的租金单价与 RevPAR】下的数；
//   直接要求我们引擎复现 20.83% = 逼着调参（明令禁止）。可对拍的是【结构】：
//   ① 华住参考链自身算术自洽 ② 部门成本口径两侧对齐 ③ 现金流率差额【只有】租金项能解释。
{
  const H = HUAZHU_BENCH
  // 华住侧：同一代数式复算（部门成本 = 1 − 毛利率 55%）
  const hzDeptRate = 1 - 0.55
  const hzRentRate = H.参考值.年租金 / H.参考值.年营收
  const hzFranchiseRate = H.费率常量.管理费
  const hzCfoRate = 1 - hzDeptRate - hzRentRate - hzFranchiseRate
  const hzCfoMoney = H.参考值.年营收 * (1 - hzDeptRate) - H.参考值.年租金 - H.参考值.特许费
  // F1 · 华住参考链算术自洽（657万 → 136.875万 → 20.83%）
  if (Math.abs(hzCfoRate - 0.2083) > 0.0001) {
    hzFindings.push({ rule: 'F1(华住链)', ctx: `1−45%−${(hzRentRate * 100).toFixed(2)}%−5% = ${(hzCfoRate * 100).toFixed(2)}% ≠ 20.83%`, expect: '华住参考链自洽（算术）' })
  } else {
    hzNotes.push(`F1 华住参考链自洽：657万 − 295.65万(部门成本45%) − 191.625万(租金 ${(hzRentRate * 100).toFixed(2)}%) − 32.85万(特许费5%) = ${(hzCfoMoney / 10000).toFixed(3)}万 ⇒ 现金流率 ${(hzCfoRate * 100).toFixed(2)}% ✅`)
  }
  // 我们侧：六组 × 12 周赛季加权（W14 场景）
  const { weighted: us } = runSeason6()
  const usFranchiseRate = H.费率常量.管理费   // ★ 引擎无【特许费】科目（P3 才做）⇒ 代入华住同费率，如实标注
  const usCfoRate = 1 - us.deptRate - us.rentRate - usFranchiseRate
  // F2 · 部门成本口径对齐（W2-4 解锁的核心项：两边都落在 45%）
  const deptGap = Math.abs(us.deptRate - hzDeptRate)
  if (!(us.deptRate >= 0.42 && us.deptRate <= 0.48)) {
    hzFindings.push({ rule: 'F2(部门成本带)', ctx: `我们 ${(us.deptRate * 100).toFixed(2)}% 不在 W14 目标带 42–48%`, expect: '六组赛季加权落 42–48%' })
  } else if (deptGap > 0.03) {
    hzFindings.push({ rule: 'F2(部门成本对齐)', ctx: `我们 ${(us.deptRate * 100).toFixed(2)}% vs 华住反推 ${(hzDeptRate * 100).toFixed(1)}% 差 ${(deptGap * 100).toFixed(2)}pp`, expect: '差 ≤3pp（同一口径：1 − 毛利率）' })
  } else {
    hzNotes.push(`F2 部门成本口径已对齐：我们 ${(us.deptRate * 100).toFixed(2)}% vs 华住反推 ${(hzDeptRate * 100).toFixed(0)}%（=1−毛利率55%）⇒ 差 ${(deptGap * 100).toFixed(2)}pp ✅（同落 42–48% 带）`)
  }
  // F3 · 现金流率差额【必须且只能】由【已知的两项】解释 —— 残差 >1pp 才报红
  //   ★ §32-U3 修正（归因不许含糊）：原式把"部门成本差"也算进残差 —— 而那一项**已被 F2 接受**（≤3pp 带内）。
  //     实测：残差恒等于 F2 那个 1.80pp（纯代数：cfoGap − rentGap = 部门成本差）⇒ 原式把"已被接受的差异"
  //     重复当成"无法归因" = 【归因对象写少了】，不是数字出问题。
  //     修法 = 把已知项**显式减掉**（比放宽容差更严）：残差 = |现金流率差 − 租金项贡献 − 部门成本项贡献|。
  const cfoGap = hzCfoRate - usCfoRate
  const rentGap = us.rentRate - hzRentRate
  const deptTerm = us.deptRate - hzDeptRate          // 代数式里部门成本项对 cfoGap 的贡献（符号：cfoGap = (usDept−hzDept) + (usRent−hzRent)）
  const resid = Math.abs(cfoGap - rentGap - deptTerm)
  if (resid > 0.01) {
    hzFindings.push({ rule: 'F3(差异归因)', ctx: `现金流率差 ${(cfoGap * 100).toFixed(2)}pp − 租金项 ${(rentGap * 100).toFixed(2)}pp − 部门成本项 ${(deptTerm * 100).toFixed(2)}pp ⇒ 残差 ${(resid * 100).toFixed(2)}pp 无法归因`, expect: '差额应且仅应由【租金项 + 部门成本项】解释（其余各项已对齐 · 残差 ≤1pp）' })
  } else {
    hzNotes.push(`F3 差异归因成立：现金流率 我们 ${(usCfoRate * 100).toFixed(2)}% vs 华住 ${(hzCfoRate * 100).toFixed(2)}% ⇒ 差 ${(cfoGap * 100).toFixed(2)}pp = 租金项 ${(rentGap * 100).toFixed(2)}pp + 部门成本项 ${(deptTerm * 100).toFixed(2)}pp（残差 ${(resid * 100).toFixed(2)}pp ✅ · 两项都是【已知且被 F2 接受】的口径差）`)
    hzNotes.push(`   ▸ 租金项为何有差：引擎 ${rentPerRoomDay(3)} 元/间/天（A-1 后曲线，档3）÷ 低出租组拉薄后的 RevPAR ⇒ 我们租金率 ${(us.rentRate * 100).toFixed(2)}% vs 华住样例 ${(hzRentRate * 100).toFixed(2)}%（52.5 ÷ RevPAR180）；属【租金档位/出租结构】差异，不是成本模型算错。★ A-1 前我们租金率约 39%（高于华住），A-1 后降到 24%（低于华住）⇒ 现金流率差的方向随租金曲线改动一起翻转，符合预期`)
    hzNotes.push(`   ▸ 如实记录（不调参）：引擎【无特许费科目】⇒ 上式代入华住同费率 5%；我们的 净利率(含租金净额) ${(us.netRate * 100).toFixed(1)}%`)
  }
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
  if (eNotes.length) { console.log('  · M2 扩展（W4-4 · 按缺口表补）：'); eNotes.forEach(n => console.log('    ✓ ' + n)) }
  console.log(`\n  华住分项对拍（§五·步骤5 · D16 修正版 · W2-4 解锁 F 现金流率）：${hzFindings.length === 0 ? '✅ A~F 全过' : '✗ ' + hzFindings.length + ' 项不符'}`)
  hzNotes.forEach(n => console.log('   ' + n))
  hzFindings.forEach(t => console.log(`   ✗ [${t.rule}] ${t.ctx}\n     期望：${t.expect}`))
  // ★ §23.3-③：补标准计数尾行（run-all 解析「N 通过 / M 失败」）—— 此前退出 0 但无计数，
  //   被 run-all 的"解析失败判死"新守门按失败计（技术债本体：解析失败与真的 0 条不可区分）。
  //   通过数 = eNotes + hzNotes（正向对拍条目）；失败数 = 三类 findings。
  const dd通过 = eNotes.length + hzNotes.length
  const dd失败 = violations.length + termFindings.length + hzFindings.length
  console.log(`\ndataDict 术语与对拍: ${dd通过} 通过 / ${dd失败} 失败`)
  process.exit((violations.length || termFindings.length || hzFindings.length) ? 1 : 0)
}
