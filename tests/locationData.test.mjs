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
import { districts, COMPETITORS, LOCATION_PROFILE, NOT_SURVEYED, CUSTOMER_PERSONAS } from '../src/siteLocations.mjs'
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
  // 🔴 2026-09-28（N-9）：12 区画像已回填 ⇒ 未采清单清空、画像表 26/26（判据随数据面升级，非降级）
  ok(NOT_SURVEYED.length === 0, `未采清单已清空（12 区于 N-9 回填；名单机制保留）`)
  const 精细 = Object.keys(LOCATION_PROFILE)
  ok(精细.length === 26, `画像表覆盖全部 26 区位（成都9+德阳5 精细 + N-9 回填 12 区）`)
  const 缺基本 = 精细.filter(n => !Number.isFinite(LOCATION_PROFILE[n].pop) && !Number.isFinite(LOCATION_PROFILE[n].gdp))
  ok(缺基本.length === 0, '精细区位都至少有 人口 或 GDP（否则不该算"精细采过"）', 缺基本.join(','))
  // 待补必须是 null，不许用 0/负数糊
  const 假值 = 精细.filter(n => LOCATION_PROFILE[n].tou != null && !(LOCATION_PROFILE[n].tou > 0))
  ok(假值.length === 0, '游客数"待补"一律为 null（不得用 0 或负数冒充）', 假值.join(','))
  const 待补 = 精细.filter(n => LOCATION_PROFILE[n].tou == null)
  // ★ N-9 追加：待补区必须有"为什么待补"的注（touNote），不许静默 null
  const 静默 = 待补.filter(n => !LOCATION_PROFILE[n].touNote)
  ok(静默.length === 0, `游客数待补的区位都带"原因注"（touNote）—— 不静默 null`, 静默.join(','))
  console.log(`     待补项（预期存在，非失败）：${待补.length} 个区位无年接待游客 ⇒ ${待补.join('、')}`)
}

