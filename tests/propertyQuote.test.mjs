// W3-2 · 认领页「物业报价单」断言（P2 交互层 · ★ 硬约束：不改任何结算数值）
// 运行：node tests/propertyQuote.test.mjs   （挂 run-all）
//
// 分四层：
//   ① 口径层：报价单每个数字都从【已有口径】推导（房量=parseRooms / 年租金=引擎租金公式 / 费率=franchiseModel）
//   ② 不编造层：缺来源的字段必须是「待补」（无经济条款的品牌 / 面积缺失 / 汉庭快捷缺保证金）
//   ③ 一致性层：物料数据的两份表示（字符串 area 与数字 areaNum）必须一致（防漂移）
//   ④ 零影响层：模块是纯函数 + settlement.js 不引用它 ⇒ 结算输出在构造上不可能变
import { readFileSync, readdirSync } from 'node:fs'
import { propertyQuote, quoteSummary, brandTerms, rentPerRoomDay, STATUS } from '../src/propertyQuote.mjs'
import { FRANCHISE_MODEL, 半接入品牌, 半接入禁止字段 } from '../src/franchiseModel.mjs'
import { 已接入品牌, franchiseFees } from '../src/franchiseFees.mjs'
import { parseRooms, settle } from '../src/settlement.js'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

const 汉庭 = { name: '汉庭', level: '经济型 · 国民', standard: '客房70间起' }
const 全季 = { name: '全季', level: '中档', standard: '客房80间起' }
const 物业 = { name: '社区旁物业', type: '社区型', area: '2600㎡', areaNum: 2600, rent: '中等' }
const 区县 = { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3 }

console.log('▶ W3-2 · 物业报价单（纯计算 · 不改结算）')

// ── ① 口径层 ──────────────────────────────────────────────────────────
console.log('\n[1] 口径层：每个数字都能追到已有口径')
{
  const q = propertyQuote(汉庭, 物业, 区县)
  const rooms = parseRooms(汉庭.standard)
  ok(q.rooms === rooms && rooms > 0, `房量 = parseRooms(品牌标准) = ${rooms}（与结算同源）`)
  const 年租金 = rooms * rentPerRoomDay(区县.租金) * 365
  ok(q.lines.find(l => l.label === '年租金').value === 年租金,
    `年租金 = 房量 × rentPerRoomDay(租金档) × 365 = ${年租金}（A-1 起与引擎同源，25+档×5）`)
  const 单价 = 年租金 / 2600 / 365
  const line单价 = q.lines.find(l => l.label === '租金单价')
  ok(Math.abs(line单价.value - 单价) < 1e-9 && line单价.status === STATUS.DERIVED,
    `租金单价 = 年租金 ÷ 面积 ÷ 365 = ${单价.toFixed(3)} 元/㎡·天（标注 derived：反推值，非独立数据源）`)
  const t = FRANCHISE_MODEL['汉庭']
  const 加盟费应 = Math.max(rooms * t.加盟费.单价.值, t.加盟费.下限.值)
  ok(q.lines.find(l => l.label === '加盟费').value === 加盟费应,
    `加盟费 = max(元/间 × 房量, 下限) = ${加盟费应}（含下限守卫）`)
  // ★ §22.2-B3：投资总额口径含 PMS 初装（与引擎开业一次性费用同源）
  const 总投应 = rooms * t.单房造价.新建.值 + 加盟费应 + t.保证金.值 + t.筹备费.值 + (t.PMS?.初装?.值 ?? 0)
  ok(q.lines.find(l => l.label === '总投资（估算）').value === 总投应,
    `总投资 = 单房造价×房量 + 加盟费 + 保证金 + 筹备费 = ${总投应}`)
  ok(!!q.sources && !!q.sources.来源 && !!q.sources.置信度, '三件套随行（来源/取数日期/置信度）可 hover 追溯',
    JSON.stringify(q.sources))
  ok(brandTerms('汉庭') !== null && brandTerms('全季') !== null && brandTerms('不存在的品牌') === null,
    'brandTerms：汉庭/全季（§14.3 起已有来源条款）返回条款、无该品牌条目返回 null')
}

