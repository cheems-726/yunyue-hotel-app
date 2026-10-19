// V128-#3 批2 · 每日委托记录：持久化 / 去重 / 按天计数 / 周隔离
// 运行：node tests/dailyQuestLog.test.mjs   （挂 run-all fast）
import { 读委托记录, 追加委托记录, 完成天数, 委托完成率, 清空委托记录, 设置存储, 记录键 } from '../src/dailyQuestLog.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const map = new Map()
设置存储({ getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => { map.set(k, String(v)) }, removeItem: k => { map.delete(k) } })

console.log('▶ V128-#3 批2 · 委托记录')

console.log('\n[①] 追加与周隔离')
{
  ok(读委托记录(1).length === 0, '空记录 ⇒ []')
  const a = 追加委托记录(1, { 天: 1, 类: '差评处理', 选项: '道歉 + 补偿', 时刻: 't1' })
  ok(a.length === 1 && a[0].类 === '差评处理', '追加一条 ⇒ 可在第 1 周读到')
  ok(读委托记录(2).length === 0, '第 2 周读不到第 1 周的记录（按周隔离）')
  const b = 追加委托记录(1, { 天: 1, 类: '差评处理', 选项: '不回复', 时刻: 't2' })
  ok(b.length === 1, '同一天同一类重复提交 ⇒ 不追加（防刷）')
  const c = 追加委托记录(1, { 天: 2, 类: '客人在店', 选项: '送券安抚', 时刻: 't3' })
  ok(c.length === 2, '换一类/换一天 ⇒ 追加')
  ok(map.has(记录键), '写进了 localStorage 键')
}

console.log('\n[②] 按天计数（一天最多算 1 天）')
{
  ok(完成天数(读委托记录(1)) === 2, `第 1 天 + 第 2 天 ⇒ 完成 2 天（实得 ${完成天数(读委托记录(1))}）`)
  const r = 委托完成率(读委托记录(1), 4)
  ok(r.完成 === 2 && r.应完成 === 4 && r.文案 === '2/4', `完成率 = 2/4（实得 ${r.文案}）`)
  ok(委托完成率(读委托记录(1), 0).文案 === null, '本周 0 天 ⇒ 文案 null（显示 —）')
  ok(委托完成率([], 3).文案 === '0/3', '没做 ⇒ 0/3（不是 null，应完成已明确）')
}

console.log('\n[③] 换号/重开清空')
{
  清空委托记录()
  ok(读委托记录(1).length === 0 && !map.has(记录键), '清空后记录为空')
}

console.log('\n[④] 只记录护栏：引擎不读')
{
  const { readFileSync } = await import('node:fs')
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
  const eng = strip(readFileSync('src/settlement.js', 'utf8'))
  ok(!/每日委托|dailyQuest/.test(eng), '★ settlement.js 不引用每日委托（第一版只记录）')
  const wi = readFileSync('src/weekInputs.mjs', 'utf8')
  ok(/每日委托: 委托记录净化\(dailyQuests\)/.test(wi), 'weekInputs 落库含 每日委托')
  ok(/每日委托: 委托记录净化\(w\.每日委托\)/.test(wi), 'weekInputsOf 读回 每日委托（旧载荷 ⇒ []）')
}

console.log('\n[⑤] 学生端/教师端/台账接线（静态）')
{
  const { readFileSync } = await import('node:fs')
  const app = readFileSync('src/App.jsx', 'utf8')
  ok(/<DailyQuests 委托们=\{委托们\}/.test(app), '经营页渲染今日委托卡')
  ok(/function 确认委托\(q, 选项, 文本\)/.test(app) && /追加委托记录\(week/.test(app), '确认委托 ⇒ 写记录')
  ok(/set每日委托反思\(prev =>/.test(app), '写一句 ⇒ 存 每日委托反思')
  ok(/dailyQuests: 读委托记录\(week\)/.test(app), 'weekInputs 带上本周委托记录')
  ok(/委托记录=\{委托记录\} 本周天数=/.test(app), '「我的」台账传委托完成数/应完成数')
  const td = readFileSync('src/TeacherDashboard.jsx', 'utf8')
  ok((td.match(/每日委托: \(gs\.state && gs\.state\.weekInputs && gs\.state\.weekInputs\.每日委托\)/g) || []).length === 2, '教师端两处（展示+导出）都传委托记录')
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
