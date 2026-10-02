// 第一期 D1 验收：日引擎（纯函数）—— 确定性 / Σ7天 ≡ 周 / 乱序补算一致 / 不碰全局随机
// 运行：node tests/dayEngine.test.mjs
import { simulateDay, simulateWeek, splitExact, dayWeights, DAYS_PER_WEEK } from '../src/dayEngine.js'
// ★ §32-U3：与旧引擎的可比口径 = 世界层中性周（见下方 ② 项注释）
import { 天气客流系数 } from '../src/weather.mjs'
import { 季节因子 } from '../src/season.mjs'
import { readFileSync } from 'node:fs'

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

let pass = 0, fail = 0
const ok = (cond, name) => { if (cond) { pass++; console.log('  ✓ ' + name) } else { fail++; console.error('  ✗ FAIL: ' + name) } }

const WEEK = { revenue: 19057, cost: 9653, checkins: 12, checkouts: 9, occupied: 47, reviews: 4, cashDelta: 9404 }
const KEYS = ['revenue', 'cost', 'checkins', 'checkouts', 'occupied', 'reviews', 'cashDelta']

console.log('[1] 恒等式：Σ7天 === 周汇总（逐项精确相等）')
{
  const days = simulateWeek({ seed: 42, weekTotals: WEEK })
  ok(days.length === DAYS_PER_WEEK, `返回 7 天（实际 ${days.length}）`)
  const sum = {}
  for (const k of KEYS) sum[k] = days.reduce((a, d) => a + d[k], 0)
  const bad = KEYS.filter(k => sum[k] !== WEEK[k])
  ok(bad.length === 0, `逐项 Σ天 === 周（${KEYS.map(k => k + ':' + sum[k]).join(' ')}）${bad.length ? ' → 不等：' + bad.join(',') : ''}`)
  ok(days.every(d => d.dailySnapshot && d.dailySnapshot.dayIndex >= 1 && d.dailySnapshot.dayIndex <= 7), '每天都有 dailySnapshot 且 dayIndex 合法')
}

console.log('\n[2] 分摊器 splitExact：任何总量、任何权重都精确不丢')
{
  let bad = 0
  for (let t = -50; t <= 5000; t += 7) {
    const w = dayWeights(t + 1)
    const parts = splitExact(t, w)
    if (parts.reduce((a, b) => a + b, 0) !== t) bad++
  }
  ok(bad === 0, '扫描 -50~5000 的整数总量：Σ 分配 === 总量（0 处偏差）')
  ok(splitExact(0, dayWeights(1)).every(x => x === 0), '总量 0 → 每天 0')
  const neg = splitExact(-7, dayWeights(3))
  ok(neg.reduce((a, b) => a + b, 0) === -7, '负数总量同样精确（亏损周也不会丢钱）')
}

console.log('\n[3] 确定性：同输入两次 → 逐字相同')
{
  const a = simulateWeek({ seed: 2026, weekTotals: WEEK })
  const b = simulateWeek({ seed: 2026, weekTotals: WEEK })
  ok(JSON.stringify(a) === JSON.stringify(b), '同 seed 两次运行逐字相同')
  const c = simulateWeek({ seed: 2027, weekTotals: WEEK })
  ok(JSON.stringify(a) !== JSON.stringify(c), '不同 seed → 分布不同（说明真的用了种子）')
}

console.log('\n[4] 乱序补算：跳过 3 天再补算 === 连续算')
{
  const seq = simulateWeek({ seed: 77, weekTotals: WEEK })
  const outOfOrder = []
  outOfOrder[0] = simulateDay({ dayIndex: 1, seed: 77, weekTotals: WEEK })
  outOfOrder[3] = simulateDay({ dayIndex: 4, seed: 77, weekTotals: WEEK })
  outOfOrder[6] = simulateDay({ dayIndex: 7, seed: 77, weekTotals: WEEK })
  outOfOrder[1] = simulateDay({ dayIndex: 2, seed: 77, weekTotals: WEEK })
  outOfOrder[2] = simulateDay({ dayIndex: 3, seed: 77, weekTotals: WEEK })
  outOfOrder[4] = simulateDay({ dayIndex: 5, seed: 77, weekTotals: WEEK })
  outOfOrder[5] = simulateDay({ dayIndex: 6, seed: 77, weekTotals: WEEK })
  ok(JSON.stringify(seq) === JSON.stringify(outOfOrder), '乱序逐日计算 === 顺序计算（纯函数性证明）')
}

