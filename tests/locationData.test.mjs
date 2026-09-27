// 选址数据守门（2026-09-27 选址数据任务 · fast 套件）
// 运行：node tests/locationData.test.mjs
//
// ── 为什么需要它 ────────────────────────────────────────────────
//   本轮把 26 个区位的竞品从「13 个空白 + 每家 1–3 条」补到 **121 家真实酒店**，并新增人流/经济画像。
//   同时抓到一个【死功能】：引擎里读的是 `site.district`，而前端只传 `location.attrs`、
//   服务端只传 `location`（六维散在 .attrs 里）⇒ **竞品表与客群表两边都查不到**，
//   两个教学机制（竞品压力 / 客群匹配）在真机上从未生效。
//   ⇒ 本套件把①数据纪律 ②覆盖与"未采不编造" ③district 传递链 三件事钉成常驻门禁。
import { readFileSync, readdirSync } from 'node:fs'
import { districts, COMPETITORS, LOCATION_PROFILE, NOT_SURVEYED } from '../src/siteLocations.mjs'
import { settle } from '../src/settlement.js'
import { ATTR_INIT } from '../src/attrs.js'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')
const 全部区位 = Object.values(districts).flat().map(d => d.name)

console.log('▶ 选址数据守门（竞品 + 人流/经济 + district 传递链）')

// ── [1] 数据纪律：每条竞品都必须可溯源 ─────────────────────────
console.log('\n[1] 竞品条目纪律（引擎 4 字段 + 来源/置信度/双口径）')
{
  const LEVELS = new Set(['budget', 'mid', 'upscale', 'luxury'])
  const bad = { 缺字段: [], 档次非法: [], 价格非法: [], 缺来源: [], 缺置信度: [], 双价格全空: [] }
  let 总 = 0
  for (const [loc, list] of Object.entries(COMPETITORS)) {
    for (const c of list || []) {
      总++
      if (!c.name || !Number.isFinite(c.basePrice) || !Number.isFinite(c.aggression)) bad.缺字段.push(`${loc}:${c.name}`)
      if (!LEVELS.has(c.level)) bad.档次非法.push(`${loc}:${c.name}(${c.level})`)
      if (!(c.basePrice > 0)) bad.价格非法.push(`${loc}:${c.name}=${c.basePrice}`)
      if (!c.source) bad.缺来源.push(`${loc}:${c.name}`)
      if (!c.confidence) bad.缺置信度.push(`${loc}:${c.name}`)
      if (c.priceFrom == null && c.priceAvg == null) bad.双价格全空.push(`${loc}:${c.name}`)
    }
  }
  ok(总 >= 100, `竞品总条数 ${总}（本轮实测抽样 121 家）`)
  for (const [k, v] of Object.entries(bad)) ok(v.length === 0, `无「${k}」条目`, v.slice(0, 3).join(','))
  // 来源必须是"可复核的抽样渠道"，不许出现"人工估算/大概"这类词
  const 含糊 = []
  for (const [loc, list] of Object.entries(COMPETITORS)) for (const c of list || []) if (/估算|大概|约摸|估计|推测/.test(String(c.source))) 含糊.push(`${loc}:${c.name}`)
  ok(含糊.length === 0, '来源字段无"估算/推测"类措辞（抽样必须是可复核渠道）', 含糊.slice(0, 3).join(','))
}

