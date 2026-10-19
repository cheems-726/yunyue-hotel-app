import { useState } from 'react'
import ResultFeedback from './ResultFeedback.jsx'
import { districts, CUSTOMER_PERSONAS, COMPETITORS, LOCATION_PROFILE, NOT_SURVEYED, 客群攻略, 区位消费行, 格式化消费水平 } from './siteLocations.mjs'   // ★ 修：V94 用了 区位消费行() 但漏 import（运行时 ReferenceError ⇒ 选址页崩）
import RadarChart from './RadarChart.jsx'
import GuideTip from './GuideTip.jsx'   // V66 · 首次使用引导（一次性可关 · localStorage）
import GeoMap from './GeoMap.jsx'   // V52 · 真实行政边界地图（DataV GeoJSON · 静态内置 · 芯片列表保留为回退）
import { 选址过程分 } from './processScore.mjs'   // ★ V128-#1：承诺书评分单源（学生端/教师端共用）

// 成德绵区县选址数据（6维属性 1-5 档 + 优势/代价）
const attrLabels = { 客流:'客流', 房价:'房价', 租金:'租金', 竞争:'竞争', 人力:'人力', 波动:'波动' }
// ★ §27.3-②b：**未接线**的选址维（守门 tests/consumptionCoverage.test.mjs 的登记表与这里必须一致）
// 🔴 §28.1-① 返修（2026-09-29 · D76）：**删 `'波动'`** —— 它**确实进入结算**（`settlement.js:319`
//   `volatility` → `:320 marketWave` → `:324 demandStrength` → 出租率 → 营收）。
//   ★ §29.1-补（2026-09-30 · D79-b）：此处**不写具体营收数字** —— 原手写的那两个营收数被决策端
//   穷举复算证伪（营收随路径/配置联动，手写必错）。同路径实测见 `tests/consumptionCoverage.test.mjs` [2]
//   （运行时插值 · 引擎一改自动跟新）。
//   ★ §30.1（D80-a）：按 (a) 处置 —— 引证句也改**非字面**（"那两个营收数"）⇒ src 真 0 处字面、
//   §29.1-补 的原声明成立；该值在 `tests/` 仍留存作证伪引证。
//   此前误标系**守门假阳性**所致：该守门原版只用一组配置做扰动，其基准下出租率撞 0.98 上限
//   ⇒ 凡只作用于"数量级"的维度全部看不出变化 ⇒ 被误判"零消费"。守门已改为**多配置 + 阳性对照自校准**。
// ★★ §33-V4-A8（2026-10-01）：**清空** —— 「房价」「人力」两维已接线（settlement.js：房价→priceCompetitive
//   环境乘数 ±3%/档；人力→弹性人力单价 ×±4%/档 + laborFixed ×±4%/档 + 好评率 ∓0.4pp/档）。
//   ★ 界面小标**同时**删除（卡内 §1③：接线后仍标"暂不影响结算" = 明明生效了还说没生效，同族反向假话）。
//   守门 consumptionCoverage 登记表同步清空（登记了却有消费 ⇒ 它自己会红）。
const 未接线维 = []

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
// ★ §33-V6-§1③（2026-10-02）：客群占比**显式百分比** —— 学生做决策前就要知道"这片商务 55% / 游客 30% / 家庭 15%"
//   （否则引擎侧的结构加权对他是黑箱）。占比归一化到 100%（与结算 V6 加权同一口径）。
function personaLine(city, name) {
  const per = CUSTOMER_PERSONAS[name]
  if (!per) return null
  const 和 = Math.max(0.0001, (Number(per.business) || 0) + (Number(per.tourist) || 0) + (Number(per.family) || 0))
  const pc = (v) => Math.round(((Number(v) || 0) / 和) * 100)
  return `${DOMINANT_LABEL[per.dominant] || '客群混合'} · ${per.note}（商务 ${pc(per.business)}% · 游客 ${pc(per.tourist)}% · 家庭 ${pc(per.family)}%）`
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

export default function SiteSelection({ onConfirm, onLog }) {
  const [currentCity, setCurrentCity] = useState('成都')
  const [selected, setSelected] = useState(null) // 区县 name
  const [feedback, setFeedback] = useState(null)
  const [展开竞品, set展开竞品] = useState(null)   // ★ V84：逐家竞品清单展开态（区名）
  // ★ V109-T1/T2/T4：选址「先押注 → 再揭示 → 写理由」三处插桩（纯前端 + 一条落库）
  const [预言s, set预言s] = useState({})        // { 区名: { 竞品档, 租金档, 置信度, 证据 } }
  const [预言弹, set预言弹] = useState(null)     // 待预言的区名（不填 ⇒ 数据卡不解锁 · 可证伪 RV）
  const [草稿, set草稿] = useState({ 竞品档: '', 租金档: '', 置信度: '' })
  const [承诺书, set承诺书] = useState(null)     // { 假设, 为何不是, 打脸维, 反对意见, 验尸, 时间 } —— 提交后**不可编辑**
  const [承诺弹, set承诺弹] = useState(false)
  const [承诺草稿, set承诺草稿] = useState({ 假设: '', 为何不是: '', 打脸维: '', 反对意见: '', 验尸: '' })

  // —— 真值（用于 T1 的「你的预言 vs 真值」与命中计分）——
  const 全部区 = Object.values(districts).flat()
  function 真值(name) {
    const d = 全部区.find(x => x.name === name)
    const 竞品数 = (COMPETITORS[name] || []).length
    const 排序 = 全部区.map(x => (COMPETITORS[x.name] || []).length).sort((a, b) => b - a)
    const rank = 排序.indexOf(竞品数)
    const 档 = rank < 排序.length / 3 ? '前1/3' : (rank < (排序.length * 2) / 3 ? '中1/3' : '后1/3')
    const r = d ? d.attrs.租金 : 0
    return { 竞品档: 档, 租金档: r >= 4 ? '高' : (r >= 3 ? '中' : '低'), 竞品数 }
  }
  /** T1 计分：命中率 × 置信度校准（过度自信扣分、低估也扣分）——**必须进成绩**（否则是过场） */
  function 预言分(p, name) {
    const t = 真值(name)
    const 命中 = [p.竞品档 === t.竞品档, p.租金档 === t.租金档].filter(Boolean).length / 2
    const 置信 = Number(p.置信度) / 100
    // 校准：命中率与置信度的差越小越好；差 = |命中率-置信|，扣分 = 差（过度自信与低估同罚）
    const 校准扣 = Math.abs(命中 - 置信)
    return { 命中率: Math.round(命中 * 100), 置信度: Number(p.置信度), 校准扣: Math.round(校准扣 * 100), 得分: Math.round((命中 - 校准扣 * 0.5) * 100) }
  }
  /** T2 过程分：4 项 × 0–2 · **公开评分表** · 只看"学生说了什么"（结构化信号，不看数值高低）
   *  ★ V128-#1：实现已抽到 src/processScore.mjs 的 选址过程分()（教师端台账同源） */
  const 过程分 = 选址过程分

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

  // ★ V109-T1：**先押注 → 再揭示**。没做预言 ⇒ 数据卡**解锁不了**（可证伪 RV）
  function handleDistrictClick(d) {
    if (!预言s[d.name]) { set预言弹(d.name); set草稿({ 竞品档: '', 租金档: '', 置信度: '' }); return }
    setSelected(d.name)
    setFeedback(siteResult(d))
  }

  function 提交预言() {
    if (!草稿.竞品档 || !草稿.租金档 || !草稿.置信度) return    // 三项必填
    const name = 预言弹
    const p = { ...草稿, 证据: 真值(name), 时间: new Date().toISOString() }
    set预言s(s => ({ ...s, [name]: p }))
    const d = 全部区.find(x => x.name === name)
    if (d) { setSelected(name); setFeedback(siteResult(d)) }      // 提交后**才解锁**
    onLog && onLog({ id: 'location-prediction', answer: `${name}｜竞品${p.竞品档}｜租金${p.租金档}｜把握${p.置信度}%`, feedback: `预言已记（计分：命中率×置信度校准）` })
    set预言弹(null)
  }

  function 提交承诺书() {
    const c = 承诺草稿
    if (!c.假设.trim() || !c.为何不是.trim() || !c.打脸维.trim()) return   // 前三项必填（第④项填"无"亦可）
    const 书 = { ...c, 反对意见: c.反对意见.trim() || '无', 时间: new Date().toISOString() }
    set承诺书(书)
    const d = 全部区.find(x => x.name === selected)
    const ps = 过程分(书)
    onLog && onLog({ id: 'location-commitment', answer: `${selected}｜${书.假设}`, feedback: `承诺书已签（过程分 ${ps.过程分}/${ps.满分} · 不可编辑）` })
    set承诺弹(false)
  }

  return (
    <div className="content">
      <div className="header">
        <span className="step-tag">第一步 · 选址</span>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>选择你的酒店所在地</h1>
        <div className="sub">每个区县都有代价，选对位置决定酒店生死</div>
        <GuideTip k="site">第一次来这里：先点开感兴趣的区县，看它的数据卡（客流/租金等六维与客群画像），比较两三个再点下方「确认选址」——确认后本学期不可更改。</GuideTip>
      </div>

      {/* 简易地图总览：按地理方位摆放区县，点芯片直接选中 */}
      <div className="card" style={{ margin: '0 20px 14px', padding: 14 }}>
        <div className="card-title" style={{ marginBottom: 10 }}>地图选点（按真实方位）</div>
        {/* V52 · 真实行政边界地图（增强 · 不替代芯片视图）*/}
        <GeoMap city={currentCity} districts={districts[currentCity] || []} selected={selected} onSelect={(name) => {
          const d = (districts[currentCity] || []).find(x => x.name === name)
          if (d) handleDistrictClick(d)
        }} dark={document.documentElement.style.colorScheme !== undefined} />
        {['成都', '德阳', '绵阳', '承德', '重庆'].map(city => (
          <div key={city} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--warn)', fontWeight: 700, marginBottom: 4 }}>{city}</div>
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
                      borderRadius: 10, border: isSel ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: isSel ? 'var(--warn-bg)' : 'var(--bg)',
                      cursor: 'pointer', fontFamily: 'inherit', padding: 2,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: isSel ? 'var(--warn)' : 'var(--text)' }}>{p.short || p.name.slice(0, -1)}</div>
                    <span className={`district-tag ${geoTagCls[d.tag] || 'tag-county'}`} style={{ fontSize: 12, padding: '1px 5px' }}>{d.tag}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>位置按真实地理相对方位摆放，点芯片即选中（详细数据见下方列表）</div>
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

      {/* ★ V79：客群攻略速查（常驻 · 三类客群在意什么/价格敏感度/淡旺季/怎么接 —— 决策提示只引用引擎客群路真决策值） */}
      <div className="card" style={{ margin: '0 20px 14px', padding: 14 }}>
        <div className="card-title">客群攻略速查（他们在意什么 · 怎么接）</div>
        <div style={{ fontSize: 12, lineHeight: 1.7 }}>
          {['business', 'tourist', 'family'].map(k => {
            const g = 客群攻略[k]
            return (
              <div key={k} style={{ padding: '6px 0', borderBottom: '1px solid var(--fill)' }}>
                <b style={{ color: 'var(--info)' }}>{g.名}</b>：在意 {g.在意}。价格敏感度 {g.价格敏感度}；淡旺季：{g.淡旺季}。
                <div style={{ color: 'var(--text-sub)', marginTop: 2 }}>怎么接：{g.决策提示}</div>
              </div>
            )
          })}
          <div style={{ padding: '6px 0 0', color: 'var(--text-muted)' }}>会议客：{客群攻略.meeting.在意}。{客群攻略.meeting.决策提示}（评价语料中单列 · 结算归商务客路）</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>ⓘ 攻略为教学推导（客群结构 × 波动维）；客群占比为人工分级非统计（见各区位画像行 ⓘ）</div>
      </div>

      {/* 选中区县的六维画像雷达图 */}
      {selected && (() => {
        const d = districts[currentCity].find(x => x.name === selected)
        if (!d) return null
        return (
          <div className="card" style={{ margin: '0 20px 14px', padding: 14 }}>
            <div className="card-title">{d.name} · 六维画像</div>
            <RadarChart attrs={d.attrs} />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>
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
              {/* V12批7：三个数字徽标（租金/客流/竞争 · 12px · 与六维画像同源 d.attrs · 选点不再盲选） */}
              <span style={{ display: 'inline-flex', gap: 4, marginLeft: 'auto', flexShrink: 0 }}>
                {[['租金', d.attrs['租金']], ['客流', d.attrs['客流']], ['竞争', d.attrs['竞争']]].map(([l, v]) => (
                  <span key={l} style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sub)', background: 'var(--fill)', borderRadius: 6, padding: '2px 6px', fontVariantNumeric: 'tabular-nums' }}>{l} {v}</span>
                ))}
              </span>
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
                <div className="attr-label">
                  {attrLabels[k]}
 {/* ★ 六维接线终态（V21批3 核对 2026-10-05）：客流/竞争/房价/人力/波动【全部参与结算】——
    房价→价格竞争力(settlement.js:307)·人力→好评率与人力档成本(:359/:707)·波动→市场波动幅度(:388)。
    旧「暂不影响结算」标注块已删（未接线维列表早已清空 ⇒ 该块为永不渲染的死代码 · 注释"仅剩两维"亦过期）。 */}
                </div>
                <div className="attr-bar-bg">
                  <div className={`attr-bar ${barCls(val)}`} style={{ width: `${val * 20}%` }}></div>
                </div>
                <div className="attr-val">{val}</div>
              </div>
            ))}

            <div className="cost-box good">
              <div className="cost-title">优势</div>{d.good}
            </div>
            <div className="cost-box warn">
              <div className="cost-title">代价</div>{d.warn}
            </div>
            {/* ★ V73：客群画像缺失不再静默消失（原 personaLine null ⇒ 整行不见，学生看不出缺）⇒ 显式待补 */}
            {(() => {
              const pl = personaLine(currentCity, d.name)
              if (pl) {
                // ★ V79：价格敏感度 + 淡旺季偏好（推导自已入库的客群结构 × 波动维 —— 同类锚口径，非新造数据）
                const per = CUSTOMER_PERSONAS[d.name]
                const 攻 = 客群攻略[per && per.dominant]
                const 波 = d.attrs['波动'] || 3
                const 淡旺季 = 波 >= 4 ? `淡旺季分化大（波动 ${波}/5：旺季爆满·淡季空置）` : 波 === 3 ? '季节波动中等（波动 3/5）' : `全年客流平稳（波动 ${波}/5）`
                return (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--info)', background: 'var(--primary-bg)', borderRadius: 6, padding: '4px 8px', lineHeight: 1.5 }}>
                  客群画像：{pl}
                  <span title={PERSONA_SOURCE_TIP} style={{ cursor: 'help', marginLeft: 4, color: 'var(--text-sub)' }}>ⓘ</span>
                  <div style={{ color: 'var(--text-sub)', marginTop: 2 }}>
                    价格敏感度：{攻 ? 攻.价格敏感度 : '待补'} ｜ 淡旺季：{淡旺季}
                  </div>
                </div>
                )
              }
              return (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg)', borderRadius: 6, padding: '4px 8px' }}>
                  客群画像：待补（本区位未采客群结构 —— 不编造；结算按三路均分兜底）
                </div>
              )
            })()}
            {LOCATION_PROFILE[d.name]?.businessDensity && (() => {
              const bd = LOCATION_PROFILE[d.name].businessDensity
              const parts = [bd.stock, bd.vacancy && `空置率 ${bd.vacancy}`, bd.rent, bd.desc].filter(Boolean)
              return (
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-sub)', background: 'var(--fill)', borderRadius: 6, padding: '4px 8px', lineHeight: 1.5 }}>
                  商业密度：{parts.join(' · ')}
                  <span title={`来源：${bd.src}（可信度 ${bd.conf}）`} style={{ cursor: 'help', marginLeft: 4, color: 'var(--text-muted)' }}>ⓘ</span>
                </div>
              )
            })()}
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--warn)' }}>
 推荐档次：{(() => {
                // ★ V73：文案口径与等级限制（BrandSelection maxTier / src/tierLimit.mjs）对齐 ——
                //   限制只看客流档（≤2⇒仅经济 · 3⇒经济～中端 · ≥4⇒全档），租金只作提示不再改变"能开什么"
                const flow = d.attrs['客流'] || 3
                const rent = d.attrs['租金'] || 3
                if (flow <= 2) return '仅经济型（中端及以上受等级限制锁档）'
                if (flow === 3) return '经济型～中端型（中高端及以上受等级限制锁档）'
                return rent >= 4 ? '全档次开放（租金压力高，开高档先算回本）' : '全档次开放（留意波动档与淡季空置）'
              })()}
            </div>

 {/* 2026-09-27 选址数据任务：周边竞品（选之前就能对比"这一片有哪些店、什么价位、什么档次"） */}
            {(() => {
              const c = competitorSummary(d.name)
              if (c.empty) return (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg)', borderRadius: 6, padding: '4px 8px' }}>
                  {c.text}
                </div>
              )
              return (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text)', background: 'var(--bg)', borderRadius: 6, padding: '5px 8px', lineHeight: 1.6 }}>
                  <b>周边竞品 {c.list.length} 家</b> · 价位带 <b>{c.价位带}</b> · {c.mix}
                  <div style={{ color: 'var(--text-sub)', marginTop: 2 }}>
                    {c.list.slice(0, 3).map(x => `${x.name}（${LEVEL_LABEL[x.level] || x.level} ¥${x.basePrice}${x.priceBasis === 'avg' ? '均' : '起'}）`).join(' · ')}
                    {c.list.length > 3 ? ` 等 ${c.list.length} 家` : ''}
                  </div>
                  {/* ★ V84：逐家可见（展开 = 全部家数逐家列出 · 渲染条数=数据家数由 v84Compete 断言） */}
                  <button
                    onClick={e => { e.stopPropagation(); set展开竞品(展开竞品 === d.name ? null : d.name) }}
                    style={{ marginTop: 4, fontSize: 12, padding: '2px 8px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--border)', background: 'var(--primary-bg)', color: 'var(--info)' }}
                  >{展开竞品 === d.name ? '收起逐家清单' : `展开全部 ${c.list.length} 家（逐家名称/档次/价格）`}</button>
                  {展开竞品 === d.name && (
                    <div style={{ marginTop: 4, borderTop: '1px dashed var(--border)', paddingTop: 4 }}>
                      {c.list.map((x, i) => (
                        <div key={x.name} data-v84-compete="1" style={{ padding: '2px 0', color: 'var(--text-sub)' }}>
                          {i + 1}. {x.name}（{LEVEL_LABEL[x.level] || x.level}）· ¥{x.basePrice}{x.priceBasis === 'avg' ? '均' : '起'} · 客房 {x.rooms} 间 · {x.opened} 年开业
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>来源：{c.来源}</div>
                </div>
              )
            })()}

 {/* 人流 / 经济（成都+德阳 14 区位为统计实测；其余 12 区按口径显式"待补"） */}
            {(() => {
              const p = profileRows(d.name)
              if (!p) return (
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg)', borderRadius: 6, padding: '4px 8px' }}>
                  人流 / 经济：<b>待补</b>（本区位未采统计口径 —— 不编造）
                </div>
              )
              return (
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text)', background: 'var(--bg)', borderRadius: 6, padding: '5px 8px', lineHeight: 1.6 }}>
                  <b>人流</b>：常住 {fmt万(p.pop)} · 年接待游客 {p.tou != null ? fmt万(p.tou) : '待补'}
                  <div style={{ color: 'var(--text-sub)' }}>{p.traffic}</div>
                  <b>经济</b>：GDP {p.gdp} 亿元（{p.gdpy}）
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                    来源：{p.src} · 置信度 {p.conf === 'high' ? '高' : p.conf === 'mid' ? '中' : '低'}
                  </div>
                </div>
              )
            })()}
            {/* ★ V94 消费水平（数据源=siteLocations 的 社零/人均可支配 结构位 · 文案由 区位消费行() 单源生成）*/}
            {(() => {
              const c = 区位消费行(d.name)
              if (!c.有值) return (
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg)', borderRadius: 6, padding: '6px 8px' }}>
                  消费水平：{c.待补文本}
                </div>
              )
              return (
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text)', background: 'var(--bg)', borderRadius: 6, padding: '6px 8px' }}>
                  {c.收入文本 || ''}{c.收入文本 && c.社零文本 ? ' · ' : ''}{c.社零文本 || ''}
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                    来源：{c.来源串} · 取数 {c.取数} · 置信度 {c.置信度 === 'high' ? '高' : c.置信度 === 'mid' ? '中' : '低'}
                  </div>
                </div>
              )
            })()}
          </div>
        ))}
      </div>

      {/* ★ V109-T2：承诺书（不可逆 + 结构化理由）—— **不写承诺书 ⇒「确认选址」点不动**（可证伪 RV） */}
      {selected && (() => {
        const 真 = 真值(selected); const p = 预言s[selected]; const ps = 承诺书 ? 过程分(承诺书) : null
        return (
          <div className="card" style={{ margin: '0 20px 6px', padding: 14 }}>
            <div className="card-title">选址承诺书（签署后不可编辑 · 确认后本学期不可改）</div>
            {p && (() => { const sc = 预言分(p, selected); return (
              <div style={{ fontSize: 12, background: 'var(--bg)', borderRadius: 6, padding: '6px 8px', marginBottom: 8 }}>
                <b>你的预言 vs 真值</b>：竞品密度 你押「{p.竞品档}」/ 真值「{真.竞品档}」{p.竞品档 === 真.竞品档 ? ' ✓' : ' ✗'} · 租金 你押「{p.租金档}」/ 真值「{真.租金档}」{p.租金档 === 真.租金档 ? ' ✓' : ' ✗'}
                <div style={{ color: 'var(--text-sub)', marginTop: 2 }}>预言分 **{sc.得分}**（命中率 {sc.命中率}% · 置信度 {sc.置信度}% · 校准扣 {sc.校准扣} —— 过度自信与低估同罚）</div>
              </div>
            ) })()}
            {!承诺书 ? (
              <button className="btn" style={{ width: '100%', padding: '10px 0' }} disabled={!p}
                onClick={() => { set承诺草稿({ 假设: '', 为何不是: '', 打脸维: '', 反对意见: '', 验尸: '' }); set承诺弹(true) }}>
                {p ? '写承诺书（4 项必填）→' : '先完成「选址前预言」才能写承诺书'}
              </button>
            ) : (
              <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                <div>① 客群假设：{承诺书.假设}</div>
                <div>② 为什么不是另外两个区：{承诺书.为何不是}</div>
                <div>③ 最易被打脸的一维：{承诺书.打脸维}</div>
                <div>④ 未被采纳的反对意见：{承诺书.反对意见}</div>
                <div>⑤ 事前验尸：{承诺书.验尸 || '（未填）'}</div>
                <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>签署 {new Date(承诺书.时间).toLocaleString()} · **不可编辑**</div>
                <div style={{ marginTop: 6, fontWeight: 700 }}>过程分 {ps.过程分}/{ps.满分}（公开评分表 · **与结果分是两条独立曲线，不求和不加权**）</div>
                {ps.四项.map(x => <div key={x.名} style={{ color: 'var(--text-sub)' }}>· {x.名}：{x.分}/2（{x.据}）</div>)}
              </div>
            )}
          </div>
        )
      })()}

      {/* 底部确认按钮（固定在内容底部） */}
      <div style={{ padding: '8px 20px 24px' }}>
        <button
          className="btn-confirm"
          disabled={!selected || !承诺书}
          onClick={() => {
            const d = districts[currentCity].find(x => x.name === selected)
            onConfirm({ city: currentCity, district: d.name, attrs: d.attrs, 承诺书, 预言: 预言s[selected] })
          }}
        >
          {!selected ? '请选择一个区县' : (!承诺书 ? '写完承诺书后才能确认选址' : `确认选址 ${selected}，进入选品牌 →`)}
        </button>
        {/* V54批2 缺口3：不可逆预告（S1 选定后无反悔入口属设计 · 界面须提前说明） */}
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>选址确认后本学期不可更改（不设反悔入口——真实加盟选址同样不可逆，确认前想清楚）</div>
      </div>

      {/* ★ V109-T1：选址前「预言」弹窗 —— **不填 ⇒ 数据卡解锁不了**（反例 RV） */}
      {预言弹 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
          <div className="card" style={{ width: 'min(94vw, 420px)', padding: 16, background: 'var(--card)' }}>
            <div className="card-title">选址前预言 · {预言弹}</div>
            <div style={{ fontSize: 12, color: 'var(--text-sub)', margin: '6px 0 12px' }}>**先押注，再看数据** —— 提交三项预言后才解锁该区的六维数据卡。</div>
            {[['该区竞品密度在 24 区里排第几', '竞品档', ['前1/3', '中1/3', '后1/3']],
              ['该区租金档次', '租金档', ['高', '中', '低']],
              ['你对自己判断的把握', '置信度', ['50', '70', '90']]].map(([label, key, opts]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, marginBottom: 5 }}>{label}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {opts.map(o => (
                    <button key={o} className={`btn ${草稿[key] === o ? '' : 'btn-ghost'}`} style={{ flex: 1, padding: '9px 0', fontSize: 12 }}
                      onClick={() => set草稿(s => ({ ...s, [key]: o }))}>{o}{key === '置信度' ? '%' : ''}</button>
                  ))}
                </div>
              </div>
            ))}
            <button className="btn-confirm" style={{ width: '100%' }} disabled={!草稿.竞品档 || !草稿.租金档 || !草稿.置信度} onClick={提交预言}>提交预言并解锁数据卡 →</button>
          </div>
        </div>
      )}

      {/* ★ V109-T2/T4：承诺书弹窗（4 项必填 + 事前验尸） */}
      {承诺弹 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16, overflowY: 'auto' }}>
          <div className="card" style={{ width: 'min(94vw, 460px)', padding: 16, background: 'var(--card)', maxHeight: '88vh', overflowY: 'auto' }}>
            <div className="card-title">选址承诺书 · {selected}（签署后不可编辑）</div>
            {[['① 我们赌哪条客群假设（≤50 字，写清可测指标）', '假设', 50],
              ['② 为什么**不是**另外两个备选区（须点名那两个区）', '为何不是', 120],
              ['③ 我们最容易被哪一维数据打脸（选一维 + 一句话）', '打脸维', 80],
              ['④ 本组未被采纳的反对意见（没有就填「无」）', '反对意见', 80]].map(([label, key, max]) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, marginBottom: 4 }}>{label}</div>
                <textarea value={承诺草稿[key]} maxLength={max} rows={2}
                  onChange={e => set承诺草稿(s => ({ ...s, [key]: e.target.value }))}
                  style={{ width: '100%', fontSize: 12, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', resize: 'vertical' }} />
              </div>
            ))}
            {承诺草稿.反对意见.trim() === '无' && (
              <div style={{ fontSize: 12, color: 'var(--warn)', marginBottom: 8 }}>⚠ 填「无」：请先自问 —— **本组是否存在群体思维**？（最少指导式教学会让高职学生空转，老师会在 2 分钟内点破）</div>
            )}
            <div style={{ fontSize: 12, marginBottom: 4 }}>⑤ 事前验尸（**必填**）：假设 12 周后这个区**已经失败**，写 3 条最可能死因</div>
            <textarea value={承诺草稿.验尸} rows={3} onChange={e => set承诺草稿(s => ({ ...s, 验尸: e.target.value }))}
              style={{ width: '100%', fontSize: 12, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', resize: 'vertical' }} />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 10px' }}>过程分只看这四项结构化信号（引用维度数 / 点名两个备选区 / 反向证据 / 可验证假设）；事前验尸只作**参与度信号**，不单独决定成绩（关键词可比对 ⇒ 可作弊）。</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => set承诺弹(false)}>取消</button>
              <button className="btn-confirm" style={{ flex: 2 }} disabled={!承诺草稿.假设.trim() || !承诺草稿.为何不是.trim() || !承诺草稿.打脸维.trim() || !承诺草稿.验尸.trim()} onClick={提交承诺书}>签署承诺书（不可编辑）</button>
            </div>
          </div>
        </div>
      )}

      {feedback && <ResultFeedback result={feedback} onClose={() => setFeedback(null)} />}
    </div>
  )
}
