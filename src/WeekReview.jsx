// V131 §1-D · 周报三问复盘（每题 ≥20 字 · 提交后只读）
// 三问都达标才能进入下一周；只记录/讲评，不计入四维评分。
import { useState } from 'react'
import { 复盘三问, 每题最短, 每题最长, 复盘合格 } from './weekReview.mjs'

export default function WeekReview({ week = 1, 记录 = null, on提交 }) {
  const 已交 = !!(记录 && 复盘合格(记录.三问))
  const [文本, set文本] = useState(() => (记录 && Array.isArray(记录.三问) ? [0, 1, 2].map(i => String(记录.三问[i] || '')) : ['', '', '']))
  const [错, set错] = useState('')
  const 可交 = 复盘合格(文本)

  if (已交) {
    return (
      <div className="card" style={{ borderColor: 'var(--good-border)', background: 'var(--good-bg)' }}>
        <div className="card-title" style={{ color: 'var(--good)', marginBottom: 4 }}>第 {week} 周三问复盘（已提交）</div>
        {复盘三问.map((q, i) => (
          <div key={i} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.8, marginTop: 4 }}>
            <b style={{ color: 'var(--text-sub)' }}>{i + 1}. {q}</b>
            <div>{记录.三问[i]}</div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="card" style={{ borderColor: 'var(--warn-border)' }}>
      <div className="card-title" style={{ marginBottom: 4 }}>第 {week} 周三问复盘（三问都 ≥{每题最短} 字才能进入下一周）</div>
      {复盘三问.map((q, i) => (
        <div key={i} style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 3 }}>{i + 1}. {q}</div>
          <textarea
            value={文本[i]}
            data-review-q={i}
            onChange={e => { const t = [...文本]; t[i] = e.target.value; set文本(t); set错('') }}
            rows={2}
            maxLength={每题最长}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }}
          />
          <div style={{ fontSize: 12, color: String(文本[i]).trim().length >= 每题最短 ? 'var(--good)' : 'var(--text-muted)', textAlign: 'right' }}>
            {String(文本[i]).trim().length}/{每题最短}
          </div>
        </div>
      ))}
      {错 && <div style={{ fontSize: 12, color: 'var(--bad)', marginTop: 4 }}>{错}</div>}
      <button className="btn btn-primary" style={{ width: '100%', marginTop: 10, opacity: 可交 ? 1 : 0.5 }} disabled={!可交}
        onClick={() => { const r = on提交 && on提交(文本.map(t => String(t).trim())); if (r === false) set错('三问都要写够 20 字') }}>
        {可交 ? '提交复盘' : '三问都要写够 20 字'}
      </button>
    </div>
  )
}
