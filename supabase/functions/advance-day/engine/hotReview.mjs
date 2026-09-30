// §32-U1 · R2 差评「上热门」三级惩罚 —— 引擎纯核心（确定性 · 无随机位置偏移）
//
// ── 出处 ────────────────────────────────────────────────────────
//   路线图 R2 · 需求「差评上热门」教学冲突点 · 审计 D83（grep 上热门=0，只有发酵预警文案）
//
// ── 设计（三级 · 与现有「差评发酵」危机衔接而非另起炉灶）────────────
//   L1 普通：口碑页内嵌卡片（既有 · pending 1 条时的黄条预警）
//   L2 严重：顶部黄条（发酵危机 —— 既有 reviewFerment：欠≥2 + 概率触发 · 口碑−3%）
//   L3 ★ 上热门（本模块新增）：**欠 ≥3 条未处理 ⇒ 必触发（不是概率）**——
//       即时：声誉属性 ×0.5；持续：进入「舆情危机期」2–3 周（出租率 −30% · 差评概率 ×2）
//
// ── 公平性红线（全班同周同结果）──────────────────────────────────
//   ★ 全确定性：触发只看 pendingNegatives（结算入参 · 与随机流无关）；
//     危机周数 = 2 + (week % 2)（按周号确定 · 同周全班相同）；不消耗 rand()（不改随机位置）。
//   ★ 声誉 ×0.5 落在 attrsAfter.reputation（写回属性池 ⇒ 自然进下周 · 即"即时+持续"同体）
//   ★ 出租率 −30% 与差评概率 ×2 由 settle 在「危机周数窗口内」逐周施加（见 settlement.js 接线）
//
// ── 老师裁量（R3 缓刑 · teacher_override）───────────────────────
//   `hotReviewCrisis` 状态随存档走：{ startWeek, weeks, source, override }
//   override: null（默认 = 系统照罚）/ '维持处罚' / '降级为期末扣分'（当场解除持续期 · 期末扣分留痕）

export const HOT_REVIEW_CONFIG = {
  triggerPending: 3,        // 欠 ≥3 条未处理 ⇒ 必触发（不是概率 —— 概率那条是 L2 发酵）
  reputationCut: 0.5,       // 即时：声誉 ×0.5
  occPenalty: 0.30,         // 持续：危机期内 出租率 −30%（相对值）
  badReviewMul: 2,          // 持续：危机期内 差评概率 ×2
  weeksBase: 2,             // 危机期 = 2 + (week % 2) 周（2–3 周 · 按周号确定）
}

// 判定：本周是否触发 L3 上热门（纯函数 · settle 入参即全部依据）
export function shouldHotReview({ pendingNegatives }) {
  return (Number(pendingNegatives) || 0) >= HOT_REVIEW_CONFIG.triggerPending
}

// 危机期周数（确定性：同周同值 ⇒ 全班同结果）
export function hotCrisisWeeks(week) {
  return HOT_REVIEW_CONFIG.weeksBase + ((Number(week) || 1) % 2)
}

// 危机期是否仍在生效（含 R3 裁量：override=降级 ⇒ 当周解除；null/维持 ⇒ 照罚）
// ★ 兼容两种入参形状：settle 传的是存档字段名 { hotReviewCrisis: {...} }，测试/纯调用可直接传危机对象
export function hotCrisisActive(state, week) {
  const c = state && (state.hotReviewCrisis || state)
  if (!c || !Number.isFinite(c.startWeek) || !Number.isFinite(c.weeks)) return false
  if (c.override === '降级为期末扣分') return false   // R3：老师降级 ⇒ 当场解除
  return week >= c.startWeek && week < c.startWeek + c.weeks
}

// 触发即时效果：声誉 ×0.5（作用于属性池 · 返回新 reputation；不整除取整防漂移）
export function applyHotReviewImmediate(attrs) {
  const rep = Number(attrs && attrs.reputation)
  if (!Number.isFinite(rep)) return attrs
  return { ...attrs, reputation: Math.max(5, Math.round(rep * HOT_REVIEW_CONFIG.reputationCut)) }
}

// 持续效果（危机期内逐周）：出租率惩罚系数与差评概率倍数（override 处理在 hotCrisisActive）
export function hotCrisisPenalties(state, week) {
  if (!hotCrisisActive(state, week)) return { occMul: 1, badMul: 1 }
  return { occMul: 1 - HOT_REVIEW_CONFIG.occPenalty, badMul: HOT_REVIEW_CONFIG.badReviewMul }
}
