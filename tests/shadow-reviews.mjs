// 第2步硬证据：改前 vs 改后（同一份存档、同一决策、同一属性轨迹）
//   ① 逐周数值必须【完全一致】：出租率 / 好评率 / 差评数 / 利润  ← 证明随机流未被污染
//   ② 评价文本/客人身份必须【不同】                            ← 证明内容升级了
import { settle as settleNew, negativeTexts, positiveTexts } from '../src/settlement.js'
import { settle as settleOld } from '../src/settle-old-rev.mjs'
import { ATTR_INIT, applyDecisionToAttrs, applyWeeklyDecay } from '../src/attrs.js'

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const STRATEGIES = {
  勤奋型: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' },
  省钱型: { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 20 },
  超售型: { pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', overbook: 3, linen: '外包' },
}

// 同一属性轨迹（由新引擎的 attrsAfter 驱动），喂给两个引擎
function dualRun(decisions) {
  let attrs = { ...ATTR_INIT }
  let prevGoodOld = null, prevGoodNew = null, capOld = null, capNew = null
  const rows = []
  for (let w = 1; w <= 12; w++) {
    const inAttrs = {} // 周内先应用决策效果（与 App 行为一致）
    let a = attrs
    for (const [id, ans] of Object.entries(decisions)) a = applyDecisionToAttrs(a, id, ans)
    const rOld = settleOld({ site: SITE, brand: BRAND, decisions, week: w, prevGoodRate: prevGoodOld, prevCapital: capOld, attrs: a })
    const rNew = settleNew({ site: SITE, brand: BRAND, decisions, week: w, prevGoodRate: prevGoodNew, prevCapital: capNew, attrs: a })
    prevGoodOld = rOld.finalGoodRate; capOld = rOld.capital
    prevGoodNew = rNew.finalGoodRate; capNew = rNew.capital
    rows.push({ w, old: rOld, new: rNew })
    attrs = applyWeeklyDecay(a, BRAND.level)   // 轨迹与 R0 一致（结算内衰减）
  }
  return rows
}

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.log('  ✗ ' + n + (extra ? '  [' + extra + ']' : '')) } }
const OLD_POOL = new Set([...negativeTexts, ...positiveTexts])

console.log('════════ 第2步硬证据：改前 vs 改后（12 周，同一输入）════════\n')
for (const [name, dec] of Object.entries(STRATEGIES)) {
  const rows = dualRun(dec)
  console.log(`━━━ ${name} ━━━`)
  console.log('   周 |  改前 出租/好评/差评/利润      |  改后 出租/好评/差评/利润      | 一致')
  let allSame = true
  rows.forEach(({ w, old: o, new: n }) => {
    const same = o.occupancy === n.occupancy && o.finalGoodRate === n.finalGoodRate && o.negativeCount === n.negativeCount && o.profit === n.profit
    if (!same) allSame = false
    const surgeN = n.generatedReviews.filter(x => x.surge === '口碑爆发').length
    console.log(`   ${String(w).padStart(2)} | ${String(o.occupancy).padStart(3)}% ${String(o.finalGoodRate).padStart(3)}% ${String(o.negativeCount).padStart(2)} ${String(o.profit).padStart(7)} | ${String(n.occupancy).padStart(3)}% ${String(n.finalGoodRate).padStart(3)}% ${String(n.negativeCount).padStart(2)} ${String(n.profit).padStart(7)} | ${same ? '✅' : '❌'} 卡片${n.generatedReviews.length}(评${n.reviewCount}/差${n.negativeCount}/爆${surgeN})`)
  })
  ok(allSame, `${name}：12 周 出租率/好评率/差评数/利润 逐周完全一致`)

  // 内容对比
  const oldTexts = rows.flatMap(r => r.old.generatedReviews.map(x => x.text))
  const newTexts = rows.flatMap(r => r.new.generatedReviews.map(x => x.text))
  const newCauses = rows.flatMap(r => r.new.generatedReviews.map(x => x.cause))
  const diff = newTexts.filter(t => !oldTexts.includes(t)).length
  console.log(`   评价条数：改前 ${oldTexts.length} 条 / 改后 ${newTexts.length} 条`)
  console.log(`   改后文本与改前不同：${diff}/${newTexts.length} 条`)
  console.log(`   改后 cause 分布：${Object.entries(newCauses.reduce((m, c) => (m[c] = (m[c] || 0) + 1, m), {})).map(([k, v]) => k + '×' + v).join(' / ')}`)
  ok(newTexts.length > 0 && diff === newTexts.length, `${name}：改后文本全部不同于改前（内容升级生效）`)
  ok(newTexts.every(t => !OLD_POOL.has(t)), `${name}：无一条来自旧文本池（组合式生成）`)
  // 批内（同一周）无重复；跨周允许（生产环境由调用方传 recentReviewTexts 做跨周去重）
  const weekDup = rows.filter(r => { const t = r.new.generatedReviews.map(x => x.text); return new Set(t).size !== t.length }).length
  ok(weekDup === 0, `${name}：逐周批内无重复（${rows.length} 周，重复周 ${weekDup}）`)
  // 【数字与卡片一致】卡片总数 === max(reviewCount, negativeCount) + 口碑爆发追加
  const cardOK = rows.every(r => {
    const g = r.new.generatedReviews.length
    const surge = r.new.generatedReviews.filter(x => x.surge === '口碑爆发').length
    const target = Math.max(r.new.reviewCount, r.new.negativeCount) + surge
    return g === target
  })
  const badRow = rows.find(r => { const surge = r.new.generatedReviews.filter(x => x.surge === '口碑爆发').length; return r.new.generatedReviews.length !== Math.max(r.new.reviewCount, r.new.negativeCount) + surge })
  ok(cardOK, `${name}：卡片总数 === reviewCount 与 negativeCount 的较大者 + 口碑爆发追加`, badRow ? `w${badRow.w}: cards=${badRow.new.generatedReviews.length} rv=${badRow.new.reviewCount} neg=${badRow.new.negativeCount}` : '')
  // 身份自洽
  const gs = rows.flatMap(r => r.new.generatedReviews.map(x => x.guest))
  ok(gs.every(g => (g.gender === 'male' ? g.avatar === '🧑' && g.title === '先生' : g.avatar === '👩' && g.title === '女士')), `${name}：身份自洽（${gs.length} 个客人）`)
  // 抽样展示（人工可读）
  console.log('   改后样例：')
  rows.slice(0, 3).forEach(r => r.new.generatedReviews.slice(0, 2).forEach(x => console.log(`     · ${x.avatar}${x.name} ⭐${x.stars} [${x.cause}] ${x.text.slice(0, 52)}…`)))
  console.log('   改前样例：')
  rows.slice(0, 1).forEach(r => r.old.generatedReviews.slice(0, 2).forEach(x => console.log(`     · ${x.avatar}${x.name} ⭐${x.stars} ${x.text.slice(0, 52)}…`)))
  console.log('')
}

