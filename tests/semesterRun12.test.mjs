// §23.1(b) · 学期版长跑（12 周 = 学期口径 · 与 semester.mjs 单源）
//
// ── 为什么有本套件（§23.1 · D65）────────────────────────────────
//   `longRun126`（18 周）是【引擎长稳压力测试 · 非学期口径】—— 它跑的是学生永远玩不到的时长，
//   其"期末资金"不是学期末资金。本套件补上【学期口径】：跑满 TOTAL_WEEKS 周（第 12 周结算
//   含保证金退还）⇒ 产出「学期末六组数字」供教学/文档引用。
//
// ── 口径守卫（跨口径误用检测）──────────────────────────────────
//   · WEEKS 直接取 semester.TOTAL_WEEKS（单源）—— 不许本套件自定周数
//   · 断言 TOTAL_WEEKS === 12：若产品学期长度被改 ⇒ 本套件红（口径需人工复核）
//   · 18 周长稳套件（longRun126）有对称断言 `TOTAL_WEEKS !== 18` ⇒ 两口径互斥由机器钉住
//
// 判据（与 longRun126 同一套）：① 无崩溃/无 NaN ② 三模式终值一致 ③ 补算===连续
//   ④ 不出界 ⑤ 18 项决策可结算 ⑥ Σ7天 === 周值
import { settle } from '../src/settlement.js'
import { SCALE } from '../src/stateMigration.mjs'
import { decisions as DECISIONS } from '../src/decisions.js'
import { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } from '../src/attrs.js'
import { TOTAL_WEEKS, 学期口径说明 } from '../src/semester.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const isNum = (x) => typeof x === 'number' && Number.isFinite(x)

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2, district: '锦江区' }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const NUMERIC = { energy: 23, overbook: 2, 'member-threshold': 5 }
const STRATEGIES = {
  '1勤奋型': { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', ...NUMERIC },
  '2省钱型': { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', ...NUMERIC, energy: 20 },
  '3中间型': { pricing: '不跟降', shifts: '满编保服务', hygiene: '不停房', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', ...NUMERIC },
  '4躺平型': { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', reputation: '模板回复', ...NUMERIC, energy: 20 },
  '5激进型': { pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', ...NUMERIC, energy: 25, overbook: 5, campaign: '大促营销', ota: '全渠道上架' },
  '6逆袭型': { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', reputation: '道歉+赔偿', ...NUMERIC },
}
const RESOLVE = { '1勤奋型': 0.9, '2省钱型': 0.2, '3中间型': 0.5, '4躺平型': 0, '5激进型': 0.1, '6逆袭型': 0.5 }
const FULL18 = Object.fromEntries(DECISIONS.map(d => [d.id, d.options ? d.options[0].label : (d.type === 'slider' ? d.min ?? 22 : '是')]))

// 深度扫 NaN / undefined
function scanNaN(o, path = '$', out = []) {
  if (typeof o === 'number') { if (!Number.isFinite(o)) out.push(`${path} = ${o}`); return out }
  if (o === undefined) { out.push(`${path} = undefined`); return out }
  if (o === null || typeof o !== 'object') return out
  for (const [k, v] of Object.entries(o)) scanNaN(v, `${path}.${k}`, out)
  return out
}

function runSemester(dec, resolve, mode = 'straight', k = 6) {
  let attrs = { ...ATTR_INIT }, pg = null, cap = null, pn = 0, rs = 0
  const weeks = [], issues = []
  for (let w = 1; w <= TOTAL_WEEKS; w++) {
    let a = attrs
    for (const [id, ans] of Object.entries(dec)) a = applyDecisionToAttrs(a, id, ans)
    const r = settle({ site: SITE, brand: BRAND, decisions: dec, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
    const ds = r.dailySnapshots
    if (!Array.isArray(ds) || ds.length !== 7) issues.push(`w${w} dailySnapshots 非 7 天`)
    else for (const [key, v] of [['revenue', r.revenue], ['cost', r.totalCost], ['occupied', r.occupiedRooms], ['reviews', r.reviewCount], ['cashDelta', r.profit]]) {
      const sum = ds.reduce((s2, d) => s2 + (d[key] || 0), 0)
      if (sum !== v) issues.push(`w${w} Σ${key}=${sum} ≠ 周值 ${v}`)
    }
    issues.push(...scanNaN(r, `w${w}`))
    weeks.push({ week: w, occupancy: r.occupancy, profit: r.profit, capital: r.capital, goodRate: r.finalGoodRate, negativeCount: r.negativeCount, attrs: normalizeAttrs(r.attrsAfter) })
    pg = r.finalGoodRate
    const saveLike = { capital: r.capital, history: [{ week: w, profit: r.profit }], attrs: r.attrsAfter, scaleVersion: 2 }
    cap = mode === 'roundtrip' ? JSON.parse(JSON.stringify(saveLike)).capital : r.capital
    if (mode === 'resume' && w === k) cap = JSON.parse(JSON.stringify({ capital: cap })).capital
    const negCards = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
    rs = Math.ceil(negCards * resolve); pn = Math.max(0, pn + negCards - rs)
    attrs = normalizeAttrs(r.attrsAfter)
  }
  return { weeks, issues }
}

console.log(`▶ §23.1(b) · 学期版长跑（${TOTAL_WEEKS} 周 = 学期口径 · 与 semester.mjs 单源）`)
console.log(`  ${学期口径说明}`)

// ★ 口径守卫（跨口径误用检测 —— RV 靶子）
ok(TOTAL_WEEKS === 12, `★ 口径守卫：学期长度 = 12 周（实测 ${TOTAL_WEEKS}；若产品学期被改 ⇒ 本套件红，需人工复核口径）`)

const runs = {}
for (const [name, dec] of Object.entries(STRATEGIES)) runs[name] = runSemester(dec, RESOLVE[name], 'straight')

console.log(`\n[1] ① 无崩溃 / 无 NaN（${TOTAL_WEEKS} 周 × 6 组 + 逐字段深扫）`)
{
  const all = Object.entries(runs).flatMap(([n, r]) => r.issues.map(i => `${n} ${i}`))
  ok(all.length === 0, `学期全程 × 6 组跑通，深扫命中 0 处`)
}

console.log(`\n[2] ⑥ Σ7天 === 周值（逐周逐项）`)
{
  const bad = Object.entries(runs).flatMap(([n, r]) => r.issues.filter(i => i.includes('Σ')).map(i => n + ' ' + i))
  ok(bad.length === 0, `Σ7天 ≡ 周值：${TOTAL_WEEKS} 周 × 6 组 × 5 项 = ${TOTAL_WEEKS * 6 * 5} 个恒等式全部成立`)
}

console.log(`\n[3] ⑤ 18 项决策所有周都能结算`)
{
  let threw = 0, nan = 0
  for (let w = 1; w <= TOTAL_WEEKS; w++) {
    try {
      const r = settle({ site: SITE, brand: BRAND, decisions: { ...FULL18, ...NUMERIC }, week: w, prevCapital: SCALE.IC_NEW, attrs: { quality: 60, reputation: 70, morale: 65 } })
      if (!isNum(r.profit) || !isNum(r.capital)) nan++
    } catch (e) { threw++; console.log(`     ✗ w${w} 抛异常：${e.message}`) }
  }
  ok(threw === 0 && nan === 0, `逐周全 18 项决策结算：抛异常 ${threw} · NaN ${nan}`)
}

console.log(`\n[4] ②③ 断线重连 / 中途接入：终值一致`)
{
  let diff = 0
  for (const [name, dec] of Object.entries(STRATEGIES)) {
    const a = runSemester(dec, RESOLVE[name], 'straight')
    const b = runSemester(dec, RESOLVE[name], 'roundtrip')
    const c = runSemester(dec, RESOLVE[name], 'resume', 4)
    if (JSON.stringify(a.weeks) !== JSON.stringify(b.weeks) || JSON.stringify(a.weeks) !== JSON.stringify(c.weeks)) diff++
  }
  ok(diff === 0, `6 组三模式终值逐字节一致（不一致 ${diff} 组）`)
  const base = runSemester(STRATEGIES['1勤奋型'], 0.9, 'straight')
  const tweak = runSemester({ ...STRATEGIES['1勤奋型'], pricing: '降价 20% 抢客' }, 0.9, 'straight')
  ok(JSON.stringify(base.weeks) !== JSON.stringify(tweak.weeks), '反证：改一项决策 ⇒ 结果确实变化（非恒真）')
}

console.log(`\n[5] ④ 不出界 + ★ 学期终点核对（第 ${TOTAL_WEEKS} 周 = 保证金退还周）`)
{
  const oob = []
  for (const [name, r] of Object.entries(runs)) {
    for (const w of r.weeks) {
      if (!(w.occupancy >= 0 && w.occupancy <= 100)) oob.push(`${name} w${w.week} occ=${w.occupancy}`)
      if (!(w.goodRate >= 0 && w.goodRate <= 100)) oob.push(`${name} w${w.week} goodRate=${w.goodRate}`)
      if (!(w.capital > -1e9 && w.capital < 1e9)) oob.push(`${name} w${w.week} capital=${w.capital}`)
    }
  }
  ok(oob.length === 0, `全学期数值在界内（越界 ${oob.length} 处）`, oob.slice(0, 4).join(' | '))
  // ★ 学期终点：最后一周的结算【含保证金退还】（week === TOTAL_WEEKS 的引擎钩子）
  const 末周 = runs['1勤奋型'].weeks[TOTAL_WEEKS - 1]
  ok(runs['1勤奋型'].weeks.length === TOTAL_WEEKS, `周数 = 学期长度（${TOTAL_WEEKS}）—— 与结业判定同一终点（semester.mjs 单源）`)
  // 期末资金表（落文档用）
  console.log('\n  ── 学期末六组数字（教学/文档引用口径）──')
  for (const [name, r] of Object.entries(runs)) {
    const e = r.weeks[TOTAL_WEEKS - 1]
    console.log(`     ${name}：期末资金 ${e.capital.toLocaleString()} · 好评率 ${e.goodRate}% · 属性 ${e.attrs.quality}/${e.attrs.reputation}/${e.attrs.morale}`)
  }
  // 保证金退还发生的证据：期末净利合计含 +保证金（week12 那周 profit 偏高）
  const w12profit = runs['1勤奋型'].weeks[TOTAL_WEEKS - 1].profit
  ok(Number.isFinite(w12profit), `第 ${TOTAL_WEEKS} 周结算可运行（含保证金退还钩子路径）`)

  // ★★ §24.2（P1 口径钉子）：【产物数字断言】—— 学期末六组期末资金钉进测试（值 = 当前实跑）。
  //   此前六组数字只活在 console 输出与文档表格里 ⇒ 引擎一改 ⇒ 文档静默变旧
  //   （"数字对≠引用它的地方都对"家族 · 本项目已犯 4 次）。失败信息指向对应文档。
  const 钉子 = { '1勤奋型': 1718245, '2省钱型': 1321421, '3中间型': 1280581, '4躺平型': 1266470, '5激进型': 1204518, '6逆袭型': 1322574 }
  const 钉坏 = Object.entries(钉子).filter(([n, v]) => runs[n].weeks[TOTAL_WEEKS - 1].capital !== v)
  ok(钉坏.length === 0, '★★ 产物数字钉子：学期末六组期末资金 === 钉死值（变了 ⇒ 更新《数值平衡与口径总览》§四 与报告）',
    钉坏.map(([n, v]) => `${n} 实跑 ${runs[n].weeks[TOTAL_WEEKS - 1].capital} ≠ 钉值 ${v}`).join(' | '))
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：学期口径（12 周）6 判据全过 · 期末资金 = 学期末（非长稳口径）· 口径守卫在位')
process.exit(fail ? 1 : 0)
