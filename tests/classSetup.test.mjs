// V158 · 班级管理纯函数（建班校验/导入解析/口令规则）
// 运行：node tests/classSetup.test.mjs   （挂 run-all fast）
import { 校验班级名, 解析导入文本, 默认口令, 结果行 } from '../src/classSetup.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ V158 · 班级管理纯函数')
{
  ok(校验班级名('酒管2402').ok, '校验班级名：正常')
  ok(!校验班级名('').ok, '空 ⇒ 拒')
  ok(!校验班级名('ab').ok, '太短 ⇒ 拒')
  ok(!校验班级名('酒管 2401').ok, '含空格 ⇒ 拒')
  ok(!校验班级名('a/b').ok, '含斜杠 ⇒ 拒')
  const r = 解析导入文本('2024020101 张三\n2024020102 李四\nabc\n2024020101 王五')
  ok(r.valid.length === 2, `有效 2（实得 ${r.valid.length}）`)
  ok(r.duplicates.length === 1, `重复 1（实得 ${r.duplicates.length}）`)
  ok(r.errors.length === 1, `格式错 1（实得 ${r.errors.length}）`)
  ok(r.valid[0].姓名 === '张三', '姓名解析')
  ok(默认口令('2024020101') === '020101', `默认口令 = 学号后6位（${默认口令('2024020101')}）`)
  ok(结果行('01','张三','1','新建').结果 === '新建', '结果行')
}
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
