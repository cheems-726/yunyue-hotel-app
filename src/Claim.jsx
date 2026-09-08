import React, { useState } from 'react'
import ResultFeedback from './ResultFeedback.jsx'

// 加盟 6 步流程（来自华住真实加盟流程）
const claimSteps = [
  { key: 'apply', icon: '📝', title: '意向申请', desc: '提交项目城市、地址、面积、产权、租金' },
  { key: 'review', icon: '🔍', title: '项目初审', desc: '核对商圈客源、交通、竞品、租金' },
  { key: 'survey', icon: '📐', title: '实地勘址', desc: '结合柱网/电梯/消防测算房量' },
  { key: 'decision', icon: '⚖️', title: '项目决策', desc: '市场调研 + 收益模型，确认准入' },
  { key: 'negotiate', icon: '🤝', title: '商务洽谈', desc: '确认加盟费、营建标准、筹备计划' },
  { key: 'sign', icon: '✍️', title: '合同签署', desc: '完成产权审核，正式签约' },
]

// 候选物业（按品牌标准给出，含商圈类型）
const properties = {
  经济型: [
    { name: '社区旁物业', type: '社区型', area: '2600㎡', rooms: '72间', rent: '中等', match: '高' },
    { name: '交通枢纽物业', type: '枢纽型', area: '3000㎡', rooms: '80间', rent: '低', match: '高' },
    { name: '商务区物业', type: '商圈型', area: '2800㎡', rooms: '75间', rent: '高', match: '中' },
  ],
  中档: [
    { name: '商圈核心物业', type: '商圈型', area: '3500㎡', rooms: '85间', rent: '高', match: '高' },
    { name: '商务区物业', type: '商务型', area: '3200㎡', rooms: '80间', rent: '中高', match: '高' },
    { name: '交通枢纽物业', type: '枢纽型', area: '3000㎡', rooms: '78间', rent: '中', match: '中' },
  ],
  中高档: [
    { name: '商圈黄金物业', type: '商圈型', area: '4000㎡', rooms: '90间', rent: '很高', match: '高' },
    { name: '高端商务物业', type: '商务型', area: '3800㎡', rooms: '88间', rent: '高', match: '高' },
  ],
  高档: [
    { name: '核心地段物业', type: '商圈型', area: '4500㎡', rooms: '95间', rent: '极高', match: '高' },
  ],
}

function getPropertyList(brandLevel) {
  if (brandLevel.includes('经济') || brandLevel.includes('国民')) return properties['经济型']
  if (brandLevel.includes('精选') || brandLevel.includes('中高档')) return properties['中高档']
  if (brandLevel.includes('高档')) return properties['高档']
  return properties['中档']
}

