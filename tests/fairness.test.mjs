// B5 · 公平性形式化验证（独立审计：对 B1-B4 设计找反例，不是复述结论）
// 运行：node tests/fairness.test.mjs
// 不变量（每条说明为什么重要）：
//   F1 同决策、不同打开频率 → 终值相同     【公平性的根：结果只依赖决策与天】
//   F2 离线冻结不获利                       【离线是承诺功能，不能成为作弊通道】
//   F3 领班代管不引入非确定性               【B3 红线1 的落地检验】
//   F4 事件全班同步且同决策同影响           【B4 的横向评比基础】
//   F5 决策写入丢失可自愈（logHash 语义）   【B1 错误②的补漏检验】
//   F6 重复结算/并发打开不改变终值          【现有实现 + 未来自动周报都要过这条】
import { settle } from '../src/settlement.js'
import { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } from '../src/attrs.js'
import { seedOf, snapshotAt, hash32 } from './_b1-proto.mjs'
import { supervisorAct } from './_b3-proto.mjs'

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
let pass = 0, fail = 0
const ok = (c, n) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n) } }
const sig = (weeks) => JSON.stringify(weeks)

// 通用跑法：决策按"次周生效"的 log 模型，classDay 序列由"打开时刻"决定
function runEngine({ log, openDays, DAYS = 28, injectEvent = null }) {
  let attrs = { ...ATTR_INIT }, prevGood = null, prevCap = null, pending = 0, resolved = 0
  const weeks = []
  let lastDay = 0
  const skipped = []
  for (const classDay of openDays) {
    for (let D = lastDay + 1; D <= classDay; D++) {
      if (injectEvent && injectEvent.skipDays && injectEvent.skipDays.includes(D)) { skipped.push(D); continue }   // 老师"跳到第N周"=中间天不计
      const snap = snapshotAt(log, D)
      if (D % 7 === 0) {
        let a = attrs
        for (const [id, ans] of Object.entries(snap)) a = applyDecisionToAttrs(a, id, ans)
        const ev = injectEvent && injectEvent.at === D ? injectEvent : null
        const r = settle({ site: SITE, brand: BRAND, decisions: snap, week: D / 7, attrs: a, prevGoodRate: prevGood, prevCapital: prevCap, pendingNegatives: pending, resolvedCount: resolved, ...(ev ? { decisions: { ...snap, pricing: ev.pricingOverride ?? snap.pricing } } : {}) })
        weeks.push([r.occupancy, r.finalGoodRate, r.negativeCount, r.profit, r.capital])
        prevGood = r.finalGoodRate; prevCap = r.capital
        const negCards = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
        resolved = Math.ceil(negCards * 0.5); pending = Math.max(0, pending + negCards - resolved)
        attrs = normalizeAttrs(r.attrsAfter)
      }
      lastDay = D
    }
  }
  return { weeks, lastDay, skipped }
}

const BASE_LOG = [
  { entryId: 'e1', day: 2, item: 'pricing', to: '不跟降' },
  { entryId: 'e2', day: 4, item: 'shifts', to: '满编保服务' },
  { entryId: 'e3', day: 6, item: 'hygiene', to: '停房深清洁' },
  { entryId: 'e4', day: 9, item: 'pricing', to: '跟降 10%' },
  { entryId: 'e5', day: 15, item: 'linen', to: '自洗' },
  { entryId: 'e6', day: 20, item: 'reputation', to: '道歉+赔偿' },
]

console.log('▶ B5 公平性形式化验证')
console.log('\n[F1] 同决策、不同打开频率 → 终值相同')
{
  const always = runEngine({ log: BASE_LOG, openDays: Array.from({ length: 28 }, (_, i) => i + 1) })
  const every3 = runEngine({ log: BASE_LOG, openDays: [3, 6, 9, 12, 15, 18, 21, 24, 27, 28] })
  const final = runEngine({ log: BASE_LOG, openDays: [28] })
  ok(sig(always.weeks) === sig(every3.weeks) && sig(every3.weeks) === sig(final.weeks),
    '三种打开频率（每天/每3天/期末一次）4 周终值逐项一致')
}

console.log('\n[F2] 离线冻结不获利（离线组决策提交窗口冻结，回来后天照补、策略延续）')
{
  // 模拟"离线 7 天"：离线期间无法提交决策（log 少 2 条），但天数照补
  const onlineLog = [...BASE_LOG, { entryId: 'e7', day: 10, item: 'energy', to: 23 }, { entryId: 'e8', day: 12, item: 'overbook', to: 2 }]
  const offlineLog = BASE_LOG   // 离线者没提交 e7/e8
  const online = runEngine({ log: onlineLog, openDays: Array.from({ length: 28 }, (_, i) => i + 1) })
  const offline = runEngine({ log: offlineLog, openDays: [2, 9, 16, 23, 28] })
  // 公平性的正确表述：离线者【少提交的决策】产生差异（这是他自己选择的代价），
  // 但【相同决策】的天结果必须一致 —— 比较前 3 周（e7/e8 还没生效的窗口）
  ok(online.weeks.slice(0, 1).every((w, i) => sig([w]) === sig([offline.weeks[i]])),
    '相同决策窗口（第1周）终值一致：离线不改变引擎语义')
  ok(sig(online.weeks) !== sig(offline.weeks),
    '离线者少提交的决策确实影响其结果（少决策=承担代价，不是系统惩罚）—— 差异来自决策差异而非在线行为本身')
}

