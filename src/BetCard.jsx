// V131 §1-A · 押注卡（先判断后揭晓 · 本周只能押一次）
// 数据由 App 持有（state.本周押注 / 押注历史），本组件只做输入与展示。
import { useState } from 'react'
import Icon from './Icon.jsx'
import { 净利方向们, 押注有效 } from './bets.mjs'

export default function BetCard({ week = 1, 押注 = null, onSubmit, late = false }) {
  const 已押 = 押注有效(押注, week)
  const [出租率, set出租率] = useState(押注 && Number.isFinite(Number(押注.出租率)) ? Number(押注.出租率) : 65)
  const [方向, set方向] = useState(押注 && 净利方向们.includes(String(押注.净利方向)) ? String(押注.净利方向) : '')
  const 可提交 = !已押 && Number.isInteger(Number(出租率)) && Number(出租率) >= 0 && Number(出租率) <= 100 && !!方向

  if (已押) {
    return (
      <div className="card" style={{ borderColor: 'var(--good-border)', background: 'var(--good-bg)' }}>
        <div className="card-title" style={{ color: 'var(--good)', marginBottom: 4 }}><Icon name="achv.badge" size={16} /> 本周押注已锁定</div>
        <div style={{ fontSize: 16, color: 'var(--text)', lineHeight: 1.7 }}>
          出租率 <b>{押注.出租率}%</b> · 净利 <b>{押注.净利方向}</b>
          {押注.迟押 ? <span style={{ color: 'var(--warn)', marginLeft: 6 }}>（补押 · 不计分）</span> : <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>（提交后不可改）</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ borderColor: 'var(--primary-border)' }}>
      <div className="card-title" style={{ marginBottom: 4 }}><Icon name="achv.badge" size={16} /> 先押注，后揭晓{late ? '（补押 · 不计分）' : ''}</div>
      <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.7, marginBottom: 8 }}>
        第 {week} 周：先写下你的判断，再看结果。押错不扣分；<b>没押不能进入下一周</b>。
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>本周出租率</span>
        <input
          type="range" min="0" max="100" step="1"
          value={出租率}
          data-bet-range="1"
          onChange={e => set出租率(Number(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--primary)' }}
        />
        <b style={{ fontSize: 16, color: 'var(--primary)', width: 52, textAlign: 'right' }}>{出租率}%</b>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>本周净利（相对 ±50000 元）</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {净利方向们.map(d => (
          <div
            key={d}
            className={`district-card ${方向 === d ? 'selected' : ''}`}
            data-bet-dir={d}
            style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}
            onClick={() => set方向(d)}
          >
            {d}
          </div>
        ))}
      </div>
      <button className="btn btn-primary" style={{ width: '100%', opacity: 可提交 ? 1 : 0.5 }} disabled={!可提交}
        onClick={() => onSubmit && onSubmit({ week, 出租率: Number(出租率), 净利方向: 方向, 提交时刻: new Date().toISOString(), 迟押: !!late })}>
        {可提交 ? (late ? '补押（仅记录，不计分）' : '锁定本周押注（提交后不可改）') : '先给出出租率和净利方向'}
      </button>
    </div>
  )
}
