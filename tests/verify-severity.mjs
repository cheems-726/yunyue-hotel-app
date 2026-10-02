// severity 语气分级 · 硬证据（改前引擎 vs 改后）
//   ① 评价文本【逐字一致】 ← 因为原「星级抽取」保留为占位抽取 → 独立流位置不变
//   ② 差评星级改为【经营状态驱动】← 本任务的目的：越差越狠，不再 50/50 随机
//   ③ 结构不变量（出租率/在店房数/好评率/评价条数）必须 12 周完全一致；
//      钱改用【×7 精确算式】核对（T1.1/D16：revenue/fixed/variable 由一晚 ×7 为一周）：
//      revenue' = 7×revenue_old 且 profit' − 7×profit_old = 6×otherOld
// 运行：node tests/verify-severity.mjs
// 前置：git show HEAD:src/settlement.js > src/settle-old-sev.mjs（HEAD=接入 severity 之前的那一版）
import { settle as settleNew } from '../src/settlement.js'
import { settle as settleOld } from '../src/settle-old-sev.mjs'
import { ATTR_INIT, applyDecisionToAttrs, applyWeeklyDecay } from '../src/attrs.js'
// ★ §32-U3：世界层（天气/淡旺季）自第 2 周起改变需求 ⇒ 与冻结旧引擎的可比口径 = 世界层中性周
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

// ★ §33-V4-A8：对照冻结旧引擎 ⇒ 房价/人力置【档3 中性】（同 U3 世界层中性法）
const SITE = { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
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
    rows.push({ w, old: rOld, new: rNew, attrs: { ...a }, decisions })
    attrs = applyWeeklyDecay(a, BRAND.level)
  }
  return rows
}

console.log('▶ severity 语气分级 · 改前(HEAD) vs 改后')
const starHist = {}
for (const [name, dec] of Object.entries(STRATEGIES)) {
  const rows = dualRun(dec)
  // ①-a 结构不变量（★ §32-U3 改口径）：本套件对比的是【冻结的旧引擎】（不知道世界层：天气/淡旺季，
  //   自第 2 周起对 demandStrength 生效）⇒ 判据改为：
  //     (i) 世界层**中性周**（天气×1 且 季节×1）必须逐项一致 —— 原判据的语义（随机流与经营结构未被污染）保留在这里
  //     (ii) 差异**只许**出现在非中性周（子集判据：越界即红）—— 覆盖全 12 周，不抽样
  //   ⇒ 未放宽算式，只是把"与旧引擎可比的口径"限定在前提成立的那几周。
  const STRUCT = ['occupancy', 'occupiedRooms', 'goodRate', 'reviewCount']
  const 中性 = (w) => 天气客流系数(w) === 1 && 季节因子(w) === 1
  const 中性周 = rows.filter(r => 中性(r.w)).map(r => r.w)
  const 非中性周 = rows.filter(r => !中性(r.w)).map(r => r.w)
  const structDiff = rows.filter(r => STRUCT.some(k => r.old[k] !== r.new[k])).map(r => r.w)
  const 中性差异 = structDiff.filter(w => 中性(w))
  ok(中性差异.length === 0,
    `${name}：★ 世界层中性周（w${中性周.join('/w')}）结构不变量（出租率/在店房数/好评率/评价条数）逐项一致${中性差异.length ? '（不符周 ' + 中性差异.join('/w') + '）' : ''}`)
  ok(structDiff.every(w => 非中性周.includes(w)),
    `${name}：★ 结构差异只出现在世界层非中性周（差异[${structDiff.join('/') || '空'}] ⊆ 非中性[${非中性周.join('/')}]）`,
    `越界[${structDiff.filter(w => !非中性周.includes(w)).join('/')}]`)
// 🔴 §14.3 重基线（2026-09-28 · D53）：全季/汉庭/海友 自 §14.3 起按营收计【加盟两费】
//   （管理费 5% + CRS 有效 2.4%；单源 src/franchiseFees.mjs）⇒ 差额恒等式多一项 −两费。
//   未接入品牌返回 null ⇒ 本项恒为 0（null-safe，不写死数字）。
const 两费 = (r) => (r && r.franchiseFees ? r.franchiseFees.合计 : 0)
// 🔴 §22.2-B2：week1 开业费用 / week12 保证金退还 —— 同为“未被 ×7 的科目”（null-safe）
const 一次性净额 = (r) => (r && r.oneTimeFees ? r.oneTimeFees.开业费用 - r.oneTimeFees.保证金退还 : 0)
  // ①-b ×7 精确算式（T1.1/D16）
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
    `${name}：×7 精确算式在世界层中性周成立（w${中性周.join("/w")} · 收入=7×旧收入 且 利润−7×旧利润=6×未缩放科目−部门成本）`,
    moneyBad.slice(0, 2).map(r => `w${r.w} rev ${r.old.revenue}→${r.new.revenue} prof ${r.old.profit}→${r.new.profit}`).join(' | '))
  // ①-c P4 夹取口径：好评率被夹取到 ≥0，且经 prevGoodRate 跨周传导
  //    ⇒ 断言 = 【首次夹取周之前的 好评率/差评数 必须逐周完全一致】；夹取周及其后为预期差异
  const clampWeeks = rows.filter(r => r.old.finalGoodRate < 0).map(r => r.w)
  const firstClamp = clampWeeks.length ? Math.min(...clampWeeks) : Infinity
  const floatDiff = rows.filter(r => r.w < firstClamp && 中性(r.w) &&
    (r.old.finalGoodRate !== r.new.finalGoodRate || r.old.negativeCount !== r.new.negativeCount)).map(r => r.w)
  ok(floatDiff.length === 0,
    `${name}：夹取周(${firstClamp === Infinity ? "—" : "w" + firstClamp})之前的 好评率/差评数 逐周完全一致（世界层中性周口径）；夹取周 ${clampWeeks.length} 周`)

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
