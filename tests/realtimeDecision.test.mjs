// E3 · 实时决策（粒度丙）守门（N-3 · fast 套件）
// 运行：node tests/realtimeDecision.test.mjs
//
// ── 本套件治什么 ────────────────────────────────────────────────
//   E3 把"一周一次性决策"改成【三档节奏 + 次日生效 + 当日不可回溯】。四个风险点逐个钉：
//     ① 归属日 = classDay + 1（跨日/跨周边界各一例；客户端不判定归属 —— 只提交意图）
//     ② 当日不可回溯（提交"昨天/今天"一律拒绝，不许静默生效）
//     ③ 三档在界面上【可辨】（18 项全有档位 + 界面引用单源 + 文案齐全）
//     ④ 公平性：同决策、不同"在线时长" ⇒ 期末资金相同（可机器证）
//   另：**分段收入**（周中调价如实分段）如实记账为【未实现】—— 它依赖 dayEngine 的"逐日独立计算"，
//       属引擎级改动（会牵动全部锚点）⇒ 本套件把现状钉成"证据 + 待决"，不假装做到了。
import { readFileSync } from 'node:fs'
import { 档, 已定档, 待定档, 档位, 按档分组, 归属日, 可提交, 档语, 覆盖度 } from '../src/decisionCadence.mjs'
import { decisions } from '../src/decisions.js'
import { advanceGroupToDay } from '../src/serverTick.mjs'
import { settle } from '../src/settlement.js'
import { settleWeekSegmented } from '../src/weekSegments.mjs'                        // §19.1 单元1·B4
import { diffDecisions, decisionsByDayFrom, revenueSegments } from '../src/weeklyAuto.mjs'
import { ATTR_INIT } from '../src/attrs.js'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2, district: '锦江区' }
const DEC = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }

console.log('▶ E3 · 实时决策（三档 · 次日生效 · 不可回溯 · 公平性）')

// ── [1] 归属日 = classDay + 1（跨日/跨周各一例）────────────────
console.log('\n[1] 归属日 = classDay + 1（T11 · 客户端不判定归属）')
{
  ok(归属日(6) === 7, '跨日：classDay 6 ⇒ 归属日 7')
  ok(归属日(7) === 8, '跨周：classDay 7（第 1 周第 7 天）⇒ 归属日 8（第 2 周第 1 天）—— 周界不特殊处理')
  ok(归属日(14) === 15, '第二周同理：14 ⇒ 15')
  ok(归属日(0) === 1 && 归属日(NaN) === 1 && 归属日(-3) === 1, '非法 classDay 一律归 1（不 NaN）')
  ok(归属日(3.4) === 4 && 归属日('5') === 6, '小数/字符串入参：四舍五入后再 +1（不产小数归属日）')
}

// ── [2] 当日不可回溯（提交"昨天/今天"一律拒绝）──────────────────
console.log('\n[2] 不可回溯（"改过去"必须被拒，不许静默生效）')
{
  ok(可提交(5, 6) === true, 'classDay 5 提交"明天(6)"⇒ 可提交')
  ok(可提交(5, 5) === false, 'classDay 5 提交"今天(5)"⇒ 拒绝（当日已发生）')
  ok(可提交(5, 4) === false, 'classDay 5 提交"昨天(4)"⇒ 拒绝')
  ok(可提交(5, 7) === true, 'classDay 5 提交"后天(7)"⇒ 可提交（未来日不禁止，但不提前生效）')
  ok(可提交(NaN, NaN) === false && 可提交(5, NaN) === false, '非法目标日 ⇒ 拒绝（默认安全）')
  // 语义闭合：可提交(x, y) 等价于 y ≥ 归属日(x)
  const 不符 = []
  for (let cd = 0; cd <= 20; cd++) for (let t = 0; t <= 22; t++) if (可提交(cd, t) !== (t >= 归属日(cd))) 不符.push(`${cd}->${t}`)
  ok(不符.length === 0, '语义闭合：可提交(cd,t) ⇔ t ≥ 归属日(cd)（21×23 = 483 组合全对）', 不符.slice(0, 3).join(','))
}

