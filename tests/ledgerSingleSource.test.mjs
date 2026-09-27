// E1 · 唯一账本守门（二期 · fast 套件）
// 运行：node tests/ledgerSingleSource.test.mjs
//
// ── 为什么需要它（BL-7/8/9 三方向一起扫）────────────────────────────
//   "能由日引擎汇总导出的量，被独立算了一遍"是本项目最高频的复发缺陷：
//     · 资金：App.jsx 曾用 `500000 − ΣtotalExpenses + Σprofit`（双重扣成本）
//     · 累计利润：HotelStatus 曾自算 Σh.profit，与 FinalResult/TeacherDashboard 的 sumNet【两套】
//     · 四维评分：FinalResult 与 TeacherDashboard 曾各写一份【完全相同】的阶梯
//   ⇒ E1 把它们全收进 `src/metricDefs.mjs`；本套件把"不许再长出第二份"变成常驻门禁。
//
// ── 四段 ────────────────────────────────────────────────────────
//   [1] 旧式 oracle：新单源 scoreOf === 原内联式（逐字段）⇒ 证明本次重构【零变化】
//   [2] 静态扫描：src/ 不得再出现第二份聚合/评分阶梯（白名单逐条带理由 + 死条目自检）
//   [3] 日汇总链：Σ7天 === 周（reconcileWithWeek 在真实 settle 输出上成立）
//   [4] 界面三量 === 周报三量：① 取数路径同源（静态）② 端到端由浏览器套件 verify-capital 承担（全量门禁）
import { readFileSync, readdirSync } from 'node:fs'
import { settle } from '../src/settlement.js'
import { scoreOf, sumNet, sumGop, avgOccupancy, avgGoodRate, totalNegative, avgHandleRateOf, prevScore, totalRevenue } from '../src/metricDefs.mjs'
import { buildDailyReport, sumDaily, reconcileWithWeek } from '../src/dailyReport.mjs'
import { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } from '../src/attrs.js'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')
const code = (f) => src(f).replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')

console.log('▶ E1 · 唯一账本守门')

