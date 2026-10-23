// V149 §2 · 差评处理率四分支（生成/回复/不处理/无差评周）
import { 差评处理率 } from '../src/reviewStats.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
console.log('▶ V149 · 差评处理率')
const r = (status) => ({ status })
const a = 差评处理率([r('pending'), r('pending'), r('resolved'), r('ignored')], [])
ok(a.rate === 25 && a.pending === 2 && a.resolved === 1 && a.ignored === 1, `1 解决/2 待/1 忽略 ⇒ 25%（实得 ${a.rate}）`)
const b = 差评处理率([r('pending'), r('resolved')], [])
ok(b.rate === 50 && !b.noReviews, '1 解决/1 待 ⇒ 50%')
const c = 差评处理率([r('pending'), r('ignored')], [])
ok(c.rate === 0, '不处理（忽略）不提升处理率 ⇒ 0%')
const d = 差评处理率([], [])
ok(d.rate === null && d.noReviews, '无差评且无历史 ⇒ null（页面显示「—」不显示 0%）')
const e = 差评处理率([], [{ handleStats: { pending: 1, resolved: 1, ignored: 0 } }])
ok(e.rate === 50 && e.noReviews, '无差评周回退 history.handleStats ⇒ 50%')
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
