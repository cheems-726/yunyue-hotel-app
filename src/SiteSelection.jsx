import React, { useState } from 'react'
import ResultFeedback from './ResultFeedback.jsx'
import { districts } from './siteLocations.mjs'

// 成德绵区县选址数据（6维属性 1-5 档 + 优势/代价）
const attrLabels = { 客流:'客流', 房价:'房价', 租金:'租金', 竞争:'竞争', 人力:'人力', 波动:'波动' }

// 简易地理网格：按真实相对方位摆放（成都在西，德阳居中偏北，绵阳在东北）
const cityGeo = {
  成都: [
    { name: '都江堰市', row: 0, col: 0 }, { name: '金牛区', row: 0, col: 1 }, { name: '青羊区', row: 1, col: 1 },
    { name: '武侯区', row: 2, col: 1 }, { name: '锦江区', row: 2, col: 2 }, { name: '高新区', row: 3, col: 1 },
    { name: '双流区', row: 3, col: 0 }, { name: '龙泉驿区', row: 3, col: 2 }, { name: '简阳市', row: 3, col: 3 },
  ],
  德阳: [
    { name: '绵竹市', row: 0, col: 0 }, { name: '旌阳区', row: 1, col: 1 },
    { name: '广汉市', row: 2, col: 1 }, { name: '中江县', row: 3, col: 2 },
  ],
  绵阳: [
    { name: '江油市', row: 0, col: 0 }, { name: '游仙区', row: 1, col: 1 },
    { name: '涪城区', row: 2, col: 1 }, { name: '三台县', row: 3, col: 1 },
  ],
}
const geoTagCls = { 核心: 'tag-core', 商务: 'tag-ind', 文旅: 'tag-tour', 工业: 'tag-ind', 空港: 'tag-ind', 旅游: 'tag-tour', 潜力: 'tag-county', 城区: 'tag-ind', 科研: 'tag-ind', 县域: 'tag-county' }

export default function SiteSelection({ onConfirm }) {
  const [currentCity, setCurrentCity] = useState('成都')
  const [selected, setSelected] = useState(null) // 区县 name
  const [feedback, setFeedback] = useState(null)

  function barCls(val) {
    if (val >= 4) return 'bar-high'
    if (val >= 3) return 'bar-mid'
    return 'bar-low'
  }

  function siteResult(d) {
    return {
      title: `选址「${currentCity}·${d.name}」的结果`,
      changes: [
        { label: '客流基数', value: d.attrs.客流 + ' / 5', dir: d.attrs.客流 >= 4 ? 'up' : '' },
        { label: '房价带', value: d.attrs.房价 + ' / 5', dir: d.attrs.房价 >= 4 ? 'up' : '' },
        { label: '租金成本', value: d.attrs.租金 + ' / 5', dir: d.attrs.租金 >= 4 ? 'down' : 'up' },
        { label: '竞争激烈度', value: d.attrs.竞争 + ' / 5', dir: d.attrs.竞争 >= 4 ? 'down' : '' },
      ],
      note: `优势：${d.good}。代价：${d.warn}。`,
    }
  }

  function handleDistrictClick(d) {
    setSelected(d.name)
    setFeedback(siteResult(d))
  }

  return (
    <div className="content">
      <div className="header">
        <span className="step-tag">🏁 第一步 · 选址</span>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>选择你的酒店所在地</h1>
        <div className="sub">每个区县都有代价，选对位置决定酒店生死</div>
      </div>

      {/* 简易地图总览：按地理方位摆放区县，点芯片直接选中 */}
      <div className="card" style={{ margin: '0 20px 14px', padding: 14 }}>
        <div className="card-title" style={{ marginBottom: 10 }}>🗺️ 地图选点（按真实方位）</div>
        {['成都', '德阳', '绵阳'].map(city => (
          <div key={city} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#A96407', fontWeight: 700, marginBottom: 4 }}>{city}</div>
            <div style={{ position: 'relative', height: 44 * (Math.max(...cityGeo[city].map(p => p.row)) + 1), }}>
              {cityGeo[city].map(p => {
                const d = districts[city].find(x => x.name === p.name)
                const isSel = selected === p.name
                return (
                  <button
                    key={p.name}
                    onClick={() => { if (currentCity !== city) { setCurrentCity(city); setSelected(null) } handleDistrictClick(d) }}
                    style={{
                      position: 'absolute', left: p.col * 25 + '%', top: p.row * 44,
                      width: '23%', height: 38,
                      borderRadius: 10, border: isSel ? '2px solid #E8940F' : '1px solid #E5E7EB',
                      background: isSel ? '#FFF4E0' : '#F9FAFB',
                      cursor: 'pointer', fontFamily: 'inherit', padding: 2,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: isSel ? '#A96407' : '#374151' }}>{p.name.slice(0, -1)}</div>
                    <span className={`district-tag ${geoTagCls[d.tag] || 'tag-county'}`} style={{ fontSize: 9, padding: '1px 5px' }}>{d.tag}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        <div style={{ fontSize: 10, color: '#9CA3AF' }}>💡 位置按真实地理相对方位摆放，点芯片即选中（详细数据见下方列表）</div>
      </div>

      {/* 城市切换 */}
      <div className="city-row">
        {['成都', '德阳', '绵阳'].map(city => (
          <button
            key={city}
            className={`city-tab ${currentCity === city ? 'active' : ''}`}
            onClick={() => { setCurrentCity(city); setSelected(null) }}
          >
            {city}
          </button>
        ))}
      </div>

      {/* 区县列表 */}
      <div className="district-list">
        {districts[currentCity].map(d => (
          <div
            key={d.name}
            className={`district-card ${selected === d.name ? 'selected' : ''}`}
            onClick={() => handleDistrictClick(d)}
          >
            <div className="district-head">
              <span className="district-name">{d.name}</span>
              <span className={`district-tag ${d.tagCls}`}>{d.tag}</span>
            </div>

            {Object.entries(d.attrs).map(([k, val]) => (
              <div className="attr-row" key={k}>
                <div className="attr-label">{attrLabels[k]}</div>
                <div className="attr-bar-bg">
                  <div className={`attr-bar ${barCls(val)}`} style={{ width: `${val * 20}%` }}></div>
                </div>
                <div className="attr-val">{val}</div>
              </div>
            ))}

            <div className="cost-box good">
              <div className="cost-title">✅ 优势</div>{d.good}
            </div>
            <div className="cost-box warn">
              <div className="cost-title">⚠️ 代价</div>{d.warn}
            </div>
          </div>
        ))}
      </div>

      {/* 底部确认按钮（固定在内容底部） */}
      <div style={{ padding: '8px 20px 24px' }}>
        <button
          className="btn-confirm"
          disabled={!selected}
          onClick={() => {
            const d = districts[currentCity].find(x => x.name === selected)
            onConfirm({ city: currentCity, district: d.name, attrs: d.attrs })
          }}
        >
          {selected ? `确认选址 ${selected}，进入筹建 →` : '请选择一个区县'}
        </button>
      </div>

      {feedback && <ResultFeedback result={feedback} onClose={() => setFeedback(null)} />}
    </div>
  )
}
