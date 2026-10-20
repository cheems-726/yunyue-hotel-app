// V131 §1-D · 周报三问复盘（每题 ≥20 字）
// 运行：node tests/weekReview.test.mjs   （挂 run-all fast）
import { 复盘三问, 每题最短, 复盘合格, 复盘Of, 本周复盘完成 } from '../src/weekReview.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const 长 = (n = 20) => '想'.repeat(n)
console.log('▶ V131 §1-D · 周报三问')

console.log('\n[①] 三问固定 · 每题 ≥20 字')
{
  ok(复盘三问.length === 3, '恰好三问')
  ok(复盘三问.every(q => typeof q === 'string' && q.length > 4), '三问都有明确文本')
  ok(每题最短 === 20, '每题最短 20 字')
  ok(复盘合格([长(20), 长(20), 长(20)]) === true, '三问各 20 字 ⇒ 合格')
  ok(复盘合格([长(19), 长(20), 长(20)]) === false, '有一问 19 字 ⇒ 不合格（空想不能过）')
  ok(复盘合格([长(20), 长(20)]) === false, '只答两问 ⇒ 不合格')
  ok(复盘合格([长(20), '', 长(20)]) === false, '有一问空白 ⇒ 不合格')
  ok(复盘合格([长(20), '   ' + 长(20) + '   ', 长(20)]) === true, '首尾空格不算字数')
}

console.log('\n[②] 复盘历史：按周取 + 闸门')
{
  const 史 = [{ week: 1, 三问: [长(), 长(), 长()] }, { week: 2, 三问: [长(19), 长(), 长()] }]
  ok(复盘Of(史, 2) && 复盘Of(史, 2).三问.length === 3, '取第 2 周')
  ok(复盘Of(史, 3) === null, '第 3 周没有 ⇒ null')
  ok(本周复盘完成(史, 1) === true, '第 1 周合格 ⇒ 完成')
  ok(本周复盘完成(史, 2) === false, '第 2 周有一问 19 字 ⇒ 未完成')
  ok(本周复盘完成(null, 1) === false, '空历史 ⇒ 未完成（闸门关）')
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