console.log('\n[5] 硬约束：不碰全局随机 / 纯函数不改入参')
{
  const srcRaw = readFileSync(new URL('../src/dayEngine.js', import.meta.url), 'utf8')
  const codeOnly = srcRaw.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
  ok(!/Math\.random/.test(codeOnly), 'dayEngine.js 无 Math.random（只用 guestsRng 独立流）')
  const state = { price: 230, attrs: { quality: 60 } }
  const decisions = { pricing: '不跟降' }
  const before = JSON.stringify({ state, decisions })
  simulateWeek({ decisions, state, seed: 5, weekTotals: WEEK })
  ok(JSON.stringify({ state, decisions }) === before, '纯函数：入参未被修改')
  ok(!/localStorage|sessionStorage|document\./.test(codeOnly), '不碰 DOM / 存储（一期天数据不持久化）')
}

console.log('\n[6] 一期状态标记：临时实现必须写明"二期替换"')
{
  const src = readFileSync(new URL('../src/dayEngine.js', import.meta.url), 'utf8')
  ok(/【临时实现·二期替换】/.test(src), '文件内标注了【临时实现·二期替换】（用户约束①）')
  ok(/不持久化/.test(src), '文件头写明"一期天数据不持久化"（用户约束②）')
}

// ── Phase D/C2 · 接线后的恒等式与零变化（settlement 内部已调用 simulateWeek）──
console.log('\n[7] Phase D · settlement 接线后：Σ7天 === 周值 + 零变化')
{
  const { settle } = await import('../src/settlement.js')
  // 🔴 W2 重基线（D38-B）：基准改为「W2 前」
  const { settle: settleOld } = await import('../src/settle-old-w2.mjs')
  const { applyDecisionToAttrs, normalizeAttrs, ATTR_INIT } = await import('../src/attrs.js')
  // ★ §33-V4-A8：对照冻结旧引擎 ⇒ 房价/人力置【档3 中性】（A8 接线 ±3%/±4% · 与 U3 世界层中性法同款）
  const SITE = { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
  const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
  const STRATEGIES = {
    勤奋型: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' },
    省钱型: { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 20 },
    超售型: { pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', overbook: 3, linen: '外包' },
  }
  const strip = (x) => { const y = { ...x }; delete y.dailySnapshots; return JSON.stringify(y) }
  let idBad = 0, zeroBad = 0, idCases = 0
  for (const [name, dec] of Object.entries(STRATEGIES)) {
    let attrs = { ...ATTR_INIT }, pg = null, cap = null, pn = 0, rs = 0
    for (let w = 1; w <= 12; w++) {
      let a = attrs
      for (const [id, ans] of Object.entries(dec)) a = applyDecisionToAttrs(a, id, ans)
      const r = settle({ site: SITE, brand: BRAND, decisions: dec, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
      const o = settleOld({ site: SITE, brand: BRAND, decisions: dec, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
      // ① 接线后恒等式：Σ7天 === 该周周值（逐项）
      const ds = r.dailySnapshots
      const pairs = [['revenue', r.revenue], ['cost', r.totalCost], ['occupied', r.occupiedRooms], ['reviews', r.reviewCount], ['cashDelta', r.profit]]
      idCases++
      if (!ds || ds.length !== DAYS_PER_WEEK) { idBad++; console.error(`   ✗ ${name} w${w}：dailySnapshots 缺失或非 7 天`) }
      else for (const [k, v] of pairs) {
        const sum = ds.reduce((a, d) => a + (d[k] || 0), 0)
        if (sum !== v) { idBad++; console.error(`   ✗ ${name} w${w} Σ${k}=${sum} ≠ 周值 ${v}`) }
      }
      // ② W2 重基线：结构不变量零漂移 + 成本差额恰为 deptCost
      // 🔴 §32-U3 口径修正：本项对比的是【冻结的旧引擎】（不知道世界层：天气/淡旺季，自 w2 起改变需求）
      //   ⇒ 只在【世界层中性周】上判"零漂移"（那里前提成立）；非中性周的世界层效应由
      //     `tests/worldLayer.test.mjs` 的比值恒等式精确验证（不在本套件混判，避免归因含糊）。
      const 世界中性 = 天气客流系数(w) === 1 && 季节因子(w) === 1
      // 🔴 A-1：rentCost 移出结构不变量（见上）
  // 🔴 A-1（2026-09-27）：rentCost 移出结构不变量 —— 租金曲线已按教学口径调整（35+档×10 → 25+档×5），
  //   它本就该变；差额恒等式改在下方单独加【历史周租差】项（Δcost === deptCost + Δ租）。
  const STRUCT = ['occupancy', 'occupiedRooms', 'goodRate', 'finalGoodRate', 'reviewCount', 'negativeCount', 'revenue', 'price', 'rooms']
      const drifted = STRUCT.filter(k => r[k] !== o[k])
// 🔴 §14.3 重基线（2026-09-28 · D53）：全季/汉庭/海友 自 §14.3 起按营收计【加盟两费】
//   （管理费 5% + CRS 有效 2.4%；单源 src/franchiseFees.mjs）⇒ 差额恒等式多一项 −两费。
//   未接入品牌返回 null ⇒ 本项恒为 0（null-safe，不写死数字）。
const 两费 = (r) => (r && r.franchiseFees ? r.franchiseFees.合计 : 0)
      // 🔴 A-1：租金曲线改了 ⇒ 差额恒等式加【历史周租差】（旧引擎不暴露 rentCost）
  const Δ租 = r.rentCost - 旧租周(r, dec)
  // 🔴 §22.2-B2：week1 开业费用 / week12 保证金退还 —— 同为“未被 ×7 的科目”（null-safe）
const 一次性净额 = (x) => (x && x.oneTimeFees ? x.oneTimeFees.开业费用 - x.oneTimeFees.保证金退还 : 0)
if (世界中性 && (drifted.length || r.totalCost - o.totalCost !== r.deptCost + Δ租 + 两费(r) + 一次性净额(r) || r.profit !== o.profit - r.deptCost - Δ租 - 两费(r) - 一次性净额(r))) {
        zeroBad++; console.error(`   ✗ ${name} w${w}：漂移 ${drifted.join(',')} | Δcost ${r.totalCost - o.totalCost} vs dept ${r.deptCost}`)
      }
      pg = r.finalGoodRate; cap = r.capital
      const negCards = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
      rs = Math.ceil(negCards * 0.5); pn = Math.max(0, pn + negCards - rs)
      attrs = normalizeAttrs(r.attrsAfter)
    }
  }
  ok(idBad === 0, `接线后 Σ7天 === 周值（逐项）：3 策略 × 12 周 = ${idCases} 周全部成立`)
  ok(zeroBad === 0, '结构不变量零漂移 + Δcost === deptCost（★ 世界层中性周口径 · 非中性周由 worldLayer 比值恒等式单独验证）')
  // ③ 天数据不持久化：dailySnapshots 不得出现在任何【存档写入】路径
  //   ★ §26.3（2026-09-29 · P0b）判据升级 —— 原因：**面板现在必须消费引擎日快照**（用户投诉"数据没有联动"），
  //     App.jsx 里必然出现该字段；而原判据是"App.jsx 全文不许出现 dailySnapshots"的**子串检查**
  //     ⇒ 一是变假红，二是它本就不精确：该禁的是**持久化**，不是"出现"（天数据算完即弃 · 用户 2026-09-22 约束②）。
  //   新判据（三条，比原来更准，不是放宽）：
  //     ① 存档载荷行里不得出现 dailySnapshots（withScaleVersion / localStorage.setItem / cloudState）
  //     ② 每一处出现都必须是【只读消费】形态（`?.dailySnapshots` 或作为 prop 传给面板）
  //     ③ 自检：合成的"写进存档"样本必须被①抓到（判据非空转）
  const appSrc = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  // ★ 必须先剥注释（本项目已踩过 3 次："注释里提到模式名也算违规"）
  const appCode = appSrc.split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
  const 存档行 = appCode.split(/\r?\n/).filter(l => /dailySnapshots/.test(l) && /(withScaleVersion|localStorage\.setItem|cloudState)/.test(l))
  ok(存档行.length === 0, 'dailySnapshots 未进 App 存档路径（一期天数据不持久化）', 存档行.join(' | '))
  const 读法行 = appCode.split(/\r?\n/).filter(l => /dailySnapshots/.test(l))
  const 非法读法 = 读法行.filter(l => !/\?\.dailySnapshots|dayFlows=\{[^}]*dailySnapshots/.test(l))
  ok(非法读法.length === 0, 'dailySnapshots 在 App.jsx 里每一处都是【只读消费】（传面板）· 不参与任何写盘',
    非法读法.join(' | '))
  const 合成 = 'cloudState = withScaleVersion({ weekInputs: x, dailySnapshots: y })'
  ok(/(withScaleVersion|localStorage\.setItem|cloudState)/.test(合成) && /dailySnapshots/.test(合成),
    '判据自检：合成的"把 dailySnapshots 写进存档"样本会被①抓到（判据非空转）')
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
process.exit(fail ? 1 : 0)
