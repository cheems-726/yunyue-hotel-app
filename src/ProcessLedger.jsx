// V117 · 过程分台账（学生端一行 / 教师端块，共用一份渲染）
import { 过程分台账, 台账说明 } from './processScore.mjs'

const 格 = { padding: '6px 8px', borderBottom: '1px solid var(--fill)', fontVariantNumeric: 'tabular-nums' }
const 值 = (v) => (v == null ? '—' : String(v))

export default function ProcessLedger({ rows, 可导出 = false, onExport = null }) {
  return (
    <div style={{ margin: '0 20px 14px', padding: 12, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>过程分台账</div>
        {可导出 && onExport && (
          <button onClick={onExport} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text-sub)' }}>导出 CSV</button>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>组</th>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>酒店名</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>①承诺书</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>②归因</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>③理由</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>合计</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>满分</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((r, i) => {
              const t = r.台账 || 过程分台账({})
              return (
                <tr key={(r.组 || '') + i}>
                  <td style={{ ...格, textAlign: 'left' }}>{r.组 || '—'}</td>
                  <td style={{ ...格, textAlign: 'left' }}>{r.酒店名 || '—'}</td>
                  <td style={{ ...格, textAlign: 'right' }}>{值(t.承诺书)}</td>
                  <td style={{ ...格, textAlign: 'right' }}>{值(t.归因)}</td>
                  <td style={{ ...格, textAlign: 'right' }}>{值(t.理由条数)}</td>
                  <td style={{ ...格, textAlign: 'right', fontWeight: 700 }}>{值(t.合计)}</td>
                  <td style={{ ...格, textAlign: 'right', color: 'var(--text-muted)' }}>{值(t.满分)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.7 }}>
        {台账说明}　·　缺数据显「—」（**没交 ≠ 0 分**）
      </div>
    </div>
  )
}
