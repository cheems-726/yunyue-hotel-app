// V149 §2 · 差评处理率单源（页面与测试共用）
//   口径：已解决 ÷（待处理 + 已解决 + 忽略）；无差评周回退 history 的 handleStats（无则 null ⇒ 显示「—」）
import { avgHandleRateOf } from './metricDefs.mjs'

export function 差评处理率(reviews, history) {
  const list = Array.isArray(reviews) ? reviews : []
  const pending = list.filter(r => r.status === 'pending').length
  const resolved = list.filter(r => r.status === 'resolved').length
  const ignored = list.filter(r => r.status === 'ignored').length
  const total = pending + resolved + ignored
  if (total === 0) {
    const 历史 = avgHandleRateOf(history)
    return { rate: 历史 == null ? null : Math.round(历史 * 100), pending, resolved, ignored, noReviews: true }
  }
  return { rate: Math.round((resolved / total) * 100), pending, resolved, ignored, noReviews: false }
}
