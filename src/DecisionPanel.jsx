import React, { useState, useEffect, useMemo } from 'react'
import ResultFeedback from './ResultFeedback.jsx'

// 决策组件：支持 5 类决策（option/slider/budget/sort/timer）
// 交互统一原则：做一步 → 立即看到结果反馈
export default function DecisionPanel({ decision, onBack, onDone, lastReport }) {
  const [feedback, setFeedback] = useState(null)
  const [sliderVal, setSliderVal] = useState(decision.min ?? 0)
  const [budget, setBudget] = useState(() => {
    // 初始化预算：平均分配，余数给第一项（100/3 → 34/33/33）
    const init = {}
    if (decision.items) {
      const avg = Math.floor(decision.total / decision.items.length)
      decision.items.forEach((item, i) => { init[item] = avg + (i === 0 ? decision.total - avg * decision.items.length : 0) })
    }
    return init
  })
  const [sortItems, setSortItems] = useState(decision.items || [])
  const [timeLeft, setTimeLeft] = useState(30)
  const [selected, setSelected] = useState(null)

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
        <div className="sub">{decision.icon} {decision.name}</div>
      </div>

      <div className="card">
        <div className="card-title">{decision.icon} {decision.name}</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 12, lineHeight: 1.6 }}>{decision.desc}</div>

        {/* 上周状态参考：让决策有依据 */}
        {lastReport && (
          <div style={{ padding: '10px 12px', background: '#F9FAFB', borderRadius: 10, marginBottom: 12, fontSize: 11, color: '#6B7280', lineHeight: 1.7 }}>
            📊 上周参考：出租率 <b style={{ color: '#111827' }}>{lastReport.occupancy}%</b> · 利润 <b style={{ color: lastReport.profit >= 0 ? '#10B981' : '#EF4444' }}>{lastReport.profit >= 0 ? '+' : ''}{lastReport.profit}元</b> · 差评 {lastReport.negativeCount} 条 · 好评率 {lastReport.finalGoodRate}%
          </div>
        )}

        {/* 教学提示：引导学生在决策前思考 */}
        <div style={{ padding: '12px', background: '#FFF4E0', borderRadius: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#A96407', marginBottom: 4 }}>💡 决策前想一想</div>
          <div style={{ fontSize: 12, color: '#A96407', lineHeight: 1.6 }}>
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
              </div>
            ))}
          </div>
        )}

        {/* 滑块类：实时预览 */}
        {decision.type === 'slider' && (
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 8, color: '#A96407' }}>
              {sliderVal} {decision.unit}
            </div>
            <input
              type="range"
              min={decision.min}
              max={decision.max}
              value={sliderVal}
              onChange={e => setSliderVal(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#E8940F' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
              <span>{decision.min}{decision.unit}</span>
              <span>{decision.max}{decision.unit}</span>
            </div>
            {/* 实时结果预览 */}
            <div style={{ marginTop: 12, padding: 12, background: '#FFF4E0', borderRadius: 10, fontSize: 12, color: '#A96407', lineHeight: 1.6 }}>
              💡 {sliderResult()}
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
                  <span style={{ fontSize: 12, color: '#A96407', fontWeight: 600 }}>{budget[item] || 0}</span>
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
                  style={{ width: '100%', accentColor: '#E8940F' }}
                />
              </div>
            ))}
            <div style={{ fontSize: 13, color: budgetTotal > decision.total ? '#EF4444' : '#A96407', fontWeight: 600, marginTop: 8 }}>
              已分配：{budgetTotal} / {decision.total}{budgetTotal > decision.total ? '（超出预算！）' : ''}
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6, lineHeight: 1.6 }}>💡 {budgetResult()}</div>
          </div>
        )}

        {/* 排序类：可上移下移 */}
        {decision.type === 'sort' && (
          <div>
            {sortItems.map((item, i) => (
              <div key={item} style={{ padding: '12px 14px', background: '#F9FAFB', borderRadius: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#FFF4E0', color: '#A96407', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 14, flex: 1 }}>{item}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => moveItem(i, -1)} disabled={i === 0} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', cursor: i === 0 ? 'default' : 'pointer', fontSize: 14, opacity: i === 0 ? 0.4 : 1 }}>↑</button>
                  <button onClick={() => moveItem(i, 1)} disabled={i === sortItems.length - 1} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', cursor: i === sortItems.length - 1 ? 'default' : 'pointer', fontSize: 14, opacity: i === sortItems.length - 1 ? 0.4 : 1 }}>↓</button>
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>💡 按优先级排序，前 5 项优先整改（预算有限）</div>
          </div>
        )}

        {/* 倒计时类 */}
        {decision.type === 'timer' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 44, fontWeight: 700, color: timeLeft <= 10 ? '#EF4444' : '#A96407' }}>{timeLeft}s</div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>倒计时中，请尽快决策</div>
            </div>
            {decision.options.map(o => (
              <div
                key={o.label}
                className={`district-card ${selected === o.label ? 'selected' : ''}`}
                style={{ padding: 14, marginBottom: 8 }}
                onClick={() => pickOption(o.label, o.result)}
              >
                <div style={{ fontSize: 14, fontWeight: 600 }}>{o.label}</div>
              </div>
            ))}
            {timeLeft === 0 && !selected && (
              <div style={{ color: '#EF4444', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>时间到！已默认"不处理"</div>
            )}
          </div>
        )}
      </div>

      {/* 确认按钮 */}
      <div style={{ padding: '8px 20px 24px' }}>
        <button className="btn-confirm" disabled={!hasSelection} onClick={confirm}>
          {selected || decision.type === 'slider' || decision.type === 'sort' ? '确认决策，保存' : '请先做出选择'}
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
