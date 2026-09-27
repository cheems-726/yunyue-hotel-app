// 日引擎 · simulateDay（纯函数）—— 第一期 D1
//
// ── 用途 ────────────────────────────────────────────────────────
// 把"一周的经营"拆成"7 天的经营"，为第二期（实时决策 / 唯一账本 / 自动周报）打地基。
// 第一期的目标只有一个：**证明"天"靠得住**——同输入同输出、Σ7天 ≡ 周汇总、乱序补算一致。
//
// ── 输入 ────────────────────────────────────────────────────────
//   dayIndex    1..7（本周第几天）
//   decisions   当天生效的决策（第一期：由调用方传同一份周决策，7 天相同）
//   state       经营状态快照（第一期只读，不修改）
//   seed        随机种子（周级别；内部用 guestsRng 独立流，**绝不碰全局 Math.random**）
//   weekTotals  周汇总值 { revenue, cost, checkins, checkouts, occupied, reviews, cashDelta }
//               —— 第一期由 settlement 传入（先算周、再拆天）
//
// ── 输出 ────────────────────────────────────────────────────────
//   { revenue, cost, checkins, checkouts, occupied, reviews, cashDelta,
//     dailySnapshot, triggeredEvents }
//   dailySnapshot 为当天明细（供周报"本周变更记录"与后续按天落库使用）
//
// ── 硬约束 ──────────────────────────────────────────────────────
//   1. 纯函数：只读入参，不写任何存储、不碰 DOM / localStorage
//   2. 确定性：同输入 → 同输出（推荐用 guestsRng(seed) 系独立流）
//   3. 不 import settlement 的 rand；不依赖调用顺序（乱序计算同一天结果相同）
//   4. 【一期天数据不持久化】—— 调用方算完即弃，不写进存档格式（用户 2026-09-22 约束②）
//
// ── 阶段标记（重要）─────────────────────────────────────────────
//   🔶 本文件当前的"按权重拆分周值"是【临时实现·二期替换】。
//      第二期决策变为实时（次日生效）后，simulateDay 改为**按当天自己的输入直接计算**，
//      而本文件的函数签名与返回结构保持不变（契约不变，只换内部实现）。
//      因此二期替换时：删除 splitExact 与 weekTotals 分支即可，其余不动。

import { guestsRng } from './guests.js'

export const DAYS_PER_WEEK = 7

// 周级别的 7 天权重（确定性）：同一 seed 永远得到同一组权重，和为 1 之外的常数由 splitExact 归一
export function dayWeights(seed = 1) {
  const rnd = guestsRng(((Number(seed) || 1) ^ 0x9E3779B9) >>> 0)
  const w = []
  for (let i = 0; i < DAYS_PER_WEEK; i++) w.push(0.75 + rnd() * 0.5)   // 0.75~1.25 → 有波动但不极端
  return w
}

// 精确整数分摊：Σ 结果 === total（最大余数法，按索引稳定打破平局）
// 🔶【临时实现·二期替换】
export function splitExact(total, weights) {
  const t = Math.round(Number(total) || 0)
  const sumW = weights.reduce((a, b) => a + b, 0) || 1
  const raw = weights.map(w => (t * w) / sumW)
  const out = raw.map(v => Math.floor(v))
  let rest = t - out.reduce((a, b) => a + b, 0)
  const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => (b[0] - a[0]) || (a[1] - b[1]))
  for (let k = 0; k < rest; k++) out[order[k % order.length][1]] += 1
  return out
}

const NUM_KEYS = ['revenue', 'cost', 'checkins', 'checkouts', 'occupied', 'reviews', 'cashDelta']

export function simulateDay({ dayIndex = 1, decisions = {}, state = {}, seed = 1, weekTotals = null } = {}) {
  const d = Math.min(DAYS_PER_WEEK, Math.max(1, Math.round(Number(dayIndex) || 1)))
  const idx = d - 1
  const weights = dayWeights(seed)

  // 🔶 临时实现：把周汇总按权重拆到天（Σ 天 ≡ 周，逐项精确相等）
  const totals = {}
  for (const k of NUM_KEYS) totals[k] = Math.round(Number(weekTotals?.[k]) || 0)
  const slices = {}
  for (const k of NUM_KEYS) slices[k] = splitExact(totals[k], weights)[idx]

  const dailySnapshot = {
    dayIndex: d,
    revenue: slices.revenue,
    cost: slices.cost,
    checkins: slices.checkins,
    checkouts: slices.checkouts,
    occupied: slices.occupied,
    reviews: slices.reviews,
    cashDelta: slices.cashDelta,
    price: Number(state?.price) || null,   // 仅供展示；一期不参与计算
  }

  return {
    ...slices,
    dailySnapshot,
    triggeredEvents: [],   // 一期：事件仍按周触发，日粒度事件留给第三期（老师注入 / 状态触发按天）
  }
}

// 便捷：一次算完整周（1..7），供结算内部与测试使用
// 🔶【临时实现·二期替换】——二期改成"逐日独立计算"后，本函数仍然只是循环调用 simulateDay
export function simulateWeek({ decisions = {}, state = {}, seed = 1, weekTotals = null } = {}) {
  const days = []
  for (let d = 1; d <= DAYS_PER_WEEK; d++) days.push(simulateDay({ dayIndex: d, decisions, state, seed, weekTotals }))
  return days
}