// ── [3] 三档在界面上可辨（18 项全有档位 + 界面引用单源）──────────
console.log('\n[3] 三档可辨（D47-d 已拍口径）')
{
  const c = 覆盖度()
  ok(c.全部.length === 18 && c.未覆盖.length === 0 && c.重复.length === 0,
    '18 项决策全部落档、无遗漏、无重复', JSON.stringify({ 未覆盖: c.未覆盖, 重复: c.重复 }))
  ok(待定档.length === 0, '无待定项（D47-d 代拍后已清空）')
  // 档位数量与代拍口径一致：实时 9 / 周期 7 / 一次性 2
  const 数 = { [档.实时]: 已定档[档.实时].length, [档.周期]: 已定档[档.周期].length, [档.一次性]: 已定档[档.一次性].length }
  ok(数[档.实时] === 9 && 数[档.周期] === 7 && 数[档.一次性] === 2,
    `档位分布 = 实时 9 / 周期 7 / 一次性 2（实测 ${数[档.实时]}/${数[档.周期]}/${数[档.一次性]}）`)
  // 代拍的 7 项必须落在正确档（防止"塞错组"）
  const 代拍 = { 'quality-check': 档.实时, hygiene: 档.实时, reputation: 档.实时, emergency: 档.实时,
    'report-diagnosis': 档.周期, corporate: 档.周期, 'member-threshold': 档.周期 }
  const 错 = Object.entries(代拍).filter(([id, k]) => 档位(id) !== k)
  ok(错.length === 0, 'D47-d 代拍的 7 项各自落在正确档', 错.map(x => x[0]).join(','))
  // 界面：列表徽标 + 决策面板档位行（都引用单源，不另写一份档位表）
  const app = src('App.jsx'), dp = src('DecisionPanel.jsx')
  ok(/from '\.\/decisionCadence\.mjs'/.test(app) && /cadenceOf\(d\.id\)/.test(app), 'App 决策列表徽标引用单源档位')
  ok(/from '\.\/decisionCadence\.mjs'/.test(dp) && /cadenceOf\(decision\.id\)/.test(dp), 'DecisionPanel 头部档位行引用单源档位')
  ok(!/quality-check.*realtime|realtime.*quality-check/.test(dp + app), '界面文件里没有硬编码档位表（必须走 decisionCadence）')
  ok(档语[档.实时].说明.includes('次日生效') && 档语[档.周期].说明.includes('7 天') && 档语[档.一次性].说明.includes('1–2 次'),
    '三档文案齐全且说清节奏（实时=次日生效 / 周期=7 天一次 / 一次性=1–2 次）')
  const 分组 = 按档分组(decisions)
  ok(分组[档.实时].length === 9 && 分组[档.周期].length === 7 && 分组[档.一次性].length === 2,
    '按档分组保持 decisions.js 原顺序且数目正确（界面直接用）')
}

// ── [4] 公平性：同决策、不同"在线时长" ⇒ 期末资金相同 ─────────────
console.log('\n[4] 公平性红线（可机器证）：不同在线时长、同决策 ⇒ 期末结果相同')
{
  const 底 = { brand: BRAND, location: SITE, history: [], capital: 1490000, attrs: { ...ATTR_INIT }, __groupKey: 'fair|1' }
  // 在线：逐日推进到第 7 天
  let 在线 = 底
  for (let d = 1; d <= 7; d++) 在线 = advanceGroupToDay(在线, d, { decisions: DEC }).save
  // 离线：一次直接补算到第 7 天（"关掉几天再打开"）
  const 离线 = advanceGroupToDay(底, 7, { decisions: DEC }).save
  ok(JSON.stringify(在线.history) === JSON.stringify(离线.history), '逐日在线 与 一次补算 ⇒ history 逐字节相同')
  ok(在线.capital === 离线.capital, `期末资金相同（${在线.capital} === ${离线.capital}）`)
  // 幂等：离线补算再来一次 ⇒ 不变
  const 再 = advanceGroupToDay(离线, 7, { decisions: DEC }).save
  ok(再.capital === 离线.capital && JSON.stringify(再.history) === JSON.stringify(离线.history),
    '补算幂等：同一天重复补算 ⇒ 结果不变')
  // 反证：改一项决策 ⇒ 结果必须变（证明上面的"相同"不是恒等假绿）
  const 改 = advanceGroupToDay(底, 7, { decisions: { ...DEC, pricing: '降价 20% 抢客' } }).save
  ok(JSON.stringify(改.history) !== JSON.stringify(离线.history), '反证：改一项决策 ⇒ 结果确实变化（一致性非恒真）')
}