// ── ② 不编造层 ────────────────────────────────────────────────────────
console.log('\n[2] 不编造层：缺来源 ⇒ 必须是"待补"')
{
  // 🔴 §16.2-B1 重基线：原用例用【桔子】做"无条款"样本 —— 但 B1 起桔子有了官方造价/门槛（半接入）
  //   ⇒ 本层改用**真正无任何条目**的星程（franchiseModel 里没有它）
  const 星程 = { name: '星程', standard: '客房70间起' }
  const q = propertyQuote(星程, 物业, 区县)
  const s = quoteSummary(q)
  ok(s.待补字段.includes('单房造价') && s.待补字段.includes('加盟费') && s.待补字段.includes('保证金') && s.待补字段.includes('筹备费'),
    '无经济条款的品牌（星程）：四项全部标「待补」（不拿别家费率冒充）', s.待补字段.join(','))
  ok(s.房量 > 0 && s.年租金 > 0 && s.总投资 === null,
    '但房量/年租金仍有值（来自引擎口径），总投资因缺造价而为空 —— 该有的不该误标待补', JSON.stringify(s))
  // §14.3 反向：已接入品牌【不许】被标待补（否则「接入」白做）
  const 全季票 = quoteSummary(propertyQuote(全季, 物业, 区县))
  ok(全季票.待补字段.length === 0 && 全季票.总投资 > 0,
    '已接入品牌（全季）：四项齐全、总投资有值 ⇒ 不再标待补', JSON.stringify(全季票.待补字段))
  const 快捷 = propertyQuote({ name: '汉庭快捷', standard: '客房60间起' }, 物业, 区县)
  ok(quoteSummary(快捷).待补字段.includes('保证金'), '汉庭快捷：franchiseModel 无保证金 ⇒ 标"待补"')
  const 无面积 = propertyQuote(汉庭, { name: '无面积物业', areaNum: null }, 区县)
  const 待补2 = quoteSummary(无面积).待补字段
  ok(待补2.includes('租金单价') && !待补2.includes('年租金'),
    '缺面积 ⇒ 只有"租金单价"待补（年租金不依赖面积，不该被牵连）', 待补2.join(','))
}

// ── ②b §16.2-B1：半接入四品牌（造价/门槛进报价单 · 费率待补 · 引擎不计费）────
console.log('\n[2b] §16.2-B1 半接入四品牌：造价/门槛有来源 · 费率缺就是缺 · 引擎不计费')
{
  ok(半接入品牌.length === 4, `半接入名单 = 4 个品牌（${半接入品牌.join('、')}）`)
  // ① 数据纪律：造价/门槛必须有【官方现行 API】来源 + 置信度高；费率类字段必须【不存在】
  const 缺造价 = 半接入品牌.filter(n => !FRANCHISE_MODEL[n]?.单房造价?.新建?.值)
  const 缺门槛 = 半接入品牌.filter(n => !FRANCHISE_MODEL[n]?.物业门槛 || Object.keys(FRANCHISE_MODEL[n].物业门槛).length === 0)
  ok(缺造价.length === 0, '四个品牌都有单房造价（官方现行 API）', 缺造价.join(','))
  ok(缺门槛.length === 0, '四个品牌都有物业门槛（官方现行 API）', 缺门槛.join(','))
  const 来源不对 = 半接入品牌.filter(n => {
    const c = FRANCHISE_MODEL[n].单房造价.新建
    return !/API brand\/\d+/.test(c.来源) || c.置信度 !== '高'
  })
  ok(来源不对.length === 0, '造价来源可追溯到 API brand/{id} 且置信度=高（不是转述/估值）', 来源不对.join(','))
  const 有费率 = 半接入品牌.filter(n => 半接入禁止字段.some(f => FRANCHISE_MODEL[n][f]))
  ok(有费率.length === 0, '【缺就是缺】四个品牌都没有管理费/CRS 字段（不拿别家费率冒充）', 有费率.join(','))
  // ② 报价单：总投资可算，且口径明写"哪几项未计入"
  const 桔子 = { name: '桔子', standard: '客房80间起' }
  const s桔 = quoteSummary(propertyQuote(桔子, 物业, 区县))
  // ★ 期望值从源头推导（房量走 parseRooms 权威），不贴死数字 —— 品牌标准一改这里不用重挂
  const 桔子房量 = parseRooms(桔子.standard)
  ok(s桔.总投资 === 桔子房量 * FRANCHISE_MODEL['桔子'].单房造价.新建.值,
    `半接入品牌总投资可算 = 造价 × 房量 = ${s桔.总投资}（房量 ${桔子房量} 来自 parseRooms）`, String(s桔.总投资))
  ok(/加盟费/.test(s桔.总投资口径) && /保证金/.test(s桔.总投资口径) && /未计入/.test(s桔.总投资口径),
    '总投资口径【逐项点名】未计入项（否则会被读成"就这么多"）', s桔.总投资口径)
  ok(!!s桔.来源 && s桔.置信度 === '高', '三件套随行：半接入品牌也能 hover 到来源/置信度', `${s桔.来源} · ${s桔.置信度}`)
  // ③ 引擎不计费：接入名单仍只有 3 个；半接入 ⇒ franchiseFees 返回 null ⇒ 结算逐字节不变
  ok(已接入品牌.length === 3 && 已接入品牌.join() === '汉庭,全季,海友',
    `接入名单未被本批改动（${已接入品牌.join('、')}）—— 半接入 ≠ 接入`)
  const 半接入计费 = 半接入品牌.map(n => franchiseFees({ name: n }, 100000)).filter(x => x !== null)
  ok(半接入计费.length === 0, '四个半接入品牌 franchiseFees(...) 全部返回 null（引擎不计费）')
  // 零变化：同名品牌换成一个"完全不存在"的名字 ⇒ 结算输出逐字节相同（证明计费没发生）
  const base = { price: '260-380元', standard: '客房80间起', level: '中档' }
  const dec = { pricing: '不跟降', shifts: '满编保服务' }
  const r桔 = settle({ site: 区县, brand: { name: '桔子', ...base }, decisions: dec, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } })
  const r无 = settle({ site: 区县, brand: { name: '不存在的品牌', ...base }, decisions: dec, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } })
  ok(JSON.stringify(r桔) === JSON.stringify(r无), '零变化：桔子 与"不存在品牌"结算输出【逐字节相同】⇒ 确实未计费')
  ok(r桔.franchiseFees === undefined, '结算结果里没有 franchiseFees 字段（未接入的既有语义不变）')
  // ④ 界面：费率栏必须显式"待补"（不许再出现手写的"约N元/间"）
  const ui = src('brands.mjs')   // ★ V76：brandGroups 已抽为纯数据模块（断言同步：文件搬家）
  const 待补卡片 = 半接入品牌.filter(n => ui.includes(`name: '${n}'`))
  ok(待补卡片.length >= 3, `界面可选列表里有 ${待补卡片.length} 个半接入品牌（CitiGO 未进列表，理由见 franchiseModel）`)
  const 无待补标注 = 待补卡片.filter(n => {
    const m = new RegExp(`name: '${n}'[^}]*?fee: '([^']*)'`).exec(ui)
    return !m || !/待补/.test(m[1])
  })
  ok(无待补标注.length === 0, '半接入品牌的「加盟费/费率」栏一律显示"待补"（撤掉原先的无来源数字）', 无待补标注.join(','))
}

