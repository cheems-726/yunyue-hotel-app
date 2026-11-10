// D367-班级隔离 · 多班并存时不许串数据（与 D367 缺数据显示是两条独立判据）
//
// 覆盖任务卡四条验收：
//   ① running 班（第 1 周）+ archived 班（12 周）⇒ 本班不出现「学期已满」
//   ② 决策统计 = 本班分子 / (本班组数 × 9)
//   ③ 反向：本班确实跑到 12 周 ⇒ 仍要出现结课提示（证明不是把提示删了）
//   ④ 班级下拉默认只列 running；归档班可展开
import { readFileSync } from 'node:fs'
import { 过滤本班, 最大学期周, 决策项合计, 学期已满信号 } from '../src/classCalendar.mjs'

let pass = 0, fail = 0
const ok = (c, n, x = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (x ? '  [' + x + ']' : '')) } }

const 班映射 = {
  u2401a: '酒管2401', u2401b: '酒管2401',
  u2402a: '酒管2402',
}
const 存档 = [
  { user_id: 'u2401a', state: { history: Array.from({ length: 12 }, (_, i) => ({ week: i + 1 })), doneDecisions: { a: 1, b: 2, c: 3 } } },
  { user_id: 'u2401b', state: { history: Array.from({ length: 12 }, (_, i) => ({ week: i + 1 })), doneDecisions: { a: 1 } } },
  { user_id: 'u2402a', state: { history: [{ week: 1 }], doneDecisions: {} } },
]

console.log('▶ D367-班级隔离 · 多班不串数据')

console.log('\n[① 过滤：本班只留本班]')
{
  const 本班 = 过滤本班(存档, 班映射, '酒管2402')
  ok(本班.length === 1 && 本班[0].user_id === 'u2402a', `酒管2402 ⇒ 只留本班 1 个存档（实得 ${本班.length}）`)
  ok(过滤本班(存档, 班映射, '').length === 3, '空筛选 = 全部（管理视角仍可看全）')
}

console.log('\n[② 学期是否已满：只看本班]')
{
  const 本班2402 = 过滤本班(存档, 班映射, '酒管2402')
  ok(最大学期周(本班2402) === 1, `酒管2402 最大周 = 1（实得 ${最大学期周(本班2402)}）`)
  ok(学期已满信号(本班2402) === false, '第 1 周的班**不得**出现「学期已满」')
  ok(最大学期周(过滤本班(存档, 班映射, '')) === 12, '不按班过滤时才会看到 12（说明原 bug 的成因）')
}

console.log('\n[③ 反向：本班真满 12 周 ⇒ 提示必须还在]')
{
  const 满班 = [{ user_id: 'u2402a', state: { history: Array.from({ length: 12 }, (_, i) => ({ week: i + 1 })) } }]
  ok(学期已满信号(过滤本班(满班, 班映射, '酒管2402')) === true, '本班 12 周 ⇒ 学期已满信号为 true（不是把提示删了）')
}

console.log('\n[④ 决策统计：分子分母同班]')
{
  const 本班 = 过滤本班(存档, 班映射, '酒管2402')
  const liveList = 本班.map(gs => ({ entries: Object.entries((gs.state && gs.state.doneDecisions) || {}) }))
  const 本班组数 = 过滤本班([{ uid: 'u2402a' }, { uid: 'u2401a' }], 班映射, '酒管2402').length
  ok(决策项合计(liveList) === 0, `酒管2402 已完成项 = 0（实得 ${决策项合计(liveList)}）`)
  ok(本班组数 === 1, `酒管2402 组数 = 1（实得 ${本班组数}）`)
  ok(决策项合计(liveList) + ' / ' + (本班组数 * 9) === '0 / 9', '显示口径 = 0 / (本班组数 × 9) = 0 / 9')
  const 全量 = 决策项合计(存档.map(gs => ({ entries: Object.entries(gs.state.doneDecisions || {}) })))
  ok(全量 === 4, `不按班过滤时分子 = 4（原 bug 的 3/108 同族：分子分母都不在本班）`)
}

console.log('\n[⑤ 界面接线（静态 · 反向：删过滤即红）]')
{
  const src = readFileSync(new URL('../src/TeacherDashboard.jsx', import.meta.url), 'utf8')
  ok(/const 本班rawStates = 过滤本班\(rawStates, classByUid, filterClass\)/.test(src), '两条统计入口都先过 过滤本班()')
  ok(/学期已满信号\(本班rawStates\)/.test(src), '「学期已满」判断走本班存档（不是全量 rawStates）')
  ok(/const 本班组数 = 过滤本班\(groups, classByUid, filterClass\)\.length/.test(src), '统计分母 = 本班组数')
  ok(/本班组数 \* 9/.test(src), '分母 = 本班组数 × 9')
  ok(/semester_status \|\| 'running'\) === 'running'/.test(src), '班级下拉默认只列 running')
  ok(/data-show-archived/.test(src), '归档班有显式展开入口（不是藏起来）')
}

console.log(`结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