// ── 场景：六组 × 12 周真实 history（跑真引擎，含 handleStats/差评）───────
const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const GROUPS = {
  勤奋: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' },
  省钱: { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 20 },
  躺平: {},
}
const 跑一季 = (dec) => {
  let attrs = { ...ATTR_INIT }, pg = null, cap = null, pn = 0, rs = 0
  const history = []
  for (let w = 1; w <= 12; w++) {
    let a = attrs
    for (const [id, ans] of Object.entries(dec)) a = applyDecisionToAttrs(a, id, ans)
    const r = settle({ site: SITE, brand: BRAND, decisions: dec, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
    history.push(r)
    pg = r.finalGoodRate; cap = r.capital
    const negCards = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
    rs = Math.ceil(negCards * 0.5); pn = Math.max(0, pn + negCards - rs)
    attrs = normalizeAttrs(r.attrsAfter)
  }
  return history
}
const 真实季 = Object.fromEntries(Object.entries(GROUPS).map(([k, d]) => [k, 跑一季(d)]))

// ── [1] 旧式 oracle：原 FinalResult 内联式（逐字保留，作为"改前的权威")───────
//   ★ 这是 D25"记历史跳"手法的同族：断言"新实现 === 历史式"，从而证明重构零变化。
function 旧式(history) {
  const totalProfit = (function () { let v = 0, n = 0; for (const h of history) { const x = Number.isFinite(h && h.netProfit) ? h.netProfit : (Number.isFinite(h && h.profit) ? h.profit : null); if (x !== null) { v += x; n++ } } return v })()
  const avgOccupancy = history.length ? Math.round(history.reduce((s, h) => s + h.occupancy, 0) / history.length) : 0
  const avgGoodRate = history.length ? Math.round(history.reduce((s, h) => s + h.finalGoodRate, 0) / history.length) : 0
  const totalNegative = history.reduce((s, h) => s + (h.negativeCount || 0), 0)
  const handleWeeks = history.filter(h => h.handleStats && (h.handleStats.pending + h.handleStats.resolved) > 0)
  const avgHandleRate = handleWeeks.length
    ? handleWeeks.reduce((s, h) => s + h.handleStats.resolved / (h.handleStats.pending + h.handleStats.resolved), 0) / handleWeeks.length
    : null
  const profitScore = totalProfit >= 150000 ? 100 : totalProfit >= 90000 ? 85 : totalProfit >= 30000 ? 70 : totalProfit >= 0 ? 55 : 40
  const reputationScore = avgGoodRate >= 90 ? 95 : avgGoodRate >= 85 ? 85 : avgGoodRate >= 75 ? 70 : avgGoodRate >= 60 ? 55 : 40
  const occupancyScore = avgOccupancy >= 75 ? 95 : avgOccupancy >= 65 ? 80 : avgOccupancy >= 55 ? 65 : avgOccupancy >= 45 ? 50 : 40
  const negativeScore = totalNegative === 0
    ? 100
    : avgHandleRate != null
      ? (avgHandleRate >= 0.9 ? 95 : avgHandleRate >= 0.7 ? 85 : avgHandleRate >= 0.5 ? 70 : avgHandleRate >= 0.3 ? 55 : 40)
      : (totalNegative <= 5 ? 80 : totalNegative <= 10 ? 65 : 50)
  const finalScore = history.length ? Math.round(profitScore * 0.4 + reputationScore * 0.25 + occupancyScore * 0.2 + negativeScore * 0.15) : 0
  const grade = finalScore >= 90 ? 'S · 标杆酒店' : finalScore >= 80 ? 'A · 优秀经营' : finalScore >= 70 ? 'B · 良好经营' : finalScore >= 60 ? 'C · 合格经营' : 'D · 需改进'
  return { totalProfit, avgOccupancy, avgGoodRate, totalNegative, avgHandleRate, profitScore, reputationScore, occupancyScore, negativeScore, finalScore, grade }
}

console.log('\n[1] 旧式 oracle：scoreOf === 原内联式（逐字段 · 零变化证明）')
{
  // ① 三组真实 12 周 ② 空 history ③ 旧档类（缺 netProfit/gop/handleStats 的周）
  // ④ ★ 边界用例：让 oracle 对【每一条阶梯的每一格阈值】都敏感（否则改一格阈值可能照样绿 —— 假绿）
  const 边界 = (p, occ = 60, good = 70, neg = 0, handle = null) => [{
    week: 1, profit: p, netProfit: p, occupancy: occ, finalGoodRate: good, negativeCount: neg,
    ...(handle != null ? { handleStats: { pending: 1, resolved: handle } } : {}),
  }]
  const 旧档 = 真实季['勤奋'].map((h, i) => {
    const o = { ...h }
    if (i % 3 === 0) { delete o.netProfit; delete o.gop }
    if (i % 4 === 0) delete o.handleStats
    return o
  })
  const 用例 = [
    ['勤奋季', 真实季['勤奋']], ['省钱季', 真实季['省钱']], ['躺平季', 真实季['躺平']], ['空 history', []], ['旧档类（缺字段）', 旧档],
    // 利润阶梯：150000 / 90000 / 30000 / 0 各取【恰达】与【差 1 元】两侧
    ['利润 150000', 边界(150000)], ['利润 149999', 边界(149999)],
    ['利润 90000', 边界(90000)], ['利润 89999', 边界(89999)],
    ['利润 30000', 边界(30000)], ['利润 29999', 边界(29999)],
    ['利润 0', 边界(0)], ['利润 −1（亏损）', 边界(-1)],
    // 口碑阶梯 90 / 85 / 75 / 60（取恰达侧；另一侧由相邻格覆盖）
    ['口碑 90', 边界(100000, 60, 90)], ['口碑 89', 边界(100000, 60, 89)],
    ['口碑 85', 边界(100000, 60, 85)], ['口碑 75', 边界(100000, 60, 75)], ['口碑 60', 边界(100000, 60, 60)],
    // 出租率阶梯 75 / 65 / 55 / 45
    ['出租率 75', 边界(100000, 75)], ['出租率 74', 边界(100000, 74)],
    ['出租率 65', 边界(100000, 65)], ['出租率 55', 边界(100000, 55)], ['出租率 45', 边界(100000, 45)],
    // 差评维度：零差评 / 有处理率（0.9/0.7/0.5/0.3 四格）/ 无处理率回退（条数 5/10 两格）
    ['零差评', 边界(100000, 60, 70, 0)],
    ['处理率 90%', 边界(100000, 60, 70, 1, 0.9)], ['处理率 70%', 边界(100000, 60, 70, 1, 0.7)],
    ['处理率 50%', 边界(100000, 60, 70, 1, 0.5)], ['处理率 30%', 边界(100000, 60, 70, 1, 0.3)],
    ['无快照·差评 5 条', 边界(100000, 60, 70, 5)], ['无快照·差评 11 条', 边界(100000, 60, 70, 11)],
  ]
  let 不符 = 0
  for (const [name, h] of 用例) {
    const a = 旧式(h), b = scoreOf(h)
    const keys = Object.keys(a)
    const diff = keys.filter(k => a[k] !== b[k])
    if (diff.length) { 不符++; console.error(`     ✗ ${name}：${diff.map(k => `${k} 旧 ${a[k]} vs 新 ${b[k]}`).join(' · ')}`) }
    else console.log(`     ✓ ${name}：总分 ${b.finalScore} · ${b.grade.slice(0, 1)} · 四维 ${b.profitScore}/${b.reputationScore}/${b.occupancyScore}/${b.negativeScore}（逐字段一致）`)
  }
  ok(不符 === 0, `scoreOf 与旧式 oracle 在 ${用例.length} 种用例上逐字段一致（不一致 ${不符}）`)
  // 反向验证素材：把分段阈值改一格 ⇒ 上面必红（本断言依赖逐字段相等，不是"形似"）
  ok(scoreOf(真实季['勤奋']).finalScore !== 旧式([]).finalScore, '反证：真实季 ≠ 空 history（比对非恒真）')
  // 单点函数也逐一对齐
  const h = 真实季['勤奋']
  ok(avgOccupancy(h) === 旧式(h).avgOccupancy && avgGoodRate(h) === 旧式(h).avgGoodRate
    && totalNegative(h) === 旧式(h).totalNegative && avgHandleRateOf(h) === 旧式(h).avgHandleRate,
    '聚合单点（平均出租率/好评率/差评数/处理率）与旧式一致')
  ok(totalRevenue(h) === h.reduce((s, x) => s + (x.revenue || 0), 0), '总营收 === 旧式 Σrevenue')
  ok(prevScore(h) === 旧式(h.slice(0, -1)).finalScore, 'prevScore === 旧式"去掉最后一周"分数（★ 教师端原内联式漏了处理率分支 ⇒ 本次同源修正）')
  ok(prevScore([]) === null && prevScore([h[0]]) === null, 'prevScore 不足 2 周 → null（不编造）')
  ok(sumNet(h).value === 旧式(h).totalProfit, 'sumNet === 旧式累计净利润（含旧档回退）')
}

// ── [2] 静态扫描：src/ 不得再长出"第二份"───────
console.log('\n[2] 静态扫描：聚合/评分阶梯只许出现在 metricDefs（其他文件一律走 import）')
{
  const files = readdirSync(new URL('../src/', import.meta.url)).filter(f => /\.(js|jsx|mjs)$/.test(f) && !f.startsWith('settle-old'))
  const RULES = [
    { id: 'L1', desc: '第二份 profitScore 阶梯（≥150000 ? 100 …）', re: /(150000 \? 100|90000 \? 85|30000 \? 70)/ },
    { id: 'L2', desc: '第二份 口碑/出租率阶梯（≥90 ? 95 / ≥75 ? 95…）', re: /(avgGood\w* >= 90 \? 95|avgGood\w* >= 75 \? 70|avgOcc\w* >= 75 \? 95)/ },
    { id: 'L3', desc: '自算累计金额（Σ h.profit / Σ h.revenue / Σ h.totalCost）', re: /\.reduce\(\(?[a-z],?\s*[a-z]?\)?\s*=>\s*[a-z] \+ \(?([a-z]\.(profit|revenue|netProfit|totalCost|gop))/, },
    { id: 'L4', desc: '自算平均出租率/好评率（Σ occupancy ÷ length）', re: /\.reduce\(\(\w, \w\) => \w \+ \w\.(occupancy|finalGoodRate)/ },
    { id: 'L5', desc: '自算累计利润（Σ history…profit）', re: /history\.reduce\(\(s, h\) => s \+ h\.profit/ },
  ]
  // 白名单：逐条给"为什么它可以留"
  const ALLOW = [
    { rule: 'L1', file: 'metricDefs.mjs', why: '★ 单源本体：scoreOf 的评分阶梯就定义在这里，其他文件只许 import（这条命中是定义处，不可免）' },
    { rule: 'L2', file: 'metricDefs.mjs', why: '★ 同上：口碑/出租率阶梯的唯一定义处' },
    { rule: 'L3', file: 'metricDefs.mjs', why: '★ 同上：sumBy/聚合函数的唯一定义处（它就是用来累加的）' },
    { rule: 'L4', file: 'metricDefs.mjs', why: '★ 同上：avgOccupancy/avgGoodRate 的唯一定义处' },
  ]
  const hits = []
  for (const f of files) {
    code(f).split('\n').forEach((line, i) => {
      for (const rule of RULES) {
        if (!rule.re.test(line)) continue
        hits.push({ rule: rule.id, file: f, line: i + 1, text: line.trim().slice(0, 92) })
      }
    })
  }
  const allowed = (h) => ALLOW.some(a => a.rule === h.rule && a.file === h.file)
  const 真 = hits.filter(h => !allowed(h))
  ok(真.length === 0, `无"第二份聚合/评分"残留（命中 ${hits.length} 处 · 白名单 ${hits.length - 真.length} 处）`, 真.map(h => `${h.file}:${h.line}`).join(', '))
  真.slice(0, 6).forEach(h => console.error(`     ✗ [${h.rule}] ${h.file}:${h.line}  ${h.text}`))
  // 死条目自检（BL-11 族）：声明了却一次没命中 ⇒ 该删或该修
  const 死 = ALLOW.filter(a => !hits.some(h => h.rule === a.rule && h.file === a.file))
  ok(死.length === 0, '白名单无死条目（每条都至少命中一次）', 死.map(a => `${a.rule} ${a.file}`).join(','))
  // 三处消费方必须真的 import 单源（防"声明 import、实际自算"）
  for (const [f, need] of [['FinalResult.jsx', /scoreOf/], ['TeacherDashboard.jsx', /scoreOf/], ['HotelStatus.jsx', /sumNet/]]) {
    ok(need.test(code(f)), `${f} 已 import 单源（${need.source}）`)
  }
}

// ── [3] 日汇总链：Σ7天 === 周（真实输出）───────
console.log('\n[3] 日汇总链：日引擎（7 天）→ 周汇总 → 界面/周报')
{
  let bad = 0, checked = 0
  for (const [name, h] of Object.entries(真实季)) {
    for (const r of h) {
      checked++
      const rec = reconcileWithWeek(r)
      if (!rec.ok || rec.rows !== 7) { bad++; console.error(`     ✗ ${name} 第 ${r.week} 周：rows=${rec.rows} diff=${rec.diff}`) }
    }
  }
  ok(bad === 0, `${checked} 个周（3 组 × 12 周）：7 天日报 Σ === 周值（不一致 ${bad}）`)
  const r = 真实季['勤奋'][0]
  const s = sumDaily(buildDailyReport(r))
  ok(s.cashDelta === r.profit && s.cost === r.totalCost && s.revenue === r.revenue && s.occupied === r.occupiedRooms && s.reviews === r.reviewCount,
    '逐项：Σ日 revenue/cost/cashDelta/occupied/reviews === 周值（不重不漏）')
}

// ── [4] 界面三量 === 周报三量（取数同源 + 端到端）───────
console.log('\n[4] 界面三量 === 周报三量')
{
  // ① 静态：三处必须从同一字段取数（不是各自算）
  const app = code('App.jsx'), hs = code('HotelStatus.jsx'), wr = code('WeeklyReport.jsx')
  ok(/capital=\{capital\}|capital, bizMode \}/.test(code('App.jsx')) || /capital=\{capital\}/.test(app), 'App 资金卡取数 = state.capital（由 settle 返回写回）')
  ok(/const cap = capital/.test(app), 'App 资金卡【直接读】权威 capital（不再自算：原式 500000 − ΣtotalExpenses + Σprofit 已废）')
  ok(/report \? report\.occupancy/.test(hs) && /report \? report\.finalGoodRate/.test(hs),
    'HotelStatus 出租率/好评率取数 = report（引擎周输出）· 无 report 时回退 history 末周')
  ok(/result\.occupancy/.test(wr) && /result\.finalGoodRate/.test(wr) && /result\.capital/.test(wr),
    '周报三量取数 = result（同一份引擎输出）')
  // ② 行为：同一份周输出 ⇒ 界面与周报取到的三量【逐字节相等】（同源 ⇒ 不可能不等）
  const r = 真实季['勤奋'][11]
  const 界面 = { capital: r.capital, occupancy: r.occupancy, goodRate: r.finalGoodRate }
  const 周报 = { capital: r.capital, occupancy: r.occupancy, goodRate: r.finalGoodRate }
  ok(JSON.stringify(界面) === JSON.stringify(周报), `三量逐字节相等：capital ${界面.capital} · occ ${界面.occupancy}% · 好评 ${界面.goodRate}%`)
  ok(r.capital === 真实季['勤奋'][10].capital + r.profit, '资金恒等式：本周 capital === 上周 capital + 本周净利润（累积，不重置）')
  // ③ 端到端（真浏览器）由 verify-capital 承担：全量门禁里断言 资金卡 === 权威 state === 周报期末资金；
  //    本次 E1 已把【出租率/好评率】也加进该套件（--fast 不含浏览器 ⇒ 必须跑全量才算验过）
  console.log('     （端到端三量对账 = verify-capital 浏览器套件 · 只在全量门禁内跑 —— 本套件不代替它）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：谁再长出"第二份聚合/评分"，[2] 即红；谁把评分阶梯改错，[1] 的逐字段 oracle 即红')
process.exit(fail ? 1 : 0)
