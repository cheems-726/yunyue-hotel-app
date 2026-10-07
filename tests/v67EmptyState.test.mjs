// V67 · 周报/成绩页未通电空态守门（挂 run-all fast）
// 判据（实测：scoreOf([])=0 ⇒ 教师端把"还没结算"显示成"0 分"，老师会误读为学生做得差）：
//   ① 教师端 summarize：无结算周 ⇒ score/scorePrev 置 null（不显示 0）
//   ② 渲染：null ⇒ 「未结算」（灰字 · title 说明何时有）· 排序对 null 兜底 · CSV 导出空串
//   ③ V63 同源说明块扩写「周报第 7 游戏日/期末 12 周/未结算≠做得差/现在想演示怎么办」
//   ④ 学生报表空态补期末成绩时点一句
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const td = readFileSync(join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src', 'TeacherDashboard.jsx'), 'utf8')
const app = readFileSync(join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src', 'App.jsx'), 'utf8')

console.log('▶ V67 · 周报/成绩空态守门')

// ① 无结算 ⇒ null（不许 0 分冒充）
ok(/const 无结算 = !Array\.isArray\(history\) \|\| history\.length === 0/.test(td), '① 无结算判定（history 空数组）')
ok(/score: 无结算 \? null : score, scorePrev: 无结算 \? null : scorePrev/.test(td), '① score/scorePrev 无结算 ⇒ null（不产 0 分）')

// ② 渲染与导出
ok(/g\.score == null \? '未结算' : g\.score/.test(td) && /第 7 个游戏日自动出第一份周报/.test(td), '② 渲染「未结算」+ title 说明何时有')
ok(/\(b\.score \?\? -1\) - \(a\.score \?\? -1\)/.test(td) && /const ranked = \[\.\.\.\(groups \|\| \[\]\)\]\.sort\(\(a, b\) => \(b\.score \?\? -1\) - \(a\.score \?\? -1\)\)/.test(td), '② 两处排序对 null 兜底（沉底不改已结算组序）')
ok(/g\.score \?\? '',/.test(td), '② CSV 导出 null ⇒ 空串（不导出 "null" 字样）')

// ③ V63 同源块扩写（同一块 · 条件仍绑 class_day_now）
ok(td.includes('周报/成绩什么时候有：第 7 个游戏日自动出第一份周报，此后每周一份；12 周经营结束后出期末成绩'), '③ 教师端写明周报/成绩时点（V63 同一块内）')
ok(td.includes('综合评分显示「未结算」= 这组还没到第一次结算，不代表学生做得差'), '③ 「未结算≠做得差」显式说明')
ok(td.includes('想现在就看周报演示，可让一组用离线演示推进到第 7 天'), '③ 给出"现在想演示周报怎么办"（卡内④）')
ok(/\{cloudOk && !\(classDay > 0\) && \(/.test(td), '③ 说明仍只在异常态显示（V63 同条件 · 不写死常显）')

// ④ 学生报表空态
ok(app.includes('周报在第 7 个游戏日自动产出；12 周经营结束后将生成期末成绩'), '④ 学生报表空态补期末时点（真实学期结构）')

console.log(`结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
