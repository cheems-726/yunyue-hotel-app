// 批次 B1-3 · 兼容性回归：旧档 → 迁移 → 继续经营 3 周，验【无混口径】
// 运行：node tests/stateMigrationCompat.test.mjs
// 判据（§二十一·五 B1-3）：
//   ① 迁移后继续经营，资金曲线【不跳变】（每周变化 ≈ 该周 profit，量级一致）
//   ② 不迁移就继续经营 → 出现"50 万本金 + 10 倍利润"的混口径悬崖（量化出差距，证明迁移必要）
//   ③ 进度被保住：迁移前后"相对起点的盈亏比例"一致
//   ④ 继续经营产生的新周报是【新量级】（与迁移后的历史同量级）
import { migrateSave, SCALE } from '../src/stateMigration.mjs'
import { settle } from '../src/settlement.js'
import { settle as settlePreW2 } from '../src/settle-old-w2.mjs'
// 复现「继续经营」那一周的属性轨迹（与 continueWeeks 同款：决策效果先作用到属性）
function saveAttrsFor(dec, save) {
  let a = save.attrs || { ...ATTR_INIT }
  for (const [id, ans] of Object.entries(dec)) a = applyDecisionToAttrs(a, id, ans)
  return a
}
import { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } from '../src/attrs.js'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

