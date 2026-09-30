// 第2步硬证据：改前 vs 改后（同一份存档、同一决策、同一属性轨迹）
//   ① 结构不变量 12 周【完全一致】：出租率 / 在店房数 / 好评率 / 评价条数 ← 证明随机流与经营结构未被污染
//   ② 钱用【精确算式】核对（T1.1/D16 后 money 必然变，不再用"相等"）：revenue' = 7×revenue_old
//      且 profit' − 7×profit_old = 6×otherOld（otherOld = 未被 ×7 的科目：营销/OTA佣金/超售赔偿/改造/事件罚款）
//   ③ 评价文本/客人身份必须【不同】                            ← 证明内容升级了
import { settle as settleNew, negativeTexts, positiveTexts } from '../src/settlement.js'
import { settle as settleOld } from '../src/settle-old-rev.mjs'
import { ATTR_INIT, applyDecisionToAttrs, applyWeeklyDecay } from '../src/attrs.js'
// ★ §32-U3：本套件是【与冻结的旧引擎对比】—— 旧引擎不知道世界层（天气/淡季旺季）⇒ 自第 2 周起
//   两侧不再逐项可比。判据因此改成**集合判据**：差异只许出现在"世界层非中性"的周，且中性周必须
//   逐项一致（那才是"随机流与经营结构未被污染"的原判据）。★ 未放宽任何算式，见下方注释。
import { 天气客流系数 } from '../src/weather.mjs'
import { 季节因子 } from '../src/season.mjs'

// A-1 重基线用：旧租金曲线的历史周租（旧公式 35 + 档×10 元/间·天；档位 3）
//   旧引擎把租金并入 fixedCost，返回值里没有 rentCost ⇒ 作为「历史常量」在此显式写出，
//   来源 = 旧公式本身（与 SCALE_STEPS 记历史跳同法，不是猜的数）
const 旧租周 = (r, decisions = {}) => {
  let w = (r.rooms || 0) * (35 + 3 * 10) * 7            // 旧曲线 35+档×10（本套件档位 3）
  // 决策修正与引擎同序同系数（settlement.js:485/487）—— 照抄，不另立一套
  if (decisions['report-diagnosis'] === '解决成本相关') w = Math.round(w * 0.95)
  if (decisions['hr-optimize'] === '裁员1人') w = Math.round(w * 0.9)
  return w
}

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
    rows.push({ w, old: rOld, new: rNew, decisions })
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
    // 表格里的"一致"列 = 结构不变量（钱已由下方 ×7 精确算式单独核对）
    const same = o.occupancy === n.occupancy && o.occupiedRooms === n.occupiedRooms && o.reviewCount === n.reviewCount
    const surgeN = n.generatedReviews.filter(x => x.surge === '口碑爆发').length
    console.log(`   ${String(w).padStart(2)} | ${String(o.occupancy).padStart(3)}% ${String(o.finalGoodRate).padStart(3)}% ${String(o.negativeCount).padStart(2)} ${String(o.profit).padStart(7)} | ${String(n.occupancy).padStart(3)}% ${String(n.finalGoodRate).padStart(3)}% ${String(n.negativeCount).padStart(2)} ${String(n.profit).padStart(7)} | ${same ? '✅' : '❌'} 卡片${n.generatedReviews.length}(评${n.reviewCount}/差${n.negativeCount}/爆${surgeN})`)
  })
  // 🔴 T1.1（D16）口径：revenue/fixedCost/variableCost 由【一晚】×7 扩为【一周】→ 钱一定变，不再用"相等"断言。
  //    拆三组：(甲) 结构不变量 全程一致  (乙) 钱用精确算式  (丙) 夹取周及其后的 float 允许 P4 差异
  //    P4（2026-09-22）：好评率被夹取到 ≥0（旧引擎会算出 −100%/−50%），并经 prevGoodRate 跨周传导。
  const STRUCT = ['occupancy', 'occupiedRooms', 'goodRate', 'reviewCount']
  // ★ §32-U3：世界层中性周（天气 ×1 且 季节 ×1）—— 这两周才能与"不知道世界层的旧引擎"逐项对比
  const 中性 = (w) => 天气客流系数(w) === 1 && 季节因子(w) === 1
  const 中性周 = rows.filter(r => 中性(r.w)).map(r => r.w)
  const 非中性周 = rows.filter(r => !中性(r.w)).map(r => r.w)
  const structDiff = rows.filter(r => STRUCT.some(k => r.old[k] !== r.new[k])).map(r => r.w)
  const 中性差异 = structDiff.filter(w => 中性(w))
  ok(中性差异.length === 0,
    `${name}：★ 世界层中性周（w${中性周.join('/w')}）结构不变量逐项一致 —— 随机流与经营结构未被污染【原判据保留在这一组】${中性差异.length ? '（不符周 ' + 中性差异.join('/w') + '）' : ''}`)
  const 集合同 = structDiff.every(w => 非中性周.includes(w))
  ok(集合同,
    `${name}：★ 差异只许出现在世界层非中性周（子集判据 · 全 12 周覆盖）：差异[${structDiff.join('/') || '空'}] ⊆ 非中性[${非中性周.join('/')}]`,
    `越界周[${structDiff.filter(w => !非中性周.includes(w)).join('/')}]`)
  //   ★ 为什么不做"两个方向都判"（差异集合 === 非中性集合）：实测 省钱型 w11 系数 = 雨0.90×旺季1.10 = **0.99**，
  //     1% 的需求差会被【出租率取整 + 30%/98% 上下限】吸收 ⇒ "必须有差异"是不可靠的断言（假红）。
  //     世界层的**幅度与方向**在 `tests/worldLayer.test.mjs` 用"比值恒等式"精确验证（那里没有旧引擎的混杂因素）。
  const clampWeeks = rows.filter(r => r.old.finalGoodRate < 0).map(r => r.w)
  const firstClamp = clampWeeks.length ? Math.min(...clampWeeks) : Infinity
  const floatDiff = rows.filter(r => r.w < firstClamp &&
    (r.old.finalGoodRate !== r.new.finalGoodRate || r.old.negativeCount !== r.new.negativeCount)).map(r => r.w).filter(w => 中性(w))
  ok(floatDiff.length === 0,
    `${name}：夹取周(w${firstClamp === Infinity ? '—' : firstClamp})之前的 好评率/差评数 逐周完全一致（世界层中性周口径）；夹取周 ${clampWeeks.length} 周（${clampWeeks.length ? 'w' + clampWeeks.join('/w') : '无'}）及其后为 P4 预期差异`)
