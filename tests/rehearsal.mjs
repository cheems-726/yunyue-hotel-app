// 多组多周彩排（6 种性格 × 12 周）：回答"这游戏调平了吗"
//
// 运行：node tests/rehearsal.mjs
// 定位：不是回归测试，是【教学平衡彩排】—— 用 6 种典型打法跑完整一季，看曲线是否讲得通。
// 框架复用 tests/shadow-reviews.mjs（同 site/同品牌/同属性轨迹算法）。
//
// ── 与 App 的一致性（重要）────────────────────────────────────
// 属性轨迹严格照 App 的真实链路：
//   ① 本周决策效果先作用到属性（App 在 onDone 里调 applyDecisionToAttrs）
//   ② settle({ attrs }) 内部再叠加"事件影响 + 每周自然衰减"，返回 attrsAfter
//   ③ 下周起点 = attrsAfter（App 结算后 setAttrs(result.attrsAfter)）
//   ⇒ 本脚本不做"额外再衰减一次"，否则与真实班级的数值不可比
//
// ── 6 组性格（教学里最常见的打法）────────────────────────────
//   1勤奋型：处处投入（满编/深清洁/自洗/培训/道歉赔偿）
//   2省钱型：处处砍成本（精简/不停房/外包/裁员/模板回复/低温能耗）
//   3中间型：省钱与投入各半
//   4躺平型：每周只做 3-5 项（不作为也是决策 → 观察"欠账"的代价）
//   5激进型：大幅降价抢客 + 超售 5 间 + 大促营销 + 全渠道 OTA
//   6逆袭型：前 6 周省钱，后 6 周转投（观察"还追不追得回来"）
//
// ── 口碑处理假设（写在明处：这是模型假设，不是引擎行为）──────
//   每周把"已处理差评数 = ceil(本周差评卡 × resolveRate)"传给下一周的 settledCount，
//   未处理的部分累积成 pendingNegatives（欠账），欠账会压口碑 → 差评更多 → 形成教学闭环。
//   resolveRate：勤奋 0.9 / 省钱 0.2 / 中间 0.5 / 躺平 0 / 激进 0.1 / 逆袭前6周 0.2 后6周 0.9
import { settle } from '../src/settlement.js'
import { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } from '../src/attrs.js'

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const WEEKS = 12

const DILIGENT = {
  pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗',
  'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿',
  corporate: '让利签约', energy: 23, overbook: 2, 'member-threshold': 5,
}
const THRIFTY = {
  pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包',
  'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复',
  energy: 20, overbook: 0,
}
const MID = {
  pricing: '不跟降', shifts: '满编保服务', hygiene: '不停房', linen: '自洗',
  'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿',
  energy: 23, overbook: 2,
}
const AGGRESSIVE = {
  pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', linen: '外包',
  'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复',
  energy: 25, overbook: 5, campaign: '大促营销', ota: '全渠道上架',
}
// 躺平：每周只做 3-5 项（轮换出现，模拟"随手点几个"）
const LAZY_POOL = [
  ['pricing', '跟降 10%'], ['shifts', '精简省成本'], ['hygiene', '不停房'], ['linen', '外包'],
  ['energy', 20], ['overbook', 2], ['reputation', '模板回复'], ['campaign', '大促营销'],
  ['ota', '全渠道上架'], ['member-convert', '强调优惠'], ['hr-optimize', '裁员1人'],
]
function lazyWeek(w) {
  const n = 3 + (w % 3)                       // 3 / 4 / 5 项轮换
  const out = {}
  for (let i = 0; i < n; i++) {
    const [id, ans] = LAZY_POOL[(w * 3 + i) % LAZY_POOL.length]
    out[id] = ans
  }
  return out
}
const GROUPS = [
  { key: '1勤奋型', decisions: () => DILIGENT, resolve: () => 0.9 },
  { key: '2省钱型', decisions: () => THRIFTY, resolve: () => 0.2 },
  { key: '3中间型', decisions: () => MID, resolve: () => 0.5 },
  { key: '4躺平型', decisions: (w) => lazyWeek(w), resolve: () => 0 },
  { key: '5激进型', decisions: () => AGGRESSIVE, resolve: () => 0.1 },
  { key: '6逆袭型', decisions: (w) => (w <= 6 ? THRIFTY : DILIGENT), resolve: (w) => (w <= 6 ? 0.2 : 0.9) },
]

let pass = 0, fail = 0
const ok = (cond, name) => { if (cond) { pass++; console.log('  ✓ ' + name) } else { fail++; console.error('  ✗ FAIL: ' + name) } }

