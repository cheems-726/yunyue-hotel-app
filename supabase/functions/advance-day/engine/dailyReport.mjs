// 日报数据（B2-2 · T3.3/T3.4）
//
// ── 来源与边界 ──────────────────────────────────────────────────
//   · 数据源 = settle() 返回的 `dailySnapshots`（Phase D/C2 已接，7 天，Σ7天 ≡ 周值）
//   · 本模块【纯函数】：不调 settle、不写盘、不碰 DOM ⇒ 对外数值零变化
//   · 持久化（D30 落定）：dailySnapshots 随周报一起存档 ⇒ 刷新后日报仍在，无需重算
//
// ── 口径提醒 ────────────────────────────────────────────────────
//   · 天数据是【周值的确定性分摊】（最大余数法），不是逐日独立模拟 —— 二期替换 splitExact 后才变
//   · checkins / checkouts 一期恒为 0（周模型未拆到天，不臆造）
//   · 天数标签用【教学日历】推（teachingDayOfMonth 的口径），不读设备时钟的 UTC 日期

export const DAY_LABELS = ['第 1 天', '第 2 天', '第 3 天', '第 4 天', '第 5 天', '第 6 天', '第 7 天']

// 周 → 7 行日报。缺 dailySnapshots（旧档/未接线）时返回空数组，由调用方显示"暂无日报"
export function buildDailyReport(weekResult) {
  const ds = weekResult && weekResult.dailySnapshots
  if (!Array.isArray(ds) || !ds.length) return []
  return ds.map((d, i) => ({
    // ⚠️ dayIndex 在【嵌套的 d.dailySnapshot】里（simulateDay 的返回形状）—— 顶层没有这个字段。
    //    原先写 `d.dayIndex || i + 1` 靠兜底恰好正确，属巧合；这里显式取嵌套值并把兜底留在后面。
    dayIndex: (d.dailySnapshot && Number(d.dailySnapshot.dayIndex)) || d.dayIndex || i + 1,
    label: DAY_LABELS[i] || `第 ${i + 1} 天`,
    revenue: d.revenue || 0,
    cost: d.cost || 0,
    cashDelta: d.cashDelta || 0,
    occupied: d.occupied || 0,
    reviews: d.reviews || 0,
  }))
}

// 日报合计（供 UI 与断言复用：必须 === 周报对应字段）
export function sumDaily(rows) {
  const acc = { revenue: 0, cost: 0, cashDelta: 0, occupied: 0, reviews: 0 }
  for (const r of rows) for (const k of Object.keys(acc)) acc[k] += r[k] || 0
  return acc
}

// 与周报字段对账：返回逐项是否一致（调用方据此决定是否显示"与周报一致"徽标）
export function reconcileWithWeek(weekResult) {
  const rows = buildDailyReport(weekResult)
  if (!rows.length || !weekResult) return { ok: false, rows: 0, diff: [] }
  const s = sumDaily(rows)
  const expect = {
    revenue: weekResult.revenue,
    cost: weekResult.totalCost,
    cashDelta: weekResult.profit,
    occupied: weekResult.occupiedRooms,
    reviews: weekResult.reviewCount,
  }
  const diff = Object.keys(expect).filter(k => Number.isFinite(expect[k]) && s[k] !== expect[k])
  return { ok: diff.length === 0, rows: rows.length, diff }
}