export default function Claim({ brand, location, onComplete }) {
  const [step, setStep] = useState(0)
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [claimed, setClaimed] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const propList = getPropertyList(brand.level)
  const current = claimSteps[step]
  const progress = Math.round((step / (claimSteps.length - 1)) * 100)

  function propertyResult(p) {
    const rentHigh = p.rent.includes('高') || p.rent.includes('很高') || p.rent.includes('极高')
    return {
      title: `选择「${p.name}」的结果`,
      changes: [
        { label: '商圈类型', value: p.type, dir: '' },
        { label: '租金水平', value: p.rent, dir: rentHigh ? 'down' : 'up' },
        { label: '可排房量', value: p.rooms, dir: '' },
        { label: '与品牌匹配度', value: p.match, dir: p.match === '高' ? 'up' : '' },
      ],
      note: `选「${p.name}」意味着：${rentHigh ? '租金高、成本压力大，但客流旺、房价能拉高' : '租金低、成本可控，但可能客流有限'}。匹配度${p.match}，${p.match === '高' ? '符合品牌标准，未来经营更顺' : '需谨慎，可能影响品牌一致性'}。`,
    }
  }

  function handlePropertyClick(p) {
    setSelectedProperty(p)
    setFeedback(propertyResult(p))
  }

  // 第0步选物业，第1-5步走流程
  function next() {
    if (step < claimSteps.length - 1) setStep(step + 1)
    else {
      setClaimed(true)
      onComplete({ property: selectedProperty, brand })
    }
  }
  function prev() {
    if (step > 0) setStep(step - 1)
  }

  return (
    <div className="content">
      <div className="header">
        <span className="step-tag">🏨 第三步 · 认领酒店</span>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>认领一家酒店</h1>
        <div className="sub">{brand.name}品牌 · {location?.district} · 走完加盟流程正式认领</div>
      </div>

      {/* 进度条 */}
      <div style={{ padding: '0 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>
          <span>第 {step + 1} 步 / 共 {claimSteps.length} 步</span>
          <span>{progress}%</span>
        </div>
        <div style={{ height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: progress + '%', background: '#E8940F', borderRadius: 4, transition: 'width 0.3s' }}></div>
        </div>
      </div>

      {/* 步骤导航 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 20px', marginBottom: 20 }}>
        {claimSteps.map((s, i) => (
          <div key={s.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
            <div
              onClick={() => { if (i < step) setStep(i) }}
              style={{
                width: 30, height: 30, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                background: i === step ? '#FFF4E0' : (i < step ? '#ECFDF5' : '#F9FAFB'),
                border: i === step ? '2px solid #E8940F' : (i < step ? '1px solid #10B981' : '1px solid #E5E7EB'),
              }}
            >
              {i < step ? '✓' : s.icon}
            </div>
            <span style={{ fontSize: 8, color: i === step ? '#A96407' : '#9CA3AF', textAlign: 'center' }}>{s.title}</span>
          </div>
        ))}
      </div>

      {/* 当前步骤内容 */}
      <div className="card">
        <div className="card-title">{current.icon} {current.title}</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>{current.desc}</div>

        {/* 第一步：选物业 */}
        {step === 0 && (
          <div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>符合 {brand.name} 品牌标准的候选物业：</div>
            {propList.map(p => (
              <div
                key={p.name}
                className={`district-card ${selectedProperty && selectedProperty.name === p.name ? 'selected' : ''}`}
                style={{ marginBottom: 8, padding: 12 }}
                onClick={() => handlePropertyClick(p)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: p.match === '高' ? '#ECFDF5' : '#FFF4E0', color: p.match === '高' ? '#065F46' : '#A96407' }}>匹配度 {p.match}</span>
                </div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6 }}>{p.type} · {p.area} · {p.rooms} · 租金{p.rent}</div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>💡 匹配度越高，未来经营越顺，但租金可能越高——权衡</div>
          </div>
        )}

        {/* 中间步骤：流程说明 */}
        {step > 0 && (
          <div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, padding: '12px', background: '#F9FAFB', borderRadius: 10 }}>
              {step === 1 && '开发经理核对：商圈客源充足、交通便利、竞品适中、租金可承受。✅ 初审通过'}
              {step === 2 && '实地勘址：柱网、电梯、消防、采光条件良好，可实现房量符合品牌标准。✅ 勘址完成'}
              {step === 3 && '收益模型测算：基于商圈客流和房价，预计出租率 65%，回收期约 6-7 年。✅ 项目准入'}
              {step === 4 && '商务条款：确认加盟费、合作责任、营建标准、筹备计划。✅ 条款达成'}
              {step === 5 && `合同签署：完成产权审核，正式签约。🎉 你已认领「${selectedProperty?.name}」，获得${brand.name}品牌经营权！`}
            </div>
          </div>
        )}
      </div>

      {/* 底部按钮 */}
      <div style={{ padding: '8px 20px 24px', display: 'flex', gap: 10 }}>
        {step > 0 && (
          <button className="btn btn-ghost" style={{ padding: '12px 0' }} onClick={prev}>上一步</button>
        )}
        <button
          className="btn-confirm"
          style={{ flex: 2 }}
          disabled={step === 0 && !selectedProperty}
          onClick={next}
        >
          {step === claimSteps.length - 1 ? '完成认领，进入筹建 →' : `完成「${current.title}」，下一步 →`}
        </button>
      </div>

      {feedback && <ResultFeedback result={feedback} onClose={() => setFeedback(null)} />}
    </div>
  )
}
