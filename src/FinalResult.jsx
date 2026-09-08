import React from 'react'

// 最终成绩：12周经营结束后，按四维评分
// 评分权重：利润40% / 口碑25% / 出租率20% / 差评处理率15%
export default function FinalResult({ history, onRestart }) {
  const TOTAL_WEEKS = 12

  // 汇总12周经营数据
  const totalProfit = history.reduce((s, h) => s + h.profit, 0)
  const avgOccupancy = history.length ? Math.round(history.reduce((s, h) => s + h.occupancy, 0) / history.length) : 0
  const avgGoodRate = history.length ? Math.round(history.reduce((s, h) => s + h.finalGoodRate, 0) / history.length) : 0
  const totalNegative = history.reduce((s, h) => s + h.negativeCount, 0)

  // 四维评分（简化：按表现打分 0-100）
  // 利润得分：累计利润越高越好
  const profitScore = totalProfit >= 50000 ? 100 : totalProfit >= 30000 ? 85 : totalProfit >= 10000 ? 70 : totalProfit >= 0 ? 55 : 40
  // 口碑得分：平均好评率
  const reputationScore = avgGoodRate >= 90 ? 95 : avgGoodRate >= 85 ? 85 : avgGoodRate >= 75 ? 70 : avgGoodRate >= 60 ? 55 : 40
  // 出租率得分
  const occupancyScore = avgOccupancy >= 75 ? 95 : avgOccupancy >= 65 ? 80 : avgOccupancy >= 55 ? 65 : avgOccupancy >= 45 ? 50 : 40
  // 差评处理率（简化：无差评满分，有差评看处理情况）
  const negativeScore = totalNegative === 0 ? 100 : totalNegative <= 5 ? 80 : totalNegative <= 10 ? 65 : 50

  // 加权总分
  const finalScore = Math.round(profitScore * 0.4 + reputationScore * 0.25 + occupancyScore * 0.2 + negativeScore * 0.15)

  // 评级
  const grade = finalScore >= 90 ? 'S · 标杆酒店' : finalScore >= 80 ? 'A · 优秀经营' : finalScore >= 70 ? 'B · 良好经营' : finalScore >= 60 ? 'C · 合格经营' : 'D · 需改进'

  const dimensions = [
    { label: '累计利润', weight: '40%', score: profitScore, value: `${(totalProfit / 10000).toFixed(2)}万` },
    { label: '平均口碑', weight: '25%', score: reputationScore, value: `${avgGoodRate}%` },
    { label: '平均出租率', weight: '20%', score: occupancyScore, value: `${avgOccupancy}%` },
    { label: '差评控制', weight: '15%', score: negativeScore, value: `${totalNegative}条差评` },
  ]

  return (
    <div className="content">
      <div className="header">
        <span className="step-tag">🏆 学期总结</span>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>12 周经营成绩</h1>
        <div className="sub">你的酒店经营成果总结</div>
      </div>

      {/* 总成绩 */}
      <div className="card" style={{ textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 56, fontWeight: 700, color: '#E8940F' }}>{finalScore}</div>
        <div style={{ fontSize: 14, color: '#A96407', fontWeight: 600, marginTop: 4 }}>{grade}</div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>满分 100 · 按四维加权评分</div>
      </div>

      {/* 四维评分 */}
      <div className="card">
        <div className="card-title">四维评分明细</div>
        {dimensions.map(d => (
          <div key={d.label} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{d.label} <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>（权重{d.weight}）</span></span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#E8940F' }}>{d.score}分 · {d.value}</span>
            </div>
            <div style={{ height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: d.score + '%', background: d.score >= 80 ? '#16A34A' : d.score >= 60 ? '#E8940F' : '#DC2626', borderRadius: 4 }}></div>
            </div>
          </div>
        ))}
      </div>

      {/* 经营总结 */}
      <div className="card" style={{ background: '#FFF4E0' }}>
        <div className="card-title">📝 经营总结</div>
        <div style={{ fontSize: 13, color: '#A96407', lineHeight: 1.7 }}>
          你完成了 12 周经营。累计利润 {totalProfit >= 0 ? '+' : ''}{(totalProfit / 10000).toFixed(2)} 万，
          平均出租率 {avgOccupancy}%，平均好评率 {avgGoodRate}%。
          {finalScore >= 80 && ' 经营出色，展现了优秀的酒店管理能力！'}
          {finalScore >= 60 && finalScore < 80 && ' 经营稳健，还有提升空间，注意成本和口碑的平衡。'}
          {finalScore < 60 && ' 经营遇到挑战，建议复盘每周期决策，关注利润和差评处理。'}
        </div>
      </div>

      <div style={{ padding: '8px 20px 24px' }}>
        <button className="btn-confirm" onClick={onRestart}>重新开始经营</button>
      </div>
    </div>
  )
}
