// V153 §1 · 学期末成绩单 —— 打印页（A4 竖版 · 一页六行）+ CSV 下载
// 只读重排 reportCard.mjs 的行；不自算一分（分数单源 = metricDefs.scoreOf）。
import React from 'react'
import { SCORE_WEIGHTS, wan2 } from './metricDefs.mjs'
import { 成绩单CSV } from './reportCard.mjs'

const PCT = (v) => (v == null || v === '' ? '—' : Math.round(v * 100) + '%')
const 万 = (v) => wan2(v)   // 金额→万 展示换算单源（metricDefs · stale-scale R6）

export function 下载CSV(rows, 文件名) {
  const csv = '\ufeff' + 成绩单CSV(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 文件名
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function ReportCardPrint({ rows = [], 班级 = '', onClose, 下载CSV: 下载 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--fill)', zIndex: 9000, overflowY: 'auto' }}>
      <style>{`
        @media print {
          .rc-noprint { display: none !important; }
          .rc-page { position: static !important; background: #fff !important; overflow: visible !important; }
          body { background: #fff; }
          .rc-table { font-size: 11pt; }
        }
      `}</style>
      <div className="rc-noprint" style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, zIndex: 2 }}>
        <button onClick={onClose} style={{ border: 'none', background: 'var(--fill)', borderRadius: 8, padding: '7px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>← 返回</button>
        <span style={{ fontSize: 13, fontWeight: 700 }}>期末成绩单（A4 竖版 · 一页六行）</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {下载 && <button onClick={下载} style={{ border: '1px solid var(--primary-border)', background: '#fff', color: 'var(--info)', fontSize: 13, fontWeight: 600, padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>下载 CSV</button>}
          <button onClick={() => { try { window.print() } catch (e) {} /* 静默理由：打印环境不支持时按钮静默（预览层已可见） */ }} style={{ border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>打印 / 存 PDF</button>
        </span>
      </div>
      <div className="rc-page" style={{ padding: '16px 18px', background: '#fff' }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>云悦酒店 · 学期末成绩单{班级 ? ` · ${班级}` : ''}</div>
        <div style={{ fontSize: 11, color: '#666', margin: '4px 0 12px', lineHeight: 1.7 }} data-caliber-a>
          口径 A：利润 {SCORE_WEIGHTS.profit * 100} / 口碑 {SCORE_WEIGHTS.reputation * 100} / 出租率 {SCORE_WEIGHTS.occupancy * 100} / 差评处理率 {SCORE_WEIGHTS.negative * 100}（过程分与委托不进总表）· 学期口径 = 前 12 周 · 分数与 metricDefs.scoreOf 同源（误差 0）
        </div>
        <table className="rc-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f4f5f7' }}>
              {['组', '酒店', '营收', '经营净利', '净利率', '出租率', '好评率', '差评处理', '利润分', '口碑分', '出租分', '差评分', '总分', '等级'].map(h => (
                <th key={h} style={{ padding: '6px 6px', borderBottom: '1.5px solid #333', textAlign: 'right', whiteSpace: 'nowrap', fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.组号} style={{ breakInside: 'avoid' }}>
                <td style={{ padding: '7px 6px', borderBottom: '1px solid #ddd', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.组号}</td>
                <td style={{ padding: '7px 6px', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap' }}>{r.酒店名 || '—'}</td>
                <td style={{ padding: '7px 6px', borderBottom: '1px solid #ddd', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{万(r.累计营收)}</td>
                <td style={{ padding: '7px 6px', borderBottom: '1px solid #ddd', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.经营净利 >= 0 ? '+' : '−'}{万(Math.abs(r.经营净利))}</td>
                <td style={{ padding: '7px 6px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>{r.净利率 == null ? '—' : (r.净利率 * 100).toFixed(1) + '%'}</td>
                <td style={{ padding: '7px 6px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>{r.平均出租率 == null ? '—' : r.平均出租率 + '%'}</td>
                <td style={{ padding: '7px 6px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>{r.平均好评率 == null ? '—' : r.平均好评率 + '%'}</td>
                <td style={{ padding: '7px 6px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>{r.差评处理率 == null ? '无差评待办周' : PCT(r.差评处理率)}</td>
                <td style={{ padding: '7px 6px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>{r.利润分}</td>
                <td style={{ padding: '7px 6px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>{r.口碑分}</td>
                <td style={{ padding: '7px 6px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>{r.出租率分}</td>
                <td style={{ padding: '7px 6px', borderBottom: '1px solid #ddd', textAlign: 'right' }}>{r.差评分}</td>
                <td style={{ padding: '7px 6px', borderBottom: '1px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{r.总分}</td>
                <td style={{ padding: '7px 6px', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap' }}>{r.等级}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 10, color: '#999', marginTop: 10, lineHeight: 1.7 }}>
          数据来源：各组 game_states.history（前 12 周）· 分数 = metricDefs.scoreOf（与导出 CSV 逐格一致）· 生成后可用「归档本学期」冻结存档。
        </div>
      </div>
    </div>
  )
}
