import { useState } from 'react'
import Icon from './Icon.jsx'
import ResultFeedback from './ResultFeedback.jsx'
import { propertyQuote, STATUS } from './propertyQuote.mjs'   // W3-2 报价单（纯计算，不改结算）
import { onePageLedger, paybackText, 部门固定合计 } from './onePageLedger.mjs'   // W3-1 一页钱账 + W3-5 回本（口径 (b)）
import { SCALE } from './stateMigration.mjs'                  // §22.2-B3：IC 单源（运营启动资金）
import { OTA_RULES } from './otaRating.mjs' // §32-U3-C：平台规则单源（认领页明示，学生选模式前就看得见）

// 加盟 6 步流程（来自华住真实加盟流程）
const claimSteps = [
  { key: 'apply', icon: 'log.ops', title: '意向申请', desc: '提交项目城市、地址、面积、产权、租金' },
  { key: 'review', icon: 'search', title: '项目初审', desc: '核对商圈客源、交通、竞品、租金' },
  { key: 'survey', icon: 'prop.hotel', title: '实地勘址', desc: '结合柱网/电梯/消防测算房量' },
  { key: 'decision', icon: 'note.caliber', title: '项目决策', desc: '市场调研 + 收益模型，确认准入' },
  { key: 'negotiate', icon: 'corporate', title: '商务洽谈', desc: '确认加盟费、营建标准、筹备计划' },
  { key: 'sign', icon: 'status.done', title: '合同签署', desc: '完成产权审核，正式签约' },
]

