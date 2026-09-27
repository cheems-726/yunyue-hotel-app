// A-1 工具：重列【评级分布】（三件同源之二）
// 目的：租金曲线改后，6 组 × 12 周的【期末评级分布】是否变化（学生可见 ⇒ 必须逐组列明）
// 口径：评分公式与 src/FinalResult.jsx:46/48/50/57/60/63 【逐字一致】（本脚本只做"同公式跑两遍"）
// 运行：node tests/_a1-grades.mjs
import { settle as settleNow } from '../src/settlement.js'
import { settle as settlePre } from '../src/settle-old-a1.mjs'
import { SEASON_GROUPS, SEASON_SITE, SEASON_BRAND } from './_season6.mjs'
import { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } from '../src/attrs.js'

const WEEKS = 12
const RESOLVE = { '1勤奋型': () => 0.9, '2省钱型': () => 0.2, '3中间型': () => 0.5, '4躺平型': () => 0, '5激进型': () => 0.1, '6逆袭型': (w) => (w <= 6 ? 0.2 : 0.9) }

// —— 与 FinalResult.jsx 同公式（逐字）——
const scoreOf = ({ totalProfit, avgGoodRate, avgOccupancy, totalNegative, avgHandleRate }) => {
  const profitScore = totalProfit >= 150000 ? 100 : totalProfit >= 90000 ? 85 : totalProfit >= 30000 ? 70 : totalProfit >= 0 ? 55 : 40
  const reputationScore = avgGoodRate >= 90 ? 95 : avgGoodRate >= 85 ? 85 : avgGoodRate >= 75 ? 70 : avgGoodRate >= 60 ? 55 : 40
  const occupancyScore = avgOccupancy >= 75 ? 95 : avgOccupancy >= 65 ? 80 : avgOccupancy >= 55 ? 65 : avgOccupancy >= 45 ? 50 : 40
  const negativeScore = totalNegative === 0 ? 100
    : avgHandleRate != null ? (avgHandleRate >= 0.9 ? 95 : avgHandleRate >= 0.7 ? 85 : avgHandleRate >= 0.5 ? 70 : avgHandleRate >= 0.3 ? 55 : 40)
    : (totalNegative <= 5 ? 80 : totalNegative <= 10 ? 65 : 50)
  const finalScore = Math.round(profitScore * 0.4 + reputationScore * 0.25 + occupancyScore * 0.2 + negativeScore * 0.15)
  const grade = finalScore >= 90 ? 'S' : finalScore >= 80 ? 'A' : finalScore >= 70 ? 'B' : finalScore >= 60 ? 'C' : 'D'
  return { profitScore, reputationScore, occupancyScore, negativeScore, finalScore, grade }
}

function runAll(engine, label) {
  const out = []
  for (const [key, decide] of Object.entries(SEASON_GROUPS)) {
    let attrs = { ...ATTR_INIT }, pg = null, cap = null, pn = 0, rs = 0
    let totalProfit = 0, negTotal = 0
    const rows = [], handleWeeks = []
    for (let w = 1; w <= WEEKS; w++) {
      const decisions = decide(w)
      let a = attrs
      for (const [id, ans] of Object.entries(decisions)) a = applyDecisionToAttrs(a, id, ans)
      const r = engine({ site: SEASON_SITE, brand: SEASON_BRAND, decisions, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
      totalProfit += r.profit
      negTotal += r.negativeCount
      rows.push({ occupancy: r.occupancy, goodRate: r.finalGoodRate })
      if (r.handleStats && (r.handleStats.pending + r.handleStats.resolved) > 0) handleWeeks.push(r.handleStats.resolved / (r.handleStats.pending + r.handleStats.resolved))
      pg = r.finalGoodRate; cap = r.capital
      const negCards = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
      rs = Math.ceil(negCards * RESOLVE[key](w)); pn = Math.max(0, pn + negCards - rs)
      attrs = normalizeAttrs(r.attrsAfter)
    }
    const avgOccupancy = Math.round(rows.reduce((s, h) => s + h.occupancy, 0) / WEEKS)
    const avgGoodRate = Math.round(rows.reduce((s, h) => s + h.goodRate, 0) / WEEKS)
    const avgHandleRate = handleWeeks.length ? handleWeeks.reduce((a, b) => a + b, 0) / handleWeeks.length : null
    out.push({ key, totalProfit, ...scoreOf({ totalProfit, avgGoodRate, avgOccupancy, totalNegative: negTotal, avgHandleRate }) })
  }
  console.log(`\n════ ${label} ════`)
  console.log('组别      | 累计净利润 | 四维(利/碑/租/差)      | 总分 | 评级')
  for (const r of out) {
    console.log(`${r.key} | ${String(r.totalProfit).padStart(9)} | ${String(r.profitScore).padStart(3)}/${String(r.reputationScore).padStart(3)}/${String(r.occupancyScore).padStart(3)}/${String(r.negativeScore).padStart(3)} | ${String(r.finalScore).padStart(4)} | ${r.grade}`)
  }
  console.log('评级分布：' + out.map(r => r.grade).join(' ') + '   （组序 ' + out.map(r => r.key[0]).join(' ') + '）')
  return out
}

const now = runAll(settleNow, 'A-1 后（租金 25+档×5）')
const pre = runAll(settlePre, 'A-1 前（租金 35+档×10）')

console.log('\n════ 逐组对照（A-1 前 → 后）════')
let changed = 0
for (let i = 0; i < now.length; i++) {
  const a = pre[i], b = now[i]
  const same = a.grade === b.grade && a.finalScore === b.finalScore
  if (!same) changed++
  console.log(`${a.key}：评级 ${a.grade}(${a.finalScore}) → ${b.grade}(${b.finalScore})${same ? '  一致' : '  ★变了'} · 累计净利润 ${a.totalProfit} → ${b.totalProfit}（+${b.totalProfit - a.totalProfit}）`)
}
console.log(`\n评级变化组数：${changed}/6 ${changed === 0 ? '（★ 分布与 A-1 前【逐组一致】）' : '（★ 有变化，须写进学生感知清单）'}`)

// ── 三件同源之三：W12 m 算法（总和法 vs 逐组倍数）────────────────────
const sumPre = pre.reduce((s, r) => s + r.totalProfit, 0)
const sumNow = now.reduce((s, r) => s + r.totalProfit, 0)
console.log('\n════ W12 m 重列（A-1 前 → 后）════')
console.log(`六组总利润：${sumPre} → ${sumNow} ⇒ 总和法 m = ${(sumNow / sumPre).toFixed(4)}`)
console.log(`逐组倍数：${pre.map((a, i) => `${a.key} ${a.totalProfit === 0 ? '—' : (now[i].totalProfit / a.totalProfit).toFixed(3)}×`).join(' · ')}`)
const deltas = pre.map((a, i) => now[i].totalProfit - a.totalProfit)
console.log(`逐组绝对增量：${deltas.join(' / ')}（极差 ${Math.max(...deltas) - Math.min(...deltas)} 元）`)
console.log('★ 判读：A-1 的效果是【加性平移】（Δ 只与房量/租金档有关，与经营成败无关），')
console.log('  第 4/5 组还发生【符号翻转】（亏 → 赚）⇒ 乘法 m 在本项上【无解释力】，不得写成"利润 ×2.42"。')
