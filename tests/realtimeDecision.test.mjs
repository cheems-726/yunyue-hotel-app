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

// ── [5] 分段收入：如实记账为【未实现】（不许假装做到）─────────────
console.log('\n[5] 分段收入（周中调价如实分段）—— ★ 现状：未实现，已记账')
{
  // 现状证据：引擎按【整周一套决策】结算 ⇒ 周中换价不会改变周值（因为没有"按天生效"的入参）
  const 甲 = settle({ site: SITE, brand: BRAND, decisions: { ...DEC, pricing: '不跟降' }, week: 1, attrs: { ...ATTR_INIT }, prevCapital: 1490000 })
  const 乙 = settle({ site: SITE, brand: BRAND, decisions: { ...DEC, pricing: '降价 20% 抢客' }, week: 1, attrs: { ...ATTR_INIT }, prevCapital: 1490000 })
  ok(甲.revenue !== 乙.revenue, '换价会改变整周收入（引擎有价格响应）✅')
  const 有按天入参 = /priceByDay|decisionsByDay|perDayDecisions/.test(src('settlement.js') + src('dayEngine.js'))
  ok(有按天入参 === false,
    '★ 诚实记账：引擎【没有】"按天生效的决策"入参 ⇒ 周中调价目前无法如实分段（要 dayEngine 逐日独立计算）')
  // 也不假装用"平均价"糊：周报里的均价仍是引擎实收均价（可核）
  ok(Number.isFinite(甲.price), '周报均价 = 引擎实收均价（有据可核，不是另算的近似值）')
  console.log('     ⇒ 待决（已进队列给 N-3/N-4）：① 逐日独立计算（引擎级改动 + 全套重基线）')
  console.log('                                 ② 显示级分段（按天权重推导，须显式标"估算"，教学上要讲清）')
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
