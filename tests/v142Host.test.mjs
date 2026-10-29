// V142 §1 · 非白名单域名（www）打开 ⇒ 红横幅 + 一键跳 test；localhost ⇒ 无横幅
import { chromium } from 'playwright-core'
import { spawn, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
let PORT = 4212
let server = null
if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(2) }
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

for (let p = 4212; p <= 4230; p++) {
  if (!(await fetch(`http://localhost:${p}/`).then(() => true).catch(() => false))) { PORT = p; break }
}
server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true })
for (let i = 0; i < 40; i++) { if (await fetch(`http://localhost:${PORT}/`).then(r => r.ok).catch(() => false)) break; await sleep(300) }

const browser = await chromium.launch({
  executablePath: EDGE, headless: true,
  // ★ 2026-10-29 审计端：本机开了系统代理（VPN）后，Chromium 会把 www…:4212 交给代理
  //   ⇒ 代理返回非 2xx ⇒ page.goto 报 ERR_HTTP_RESPONSE_CODE_FAILURE（本套件误红）
  //   `--no-proxy-server` 实测可解；`--proxy-bypass-list=*` 不够（PAC 仍生效）
  args: ['--host-resolver-rules=MAP www.2026911301.xyz 127.0.0.1', '--no-proxy-server'],
})
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(`http://www.2026911301.xyz:${PORT}/`)
  await sleep(1200)
  const guard = await page.locator('[data-host-guard="1"]').count()
  const t = guard ? await page.locator('[data-host-guard="1"]').innerText() : ''
  ok(guard === 1, 'www 打开 ⇒ 出现旧站红横幅')
  ok(/旧站点/.test(t) && /www\.2026911301\.xyz/.test(t) && /test\.2026911301\.xyz/.test(t), '横幅说明旧域名与正式域名')
  ok(await page.locator('[data-host-jump="1"]').count() === 1, '有一键跳转按钮')

  // 点跳转：拦截外部导航，只验证目标 URL
  await page.route('https://test.2026911301.xyz/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>jumped</body></html>' }))
  await page.locator('[data-host-jump="1"]').click()
  await sleep(1200)
  ok(page.url().startsWith('https://test.2026911301.xyz/'), `一键跳转到 test（实得 ${page.url()}）`)

  const page2 = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page2.goto(`http://localhost:${PORT}/`)
  await sleep(1000)
  ok(await page2.locator('[data-host-guard="1"]').count() === 0, 'localhost 打开 ⇒ 无横幅')
} finally {
  await browser.close()
  try { if (server?.pid) { if (process.platform === 'win32') execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore', windowsHide: true }); else server.kill('SIGTERM') } } catch (e) {}
}
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
