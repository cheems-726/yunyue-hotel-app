import React from 'react'

// 酒店状态面板：RPG 属性面板，展示酒店的核心经营属性
// 属性：口碑分、好评率、满意度、出租率、品质分、利润
export default function HotelStatus({ report, brand, property, week, history }) {
  // 从结算结果和品牌推导当前属性
  const occupancy = report ? report.occupancy : (history.length ? history[history.length - 1].occupancy : 0)
  const goodRate = report ? report.finalGoodRate : (history.length ? history[history.length - 1].finalGoodRate : 85)
  const reputationScore = (goodRate / 20).toFixed(1) // 好评率 → 5分制
  const profit = history.reduce((s, h) => s + h.profit, 0)

  // 满意度（简化：由好评率推导）
  const satisfaction = Math.min(100, Math.round(goodRate * 1.1))

  // 品质分（由品牌档次推导）
  const brandLevel = brand?.level || ''
  const quality = brandLevel.includes('经济') ? 60 : brandLevel.includes('中档') ? 75 : brandLevel.includes('高档') ? 90 : brandLevel.includes('奢华') ? 95 : 70

  const attrs = [
    { icon: '⭐', label: '口碑分', value: reputationScore, max: 5, display: reputationScore + ' / 5' },
    { icon: '💯', label: '好评率', value: goodRate, max: 100, display: goodRate + '%' },
    { icon: '😊', label: '满意度', value: satisfaction, max: 100, display: satisfaction + '%' },
    { icon: '🏠', label: '出租率', value: occupancy, max: 100, display: occupancy + '%' },
    { icon: '💎', label: '品质分', value: quality, max: 100, display: quality + '' },
  ]

  function barColor(v) {
    if (v >= 80) return '#16A34A'
    if (v >= 60) return '#E8940F'
    return '#DC2626'
  }

  return (
    <div className="card" style={{ background: '#FFF9F0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>
          <span style={{ fontSize: 18 }}>🏨</span> 酒店状态
        </div>
        <span style={{ fontSize: 11, color: '#A96407', fontWeight: 600 }}>
          累计利润 {profit >= 0 ? '+' : ''}{(profit / 10000).toFixed(2)}万
        </span>
      </div>

      {attrs.map(a => (
        <div key={a.label} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: '#6B7280' }}>{a.icon} {a.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: barColor(a.value / a.max * 100) }}>{a.display}</span>
          </div>
          <div style={{ height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: (a.value / a.max * 100) + '%', background: barColor(a.value / a.max * 100), borderRadius: 3, transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)' }}></div>
          </div>
        </div>
      ))}

      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 8, textAlign: 'center' }}>
        {brand?.name} · {property?.name} · 第 {week} 周
      </div>
    </div>
  )
}
