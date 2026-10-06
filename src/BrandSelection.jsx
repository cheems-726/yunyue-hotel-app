import { useState } from 'react'
import Icon from './Icon.jsx'
import ResultFeedback from './ResultFeedback.jsx'
import { SCALE } from './stateMigration.mjs'   // 资金三数单源（W2 收尾：启动资金文案不再硬编码）

// 华住全部品牌（按档次分组，含加盟费/造价/房价带）
const brandGroups = [
  {
    level: '经济型 · 国民',
    brands: [
      { name: '汉庭', icon: 'prop.hotel', fee: '2800元/间(≥18万)', cost: '6.77万/间', price: '180-280元', standard: '客房70间起', desc: '华住旗舰经济型，干净便捷性价比高，全球单一品牌客房数第二。' },
      // 🔴 §16.2-B1（2026-09-28）：你好/桔子/桔子水晶 = **半接入**（造价/门槛有官方现行 API，费率查不到）
      //   ⇒ 原先手写的"约2000元/间 / 5-6万间"这类**无来源数字**一律撤下，改显式「费率待补」+ 官方造价原文。
      //   （边界① 不许编造数据；依据 5-参考资料/加盟数值层-…-参数表.md §一 覆盖矩阵）
      { name: '你好', icon: 'prop.hotel', fee: '费率待补', cost: '7.08万/间·官方现行', price: '150-220元', standard: '客房60间起', desc: '国民新品牌，聚焦下沉市场，简约实用。' },
      { name: '海友', icon: 'prop.hotel', fee: '约2000元/间', cost: '5-6万/间', price: '120-180元', standard: '客房50间起', desc: '超经济型，极致性价比。' },
      { name: '宜必思', icon: 'prop.hotel', fee: '约2500元/间', cost: '6-7万/间', price: '160-240元', standard: '客房60间起', desc: '国际经济型品牌，年轻活力、标准化服务。' },
    ]
  },
  {
    level: '中档',
    brands: [
      { name: '全季', icon: 'prop.hotel', fee: '约4000元/间', cost: '8-10万/间', price: '280-400元', standard: '客房80间起', desc: '华住主力中档，东方人文、极简设计、好而不贵。' },
      { name: '桔子', icon: 'prop.hotel', fee: '费率待补', cost: '10.8万/间·官方现行', price: '260-380元', standard: '客房80间起', desc: '中档精品，时尚设计，年轻客群。' },
      { name: '星程', icon: 'prop.hotel', fee: '约3500元/间', cost: '7-9万/间', price: '240-350元', standard: '客房70间起', desc: '中档连锁，商务休闲兼顾。' },
      { name: '漫心', icon: 'prop.hotel', fee: '约4000元/间', cost: '8-10万/间', price: '300-420元', standard: '客房70间起', desc: '中档精品，人文艺术风格。' },
    ]
  },
  {
    level: '精选 · 中高档',
    brands: [
      { name: '桔子水晶', icon: 'prop.hotel', fee: '费率待补', cost: '15.43万/间·官方现行', price: '400-600元', standard: '客房80间起', desc: '桔子升级版，更高品质设计。' },
      { name: '全季大观', icon: 'prop.hotel', fee: '约5000元/间', cost: '10-13万/间', price: '400-550元', standard: '客房80间起', desc: '全季升级版，更高端中档。' },
      { name: '城际', icon: 'prop.hotel', fee: '约5000元/间', cost: '10-13万/间', price: '380-520元', standard: '客房80间起', desc: '交通枢纽型中高端。' },
      { name: '美居', icon: 'prop.hotel', fee: '约5000元/间', cost: '10-13万/间', price: '380-520元', standard: '客房80间起', desc: '雅高系中高端，法式优雅。' },
      { name: '美仑', icon: 'prop.hotel', fee: '约5000元/间', cost: '10-13万/间', price: '380-520元', standard: '客房80间起', desc: '中高端商务品牌。' },
    ]
  },
  {
    level: '高档',
    brands: [
      { name: '禧玥', icon: 'prop.hotel', fee: '洽谈', cost: '20万+/间', price: '600-1000元', standard: '客房60间起', desc: '华住高端，东方雅致生活。' },
      { name: '花间堂', icon: 'prop.hotel', fee: '洽谈', cost: '18万+/间', price: '500-900元', standard: '客房50间起', desc: '度假型高端，人文度假。' },
      { name: '施柏阁', icon: 'prop.hotel', fee: '洽谈', cost: '20万+/间', price: '600-1000元', standard: '客房60间起', desc: '德系高端，德意志传统。' },
      { name: '诺富特', icon: 'prop.hotel', fee: '洽谈', cost: '18万+/间', price: '500-900元', standard: '客房70间起', desc: '国际高端商务品牌。' },
    ]
  },
  {
    level: '奢华',
    brands: [
      { name: '宋品', icon: 'prop.hotel', fee: '洽谈', cost: '30万+/间', price: '1000-2000元', standard: '客房50间起', desc: '华住奢华，东方奢华。' },
      { name: '施柏阁大观', icon: 'prop.hotel', fee: '洽谈', cost: '30万+/间', price: '1200-2500元', standard: '客房50间起', desc: '施柏阁顶级，极致奢华。' },
    ]
  },
]

