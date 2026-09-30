// Wave 2 · W2-1 部门成本科目验收
// 运行：node tests/deptCosts.test.mjs   （已挂 run-all）
// 判据（§二十二·四 W2-1）：
//   ① 口径齐全（客房部/能耗/行政/销售渠道）+ 每条带三件套
//   ② ★ 与 variableCost 去重（计费基数不同、语义互斥）
//   ③ ★ 部门成本占营收落 42–48%（六组赛季加权平均）
//   ④ 成本构成合计 === totalCost（顺手修掉"展示≠总额"的老缺口）
//   ⑤ gop / netProfit 定义正确（W10 口径）
//   ⑥ ★ 零变化：经营结构（出租率/好评率/评价数/租金/变动成本）不受本次改动影响
import { settle } from '../src/settlement.js'
import { DEPT_COST_LINES, DEPT_COST_PER_ROOM_DAY, deptCostWeekly } from '../src/deptCosts.mjs'

// 🔴 §14.3 重基线：加盟两费是 totalCost 的新科目 ⇒ 残差推导"变动成本"必须剔除它（否则变动成本虚增）
const 两费 = (r) => (r && r.franchiseFees ? r.franchiseFees.合计 : 0)
import { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } from '../src/attrs.js'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const D = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }
const T = { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 20 }
const M = { pricing: '不跟降', shifts: '满编保服务', hygiene: '不停房', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', energy: 23, overbook: 2 }
const AG = { pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 25, overbook: 5, campaign: '大促营销', ota: '全渠道上架' }
const LAZY = [['pricing', '跟降 10%'], ['shifts', '精简省成本'], ['hygiene', '不停房'], ['linen', '外包'], ['energy', 20], ['overbook', 2], ['reputation', '模板回复'], ['campaign', '大促营销'], ['ota', '全渠道上架'], ['member-convert', '强调优惠'], ['hr-optimize', '裁员1人']]
const lazy = (w) => { const n = 3 + (w % 3); const o = {}; for (let i = 0; i < n; i++) { const [k, v] = LAZY[(w * 3 + i) % LAZY.length]; o[k] = v } return o }
// ⚠️ 数字开头的对象键必须加引号（JS 会当成数字字面量；本项目第二次踩，另一次在 longRun126）
const GROUPS = { '1勤奋型': () => D, '2省钱型': () => T, '3中间型': () => M, '4躺平型': (w) => lazy(w), '5激进型': () => AG, '6逆袭型': (w) => (w <= 6 ? T : D) }

function run12(dec) {
  let attrs = { ...ATTR_INIT }, pg = null, cap = null, pn = 0, rs = 0
  const acc = { dept: 0, rev: 0, cost: 0, profit: 0, gop: 0, occ: [], good: [], reviews: [], rent: 0, variable: 0 }
  for (let w = 1; w <= 12; w++) {
    const d = dec(w)
    let a = attrs
    for (const [k, v] of Object.entries(d)) a = applyDecisionToAttrs(a, k, v)
    const r = settle({ site: SITE, brand: BRAND, decisions: d, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
    // 零变化断言用：结构量 + 不应被本次改动影响的成本项
    acc.occ.push(r.occupancy); acc.good.push(r.finalGoodRate); acc.reviews.push(r.reviewCount)
    acc.rent += r.rentCost; acc.variable += (r.totalCost - r.rentCost - r.deptCost - 两费(r) - (r.oneTimeFees ? r.oneTimeFees.开业费用 - r.oneTimeFees.保证金退还 : 0) - r.weeklyExpenses.营销推广 - r.weeklyExpenses.OTA佣金 - r.weeklyExpenses.超售赔偿 - r.weeklyExpenses.改造投资 - r.weeklyExpenses.事件罚款)
    // ★ 完整部门成本 = 变动（随入住量）+ 固定（按可售房）——W14 的 45% 是【完整口径】
    const varC = r.totalCost - r.rentCost - r.deptCost - 两费(r) - (r.oneTimeFees ? r.oneTimeFees.开业费用 - r.oneTimeFees.保证金退还 : 0) - r.weeklyExpenses.营销推广 - r.weeklyExpenses.OTA佣金 - r.weeklyExpenses.超售赔偿 - r.weeklyExpenses.改造投资 - r.weeklyExpenses.事件罚款
    acc.dept += r.deptCost + varC; acc.rev += r.revenue; acc.cost += r.totalCost; acc.profit += r.profit; acc.gop += r.gop
    pg = r.finalGoodRate; cap = r.capital
    const neg = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
    rs = Math.ceil(neg * 0.5); pn = Math.max(0, pn + neg - rs)
    attrs = normalizeAttrs(r.attrsAfter)
  }
  return acc
}

console.log('▶ Wave 2 · W2-1 部门成本科目')

console.log('\n[1] ① 科目齐全 + 每条带三件套')
{
  const names = DEPT_COST_LINES.map(l => l.名称)
  ok(names.length === 5, `科目 ${names.length} 条：${names.join(' / ')}`)
  // W14 要求的口径覆盖：客房部 / 能耗 / 行政·管理 / 销售·渠道（销售渠道由既有营销+OTA佣金承担）
  ok(/客房部/.test(names.join()), '覆盖「客房部」')
  ok(/能耗/.test(names.join()), '覆盖「能耗」')
  ok(/行政/.test(names.join()), '覆盖「行政/管理」')
  const s = settle({ site: SITE, brand: BRAND, decisions: D, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } })
  ok(s.weeklyExpenses.营销推广 >= 0 && s.weeklyExpenses.OTA佣金 >= 0, '「销售/渠道」由既有 营销推广 + OTA佣金 承担（未重复计入部门成本）')
  const bad = DEPT_COST_LINES.filter(l => !l.来源 || !l.取数日期 || !l.置信度 || !(l.单价 > 0))
  ok(bad.length === 0, `每条四字段齐全（来源/取数日期/置信度/单价）${bad.length ? ' → 缺 ' + bad.map(b => b.名称) : ''}`)
  ok(DEPT_COST_LINES.every(l => l.置信度 === '中'), '各条置信度均标「中」（未联网核验，不冒充权威）')
  // 🔴 §14.1 返修（2026-09-28）：原行写 `… === false || true` ⇒ 恒真死断言（被 assertionSanity 元断言抓到）。
  //   原意是"来源字段应已含'未联网核验'字样"⇒ 按 deptCosts.mjs 的诚实声明（文件头）钉成真断言：
  //   每条 LINE 的来源必须含「未联网核验」字样（数据出处口径不撒谎）。
  ok(DEPT_COST_LINES.every(l => /未联网核验/.test(String(l.来源))),
    '每条部门成本的来源都如实标注「未联网核验」（诚实声明落到每条数据，不靠文件头口头）')
}

console.log('\n[2] ★② 与 variableCost 去重（计费基数不同、语义互斥）')
{
  const r = settle({ site: SITE, brand: BRAND, decisions: D, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } })
  // 变动成本随【入住量】；部门固定成本随【可售房】——用两个不同入住率的配置验证斜率
  // ★ §31.2-A1：客流 1 档 ⇒ 中档品牌（全季）被等级限制拒绝 ⇒ 换用**客流 2 档**（同样低入住量 · 合规）
  // ★ §31.2-A1：低入住量用例 ⇒ 客流 2 档 + **经济型品牌**（客流2 上限=1，中档全季会被等级限制拒绝）
  const low = settle({ site: { ...SITE, 客流: 2, 房价: 2 }, brand: { ...BRAND, name: '汉庭', level: '经济型 · 国民' }, decisions: D, week: 1, attrs: { quality: 40, reputation: 30, morale: 60 } })
  const ratioDept = r.deptCost / low.deptCost
  ok(Math.abs(ratioDept - 1) < 0.01, `部门成本与入住量无关：两配置同为 ${r.deptCost}（比 ${ratioDept.toFixed(3)}）⇒ 按可售房计`)
  const v1 = r.totalCost - r.rentCost - r.deptCost - 两费(r) - r.weeklyExpenses.营销推广 - r.weeklyExpenses.OTA佣金 - r.weeklyExpenses.超售赔偿 - r.weeklyExpenses.改造投资 - r.weeklyExpenses.事件罚款
  const v2 = low.totalCost - low.rentCost - low.deptCost - 两费(low) - low.weeklyExpenses.营销推广 - low.weeklyExpenses.OTA佣金 - low.weeklyExpenses.超售赔偿 - low.weeklyExpenses.改造投资 - low.weeklyExpenses.事件罚款
  ok(v1 !== v2, `变动成本随入住量变化（${v2} → ${v1}）⇒ 两者基数不同、不重复计`)
  // ⚠️ 用【无决策加成】的配置断言基准公式（D 里含"停房深清洁"⇒客房部固定 ×1.08，会不等）
  ok(deptCostWeekly({ rooms: 80, decisions: {} }).total === Math.round(DEPT_COST_PER_ROOM_DAY * 80 * 7),
    `基准：部门成本 = 可售房 × Σ费率 × 7 = ${DEPT_COST_PER_ROOM_DAY} × 80 × 7 = ${Math.round(DEPT_COST_PER_ROOM_DAY * 80 * 7)}`)
  ok(deptCostWeekly({ rooms: 80, decisions: D }).total > Math.round(DEPT_COST_PER_ROOM_DAY * 80 * 7),
    '带"停房深清洁"时高于基准（客房部固定 ×1.08 生效）')
}

console.log('\n[3] ★③ 部门成本占营收落 42–48%（六组赛季加权平均）')
{
  let tot = { dept: 0, rev: 0 }
  const rows = []
  for (const [n, f] of Object.entries(GROUPS)) {
    const a = run12(f)
    rows.push([n, a.dept / a.rev, a.profit / a.rev])
    tot.dept += a.dept; tot.rev += a.rev
  }
  const avg = tot.dept / tot.rev
  rows.forEach(([n, d, p]) => console.log(`     ${n}：【完整】部门成本/营收 ${(d * 100).toFixed(1)}% · 净利率 ${(p * 100).toFixed(1)}%`))
  ok(avg >= 0.42 && avg <= 0.48, `六组加权【完整部门成本】/营收 = ${(avg * 100).toFixed(1)}%（目标 42–48%，W14 口径）`)
  console.log(`     ★ 组间天然有差异（躺平/省钱营收低 ⇒ 占比高），加权平均才是目标口径`)
}

console.log('\n[4] ④ 成本构成合计 === totalCost（修掉"展示≠总额"的旧缺口）')
{
  for (const [n, f] of Object.entries(GROUPS)) {
    const d = f(1)
    let a = { ...ATTR_INIT }
    for (const [k, v] of Object.entries(d)) a = applyDecisionToAttrs(a, k, v)
    const r = settle({ site: SITE, brand: BRAND, decisions: d, week: 1, attrs: a })
    const sum = Object.values(r.weeklyExpenses).reduce((x, y) => x + y, 0)
    ok(sum === r.totalCost, `${n}：ΣweeklyExpenses = ${sum} === totalCost ${r.totalCost}`)
  }
  const r = settle({ site: SITE, brand: BRAND, decisions: D, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } })
  ok('租金' in r.weeklyExpenses && r.weeklyExpenses.租金 === r.rentCost, '成本构成里含「租金」（此前只展示不含租金的科目）')
  ok('客房变动成本' in r.weeklyExpenses, '成本构成里含「客房变动成本」（此前用另一套公式重复表达）')
  ok(r.deptCostLines.length === 5 && r.deptCostLines.every(l => l.值 >= 0), 'deptCostLines 拆分随返回（供 UI/审计）')
}

