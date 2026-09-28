// §16.2-B7 · 周结算的【周内输入】单一来源（补算 === 在线 的前置）
//
// ── 为什么需要本模块（问题陈述）──────────────────────────────────
//   `settle()` 除站点/品牌/决策外，还吃 5 个【周内产生】的输入：
//     pendingNegatives（未处理差评欠账，压口碑）· resolvedCount（已整改数，触发追加好评）
//     liveNegCount / livePosCount（本周实时流水里已产出的评价 ⇒ 结算只补差额，不重复出卡）
//     crisisResponse（上周危机应对选择，±口碑）
//   客户端从 localStorage（评价流水 + 危机选择）现算；**服务端原来一个都拿不到** ⇒
//   "补算 === 在线"在这些输入非零的周**不成立**（§15 报告 §七 已如实挂账）。
//
// ── 本模块的定位（单源，不许各写一份）────────────────────────────
//   ★ 本文件是这 5 个输入的**唯一派生点**。客户端（落存档 / 上传云端）与服务端（补算）都调它。
//   ★ 为什么"存档里的 weekInputs"而不是"让服务端自己算"：
//     服务端只有存档，**看不到 localStorage**（评价流水与危机选择都不在存档载荷里）
//     ⇒ 必须由客户端把派生结果随存档带上去（`cloudState.weekInputs`）。
//   ★ 公平性红线（D2）不受影响 —— 这是**实测**不是推断：
//     实时评价数（liveNeg/livePos）只决定"哪些卡在实时里已经出过"，
//     **不改变任何业务数字**（营收/利润/出租率/好评率全同）。
//     ⇒ 守门 `tests/weeklyAuto.test.mjs` 有专门断言钉住这条（防止将来有人改坏）。
//
// ── 与 App.jsx 的历史口径逐字一致（迁移不改行为）──────────────────
//   ① 只数【结算生成的卡片】（id 形如 `w<周>-n0`）—— 排除口碑页演示初值（数字 id）与实时卡；
//      实时卡若计入欠账会变成"开 App 越久欠账越多" ⇒ 破坏公平性。
//   ② 本周实时评价按 `live === true && liveWeek === week` 取。
//   ③ 危机选择只在 `crisis.week === week - 1` 时生效（上周选、这周结算时用）。

export const WEEK_INPUTS_VERSION = 1

// 缺省（没有存档输入时）：全 0 / 无危机 —— 与服务端补算的兜底口径一致
export const 空周输入 = (week) => ({
  版本: WEEK_INPUTS_VERSION, week: Number(week),
  pendingNegatives: 0, resolvedCount: 0, liveNegCount: 0, livePosCount: 0, crisisResponse: null,
})

const 非负整数 = (v) => Math.max(0, Math.floor(Number(v) || 0))

/**
 * 从「评价流水 + 危机选择」派生本周结算输入（纯函数）
 * @param {{reviews?:Array, week:number, crisis?:{week:number,choice:string}|null}} p
 * @returns {{版本:number, week:number, pendingNegatives:number, resolvedCount:number,
 *            liveNegCount:number, livePosCount:number, crisisResponse:string|null}}
 */
export function settleInputsFrom({ reviews, week, crisis = null } = {}) {
  const 流水 = Array.isArray(reviews) ? reviews : []
  const w = Number(week)
  // ① 结算卡（跨周累计）—— 欠账/整改只认它们（确定性；实证见文件头 ①）
  const 结算卡 = 流水.filter(r => /^w\d+-/.test(String(r && r.id)))
  const pendingNegatives = 结算卡.filter(r => r.status === 'pending' || r.status === 'ignored').length
  const resolvedCount = 结算卡.filter(r => r.status === 'resolved').length
  // ② 本周实时流水已产出的评价 ⇒ 结算只补差额
  const 本周实时 = 流水.filter(r => r && r.live === true && Number(r.liveWeek) === w)
  const liveNegCount = 本周实时.filter(r => Number(r.stars) <= 3).length
  const livePosCount = 本周实时.filter(r => Number(r.stars) >= 4).length
  // ③ 危机应对：上周选、本周用
  const crisisResponse = (crisis && Number(crisis.week) === w - 1 && crisis.choice) ? crisis.choice : null
  return { 版本: WEEK_INPUTS_VERSION, week: w, pendingNegatives, resolvedCount, liveNegCount, livePosCount, crisisResponse }
}

// 从存档里取【本周】的输入：版本/周号对不上 ⇒ 视为没有（返回 null，由调用方决定兜底）
export function weekInputsOf(save, week) {
  const w = save && save.weekInputs
  if (!w || typeof w !== 'object') return null
  if (Number(w.week) !== Number(week)) return null          // 存档里的是别的周 ⇒ 不敢拿来用
  if (w.版本 != null && Number(w.版本) !== WEEK_INPUTS_VERSION) return null
  return {
    pendingNegatives: 非负整数(w.pendingNegatives), resolvedCount: 非负整数(w.resolvedCount),
    liveNegCount: 非负整数(w.liveNegCount), livePosCount: 非负整数(w.livePosCount),
    crisisResponse: typeof w.crisisResponse === 'string' ? w.crisisResponse : null,
  }
}
