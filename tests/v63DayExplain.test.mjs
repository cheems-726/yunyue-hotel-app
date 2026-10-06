// V63 · 「时间不推进」界面说明守门（挂 run-all fast）
// 判据（决策端线上实证：第 1/7 天不动却无任何解释 ⇒ 学生/老师误判卡死）：
//   ① 学生经营页：daySource==='local'（服务端 class_day_now 不可用·本地推算）⇒ 显示原因行；'server' ⇒ 不显示
//   ② 教师端：cloudOk 且 classDay<=0（class_day_now RPC 不可用）⇒ 显示原因+下一步；已同步 ⇒ 不显示
//   ③ 红线：条件绑真实通道信号（不许写死文案常显）· 不许假进度条
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const rd = f => readFileSync(join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src', f), 'utf8')
const app = rd('App.jsx')
const td = rd('TeacherDashboard.jsx')

console.log('▶ V63 · 时间不推进说明守门')

// ① 学生端：条件 + 文案 + 同步时不显示
ok(/\{daySource === 'local' && \(/.test(app), '① 学生端条件挂 daySource===local（服务端已同步 ⇒ 不显示）')
ok(app.includes('教学日程目前由本机推算（服务端同步未就绪：老师未设定开学日，或服务端自动推进未开启）⇒ 日子暂时不前进属正常，不是卡死'), '① 学生端文案（为什么+不是卡死+找谁）')
ok(/const 日来源 = Number\.isFinite\(serverClassDay\) && serverClassDay > 0 \? 'server' : 'local'/.test(app), '① 判据同源：日来源由 serverClassDay 实取值决定（fetchClassDay → class_day_now RPC）')

// ② 教师端：条件 + 文案 + 下一步
ok(/\{cloudOk && !\(classDay > 0\) && \(/.test(td), '② 教师端条件挂 cloudOk 且 classDay<=0（已同步 ⇒ 不显示）')
ok(td.includes('教学日程同步未就绪（服务端 class_day_now 不可用 ⇒ 开学日未设定，或服务端自动推进未部署）⇒ 全班经营时间暂不推进属正常，不是系统卡死'), '② 教师端文案（为什么）')
ok(td.includes('下一步：在班级设置里设定开学日，或完成服务端自动推进部署'), '② 教师端给出下一步怎么做')
ok(/fetchClassDay\(\)\.then\(d => \{ if \(d\) setClassDay\(d\) \}\)/.test(td), '② 判据同源：教师台 classDay 实取自 class_day_now RPC（0=不可用）')

// ③ 红线：不许假进度条（本批不得引入 progress/动画假进度）
ok(!/假进度|progressBar|进度条/.test(app.slice(app.indexOf('V63：时间不推进'), app.indexOf('V63：时间不推进') + 700)), '③ 说明行不造假进度（纯文字如实）')

console.log(`结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
