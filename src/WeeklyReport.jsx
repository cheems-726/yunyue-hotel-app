import React from 'react'

// 周报组件：展示结算结果（决策→结果→复盘）
export default function WeeklyReport({ result, onClose }) {
  const isProfit = result.profit >= 0
  return (
    <div className="content">
      <div className="header">
        <span className="step-tag">📊 周结算</span>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>第 {result.week} 周经营结果</h1>
        <div className="sub">决策 → 结果 → 复盘</div>
      </div>

      {/* 核心指标 */}
      <div className="card">
        <div className="card-title">本周经营数据</div>
        <div className="settle-grid">
          <div className="metric">
            <div className="label">出租率</div>
            <div className="value">{result.occupancy}<span className="unit">%</span></div>
          </div>
          <div className="metric">
            <div className="label">营收</div>
            <div className="value">{(result.revenue/10000).toFixed(1)}<span className="unit">万</span></div>
          </div>
          <div className="metric">
            <div className="label">利润</div>
            <div className="value" style={{color: isProfit ? '#10B981' : '#EF4444'}}>{isProfit ? '+' : ''}{result.profit}<span className="unit">元</span></div>
          </div>
        </div>
      </div>

      {/* 经营明细 */}
      <div className="card">
        <div className="card-title">经营明细</div>
        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.8 }}>
          <div>🏨 房量 {result.rooms} 间 · 入住 {result.occupiedRooms} 间</div>
          <div>💵 平均房价 {result.price} 元/间</div>
          <div>💰 成本 {result.totalCost} 元</div>
          <div>⭐ 好评率 {result.goodRate}% → {result.finalGoodRate}%</div>
          <div>💬 本周 {result.reviewCount} 条评价，{result.negativeCount} 条差评</div>
        </div>
      </div>

      {/* 市场波动可视化 */}
      <div className="card">
        <div className="card-title">🌊 市场波动</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
          本周市场客源强度系数：<b style={{ color: '#111827' }}>{result.demandStrength}</b>
        </div>
        {/* 波动条：0.5-1.5 区间 */}
        <div style={{ position: 'relative', height: 8, background: 'linear-gradient(to right, #DC2626, #FBBF77, #16A34A)', borderRadius: 4, marginBottom: 6 }}>
          <div style={{ position: 'absolute', left: ((result.demandStrength - 0.5) / 1.0 * 100) + '%', top: '-4px', width: 16, height: 16, background: '#fff', border: '3px solid #E8940F', borderRadius: '50%', transform: 'translateX(-50%)' }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9CA3AF' }}>
          <span>市场冷清</span>
          <span>正常</span>
          <span>市场火爆</span>
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8, lineHeight: 1.6 }}>
          💡 市场波动是随机的（全班同一周相同），这是"市场不确定性"。你的决策决定的是如何应对市场。
        </div>
      </div>

      {/* 本周事件（条件触发：你的经营状态招来的好事/坏事） */}
      {result.events && result.events.length > 0 && (
        <div className="card">
          <div className="card-title">⚡ 本周经营事件</div>
          {result.events.map((e, i) => (
            <div key={i} style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 8, background: e.type === 'good' ? '#EAF9F0' : e.type === 'crisis' ? '#FFF4E0' : '#FEF0EF', border: e.type === 'crisis' ? '1px solid #FBE3B3' : 'none' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: e.type === 'good' ? '#065F46' : e.type === 'crisis' ? '#A96407' : '#991B1B' }}>
                {e.icon} {e.name}{e.type === 'crisis' && <span style={{ fontSize: 10, background: '#E8940F', color: '#fff', borderRadius: 5, padding: '1px 6px', marginLeft: 6 }}>危机</span>}
              </div>
              <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, marginTop: 3 }}>{e.text}</div>
              <div style={{ fontSize: 11, color: '#A96407', marginTop: 3 }}>💡 {e.tip}</div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.6 }}>
            💡 事件不是纯随机：是你把某个属性推到极端（如高出租率+少人手）才会触发。经营的平衡点由你把握。
          </div>
        </div>
      )}

      {/* 决策复盘 */}
      {result.insights && result.insights.length > 0 && (
        <div className="card">
          <div className="card-title">🔍 决策复盘</div>
          {result.insights.map((ins, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: i < result.insights.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{ins.good ? '✅' : '⚠️'}</span>
              <span style={{ fontSize: 13, color: ins.good ? '#065F46' : '#991B1B', lineHeight: 1.6 }}>{ins.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* 复盘建议 */}
      <div className="card" style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}>
        <div className="card-title">💡 复盘建议</div>
        <div style={{ fontSize: 13, color: '#1E40AF', lineHeight: 1.7 }}>
          {result.occupancy < 55 && '⚠ 出租率偏低，考虑降价促销或提升口碑拉客流。'}
          {result.occupancy >= 55 && result.occupancy < 75 && '✅ 出租率适中，可优化房价策略提升 RevPAR。'}
          {result.occupancy >= 75 && '🎉 出租率较高，注意满负荷服务质量和差评风险。'}
          {!isProfit && ' ⚠ 本周亏损，重点检查成本（人力/营销）是否过高。'}
          {result.negativeCount > 0 && ' 💬 有差评待处理，及时回复可减半负面影响。'}
        </div>
      </div>

      <div style={{ padding: '8px 20px 24px' }}>
        <button className="btn-confirm" onClick={onClose}>
          {result.week >= 12 ? '🏁 查看 12 周最终成绩 →' : `进入第 ${result.week + 1} 周，重新决策 →`}
        </button>
      </div>
    </div>
  )
}
