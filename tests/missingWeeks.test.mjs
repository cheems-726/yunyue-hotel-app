// T2.4 / Phase E2 · 缺周展示兼容验收
// 运行：node tests/missingWeeks.test.mjs
// 判据（§十七·六 E2）：缺周【不参与】任何平均值分母 —— 构造"缺第 5、6 周"的 history，
//                      分数必须与"无缺周（同样的真实周，只是周号连续）"【同分母、同分】
import { missingWeeks, weekRows, missingLabel } from '../src/missingWeeks.mjs'
import { readFileSync } from 'node:fs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ T2.4 缺周展示（Phase E2）')

// 造 10 周真实数据：周 1-4、7-12（缺 5、6）
const mk = (w, seed) => ({
  week: w,
  occupancy: 55 + ((seed * 7 + w) % 20),
  finalGoodRate: 70 + ((seed * 5 + w) % 20),
  negativeCount: (seed + w) % 4,
  profit: 100000 + w * 1000,
  revenue: 120000 + w * 500,
  handleStats: { pending: 2 + (w % 3), resolved: 1 + (w % 2) },
})
const withGap = [1, 2, 3, 4, 7, 8, 9, 10, 11, 12].map(w => mk(w, 3))
const noGap = withGap.map((h, i) => ({ ...h, week: i + 1 }))   // 同样 10 条真实周，只是周号连续

console.log('\n[1] 缺口识别')
{
  ok(JSON.stringify(missingWeeks(withGap)) === '[5,6]', `缺周 = [5,6]（实得 ${JSON.stringify(missingWeeks(withGap))}）`)
  ok(missingWeeks(noGap).length === 0, '无缺口时为空')
  ok(missingWeeks([]).length === 0, '空 history → 空')
  ok(JSON.stringify(missingWeeks([{ week: 3 }, { week: 5 }])) === '[1,2,4]', '从周 1 起算（3/5 有 ⇒ 缺 1,2,4）')
}

console.log('\n[2] 展示行：占位出现，但真实行数不变（分母不动）')
{
  const rows = weekRows(withGap)
  const real = rows.filter(r => r.real)
  const ph = rows.filter(r => !r.real)
  ok(rows.length === 12, `展示行 12 行（1-12 周，实得 ${rows.length}）`)
  ok(real.length === withGap.length, `真实行 ${real.length} === history.length ${withGap.length}（★ 分母不变）`)
  ok(ph.length === 2 && ph.map(r => r.week).join(',') === '5,6', `占位行 = 缺周 5,6（实得 ${ph.map(r => r.week).join(',') || '无'}）`)
  ok(ph.every(r => r.h === null), '占位行不带数据对象（h === null）⇒ 无法被统计误用')
  ok(missingLabel(5) === '第 5 周 · 未经营（老师跳过）', `文案：${missingLabel(5)}`)
  ok(weekRows(noGap).every(r => r.real), '无缺口时全部为真实行（无占位）')
}

console.log('\n[3] ★ 同分母断言：缺周不改变任何均值与分数')
{
  // 复刻 FinalResult/TeacherDashboard 的四维口径（分母一律 history.length）
  const score = (h) => {
    const totalProfit = h.reduce((a, x) => a + x.profit, 0)
    const avgOcc = Math.round(h.reduce((a, x) => a + x.occupancy, 0) / h.length)
    const avgGood = Math.round(h.reduce((a, x) => a + x.finalGoodRate, 0) / h.length)
    const totalNeg = h.reduce((a, x) => a + x.negativeCount, 0)
    const hw = h.filter(x => x.handleStats && (x.handleStats.pending + x.handleStats.resolved) > 0)
    const rate = hw.length ? hw.reduce((a, x) => a + x.handleStats.resolved / (x.handleStats.pending + x.handleStats.resolved), 0) / hw.length : null
    const p = totalProfit >= 500000 ? 100 : totalProfit >= 300000 ? 85 : totalProfit >= 100000 ? 70 : totalProfit >= 0 ? 55 : 40
    const rep = avgGood >= 90 ? 95 : avgGood >= 85 ? 85 : avgGood >= 75 ? 70 : avgGood >= 60 ? 55 : 40
    const occ = avgOcc >= 75 ? 95 : avgOcc >= 65 ? 80 : avgOcc >= 55 ? 65 : avgOcc >= 45 ? 50 : 40
    const neg = totalNeg === 0 ? 100 : rate != null ? (rate >= 0.9 ? 95 : rate >= 0.7 ? 85 : rate >= 0.5 ? 70 : rate >= 0.3 ? 55 : 40) : (totalNeg <= 5 ? 80 : totalNeg <= 10 ? 65 : 50)
    return { avgOcc, avgGood, totalProfit, score: Math.round(p * 0.4 + rep * 0.25 + occ * 0.2 + neg * 0.15) }
  }
  const a = score(withGap), b = score(noGap)
  ok(a.score === b.score, `缺第 5、6 周 ⇒ 期末分 ${a.score} === 无缺周 ${b.score}（同分母：${withGap.length} 周）`)
  ok(a.avgOcc === b.avgOcc && a.avgGood === b.avgGood && a.totalProfit === b.totalProfit,
    `均值同分母：avgOcc ${a.avgOcc} / avgGood ${a.avgGood} / 累计利润 ${a.totalProfit}
       三处均与无缺周一致`)
  // 反证：若把占位补成 0，分数会被稀释（说明"不补零"是必要的）
  const padded = weekRows(withGap).map(r => r.real ? r.h : { week: r.week, occupancy: 0, finalGoodRate: 0, negativeCount: 0, profit: 0, revenue: 0 })
  const c = score(padded)
  ok(c.score !== a.score, `反证：若把缺周补零当数据 → 分数掉到 ${c.score}（≠ ${a.score}）⇒ "不补零"是必要的`)
}

console.log('\n[4] 静态：三处展示都用同一模块，且不把占位塞回 history')
{
  const read = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')
  for (const f of ['FinalResult.jsx', 'TeacherDashboard.jsx', 'WeeklyReport.jsx']) {
    const src = read(f)
    ok(/missingWeeks/.test(src), `${f} 已引用 missingWeeks（缺周展示口径统一）`)
    ok(!/history\.push\(/.test(src), `${f} 未向 history push 占位（★ 分母不会被污染）`)
  }
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