// ── 跑一组：12 周，返回每周快照 ──
function runGroup(g) {
  let attrs = { ...ATTR_INIT }
  let prevGoodRate = null, prevCapital = null
  let pendingNeg = 0, resolved = 0
  const rows = []
  for (let w = 1; w <= WEEKS; w++) {
    const decisions = g.decisions(w)
    let a = attrs
    for (const [id, ans] of Object.entries(decisions)) a = applyDecisionToAttrs(a, id, ans)   // ① App 同款：决策即时生效
    const r = settle({
      site: SITE, brand: BRAND, decisions, week: w, attrs: a,
      prevGoodRate, prevCapital, pendingNegatives: pendingNeg, resolvedCount: resolved,
    })
    rows.push({
      w, decisions: Object.keys(decisions).length,
      occupancy: r.occupancy, profit: r.profit, goodRate: r.finalGoodRate,
      negativeCount: r.negativeCount, reviewCount: r.reviewCount,
      cards: r.generatedReviews.length,
      surge: r.generatedReviews.filter(x => x.surge).length,
      attrs: normalizeAttrs(r.attrsAfterEvents), attrsAfter: normalizeAttrs(r.attrsAfter),
      pendingIn: pendingNeg, resolvedThisWeek: resolved,
      capital: r.capital, result: r,
    })
    prevGoodRate = r.finalGoodRate
    prevCapital = r.capital
    const negCards = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
    resolved = Math.ceil(negCards * g.resolve(w))                    // 假设：这周处理掉多少
    pendingNeg = Math.max(0, pendingNeg + negCards - resolved)       // 欠账累积
    attrs = normalizeAttrs(r.attrsAfter)                             // ③ 下周起点 = attrsAfter（含每周衰减）
  }
  return rows
}

console.log('▶ 多组多周彩排（6 组 × 12 周，中档品牌 / 同一选址）')
const runAll = () => GROUPS.map(g => ({ key: g.key, rows: runGroup(g) }))
const all = runAll()

// ── ① 曲线表 ──
console.log('\n① 12 周曲线（出租率% / 利润元 / 好评率% / 差评数）')
for (const { key, rows } of all) {
  console.log('\n  ━━━ ' + key + ' ━━━')
  console.log('   周 | 决策 | 出租 |    利润 | 好评 | 差评 | 卡片(口碑爆发)')
  for (const r of rows) {
    console.log(`   ${String(r.w).padStart(2)} | ${String(r.decisions).padStart(4)} | ${String(r.occupancy).padStart(3)}% | ${String(r.profit).padStart(7)} | ${String(r.goodRate).padStart(3)}% | ${String(r.negativeCount).padStart(4)} | ${String(r.cards).padStart(2)}(${r.surge})`)
  }
}

// ── 汇总表 ──
console.log('\n  汇总（12 周累计）')
console.log('   组别   | 累计利润 | 平均出租 | 平均好评 | 累计差评 | 期末属性 品质/声誉/士气')
const summary = all.map(({ key, rows }) => {
  const profit = rows.reduce((a, r) => a + r.profit, 0)
  const occ = Math.round(rows.reduce((a, r) => a + r.occupancy, 0) / rows.length)
  const good = Math.round(rows.reduce((a, r) => a + r.goodRate, 0) / rows.length)
  const neg = rows.reduce((a, r) => a + r.negativeCount, 0)
  const end = rows[rows.length - 1].attrsAfter
  console.log(`   ${key} | ${String(profit).padStart(8)} | ${String(occ).padStart(5)}% | ${String(good).padStart(5)}% | ${String(neg).padStart(6)} | ${end.quality} / ${end.reputation} / ${end.morale}`)
  return { key, profit, occ, good, neg, end }
})

// ── ② 结果不完全相同 + 排序合理 ──
console.log('')
const profits = summary.map(s => s.profit)
ok(new Set(profits).size >= 5, `6 组结果互不相同（利润取值 ${new Set(profits).size} 种）`)
const diligent = summary.find(s => s.key === '1勤奋型').profit
const thrifty = summary.find(s => s.key === '2省钱型').profit
ok(diligent > thrifty, `勤奋型累计利润 ${diligent} > 省钱型 ${thrifty}（"投入有回报"成立）`)
const comeback = summary.find(s => s.key === '6逆袭型').profit
console.log(`     利润排序：${[...summary].sort((a, b) => b.profit - a.profit).map(s => s.key + '(' + s.profit + ')').join(' > ')}`)
console.log(`     逆袭型 ${comeback} vs 省钱型 ${thrifty}（后 6 周转投追回了 ${comeback - thrifty}）`)

