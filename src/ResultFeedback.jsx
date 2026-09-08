import React from 'react'

// 通用结果反馈卡片：展示"你的选择会带来什么结果"
export default function ResultFeedback({ result, onClose }) {
  // result: { title, changes: [{label, value, dir}], note }
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.4)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 32px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 20, padding: 24, width: '100%',
          animation: 'pageIn 0.2s ease-out', maxHeight: '80vh', overflowY: 'auto',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 40 }}>📊</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>你的选择会带来</div>
        </div>

        <div style={{ fontSize: 14, fontWeight: 600, color: '#A96407', marginBottom: 12 }}>{result.title}</div>

        {/* 结果变化列表（数值飘字动画） */}
        <div style={{ marginBottom: 16 }}>
          {result.changes.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#F9FAFB', borderRadius: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: '#374151' }}>{c.label}</span>
              <span style={{ position: 'relative', fontSize: 13, fontWeight: 700, color: c.dir === 'up' ? '#10B981' : (c.dir === 'down' ? '#EF4444' : '#A96407') }}>
                {(c.dir === 'up' || c.dir === 'down') && (
                  <span
                    className="float-num"
                    style={{ '--delay': (0.3 + i * 0.25) + 's', position: 'absolute', right: 0, top: -18, fontSize: 15, pointerEvents: 'none', whiteSpace: 'nowrap' }}
                  >
                    {c.dir === 'up' ? '↑↑' : '↓↓'}
                  </span>
                )}
                {c.dir === 'up' ? '↑' : c.dir === 'down' ? '↓' : ''} {c.value}
              </span>
            </div>
          ))}
        </div>

        {/* 说明 */}
        <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, background: '#EFF6FF', borderRadius: 10, padding: 12, marginBottom: 16 }}>
          💡 {result.note}
        </div>

        <button className="btn-confirm" style={{ width: '100%' }} onClick={onClose}>
          明白了
        </button>
      </div>
    </div>
  )
}
