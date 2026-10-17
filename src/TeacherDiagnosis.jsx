// 教师端：诊断组合 + 本周归因未填（V113-2.6）—— 只读、不排名
import { 诊断组合, 归因未填的组 } from './diagnoseGroups.mjs'

export default function TeacherDiagnosis({ states = [], logs = [], week = null }) {
  // 每组取最新一周（history 末行）；没有 history 的组跳过
  const groups = (states || []).map(s => {
    const h = Array.isArray(s.history) ? s.history : []
    const 末 = h.length ? h[h.length - 1] : null
    return { 名: s.group_no ? `第${s.group_no}组` : (s.student_no || s.user_id || '—'), groupKey: s.group_key || s.user_id || '', 行: 末 }
  }).filter(g => g.行)
  const 诊断 = 诊断组合(groups)
  const 有诊断 = 诊断.filter(x => x.诊断.length > 0)
  const 未填 = week != null ? 归因未填的组(groups, logs, week) : []
  if (!有诊断.length && !未填.length) return null
  return (
    <div className="card" style={{ background: 'var(--bg)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>诊断组合（只看矛盾，不做排名）</div>
      {未填.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--bad)', marginBottom: 8 }}>
          本周（W{week}）归因未填：{未填.map(x => x.名).join('、')}
        </div>
      )}
      {有诊断.map(g => (
        <div key={g.名} style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sub)' }}>{g.名}</div>
          {g.诊断.map(d => (
            <div key={d.k} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7 }}>· {d.文本}</div>
          ))}
        </div>
      ))}
      {有诊断.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>这一周没有组合矛盾（单指标高低不算问题）</div>}
    </div>
  )
}