// ── ③ 无 NaN / undefined ──
const numFields = ['occupancy', 'profit', 'goodRate', 'negativeCount', 'reviewCount', 'cards', 'surge']
let bad = []
for (const { key, rows } of all) {
  for (const r of rows) {
    for (const f of numFields) if (!Number.isFinite(Number(r[f]))) bad.push(`${key} 第${r.w}周 ${f}=${r[f]}`)
    for (const k of ['quality', 'reputation', 'morale']) if (!Number.isFinite(r.attrsAfter[k])) bad.push(`${key} 第${r.w}周 attrs.${k}`)
    for (const card of r.result.generatedReviews) {
      if (!card.text || !card.name || !card.cause || !Number.isFinite(Number(card.stars))) bad.push(`${key} 第${r.w}周 卡片字段异常`)
    }
  }
}
ok(bad.length === 0, `全程无 NaN / undefined（检查 ${all.length * WEEKS} 周 × ${numFields.length} 字段 + 卡片字段）${bad.length ? ' → ' + bad.slice(0, 3).join('；') : ''}`)

// ── ④ 卡片守恒 ──
let cardBad = [], cardTotal = 0
for (const { key, rows } of all) {
  for (const r of rows) {
    const target = Math.max(r.reviewCount, r.negativeCount) + r.surge
    cardTotal += r.cards
    if (r.cards !== target) cardBad.push(`${key} 第${r.w}周 卡片${r.cards} ≠ 目标${target}`)
  }
}
ok(cardBad.length === 0, `卡片数 === max(好评数, 差评数) + 口碑爆发追加（${all.length * WEEKS} 周全对，共 ${cardTotal} 张卡）${cardBad.length ? ' → ' + cardBad.slice(0, 3).join('；') : ''}`)

// ── ⑤ 属性区间 + 衰减痕迹 ──
let rangeBad = 0
for (const { rows } of all) for (const r of rows) {
  for (const k of ['quality', 'reputation', 'morale']) {
    const v = r.attrsAfter[k]
    if (!(v >= 0 && v <= 100)) rangeBad++
  }
}
ok(rangeBad === 0, '全部属性的每周取值都在 0~100 内（无越界）')
const decayEvidence = summary.filter(s => s.end.quality < ATTR_INIT.quality || s.end.reputation < ATTR_INIT.reputation || s.end.morale < ATTR_INIT.morale)
ok(decayEvidence.length >= 3, `每周自然衰减有痕迹：${decayEvidence.length}/6 组期末属性低于初值（${decayEvidence.map(s => s.key).join('、')}）`)
const lazy = summary.find(s => s.key === '4躺平型')
ok(lazy.end.quality <= ATTR_INIT.quality && lazy.end.morale <= ATTR_INIT.morale, `躺平型被衰减惩罚（品质 ${ATTR_INIT.quality}→${lazy.end.quality}，士气 ${ATTR_INIT.morale}→${lazy.end.morale}）`)

// ── 观察项（不判失败，但每次都要喊出来）──────────────────────
// ① 好评率负值：finalGoodRate = (reviewCount − negativeImpact) / reviewCount，
//    而 negativeCount 会因「差评潮」「超售」额外 +1 → 当 reviewCount 很小时（如 3）结果可为负，
//    周报会显示"好评率 -31%"这类无意义数字。属**老公式**，本周期未改动（"不改结算数值口径"铁律）。
// ② 欠账惯性：躺平/激进组差评欠账持续累积（本模型下可达 40+ 条）→ 口碑被压穿。
console.log('\n  观察项（不判失败，供白天决策）')
{
  const negRateWeeks = []
  let maxPending = 0
  for (const { key, rows } of all) {
    for (const r of rows) if (r.goodRate < 0) negRateWeeks.push(`${key} 第${r.w}周 ${r.goodRate}%`)
  }
  console.log(`   · 好评率为负的周：${negRateWeeks.length ? negRateWeeks.length + ' 处 → ' + negRateWeeks.slice(0, 4).join('，') + (negRateWeeks.length > 4 ? ' …' : '') : '无'}`)
  for (const { rows } of all) for (const r of rows) maxPending = Math.max(maxPending, r.pendingIn)
  console.log(`   · 差评欠账峰值（本模型假设）：${maxPending} 条（进结算的 pendingNegatives）`)
  const lazyRows = all.find(x => x.key === '4躺平型').rows
  console.log(`   · 躺平型好评率区间：${Math.min(...lazyRows.map(r => r.goodRate))}% ~ ${Math.max(...lazyRows.map(r => r.goodRate))}%`)
}

// ── ⑥ 确定性 ──
const all2 = runAll()
const sig = (x) => JSON.stringify(x.map(g => g.rows.map(r => [r.occupancy, r.profit, r.goodRate, r.negativeCount, r.cards, r.attrsAfter])))
ok(sig(all) === sig(all2), '同输入两次运行完全一致（固定种子公平性）')

console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
process.exit(fail ? 1 : 0)
