// V154 批3 · 教师端课堂包 —— 投屏视图（1920×1080 一屏六组 · 深色底 · 字大）+ 班级对比（不排名）
// 数据全部来自 semesterResult.mjs / reportCard.mjs 的纯重排层；本组件不自算一分。
import React, { useMemo, useState } from 'react'
import { 学期报告HTML, 成绩单CSV } from './classroomPack.mjs'
import { SCORE_WEIGHTS } from './metricDefs.mjs'
import { TOTAL_WEEKS } from './semester.mjs'



import { 万元 as 万元F, 率 as 率F, pctInt as pctIntF } from './classroomPack.mjs'
const 万元 = 万元F, 率 = 率F, pctInt = pctIntF

/**
 * 投屏视图：1920×1080 一屏放下全部组；深色底；核心字号 ≥20px。
 * 六格 grid；每格 = 组名 / 酒店名 / 经营净利 / 出租率 / 好评率 / 差评处理率 / 资金。无排名字段。
 */
export default function ClassroomScreen({ groups = [], rawStates = [], classByUid = {}, filterClass = '', onExit }) {
  const { rows, histBy组号 } = useMemo(() => 组装课堂行({ groups, rawStates, classByUid, filterClass }), [groups, rawStates, classByUid, filterClass])
  const 并排 = useMemo(() => 班级并排((groups || []).map(g => {
    const gs = rawStates.find(x => x.user_id === g.uid) || {}
    return { name: g.name, hotel: g.hotel, history: (gs.state && gs.state.history) || [] }
  })), [groups, rawStates])
  const 资金Of = (名) => {
    const gs = rawStates.find(x => {
      const g = (groups || []).find(y => y.uid === x.user_id)
      return g && g.name === 名
    })
    return gs && gs.state ? gs.state.capital : null
  }
  const tiles = rows.map(r => {
    const p = 并排.find(x => x.组名 === r.组号) || {}
    return { ...r, 资金: 资金Of(r.组号), 续营: p.续营周数 || 0 }
  })
  return (
    <div data-classroom-screen className="classroom-screen">
      <style>{`
        @media print { .cs-noprint { display: none !important; } body { background: #fff !important; } }
      `}</style>
      <div className="cs-noprint cs-head">
        <button className="cs-exit" onClick={onExit}>← 退出投屏</button>
        <span className="cs-title">云悦酒店 · 课堂投屏{filterClass ? ` · ${filterClass}` : ''}</span>
        <span className="cs-sub">口径 A：利润 {SCORE_WEIGHTS.profit * 100}/口碑 {SCORE_WEIGHTS.reputation * 100}/出租 {SCORE_WEIGHTS.occupancy * 100}/差评 {SCORE_WEIGHTS.negative * 100} · 前 {TOTAL_WEEKS} 周 · 并排展示不排名</span>
      </div>
      {tiles.length === 0 && <div className="cs-empty">（还没有已开档的组）</div>}
      <div className="cs-grid" style={{ gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, tiles.length))}, 1fr)` }}>
        {tiles.map(t => (
          <div key={t.组号} data-screen-tile={t.组号} className="cs-tile">
            <div className="cs-tile-head">
              <span className="cs-name">{t.组号}</span>
              <span className="cs-hotel">{t.酒店名 || '—'}</span>
            </div>
            <div className="cs-grid2">
              <div>
                <div className="cs-label">经营净利（前 {TOTAL_WEEKS} 周）</div>
                <div className={'cs-big ' + (t.经营净利 >= 0 ? 'cs-pos' : 'cs-neg')}>{万元(t.经营净利)}</div>
              </div>
              <div>
                <div className="cs-label">期末资金</div>
                <div className="cs-big">{t.资金 == null ? '—' : 万元(t.资金)}</div>
              </div>
              <div className="cs-kv">出租率 <b>{pctInt(t.平均出租率)}</b></div>
              <div className="cs-kv">好评率 <b>{pctInt(t.平均好评率)}</b></div>
              <div className="cs-kv">差评处理率 <b>{t.差评处理率 == null ? '无待办' : 率(t.差评处理率)}</b></div>
              <div className="cs-kv">总分 <b>{t.总分}</b><span className="cs-label">（{t.等级}）</span></div>
            </div>
            {t.续营 > 0 && <div className="cs-note">另有续营 {t.续营} 周（单列，不进学期口径）</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

/** 班级对比：六组并排 + 指标切换"按 X 排序"（排序 ≠ 排名 —— 标题写明，无名次列） */
export function ClassroomCompare({ rows = [], histBy组号 = {} }) {
  const [指标, set指标] = useState('经营净利')
  const 指标们 = ['经营净利', '净利率', '平均出租率', '平均好评率', '差评处理率', '总分']
  const 排序后 = [...rows].sort((a, b) => {
    const pick = (r) => {
      if (指标 === '总分') return r.总分
      if (指标 === '平均出租率') return r.平均出租率
      if (指标 === '平均好评率') return r.平均好评率
      if (指标 === '差评处理率') return r.差评处理率 == null ? -1 : r.差评处理率
      if (指标 === '净利率') return r.净利率 == null ? -1 : r.净利率
      return r.经营净利
    }
    return pick(b) - pick(a)
  })
  return (
    <div className="card" data-classroom-compare style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>班级对比（六组并排 · 只排序，不排名 —— 无名次列）</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
        {指标们.map(m => (
          <button key={m} data-compare-metric={m} onClick={() => set指标(m)}
            style={{ minHeight: 36, padding: '4px 12px', fontSize: 12, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', border: 指标 === m ? '1px solid var(--primary-border)' : '1px solid var(--border-strong)', background: 指标 === m ? 'var(--primary-bg)' : 'var(--card)', color: 指标 === m ? 'var(--info)' : 'var(--text-sub)' }}>
            按{m}排序{指标 === m ? ' ↓' : ''}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>当前视图：按{指标}排序（把同指标放在一起看差异；不是名次，无第 1 名）</div>
      <div style={{ overflowX: 'auto', marginTop: 8 }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)', textAlign: 'right' }}>
              <th style={{ textAlign: 'left', padding: '4px 6px' }}>组</th>
              <th style={{ padding: '4px 6px' }}>酒店</th>
              <th style={{ padding: '4px 6px' }}>经营净利</th>
              <th style={{ padding: '4px 6px' }}>净利率</th>
              <th style={{ padding: '4px 6px' }}>出租率</th>
              <th style={{ padding: '4px 6px' }}>好评率</th>
              <th style={{ padding: '4px 6px' }}>差评处理率</th>
              <th style={{ padding: '4px 6px' }}>总分</th>
            </tr>
          </thead>
          <tbody style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {排序后.map(r => (
              <tr key={r.组号} style={{ borderTop: '1px solid var(--fill)' }}>
                <td style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 600 }}>{r.组号}</td>
                <td style={{ padding: '4px 6px' }}>{r.酒店名 || '—'}</td>
                <td style={{ padding: '4px 6px' }}>{万元(r.经营净利)}</td>
                <td style={{ padding: '4px 6px' }}>{率(r.净利率)}</td>
                <td style={{ padding: '4px 6px' }}>{pctInt(r.平均出租率)}</td>
                <td style={{ padding: '4px 6px' }}>{pctInt(r.平均好评率)}</td>
                <td style={{ padding: '4px 6px' }}>{r.差评处理率 == null ? '无待办' : 率(r.差评处理率)}</td>
                <td style={{ padding: '4px 6px', fontWeight: 700 }}>{r.总分}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SelfCheck rows={rows} histBy组号={histBy组号} />
    </div>
  )
}

function SelfCheck({ rows, histBy组号 }) {
  const bad = 与scoreOf零差(rows, histBy组号)
  return bad.length === 0
    ? <div style={{ fontSize: 11, color: 'var(--good)', marginTop: 6 }}>✓ 分数与 scoreOf 逐格零差</div>
    : <div style={{ fontSize: 11, color: 'var(--bad)', marginTop: 6 }}>✗ 与 scoreOf 不一致：{bad.join(' | ')}</div>
}

export function 下载学期报告(参数) {
  const html = 学期报告HTML(参数)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `学期报告-${参数.班级 || '全班'}-${new Date().toISOString().slice(0, 10)}.html`
  a.click()
  URL.revokeObjectURL(a.href)
  return html
}

export function 导出成绩单CSV(rows, 文件名) {
  const blob = new Blob(['\ufeff' + 成绩单CSV(rows)], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 文件名
  a.click()
  URL.revokeObjectURL(a.href)
}

