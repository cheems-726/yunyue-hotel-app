import React, { useState } from 'react'
import ResultFeedback from './ResultFeedback.jsx'

// 华住全部品牌（按档次分组，含加盟费/造价/房价带）
const brandGroups = [
  {
    level: '经济型 · 国民',
    brands: [
      { name: '汉庭', icon: '🏨', fee: '2800元/间(≥18万)', cost: '6.77万/间', price: '180-280元', standard: '客房70间起', desc: '华住旗舰经济型，干净便捷性价比高，全球单一品牌客房数第二。' },
      { name: '你好', icon: '👋', fee: '约2000元/间', cost: '5-6万/间', price: '150-220元', standard: '客房60间起', desc: '国民新品牌，聚焦下沉市场，简约实用。' },
      { name: '海友', icon: '🌊', fee: '约2000元/间', cost: '5-6万/间', price: '120-180元', standard: '客房50间起', desc: '超经济型，极致性价比。' },
      { name: '宜必思', icon: '🇫🇷', fee: '约2500元/间', cost: '6-7万/间', price: '160-240元', standard: '客房60间起', desc: '国际经济型品牌，年轻活力、标准化服务。' },
    ]
  },
  {
    level: '中档',
    brands: [
      { name: '全季', icon: '🏮', fee: '约4000元/间', cost: '8-10万/间', price: '280-400元', standard: '客房80间起', desc: '华住主力中档，东方人文、极简设计、好而不贵。' },
      { name: '桔子', icon: '🍊', fee: '约4000元/间', cost: '8-10万/间', price: '260-380元', standard: '客房70间起', desc: '中档精品，时尚设计，年轻客群。' },
      { name: '星程', icon: '⭐', fee: '约3500元/间', cost: '7-9万/间', price: '240-350元', standard: '客房70间起', desc: '中档连锁，商务休闲兼顾。' },
      { name: '漫心', icon: '🌸', fee: '约4000元/间', cost: '8-10万/间', price: '300-420元', standard: '客房70间起', desc: '中档精品，人文艺术风格。' },
    ]
  },
  {
    level: '精选 · 中高档',
    brands: [
      { name: '桔子水晶', icon: '💎', fee: '约6000元/间', cost: '12-15万/间', price: '400-600元', standard: '客房80间起', desc: '桔子升级版，更高品质设计。' },
      { name: '全季大观', icon: '🏛️', fee: '约5000元/间', cost: '10-13万/间', price: '400-550元', standard: '客房80间起', desc: '全季升级版，更高端中档。' },
      { name: '城际', icon: '🚄', fee: '约5000元/间', cost: '10-13万/间', price: '380-520元', standard: '客房80间起', desc: '交通枢纽型中高端。' },
      { name: '美居', icon: '🏰', fee: '约5000元/间', cost: '10-13万/间', price: '380-520元', standard: '客房80间起', desc: '雅高系中高端，法式优雅。' },
      { name: '美仑', icon: '🏙️', fee: '约5000元/间', cost: '10-13万/间', price: '380-520元', standard: '客房80间起', desc: '中高端商务品牌。' },
    ]
  },
  {
    level: '高档',
    brands: [
      { name: '禧玥', icon: '🏯', fee: '洽谈', cost: '20万+/间', price: '600-1000元', standard: '客房60间起', desc: '华住高端，东方雅致生活。' },
      { name: '花间堂', icon: '🏡', fee: '洽谈', cost: '18万+/间', price: '500-900元', standard: '客房50间起', desc: '度假型高端，人文度假。' },
      { name: '施柏阁', icon: '🏰', fee: '洽谈', cost: '20万+/间', price: '600-1000元', standard: '客房60间起', desc: '德系高端，德意志传统。' },
      { name: '诺富特', icon: '🏨', fee: '洽谈', cost: '18万+/间', price: '500-900元', standard: '客房70间起', desc: '国际高端商务品牌。' },
    ]
  },
  {
    level: '奢华',
    brands: [
      { name: '宋品', icon: '👑', fee: '洽谈', cost: '30万+/间', price: '1000-2000元', standard: '客房50间起', desc: '华住奢华，东方奢华。' },
      { name: '施柏阁大观', icon: '🏆', fee: '洽谈', cost: '30万+/间', price: '1200-2500元', standard: '客房50间起', desc: '施柏阁顶级，极致奢华。' },
    ]
  },
]

export default function BrandSelection({ onConfirm }) {
  const [selected, setSelected] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [confirmBrand, setConfirmBrand] = useState(null) // 含 level 的完整品牌对象

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

  function handleBrandClick(b, level) {
    const brand = { ...b, level }
    setSelected(b.name)
    setFeedback(brandResult(brand))
    setConfirmBrand(brand)
  }

  return (
    <div className="content">
      <div className="header">
        <span className="step-tag">🏷️ 第二步 · 选品牌</span>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>选择你的酒店品牌</h1>
        <div className="sub">品牌决定物业标准、加盟费用、房价带</div>
      </div>

      <div style={{ fontSize: 11, color: '#9CA3AF', padding: '0 20px', marginBottom: 12 }}>
        华住全品牌 · 共 {brandGroups.reduce((s, g) => s + g.brands.length, 0)} 个，点击选择
      </div>

      <div className="district-list">
        {brandGroups.map(g => (
          <div key={g.level} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#A96407', marginBottom: 8, padding: '0 4px' }}>{g.level}</div>
            {g.brands.map(b => (
              <div
                key={b.name}
                className={`district-card ${selected === b.name ? 'selected' : ''}`}
                onClick={() => handleBrandClick(b, g.level)}
                style={{ marginBottom: 8, padding: 12 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{b.icon} {b.name}</span>
                </div>
                <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, marginTop: 4 }}>{b.desc}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                  <span style={{ fontSize: 10, padding: '3px 7px', background: '#F9FAFB', borderRadius: 5 }}>💰 {b.fee}</span>
                  <span style={{ fontSize: 10, padding: '3px 7px', background: '#F9FAFB', borderRadius: 5 }}>🏗️ {b.cost}</span>
                  <span style={{ fontSize: 10, padding: '3px 7px', background: '#F9FAFB', borderRadius: 5 }}>💵 {b.price}</span>
                  <span style={{ fontSize: 10, padding: '3px 7px', background: '#F9FAFB', borderRadius: 5 }}>📋 {b.standard}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 20px 24px' }}>
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
