import React from 'react'

import { strategyOf } from './TeacherDashboard.jsx'
import { EVENT_INFO } from './settlement.js'
import { getTitle } from './hotelTitle.js'

// 最终成绩：12周经营结束后，按四维评分
// 评分权重：利润40% / 口碑25% / 出租率20% / 差评处理率15%
export default function FinalResult({ history, onRestart, user }) {
  const [copied, setCopied] = React.useState(false)
  // 品质分按品牌档次推导（与其他页面同口径）
  const lv = brand?.level || ''
  const quality = lv.includes('经济') ? 60 : lv.includes('中高档') || lv.includes('精选') ? 85 : lv.includes('高档') ? 90 : lv.includes('奢华') ? 95 : lv.includes('中档') ? 75 : 70
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

      {/* 学期回顾：策略画像 + 称号轨迹 */}
      {(() => {
        const st = strategyOf(history)
        let prevTitle = null
        const nodes = []
        history.forEach(h => {
          const t2 = getTitle(h.occupancy, h.finalGoodRate, quality).title
          if (t2 !== prevTitle) { nodes.push(`第${h.week}周 ${t2}`); prevTitle = t2 }
        })
        return (
          <div className="card">
            <div className="card-title">🎓 学期画像回顾</div>
            {st && (
              <div style={{ fontSize: 13, fontWeight: 700, color: st.color, marginBottom: 6 }}>
                {st.icon} 本学期策略风格：{st.tag}
              </div>
            )}
            {nodes.length > 0 && (
              <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.7 }}>
                📜 称号轨迹：{nodes.join(' → ')}
              </div>
            )}
            <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 6 }}>
              策略风格由 12 周的决策快照自动归纳；轨迹仅在称号变化处记录节点
            </div>
            {(() => {
              // 事件类型分布：12周触发过的事件按次数排序
              const counts = {}
              history.forEach(h => (h.events || []).forEach(e => { counts[e.icon + e.name] = (counts[e.icon + e.name] || 0) + 1 }))
              const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
              if (!top.length) return null
              return (
                <div style={{ fontSize: 11, color: '#374151', marginTop: 8, paddingTop: 8, borderTop: '1px dashed #F3F4F6', lineHeight: 1.8 }}>
                  ⚡ 12周共触发事件 <b>{history.reduce((a, h) => a + (h.events || []).length, 0)}</b> 次，最常见：
                  {top.map(([key, n]) => {
                    // title 联动 EVENT_INFO：hover 显示触发条件与教学提示
                    const info = EVENT_INFO.find(e => e.icon + e.name === key)
                    return <span key={key} title={info ? `触发条件：${info.trigger}` : undefined} style={{ background: '#F9FAFB', borderRadius: 5, padding: '1px 6px', marginRight: 4, cursor: 'help' }}>{key}×{n}</span>
                  })}
                </div>
              )
            })()}
            {(() => {
              // 最值得复盘的一周：经营表现（出租率/好评率各半）周间波动最大的一周
              if (history.length < 2) return null
              const perf = history.map(h => h.occupancy * 0.5 + h.finalGoodRate * 0.5)
              let worst = 1, swing = 0
              for (let i = 1; i < perf.length; i++) {
                const d = Math.abs(perf[i] - perf[i - 1])
                if (d > swing) { swing = d; worst = i }
              }
              if (swing < 8) return null // 波动太小不值得点名
              const up = perf[worst] > perf[worst - 1]
              return (
                <div style={{ fontSize: 11, color: '#A96407', background: '#FFF4E0', borderRadius: 8, padding: '6px 10px', marginTop: 8, lineHeight: 1.6 }}>
                  📌 最值得复盘：第 {history[worst].week} 周（综合表现较前一周{up ? '飙升' : '下滑'} {Math.round(swing)} 分）——去「我的」页经营操作记录看看那周做了什么决策
                  {(() => {
                    // 联动事件摘要：展示该周的主要事件（复盘有具体抓手）
                    const evs = (history[worst].events || [])
                    if (!evs.length) return null
                    return (
                      <div style={{ fontSize: 10, color: '#991B1B', marginTop: 4 }}>
                        ⚡ 该周事件：{evs.map(e => `${e.icon}${e.name}`).join('、')}
                      </div>
                    )
                  })()}
                </div>
              )
            })()}
            <button className="btn btn-primary" style={{ marginTop: 10, width: '100%', fontSize: 12 }}
              onClick={() => {
                const grade = document.querySelector('.card div[style*="color: rgb(232, 148, 15)"]')
                const score = history.length >= 1
                const txt = [
                  '🏨 云悦酒店 · 12周经营成绩单',
                  `${user?.className ? user.className + ' · ' : ''}${user?.groupNo ? '第' + user.groupNo + '组 · ' : ''}${user?.name || ''}（学号 ${user?.id || '—'}）`,
                  `策略风格：${st ? st.icon + ' ' + st.tag : '—'}`,
                  `称号轨迹：${nodes.join(' → ') || '—'}`,
                  `累计利润：${(totalProfit / 10000).toFixed(2)}万 · 平均出租率 ${avgOccupancy}% · 平均好评率 ${avgGoodRate}%`,
                  '—— 云悦酒店经营模拟',
                ].join('\n')
                navigator.clipboard.writeText(txt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})
              }}
            >{copied ? '✅ 已复制，去群里粘贴吧' : '📋 一键复制成绩单（发群里）'}</button>
          </div>
        )
      })()}

      {/* 事件应对复盘：危机事件 + 当时应对 + 结果 */}
      {(() => {
        const crises = []
        history.forEach((h, i) => {
          (h.events || []).forEach(e => {
            if (e.type === 'crisis') {
              // 应对结果：下一周 insights 里的危机应对评语
              const nextIns = history[i + 1] ? (history[i + 1].insights || []).find(x => x.text.includes('危机')) : null
              crises.push({ week: h.week, icon: e.icon, name: e.name, response: h.crisisChoice || null, result: nextIns ? nextIns.text : null })
            }
          })
        })
        if (!crises.length) {
          return (
            <div className="card" style={{ background: '#EAF9F0' }}>
              <div className="card-title">🚨 事件应对复盘</div>
              <div style={{ fontSize: 12, color: '#065F46', textAlign: 'center', padding: '10px 0' }}>
                ✅ 12 周零危机——差评没攒过线、资金没见底，风险控制本身就是实力
              </div>
            </div>
          )
        }
        return (
          <div className="card">
            <div className="card-title">🚨 事件应对复盘（{crises.length} 次危机）</div>
            {crises.map((c, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: i < crises.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#991B1B' }}>
                  第{c.week}周 {c.icon} {c.name}
                  {c.response && <span style={{ fontSize: 10, fontWeight: 600, color: '#1E40AF', background: '#EFF6FF', borderRadius: 5, padding: '1px 6px', marginLeft: 6 }}>应对：{c.response}</span>}
                </div>
                {c.result && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3, lineHeight: 1.6 }}>结果：{c.result}</div>}
                {!c.response && <div style={{ fontSize: 10, color: '#DC2626', marginTop: 3 }}>当时未选择应对方案（按最差情况处理）</div>}
              </div>
            ))}
            <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 6 }}>
              💡 危机不可怕，可怕的是没有预案。对照每次应对与结果，下次遇到就知道怎么选。
            </div>
          </div>
        )
      })()}

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
        <button className="btn-confirm" onClick={() => {
          if (window.confirm('确定重新开始 12 周经营吗？\n当前成绩将清空，云端存档也会被新进度覆盖，此操作不可恢复！')) {
            onRestart()
          }
        }}>重新开始经营</button>
      </div>
    </div>
  )
}