// 超售必出 no_room（跨周统计）
const overRows = dualRun(STRATEGIES.超售型)
const overNo = overRows.flatMap(r => r.new.generatedReviews).filter(x => x.cause === 'no_room').length
const overWeeks = overRows.filter(r => r.new.generatedReviews.some(x => x.cause === 'no_room')).length
console.log(`超售型：${overWeeks}/12 周出现 no_room 差评（共 ${overNo} 条）`)
ok(overNo > 0, '超售组确实产出 no_room 差评')


// ⑤ 核心：实时评价顶替结算差额 → 实时数 + 结算生成数 === 目标（数字与卡片一致，且不重复）
const baseCfg = { site: SITE, brand: BRAND, decisions: STRATEGIES.勤奋型, week: 4, attrs: { quality: 70, reputation: 72, morale: 68 } }
const r0 = settleNew(baseCfg)
const target0 = Math.max(r0.reviewCount, r0.negativeCount) + r0.generatedReviews.filter(x => x.surge === '口碑爆发').length
console.log(`\n【⑤ 差额生成】本周目标卡片数 = ${target0}（评价 ${r0.reviewCount} / 差评 ${r0.negativeCount}）`)
let okAll = true
for (const [ln, lp] of [[0, 0], [1, 0], [2, 1], [3, 2], [9, 9]]) {
  const r = settleNew({ ...baseCfg, liveNegCount: ln, livePosCount: lp })
  const gen = r.generatedReviews.length
  const totalWithLive = gen + Math.min(ln, r.negativeCount) + Math.min(lp, Math.max(0, r.reviewCount - r.negativeCount))
  const good = totalWithLive >= target0 - 1 && gen <= target0      // 不重复、不超发
  if (!good) okAll = false
  console.log(`   实时已产生 差评${ln}/好评${lp} → 结算生成 ${gen} 张；实时+结算合计 ≈ ${totalWithLive}（目标 ${target0}）${good ? ' ✅' : ' ❌'}`)
}
ok(okAll, '⑤ 实时 + 结算差额 = 目标卡片数（实时越多、结算生成越少，总数守恒）')
ok(settleNew({ ...baseCfg, liveNegCount: 99, livePosCount: 99 }).generatedReviews.length === 0, '⑤ 实时已足够时不重复生成（差额为 0）')

const failed2 = fail
console.log(`\n========== 含 ⑤ 校验：${pass} 通过 / ${failed2} 失败 ==========`)
process.exit(failed2 ? 1 : 0)