// ── [2b] ★ V73（2026-10-08）：客群画像 26/26 全覆盖 + 数据纪律 + UI 诚实空态 ──
//   轮前 22/26（绵阳 4 区缺）⇒ 引擎落均衡兜底 + 选址卡「客群画像」整行静默消失（审计 P0-2）。
console.log('\n[2b] 客群画像覆盖与纪律（V73 补齐 · 防回归）')
{
  const 画像缺 = 全部区位.filter(n => !CUSTOMER_PERSONAS[n])
  ok(画像缺.length === 0, `客群画像覆盖全部 ${全部区位.length} 区位（V73 轮前 22/26 · 绵阳 4 区缺）`, 画像缺.join(','))
  const 孤儿 = Object.keys(CUSTOMER_PERSONAS).filter(n => !全部区位.includes(n))
  ok(孤儿.length === 0, '客群画像无孤儿键（画像有、区位表无 ⇒ 键名打错就红）', 孤儿.join(','))
  const DOMS = new Set(['business', 'tourist', 'family'])
  const bad = { 占比和不100: [], dominant非法: [], 缺note: [], 越界: [] }
  for (const [n, p] of Object.entries(CUSTOMER_PERSONAS)) {
    const 和 = (Number(p.business) || 0) + (Number(p.tourist) || 0) + (Number(p.family) || 0)
    if (Math.round(和) !== 100) bad['占比和不100'].push(`${n}=${和}`)
    if (!DOMS.has(p.dominant)) bad.dominant非法.push(n)
    if (!p.note) bad.缺note.push(n)
    for (const k of ['business', 'tourist', 'family']) if (!(Number(p[k]) >= 0 && Number(p[k]) <= 100)) bad.越界.push(`${n}.${k}`)
  }
  for (const [k, v] of Object.entries(bad)) ok(v.length === 0, `画像纪律：无「${k}」`, v.slice(0, 3).join(','))
  // UI 诚实空态：画像查不到时选址卡必须显式"待补"，不许静默消失（V73 前 personaLine null ⇒ 整行不见）
  const ss = src('SiteSelection.jsx')
  ok(/客群画像：待补/.test(ss), 'UI 诚实空态：客群画像缺失 ⇒ 显式「待补」行（不许静默消失）')
  // 机制生效（V73 主目的）：轮前走均衡兜底的绵阳 4 区，现在真的产出主力客群反馈（不只"数据在表里"）
  {
    const { settle } = await import('../src/settlement.js')
    const D = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }
    const base = { brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }, decisions: D, week: 1, attrs: { ...ATTR_INIT } }
    const 涪 = settle({ site: { 客流: 3, 房价: 3, 租金: 3, 竞争: 2, 人力: 2, 波动: 2, district: '涪城区' }, ...base })
    ok((涪.personaFeedback || []).length > 0 && !涪.personaFeedback.some(t => t.includes('均衡')),
      `机制生效：涪城区（V73 轮前=均衡兜底）现产出主力客群反馈 ${(涪.personaFeedback || []).length} 条`, JSON.stringify(涪.personaFeedback))
  }
  // 引擎兜底仍在（未来新增区位未采画像时行为可预期）：[3] 的「无 district」用例已覆盖均衡兜底路径
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
  // ── ★ N-7（BL-15「机制存在 ≠ 机制生效」）：断言机制【真的改变结算】，而不只是"数据被带出来了" ──
  //   ① 有竞品区位 vs 无竞品区位：出租率/利润必须不同（否则等于机制没生效）
  const 锦有 = r1, 锦无 = r无
  ok(锦有.occupancy !== 锦无.occupancy || 锦有.profit !== 锦无.profit,
    `竞品机制真的生效：锦江区(5 家竞品) occ ${锦有.occupancy}% / 利润 ${锦有.profit} vs 无竞品 occ ${锦无.occupancy}% / 利润 ${锦无.profit} —— 两者必须不同`)
  //   ② 客群画像同样必须改变结果（不是只在 UI 上显示）
  ok(JSON.stringify(锦有.personaFeedback) !== JSON.stringify(锦无.personaFeedback),
    '客群画像真的生效：人群反馈不同 ⇒ 画像进入了计算路径')
  //   ③ 反向：把"有竞品"当"无竞品"处理（键查不到）⇒ 上面的差异必须消失（证明差异来源单一）
  const 键失效 = settle({ site: { ...attrs, district: '不存在的区' }, ...base })
  ok((键失效.competitors || []).length === 0 && 键失效.occupancy === 锦无.occupancy,
    '反证：用一个不存在的区县名 ⇒ 竞品为空且结果回到"无竞品"基线（差异来源单一，不是随机）')
  //   ④ 同类数据通路排查（BL-7/8/9 通则：用扫描而非回忆）：
  //      人流/经济画像（LOCATION_PROFILE）是【展示层】数据 —— 引擎不得消费它（否则会出现"看着有、实际没进计算"或反之）
  const 引擎源码 = src('settlement.js') + src('dayEngine.js') + src('serverTick.mjs')
  // ★ V91（2026-10-09 · 卡『区域消费水平结构化』· 需求 1.2-2 补完）—— 本条扫描**改为按【字段】判定**（不再按整对象）：
  //   起因：V91 要求把 `人均可支配` 接进引擎（区域消费力）⇒ 原断言『引擎不引用 LOCATION_PROFILE』与新需求冲突。
  //   处置（保留原意 + 加严）：① 引擎**必须**引用 LOCATION_PROFILE（防『声明了但没用』）
  //     ② 引擎**只放行 V91 结构位**（人均可支配/社零）；展示层派生字段（pop/gdp/tou/traffic/businessDensity）**仍不得**进引擎。
  ok(/LOCATION_PROFILE/.test(引擎源码),
    'V91：引擎路径【已】引用 LOCATION_PROFILE（人均可支配接入区域消费力 · 不是"声明了但没用"）')
  ok(!/LOCATION_PROFILE[^\n]{0,120}\.(pop|gdp|tou|traffic|businessDensity)/.test(引擎源码),
    'V91：展示层派生字段（pop/gdp/tou/traffic/businessDensity）仍【不得】进引擎（只放行 V91 结构位）')
  ok(/人均可支配/.test(引擎源码), 'V91：引擎确实读『人均可支配』（消费力公式单源 · 对接 siteLocations 结构位）')
  ok(/LOCATION_PROFILE/.test(src('SiteSelection.jsx')), '人流/经济画像确被选址页消费（展示层用处明确）')

  const 锦 = r1.personaFeedback || []
  const 空 = r无.personaFeedback || []
  ok(锦.length > 0 && 锦.some(t => /商务客/.test(t)), `锦江区（dominant=business）产出商务客反馈 ${锦.length} 条：${锦.slice(0, 2).join(' / ')}`)
  ok(JSON.stringify(锦) !== JSON.stringify(空) || 空.some(t => /商务客/.test(t)) === false,
    '带 district 与不带 district 的客群反馈【不相同】（默认档 33/33/34 vs 锦江区画像 ⇒ 画像真的进了路径）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：谁把 district 又丢了、谁往数据里塞不可溯源的值，本套件即红')
process.exit(fail ? 1 : 0)
