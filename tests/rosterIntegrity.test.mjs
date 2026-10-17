// V114-P2 判据：组 ↔ 账号 ↔ 存档 一一对应（6/6/0/0 由断言守住）
//   反例 RV：把审计端删掉的 5 条野行手工插回去 ⇒ 必红；
//            删掉一个学生的 game_states 行 ⇒ 「学生有组无数据」红；
//            插一条没人认领的组键 ⇒ 「组无学生」红。
import { 校验名册, 只取有效组, 组键 } from '../src/rosterIntegrity.mjs'

const bad = []
let 检查数 = 0
const ok = (cond, msg) => { 检查数++; if (!cond) bad.push(msg) }

// ── 干净态：6 名学生（酒管2401|1..6）+ 6 条存档；另有 2 位老师、2 个未分组测试号
const profiles = [
  ...Array.from({ length: 6 }, (_, i) => ({ user_id: `u${i + 1}`, role: 'student', student_no: `2024010${i + 1}`, class_name: '酒管2401', group_no: String(i + 1) })),
  { user_id: 't1', role: 'teacher', student_no: 'T001', class_name: '酒管2401', group_no: null },
  { user_id: 'x1', role: 'student', student_no: 'test1', class_name: '', group_no: null },
  { user_id: 'x2', role: 'student', student_no: '20240201', class_name: '酒管2401', group_no: null },
]
const gameStates = Array.from({ length: 6 }, (_, i) => ({ user_id: `u${i + 1}`, group_key: `酒管2401|${i + 1}`, state: {} }))

const r = 校验名册({ profiles, gameStates })
ok(r.通过 === true && r.违规.length === 0, `干净态应通过（违规：${JSON.stringify(r.违规)}）`)
ok(r.统计.有组学生 === 6 && r.统计.存档组 === 6 && r.统计.有数据且有组的交集 === 6, '6/6/6（有组学生 / 存档组 / 交集）')
ok(r.统计.未分组学生 === 2, '未分组学生应计入统计但不算违规')
ok(!r.违规.some(v => v.k.includes('野行')), '干净态不得有野行')

// ── 反例 ①：5 条野行插回去 ⇒ 必红
{
  const 野 = Array.from({ length: 5 }, () => ({ user_id: 'x', group_key: '', state: {} }))
  const r2 = 校验名册({ profiles, gameStates: [...gameStates, ...野] })
  ok(r2.通过 === false, '塞回野行必须红')
  ok(r2.违规.filter(v => v.k.startsWith('野行')).length === 5, `应报 5 条野行（实得 ${r2.违规.filter(v => v.k.startsWith('野行')).length}）`)
}

// ── 反例 ②：删一个学生的存档行 ⇒ 「学生有组无数据」
{
  const r3 = 校验名册({ profiles, gameStates: gameStates.slice(1) })
  ok(r3.违规.some(v => v.k === '学生有组无数据' && v.期望 === '酒管2401|1'), '删行必须报「学生有组无数据」')
}

// ── 反例 ③：一条没人认领的组键 ⇒ 「组无学生」
{
  const r4 = 校验名册({ profiles, gameStates: [...gameStates, { user_id: 'z', group_key: '酒管2401|99', state: {} }] })
  ok(r4.违规.some(v => v.k === '组无学生' && v.组键 === '酒管2401|99'), '孤儿组键必须报「组无学生」')
}

// ── 有效组过滤：野行/孤儿行一律不进统计
{
  const 有效 = 只取有效组({ profiles, gameStates: [...gameStates, { group_key: '' }, { group_key: '酒管2401|99' }] })
  ok(有效.length === 6, `过滤后应只剩 6 条有效组（实得 ${有效.length}）`)
  ok(有效.every(g => g.group_key && !g.group_key.endsWith('|99')), '过滤结果不得含野行/孤儿行')
}

// ── R114-1 回归：state 行【缺 group_key】（旧行/列未取）时，必须用 profile 的 班级|组号 兜底
//    线上实测症状：部署后教师端「0 组已开档」（6 条真实组行被当成野行全部滤掉）
{
  const 无键 = Array.from({ length: 6 }, (_, i) => ({ user_id: "u" + (i + 1), state: {} }))
  const 有效 = 只取有效组({ profiles, gameStates: 无键 })
  ok(有效.length === 6, "缺 group_key 的 6 条真实组行必须靠 profile 兜底保留（实得 " + 有效.length + "）—— 这就是 0 组已开档的根因")
  const 混 = [...无键, { user_id: "x2", state: {} }]
  ok(只取有效组({ profiles, gameStates: 混 }).length === 6, "未分组账号（group_no=null）仍不得进统计")
}

// ── 组键格式：班级|组号
ok(组键({ class_name: '酒管2401', group_no: 3 }) === '酒管2401|3', '组键必须 = 班级|组号')

console.log('══ V114-P2 名册一致性 ══')
console.log(`  干净态：学生 ${r.统计.学生数} · 有组 ${r.统计.有组学生} · 存档组 ${r.统计.存档组} · 未分组 ${r.统计.未分组学生}`)
for (const b of bad.slice(0, 8)) console.log('  ✗ ' + b)
console.log(`结果: ${检查数 - bad.length} 通过 / ${bad.length} 失败`)
process.exit(bad.length === 0 ? 0 : 1)