// ── [5] ★ §19.1（单元 1·B4）：引擎级分段 —— 施工期护栏【显式翻转】────────────
// 🔴 本段原为【施工期护栏】：断言「引擎没有按天入参」（即"分段收入未实现，已记账"）。
//    §19.1 明确要求：**B4 落地时必须显式翻转它，不许悄悄删**（悄悄删 = 假绿家族）。
//    ⇒ 它的使命结束了：**按天生效的决策入参现已存在**（`decisionsByDay` + `decisionsByDayFrom`
//      + `settleWeekSegmented`），所以护栏翻转为"**必须存在**"。
console.log('\n[5] 引擎级分段（★ 施工期护栏已按要求显式翻转：从"必须不存在"→"必须存在"）')
// 老路径基准（水位线对照）：同一输入下 settle 的输出，必须与"无改动"的分段结果逐字节相同
const 甲0 = settle({ site: SITE, brand: BRAND, decisions: { ...DEC }, week: 1, attrs: { ...ATTR_INIT }, prevCapital: 1490000 })
{
  // ① 护栏翻转：按天入参【必须】存在（原断言是 `=== false`）
  const 有按天入参 = /decisionsByDay/.test(src('weekSegments.mjs') + src('weeklyAuto.mjs'))
  ok(有按天入参 === true,
    '★ 护栏翻转：引擎【已】有"按天生效的决策"入参（decisionsByDay / decisionsByDayFrom）⇒ 分段收入可实算')
  ok(/settleWeekSegmented/.test(src('weekSegments.mjs')), '分段结算入口 settleWeekSegmented 在位')
  // ② ★★ 水位线（最重要）：周内无改动 ⇒ 与既有路径【逐字节相同】
  const 无改动 = settleWeekSegmented({ site: SITE, brand: BRAND, decisions: { ...DEC }, week: 1, attrs: { ...ATTR_INIT }, prevCapital: 1490000 })
  ok(JSON.stringify(无改动) === JSON.stringify(甲0), '★★ 水位线：周内无改动 ⇒ 逐日实算 === 既有路径【逐字节】（键数也相同）',
    `${Object.keys(无改动).length} vs ${Object.keys(甲0).length}`)
  const 七天同 = settleWeekSegmented({ site: SITE, brand: BRAND, decisions: { ...DEC }, decisionsByDay: Array(7).fill({ ...DEC }), week: 1, attrs: { ...ATTR_INIT }, prevCapital: 1490000 })
  ok(JSON.stringify(七天同) === JSON.stringify(甲0), '★ 水位线：显式传"7 天同一套决策"也必须逐字节相同（1 段走老路径）')
  // ③ 有改动：第 4 天调价 ⇒ 段=2 · Σ分段 === 周值 · Σ7天 === 周值（不重不漏）
  const 低价 = { ...DEC, pricing: '不跟降' }
  const 高价 = { ...DEC, pricing: '降价 20% 抢客' }
  const 分段 = settleWeekSegmented({
    site: SITE, brand: BRAND, decisions: 高价, week: 1, attrs: { ...ATTR_INIT }, prevCapital: 1490000,
    decisionsByDay: [低价, 低价, 低价, 高价, 高价, 高价, 高价],
  })
  ok(Array.isArray(分段.segments) && 分段.segments.length === 2, `周中调价 ⇒ 分成 2 段（实测 ${分段.segments?.length}）`)
  ok(分段.segments[0].from === 1 && 分段.segments[0].to === 3 && 分段.segments[1].from === 4 && 分段.segments[1].to === 7,
    '段边界 = 生效日分段（1-3 天旧价 / 4-7 天新价）', JSON.stringify(分段.segments.map(s => s.from + '-' + s.to)))
  const Σ段 = 分段.segments.reduce((a, s) => a + s.revenue, 0)
  ok(Σ段 === 分段.revenue, `★ Σ分段 === 周报收入（不重不漏）：${Σ段} === ${分段.revenue}`)
  const Σ天 = 分段.dailySnapshots.reduce((a, d) => a + d.revenue, 0)
  const Σ天现金 = 分段.dailySnapshots.reduce((a, d) => a + d.cashDelta, 0)
  ok(分段.dailySnapshots.length === 7 && Σ天 === 分段.revenue, `Σ7天 === 周值（${Σ天} === ${分段.revenue}）`)
  ok(Σ天现金 === 分段.profit, `Σ7天 cashDelta === 周利润（${Σ天现金} === ${分段.profit}）`)
  // ④ ★ 实算（非估算、非平均摊、非"拿一个值按权重摊"）—— 用【判别量】钉住：
  //   若实现退化成"每段都用同一套决策"（= 回到"取周初决策"），分段周值会**塌到**那一种全周值。
  //   正确实现下它必须**严格介于**两种全周值之间（本周改动 = 前 3 天旧价 + 后 4 天新价）。
  const 全周低 = settle({ site: SITE, brand: BRAND, decisions: 低价, week: 1, attrs: { ...ATTR_INIT }, prevCapital: 1490000 }).revenue
  const 全周高 = settle({ site: SITE, brand: BRAND, decisions: 高价, week: 1, attrs: { ...ATTR_INIT }, prevCapital: 1490000 }).revenue
  const 下界 = Math.min(全周低, 全周高), 上界 = Math.max(全周低, 全周高)
  ok(分段.revenue > 下界 && 分段.revenue < 上界,
    `★ 分段周值【严格介于】两种全周值之间 ${下界} < ${分段.revenue} < ${上界} ⇒ 是真混合（不是退回单一决策）`)
  ok(分段.revenue !== 全周低 && 分段.revenue !== 全周高,
    '★ 判别量：分段值【不塌到】任一全周值（若实现退化成"每段同一决策"，此条必红——RV 靶子）')
  const 日均 = 分段.segments.map(s => s.revenue / s.天)
  ok(Math.abs(日均[0] - 日均[1]) > 0.5, `两段日均收入确实不同（${日均.map(x => x.toFixed(0)).join(' vs ')}）`)
  // ⑤ 守恒 + 随机流未动
  ok(分段.capital - 1490000 === 分段.profit, `守恒：资金变化 === 合并后利润（${分段.capital - 1490000}）`)
  ok(!/Math\.random/.test(src('weekSegments.mjs')), '不引入新随机源（Math.random 零命中）')
  // ⑥ 生效日 → 天数：decisionsByDayFrom 按 T11 应用
  const rows = diffDecisions({ ...低价 }, { ...高价 }, { day: 3 })   // 第 3 天提交 ⇒ 第 4 天生效
  const byDay = decisionsByDayFrom({ base: { ...低价 }, changes: rows, week: 1 })
  ok(rows[0]?.生效日 === 4, `变更记录：第 3 天提交 ⇒ 生效日 = 4（实测 ${rows[0]?.生效日}）`)
  ok(byDay.length === 7 && byDay[0].pricing === '不跟降' && byDay[3].pricing === '降价 20% 抢客' && byDay[6].pricing === '降价 20% 抢客',
    'decisionsByDayFrom：第 1-3 天用旧值、第 4 天起用新值（生效日语义落地）')
  ok(byDay.slice(0, 3).every(d => d.pricing === 低价.pricing) && byDay.slice(3).every(d => d.pricing === 高价.pricing),
    '★ 分段边界与生效日一致（前 3 天 / 后 4 天）')
  // ⑦ ★ §19.1 第 4 项：周报/钱账的分段卡【撤掉"估算"标注】（有真分段时）
  const 卡 = revenueSegments(分段, rows, null)
  ok(卡 && 卡.实算 === true, '周报分段卡：引擎给真分段时标【实算】而非估算')
  ok(!/估算/.test(卡.标题 + 卡.说明), '★ 撤掉"估算"标注：标题与说明里不再出现"估算"字样', 卡.标题)
  ok(卡.rows.every(x => Number.isFinite(x.金额)), '分段行显示【真值金额】（不再是"约 X 元"的估算字段）')
  const 旧档卡 = revenueSegments({ ...分段, segments: undefined }, rows, null)
  ok(旧档卡 && 旧档卡.估算 === true && /估算/.test(旧档卡.标题),
    '旧档/无真分段 ⇒ 回退估算路径且标注照旧（向后兼容；不许静默变"实算"）')
  // ⑧ 周报均价仍可核（不因分段而改口径）
  ok(Number.isFinite(甲0.price), '周报均价 = 引擎实收均价（有据可核）')
}