// 🔴 §14.3 重基线（2026-09-28 · D53）：全季/汉庭/海友 自 §14.3 起按营收计【加盟两费】
//   （管理费 5% + CRS 有效 2.4%；单源 src/franchiseFees.mjs）⇒ 差额恒等式多一项 −两费。
//   未接入品牌返回 null ⇒ 本项恒为 0（null-safe，不写死数字）。
// 🔴 §22.2-B2（2026-09-29）：week1 收【开业一次性费用】、week12 退【保证金】⇒ 恒等式再加
//   −开业费用 +保证金退还（都是"未被 ×7 的科目"；null-safe）。
const 两费 = (r) => (r && r.franchiseFees ? r.franchiseFees.合计 : 0)
const 一次性净额 = (r) => (r && r.oneTimeFees ? r.oneTimeFees.开业费用 - r.oneTimeFees.保证金退还 : 0)
  // (乙) ×7 精确算式：收入恒 7 倍；利润差额 = 6 × 【未被 ×7 的科目】
  const OTHER_KEYS = ['营销推广', 'OTA佣金', '超售赔偿', '事件罚款']
  const RENOVATION = 2000   // settlement.js:221「投150万改造」→ renovationCost=2000（未进 weeklyExpenses，故单列）
  const moneyBad = rows.filter(r => 中性(r.w)).filter(r => {
    const otherOld = OTHER_KEYS.reduce((s, k) => s + (r.old.weeklyExpenses?.[k] || 0), 0) +
      (dec.renovation === '投150万改造' ? RENOVATION : 0)
    // 🔴 W2 重基线（D38-B）：W2-1 增了部门成本 ⇒ 恒等式加一项 −deptCost_new
    // 🔴 A-1 重基线：租金曲线改了（35+档×10 → 25+档×5）⇒ ×7 恒等式再加一项 −(新租 − 旧租周)。
  //   旧租周 = 旧公式的历史值（旧引擎把租金并进 fixedCost，返回值里没有 rentCost）—— 与 SCALE_STEPS 记历史跳同法。
  return r.new.revenue !== 7 * r.old.revenue || r.new.profit - 7 * r.old.profit !== 6 * otherOld - r.new.deptCost - (r.new.rentCost - 旧租周(r.new, r.decisions)) - 两费(r.new) - 一次性净额(r.new)
  })
  ok(moneyBad.length === 0,
    `${name}：×7 精确算式在世界层中性周成立（w${中性周.join('/w')} · 收入=7×旧收入 且 利润−7×旧利润=6×未缩放科目−部门成本）`,
    moneyBad.slice(0, 2).map(r => `w${r.w} rev ${r.old.revenue}→${r.new.revenue} prof ${r.old.profit}→${r.new.profit}`).join(' | '))
  // ★ §32-U3：非中性周的钱差**不在本套件判**（方向/幅度由 worldLayer 的比值恒等式精确验证）——
  //   理由：本套件对比的是"冻结的旧引擎"，除世界层外还叠加了 P4 好评率夹取等历史差异 ⇒ 混在一起
  //   无法把差异归因给世界层（那正是"归因不许含糊"的反面教材）。

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