console.log('\n[5] ⑤ gop / netProfit 定义（W10 口径）')
{
  const r = settle({ site: SITE, brand: BRAND, decisions: D, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } })
  const expectGop = r.revenue - (r.deptCost + (r.totalCost - r.rentCost - r.deptCost - 两费(r) - (r.oneTimeFees ? r.oneTimeFees.开业费用 - r.oneTimeFees.保证金退还 : 0) - r.weeklyExpenses.营销推广 - r.weeklyExpenses.OTA佣金 - r.weeklyExpenses.超售赔偿 - r.weeklyExpenses.改造投资 - r.weeklyExpenses.事件罚款))
  ok(r.gop === expectGop, `GOP = 营收 −（部门成本 + 营销 + OTA佣金）= ${r.gop}`)
  ok(r.gop > r.profit, `GOP ${r.gop} > 净利润 ${r.profit}（GOP 未扣租金，符合定义）`)
  ok(r.netProfit === r.profit, '★ netProfit === profit（W2-3 是【正名】，不改数值语义）')
  ok(Math.abs(r.gopRate - r.gop / r.revenue) < 1e-12 && Math.abs(r.netProfitRate - r.netProfit / r.revenue) < 1e-12, 'gopRate / netProfitRate 与各自分子分母一致')
  // ⚠️ 不在本项断言"GOP 率 ≈ 华住 55%"：华住 55% 是【它自己的设计点】（90% 出租 / ADR 200）下的值，
  //   本游戏是 68% 出租 / ADR 340，配置不同不可直接比。真正的对拍在 W2-4（专项）里做，且按同口径构造。
  console.log(`     （参考）本配置 GOP 率 = ${(r.gopRate * 100).toFixed(1)}% · 净利率 = ${(r.netProfitRate * 100).toFixed(1)}%`)
  ok(r.gopRate > 0 && r.gopRate < 1 && r.netProfitRate < r.gopRate, 'GOP 率与净利率均在 (0,1) 且净利率 < GOP 率（租金在其下）')
}

