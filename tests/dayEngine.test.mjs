// 第一期 D1 验收：日引擎（纯函数）—— 确定性 / Σ7天 ≡ 周 / 乱序补算一致 / 不碰全局随机
// 运行：node tests/dayEngine.test.mjs
import { simulateDay, simulateWeek, splitExact, dayWeights, DAYS_PER_WEEK } from '../src/dayEngine.js'
import { readFileSync } from 'node:fs'

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
  const codeOnly = srcRaw.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
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

console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
process.exit(fail ? 1 : 0)
