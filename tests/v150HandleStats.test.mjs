// V150 §3 · 页面差评处理写进评分链（floor 卡必须计入 handleStats ⇒ 15% 权重生效）
import { settleInputsFrom } from '../src/weekInputs.mjs'
import { scoreOf } from '../src/metricDefs.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
console.log('▶ V150 · 差评处理进评分')
const mk = (status) => ({ id: 'floor-w1', stars: 2, status })
const a = settleInputsFrom({ reviews: [mk('resolved')], week: 1 })
ok(a.resolvedCount === 1 && a.pendingNegatives === 0, 'floor 差评已解决 ⇒ resolvedCount=1（进评分）')
const b = settleInputsFrom({ reviews: [mk('pending')], week: 1 })
ok(b.pendingNegatives === 1, 'floor 差评待处理 ⇒ pendingNegatives=1')
const c = settleInputsFrom({ reviews: [mk('ignored')], week: 1 })
ok(c.pendingNegatives === 1, 'floor 差评忽略 ⇒ 仍算未处理')
const h0 = [{ week: 1, profit: 0, revenue: 100000, gop: 10000, occupancy: 70, finalGoodRate: 80, negativeCount: 1, reviewCount: 1, handleStats: { pending: 1, resolved: 0 } }]
const h1 = [{ ...h0[0], handleStats: { pending: 0, resolved: 1 } }]
const s0 = scoreOf(h0), s1 = scoreOf(h1)
console.log('   negativeScore', s0.negativeScore, '→', s1.negativeScore, '| final', s0.finalScore, '→', s1.finalScore)
ok(s1.negativeScore > s0.negativeScore && s1.finalScore >= s0.finalScore + 1, '处理一条 floor 差评 ⇒ 差评控制分上升、总分 ≥+1')
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