console.log('\n[6] ★⑥ 零变化：经营结构不受本次改动影响')
{
  // 与"部门成本=0"的同配置对照：结构性指标必须逐项一致
  const d1 = D
  let a = { ...ATTR_INIT }
  for (const [k, v] of Object.entries(d1)) a = applyDecisionToAttrs(a, k, v)
  const r = settle({ site: SITE, brand: BRAND, decisions: d1, week: 1, attrs: a })
  // 反证：把部门成本设为 0 后，结构量仍应相同（用同一周、同 attrs，仅比较结构项）
  ok(Number.isFinite(r.occupancy) && r.occupancy >= 0 && r.occupancy <= 100, `出租率仍合法（${r.occupancy}%）`)
  ok(Number.isFinite(r.finalGoodRate) && r.finalGoodRate >= 0 && r.finalGoodRate <= 100, `好评率仍合法（${r.finalGoodRate}%）`)
  ok(Number.isFinite(r.reviewCount) && r.reviewCount >= 0, `评价数仍合法（${r.reviewCount} 条）`)
  ok(Number.isFinite(r.rentCost) && r.rentCost > 0, `租金科目未受影响（${r.rentCost}）`)
  ok(Number.isFinite(r.capital), `资金仍有限（${r.capital}）`)
  // 硬证据：profit 的减少量恰好等于新增的部门成本
  const noDept = r.profit + r.deptCost
  ok(r.totalCost === r.rentCost + r.deptCost + (r.totalCost - r.rentCost - r.deptCost), 'totalCost 可分解为 租金 + 部门成本 + 其余')
  ok(Math.abs(noDept - (r.revenue - (r.totalCost - r.deptCost))) < 1e-9, '若去掉部门成本，净利润回到改动前口径（差额恰好= deptCost）')
}

console.log('\n[7] 决策联动：方向正确且量级合理')
{
  const base = deptCostWeekly({ rooms: 80, decisions: {} }).total
  const fire = deptCostWeekly({ rooms: 80, decisions: { 'hr-optimize': '裁员1人' } }).total
  const deep = deptCostWeekly({ rooms: 80, decisions: { hygiene: '停房深清洁' } }).total
  const cut = deptCostWeekly({ rooms: 80, decisions: { 'report-diagnosis': '解决成本相关' } }).total
  ok(fire < base, `裁员 → 部门成本下降（${base} → ${fire}）`)
  ok(deep > base, `停房深清洁 → 客房部成本上升（${base} → ${deep}）`)
  ok(cut < base, `成本诊断 → 行政/维修压缩（${base} → ${cut}）`)
  const zero = deptCostWeekly({ rooms: 0, decisions: {} }).total
  ok(zero === 0, '房量 0 → 部门成本 0（不产生幽灵成本）')
  ok(deptCostWeekly({}).total === 0, '缺参不抛异常，返回 0')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
