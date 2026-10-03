import { useState, useEffect, useMemo } from 'react'
import Icon from './Icon.jsx'
import { 代价文案 } from './decisionRisk.mjs' // §32-U4c-R6 原则④：代价文案单源（界面只渲染，不许自己拼）
import ResultFeedback from './ResultFeedback.jsx'
// 🔴 E3（N-3）：档位与'次日生效'口径来自 decisionCadence（单源；本文件不另写一份）
import { 档 as CAD, 档位 as cadenceOf, 档语 as CAD_LANG, 归属日 } from './decisionCadence.mjs'

// 决策组件：支持 5 类决策（option/slider/budget/sort/timer）
// 交互统一原则：做一步 → 立即看到结果反馈
export default function DecisionPanel({ decision, onBack, onDone, lastReport, initial, history = [] }) {
  const [feedback, setFeedback] = useState(null)
  const [sliderVal, setSliderVal] = useState(() =>
    decision.type === 'slider' && initial != null ? initial : (decision.min ?? 0)
  )
  const [budget, setBudget] = useState(() => {
    if (decision.type !== 'budget') return {}
    // 修改决策时回填已保存的分配，否则平均分配（余数给第一项）
    if (initial && typeof initial === 'object') return { ...initial }
    const init = {}
    if (decision.items) {
      const avg = Math.floor(decision.total / decision.items.length)
      decision.items.forEach((item, i) => { init[item] = avg + (i === 0 ? decision.total - avg * decision.items.length : 0) })
    }
    return init
  })
  const [sortItems, setSortItems] = useState(() =>
    decision.type === 'sort' && Array.isArray(initial) ? [...initial] : (decision.items || [])
  )
  const [timeLeft, setTimeLeft] = useState(30)
  const [selected, setSelected] = useState(() =>
    (decision.type === 'option' || decision.type === 'timer') && typeof initial === 'string' ? initial : null
  )
  const isEdit = initial != null

  // 倒计时
  useEffect(() => {
    if (decision.type !== 'timer' || timeLeft <= 0) return
    const t = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
    return () => clearTimeout(t)
  }, [decision.type, timeLeft])

  // 倒计时结束：默认"不处理"
  useEffect(() => {
    if (decision.type === 'timer' && timeLeft === 0 && !selected) {
      setSelected('不处理（超时默认）')
    }
  }, [timeLeft, decision.type, selected])

  const budgetTotal = useMemo(() => Object.values(budget).reduce((a, b) => a + b, 0), [budget])

  function showResult(changes, note) {
    setFeedback({
      title: `「${decision.name}」的决策结果`,
      changes,
      note,
    })
  }

  // 选项/倒计时：点选项立即反馈
  function pickOption(label, resultText) {
    setSelected(label)
    showResult(
      [{ label: '你的选择', value: label, dir: '' }, { label: '预期影响', value: resultText, dir: '' }],
      '这是预期结果。结算后系统会结合全班情况和市场随机性算出实际结果。'
    )
  }

  // 滑块：拖动实时预览，确认时弹最终反馈
  function sliderResult() {
    return decision.result(sliderVal)
  }

  // 预算：分配后查看结果
  function budgetResult() {
    return decision.result
  }

  // 排序：上移/下移
  function moveItem(index, dir) {
    const newItems = [...sortItems]
    const target = index + dir
    if (target < 0 || target >= newItems.length) return
    const temp = newItems[index]
    newItems[index] = newItems[target]
    newItems[target] = temp
    setSortItems(newItems)
  }

  function confirm() {
    let answer
    if (decision.type === 'slider') answer = sliderVal
    else if (decision.type === 'budget') answer = { ...budget }
    else if (decision.type === 'sort') answer = [...sortItems]
    else answer = selected

    onDone(decision.id, answer)
  }

  // 是否有有效选择
  const hasSelection = decision.type === 'slider'
    ? true
    : decision.type === 'budget'
      ? budgetTotal > 0
      : decision.type === 'sort'
        ? sortItems.length > 0
        : selected !== null

  return (
    <div className="content">
      <div className="header">
        <div className="row1">
          <span className="hotel-name" style={{ cursor: 'pointer' }} onClick={onBack}>‹ 返回</span>
          <span className="day-tag">{decision.module}</span>
        </div>
        <div className="sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name={decision.icon} size={15} /> {decision.name}</div>
 {/* E3：学生要能一眼分辨"这项能不能随时改、什么时候生效" */}
        {(() => {
          const k = cadenceOf(decision.id); if (!k) return null
          const c = CAD_LANG[k]
          const 色 = k === CAD.实时 ? { bg: 'var(--good-bg)', fg: 'var(--good)', bd: 'var(--good-border)' }
            : k === CAD.周期 ? { bg: 'var(--primary-bg)', fg: 'var(--info)', bd: 'var(--primary-border)' }
              : { bg: 'var(--bad-bg)', fg: 'var(--bad)', bd: 'var(--bad-border)' }
          return (
            <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '2px 7px', background: 色.bg, color: 色.fg, border: '1px solid ' + 色.bd }}>{c.名}</span>
              <span style={{ fontSize: 10, color: 'var(--text-sub)' }}>{c.说明}</span>
            </div>
          )
        })()}
      </div>

      <div className="card">
        <div className="card-title"><Icon name={decision.icon} size={16} /> {decision.name}</div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 12, lineHeight: 1.6 }}>{decision.desc}</div>

        {/* 上周状态参考：让决策有依据 */}
        {lastReport && (
          <div style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 10, marginBottom: 12, fontSize: 11, color: 'var(--text-sub)', lineHeight: 1.7 }}>
            上周参考：出租率 <b style={{ color: 'var(--text)' }}>{lastReport.occupancy}%</b> · 利润 <b style={{ color: lastReport.profit >= 0 ? 'var(--good)' : 'var(--bad)' }}>{lastReport.profit >= 0 ? '+' : ''}{lastReport.profit}元</b> · 差评 {lastReport.negativeCount} 条 · 好评率 {lastReport.finalGoodRate}%
          </div>
        )}
        {/* 近3周决策趋势：该决策的历史选择轨迹，判断是否该换打法 */}
        {(() => {
          const fmt = v => v == null ? null : (Array.isArray(v) ? v.join('＞') : typeof v === 'object' ? Object.entries(v).map(([k, x]) => `${k}:${x}`).join('、') : String(v))
          const trail = history.slice(-3).map(h => ({ week: h.week, choice: fmt((h.decisions || {})[decision.id]), occ: h.occupancy, profit: h.profit })).filter(x => x.choice)
          if (trail.length === 0) return null
          const changed = trail.length >= 2 && trail[trail.length - 1].choice !== trail[trail.length - 2].choice
          return (
            <div style={{ padding: '10px 12px', background: changed ? 'var(--primary-bg)' : 'var(--bg)', borderRadius: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--info)', marginBottom: 4 }}>
                该决策近{trail.length}周轨迹 {changed && <span style={{ color: 'var(--primary)' }}>· 上周换了打法</span>}
              </div>
              {trail.map(x => (
                <div key={x.week} style={{ fontSize: 11, color: 'var(--text)', padding: '2px 0', lineHeight: 1.5 }}>
                  第{x.week}周：<b>{x.choice.length > 30 ? x.choice.slice(0, 30) + '…' : x.choice}</b>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>出租率 {x.occ}% · 利润 {x.profit >= 0 ? '+' : ''}{x.profit}元</span>
                </div>
              ))}
              {changed && <div style={{ fontSize: 10, color: 'var(--info)', marginTop: 4 }}>上周已经换过打法——这次再换前，先想想上周换了之后结果如何</div>}
            </div>
          )
        })()}

        {/* 教学提示：引导学生在决策前思考 */}
        <div style={{ padding: '12px', background: 'var(--warn-bg)', borderRadius: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warn)', marginBottom: 4 }}>决策前想一想</div>
          <div style={{ fontSize: 12, color: 'var(--warn)', lineHeight: 1.6 }}>
            {decision.tip || '这个决策会带来什么后果？权衡利弊后再选择。'}
          </div>
        </div>

        {/* 选项类 */}
        {decision.type === 'option' && (
          <div>
            {decision.options.map(o => (
              <div
                key={o.label}
                className={`district-card ${selected === o.label ? 'selected' : ''}`}
                style={{ padding: 14, marginBottom: 8 }}
                onClick={() => pickOption(o.label, o.result)}
              >
                <div style={{ fontSize: 14, fontWeight: 600 }}>{o.label}</div>
 {/* §32-U4c-R6 原则④：代价可见（每选项一行；文案来自单源） */}
                {代价文案(decision.id, o.label) && (
                  <div style={{ display: 'inline-block', fontSize: 13, background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)', borderRadius: 7, padding: '3px 8px', marginTop: 6, lineHeight: 1.5 }}>{代价文案(decision.id, o.label)}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 滑块类：实时预览 */}
        {decision.type === 'slider' && (
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 8, color: 'var(--warn)' }}>
              {sliderVal} {decision.unit}
            </div>
            <input
              type="range"
              min={decision.min}
              max={decision.max}
              value={sliderVal}
              onChange={e => setSliderVal(Number(e.target.value))}
              onTouchMove={e => e.stopPropagation()}
              style={{ width: '100%', accentColor: 'var(--primary)', touchAction: 'pan-y' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              <span>{decision.min}{decision.unit}</span>
              <span>{decision.max}{decision.unit}</span>
            </div>
            {/* 实时结果预览 */}
            <div style={{ marginTop: 12, padding: 12, background: 'var(--warn-bg)', borderRadius: 10, fontSize: 12, color: 'var(--warn)', lineHeight: 1.6 }}>
              {sliderResult()}
            </div>
          </div>
        )}

        {/* 预算分配类 */}
        {decision.type === 'budget' && (
          <div>
            {decision.items.map(item => (
              <div key={item} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{item}</span>
                  <span style={{ fontSize: 12, color: 'var(--warn)', fontWeight: 600 }}>{budget[item] || 0}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={decision.total}
                  value={budget[item] || 0}
                  onChange={e => {
                    const newVal = Number(e.target.value)
                    const others = decision.items.filter(i => i !== item).reduce((a, b) => a + (budget[b] || 0), 0)
                    // 约束：总和不能超 total
                    const maxAllow = decision.total - others
                    setBudget({ ...budget, [item]: Math.min(newVal, maxAllow) })
                  }}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>
            ))}
            <div style={{ fontSize: 13, color: budgetTotal > decision.total ? 'var(--bad)' : 'var(--warn)', fontWeight: 600, marginTop: 8 }}>
              已分配：{budgetTotal} / {decision.total}{budgetTotal > decision.total ? '（超出预算！）' : ''}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.6 }}>{budgetResult()}</div>
          </div>
        )}

        {/* 排序类：可上移下移 */}
        {decision.type === 'sort' && (
          <div>
            {sortItems.map((item, i) => (
              <div key={item} style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--warn-bg)', color: 'var(--warn)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 14, flex: 1 }}>{item}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => moveItem(i, -1)} disabled={i === 0} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: '#fff', cursor: i === 0 ? 'default' : 'pointer', fontSize: 14, opacity: i === 0 ? 0.4 : 1 }}>↑</button>
                  <button onClick={() => moveItem(i, 1)} disabled={i === sortItems.length - 1} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: '#fff', cursor: i === sortItems.length - 1 ? 'default' : 'pointer', fontSize: 14, opacity: i === sortItems.length - 1 ? 0.4 : 1 }}>↓</button>
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>按优先级排序，前 5 项优先整改（预算有限）</div>
          </div>
        )}

        {/* 倒计时类 */}
        {decision.type === 'timer' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ width: 96, height: 96, margin: '0 auto 8px', borderRadius: '50%', background: `conic-gradient(var(--primary) ${Math.round((timeLeft / 30) * 360)}deg, var(--fill) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 78, height: 78, borderRadius: '50%', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, color: timeLeft <= 10 ? 'var(--bad)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{timeLeft}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>倒计时中，请尽快决策</div>
            </div>
            {decision.options.map(o => (
              <div
                key={o.label}
                className={`district-card ${selected === o.label ? 'selected' : ''}`}
                style={{ padding: 14, marginBottom: 8 }}
                onClick={() => pickOption(o.label, o.result)}
              >
                <div style={{ fontSize: 14, fontWeight: 600 }}>{o.label}</div>
 {/* §32-U4c-R6 原则④：代价可见（每选项一行；文案来自单源） */}
                {代价文案(decision.id, o.label) && (
                  <div style={{ display: 'inline-block', fontSize: 13, background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)', borderRadius: 7, padding: '3px 8px', marginTop: 6, lineHeight: 1.5 }}>{代价文案(decision.id, o.label)}</div>
                )}
              </div>
            ))}
            {timeLeft === 0 && !selected && (
              <div style={{ color: 'var(--bad)', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>时间到！已默认"不处理"</div>
            )}
          </div>
        )}
      </div>

      {/* 确认按钮 */}
      <div style={{ padding: '8px 20px 24px' }}>
        <button className="btn-confirm" disabled={!hasSelection} onClick={confirm}>
          {isEdit ? '修改决策，保存' : selected || decision.type === 'slider' || decision.type === 'sort' ? '确认决策，保存' : '请先做出选择'}
        </button>
      </div>

      {feedback && (
        <ResultFeedback
          result={feedback}
          onClose={() => setFeedback(null)}
        />
      )}
    </div>
  )
}
