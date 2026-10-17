// V113-2.4 · 12 周矩阵（只画能算的：OCC / ADR / RevPAR / 好评率 + 迷你趋势）
//   · GOPPAR / GOP 率：**旧周没有成本明细 ⇒ 显示「—·待接数据」**（不补算、不画 0）
//   · 数据来源：存档 history（E1 唯一真相源）· 每格由 metricView/矩阵行() 派生
import { 矩阵行 } from './metricView.mjs'

const pct = (v) => (Number.isFinite(v) ? (v * 100).toFixed(0) + '%' : '—')
const 元 = (v) => (Number.isFinite(v) ? Math.round(v).toString() : '—')

function 迷你({ 值s, 色 = 'var(--primary)' }) {
  const 数 = 值s.filter(Number.isFinite)
  if (数.length < 2) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
  const w = 64, h = 18
  const min = Math.min(...数), max = Math.max(...数)
  const span = max - min || 1
  const pts = 数.map((v, i) => `${(i / (数.length - 1)) * w},${h - ((v - min) / span) * (h - 2) - 1}`).join(' ')
  return (
    <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={色} strokeWidth="1.5" />
    </svg>
  )
}

export default function WeekMatrix({ history }) {
  const 行 = 矩阵行(history)
  if (!行.length) {
    return (
      <div style={{ margin: '0 20px 14px', padding: 12, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
        还没有历史周数据 —— 结算过第 1 周后这里会出现 12 周矩阵。
      </div>
    )
  }
  const 列 = [
    { k: 'OCC', 名: '出租率', fmt: pct, 趋势: 行.map(x => x.OCC) },
    { k: 'ADR', 名: '平均房价', fmt: (v) => Number.isFinite(v) ? 元(v) : '—', 趋势: 行.map(x => x.ADR) },
    { k: 'RevPAR', 名: 'RevPAR', fmt: (v) => Number.isFinite(v) ? 元(v) : '—', 趋势: 行.map(x => x.RevPAR) },
    { k: '好评率', 名: '好评率', fmt: pct, 趋势: 行.map(x => x.好评率) },
    { k: 'GOPPAR', 名: 'GOPPAR', fmt: (v) => Number.isFinite(v) ? 元(v) : '—·待接数据', 趋势: 行.map(x => x.GOPPAR) },
  ]
  const 有分层 = 行.filter(x => x.有分层).length
  return (
    <div style={{ margin: '0 20px 14px', padding: 12, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>12 周指标矩阵</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
        数据来自存档 history（{行.length} 周）· 只画能算的指标；算不出的显示「—·待接数据」，不补算
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)' }}>
              <th style={{ textAlign: 'left', padding: '4px 6px' }}>周</th>
              {列.map(c => <th key={c.k} style={{ textAlign: 'right', padding: '4px 6px', whiteSpace: 'nowrap' }}>{c.名}</th>)}
            </tr>
          </thead>
          <tbody>
            {行.map(r => (
              <tr key={r.week}>
                <td style={{ padding: '3px 6px', color: 'var(--text-sub)' }}>W{r.week}</td>
                {列.map(c => (
                  <td key={c.k} style={{ padding: '3px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: Number.isFinite(r[c.k]) ? 'var(--text)' : 'var(--text-muted)' }}>
                    {c.fmt(r[c.k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10 }}>
        {列.slice(0, 4).map(c => (
          <div key={c.k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.名}</span>
            <迷你 值s={c.趋势} />
          </div>
        ))}
      </div>
      {有分层 === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          GOPPAR 待接数据：历史周的成本明细只在**新结算**里落库（旧周没有）⇒ 不补算。
        </div>
      )}
    </div>
  )
}