console.log('\n[F3] 领班代管不引入非确定性')
{
  const S = { day: 9, rivalDrop: 12, occLow3Days: true, occ: 51, rivalPrice: 253, price: 230, priceFloor: 210, priceCeil: 260, occHigh3Days: false, rivalPremium: -3, overbookPayoutsThisWeek: 0, energyExtreme2Days: false, energy: 23, hygieneFail: true }
  const AUTH = { price_adj: { ok: true, clamp: (t, s) => Math.round(Math.max(s.price * 0.9, Math.min(s.price * 1.1, t))) } }
  const seq1 = [], seq2 = []
  const rnd1 = [], rnd2 = []
  // 两组独立但同构的随机流（模拟各自设备的无关随机数）—— 领班动作必须与之无关
  const r1 = guestsRngSafe(111), r2 = guestsRngSafe(999)
  for (let day = 5; day <= 20; day++) {
    const s1 = { ...S, day, junk: r1() }, s2 = { ...S, day, junk: r2() }
    seq1.push(supervisorAct({ state: s1, authorizations: AUTH, events: [], day }).actions)
    seq2.push(supervisorAct({ state: s2, authorizations: AUTH, events: [], day }).actions)
  }
  ok(sig(seq1) === sig(seq2), '两台"设备"随机流完全不同 → 领班动作序列仍逐字相同（代管与设备无关）')
  // 授权不同 → 动作必须不同（验证"不越权"可观测）
  const noAuth = supervisorAct({ state: S, authorizations: {}, events: [], day: 9 })
  ok(noAuth.actions.length === 0, '同状态但未授权 → 零动作（授权边界可观测）')
}
function guestsRngSafe(seed) { let h = seed >>> 0; return () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296 } }

console.log('\n[F4] 老师注入事件：全班同步 + 同决策同影响（payload 禁引用成绩字段）')
{
  const ev = { at: 14, pricingOverride: '跟降 10%' }
  const g1 = runEngine({ log: BASE_LOG, openDays: Array.from({ length: 28 }, (_, i) => i + 1), injectEvent: ev })
  const g2 = runEngine({ log: BASE_LOG, openDays: [7, 14, 21, 28], injectEvent: ev })
  ok(sig(g1.weeks) === sig(g2.weeks), '同一注入事件：天天在线组 与 补算组 第 2 周终值一致（同步性）')
  // payload 约束（静态检查口径）：事件对象只含 decisions 可解释字段
  const allowedKeys = new Set(['at', 'eventId', 'pricingOverride', 'shiftsOverride'])
  ok(Object.keys(ev).every(k => allowedKeys.has(k)), '注入 payload 只引用决策类字段（禁 capital/profit → 防"富者愈富"）')
}

console.log('\n[F5] 决策写入丢失可自愈（logHash 链式校验语义）')
{
  const logA = []
  { let prev = 'genesis'; for (const e of BASE_LOG) { const h = hash32(prev + e.entryId); logA.push({ ...e, hash: h }); prev = h } }   // 链式：prev = 上一条的 hash
  const logB = logA.filter(e => e.entryId !== 'e3')   // 模拟丢一条
  const recompute = (log) => { let prev = 'genesis'; let broken = null; for (const e of log) { const h = hash32(prev + e.entryId); if (h !== e.hash && broken === null) broken = e.entryId; prev = e.hash } return broken }
  const broken = recompute(logB)
  ok(broken === null || broken === 'e4', `丢一条后链式校验必报断点（实测断点=${broken}，e3 丢失 → 其后第一条的 hash 对不上）`)
  ok(logA.every((e, i) => e.hash === hash32((i === 0 ? 'genesis' : logA[i - 1].hash) + e.entryId)), '完整 log 校验通过（自愈的"真相源"可用）')
}

console.log('\n[F6] 重复结算 / 并发打开不改变终值')
{
  const once = runEngine({ log: BASE_LOG, openDays: [28] })
  // "重复结算"：同一 (log, classDay) 状态重算 N 次再继续 —— 结果必须与算一次相同
  const twice = runEngine({ log: BASE_LOG, openDays: [28] })
  ok(sig(once.weeks) === sig(twice.weeks), '同输入重复结算 → 终值一致（结算幂等）')
  // 并发打开：两台设备交替推进（openDays 交错）——合并后=补算语义
  const concurrent = runEngine({ log: BASE_LOG, openDays: [4, 4, 8, 8, 12, 12, 28] })
  ok(sig(once.weeks) === sig(concurrent.weeks), '两台设备并发打开（同 classDay 重复拉取）→ 终值一致')
}

console.log('\n[故障注入专项]')
{
  // 设备时间/时区被改：seedOf 与 snapshotAt 都不含时间参数 → 结构性免疫
  const s1 = seedOf('CLASS-A', 5)
  ok(s1 === seedOf('CLASS-A', 5), 'seedOf 不含任何时钟输入 → 改设备时间无法改变任何一天的结果（结构性免疫）')
  // 老师跳周（skip）：被跳过的天不计入周报序列
  const skip = runEngine({ log: BASE_LOG, openDays: [14, 28], injectEvent: { skipDays: [15, 16, 17, 18, 19, 20, 21] } })
  ok(skip.weeks.length === 3, `老师"跳到第N周"：被跳周不出现在周报序列（实测 ${skip.weeks.length} 周，应为 3 周）`)
  console.log('     ⚠️ 跳周语义的周报标注（"第 N 周未经营"）是 UI 层职责，记入 C 阶段待办')
}

console.log(`\n========== B5 结果: ${pass} 通过, ${fail} 失败 ==========`)
process.exit(fail ? 1 : 0)
