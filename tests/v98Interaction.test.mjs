// ★ V98 · 交互一致性守门（2026-10-09 · 用户令「把交互这一类一次收干净」）
//   ① 清单表行数 === 导航面数（新增页漏配即红 · 与 V97 同源口径）
//   ② 危险操作必须有二次确认（拒绝类：window.confirm / 二次确认 文案）
//   ③ 空态必须有文案（拒绝：空数组直接渲染为空）
//   ④ 提交中必须有防重复（disabled 绑 pending/忙 类状态）
//   ⑤ 错误提示：云写入失败不得静默（负向：.catch(() => {}) 空兜在 saveDecisionLog 上 ⇒ 红）
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { 导航面 } from '../src/navStack.mjs'
let pass = 0, fail = 0
const ok = (c, m, e) => { c ? (pass++, console.log('  ✓ ' + m)) : (fail++, console.log('  ✗ ' + m + (e !== undefined ? '  ← ' + e : ''))) }
const APP = dirname(dirname(fileURLToPath(import.meta.url)))
const src = (f) => readFileSync(join(APP, 'src', f), 'utf8')
const 全 = readdirSync(join(APP, 'src')).filter(f => /\.jsx?$/.test(f)).map(f => src(f)).join('\n')

// ① 表行数
const P = join(APP, '..', '4-审计与报告', '交互一致性清单-v1.md')
let md = ''; try { md = readFileSync(P, 'utf8') } catch {}
ok(md.length > 0, '① 交互清单表存在（4-审计与报告/交互一致性清单-v1.md）')
const 行 = md.split('\n').filter(l => /^\|\s*(学生|教师)\s*\|/.test(l))
ok(行.length === 导航面.length, `① 清单表行数 === 导航面数（表 ${行.length} · 面 ${导航面.length}）· 新增页漏配即红`)

// ② 危险操作二次确认
const 危险 = 全.match(/window\.confirm\(/g) || []
ok(危险.length >= 1, `② 危险操作有二次确认（实测 window.confirm ×${危险.length} 处）`)

// ③ 空态文案
const 空态 = (全.match(/暂无|还没有|空空|暂无数据/g) || []).length
ok(空态 >= 5, `③ 空态有文案（实测 ${空态} 处『暂无/还没有』类文案）`)

// ④ 提交中防重复
const 防重 = (全.match(/disabled=\{(?:忙|saving|pending|loading|提交中|busy)/g) || []).length
ok(防重 >= 3, `④ 提交中有防重复（实测 ${防重} 处 disabled 绑 pending 类状态）`)

// ⑤ 错误提示：云写入不得静默（负向 · 可证伪）
const 阿 = src('App.jsx')
ok(/saveDecisionLog\(/.test(阿), '⑤ App.jsx 确实在写决策流水（前提断言）')
ok(!/saveDecisionLog\([\s\S]{0,400}?\.catch\(\(\) => \{\}\)/.test(阿), '⑤ 云写入失败**不静默**（空 catch 兜 ⇒ 本条红）')
ok(/toast\('决策已存本机/.test(阿), '⑤ 失败时有可见错误提示（toast 文案在册）')

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：新增页漏配 / 删掉二次确认 / 抹掉空态文案 / 摘掉 pending 禁用 / 把错误提示改回静默 ⇒ 本套件红')
process.exit(fail ? 1 : 0)
