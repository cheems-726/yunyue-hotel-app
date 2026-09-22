// severity 语气分级 · 硬证据（改前引擎 vs 改后）
//   ① 评价文本【逐字一致】 ← 因为原「星级抽取」保留为占位抽取 → 独立流位置不变
//   ② 差评星级改为【经营状态驱动】← 本任务的目的：越差越狠，不再 50/50 随机
//   ③ 数值（出租率/好评率/差评数/利润）必须仍然完全一致
// 运行：node tests/verify-severity.mjs
// 前置：git show HEAD:src/settlement.js > src/settle-old-sev.mjs（HEAD=接入 severity 之前的那一版）
import { settle as settleNew } from '../src/settlement.js'
import { settle as settleOld } from '../src/settle-old-sev.mjs'
import { ATTR_INIT, applyDecisionToAttrs, applyWeeklyDecay } from '../src/attrs.js'

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const STRATEGIES = {
  勤奋型: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' },
  省钱型: { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 20 },
  超售型: { pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', overbook: 3, linen: '外包' },
}

let pass = 0, fail = 0
const ok = (cond, name) => { if (cond) { pass++; console.log('  ✓ ' + name) } else { fail++; console.error('  ✗ FAIL: ' + name) } }

function dualRun(decisions) {
  let attrs = { ...ATTR_INIT }
  let pOld = null, pNew = null, cOld = null, cNew = null
  const rows = []
  for (let w = 1; w <= 12; w++) {
    let a = attrs
    for (const [id, ans] of Object.entries(decisions)) a = applyDecisionToAttrs(a, id, ans)
    const rOld = settleOld({ site: SITE, brand: BRAND, decisions, week: w, prevGoodRate: pOld, prevCapital: cOld, attrs: a })
    const rNew = settleNew({ site: SITE, brand: BRAND, decisions, week: w, prevGoodRate: pNew, prevCapital: cNew, attrs: a })
    pOld = rOld.finalGoodRate; cOld = rOld.capital
    pNew = rNew.finalGoodRate; cNew = rNew.capital
    rows.push({ w, old: rOld, new: rNew, attrs: { ...a } })
    attrs = applyWeeklyDecay(a, BRAND.level)
  }
  return rows
}

console.log('▶ severity 语气分级 · 改前(HEAD) vs 改后')
const starHist = {}
for (const [name, dec] of Object.entries(STRATEGIES)) {
  const rows = dualRun(dec)
  // ① 数值完全一致
  const numKeys = ['occupancy', 'finalGoodRate', 'negativeCount', 'reviewCount', 'profit', 'capital']
  // 🔴 P4（2026-09-22）口径：好评率被夹取到 ≥0，且经 prevGoodRate 跨周传导
  //    ⇒ 断言 = 【首次夹取周之前必须逐周完全一致】；夹取周及其后为预期差异
  const clampWeeks = rows.filter(r => r.old.finalGoodRate < 0).map(r => r.w)
  const firstClamp = clampWeeks.length ? Math.min(...clampWeeks) : Infinity
  const numDiff = rows.filter(r => r.w < firstClamp && numKeys.some(k => JSON.stringify(r.old[k]) !== JSON.stringify(r.new[k])))
  ok(numDiff.length === 0,
    `${name}：首次夹取周(${firstClamp === Infinity ? '—' : 'w' + firstClamp})之前数值逐周完全一致；夹取周 ${clampWeeks.length} 周`)

  // ② 星级相同的卡片，文本必须逐字一致（证明独立流位置没被改动）
  //    星级被状态改写的那部分，文本随之改语气（这正是语气分级要的）
  const pairs = rows.flatMap(r => r.old.generatedReviews.map((x, i) => [x, r.new.generatedReviews[i]]))
  const sameStar = pairs.filter(([o, n]) => o && n && o.stars === n.stars)
  const starChanged = pairs.filter(([o, n]) => o && n && o.stars !== n.stars)
  ok(sameStar.length === 0 || sameStar.every(([o, n]) => o.text === n.text),
    `${name}：同星级卡片文本逐字一致（${sameStar.length}/${pairs.length} 条同星级）`)
  ok(pairs.length === rows.reduce((a, r) => a + r.old.generatedReviews.length, 0) && starChanged.length > 0,
    `${name}：卡片总数不变、${starChanged.length} 条星级被状态改写`)

  // ③ 星级：差评按状态分档，好评恒 5
  const neg = rows.flatMap(r => r.new.generatedReviews.filter(x => x.stars <= 3))
  const pos = rows.flatMap(r => r.new.generatedReviews.filter(x => x.stars >= 4))
  ok(neg.every(x => [1, 2, 3].includes(x.stars)), `${name}：差评星级全部落在 1~3（${neg.length} 条）`)
  ok(pos.every(x => x.stars === 5), `${name}：好评恒 5 星（${pos.length} 条）`)
  ok(rows.some(r => r.old.generatedReviews.some((x, i) => x.stars !== r.new.generatedReviews[i]?.stars)),
    `${name}：星级确实由状态改写（与改前随机口径不同）`)
  // 到店无房恒 1 星
  const noRoom = neg.filter(x => x.cause === 'no_room')
  // 🔴 原写法对空数组恒真（实测 3 组里 2 组"0 条"空转通过）→ 改为"真有才断言，没有就明说跳过"
  if (noRoom.length) ok(noRoom.every(x => x.stars === 1), `${name}：到店无房差评恒 1 星（${noRoom.length} 条）`)
  else console.log(`     （${name} 本季无 no_room 卡 → 该断言跳过，不计入通过数）`)
  const hist = {}
  neg.forEach(x => { hist[x.stars] = (hist[x.stars] || 0) + 1 })
  starHist[name] = hist
  const attrsEnd = rows[rows.length - 1].attrs
  console.log(`     ${name}：差评星级分布 ${JSON.stringify(hist)} · 第12周属性 品质${attrsEnd.quality}/声誉${attrsEnd.reputation}/士气${attrsEnd.morale}`)
}

// ④ 跨策略对比：状态越差 → 1 星占比越高（教学可解释性）
const oneStarRatio = (h) => { const t = Object.values(h).reduce((a, b) => a + b, 0); return t ? (h[1] || 0) / t : 0 }
const rCost = oneStarRatio(starHist.省钱型 || {}), rHard = oneStarRatio(starHist.勤奋型 || {})
ok(rCost >= rHard, `省钱型 1 星占比 ${(rCost * 100).toFixed(0)}% ≥ 勤奋型 ${(rHard * 100).toFixed(0)}%（越差越狠）`)

console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
process.exit(fail ? 1 : 0)
