// V128-#3 批2 · 「今日委托」学生端卡片（3 选 1 · 复用决策面板的 option 形态）
// 第一版只记录：确认后写 localStorage + weekInputs.每日委托（引擎不读）· 不影响结算
import { useState } from 'react'
import Icon from './Icon.jsx'

export default function DailyQuests({ 委托们 = [], 记录 = [], 反思 = [], 本周 = 1, on确认 }) {
  const [选中, set选中] = useState({})
  const [文本, set文本] = useState({})
  const 已完成 = new Set((记录 || []).map(r => `${r.天}|${r.类}`))
  const 反思有 = new Set((反思 || []).filter(x => Number(x.周) === Number(本周)).map(x => `${x.天}`))
  if (!委托们.length) return null

  return (
    <div className="card" style={{ borderColor: 'var(--primary-border)' }}>
      <div className="card-title" style={{ marginBottom: 6 }}>
        <Icon name="event.cost.utility" size={16} /> 今日委托
        <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>每天 1–2 个 · 只记录，不影响成绩</span>
      </div>
      {委托们.map(q => {
        const done = 已完成.has(`${q.天}|${q.类}`)
        const 选 = 选中[q.id]
        const 文 = (文本[q.id] || '').trim()
        const 可确认 = !!选 && (!q.需写一句 || (文.length > 0 && 文.length <= 30) || 反思有.has(String(q.天)))
        if (done) {
          const rec = (记录 || []).find(r => r.天 === q.天 && r.类 === q.类)
          const refl = (反思 || []).find(x => Number(x.周) === Number(本周) && Number(x.天) === q.天)
          return (
            <div key={q.id} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 10, marginBottom: 8, fontSize: 12, color: 'var(--text-sub)' }}>
              <b style={{ color: 'var(--good)' }}>✓ {q.标题}已完成</b>：{rec ? rec.选项 : '已提交'}
              {refl && <div style={{ color: 'var(--text-muted)', marginTop: 3 }}>今日一句：{refl.文本}</div>}
            </div>
          )
        }
        return (
          <div key={q.id} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}><Icon name="event.cost.utility" size={14} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {q.标题}</div>
            <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 8 }}>{q.场景}</div>
            {q.选项.map(o => (
              <div
                key={o.label}
                className={`district-card ${选 === o.label ? 'selected' : ''}`}
                style={{ padding: 12, marginBottom: 6 }}
                onClick={() => set选中(prev => ({ ...prev, [q.id]: o.label }))}
              >
                <div style={{ fontSize: 16, fontWeight: 600 }}>{o.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>代价：{o.代价}</div>
              </div>
            ))}
            {q.需写一句 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 12, color: 'var(--warn)', marginBottom: 3 }}>今天请写一句（≤30 字，每 3 天一次）</div>
                <input
                  value={文本[q.id] || ''}
                  maxLength={30}
                  onChange={e => set文本(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="例如：今天先保住好评，别再激化"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>{(文本[q.id] || '').length}/30</div>
              </div>
            )}
            <button
              className="btn btn-primary"
              disabled={!可确认}
              onClick={() => on确认 && on确认(q, 选, q.需写一句 ? 文 : '')}
              style={{ width: '100%', marginTop: 8, opacity: 可确认 ? 1 : 0.5 }}
            >
              {可确认 ? '确认决策，保存' : (q.需写一句 ? '先做选择并写一句' : '请先做出选择')}
            </button>
          </div>
        )
      })}
    </div>
  )
}
