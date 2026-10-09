import { wan2 } from './metricDefs.mjs'
// ★ V95（2026-10-09 · 用户点名）· 「开业后投资回报」纯计算层（无 UI · 无副作用 ⇒ node 可测）
//
// ── 单源纪律（三条，界面与测试都必须遵守）──────────────
//   ① 投资总额：**只从 `onePageLedger()` 取**（`quote.lines 总投资（估算）`）—— 本文件不另算造价
//   ② 累计利润：**只从同一份 `history` 累加**（与 `BreakEvenChart` 同源）
//   ③ 回本判据：与 `BreakEvenChart` **同款**（累计序列里：之前为负、之后转正 ⇒ 算回本）
//
// ── 缺数据不许出数字（§「不编」纪律）──────────────────
//   总投资 == null（品牌费率/造价待补）⇒ 一律返回 `待补: true` + 文案，**不出任何数值**
//   （否则 null 当 0 会算出「0 投资 ⇒ 无限 ROI」这类荒谬展示）

export const 缺数据文案 = '待补（缺来源数据）'

/** 累计利润序列（与 BreakEvenChart 同款：逐周累加） */
export function 累计序列(history) {
  let acc = 0
  return (history || []).map(h => (acc += (h && Number.isFinite(h.profit) ? h.profit : 0)))
}

/** 回本点索引（与 BreakEvenChart 同款判据：之前为负、之后转正才算回本） */
export function 回本索引(cum) {
  const i = cum.findIndex(v => v >= 0)
  return i > 0 ? i : -1
}

/**
 * 开业后投资回报（纯函数）
 * @param ledger  onePageLedger() 结果（可为 null）
 * @param history 周报历史（与 BreakEvenChart 同一份）
 */
export function 投资回报({ ledger, history }) {
  const cum = 累计序列(history)
  const 累计利润 = cum.length ? cum[cum.length - 1] : null
  const 周数 = cum.length
  const beIdx = 回本索引(cum)
  const 总投资 = (ledger && Number.isFinite(ledger.总投资)) ? ledger.总投资 : null
  const 外推回本年 = (ledger && Number.isFinite(ledger.回本年)) ? ledger.回本年 : null

  // ★ 缺数据分支：不出任何数字
  if (总投资 == null || 总投资 <= 0) {
    return { 待补: true, 原因: 缺数据文案, 周数, 累计利润, 总投资: null, 已回收: null, 进度: null,
      roi: null, 外推回本年, 实际回本: null, 状态: 缺数据文案, 还需周数: null, beIdx }
  }

  const 已回收 = 累计利润 == null ? null : Math.max(0, 累计利润)
  const 进度 = 累计利润 == null ? null : Math.max(0, Math.min(1, 累计利润 / 总投资))
  const roi = 累计利润 == null ? null : 累计利润 / 总投资
  // 实际推进推算：按「已回收 ÷ 周数」的速率外推剩余周（**仅当已回收 > 0**，否则不适用）
  const 周均回收 = (已回收 != null && 周数 > 0) ? 已回收 / 周数 : null
  const 还需周数 = (周均回收 && 周均回收 > 0 && 总投资 > 已回收) ? Math.ceil((总投资 - 已回收) / 周均回收) : (总投资 <= (已回收 || 0) ? 0 : null)
  const 实际回本 = 总投资 <= (已回收 || 0) ? 周数 : null
  const 状态 = 总投资 <= (已回收 || 0)
    ? `已回本（第 ${实际回本} 周内 · 累计回收 ${Math.round(已回收)} 元）`
    : (还需周数 == null ? '未回本（尚无正向回收，无法推算）' : `未回本（按当前速率约还需 ${还需周数} 周）`)

  return { 待补: false, 周数, 累计利润, 总投资, 已回收, 进度, roi, 外推回本年, 实际回本, 状态, 还需周数, beIdx }
}

/** 百分比文案（界面与测试共用，避免各自 toFixed） */
export const 百分比 = (v) => (Number.isFinite(v) ? (v * 100).toFixed(1) + '%' : 缺数据文案)
// ★ 金额→万 的展示换算【走单源】`metricDefs.wan2()`（stale-scale R6：不许自写【金额除以一万】的换算 —— 白名单只给 metricDefs 的工具函数本身）
export const 万元 = (v) => (Number.isFinite(v) ? wan2(v, { 待补: 缺数据文案 }) : 缺数据文案)
