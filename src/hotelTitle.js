// 酒店称号系统（RPG成长）：按综合属性给称号，确定性计算，公平可解释
// 口径与 HotelStatus/结算引擎一致

export const TITLES = [
  { min: 85, name: '标杆酒店', icon: '👑', desc: '片区标杆，同行来取经' },
  { min: 75, name: '人气名店', icon: '🌟', desc: '一房难求，口碑相传' },
  { min: 65, name: '精品酒店', icon: '💎', desc: '品质出众，客人是回头客' },
  { min: 50, name: '舒适旅店', icon: '🛏️', desc: '安稳经营，略有起色' },
  { min: 0, name: '普通旅社', icon: '🏠', desc: '刚起步，一切待证明' },
]

export function getTitle(occ, goodRatePct, quality) {
  const composite = Math.round(
    (occ || 0) * 0.35 + (goodRatePct || 0) * 0.35 + (quality == null ? 70 : quality) * 0.3
  )
  const tier = TITLES.find(t => composite >= t.min)
  const idx = TITLES.indexOf(tier)
  const next = TITLES[idx - 1] || null
  // 距下一称号的进度（0-100）
  const progress = next
    ? Math.round(((composite - tier.min) / (next.min - tier.min)) * 100)
    : 100
  return {
    composite,
    title: tier.name,
    icon: tier.icon,
    desc: tier.desc,
    next: next ? next.name : null,
    nextAt: next ? next.min : null,
    progress,
  }
}