// ── [2] 覆盖：26/26 有竞品；未采区位不许编造画像 ────────────────
console.log('\n[2] 覆盖与"未采不编造"')
{
  const 空 = 全部区位.filter(n => !(COMPETITORS[n] || []).length)
  ok(空.length === 0, `26 个区位【全部】有竞品数据（轮前为 13 个空白）`, 空.join(','))
  const 重叠 = NOT_SURVEYED.filter(n => LOCATION_PROFILE[n])
  ok(重叠.length === 0, `未采的 ${NOT_SURVEYED.length} 个区位【不得】出现在画像表里（不编造）`, 重叠.join(','))
  ok(NOT_SURVEYED.length === 12, `未采清单 = 12（绵阳4 + 承德4 + 重庆4 · 按用户口径"简单处理"）`)
  const 精细 = Object.keys(LOCATION_PROFILE)
  ok(精细.length === 14, `画像表 = 14 个精细区位（成都 9 + 德阳 5）`)
  const 缺基本 = 精细.filter(n => !Number.isFinite(LOCATION_PROFILE[n].pop) && !Number.isFinite(LOCATION_PROFILE[n].gdp))
  ok(缺基本.length === 0, '精细区位都至少有 人口 或 GDP（否则不该算"精细采过"）', 缺基本.join(','))
  // 待补必须是 null，不许用 0/负数糊
  const 假值 = 精细.filter(n => LOCATION_PROFILE[n].tou != null && !(LOCATION_PROFILE[n].tou > 0))
  ok(假值.length === 0, '游客数"待补"一律为 null（不得用 0 或负数冒充）', 假值.join(','))
  const 待补 = 精细.filter(n => LOCATION_PROFILE[n].tou == null)
  console.log(`     待补项（预期存在，非失败）：${待补.length} 个区位无年接待游客 ⇒ ${待补.join('、')}`)
}

// ── [3] ★ district 传递链（本次死功能的回归守卫）────────────────
console.log('\n[3] district 传递链：前端传 ⇒ 引擎归一化（两端同形）')
{
  const app = src('App.jsx')
  ok(/district: location\?\.district/.test(app.replace(/\s+/g, ' ')),
    'App.jsx：结算时把 district 一起传进引擎（原写法只传 attrs ⇒ 竞品/客群永不命中）')
  const eng = src('settlement.js')
  ok(/typeof site\.attrs === 'object'/.test(eng) && /district: site\.district \|\| site\.name/.test(eng),
    'settlement.js：引擎入口归一化（有 .attrs 就摊平 + 保留 district）—— 修的是服务端"六维全落默认 3 档"')
  // 行为：两种形状必须等价（前端 {..attrs, district} vs 服务端 {attrs, district}）
  const D = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }
  const attrs = { 客流: 5, 房价: 5, 租金: 5, 竞争: 5, 人力: 4, 波动: 2 }
  const 前端形 = { ...attrs, district: '锦江区' }
  const 服务端形 = { city: '成都', district: '锦江区', attrs }
  const base = { brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }, decisions: D, week: 1, attrs: { ...ATTR_INIT } }
  const r1 = settle({ site: 前端形, ...base })
  const r2 = settle({ site: 服务端形, ...base })
  ok(JSON.stringify(r1) === JSON.stringify(r2), '两种 site 形状 ⇒ 结算输出【逐字节相同】（归一化生效）')
  // 竞品/客群真的进来了（有 district 才有）
  ok(Array.isArray(r1.competitors) && r1.competitors.length > 0, `锦江区结算带出竞品 ${r1.competitors ? r1.competitors.length : 0} 家（原为 0 ⇒ 周报竞品卡永不出现）`)
  const r无 = settle({ site: { ...attrs }, ...base })
  ok((r无.competitors || []).length === 0, '不传 district ⇒ 无竞品（说明"传 district"确实是生效条件，不是恒真）')
  // 客群：锦江区 dominant=business ⇒ 商务客分支应产出反馈；无 district ⇒ 落默认 33/33/34（dominant=undefined）
  //   ★ 这条必须能红：不是"有 feedback 就算过"，而是【两边的反馈内容不同】才算"画像真的生效"
  const 锦 = r1.personaFeedback || []
  const 空 = r无.personaFeedback || []
  ok(锦.length > 0 && 锦.some(t => /商务客/.test(t)), `锦江区（dominant=business）产出商务客反馈 ${锦.length} 条：${锦.slice(0, 2).join(' / ')}`)
  ok(JSON.stringify(锦) !== JSON.stringify(空) || 空.some(t => /商务客/.test(t)) === false,
    '带 district 与不带 district 的客群反馈【不相同】（默认档 33/33/34 vs 锦江区画像 ⇒ 画像真的进了路径）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：谁把 district 又丢了、谁往数据里塞不可溯源的值，本套件即红')
process.exit(fail ? 1 : 0)
