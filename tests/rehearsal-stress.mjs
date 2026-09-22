// 压力与边界测试（5 个极端场景）：回答"极端情况下会不会崩"
//
// 运行：node tests/rehearsal-stress.mjs
// 框架同 tests/rehearsal.mjs（同一站址/品牌/属性轨迹算法，属性起点 = settle 返回的 attrsAfter）
//
// 五个场景：
//   ① 24 周超长经营       —— 长期衰减会不会把系统拖崩
//   ② 极端属性（全20 / 全100）—— 评价生成在极值下是否仍合理
//   ③ 连续 30 周超售 5 间  —— 危机事件与"卡片守恒"会不会被打破
//   ④ 空决策周（12 周一项不做）—— "不作为"的代价长什么样
//   ⑤ 12 周激进作死       —— 属性下限保护（clamp 20）是否守得住
//
// 断言口径：无异常抛出 / 无 NaN / 数值在合理区间 / 卡片守恒每周成立 / 极值单调性
// 异常（如好评率负数）只【收集并打印】，不算失败 —— 引擎数值口径本周期禁止改动
import { settle } from '../src/settlement.js'
import { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } from '../src/attrs.js'

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }

const DILIGENT = {
  pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗',
  'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿',
  corporate: '让利签约', energy: 23, overbook: 2, 'member-threshold': 5,
}
const OVERBOOK = { pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', reputation: '模板回复', energy: 20, overbook: 5 }
const EMPTY = {}
const HARSH = { pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', reputation: '模板回复', energy: 20, overbook: 0 }

let pass = 0, fail = 0
const ok = (cond, name) => { if (cond) { pass++; console.log('  ✓ ' + name) } else { fail++; console.error('  ✗ FAIL: ' + name) } }
const anomalies = []
const crashes = []

// 跑 N 周，返回每周快照；任何异常都收集不抛
function run(decisionsOf, weeks, seedAttrs = null, opts = {}) {
  let attrs = seedAttrs ? { ...seedAttrs } : { ...ATTR_INIT }
  let prevGoodRate = null, prevCapital = null, pendingNeg = 0, resolved = 0
  const rows = []
  for (let w = 1; w <= weeks; w++) {
    try {
      const decisions = decisionsOf(w)
      let a = attrs
      if (!opts.freezeAttrs) for (const [id, ans] of Object.entries(decisions)) a = applyDecisionToAttrs(a, id, ans)
      const r = settle({ site: SITE, brand: BRAND, decisions, week: w, attrs: a, prevGoodRate, prevCapital, pendingNegatives: pendingNeg, resolvedCount: resolved, liveNegCount: 0, livePosCount: 0 })
      const snap = {
        w, occupancy: r.occupancy, profit: r.profit, goodRate: r.finalGoodRate,
        reviewCount: r.reviewCount, negativeCount: r.negativeCount,
        cards: r.generatedReviews.length, surge: r.generatedReviews.filter(x => x.surge).length,
        attrs: normalizeAttrs(r.attrsAfter), attrsEvents: normalizeAttrs(r.attrsAfterEvents),
        capital: r.capital, events: (r.events || []).length, result: r,
      }
      rows.push(snap)
      // 数值异常收集（不算失败）
      if (snap.goodRate < 0) anomalies.push(`好评率为负：第${w}周 ${snap.goodRate}%`)
      if (snap.capital < 0) anomalies.push(`资金为负：第${w}周 ${snap.capital}`)
      if (snap.attrs.quality <= 20 || snap.attrs.reputation <= 20 || snap.attrs.morale <= 20) anomalies.push(`属性触底(${snap.attrs.quality}/${snap.attrs.reputation}/${snap.attrs.morale})：第${w}周`)
      prevGoodRate = r.finalGoodRate; prevCapital = r.capital
      const negCards = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
      resolved = Math.ceil(negCards * 0.5)
      pendingNeg = Math.max(0, pendingNeg + negCards - resolved)
      attrs = opts.freezeAttrs ? attrs : normalizeAttrs(r.attrsAfter)
    } catch (e) {
      crashes.push(`第${w}周抛错：${e && e.message}`)
      break
    }
  }
  return rows
}

// 通用健康检查
function health(rows, label) {
  let nan = 0, range = 0, cardBad = 0
  const numFields = ['occupancy', 'profit', 'goodRate', 'reviewCount', 'negativeCount', 'cards', 'surge', 'capital']
  for (const r of rows) {
    for (const f of numFields) if (!Number.isFinite(Number(r[f]))) nan++
    for (const k of ['quality', 'reputation', 'morale']) if (!Number.isFinite(r.attrs[k]) || r.attrs[k] < 0 || r.attrs[k] > 100) range++
    if (r.occupancy < 0 || r.occupancy > 100) range++
    if (r.cards !== Math.max(r.reviewCount, r.negativeCount) + r.surge) cardBad++
    for (const c of r.result.generatedReviews) if (!c.text || !c.name || !Number.isFinite(Number(c.stars))) nan++
  }
  ok(nan === 0, `${label}：无 NaN/undefined（检查 ${rows.length} 周）`)
  ok(range === 0, `${label}：数值在合理区间（出租 0-100 / 属性 0-100）`)
  ok(cardBad === 0, `${label}：卡片守恒每周成立（${rows.map(r => r.cards).reduce((a, b) => a + b, 0)} 张）`)
  return rows
}

console.log('▶ 压力与边界测试')

// ── ① 24 周超长经营 ──
console.log('\n① 24 周超长经营（勤奋型，长期衰减）')
const long = run(() => DILIGENT, 24)
health(long, '24周')
ok(long.length === 24, '24 周全程跑完（未中断）')
{
  const a0 = long[0].attrs, a23 = long[23].attrs
  console.log(`     属性轨迹：品质 ${a0.quality}→${a23.quality} / 声誉 ${a0.reputation}→${a23.reputation} / 士气 ${a0.morale}→${a23.morale}`)
  console.log(`     第24周：出租 ${long[23].occupancy}% / 利润 ${long[23].profit} / 好评率 ${long[23].goodRate}% / 差评 ${long[23].negativeCount}`)
  ok(Number.isFinite(long[23].profit) && Number.isFinite(long[23].capital), '第 24 周利润与资金仍为有限数')
  ok(long.every(r => r.attrs.quality >= 20 && r.attrs.morale >= 20), '24 周属性从未跌破下限 20')
}

// ── ② 极端属性（全 20 / 全 100 / 冻结点，排除决策干扰）──
console.log('\n② 极端属性下的评价生成')
{
  const low = run(() => ({}), 3, { quality: 20, reputation: 20, morale: 20 }, { freezeAttrs: true })
  const high = run(() => ({}), 3, { quality: 100, reputation: 100, morale: 100 }, { freezeAttrs: true })
  const lowNeg = low.reduce((a, r) => a + r.negativeCount, 0)
  const highNeg = high.reduce((a, r) => a + r.negativeCount, 0)
  console.log(`     全20：3 周差评合计 ${lowNeg} / 好评率 ${low.map(r => r.goodRate + '%').join(',')}`)
  console.log(`     全100：3 周差评合计 ${highNeg} / 好评率 ${high.map(r => r.goodRate + '%').join(',')}`)
  ok(lowNeg >= highNeg, `极值单调性：全20 的差评（${lowNeg}）≥ 全100（${highNeg}）`)
  health(low, '全20'); health(high, '全100')
}

// ── ③ 连续 30 周超售 ──
console.log('\n③ 连续 30 周超售 5 间（危机 + 守恒）')
const ob = run(() => OVERBOOK, 30)
health(ob, '30周超售')
ok(ob.length === 30, '30 周全程跑完')
{
  const crises = ob.reduce((a, r) => a + (r.result.events || []).filter(e => e.type === 'crisis').length, 0)
  const totalNeg = ob.reduce((a, r) => a + r.negativeCount, 0)
  const noRoom = ob.flatMap(r => r.result.generatedReviews).filter(c => c.cause === 'no_room').length
  const minCap = Math.min(...ob.map(r => r.capital))
  console.log(`     30 周累计差评 ${totalNeg} · 到店无房卡 ${noRoom} · 危机事件 ${crises} 次 · 最低资金 ${minCap}`)
  ok(ob.every(r => r.cards === Math.max(r.reviewCount, r.negativeCount) + r.surge), '超售 30 周：卡片守恒始终成立（差评不封顶也不丢卡）')
  ok(noRoom > 0, `超售必出"到店无房"差评（30 周共 ${noRoom} 条）`)
}

// ── ④ 空决策周（一项都不做）──
console.log('\n④ 空决策周（12 周一项不做）')
const empty = run(() => EMPTY, 12)
health(empty, '空决策')
ok(empty.length === 12, '12 周空决策不崩')
{
  const e12 = empty[11].attrs
  const diligent12 = run(() => DILIGENT, 12)
  const d12 = diligent12[11]
  console.log(`     空决策 第12周：出租 ${empty[11].occupancy}% / 利润 ${empty[11].profit} / 好评率 ${empty[11].goodRate}% / 品质 ${e12.quality}`)
  console.log(`     勤奋型 第12周：出租 ${d12.occupancy}% / 利润 ${d12.profit} / 好评率 ${d12.goodRate}% / 品质 ${d12.attrs.quality}`)
  ok(empty.reduce((a, r) => a + r.profit, 0) < diligent12.reduce((a, r) => a + r.profit, 0), '不作为的累计利润显著低于勤奋型（"不决策也是决策"成立）')
  ok(e12.quality <= ATTR_INIT.quality, `空决策 12 周后品质被衰减惩罚（${ATTR_INIT.quality}→${e12.quality}）`)
}

// ── ⑤ 12 周激进作死（属性下限保护）──
console.log('\n⑤ 12 周激进作死（看属性下限保护）')
const harsh = run(() => HARSH, 12)
health(harsh, '激进作死')
{
  const h12 = harsh[11].attrs
  const floorHits = harsh.filter(r => r.attrs.quality <= 20 || r.attrs.reputation <= 20 || r.attrs.morale <= 20).length
  console.log(`     期末属性：品质 ${h12.quality} / 声誉 ${h12.reputation} / 士气 ${h12.morale} · 触底周数 ${floorHits}`)
  ok(harsh.every(r => r.attrs.quality >= 0 && r.attrs.reputation >= 0 && r.attrs.morale >= 0), '属性从未跌到 0 以下（下限保护生效）')
  ok(harsh.every(r => Number.isFinite(r.profit)), '作死到底利润仍为有限数（不会 NaN/崩溃）')
}

// ── P4 口径自洽：夹取后差评数不得超过评价数（否则差评卡会多于"评价数"）──
ok([...long, ...ob, ...empty, ...harsh, ...(typeof low !== 'undefined' ? low : []), ...(typeof high !== 'undefined' ? high : [])]
  .every(r => r.negativeCount <= r.reviewCount),
  '全部压力场景：差评数 ≤ 评价数（P4 夹取生效）')

// ── 全局结论 ──
console.log('')
ok(crashes.length === 0, `五个场景全程无异常抛出${crashes.length ? ' → ' + crashes.slice(0, 3).join('；') : ''}`)
{
  const negRate = anomalies.filter(a => a.startsWith('好评率为负')).length
  const negCap = anomalies.filter(a => a.startsWith('资金为负')).length
  const floor = anomalies.filter(a => a.startsWith('属性触底')).length
  console.log(`\n  异常汇总（只报不判失败，供白天决策）：`)
  console.log(`   · 好评率为负：${negRate} 处`)
  console.log(`   · 资金为负（允许，教学中=亏损）：${negCap} 处`)
  console.log(`   · 属性触底(≤20)：${floor} 处`)
  if (negRate) console.log('   ⚠️ 好评率负数见 tests/rehearsal.mjs 观察项：finalGoodRate 未做下限保护（老公式，禁止本周期改口径）')
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
process.exit(fail ? 1 : 0)
