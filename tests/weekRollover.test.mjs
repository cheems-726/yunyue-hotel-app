// V127-#4 · 「进入下一周」口径：week+1 · doneDecisions 清空 · classDay 不变（D326）
// 运行：node tests/weekRollover.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
import { 下一周状态 } from '../src/weekRollover.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

console.log('▶ V127-#4 · 进入下一周（week+1 / 清决策 / classDay 不变）')

console.log('\n[行为] 纯函数：week 1 与 12 两个边界')
{
  const 报告 = { week: 1, revenue: 171423 }
  const 输入 = { history: [], report: 报告, week: 1 }
  const r = 下一周状态(输入)
  ok(r.week === 2, `week 1 ⇒ 2（实得 ${r.week}）`)
  ok(r.history.length === 1 && r.history[0] === 报告, '本周结果追加进 history（同一对象，不重算）')
  ok(r.doneDecisions && Object.keys(r.doneDecisions).length === 0, 'doneDecisions 清空')
  ok(r.finished === false && r.report === null, '非结业周：finished=false · report 关闭')
  ok(输入.history.length === 0, '入参不被修改（纯函数）')
  const last = 下一周状态({ history: [{ week: 1 }], report: { week: 12 }, week: 12 })
  ok(last.finished === true && last.week === 12, '第 12 周 ⇒ finished=true · week 不越界')
  ok(last.history.length === 2, '第 12 周结果同样追加进 history')
}

console.log('\n[零变化] 该路径不写 classDay / teacher_offset_days')
{
  // 只看代码，不看注释（注释里会解释"不碰 classDay"）
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
  const mod = strip(src('weekRollover.mjs'))
  ok(!/class_day|classDay|teacher_offset/.test(mod), '纯函数模块不引用 classDay / teacher_offset_days')
  const app = src('App.jsx')
  const 片段 = (app.match(/function handleNextWeek\(\)[\s\S]{0,700}?\n  \}/) || [''])[0]
  ok(/下一周状态\(\{ history, report, week \}\)/.test(片段), 'App.handleNextWeek 走纯函数（单一口径）')
  ok(/setWeek\(下一步\.week\)/.test(片段) && /setDoneDecisions\(\{\}\)/.test(片段), '应用侧仍执行 week+1 与清决策')
  ok(!/classDay|teacher_offset|saveGameState/.test(片段), '★ 进入下一周不碰 classDay、不写库（class_day_now 0 变化）')
}

console.log('\n[文档] 交接包 §4-4 判据已改为 D326 口径')
{
  const handoff = readFileSync(new URL('../../4-审计与报告/交接包-20261018-本轮全量与双端任务.md', import.meta.url), 'utf8')
  const 行 = (handoff.split(/\r?\n/).find(l => l.startsWith('| 4 |') && l.includes('进入下一周')) || '')
  ok(行.includes('week+1'), '判据写「week+1」')
  ok(行.includes('class_day_now') && 行.includes('不变'), '判据写「class_day_now 不变」')
  ok(行.includes('D326'), '标注 D326（决策来源）')
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
