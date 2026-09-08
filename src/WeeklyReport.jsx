import React, { useState, useEffect } from 'react'
import { getTitle } from './hotelTitle.js'

// 数字滚动动画（count-up，缓出曲线）
function useCountUp(target, dur = 800) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf
    const t0 = performance.now()
    const tick = (t) => {
      const p = Math.min((t - t0) / dur, 1)
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return v
}

// 数字滚动显示（负数利润从0滑向负值也自然）
function CountNum({ n, wan = false }) {
  const v = useCountUp(n)
  if (wan) return <>{(v / 10000).toFixed(1)}</>
  return <>{v.toLocaleString()}</>
}

// 危机事件限时应对卡：30秒内选方案，选择存档影响下周结算（超时=自动"不理会"，危机不应对就是最差应对）
function CrisisCard({ event, week }) {
  const CHOICES = [
    { label: '立即公开整改+补偿', effect: '下周口碑 +2%（最佳应对）' },
    { label: '逐条真诚回复', effect: '下周口碑 +1%（稳妥应对）' },
    { label: '不理会', effect: '下周口碑 -2%，可能再发酵（最差应对）' },
  ]
  const [timeLeft, setTimeLeft] = useState(30)
  const [choice, setChoice] = useState(null)
  useEffect(() => {
    if (choice) return
    if (timeLeft <= 0) { pick('不理会'); return }
    const t = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft, choice])
  function pick(label) {
    if (choice) return
    setChoice(label)
    try { localStorage.setItem('hotel-sim-crisis-response', JSON.stringify({ week, choice: label })) } catch (e) {}
  }
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 8, background: '#FFF4E0', border: '1px solid #FBE3B3' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#A96407' }}>
          {event.icon} {event.name}<span style={{ fontSize: 10, background: '#E8940F', color: '#fff', borderRadius: 5, padding: '1px 6px', marginLeft: 6 }}>危机</span>
        </div>
        {!choice && <span style={{ fontSize: 18, fontWeight: 700, color: timeLeft <= 10 ? '#EF4444' : '#A96407' }}>{timeLeft}s</span>}
      </div>
      <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, marginTop: 3 }}>{event.text}</div>
      {!choice ? (
        <div style={{ marginTop: 8 }}>
          {CHOICES.map(c => (
            <div key={c.label} onClick={() => pick(c.label)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#fff', borderRadius: 8, marginBottom: 5, cursor: 'pointer', border: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</span>
              <span style={{ fontSize: 10, color: '#A96407' }}>{c.effect}</span>
            </div>
          ))}
          <div style={{ fontSize: 10, color: '#9CA3AF' }}>⏱ {timeLeft}s 内不选将自动按"不理会"处理</div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#065F46', fontWeight: 600, marginTop: 6 }}>✅ 你的应对：{choice}——结果将在下周结算体现</div>
      )}
    </div>
  )
}

