// V131 §1-B/§1-D · 思维项接线：关键理由必填 + 三问复盘闸门（静态 + 结构）
// 运行：node tests/v131Thinking.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
import { 本周关键决策 } from '../src/keyReasons.mjs'
import { 复盘三问, 复盘合格 } from '../src/weekReview.mjs'
import { decisions } from '../src/decisions.js'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const src = (f) => readFileSync('src/' + f, 'utf8')

console.log('▶ V131 §1-B/§1-D · 思维项接线')

console.log('\n[①] 关键理由：必填校验在"确认"之前')
{
  const dp = src('DecisionPanel.jsx')
  ok(/if \(要求理由 && !理由合格\(理由\)\) \{ set理由错误/.test(dp), '★ 关键决策未写理由 ⇒ confirm 直接 return（不是提交后提示）')
  ok(/disabled=\{!hasSelection \|\| \(要求理由 && !理由合格\(理由\)\)\}/.test(dp), '确认键在未写理由时禁用')
  ok(/data-reason-input="1"/.test(dp), '理由输入框在位（可被 E2E 定位）')
  ok(/onDone\(decision\.id, answer, 要求理由 \? 理由\.trim\(\) : ''\)/.test(dp), '理由随 onDone 上抛')
  const app = src('App.jsx')
  ok(/要求理由=\{本周关键决策\(decisions\)\.includes\(currentDecision\.id\)\}/.test(app), 'App 只对本周 3 项关键决策要求理由')
  ok(/set决策理由\(prev => \(\{ \.\.\.\(prev \|\| \{\}\), \[id\]: \{ week, 文本: String\(reason\)\.trim\(\)\.slice\(0, 30\) \} \}\)\)/.test(app), '理由按周落库（≤30 字）')
  const ids = 本周关键决策(decisions)
  ok(ids.length === 3 && ids.every(id => decisions.some(d => d.id === id)), '关键 3 项全部真实存在')
}

console.log('\n[②] 三问复盘：所有周 · 每题 ≥20 字 · 进闸门')
{
  const wr = src('WeeklyReport.jsx')
  ok(/const 需复盘 = !本周复盘完成\(复盘历史, result && result\.week\)/.test(wr), '★ 闸门读三问复盘（不再只看第 1 周）')
  ok(/disabled=\{需复盘 \|\| 需押注\}/.test(wr), '复盘未完成 ⇒ 进入下一周禁用')
  ok(/<WeekReview week=/.test(wr), '周报渲染三问复盘（所有周）')
  const rv = src('WeekReview.jsx')
  ok((rv.match(/data-review-q=\{i\}/g) || []).length === 1 && /复盘三问\.map/.test(rv), '三问逐题渲染（data-review-q 可定位）')
  ok(/复盘合格\(文本\)/.test(rv), '提交前校验三问合格')
  const app = src('App.jsx')
  ok(/复盘历史=\{复盘\} on复盘提交=\{提交复盘\}/.test(app), 'App 把复盘历史/提交回调接到周报')
  ok(/function 提交复盘\(三问\)/.test(app) && /复盘合格\(x\)/.test(app), '提交复盘走同一校验')
  ok(复盘三问.length === 3 && 复盘合格(['x'.repeat(20), 'y'.repeat(20), 'z'.repeat(20)]), '三问 × 20 字 ⇒ 合格')
}

console.log('\n[③] 台账：关键理由列不并入合计')
{
  const ps = src('processScore.mjs')
  ok(/关键理由: 关键条数/.test(ps) && /⑥关键理由/.test(ps), '台账/CSV 含 ⑥关键理由')
  ok(/const 项 = \[承诺, 归因分, 理由条数\]/.test(ps), '★ 合计仍只含 ①②③（关键理由不并入）')
  const rows = src('processLedgerRows.mjs')
  ok(/关键理由条数\(决策理由, 周, 本周关键决策\(\[\]\)\)/.test(rows), '教师端按本周 3 项计理由条数')
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