export default function BrandSelection({ location, onConfirm }) {
  const [selected, setSelected] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [confirmBrand, setConfirmBrand] = useState(null) // 含 level 的完整品牌对象

  // 区域限开等级：客流≤2 → 仅经济型(1)；3 → 经济～中端(2)；≥4 → 全档次(5)
  const flow = location?.attrs?.客流 ?? 3
  const maxTier = flow >= 4 ? 5 : (flow >= 3 ? 2 : 1)
  // ★ §31.2-A1（2026-09-30 · 等级限制【真强制】）：brandGroups 的下标 gi 即档次 1..5（经济型=1 … 奢华=5）。
  //   原先只有红色横幅（下方渲染）而 handleBrandClick **完全不校验** ⇒ 超档品牌仍可点选（装饰品 · 审计 D83-c）。
  //   现在三层强制：① 卡片 disabled ② 点击直接 return（双保险）③ 引擎侧 settle 校验（见 settlement.js）。

  // 每个品牌选择后的结果反馈
  function brandResult(b) {
    const isHigh = b.cost.includes('20万') || b.cost.includes('30万')
    const isEco = b.level.includes('经济')
    return {
      title: `选择「${b.name}」的结果`,
      changes: [
        { label: '投资门槛', value: b.cost, dir: isHigh ? 'down' : (isEco ? 'up' : '') },
        { label: '房价带', value: b.price, dir: '' },
        { label: '加盟费', value: b.fee, dir: '' },
        { label: '客群定位', value: b.level, dir: '' },
      ],
      note: `${b.desc} 选${b.name}意味着：${isHigh ? '高投入高回报，但资金压力大、回收期长' : isEco ? '低门槛易起步，但房价天花板低、利润薄' : '投入与回报相对均衡'}。后续认领的物业必须符合「${b.standard}」的标准。`,
    }
  }

  function handleBrandClick(b, level, gi) {
    // ★ §31.2-A1【真强制】：超档品牌直接拒绝（反馈面板写明原因 —— 学生看得见为什么）
    if (gi + 1 > maxTier) {
      setFeedback({
        title: `「${b.name}」在当前区域不可选`,
        changes: [
          { label: '区域限制', value: `${location?.district ?? '本区域'}（客流 ${flow} 档）最高只能开档次 ${maxTier}`, dir: 'down' },
          { label: '品牌档次', value: `第 ${gi + 1} 档（${g_levelName(gi)}）`, dir: '' },
          { label: '原因', value: '低消费区开高端酒店必亏（教学口径 3.2-1）—— 请换经济型品牌，或返回选址重选', dir: '' },
        ],
        note: '这不是故障，是经营现实：选址决定你能做什么生意。',
      })
      return
    }
    const brand = { ...b, level }
    setSelected(b.name)
    setFeedback(brandResult(brand))
    setConfirmBrand(brand)
  }

  // 档次名（§31.2-A1 · 供拒绝反馈用）
  function g_levelName(gi) {
    return ['经济型', '中端型', '中高端型', '高端型', '奢华型'][gi] || `第 ${gi + 1} 档`
  }

  return (
    <div className="content">
      <div className="header">
        <span className="step-tag">第二步 · 选品牌</span>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>选择你的酒店品牌</h1>
        <div className="sub">品牌决定物业标准、加盟费用、房价带</div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 20px', marginBottom: 8 }}>
        华住全品牌 · 共 {brandGroups.reduce((s, g) => s + g.brands.length, 0)} 个，点击选择
      </div>
      <div style={{ margin: '0 20px 12px', padding: '8px 12px', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: 8, fontSize: 12, color: 'var(--warn)', lineHeight: 1.6 }}>
        免责声明：本系统中的酒店价格为<b>模拟经营数据</b>，仅供教学演示使用，不代表实际市场定价。实际投资需以专业可行性调研为准。
      </div>
      {location && maxTier < 5 && (
        <div style={{ margin: '0 20px 12px', padding: '8px 12px', background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', borderRadius: 8, fontSize: 12, color: 'var(--bad)' }}>
          {location.district}（客流{flow}档）限开：{maxTier === 1 ? '仅经济型品牌' : '经济型～中端型品牌'}，高端品牌在此区域必亏
        </div>
      )}

 {/* P3-3：各档"初始资金"文案改口（建议 (a)）—— 实际是【系统统一提供启动资金】，
          不再是"经济型30万/中端50万…"的分档金额；档次差异体现在装修标准/房价带/房量门槛。
 W2 收尾修正：原硬编码"约 502 万"是 T1.1 时代的量级，W2-2 后 IC = 149 万
          ⇒ 学生看到"约 502 万"却只拿到 149 万（学生可见错值）⇒ 改为从 SCALE.IC_NEW 推导，单源。
 A-3（2026-09-27 · D47-g）：正名【运营启动资金】—— IC 149 万 ≠ 投资总额
          （单房造价 7.18 万 × 100 间 = 718 万），叫"启动资金"学生会当成开店总投 ⇒ 名字要写全。 */}
      <div style={{ margin: '0 0 10px', padding: '8px 12px', background: 'var(--primary-bg)', border: '1px solid var(--primary-border)', borderRadius: 10, fontSize: 12, color: 'var(--info)', lineHeight: 1.7 }}>
        <b>运营启动资金：系统统一提供约 {SCALE.IC_NEW / 10000} 万</b>（全班一致）。
        这笔钱是<b>用来周转经营的</b>，<b>不等于"开一家酒店的总投资"</b>——筹建投入（装修/软装/IT/布草等）
        另算，「报价单」里单列。品牌档次的差异体现在
        <b>装修标准 / 房价带 / 房量门槛</b>上，而不是这笔钱多少 —— 档越高，同样的钱越要花在品质上。
      </div>
      <div className="district-list">
        {brandGroups.map((g, gi) => (
          <div key={g.level} style={{ marginBottom: 16 }}>
            <div style={{ background: 'var(--warn-bg)', borderRadius: 12, padding: '10px 14px', marginBottom: 8, border: '1px solid var(--warn-border)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--warn)', marginBottom: 4 }}>{g.level}</div>
              <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6 }}>
                {gi === 0 && '经济型酒店主打干净、便捷、高性价比。装修简约，服务标准化，目标客群是预算有限的出差和旅行客人。房量与装修门槛最低，适合新手起步。'}
                {gi === 1 && '中端型酒店强调设计感和舒适体验，房价更高但客人要求也更高。需要平衡品质与成本，是竞争最激烈的档次。'}
                {gi === 2 && '中高端酒店在硬件和服务上全面升级，房价400+，对服务细节要求极高。适合有一定经营经验的团队。'}
                {gi === 3 && '高端酒店注重奢华体验和品牌调性，装修和人力成本极高，但房价可达600-1000元。回报大但风险也大。'}
                {gi === 4 && '奢华酒店是顶级定位，极致服务和独特设计，目标客群是高端商务和奢侈品消费者。只有最优秀的团队才能盈利。'}
              </div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--warn)', marginBottom: 8, padding: '0 4px' }}>{g.level}</div>
            {g.brands.map(b => {
              const 超档 = gi + 1 > maxTier
              return (
              <div
                key={b.name}
                className={`district-card ${selected === b.name ? 'selected' : ''}`}
                onClick={() => handleBrandClick(b, g.level, gi)}
                style={{ marginBottom: 8, padding: 12, ...(超档 ? { opacity: 0.45, cursor: 'not-allowed', background: 'var(--fill)' } : {}) }}
              >
                {超档 && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--bad)', marginBottom: 4 }}>
                    超出本区档次上限（限开 {maxTier} 档）—— 不可选
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}><Icon name={b.icon} size={16} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {b.name}</span>
                  {selected === b.name && (
 <span style={{ position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderRadius: '50%', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}></span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, marginTop: 4 }}>{b.desc}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                  <span style={{ fontSize: 12, padding: '3px 7px', background: 'var(--bg)', borderRadius: 5 }}>加盟费 {b.fee}</span>
                  <span style={{ fontSize: 12, padding: '3px 7px', background: 'var(--bg)', borderRadius: 5 }}>单房造价 {b.cost}</span>
                  <span style={{ fontSize: 12, padding: '3px 7px', background: 'var(--bg)', borderRadius: 5 }}>门市价 {b.price}</span>
                  <span style={{ fontSize: 12, padding: '3px 7px', background: 'var(--bg)', borderRadius: 5 }}>房量 {b.standard}</span>
                </div>
              </div>
              )})}
          </div>
        ))}
      </div>

      {/* V51批2：吸底悬浮确认条（选中即常驻可见 · 不随内容滚动消失）*/}
      <div style={{ position: 'sticky', bottom: 0, padding: '8px 20px 24px', background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
        <button
          className="btn-confirm"
          disabled={!selected}
          onClick={() => {
            if (confirmBrand) onConfirm(confirmBrand)
            else {
              const b = brandGroups.flatMap(g => g.brands.map(x => ({ ...x, level: g.level }))).find(x => x.name === selected)
              if (b) onConfirm(b)
            }
          }}
        >
          {selected ? `确认选择 ${selected}，去认领酒店 →` : '请选择一个品牌'}
        </button>
      </div>

      {feedback && <ResultFeedback result={feedback} onClose={() => setFeedback(null)} />}
    </div>
  )
}