// 周报组件：展示结算结果（决策→结果→复盘）
export default function WeeklyReport({ result, onClose, history = [], brand = {} }) {
  const isProfit = result.profit >= 0
  const [copied, setCopied] = useState(false)
  // 称号变化检测：结算前 vs 结算后（晋升时刻/降级警示）
  const qualityOf = (lv) => lv.includes('经济') ? 60 : lv.includes('中高档') || lv.includes('精选') ? 85 : lv.includes('高档') ? 90 : lv.includes('奢华') ? 95 : lv.includes('中档') ? 75 : 70
  const quality = qualityOf(brand?.level || '')
  const last = history.length ? history[history.length - 1] : null
  const before = getTitle(last ? last.occupancy : 0, last ? last.finalGoodRate : 85, quality)
  const after = getTitle(result.occupancy, result.finalGoodRate, quality)
  const promoted = !last ? null : (after.composite > before.composite && after.title !== before.title)
  const demoted = !last ? null : (after.composite < before.composite && after.title !== before.title)
  // 环比：本周 vs 上周
  const delta = (cur, prev, unit = '', goodUp = true) => {
    if (prev == null) return null
    const diff = +(cur - prev).toFixed(1)
    if (diff === 0) return null
    const up = diff > 0
    const good = goodUp ? up : !up
    return { text: `${up ? '↑' : '↓'} ${Math.abs(diff)}${unit}`, color: good ? '#10B981' : '#EF4444' }
  }
  const dOcc = delta(result.occupancy, last ? last.occupancy : null, 'pt')
  const dRev = delta(+(result.revenue / 10000).toFixed(1), last ? +(last.revenue / 10000).toFixed(1) : null, '万')
  const dProfit = delta(result.profit, last ? last.profit : null, '元')
  const chip = (d) => d ? (
    <span style={{ fontSize: 10, fontWeight: 700, color: d.color, background: d.color === '#10B981' ? '#ECFDF5' : '#FEF0EF', borderRadius: 6, padding: '2px 6px', marginLeft: 6 }}>{d.text}</span>
  ) : null
  return (
    <div className="content">
      <div className="header">
        <span className="step-tag">📊 周结算</span>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>第 {result.week} 周经营结果</h1>
        <div className="sub">决策 → 结果 → 复盘</div>
      </div>

      {/* 称号变化横幅 */}
      {promoted && (
        <div className="card" style={{ background: 'linear-gradient(90deg,#ECFDF5,#FFFFFF)', border: '1px solid #A7F3D0', textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#065F46' }}>🎉 酒店晋升！{before.icon} {before.title} → {after.icon} {after.title}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{after.desc}</div>
        </div>
      )}
      {demoted && (
        <div className="card" style={{ background: '#FEF0EF', border: '1px solid #FECACA', textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B' }}>⚠ 酒店降级：{before.icon} {before.title} → {after.icon} {after.title}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>出租率/口碑下滑拖累评级，下周稳住</div>
        </div>
      )}
      {!last && (
        <div className="card" style={{ background: 'linear-gradient(90deg,#FFF4E0,#FFFFFF)', border: '1px solid #FBE3B3', textAlign: 'center', padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#A96407' }}>{after.icon} 首周评级：{after.title}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>提升出租率与口碑可晋升更高称号</div>
        </div>
      )}

      {/* 核心指标 */}
      <div className="card">
        <div className="card-title">本周经营数据</div>
        <div className="settle-grid">
          <div className="metric">
            <div className="label">出租率{chip(dOcc)}</div>
            <div className="value"><CountNum n={result.occupancy} /><span className="unit">%</span></div>
          </div>
          <div className="metric">
            <div className="label">营收{chip(dRev)}</div>
            <div className="value"><CountNum n={result.revenue} wan /><span className="unit">万</span></div>
          </div>
          <div className="metric">
            <div className="label">利润{chip(dProfit)}</div>
            <div className="value" style={{color: isProfit ? '#10B981' : '#EF4444'}}>{isProfit ? '+' : ''}<CountNum n={result.profit} /><span className="unit">元</span></div>
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
          {result.eventFine > 0 && <div style={{ color: '#DC2626' }}>🧯 事件罚款 {result.eventFine} 元（已计入成本）</div>}
          {result.overbookCompensation > 0 && <div style={{ color: '#DC2626' }}>🛏️ 超售到店无房赔偿 {result.overbookCompensation} 元</div>}
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

      {/* 本周事件（条件触发：你的经营状态招来的好事/坏事；按 危机→负面→正面 排序） */}
      {result.events && result.events.length > 0 && (
        <div className="card">
          <div className="card-title">⚡ 本周经营事件</div>
          {[...result.events].sort((a, b) => ({ crisis: 0, bad: 1, good: 2 }[a.type] ?? 3) - ({ crisis: 0, bad: 1, good: 2 }[b.type] ?? 3)).map((e, i) => (
            e.type === 'crisis'
              ? <CrisisCard key={i} event={e} week={result.week} />
              : <div key={i} style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 8, background: e.type === 'good' ? '#EAF9F0' : '#FEF0EF' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: e.type === 'good' ? '#065F46' : '#991B1B' }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{e.icon} {e.name}</span>
                  {e.impact && e.impact !== '—' && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#fff', borderRadius: 6, padding: '2px 7px', border: `1px solid ${e.type === 'good' ? '#A7F3D0' : '#FECACA'}`, color: e.impact.includes('-') ? '#DC2626' : '#10B981' }}>
                      {e.impact}
                    </span>
                  )}
                </span>
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

      {/* 分享本周成绩 */}
      <div className="card">
        <div className="card-title">📤 分享本周成绩</div>
        <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => {
          const evText = result.events && result.events.length ? `
经历事件：${result.events.map(e => e.name).join('、')}` : ''
          const text = `🏨 云悦酒店·第${result.week}周成绩单
出租率 ${result.occupancy}% | 营收 ${(result.revenue/10000).toFixed(1)}万 | 利润 ${result.profit >= 0 ? '+' : ''}${result.profit}元
好评率 ${result.finalGoodRate}% | 差评 ${result.negativeCount}条
${after.icon} 当前称号：${after.title}${evText}
——来自云悦酒店经营模拟`
          navigator.clipboard.writeText(text).then(() => setCopied(true)).catch(() => setCopied(false))
        }}>📋 一键复制成绩单（发群里）</button>
        {copied && <div style={{ fontSize: 11, color: '#16A34A', marginTop: 6 }}>✅ 已复制，去微信粘贴吧</div>}
      </div>

      {/* 复盘建议 */}
      <div className="card" style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}>
        <div className="card-title">💡 复盘建议</div>
        {(() => {
          // 下周提示生成器：按本周最弱维度给一条优先建议
          const tips = []
          if (result.profit < 0) tips.push('控制成本是第一优先——检查人力/营销花费，先止损再谈增长')
          if (result.occupancy < 55) tips.push('出租率是当前短板——考虑调价让利或加大OTA/活动投放拉客')
          if (result.negativeCount > 2) tips.push('差评积压是口碑杀手——先去口碑页把待处理清零再谈其他')
          if (result.finalGoodRate < 80) tips.push('口碑修复需要时间——卫生深清洁+真诚回复差评，坚持两周见效')
          if (tips.length === 0) tips.push('各项指标健康！下周可尝试提价或减少促销，验证利润上限')
          return (
            <div style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', marginBottom: 10, fontSize: 13, fontWeight: 700, color: '#1E40AF' }}>
              📌 下周优先：{tips[0]}
            </div>
          )
        })()}
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
