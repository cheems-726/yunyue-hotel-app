// V149 §1 · 手机登录页上部对齐（390×844 标题≤120px；桌面仍居中；无横向溢出）
import { chromium } from 'playwright-core'
import { spawn, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
let PORT = 4173, BASE = `http://localhost:${PORT}/`, server = null
if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(2) }
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const sleep = ms => new Promise(r => setTimeout(r, ms))
if (!(await fetch(BASE).then(r => r.ok).catch(() => false))) {
  for (let p = 4206; p <= 4230; p++) if (!(await fetch(`http://localhost:${p}/`).then(() => true).catch(() => false))) { PORT = p; BASE = `http://localhost:${p}/`; break }
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true })
}
for (let i = 0; i < 40; i++) { if (await fetch(BASE).then(r => r.ok).catch(() => false)) break; await sleep(300) }
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const topOf = async (page, text) => page.evaluate((t) => {
  const el = [...document.querySelectorAll('div')].find(x => x.textContent.trim() === t)
  return el ? Math.round(el.getBoundingClientRect().top) : null
}, text)
try {
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await mobile.goto(BASE); await mobile.evaluate(() => localStorage.clear()); await mobile.reload(); await sleep(800)
  await mobile.getByText('我是学生', { exact: true }).click(); await sleep(500)
  const mt = await topOf(mobile, '学生登录')
  ok(mt != null && mt <= 120, `390×844「学生登录」距顶部 ${mt}px ≤120`)
  const mj = await mobile.evaluate(() => getComputedStyle(document.querySelector('.login-page')).justifyContent)
  ok(mj === 'flex-start', `手机 .login-page justifyContent = ${mj}（flex-start）`)
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  ok(overflow, '390 无横向滚动')
  await mobile.locator('input[type=password]').focus()
  const vis = await mobile.evaluate(() => { const el = document.querySelector('input[type=password]'); const r = el.getBoundingClientRect(); return r.bottom <= window.innerHeight + 1 && r.top >= 0 })
  ok(vis, '聚焦密码框时在视口内（不被键盘遮挡的布局基础）')

  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await desk.goto(BASE); await desk.evaluate(() => localStorage.clear()); await desk.reload(); await sleep(800)
  await desk.getByText('我是学生', { exact: true }).click(); await sleep(500)
  const dj = await desk.evaluate(() => getComputedStyle(document.querySelector('.login-page')).justifyContent)
  ok(dj !== 'flex-start', `桌面 1440×900 未被手机媒体查询改写（justifyContent=${dj}）`)
} finally {
  await browser.close()
  try { if (server?.pid) { if (process.platform === 'win32') execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore', windowsHide: true }); else server.kill('SIGTERM') } } catch (e) {}
}
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
