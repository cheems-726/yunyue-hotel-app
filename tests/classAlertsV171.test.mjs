// V171 · 课堂预警纯层单测（六规则造数触发 / 无告警文案 / RV 去规则）+ 接线断言
import { readFileSync } from 'node:fs'
import { 课堂告警, 课堂节奏, 阈值, 规则表 } from '../src/classAlerts.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const mkState = (o) => ({ doneDecisions: {}, history: [], capital: 1490000, ...o })
const day = (i) => i
const 六组 = (fn) => Array.from({ length: 6 }, (_, i) => fn(i, '组' + (i + 1)))

console.log('▶ V171 · 课堂预警（纯层）')
{
  // 造数据：6 组各触发一条规则
  const groups = [
    { uid: 'u1', 组名: '组1', state: mkState({ doneDecisions: {}, history: [{}], capital: 1400000 }), updated_at: new Date().toISOString() },            // A1（0 决策 · 第 5 天）
    { uid: 'u2', 组名: '组2', state: mkState({ doneDecisions: { a: 1, b: 2, c: 3 }, history: [{}], capital: 1400000 }), updated_at: new Date().toISOString() }, // A2（3 项 · 第 6 天）
    { uid: 'u3', 组名: '组3', state: mkState({ history: [{ netProfit: -60000 }], capital: 1400000 }), updated_at: new Date().toISOString() },          // A3（单周净利）
    { uid: 'u4', 组名: '组4', state: mkState({ history: [{ handleStats: { pending: 4, resolved: 0 } }], capital: 1400000 }), updated_at: new Date().toISOString() }, // A4
    { uid: 'u5', 组名: '组5', state: mkState({ history: [{ finalGoodRate: 80 }, { finalGoodRate: 60 }], capital: 1400000 }), updated_at: new Date().toISOString() }, // A5
    { uid: 'u6', 组名: '组6', state: mkState({ history: [{}], capital: 1400000 }), updated_at: new Date(Date.now() - 9 * 86400000).toISOString() },   // A6
  ]
  const 告警 = 课堂告警({ groups, dayIndex: 6, 当前周: 12 })
  const has = (id, 组) => 告警.some(a => a.id === id && a.组名 === 组)
  ok(has('A1', '组1') && has('A2', '组2') && has('A3', '组3') && has('A4', '组4') && has('A5', '组5') && has('A6', '组6'),
    '六条规则各被造数触发（判据①）')
  ok(告警.every(a => a.依据 && a.依据.length > 4), '每条告警带字段依据')
  ok(告警[0].id === 'A1' || 告警[0].id === 'A2', '①② 优先排序')
  // 阈值边界：未决策但只到第 4 天 ⇒ 不告警
  const 早 = 课堂告警({ groups: [groups[0]], dayIndex: 4, 当前周: 12 })
  ok(!早.some(a => a.id === 'A1'), '第 4 天 0 决策不触发（宽限日 5）')
  // 判据②：无告警 ⇒ 正常文案（UI 由纯层数组空决定；此处断言空数组）
  const 好组 = (uid, 组名) => ({ uid, 组名, state: mkState({ doneDecisions: Object.fromEntries(Array.from({ length: 18 }, (_, k) => [k, 1])), history: [{ finalGoodRate: 80, netProfit: 1000 }], capital: 1450000 }), updated_at: new Date().toISOString() })
  const 无 = 课堂告警({ groups: [好组('g1', '组1'), 好组('g2', '组2'), 好组('g3', '组3'), 好组('g4', '组4'), 好组('g5', '组5'), 好组('g6', '组6')], dayIndex: 2, 当前周: 3 })
  ok(无.length === 0, '六组正常 ⇒ 告警空（UI 显示「六组状态正常」而非空白）')
  // 节奏卡
  const 满 = (uid) => ({ uid, 组名: uid, state: mkState({ doneDecisions: Object.fromEntries(Array.from({ length: 6 }, (_, k) => [k, 1])) }) })
  const 节 = 课堂节奏({ groups: [groups[1], groups[0], 满('x1'), 满('x2'), 满('x3'), 满('x4')], dayIndex: 5, 当前周: 12 })
  ok(节.已决策组数 === 4 && 节.距结算还需 === 2 && 节.天 === 5, '节奏卡：已决策组数/还需 M 组与库一致（判据①）')

  // RV（判据③）：去掉某规则 ⇒ 该条告警消失 ⇒ 断言红
  const 无A5源 = readFileSync(new URL('../src/classAlerts.mjs', import.meta.url), 'utf8')
  ok(/A5/.test(无A5源) && 告警.some(a => a.id === 'A5'), 'RV 锚：A5 在规则表且被触发（删规则 ⇒ 本断言红）')

  // 红线：阈值集中一处
  ok(typeof 阈值 === 'object' && 阈值.未决策宽限日 === 5 && 阈值.决策不足日 === 6, '阈值集中常量（红线）')
  ok(规则表.length === 6, '规则表六条')

  // 接线静态断言
  const dash = readFileSync(new URL('../src/TeacherDashboard.jsx', import.meta.url), 'utf8')
  ok(/data-class-alerts/.test(dash) && /六组状态正常/.test(dash), '教师端实时页卡点面板（无告警显示正常文案）')
  ok(/data-alert-log/.test(dash) && /200/.test(dash), '告警历史只读列表（≤200 行）')
  ok(/classAlerts\.mjs/.test(dash), '教师端走纯层（不内联第二份实现）')
  ok(!/fetch\(|supabase\./.test(readFileSync(new URL('../src/classAlerts.mjs', import.meta.url), 'utf8')), 'classAlerts.mjs 零网络零写库（红线）')
  const reg = readFileSync(new URL('./run-all.mjs', import.meta.url), 'utf8')
  ok(/classAlertsV171/.test(reg), 'run-all 已挂本套件')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
