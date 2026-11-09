// V189 分母口径守门（返工单-20261109）· 静态断言，秒级
// 防回归：把 目标数 改回常量 18、或把显示层写回 doneCount/18 ⇒ 这里必红
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(join(ROOT, 'src', 'App.jsx'), 'utf8')

let pass = 0, fail = 0
const ok = (c, n, extra = '') => {
  if (c) { pass++; console.log('  ✓ ' + n) }
  else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) }
}

console.log('▶ V189 分母口径守门')

// ① 单一真相变量存在，且课堂模式取 9
ok(/const 目标数\s*=\s*模式 === 'classroom' \? 9 : 18/.test(src), '目标数 = 课堂 9 / 深度 18（单一真相）')
ok(/const 目标完成\s*=\s*模式 === 'classroom' \? 本周九项完成 : doneCount/.test(src), '目标完成 = 课堂按九项 / 深度按全量')

// ② 显示层不许再写死 /18（返回式）
ok(!/已决策 \{doneCount\}\/18/.test(src), '副标题不再写死 doneCount/18')
ok(!/本周决策 \{doneCount\}\/18/.test(src), '结算行不再写死 doneCount/18')
ok(!/doneCount \/ 18 \* 100/.test(src), '进度条宽度不再写死 /18')
ok(!/还有 \$\{18 - doneCount\} 项/.test(src), '「还有 N 项」不再写死 18 - doneCount')

// ③ 课堂模式文案必须自洽（9 项 + 其余按维持现状），不许出现「18 项已全部完成」在课堂模式
ok(/本周 9 项重点已全部完成/.test(src), '课堂模式文案：9 项重点已全部完成')
ok(/其余 9 项按维持现状结算/.test(src), '课堂模式文案：其余 9 项按维持现状结算')

// ④ 深度模式庆祝不得被课堂模式误触发（:562 守卫）
ok(/模式 !== 'classroom' && n === 18/.test(src), '满 18 庆祝加了课堂模式守卫')

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
