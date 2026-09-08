import React, { useState } from 'react'
import ResultFeedback from './ResultFeedback.jsx'

// 筹建 4 步（品牌/物业已在前面的选品牌和认领环节完成）
const steps = [
  { key: 'invest', icon: '💰', title: '投资测算', desc: '决定投资与品质水平' },
  { key: 'license', icon: '📄', title: '证照办理', desc: '正确排序证照流程' },
  { key: 'purchase', icon: '🛒', title: '物资采购', desc: '品质与成本的权衡' },
  { key: 'opening', icon: '🎉', title: '开业计划', desc: '排优先级控制工期' },
]

// 证照清单（官方6步流程，含办理部门）
const licenses = [
  { name: '申领营业执照', dept: '登记注册部门', note: '一切的前置，先有主体' },
  { name: '刻章备案', dept: '公安治安窗口', note: '公章刻字备案' },
  { name: '消防检查合格证', dept: '公安消防部门', note: '特种行业的前置' },
  { name: '特种行业经营许可证', dept: '属地公安分局', note: '旅馆属特种行业，必须办' },
  { name: '卫生许可证', dept: '卫计部门', note: '住宿卫生必须' },
  { name: '税务申报 + 领发票', dept: '税务部门', note: '初次纳税申报' },
]

export default function Establishment({ brand, property, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [done, setDone] = useState({})
  const [opening, setOpening] = useState(false) // 开业庆祝反馈

  function markDone() {
    const newDone = { ...done, [currentStep]: true }
    setDone(newDone)
    if (currentStep === steps.length - 1) setOpening(true) // 最后一步：弹开业反馈
  }
  function finishOpening() {
    setOpening(false)
    onComplete()
  }
  function next() {
    if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1)
  }
  function prev() {
    if (currentStep > 0) setCurrentStep(currentStep - 1)
  }

  const step = steps[currentStep]
  const progress = Math.round((currentStep / (steps.length - 1)) * 100)

  return (
    <div className="content">
      <div className="header">
        <span className="step-tag">🏗️ 第四步 · 筹建</span>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>门店筹建</h1>
        <div className="sub">{brand?.name}品牌 · {property?.name} · 完成筹建后开业</div>
      </div>

      {/* 进度条 */}
      <div style={{ padding: '0 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>
          <span>第 {currentStep + 1} 步 / 共 {steps.length} 步</span>
          <span>{progress}%</span>
        </div>
        <div style={{ height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: progress + '%', background: '#E8940F', borderRadius: 4, transition: 'width 0.3s' }}></div>
        </div>
      </div>

      {/* 步骤导航 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 20px', marginBottom: 20 }}>
        {steps.map((s, i) => (
          <div key={s.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
            <div
              onClick={() => setCurrentStep(i)}
              style={{
                width: 38, height: 38, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, cursor: 'pointer',
                background: i === currentStep ? '#FFF4E0' : (done[i] ? '#ECFDF5' : '#F9FAFB'),
                border: i === currentStep ? '2px solid #E8940F' : (done[i] ? '1px solid #10B981' : '1px solid #E5E7EB'),
              }}
            >
              {done[i] ? '✓' : s.icon}
            </div>
            <span style={{ fontSize: 10, color: i === currentStep ? '#A96407' : '#9CA3AF', textAlign: 'center' }}>{s.title}</span>
          </div>
        ))}
      </div>

      {/* 当前步骤内容 */}
      <div className="card">
        <div className="card-title">{step.icon} {step.title}</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>{step.desc}</div>
        <StepContent stepKey={step.key} />
      </div>

      {/* 底部按钮 */}
      <div style={{ padding: '8px 20px 24px', display: 'flex', gap: 10 }}>
        {currentStep > 0 && (
          <button className="btn btn-ghost" style={{ padding: '12px 0' }} onClick={prev}>上一步</button>
        )}
        {currentStep < steps.length - 1 ? (
          <button className="btn-confirm" style={{ flex: 2 }} onClick={() => { markDone(); next() }}>
            完成「{step.title}」，下一步 →
          </button>
        ) : (
          <button className="btn-confirm" style={{ flex: 2 }} onClick={markDone}>
            🎉 完成筹建，正式开业 →
          </button>
        )}
      </div>

      {/* 开业庆祝反馈（含酒店出生参数总览） */}
      {opening && (
        <ResultFeedback
          result={{
            title: `🎉 ${brand?.name}品牌 · ${property?.name} 正式开业！`,
            changes: (() => {
              const lv = brand?.level || ''
              const quality = lv.includes('经济') ? 60 : lv.includes('中高档') || lv.includes('精选') ? 85 : lv.includes('高档') ? 90 : lv.includes('奢华') ? 95 : 75
              const rooms = (property?.rooms && Number(property.rooms.match(/(\d+)/)?.[1])) || 70
              const midPrice = (brand?.price && Number(brand.price.match(/(\d+)-(\d+)/)?.[1]) + Number(brand.price.match(/(\d+)-(\d+)/)?.[2])) / 2 / 1 || 300
              return [
                { label: '酒店状态', value: '已开业', dir: 'up' },
                { label: '品牌', value: brand?.name || '', dir: '' },
                { label: '物业', value: `${property?.name || ''}（${property?.type || ''}）`, dir: '' },
                { label: '可排房量', value: `${rooms} 间`, dir: '' },
                { label: '初始品质分', value: `${quality} / 100`, dir: '' },
                { label: '房价带', value: brand?.price || '—', dir: '' },
                { label: '所在商圈', value: property?.name?.includes('枢纽') ? '交通枢纽型' : property?.name?.includes('社区') ? '社区型' : '商圈型', dir: '' },
              ]
            })(),
            note: '你的酒店已正式开业！现在进入经营阶段，每天做决策、每周结算、处理差评，经营好这家酒店。',
          }}
          onClose={finishOpening}
        />
      )}
    </div>
  )
}

function StepContent({ stepKey }) {
  switch (stepKey) {
    case 'invest':
      return (
        <div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>投资测算三情景（决定投资规模与品质水平）：</div>
          {[
            { scene: '乐观情景', occ: '出租率 80%+', note: '高客流市场，快速回收，约 4-5 年回本', advise: '适合追加投资提品质' },
            { scene: '基准情景', occ: '出租率 65%', note: '中等客流，正常回收，约 6-7 年回本', advise: '稳健投入，控制成本' },
            { scene: '悲观情景', occ: '出租率 50%', note: '低客流市场，慢回收，约 8-10 年回本', advise: '谨慎投资，压缩预算' },
          ].map(s => (
            <div key={s.scene} style={{ padding: '14px', background: '#F9FAFB', borderRadius: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{s.scene} <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>{s.occ}</span></div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{s.note}</div>
              <div style={{ fontSize: 11, color: '#A96407', marginTop: 4 }}>建议：{s.advise}</div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.6 }}>
            💡 关键指标：RevPAR（每间可售房收入）= ADR × 出租率；GOP率（毛经营利润率）是业主最关注指标。追加投资提升品质能拉高房价，但拉长回收期——权衡投入与回报。
          </div>
        </div>
      )
    case 'license':
      return (
        <div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>证照办理顺序（排错会延误开业，晚开业=少赚）：</div>
          {licenses.map((l, i) => (
            <div key={l.name} style={{ padding: '12px 14px', background: '#F9FAFB', borderRadius: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#FFF4E0', color: '#A96407', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{l.name}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{l.dept} · {l.note}</div>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: '#EF4444', lineHeight: 1.6, marginTop: 8 }}>
            ⚠ 前后置关系：营业执照是全部证照的前置；消防检查合格证是特种行业许可证的前置。顺序排错 → 触发"延误警告"，开业推迟，损失经营收入。
          </div>
        </div>
      )
    case 'purchase':
      return (
        <div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>物资采购（华住标准化要求"集中采购"）：</div>
          <div style={{ padding: '12px', background: '#FFF4E0', border: '1px solid #FBE3B3', borderRadius: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#A96407' }}>📦 华住易购（官方采购平台）</div>
            <div style={{ fontSize: 11, color: '#A96407', lineHeight: 1.6, marginTop: 4 }}>
              九大承诺：正品、按时送达、优价保证（贵即赔）、降价退差、7天退货、30天包换、先行赔付、发票无忧、公开透明。采购品类：家具、电器、布草、建材、客控、软装、IT设备。
            </div>
          </div>
          {[
            { supplier: '供应商 A：华住易购（官方）', quality: '高，符合品牌标准', price: '高（但优价保证）', note: '品质分 +10，品牌一致性高，交期有保障' },
            { supplier: '供应商 B：指定供应商', quality: '中，基本达标', price: '适中', note: '品质分 +5，交期一般' },
            { supplier: '供应商 C：自行采购', quality: '低，可能不合规', price: '低', note: '品质分 -10，可能招差评，违反品牌标准' },
          ].map(s => (
            <div key={s.supplier} style={{ padding: '14px', background: '#F9FAFB', borderRadius: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{s.supplier}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{s.quality} · {s.price}</div>
              <div style={{ fontSize: 11, color: '#A96407', marginTop: 4 }}>{s.note}</div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.6 }}>
            💡 华住标准化运营要求集中采购，保证品牌一致性。自采虽省成本，但埋下口碑隐患，且可能违反加盟合同。
          </div>
        </div>
      )
    case 'opening':
      return (
        <div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>开业计划（三项任务争人力，排优先级）：</div>
          {[
            { task: '装修', days: '90-150天', way: '华住提供标准化设计图纸 + 指定模组化施工队', confirm: '开发团队勘测→出图→施工→工程验收(竣工验收5000元/隐蔽样板房2000元)' },
            { task: '招聘', days: '30-45天', way: '华住委派店长 + 自有招聘平台/人才市场/校企合作', confirm: '面试→岗前技能考核(老带新"传帮带")→上岗；岗位：店长/前台/客房/餐饮/维修' },
            { task: '系统上线', days: '15-30天', way: '华住提供中央预订(CRS)+会员+PMS+智能客控', confirm: 'IT团队部署→系统对接测试→上线' },
          ].map(s => (
            <div key={s.task} style={{ padding: '14px', background: '#F9FAFB', borderRadius: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{s.task} <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>{s.days}</span></div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>途径：{s.way}</div>
              <div style={{ fontSize: 11, color: '#A96407', marginTop: 4 }}>确认：{s.confirm}</div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.6 }}>
            💡 优先级影响总工期和开业日期。装修工期最长，招聘影响开业后服务质量，系统越早上线越早产生收入。
          </div>
        </div>
      )
    default:
      return <div>建设中</div>
  }
}