// 候选物业（按品牌标准给出，含商圈类型）
// 🔴 W3-2：新增 areaNum（与 area 字符串同义的数字，供报价单计算用）——
//   字符串只作展示；数字字段由 tests/propertyQuote.test.mjs 断言"必须与字符串一致"（防两处漂移）
const properties = {
  经济型: [
    { name: '社区旁物业', type: '社区型', area: '2600㎡', areaNum: 2600, rooms: '72间', rent: '中等', match: '高', note: '可排客房按品牌标准（约50-80间）' },
    { name: '交通枢纽物业', type: '枢纽型', area: '3000㎡', areaNum: 3000, rooms: '80间', rent: '低', match: '高', note: '可排客房按品牌标准（约50-80间）' },
    { name: '商务区物业', type: '商圈型', area: '2800㎡', areaNum: 2800, rooms: '75间', rent: '高', match: '中', note: '可排客房按品牌标准（约50-80间）' },
  ],
  中档: [
    { name: '商圈核心物业', type: '商圈型', area: '3500㎡', areaNum: 3500, rooms: '85间', rent: '高', match: '高' },
    { name: '商务区物业', type: '商务型', area: '3200㎡', areaNum: 3200, rooms: '80间', rent: '中高', match: '高' },
    { name: '交通枢纽物业', type: '枢纽型', area: '3000㎡', areaNum: 3000, rooms: '78间', rent: '中', match: '中' },
  ],
  中高档: [
    { name: '商圈黄金物业', type: '商圈型', area: '4000㎡', areaNum: 4000, rooms: '90间', rent: '很高', match: '高' },
    { name: '高端商务物业', type: '商务型', area: '3800㎡', areaNum: 3800, rooms: '88间', rent: '高', match: '高' },
  ],
  高档: [
    { name: '核心地段物业', type: '商圈型', area: '4500㎡', areaNum: 4500, rooms: '95间', rent: '极高', match: '高' },
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
  const [bizMode, setBizMode] = useState(null) // 'direct' | 'ota'
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [claimed, setClaimed] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const propList = getPropertyList(brand.level)
  const current = claimSteps[step]
  const progress = Math.round((step / (claimSteps.length - 1)) * 100)
  // 🔴 W3-2：物业报价单（选中物业后即可算；口径见 src/propertyQuote.mjs 顶部注释）
  const quote = selectedProperty ? propertyQuote(brand, selectedProperty, location?.attrs) : null
  // 🔴 W3-1/W3-5：一页钱账 + 回本周期（口径 (b) 本店实测：ADR/OCC 取自引擎确定性单周）
  const ledger = selectedProperty ? onePageLedger({ brand, property: selectedProperty, districtAttrs: location?.attrs }) : null
  const payback = ledger ? paybackText(ledger) : null
  const 万元 = (v) => (Number.isFinite(v) ? (v / 10000).toFixed(1) + ' 万' : '待补')
  // 报价单与钱账共用的行格式化（口径：缺来源 ⇒ "待补"，不是空/0）
  // 🔴 §16.2-B1（2026-09-28）：新增 'text' 分支 —— 物业门槛里的「城市限定」是文字（如"限一二线城市"），
  //   原先没有 text 分支 ⇒ 会掉进万元分支做 `字符串 / 10000` ⇒ 渲染成 "NaN 万"（自造错，已修）。
  const fmtLine = (l) => l.status === STATUS.MISSING ? '待补 · 无来源数据'
    : (l.fmt === 'text' ? String(l.value)
      : l.fmt === 'fixed2' ? Number(l.value).toFixed(2)
        : l.fmt === 'num' ? String(l.value) : (l.value / 10000).toFixed(1) + ' 万')

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
        <span className="step-tag">第三步 · 认领酒店</span>
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
 {i < step ? '' : <Icon name={s.icon} size={16} />}
            </div>
            <span style={{ fontSize: 8, color: i === step ? '#A96407' : '#9CA3AF', textAlign: 'center' }}>{s.title}</span>
          </div>
        ))}
      </div>

      {/* 当前步骤内容 */}
      <div className="card">
        <div className="card-title"><Icon name={current.icon} size={15} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {current.title}</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>{current.desc}</div>

        {/* 开店模式选择（第0步） */}
        {step === 0 && !bizMode && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>选择经营模式（不可更改）</div>
            {[
              { mode: 'direct', icon: 'prop.hotel', name: '自主直营', desc: '完全自主定价、自主营销，利润全归自己，但客源靠本事，前期获客难', pros: '利润100%归自己 · 定价自由', cons: '前期客源少 · 营销成本高 · 风险自担', tag: '高风险高回报', tagColor: '#EF4444' },
              { mode: 'ota', icon: 'event.ota', name: 'OTA平台合作', desc: '把酒店上架到OTA平台（携程/美团/飞猪）获取线上流量，享受平台曝光和订单分发，但需缴纳佣金且受平台规则限制', pros: '线上客源多且稳定 · 起步容易 · 有平台背书', cons: '平台抽成15% · 降价受限制 · 违规有处罚', tag: '稳健起步', tagColor: '#16A34A' },
            ].map(m => (
              <div key={m.mode} className="district-card" style={{ padding: 16, marginBottom: 10 }} onClick={() => { setBizMode(m.mode); onComplete({ mode: m.mode }) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}><Icon name={m.icon} size={16} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {m.name}</span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: m.tagColor + '20', color: m.tagColor, fontWeight: 600 }}>{m.tag}</span>
                </div>
                <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, marginBottom: 8 }}>{m.desc}</div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: 11, color: '#16A34A' }}>{m.pros}</span>
                </div>
                <div style={{ fontSize: 11, color: '#EF4444', marginTop: 2 }}>{m.cons}</div>
 {/* §32-U3-C：平台规则【明示】（学生选之前就该看见 —— 文案来自单源 otaRating.OTA_RULES，界面只渲染） */}
                {m.mode === 'ota' && (
                  <div style={{ fontSize: 10, color: '#6B7280', marginTop: 8, padding: '7px 9px', background: '#F9FAFB', borderRadius: 8, lineHeight: 1.7 }}>
                    <b style={{ color: '#374151' }}>平台规则（会真实生效）：</b>
                    {OTA_RULES.map((r, i) => <div key={i}>· {r}</div>)}
                  </div>
                )}
                {m.mode === 'direct' && (
                  <div style={{ fontSize: 10, color: '#6B7280', marginTop: 8, padding: '7px 9px', background: '#F9FAFB', borderRadius: 8, lineHeight: 1.7 }}>
                    · 不受 OTA 平台评分与平台罚款影响（也没有 OTA 的线上流量加成）
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {step === 0 && bizMode && (
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
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>匹配度越高，未来经营越顺，但租金可能越高——权衡</div>
          </div>
        )}

        {/* 中间步骤：流程说明 */}
        {step > 0 && (
          <div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, padding: '12px', background: '#F9FAFB', borderRadius: 10 }}>
 {step === 1 && '开发经理核对：商圈客源充足、交通便利、竞品适中、租金可承受。 初审通过'}
 {step === 2 && '实地勘址：柱网、电梯、消防、采光条件良好，可实现房量符合品牌标准。 勘址完成'}
              {step === 3 && (ledger
                ? `收益模型测算：以引擎确定性单周为基准 —— 出租率 ${ledger.occ}%、实收均价 ${ledger.adr} 元/间·天，${payback.text.replace('回本周期：', '')}`
                : '收益模型测算：选中物业后可见「一页钱账」')}
 {step === 4 && '商务条款：确认加盟费、合作责任、营建标准、筹备计划。 条款达成'}
              {step === 5 && `合同签署：完成产权审核，正式签约。你已认领「${selectedProperty?.name}」，获得${brand.name}品牌经营权！`}
            </div>

 {/* W3-2（P2 交互层）：物业报价单 —— 只加展示，不改任何结算数值
                每个数字都能追到已有口径（房量=parseRooms / 年租金=引擎租金公式 / 费率=franchiseModel 三件套）；
                缺数据的字段显示"待补"（franchiseModel 目前只有 汉庭·汉庭快捷 两个品牌）；
                收益侧（出租率/ADR/回收期）需先定用哪套口径 ⇒ 属 A7，已进待决策队列，此处不编造。 */}
            {step === 3 && quote && (
              <div style={{ marginTop: 12, padding: 12, background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#075985', marginBottom: 8 }}>
                  物业报价单 · {quote.property}（{brand.name} 品牌标准）
                </div>
                {quote.lines.map(l => (
                  <div key={l.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, padding: '3px 0', borderBottom: '1px dashed #E0F2FE' }}>
                    <span style={{ color: '#0C4A6E', cursor: l.note ? 'help' : 'default' }} title={l.note}>{l.label}</span>
                    <span style={{ fontWeight: 600, color: l.status === STATUS.MISSING ? '#9CA3AF' : '#0369A1' }}>
                      {fmtLine(l)}
                      {l.status !== STATUS.MISSING && l.fmt !== 'wan' ? ' ' + l.unit : ''}
                    </span>
                  </div>
                ))}
                <div style={{ fontSize: 10, color: '#0369A1', marginTop: 8, lineHeight: 1.6 }}>
                  报价单只算【投资侧】。房量取品牌标准（与结算同源）、年租金取引擎租金口径、
                  费率来自加盟资料三件套 ⇒ 每个数字可追溯；<b>没有来源的一律"待补"，不编造</b>。
                </div>
              </div>
            )}

 {/* §22.2-B3（2026-09-29）：两笔钱【并排且区分】—— 学生必须一眼看出这是两笔不同的钱：
                「运营启动资金（IC）」= 系统统一提供、我手里的钱、用来周转经营（不动）；
                「投资总额（capex）」= 开店要花的钱（造价×房量 + 加盟费 + 保证金 + 筹备费 + PMS初装）。
 回本周期已改用投资总额算（一页钱账 B3）；缺项品牌显式"待补"，不参与计算（不编）。 */}
            {step === 3 && quote && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <div style={{ flex: 1, padding: '10px 12px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1E40AF' }}>运营启动资金（IC）</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1E40AF', margin: '2px 0' }}>约 {SCALE.IC_NEW / 10000} 万</div>
                  <div style={{ fontSize: 10, color: '#1E40AF', lineHeight: 1.6 }}><b>我手里的钱</b> —— 系统统一提供、全班一致，用来<b>周转经营</b>（发工资/付租金/交两费都从这里出）。</div>
                </div>
                <div style={{ flex: 1, padding: '10px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E' }}>投资总额（capex）</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#92400E', margin: '2px 0' }}>
                    {quote.lines.find(x => x.label === '总投资（估算）').value != null
                      ? <>约 {(quote.lines.find(x => x.label === '总投资（估算）').value / 10000).toFixed(0)} 万</>
                      : '待补'}
                  </div>
                  <div style={{ fontSize: 10, color: '#92400E', lineHeight: 1.6 }}><b>开店要花的钱</b> —— 造价×房量 + 加盟费 + 保证金（期末退）+ 筹备费 + PMS 初装（缺项"待补"）。</div>
                </div>
              </div>
            )}

 {/* W3-1（口径 (b) 本店实测）+ W3-5 回本周期（外推）：一页钱账 —— 只加展示，不改结算
                收益侧取【引擎确定性单周】（固定种子，"同一周全班同结果"）⇒ 与后续真实结算同源。
                §14.3 起加盟两费（管理费+CRS）已由引擎按营收实收；回本周期必须带"外推"标注（W4 裁决）。
 §22.2-B3：回本周期【改用投资总额】算（onePageLedger 已是）；并排区分两笔钱（下方 B3 块）。 */}
            {step === 3 && ledger && (
              <div style={{ marginTop: 12, padding: 12, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', marginBottom: 8 }}>
                  一页钱账 · {brand.name} @ {ledger.property}（年化）
                </div>
                {ledger.lines.map(l => (
                  <div key={l.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, padding: '3px 0', borderBottom: '1px dashed #DCFCE7' }}>
                    <span style={{ color: '#14532D', cursor: l.note ? 'help' : 'default' }} title={l.note}>{l.label}</span>
                    <span style={{ fontWeight: 600, color: l.status === STATUS.MISSING ? '#9CA3AF' : (l.label.includes('现金流') ? (l.value > 0 ? '#15803D' : '#DC2626') : '#166534') }}>
                      {fmtLine(l)}{l.status !== STATUS.MISSING && l.fmt !== 'wan' ? ' ' + l.unit : ''}
                    </span>
                  </div>
                ))}
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 8, color: payback.ok ? '#166534' : '#92400E' }}>
                  ⏳ {payback.text}
                </div>
                <div style={{ fontSize: 10, color: '#166534', marginTop: 8, lineHeight: 1.6 }}>
                {/* §14.3：加盟费用条款 —— 哪几项【已实收】、哪几项【待接入】
                    硬要求（D53）：不许让学生以为全是真金 ⇒ 逐项标状态 */}
                <div style={{ marginTop: 8, padding: '6px 8px', background: '#FFFFFF', border: '1px solid #DCFCE7', borderRadius: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#166534', marginBottom: 4 }}>
                    加盟费用条款（{ledger.费用状态 && ledger.费用状态.接入 ? '引擎已按营收实收' : '费率待补 · 未计费'}）
                  </div>
                  {(ledger.加盟条款 || []).map(x => (
                    <div key={x.科目} style={{ fontSize: 10, lineHeight: 1.7, color: x.状态 === '已实收' ? '#15803D' : '#9CA3AF' }}>
                      · {x.科目}：{x.状态}{x.费率 ? ` · ${x.费率}` : ''}{x.说明 ? ` · ${x.说明}` : ''}
 {/* §16.2-B6（2026-09-28）：置信度必须渲染出来 ——
                          原先只存在数据里（`费用清单()` 带 置信度 字段但界面不显示）⇒ 学生/老师
                          看不出「CRS 有效 2.4%」是建立在「渠道占比 30%」这个**低置信度教学假设**上的。
                          B6 明列要求"界面标置信度"，这里逐项标出（没有置信度的科目不显示）。 */}
                      {x.置信度 ? <span style={{ color: '#B45309' }}>{` · 置信度：${x.置信度}`}</span> : null}
                    </div>
                  ))}
                </div>
                  口径（决策端 2026-09-27 拍板 · 选项 (b) 本店实测）：出租率与平均房价取自
                  <b>引擎确定性单周</b>的实收结果（与后续每周结算同一套引擎）；部门成本用
                  <b>完整口径</b>（固定 {部门固定合计.toFixed(1)} 元/间·天含人力固定，另按入住量计变动），
                  与结算一致。<b>加盟两费</b>（管理费 5% + CRS 有效 2.4%）自 §14.3 起已由引擎按营收实收，本页读引擎实收（不重复计）。
                </div>
                <div style={{ fontSize: 10, color: '#92400E', marginTop: 6, lineHeight: 1.6, background: '#FFFBEB', borderRadius: 6, padding: '6px 8px' }}>
                  ⏳ {ledger.extrapolation} —— 实际经营会因决策、事件与淡旺季偏离本页估计。
                </div>
                <div style={{ fontSize: 10, color: '#7C2D12', marginTop: 4, lineHeight: 1.6 }}>
 {ledger.engineFeeNote}（任务包原式只列了"人力"，本页按 W14 后的完整部门成本口径 ——
                  只扣人力会系统性高估现金流）
                </div>
              </div>
            )}
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
          disabled={(step === 0 && (!bizMode || !selectedProperty))}
          onClick={next}
        >
          {step === 0 && !bizMode ? '请先选择经营模式' : step === claimSteps.length - 1 ? '完成认领，进入筹建 →' : `完成「${current.title}」，下一步 →`}
        </button>
      </div>

      {feedback && <ResultFeedback result={feedback} onClose={() => setFeedback(null)} />}
    </div>
  )
}
