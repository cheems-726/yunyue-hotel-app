// -*- coding: utf-8 -*-
// 前置修复：A 结算 TDZ / B 冒烟 assertClean 未定义 / C 两个浏览器脚本的 preview 进程回收
const fs = require('fs')
function patch(path, pairs) {
  let raw = fs.readFileSync(path, 'utf8')
  const crlf = raw.split('\r\n').length - 1
  const lf = raw.split('\n').length - 1 - crlf
  const nl = crlf > lf ? '\r\n' : '\n'
  let ok = true
  pairs.forEach(([o, n], i) => {
    const ot = o.split('\n').join(nl), nt = n.split('\n').join(nl)
    const c = raw.split(ot).length - 1
    if (c !== 1) { console.log(`  x ${path} 锚点${i + 1} 命中 ${c} 次：${ot.split(nl)[0].slice(0, 56)}`); ok = false; return }
    raw = raw.split(ot).join(nt)
    console.log(`  v ${path} 锚点${i + 1}：${ot.split(nl)[0].slice(0, 56)}`)
  })
  if (!ok) { console.log(`  -> 未写盘 ${path}`); return false }
  fs.writeFileSync(path, raw, 'utf8')
  console.log(`  -> 已写盘 ${path}`)
  return true
}

// ── A：insights 声明上移到使用之前（修 TDZ：18 项决策全做完且答案一致时结算整体崩溃）──
const A = patch('src/settlement.js', [
[`// 防作弊：全部决策选相同模式→可疑警告
const doneKeys = Object.keys(decisions).filter(k => !k.startsWith('__'))`,
 `// 决策复盘容器（必须在使用前声明：本文件下方多处 push，含"决策模式异常一致"的防作弊提醒）
const insights = []
// 防作弊：全部决策选相同模式→可疑警告
const doneKeys = Object.keys(decisions).filter(k => !k.startsWith('__'))`],
[`  // 14. 决策复盘（对关键决策给出评价）
  const insights = []
  // 未完成决策提醒（教学：不作为也是一种决策）`,
 `  // 14. 决策复盘（对关键决策给出评价；insights 已在文件上方声明）
  // 未完成决策提醒（教学：不作为也是一种决策）`],
])

// ── B：补 assertClean 实现（原本只被调用、从未定义；学生云端登录成功分支必抛 ReferenceError）──
const B = patch('tests/ui-smoke.mjs', [
[`async function assertLayout(pg, label) {`,
 `// 渲染整洁断言：页面文本不得出现插值残留/undefined/NaN/错误边界文案
// （🔴 已知教训：ErrorBoundary 白屏只走 console.error，单看 pageerror 会漏判 → 必须同时查页面文本）
async function assertClean(pg, label) {
  const t = await pg.evaluate(() => document.body.innerText)
  const bad = ['undefined', 'NaN', '[object Object]', '页面出了点问题'].filter(x => t.includes(x))
  ok(\`渲染整洁【\${label}】（无 undefined/NaN/错误边界）\`, bad.length === 0 && t.trim().length > 20)
  if (bad.length) console.log('    [命中] ' + bad.join(' / '))
  return bad
}

async function assertLayout(pg, label) {`],
// C-1：改用顶层 import 的 execSync（.mjs 里 require 会 ReferenceError，被 catch 吞掉）
[`import { spawn } from 'node:child_process'`,
 `import { spawn, execSync } from 'node:child_process'`],
[`try { if (server?.pid) process.platform === 'win32' ? require('node:child_process').execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }) : server.kill('SIGTERM') } catch (e) {}`,
 `try { if (server?.pid) { if (process.platform === 'win32') execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }); else server.kill('SIGTERM') } } catch (e) {}`],
])

// ── C-2：verify-live-review-ui 的进程回收（负 PID 进程组在 Windows 无效）──
const C = patch('tests/verify-live-review-ui.mjs', [
[`import { spawn } from 'node:child_process'`,
 `import { spawn, execSync } from 'node:child_process'`],
[`  try { process.kill(-server.pid) } catch (e) {}`,
 `  try {
    if (server?.pid) {
      if (process.platform === 'win32') execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' })
      else server.kill('SIGTERM')
    }
  } catch (e) {}`],
])

console.log(`\n结果：A=${A} B(ui-smoke)=${B} C(verify-live)=${C}`)
process.exit(A && B && C ? 0 : 1)
