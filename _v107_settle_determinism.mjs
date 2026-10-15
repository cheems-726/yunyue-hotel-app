// V107-E2 结算确定性探针：同一 (档, 周, 输入快照) 连算 N 次 ⇒ 逐字段 diff
//   用法（在测试机 /opt/yunyue/tick 下）：node settle_determinism.mjs <save.json> [classDay] [groupKey] [--repeat=N]
//   只读引擎，不写库。
import { readFileSync } from 'node:fs'
import { advanceGroupOneDay, TICK_VERSION } from './engine/serverTick.mjs'

const args = process.argv.slice(2)
const file = args.find(a => !a.startsWith('--')) || '/tmp/g1.json'
const classDay = Number(args.filter(a => !a.startsWith('--'))[1] || 7)
const gk = args.filter(a => !a.startsWith('--'))[2] || '酒管2401|1'
const N = Number((args.find(a => a.startsWith('--repeat')) || '--repeat=2').split('=')[1] || 2)
const base = JSON.parse(readFileSync(file, 'utf8'))

const lastHist = (save) => (Array.isArray(save?.history) && save.history.length ? save.history[save.history.length - 1] : null)
const pick = (save) => ({
  capital: save?.capital, week: save?.week,
  attrs: save?.attrs,
  h_capital: lastHist(save)?.capital, h_occupancy: lastHist(save)?.occupancy, h_revenue: lastHist(save)?.revenue,
  h_gop: lastHist(save)?.gop, h_netProfit: lastHist(save)?.netProfit, h_eventFine: lastHist(save)?.eventFine,
  h_otaScore: lastHist(save)?.world?.ota?.评分, h_goodRate: lastHist(save)?.好评率,
  h_reviewCount: lastHist(save)?.reviewCount, h_eventCount: (lastHist(save)?.events || []).length,
  h_events: (lastHist(save)?.events || []).map(e => e?.title || e?.name || e?.id || '?').join('|'),
})

const runs = []
for (let i = 0; i < N; i++) {
  // 每次都从**同一份深拷贝**出发（排除"引擎改写了入参"这一路）
  const r = advanceGroupOneDay(JSON.parse(JSON.stringify(base)), classDay, { groupKey: gk })
  runs.push({ advanced: r.advanced, week: r.week, dayIndex: r.dayIndex, violations: r.violations, snap: pick(r.save) })
}
console.log('engineVersion =', TICK_VERSION, '· classDay =', classDay, '· groupKey =', gk, '· repeat =', N)
console.log('第1次 advanced/week/dayIndex =', runs[0].advanced, runs[0].week, runs[0].dayIndex, '· violations =', JSON.stringify(runs[0].violations))

const keys = Object.keys(runs[0].snap)
let diffCount = 0
console.log('\n字段对照（第1次 vs 第2次…）：')
for (const k of keys) {
  const vals = runs.map(r => JSON.stringify(r.snap?.[k] ?? null))
  const same = vals.every(v => v === vals[0])
  if (!same) diffCount++
  console.log(`  ${same ? '=' : '≠'} ${k.padEnd(16)} ${same ? vals[0].slice(0, 70) : vals.map(v => v.slice(0, 44)).join('   ⟷   ')}`)
}
console.log(`\n${diffCount === 0 ? 'PASS —— 连算 ' + N + ' 次逐字段相等（确定性成立）' : 'FAIL —— ' + diffCount + ' 个字段在重复计算间不相等（确定性不成立）'}`)
process.exit(diffCount === 0 ? 0 : 1)
