import { useState } from 'react'
import ResultFeedback from './ResultFeedback.jsx'
import { districts, CUSTOMER_PERSONAS, COMPETITORS, LOCATION_PROFILE, NOT_SURVEYED } from './siteLocations.mjs'
import RadarChart from './RadarChart.jsx'

// 成德绵区县选址数据（6维属性 1-5 档 + 优势/代价）
const attrLabels = { 客流:'客流', 房价:'房价', 租金:'租金', 竞争:'竞争', 人力:'人力', 波动:'波动' }

// 🔴 T1.4/B5：数据来源分级 —— siteLocations 的 confidence 字段此前【全项目无人读取、界面看不到】，
//    本处把它显式化，让学生能分辨"有公开来源的数字"与"人工分级"。
//    语义（据《数据层盘点与补全清单》§confidence 三级分布推断）：
//      green  = 有公开来源 + 带具体数字（可溯源统计）
//      yellow = 部分来源支撑
//      red    = 定性描述，人工分级，非统计数据
const CONFIDENCE_BADGE = {
  green:  { text: '有据可查', cls: 'tag-tour', title: '该区县数据有公开来源支撑（含具体数字，可课堂引用）' },
  yellow: { text: '部分有据', cls: 'tag-county', title: '部分数据有公开来源支撑' },
  red:    { text: '人工分级', cls: 'tag-ind', title: '人工分级，非统计数据（定性判断，无公开来源）' },
}
const PERSONA_SOURCE_TIP = '人工分级，非统计数据 —— 客群占比按区县典型结构人工估算，非统计口径'

// ── 🔴 2026-09-27 选址数据任务：竞品 + 人流 + 经济（学生选之前就要能对比）──────────
//   数据源：COMPETITORS/LOCATION_PROFILE（5-参考资料/选址竞品-OTA实测数据-20260927.md ·
//   选址人流经济-统计实测-20260927.md）。全部带来源与抓取日；**没采到的显式标"待补"，不编造**。
const LEVEL_LABEL = { budget: '经济', mid: '中端', upscale: '中高端', luxury: '高端' }
const LEVEL_CLS = { budget: 'tag-county', mid: 'tag-ind', upscale: 'tag-tour', luxury: 'tag-core' }
const fmt万 = (x) => (x >= 10000 ? (x / 10000).toFixed(2) + ' 亿' : Number(x).toLocaleString('zh-CN') + ' 万')

function competitorSummary(name) {
  const list = COMPETITORS[name] || []
  if (!list.length) return { text: '竞品资料待补（本区位暂无竞品建模）', empty: true }
  const prices = list.map(c => (c.priceBasis === 'from' ? c.basePrice : (c.priceAvg || c.basePrice))).filter(Number.isFinite)
  const byLevel = {}
  list.forEach(c => { byLevel[c.level] = (byLevel[c.level] || 0) + 1 })
  const mix = Object.entries(byLevel).map(([k, v]) => `${LEVEL_LABEL[k] || k} ${v}`).join(' · ')
  return {
    list, prices, mix, empty: false,
    价位带: prices.length ? `¥${Math.min(...prices)}–${Math.max(...prices)}` : '价格待补',
    来源: list[0].source || 'OTA 抽样',
  }
}

function profileRows(name) {
  if (NOT_SURVEYED.includes(name)) return null   // 12 区按用户口径"简单处理" ⇒ 显式待补
  const p = LOCATION_PROFILE[name]
  if (!p) return null
  return p
}