// ── [6] 反向验证靶子：归属日改成"当天生效" ⇒ [1][2] 必红 ──────────
console.log('\n[6] 反向验证靶子（把归属日改成 classDay ⇒ 本套件必须红）')
{
  const 当天生效 = (cd) => Math.max(0, Math.round(Number(cd) || 0))        // ← RV 时用的错误实现
  const 现 = 归属日(5), 错 = 当天生效(5)
  ok(现 === 6 && 错 === 5 && 现 !== 错, '归属日(5)：正确 6 / 错误 5 —— 两者可区分（RV 注入点明确）')
  ok(可提交(5, 5) === false && (5 >= 当天生效(5)) === true,
    '"当天生效"会让 可提交(5,5) 变 true（即允许改今天）⇒ [2] 的方案级断言必红 —— RV 可复现')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
// ── [7] E4 前置：客户端"离线 N 天再打开" === 服务端逐日推进 ─────────────
console.log('\n[7] E4 补算（离线 N 天）=== 全程在线（客户端等效 vs 服务端权威）')
{
  const 底 = { brand: BRAND, location: SITE, history: [], capital: 1490000, attrs: { ...ATTR_INIT }, __groupKey: 'backfill|1' }
  // 服务端权威：一次推进到第 14 天（= 学生离线两周后打开）
  const 服务端 = advanceGroupToDay(底, 14, { decisions: DEC })
  // 客户端等效：按"每周一次、同决策"链式结算两周（= 一直在线的等效）
  let cap = 底.capital, attrs = { ...ATTR_INIT }
  const hist = []
  for (const wk of [1, 2]) {
    const r = settle({ site: SITE, brand: BRAND, decisions: DEC, week: wk, attrs, prevCapital: cap, prevGoodRate: hist.length ? hist[hist.length - 1].finalGoodRate : null })
    hist.push(r); cap = r.capital; attrs = r.attrsAfter
  }
  ok(cap === 服务端.save.capital, `期末资金：客户端补算 ${cap} === 服务端 ${服务端.save.capital}（逐字节）`)
  const 客户端序列 = hist.map(h => ({ w: h.week, rev: h.revenue, p: h.profit }))
  const 服务端序列 = 服务端.save.history.map(h => ({ w: h.week, rev: h.revenue, p: h.profit }))
  ok(JSON.stringify(客户端序列) === JSON.stringify(服务端序列), '逐周 {周号, 营收, 利润} 序列逐字节相同（两周）')
  console.log('     ★ 浏览器侧 e2e 映射：ui-smoke / verify-capital / verify-live-review-ui 均把 openDayNo 提前 6–13 天再刷新 ⇒')
  console.log('       正是"关了若干天再打开"的等效路径，且断言了周报自动产生 —— 三项通过即 E4 的浏览器侧证据')
  console.log('     ★ 已知边界（记账）：客户端独有入参（实时评价/危机/处理数）服务端拿不到 ⇒ 有实时评价的周尚不成立')
  console.log('       （weeklyAuto.test.mjs [3] 已把它钉成可复现断言）')
}

console.log('验收口径：归属日不是+1、可回溯、三档不全、公平性破、假装做了分段收入 —— 任一即红')
process.exit(fail ? 1 : 0)