// ★ §33-V4-A8：对照冻结旧引擎 ⇒ 房价/人力置【档3 中性】（同 U3 世界层中性法）
const SITE = { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const STRATEGIES = {
  勤奋型: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' },
  省钱型: { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 20 },
  超售型: { pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', overbook: 3, linen: '外包' },
}

// ── 用【旧口径引擎】造一份真实的四周旧档 ──
//   旧口径引擎 = settle-old-t11（HEAD×7 之前）——保证旧档里的量级确实是旧的，不是手编的
import { settle as settleOld } from '../src/settle-old-t11.mjs'
function buildLegacySave(dec, weeks = 4) {
  let attrs = { ...ATTR_INIT }, pg = null, cap = null, pn = 0, rs = 0
  const history = []
  for (let w = 1; w <= weeks; w++) {
    let a = attrs
    for (const [id, ans] of Object.entries(dec)) a = applyDecisionToAttrs(a, id, ans)
    const r = settleOld({ site: SITE, brand: BRAND, decisions: dec, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
    history.push(r)
    pg = r.finalGoodRate; cap = r.capital
    const negCards = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
    rs = Math.ceil(negCards * 0.5); pn = Math.max(0, pn + negCards - rs)
    attrs = normalizeAttrs(r.attrsAfter)
  }
  return { user: { name: '老同学' }, week: weeks + 1, attrs: normalizeAttrs(attrs), history, capital: cap, scaleVersion: undefined }
}

// ── 继续经营 N 周（新引擎，喂迁移后的 capital / 轨迹）──
function continueWeeks(save, dec, n = 3) {
  let attrs = save.attrs || { ...ATTR_INIT }
  let pg = save.history.length ? save.history[save.history.length - 1].finalGoodRate : null
  let cap = save.capital
  let pn = 0, rs = 0
  const rows = []
  for (let i = 1; i <= n; i++) {
    const w = save.history.length + i
    let a = attrs
    for (const [id, ans] of Object.entries(dec)) a = applyDecisionToAttrs(a, id, ans)
    const r = settle({ site: SITE, brand: BRAND, decisions: dec, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
    rows.push({ week: w, profit: r.profit, capitalBefore: cap, capitalAfter: r.capital })
    cap = r.capital; pg = r.finalGoodRate
    const negCards = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
    rs = Math.ceil(negCards * 0.5); pn = Math.max(0, pn + negCards - rs)
    attrs = normalizeAttrs(r.attrsAfter)
  }
  return rows
}

console.log('▶ 批次 B1-3 · 兼容性回归（旧档 → 迁移 → 继续经营 3 周）')

for (const [name, dec] of Object.entries(STRATEGIES)) {
  console.log(`\n━━━ ${name} ━━━`)
  const legacy = buildLegacySave(dec, 4)
  const legacyProgress = (legacy.capital - SCALE.IC_OLD) / SCALE.IC_OLD
  console.log(`  旧档：capital=${legacy.capital}（相对起点 ${(legacyProgress * 100).toFixed(1)}%）· history ${legacy.history.length} 周`)

  // ① 迁移后继续经营
  const mig = migrateSave(legacy)
  const rowsM = continueWeeks(mig.save, dec, 3)
  const migProgress = (mig.save.capital - SCALE.IC_NEW) / SCALE.IC_NEW
  console.log(`  迁移后：capital=${mig.save.capital}（相对起点 ${(migProgress * 100).toFixed(1)}%）`)
  rowsM.forEach(r => console.log(`     第${r.week}周：${r.capitalBefore} + profit ${r.profit} = ${r.capitalAfter}`))

  // ③ 进度被保住：相对起点的盈亏比例一致（容差 0.5pt，吸收取整）
  ok(Math.abs(migProgress - legacyProgress) < 0.005,
    `${name}：进度比例保住（旧 ${(legacyProgress * 100).toFixed(2)}% → 新 ${(migProgress * 100).toFixed(2)}%）`)

  // ① 资金曲线不跳变：每周变化 === 该周 profit（量级一致，无悬崖）
  const jumpOK = rowsM.every(r => r.capitalAfter - r.capitalBefore === r.profit)
  ok(jumpOK, `${name}：迁移后每周资金变化 === 该周 profit（无跳变）`)
  const relSteps = rowsM.map(r => Math.abs(r.profit) / SCALE.IC_NEW)
  ok(relSteps.every(x => x < 0.15),
    `${name}：单周盈亏占起始资金 ${relSteps.map(x => (x * 100).toFixed(1) + '%').join(' / ')}（均 <15% ⇒ 无悬崖）`)

  // ④ 继续经营的新周报是新量级，与迁移后历史同量级
  const lastHist = mig.save.history[mig.save.history.length - 1]
  // 🔴 W2 重基线（D38-B）：原断言拿「W2 前口径算出的历史利润」比「W2 后新周的利润」——
  //   两者成本结构不同（W2 加了部门成本），前提已失效，不是不变量。
  //   改断【同引擎自洽】：继续经营产生的那一周，必须与直接用新引擎算同一周【逐字节相同】；
  //   且其成本必须含部门成本（证明走的是新结构，不是旧档残留）。
  const direct = settle({ site: SITE, brand: BRAND, decisions: dec, week: rowsM[0].week, attrs: saveAttrsFor(dec, mig.save), prevGoodRate: lastHist.finalGoodRate, prevCapital: mig.save.capital })
  ok(JSON.stringify(rowsM[0]) === JSON.stringify({ week: direct.week, profit: direct.profit, capitalBefore: mig.save.capital, capitalAfter: direct.capital }),
    `${name}：继续经营的第 ${rowsM[0].week} 周 === 直接用新引擎算该周（逐字节，同引擎自洽）`)
  ok(direct.deptCost > 0 && direct.deptCostLines.length === 5,
    `${name}：新周成本含部门成本 ${direct.deptCost}（5 科目）⇒ 走的是 W2 新结构，无旧档残留`)

// 🔴 §14.3 重基线（2026-09-28 · D53）：全季/汉庭/海友 自 §14.3 起按营收计【加盟两费】
//   （管理费 5% + CRS 有效 2.4%；单源 src/franchiseFees.mjs）⇒ 差额恒等式多一项 −两费。
//   未接入品牌返回 null ⇒ 本项恒为 0（null-safe，不写死数字）。
const 两费 = (r) => (r && r.franchiseFees ? r.franchiseFees.合计 : 0)
  // 跨结构差异本身要可解释：新周利润 = 同周旧结构利润 − 部门成本（差额恒等式，D38-B 的统一手法）
  // ★ §32-U3：恒等式的前提是"两侧只差结构" —— 世界层（天气/淡旺季）自 w2 起改变需求 ⇒ 原 week=w5（旺季 1.10）
  //   不再满足前提。⇒ 改在【世界中性周 w9（晴 ×1 · 平季 ×1）】上判（两引擎吃同一份输入）；
  //   非中性周的世界层幅度由 tests/worldLayer.test.mjs 的比值恒等式归因（不在此混判）。
  const 中性周 = 9
  const direct9 = settle({ site: SITE, brand: BRAND, decisions: dec, week: 中性周, attrs: saveAttrsFor(dec, mig.save), prevGoodRate: lastHist.finalGoodRate, prevCapital: mig.save.capital })
  const preW29 = settlePreW2({ site: SITE, brand: BRAND, decisions: dec, week: 中性周, attrs: saveAttrsFor(dec, mig.save), prevGoodRate: lastHist.finalGoodRate, prevCapital: mig.save.capital })
  // 🔴 V48 重基线（2026-10-06）：精简/不停房 自 V48 起有直接行为 ⇒ 含两决策场景与旧结构【决策层非中性】
  //   （新旧 ds 模型不同 ⇒ 恒等式前提"两侧只差结构"不成立）⇒ 豁免；勤奋型保留；V48 行为 v48Gaps 专守。
  const V48非中性 = dec.shifts === '精简省成本' || dec.hygiene !== '停房深清洁'
  ok(V48非中性 || direct9.profit === preW29.profit - direct9.deptCost - (direct9.rentCost - preW29.rentCost) - 两费(direct9),   // 🔴 A-1：加租金项
    `${name}：差额恒等式（世界中性周 w${中性周}）新周利润 ${direct9.profit} === 旧结构利润 ${preW29.profit} − 部门成本 ${direct9.deptCost} − 租金差 − 两费${V48非中性 ? '（V48 决策层非中性 · 豁免）' : ''}`)

  // ② 反证：不迁移就继续经营 → 混口径悬崖（量化）
  const rowsNo = continueWeeks({ ...legacy, capital: legacy.capital }, dec, 3)
  const cliff = rowsNo[0].capitalAfter / SCALE.IC_NEW
  console.log(`  ❌ 反证·不迁移：第${rowsNo[0].week}周后 capital=${rowsNo[0].capitalAfter}（仅起始资金的 ${(cliff * 100).toFixed(1)}%）`)
  ok(cliff < 0.5,
    `${name}：不迁移会出现混口径悬崖（capital 掉到起始资金的 ${(cliff * 100).toFixed(1)}% ⇒ "50万本金 + 10倍利润"）`)
  // 🔴 W2-2 重基线：悬崖倍率 = 累计缩放倍数（原写死 0.2 是单跳 ×10 时代的界）
  const CUM_W2 = (await import('../src/stateMigration.mjs')).SCALE.m
  ok(rowsNo[0].capitalAfter < mig.save.capital / (CUM_W2 * 0.5),
    `${name}：不迁移 vs 迁移的资金差距 ${rowsNo[0].capitalAfter} vs ~${mig.save.capital}（≈${(mig.save.capital / rowsNo[0].capitalAfter).toFixed(1)}×）⇒ 迁移必要`)
}

console.log('\n[汇总] 迁移必要性的量化结论')
{
  const legacy = buildLegacySave(STRATEGIES.勤奋型, 4)
  const mig = migrateSave(legacy).save
  const no = continueWeeks({ ...legacy }, STRATEGIES.勤奋型, 1)[0]
  const yes = continueWeeks(mig, STRATEGIES.勤奋型, 1)[0]
  console.log(`  同一个旧档第 5 周结算后：`)
  console.log(`     不迁移 → ${no.capitalAfter}（相对新起始资金 ${(no.capitalAfter / SCALE.IC_NEW * 100).toFixed(1)}%）`)
  console.log(`     已迁移 → ${yes.capitalAfter}（相对新起始资金 ${(yes.capitalAfter / SCALE.IC_NEW * 100).toFixed(1)}%）`)
  ok(yes.capitalAfter / SCALE.IC_NEW > 0.85 && no.capitalAfter / SCALE.IC_NEW < 0.5,
    '迁移后仍在起始资金量级、不迁移则骤降 ⇒ 混口径已被消除')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
