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
  const [feedback, setFeedback] = useState(null) // 选项点击反馈
  const [picked, setPicked] = useState({}) // 已查看过的详情 key（视觉标记）
  // 真正的选择（会随开业写入存档）：invest=投资情景 / supplier=采购渠道 / opening=开业任务优先级顺序
  const [choices, setChoices] = useState({ invest: null, supplier: null, opening: [] })

  function pick(key, result) {
    setPicked(p => ({ ...p, [key]: true }))
    setFeedback(result)
  }
  function chooseInvest(scene) { setChoices(c => ({ ...c, invest: scene })) }
  function chooseSupplier(name) { setChoices(c => ({ ...c, supplier: name })) }
  function toggleOpeningTask(task) {
    setChoices(c => {
      const arr = c.opening.includes(task) ? c.opening.filter(x => x !== task) : [...c.opening, task]
      return { ...c, opening: arr }
    })
  }
  function stepSatisfied() {
    if (currentStep === 0) return !!choices.invest
    if (currentStep === 2) return !!choices.supplier
    if (currentStep === 3) return choices.opening.length === 3
    return true
  }

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
        <StepContent stepKey={step.key} onPick={pick} picked={picked} />
      </div>

      {/* 底部按钮 */}
      <div style={{ padding: '8px 20px 24px', display: 'flex', gap: 10 }}>
        {currentStep > 0 && (
          <button className="btn btn-ghost" style={{ padding: '12px 0' }} onClick={prev}>上一步</button>
        )}
        {currentStep < steps.length - 1 ? (
          <button className="btn-confirm" style={{ flex: 2, opacity: stepSatisfied() ? 1 : 0.5 }} disabled={!stepSatisfied()} onClick={() => { markDone(); next() }}>
            {stepSatisfied() ? `完成「${step.title}」，下一步 →` : step.title === '投资测算' ? '请先选择一个投资情景' : step.title === '物资采购' ? '请先选择采购渠道' : '请先完成本步'}
          </button>
        ) : (
          <button className="btn-confirm" style={{ flex: 2, opacity: stepSatisfied() ? 1 : 0.5 }} disabled={!stepSatisfied()} onClick={() => { markDone(); onComplete(choices) }}>
            {stepSatisfied() ? '🎉 完成筹建，正式开业 →' : '请为三项任务排出优先级（点击依次选定）'}
          </button>
        )}
      </div>

      {/* 选项点击反馈 */}
      {feedback && <ResultFeedback result={feedback} onClose={() => setFeedback(null)} />}

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
                { label: '投资情景', value: choices.invest || '未选择', dir: '' },
                { label: '采购渠道', value: choices.supplier ? choices.supplier.replace('供应商 ', '') : '未选择', dir: '' },
                { label: '开业优先级', value: choices.opening.join('→') || '未排序', dir: '' },
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

