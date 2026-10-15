// V106 A3/A4 探针：引擎级、**不写库**（直接调同一份组装引擎）
import { advanceGroupOneDay, TICK_VERSION } from './engine/serverTick.mjs'

// 造一个「第 1 周已结算」的合成存档（带 1 条 history）
const w1hist = { week: 1, capital: 900000, attrs: { quality: 64, reputation: 70, morale: 65 }, profit: -100000 }
const save = {
  week: 1, capital: 1000000, attrs: { quality: 64, reputation: 70, morale: 65 },
  history: [w1hist], weekInputs: null, decisionChanges: null,
}
const J = (o) => JSON.stringify(o)

console.log('engineVersion =', TICK_VERSION)

// ── A3：推到第 8 天 ⇒ 应进第 2 周 ──
const r8 = advanceGroupOneDay(save, 8, { groupKey: 'probe' })
console.log('A3 classDay=8 :', J({
  advanced: r8.advanced, week: r8.week, dayIndex: r8.dayIndex,
  histBefore: save.history.length, histAfter: r8.save ? r8.save.history.length : null,
  旧周未被覆盖: r8.save ? J(r8.save.history[0]) === J(w1hist) : null,
  violations: r8.violations,
}))

// ── A3-b 幂等：同一天再算一次 ⇒ 不应再次推进 ──
const again = advanceGroupOneDay(r8.save || save, 8, { groupKey: 'probe' })
console.log('A3 幂等       :', J({ advanced: again.advanced }))

// ── A3-c 第 7 天（周中）⇒ 不应跨周 ──
const r7 = advanceGroupOneDay(save, 7, { groupKey: 'probe' })
console.log('A3 classDay=7 :', J({ advanced: r7.advanced, week: r7.week, dayIndex: r7.dayIndex }))

// ── A4：边界 classDay（不得抛错）──
for (const cd of [0, -5, 1, 6, 99999, NaN, null]) {
  try {
    const x = advanceGroupOneDay(save, cd, { groupKey: 'probe' })
    console.log(`A4 classDay=${String(cd).padEnd(6)} => advanced=${x.advanced} week=${x.week} dayIndex=${x.dayIndex}`)
  } catch (e) {
    console.log(`A4 classDay=${String(cd).padEnd(6)} => 抛错: ${e.message}`)
  }
}
