// V152 §3 · 价格弹性猜数（native 壳 · 出题/判分走 priceElastic.mjs 纯函数；只写 游戏记录）
import React from 'react'
import { 出题, 判分, 游戏ID } from './priceElastic.mjs'

export default function PriceElastic({ onBack, onRecord, 上周出租率 = null }) {
  const [轮, set轮] = React.useState(1)
  const [题, set题] = React.useState(() => 出题({ seed: 1, 出租率: 上周出租率 }))
  const [选, set选] = React.useState(null)   // null = 未答；0–2 = 已选
  const 已答 = 选 != null
  const 结 = 已答 ? 判分(题, 选) : null

  const 答一格 = (i) => {
    if (已答) return
    set选(i)
    onRecord && onRecord(游戏ID)   // 玩一题记一次（RV：删掉这行 ⇒ 记录判据红）
  }
  const 下一题 = () => {
    const n = 轮 + 1
    set轮(n)
    set选(null)
    set题(出题({ seed: n, 出租率: 上周出租率 }))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 90, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--fill)' }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', fontSize: 16, minWidth: 44, minHeight: 44, fontFamily: 'inherit', color: 'var(--text)' }}>‹ 返回</button>
        <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>价格弹性猜数 · 交决策前的 2 分钟热身</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>第 {轮} 题</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px' }}>
        <div className="card" data-elastic-q>
          <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.7 }}>{题.题干}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>上周出租率 {题.上周出租率}% · 教学模型，猜完看本周口径的解释</div>
        </div>
        {题.选项.map((opt, i) => (
          <button key={i} data-elastic-opt={i}
            onClick={() => 答一格(i)}
            style={{
              display: 'block', width: '100%', textAlign: 'left', marginBottom: 10, minHeight: 52,
              padding: '12px 14px', borderRadius: 10, fontSize: 16, fontFamily: 'inherit', cursor: 'pointer',
              border: 已答 ? (i === 题.正确 ? '2px solid var(--good)' : i === 选 ? '2px solid var(--bad)' : '1px solid var(--border-strong)') : '1px solid var(--border-strong)',
              background: 已答 && i === 题.正确 ? 'var(--good-bg)' : 'var(--bg)', color: 'var(--text)',
            }}>
            {opt}
            {已答 && i === 题.正确 && <span style={{ fontSize: 12, color: 'var(--good)', marginLeft: 8 }}>← 正确</span>}
            {已答 && i === 选 && i !== 题.正确 && <span style={{ fontSize: 12, color: 'var(--bad)', marginLeft: 8 }}>← 你选的</span>}
          </button>
        ))}
        {已答 && (
          <div className="card" data-elastic-reveal>
            <div style={{ fontSize: 15, fontWeight: 700, color: 结.对 ? 'var(--good)' : 'var(--bad)' }}>
              {结.对 ? '答对了！' : '差一点 —— 正确答案是 ' + 题.选项[题.正确]}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 6, lineHeight: 1.8 }}>{题.解析}</div>
            <button className="btn btn-primary" data-elastic-next style={{ marginTop: 12, width: '100%', minHeight: 44 }} onClick={下一题}>下一题</button>
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.6 }}>
          本游戏只记录玩了几次（游戏记录），不影响成绩、不进结算（V133 契约）。
        </div>
      </div>
    </div>
  )
}