// 客群主特性一句话（hover/列表行共用）
const DOMINANT_LABEL = { business: '商务客为主', tourist: '游客为主', family: '家庭客为主' }
function personaLine(city, name) {
  const per = CUSTOMER_PERSONAS[name]
  if (!per) return null
  return `${DOMINANT_LABEL[per.dominant] || '客群混合'} · ${per.note}（商${per.business}/游${per.tourist}/家${per.family}）`
}

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
  承德: [
    { name: '围场满族蒙古族自治县', short: '围场草原', row: 0, col: 0 },
    { name: '双滦区', short: '双滦', row: 1, col: 0 }, { name: '双桥区', short: '双桥', row: 1, col: 1 },
    { name: '承德县', row: 2, col: 2 },
  ],
  重庆: [
    { name: '观音桥商圈', short: '观音桥', row: 0, col: 1 },
    { name: '沙坪坝区', short: '沙坪坝', row: 1, col: 0 }, { name: '解放碑商圈', short: '解放碑', row: 1, col: 1 },
    { name: '南滨路', row: 2, col: 1 },
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
      attrs: d.attrs,
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
        {['成都', '德阳', '绵阳', '承德', '重庆'].map(city => (
          <div key={city} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#A96407', fontWeight: 700, marginBottom: 4 }}>{city}</div>
            <div style={{ position: 'relative', height: 44 * (Math.max(...cityGeo[city].map(p => p.row)) + 1), }}>
              {cityGeo[city].map(p => {
                const d = districts[city].find(x => x.name === p.name)
                const isSel = selected === p.name
                return (
                  <button
                    key={p.name}
                    title={personaLine(city, p.name) || undefined}
                    onClick={() => { if (currentCity !== city) { setCurrentCity(city); setSelected(null) } handleDistrictClick(d) }}
                    style={{
                      position: 'absolute', left: p.col * 25 + '%', top: p.row * 44,
                      width: '23%', height: 38,
                      borderRadius: 10, border: isSel ? '2px solid #E8940F' : '1px solid #E5E7EB',
                      background: isSel ? '#FFF4E0' : '#F9FAFB',
                      cursor: 'pointer', fontFamily: 'inherit', padding: 2,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: isSel ? '#A96407' : '#374151' }}>{p.short || p.name.slice(0, -1)}</div>
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
        {['成都', '德阳', '绵阳', '承德', '重庆'].map(city => (
          <button
            key={city}
            className={`city-tab ${currentCity === city ? 'active' : ''}`}
            onClick={() => { setCurrentCity(city); setSelected(null) }}
          >
            {city}
          </button>
        ))}
      </div>

      {/* 选中区县的六维画像雷达图 */}
      {selected && (() => {
        const d = districts[currentCity].find(x => x.name === selected)
        if (!d) return null
        return (
          <div className="card" style={{ margin: '0 20px 14px', padding: 14 }}>
            <div className="card-title">📊 {d.name} · 六维画像</div>
            <RadarChart attrs={d.attrs} />
            <div style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginTop: 4 }}>
              满分5档 · 面积越大市场越好，但租金/竞争也意味着更高代价
            </div>
          </div>
        )
      })()}

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
              {(() => {
                const cb = CONFIDENCE_BADGE[d.confidence]
                if (!cb) return null
                return (
                  <span className={`district-tag ${cb.cls}`} title={cb.title}
                    style={{ opacity: 0.85, marginLeft: 4 }}>{cb.text}</span>
                )
              })()}
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
            {personaLine(currentCity, d.name) && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#1E40AF', background: '#EFF6FF', borderRadius: 6, padding: '4px 8px', lineHeight: 1.5 }}>
                👥 客群画像：{personaLine(currentCity, d.name)}
                <span title={PERSONA_SOURCE_TIP} style={{ cursor: 'help', marginLeft: 4, color: '#6B7280' }}>ⓘ</span>
              </div>
            )}
            <div style={{ marginTop: 6, fontSize: 11, color: '#A96407' }}>
              💡 推荐档次：{(() => {
                const flow = d.attrs['客流'] || 3
                const rent = d.attrs['租金'] || 3
                if (flow >= 4 && rent >= 3) return '中端型及以上'
                if (flow >= 3 && rent <= 2) return '经济型～中端型'
                if (flow <= 2 && rent <= 2) return '仅经济型（高端必亏）'
                return '经济型～中端型'
              })()}
            </div>

            {/* 🔴 2026-09-27 选址数据任务：周边竞品（选之前就能对比"这一片有哪些店、什么价位、什么档次"） */}
            {(() => {
              const c = competitorSummary(d.name)
              if (c.empty) return (
                <div style={{ marginTop: 6, fontSize: 11, color: '#9CA3AF', background: '#F9FAFB', borderRadius: 6, padding: '4px 8px' }}>
                  🏢 {c.text}
                </div>
              )
              return (
                <div style={{ marginTop: 6, fontSize: 11, color: '#374151', background: '#F9FAFB', borderRadius: 6, padding: '5px 8px', lineHeight: 1.6 }}>
                  🏢 <b>周边竞品 {c.list.length} 家</b> · 价位带 <b>{c.价位带}</b> · {c.mix}
                  <div style={{ color: '#6B7280', marginTop: 2 }}>
                    {c.list.slice(0, 3).map(x => `${x.name}（${LEVEL_LABEL[x.level] || x.level} ¥${x.basePrice}${x.priceBasis === 'avg' ? '均' : '起'}）`).join(' · ')}
                    {c.list.length > 3 ? ` 等 ${c.list.length} 家` : ''}
                  </div>
                  <div style={{ color: '#9CA3AF', fontSize: 10, marginTop: 2 }}>来源：{c.来源}</div>
                </div>
              )
            })()}

            {/* 🔴 人流 / 经济（成都+德阳 14 区位为统计实测；其余 12 区按口径显式"待补"） */}
            {(() => {
              const p = profileRows(d.name)
              if (!p) return (
                <div style={{ marginTop: 4, fontSize: 11, color: '#9CA3AF', background: '#F9FAFB', borderRadius: 6, padding: '4px 8px' }}>
                  👥 人流 / 💰 经济：<b>待补</b>（本区位未采统计口径 —— 不编造）
                </div>
              )
              return (
                <div style={{ marginTop: 4, fontSize: 11, color: '#374151', background: '#F9FAFB', borderRadius: 6, padding: '5px 8px', lineHeight: 1.6 }}>
                  👥 <b>人流</b>：常住 {fmt万(p.pop)} · 年接待游客 {p.tou != null ? fmt万(p.tou) : '待补'}
                  <div style={{ color: '#6B7280' }}>{p.traffic}</div>
                  💰 <b>经济</b>：GDP {p.gdp} 亿元（{p.gdpy}）
                  <div style={{ color: '#9CA3AF', fontSize: 10, marginTop: 2 }}>
                    来源：{p.src} · 置信度 {p.conf === 'high' ? '高' : p.conf === 'mid' ? '中' : '低'}
                  </div>
                </div>
              )
            })()}
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