// ── ②c 覆盖度：界面品牌列表 要么有单源条目、要么显式登记为"无官方来源" ────────
console.log('\n[2c] 覆盖度：界面品牌 × franchiseModel（表在但没盖全 = BL 族）')
{
  const ui = src('brands.mjs')   // ★ V76：brandGroups 已抽为纯数据模块（断言同步：文件搬家）
  const ui品牌 = [...ui.matchAll(/\{\s*name: '([^']+)',\s*icon:/g)].map(m => m[1])
  ok(ui品牌.length >= 18, `抓到界面品牌 ${ui品牌.length} 个`)
  const 有单源 = ui品牌.filter(n => !!FRANCHISE_MODEL[n])
  // ★ 无官方来源名单（显式登记 ⇒ 缺口可见、可追；★ 本名单是**如实记录**，不是"放行"）
  const 无官方来源 = ['宜必思', '星程', '漫心', '全季大观', '城际', '美居', '美仑', '禧玥', '花间堂', '施柏阁', '诺富特', '宋品', '施柏阁大观', '怡莱', '美仑美奂', '美仑国际']   // ★ V87：官方 API 枚举新增 3 家（怡莱/美仑美奂/美仑国际——费率官方无·显式待补）；CitiGO 有 FRANCHISE_MODEL 条目归有单源
  const 漏登 = ui品牌.filter(n => !有单源.includes(n) && !无官方来源.includes(n))
  ok(漏登.length === 0, '界面品牌 = 有单源条目 ∪ 无官方来源名单（无漏网）', 漏登.join(','))
  // 死条目自检：名单里的品牌必须真的"不在模型里"
  const 死条目 = 无官方来源.filter(n => !!FRANCHISE_MODEL[n])
  ok(死条目.length === 0, '无官方来源名单无死条目（进了模型就该从名单删掉）', 死条目.join(','))
  // 反向：有单源的品牌也不能虚列（名单与模型必须对得上）
  const 虚列 = 有单源.filter(n => !ui品牌.includes(n))
  ok(虚列.length === 0, '模型里有、界面却查不到的品牌 ⇒ 也报出来（模型与界面不许各说各话）', 虚列.join(','))
  ok(无官方来源.length > 0 && 有单源.length >= 6,
    `现状：有单源 ${有单源.length} 个 · 无官方来源 ${无官方来源.length} 个（★ 后者是**登记在案的缺口**，见批次报告诚实记录）`)
}

// ── ③ 一致性层 ────────────────────────────────────────────────────────
console.log('\n[3] 一致性层：物业数据的两份表示必须一致（防漂移）')
{
  const claim = src('Claim.jsx')
  // 从源码里抓 area/areaNum 成对值（按写法扫，不按"想到的位置"探）
  const pairs = [...claim.matchAll(/area:\s*'(\d+)㎡',\s*areaNum:\s*(\d+)/g)].map(m => ({ area: +m[1], areaNum: +m[2] }))
  ok(pairs.length >= 8, `抓到 ${pairs.length} 组 area/areaNum（覆盖各档次物业）`)
  const bad = pairs.filter(p => p.area !== p.areaNum)
  ok(bad.length === 0, '每组的 areaNum 与 area 字符串一致', bad.map(b => JSON.stringify(b)).join(' '))
  ok(/rooms:\s*'\d+间'/.test(claim) && !/roomsNum/.test(claim), '房量仍只以字符串展示（真值走 parseRooms，不另设数字字段防两套）')

  // ★ §16.2-B1 补充：**fmt 词表 × 渲染器** 必须对得上（"表在但没盖全"同族 ——
  //   新增一个 fmt 却没人渲染 ⇒ 掉进万元分支 ⇒ 渲染成 "NaN 万"，本批真踩过一次）
  const 已知fmt = ['wan', 'num', 'fixed2', 'text']
  const 用到fmt = new Set()
  for (const b of [{ name: '汉庭', standard: '客房70间起' }, { name: '全季', standard: '客房80间起' },
    { name: '桔子', standard: '客房80间起' }, { name: '你好', standard: '客房60间起' },
    { name: 'CitiGO 欢阁', standard: '客房60间起' }, { name: '星程', standard: '客房70间起' }]) {
    // ★ 只收【有值】的行：待补行没有 fmt（渲染层一律显示"待补"，不碰 fmt）
    for (const l of propertyQuote(b, 物业, 区县).lines) if (l.status !== STATUS.MISSING) 用到fmt.add(l.fmt)
  }
  const 未登记fmt = [...用到fmt].filter(f => !已知fmt.includes(f))
  ok(未登记fmt.length === 0, `报价单只使用已登记的 fmt 词表（${[...用到fmt].join('/')}）`, 未登记fmt.join(','))
  // ★ 必须先【剥注释】再查渲染器 —— 否则注释里写的 `'text'` 会让本断言恒绿（D33/§14 踩过的同一坑）
  const 渲染器缺分支 = 已知fmt.filter(f => !new RegExp(`'${f}'`).test(strip(claim)))
  ok(渲染器缺分支.length === 0, 'Claim.jsx 的 fmtLine 覆盖全部已知 fmt（剥注释后判定；新 fmt 不许静默 NaN）', 渲染器缺分支.join(','))
  // 区间类门槛必须已在【单源里】转成展示字符串 —— 渲染层拿数组会渲染成 "60,200"
  const 区间行 = propertyQuote({ name: '你好', standard: '客房60间起' }, 物业, 区县).lines
    .filter(l => /区间/.test(l.label) && l.status === STATUS.OK)
  ok(区间行.length > 0 && 区间行.every(l => typeof l.value === 'string' && /–/.test(l.value)),
    '区间类门槛在 propertyQuote 内已转展示字符串（不让渲染层处理数组）', JSON.stringify(区间行.map(l => l.value)))

  // ── 界面层（静态）：认领页必须真的渲染报价单（R3 反向验证：删块即红）──
  ok(/from '\.\/propertyQuote\.mjs'/.test(claim) && /propertyQuote\(brand, selectedProperty, location\?\.attrs\)/.test(claim),
    'Claim.jsx：引入并调用 propertyQuote（品牌 + 选中物业 + 区县属性）')
  ok(/\{step === 3 && quote &&/.test(claim) && /quote\.lines\.map/.test(claim),
    'Claim.jsx：第 3 步「项目决策」渲染报价单（条件渲染 + 逐行输出）')
  ok(/STATUS\.MISSING/.test(claim) && /待补 · 无来源数据/.test(claim), 'Claim.jsx：缺来源字段显示"待补"，不是空白或 0')
  ok(/收益侧/.test(claim) && /待决策队列/.test(claim), 'Claim.jsx：收益侧（出租率/回本周期）明示"待拍板口径"，此处不编造')
}

// ── ④ 零影响层 ────────────────────────────────────────────────────────
console.log('\n[4] 零影响层：结算输出不可能被本模块影响')
{
  ok(!/propertyQuote/.test(strip(src('settlement.js'))), 'settlement.js 不引用 propertyQuote（静态证明：改动不进结算路径）')
  const files = readdirSync(new URL('../src/', import.meta.url)).filter(f => /\.(js|jsx|mjs)$/.test(f) && !f.startsWith('settle-old'))
  const importers = files.filter(f => f !== 'propertyQuote.mjs' && /propertyQuote/.test(strip(src(f))))
  // 🔴 W3-1 重基线（D38-B）：引用方从"仅 Claim.jsx"扩为【交互层白名单】——
  //   onePageLedger（W3-1 钱账）需要报价单的"总投资"来算回本周期，属同一交互层；意图不变：不进结算路径
  const ALLOWED = ['Claim.jsx', 'onePageLedger.mjs']
  ok(importers.every(f => ALLOWED.includes(f)) && importers.includes('Claim.jsx'),
    `引用方限于交互层白名单（${importers.join(',')}）`, importers.join(','))
  // 纯函数：同输入同输出 + 不改入参
  const a1 = propertyQuote(汉庭, 物业, 区县), a2 = propertyQuote(汉庭, 物业, 区县)
  ok(JSON.stringify(a1) === JSON.stringify(a2), '纯函数：同输入两次调用结果逐字节相同')
  const frozen = JSON.stringify(物业)
  propertyQuote(汉庭, 物业, 区县)
  ok(JSON.stringify(物业) === frozen, '不改动入参对象（无副作用）')
  // 引擎锚点：确定性单配置（与批次报告一致）—— 若有人把报价单接进结算，这里会红
  const r = settle({ site: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }, brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }, decisions: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } })
  // 🔴 §22.2 重基线（B2）：week-1 结算现在含【开业一次性费用】（全季 80 间 = 349,000）
  //   ⇒ totalCost 81087+349000=430087 · netProfit 45053−349000=−303947 · 营收/GOP 不变
  // ★ §33-V4-A8 重基线：房价档 4 接线 ⇒ 锚点前进（126140/430087/−303947 → 128520/430753/−302233）
  ok(r.revenue === 128520 && r.totalCost === 430753 && r.netProfit === -302233,
    '引擎锚点（§22.2 重基线：B2 开业一次性费用 349,000 计入 week-1；营收/GOP 不变）', `${r.revenue}/${r.totalCost}/${r.netProfit}`)
}