function StepContent({ stepKey, onPick, picked }) {
  const clickable = key => ({
    cursor: 'pointer',
    border: picked[key] ? '1px solid #E8940F' : '1px solid transparent',
    background: picked[key] ? '#FFF4E0' : '#F9FAFB',
  })
  switch (stepKey) {
    case 'invest':
      return (
        <div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>点击情景查看投资结果，<b>选定一个</b>作为你的投资决策（必须选择才能进入下一步）：</div>
          {[
            { key: 'inv-opt', scene: '乐观情景', occ: '出租率 80%+', note: '高客流市场，快速回收，约 4-5 年回本', advise: '适合追加投资提品质', title: '乐观情景 · 投资决策', changes: [{ label: '投资规模', value: '追加投资，提升品质', dir: 'down' }, { label: '品质定位', value: '高（拉高房价带）', dir: 'up' }, { label: '预计回收期', value: '4-5 年', dir: 'up' }, { label: '风险', value: '客流不及预期时回收期拉长', dir: 'down' }], note: '乐观情景下市场承接得住更高房价，追加投资（房型升级/公区品质）能换来更高 ADR。但钱花出去就收不回——先看选址客流是否真的支撑 80% 出租率。' },
            { key: 'inv-base', scene: '基准情景', occ: '出租率 65%', note: '中等客流，正常回收，约 6-7 年回本', advise: '稳健投入，控制成本', title: '基准情景 · 投资决策', changes: [{ label: '投资规模', value: '按品牌标准，不追加', dir: '' }, { label: '品质定位', value: '标准（符合品牌验收）', dir: '' }, { label: '预计回收期', value: '6-7 年', dir: '' }, { label: '风险', value: '低，行业最常见路径', dir: 'up' }], note: '基准情景是行业最常见假设：按品牌标准投入、不追加不削减。华住收益模型测算多以 65% 出租率为基准——稳健是主旋律， fluctuations 留给经营期去应对。' },
            { key: 'inv-pes', scene: '悲观情景', occ: '出租率 50%', note: '低客流市场，慢回收，约 8-10 年回本', advise: '谨慎投资，压缩预算', title: '悲观情景 · 投资决策', changes: [{ label: '投资规模', value: '压缩非必要预算', dir: 'up' }, { label: '品质定位', value: '保底线（卫生/床品/热水）', dir: '' }, { label: '预计回收期', value: '8-10 年', dir: 'down' }, { label: '风险', value: '现金流压力大，警惕资金链', dir: 'down' }], note: '悲观情景下每一分钱都要花在客人直接感知的地方（床品/热水/卫生），砍装修软装。低客流+高投入是最危险的组合，资金链断裂就出局。' },
          ].map(s => (
            <div key={s.key} onClick={() => { onPick(s.key, { title: s.title, changes: s.changes, note: s.note }); chooseInvest(s.scene) }} style={{ ...(choices.invest === s.scene ? { cursor: 'pointer', border: '2px solid #E8940F', background: '#FFF4E0' } : clickable(s.key)), borderRadius: 10, marginBottom: 10, padding: '14px' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{choices.invest === s.scene ? '✅ ' : ''}{s.scene} <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>{s.occ}</span>{picked[s.key] && <span style={{ fontSize: 10, color: '#A96407', marginLeft: 6 }}>已查看</span>}</div>
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
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>证照办理顺序（点击查看每张证照的要点，排错会延误开业）：</div>
          {licenses.map((l, i) => {
            const key = 'lic-' + i
            return (
              <div key={l.name} onClick={() => onPick(key, {
                title: `证照：${l.name}`,
                changes: [{ label: '办理部门', value: l.dept, dir: '' }, { label: '办理顺序', value: `第 ${i + 1} 步`, dir: '' }, { label: '要点', value: l.note, dir: '' }, { label: '逾期风险', value: i === 0 ? '无主体一切免谈' : i === 2 ? '消防不通过=特种证卡死' : '延误开业=少赚', dir: 'down' }],
                note: i === 0 ? '营业执照是一切的前置：没有主体资格，后续刻章、消防、特种行业许可全部办不了。所以它必须第一步。' : i === 2 ? '消防检查合格证是特种行业经营许可证的前置——公安消防先验收合格，属地公安分局才会发特种证。这两张证的先后关系最容易排错。' : `${l.dept}核发。筹建期所有证照要并联推进：材料先备齐、能办的先办，别串行等待——晚开业一天就少一天收入。`,
              })} style={{ ...clickable(key), borderRadius: 10, marginBottom: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#FFF4E0', color: '#A96407', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{l.name}{picked[key] && <span style={{ fontSize: 10, color: '#A96407', marginLeft: 6 }}>已查看</span>}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{l.dept} · {l.note}</div>
                </div>
              </div>
            )
          })}
          <div style={{ fontSize: 11, color: '#EF4444', lineHeight: 1.6, marginTop: 8 }}>
            ⚠ 前后置关系：营业执照是全部证照的前置；消防检查合格证是特种行业许可证的前置。顺序排错 → 触发"延误警告"，开业推迟，损失经营收入。
          </div>
        </div>
      )
    case 'purchase':
      return (
        <div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>点击渠道查看结果，<b>选定一个</b>作为你的采购决策（必须选择才能进入下一步）：</div>
          <div style={{ padding: '12px', background: '#FFF4E0', border: '1px solid #FBE3B3', borderRadius: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#A96407' }}>📦 华住易购（官方采购平台）</div>
            <div style={{ fontSize: 11, color: '#A96407', lineHeight: 1.6, marginTop: 4 }}>
              九大承诺：正品、按时送达、优价保证（贵即赔）、降价退差、7天退货、30天包换、先行赔付、发票无忧、公开透明。采购品类：家具、电器、布草、建材、客控、软装、IT设备。
            </div>
          </div>
          {[
            { key: 'buy-a', supplier: '供应商 A：华住易购（官方）', quality: '高，符合品牌标准', price: '高（但优价保证）', changes: [{ label: '品质分', value: '+10', dir: 'up' }, { label: '品牌一致性', value: '高，验收顺利', dir: 'up' }, { label: '成本', value: '较高（优价保证兜底）', dir: 'down' }, { label: '交期', value: '有保障', dir: 'up' }], note: '选官方渠道：品质分高、开业验收一次过、九大承诺兜底。前期投入大，但开业后差评少、复购稳——华住加盟店的推荐路径。' },
            { key: 'buy-b', supplier: '供应商 B：指定供应商', quality: '中，基本达标', price: '适中', changes: [{ label: '品质分', value: '+5', dir: 'up' }, { label: '品牌一致性', value: '基本达标', dir: '' }, { label: '成本', value: '适中', dir: '' }, { label: '交期', value: '一般，需盯紧', dir: 'down' }], note: '折中方案：钱省一些、品质也降一档。交期要自己盯（延误开业=少赚）。适合预算紧但不想违反品牌标准的团队。' },
            { key: 'buy-c', supplier: '供应商 C：自行采购', quality: '低，可能不合规', price: '低', changes: [{ label: '品质分', value: '-10', dir: 'down' }, { label: '品牌一致性', value: '可能不达标，验收有风险', dir: 'down' }, { label: '成本', value: '最低', dir: 'up' }, { label: '开业后口碑', value: '设施差评隐患大', dir: 'down' }], note: '自采最便宜，但埋三颗雷：验收可能不过（返工更贵）、设施差评拉低口碑、可能违反加盟合同。省下的钱往往在经营期加倍还回去。' },
          ].map(s => (
            <div key={s.key} onClick={() => { onPick(s.key, { title: `采购：${s.supplier}`, changes: s.changes, note: s.note }); chooseSupplier(s.supplier) }} style={{ ...(choices.supplier === s.supplier ? { cursor: 'pointer', border: '2px solid #E8940F', background: '#FFF4E0' } : clickable(s.key)), borderRadius: 10, marginBottom: 10, padding: '14px' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{choices.supplier === s.supplier ? '✅ ' : ''}{s.supplier}{picked[s.key] && <span style={{ fontSize: 10, color: '#A96407', marginLeft: 6 }}>已查看</span>}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{s.quality} · {s.price}</div>
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
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>点击任务查看详情，<b>按你想启动的先后顺序依次点击三项任务</b>排优先级（排满才能开业）：</div>
          {[
            { key: 'open-deco', task: '装修', days: '90-150天', way: '华住提供标准化设计图纸 + 指定模组化施工队', confirm: '开发团队勘测→出图→施工→工程验收(竣工验收5000元/隐蔽样板房2000元)', changes: [{ label: '工期占比', value: '最长（关键路径）', dir: 'down' }, { label: '验收节点', value: '竣工验收+隐蔽工程样板', dir: '' }, { label: '费用', value: '验收 5000元/样板房 2000元', dir: 'down' }, { label: '优先级建议', value: '第一天就启动', dir: 'up' }], note: '装修是关键路径（最长工期），必须第一天启动，它拖一天开业就晚一天。隐蔽工程要做样板房验收——返工的代价远高于验收费。' },
            { key: 'open-hr', task: '招聘', days: '30-45天', way: '华住委派店长 + 自有招聘平台/人才市场/校企合作', confirm: '面试→岗前技能考核(老带新"传帮带")→上岗；岗位：店长/前台/客房/餐饮/维修', changes: [{ label: '工期', value: '30-45天，可与装修并行', dir: '' }, { label: '培训', value: '老带新"传帮带"', dir: '' }, { label: '岗位', value: '店长/前台/客房/餐饮/维修', dir: '' }, { label: '优先级建议', value: '开业前45天启动', dir: 'up' }], note: '招聘在装修后期启动即可，但开业前必须留足培训时间——没经过"传帮带"的新人前台，开业头两周差评会很难看。' },
            { key: 'open-it', task: '系统上线', days: '15-30天', way: '华住提供中央预订(CRS)+会员+PMS+智能客控', confirm: 'IT团队部署→系统对接测试→上线', changes: [{ label: '工期', value: '15-30天', dir: '' }, { label: '系统', value: 'CRS+会员+PMS+智能客控', dir: '' }, { label: '节点', value: '对接测试必须留足', dir: '' }, { label: '优先级建议', value: '开业前30天启动', dir: 'up' }], note: 'PMS/门锁/客控没调通就开业=前台手忙脚乱+客人进不了房。系统上线要赶在招聘完成前——新人上岗就得在真系统上培训。' },
          ].map(s => (
            <div key={s.key} onClick={() => { onPick(s.key, { title: `开业任务：${s.task}`, changes: s.changes, note: s.note }); toggleOpeningTask(s.task) }} style={{ ...(choices.opening.includes(s.task) ? { cursor: 'pointer', border: '2px solid #E8940F', background: '#FFF4E0' } : clickable(s.key)), borderRadius: 10, marginBottom: 10, padding: '14px' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{choices.opening.includes(s.task) ? `✅ 第${choices.opening.indexOf(s.task) + 1}优先 ` : ''}{s.task} <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>{s.days}</span>{picked[s.key] && <span style={{ fontSize: 10, color: '#A96407', marginLeft: 6 }}>已查看</span>}</div>
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