// ── ⑤ §22.2-B3：两笔钱【同页可辨、不混淆】（IC ≠ 投资总额）────────────────
console.log('\n[5] §22.2-B3 两笔钱：IC（运营启动资金）≠ 投资总额（capex）· 同页并排')
{
  const claim = src('Claim.jsx')
  // ① 字面：两个概念的名字都出现在同一文件（同页可辨的字面证据）
  ok(/运营启动资金/.test(claim) && /投资总额/.test(claim), 'Claim 页同时出现「运营启动资金」与「投资总额」两个名字')
  // ② 数值：IC（SCALE 单源）≠ 投资总额（报价单口径）—— 两个字面断言钉住
  ok(/SCALE\.IC_NEW/.test(claim), 'IC 取自 SCALE 单源（不写死数字）')
  ok(/总投资（估算）/.test(claim), '投资总额读报价单（与结算同源的口径）')
  const 全季t = FRANCHISE_MODEL['全季']
  const rooms全季 = parseRooms(全季.standard)
  const ic = 1490000
  const capex = rooms全季 * 全季t.单房造价.新建.值 + Math.max(rooms全季 * 全季t.加盟费.单价.值, 全季t.加盟费.下限.值) + 全季t.保证金.值 + (全季t.筹备费?.值 ?? 0) + (全季t.PMS?.初装?.值 ?? 0)
  ok(ic !== capex && capex > ic * 2, `数值可辨：IC ${ic} ≠ 投资总额 ${capex}（capex 是 IC 的 ${(capex / ic).toFixed(1)} 倍 ⇒ 不可能混淆）`)
  // ③ 缺项品牌：待补不参与计算（星程无造价 ⇒ 投资总额为 null）
  const 星程q = propertyQuote({ name: '星程', standard: '客房70间起' }, 物业, 区县)
  ok(星程q.lines.find(x => x.label === '总投资（估算）').value === null, '缺造价品牌 ⇒ 投资总额待补（不编）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：报价单只做投资侧加减乘除，且每个数字可追溯 / 无来源一律待补')
process.exit(fail ? 1 : 0)
