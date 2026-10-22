// V140 §2/§3 · 真浏览器兜底验收（不是真机；真机矩阵另见批次报告）
// ① 登录页诊断面板：构建号 / UA / 内核 / SW / 复制 / 强制更新
// ② 人为抛错 ⇒ #boot-error 面板（含构建号/UA），不是白屏
// ③ 入口脚本加载失败 ⇒ #boot 骨架仍在，点「诊断」出面板
import { chromium } from 'playwright-core'
import { spawn, execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
let PORT = 4173
let BASE = `http://localhost:${PORT}/`
let server = null
if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(2) }
const 本地入口 = /assets\/(index-[A-Za-z0-9_-]+\.js)/.exec(readFileSync('dist/index.html', 'utf8'))?.[1]

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

if (!(await fetch(BASE).then(r => r.ok).catch(() => false))) {
  for (let p = 4206; p <= 4230; p++) {
    if (!(await fetch(`http://localhost:${p}/`).then(() => true).catch(() => false))) { PORT = p; BASE = `http://localhost:${p}/`; break }
  }
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true })
}
for (let i = 0; i < 40; i++) { if (await fetch(BASE).then(r => r.ok).catch(() => false)) break; await sleep(300) }

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
try {
  console.log('▶ V140 · 登录诊断面板')
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.goto(BASE)
    await page.getByText('我是学生', { exact: true }).click().catch(() => {})
    await sleep(500)
    await page.locator('details[data-login-diag="1"] summary').click()
    await sleep(800)
    const t = await page.locator('details[data-login-diag="1"]').innerText()
    const build = await page.locator('[data-diag-build="1"]').innerText().catch(() => '')
    const base = await page.locator('[data-diag-base="1"]').innerText().catch(() => '')
    ok(t.includes('构建号') && t.includes('UA：') && t.includes('内核：') && t.includes('Service Worker：'), '面板含 构建号/UA/内核/SW')
    if (本地入口) ok(build.includes(本地入口.replace(/\.js$/, '')), `构建号与 dist 入口一致（${build.trim()}）`)
    else ok(!!build, '构建号可读')
    ok(!!base.trim(), `接口地址可读（${base.trim()}）`)
    ok(t.includes('复制诊断信息') && t.includes('强制更新'), '面板含 一键复制 / 强制更新')
    await page.close()
  }

  console.log('\n▶ V140 · 人为抛错 ⇒ 兜底面板')
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.addInitScript(() => { setTimeout(function () { throw new Error('V140-RV 人为抛错') }, 300) })
    await page.goto(BASE)
    const 出现 = await page.waitForSelector('#boot-error', { timeout: 8000 }).then(() => true).catch(() => false)
    const t = 出现 ? (await page.locator('#boot-error').innerText()) + '\n' + (await page.locator('#boot-error textarea').inputValue().catch(() => '')) : ''
    ok(出现, '看到错误面板（不是白屏）')
    ok(t.includes('页面启动失败') && t.includes('构建号') && t.includes('UA：') && t.includes('内核：'), '面板含 构建号/UA/内核')
    ok(t.includes('V140-RV 人为抛错'), '面板含实际错误信息')
    await page.screenshot({ path: 'tests/_v140-error-panel.png' })
    await page.close()
  }

  console.log('\n▶ V140 · 入口脚本加载失败 ⇒ 静态骨架')
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    await ctx.route('**/assets/*.js', r => r.abort())
    const page = await ctx.newPage()
    await page.goto(BASE)
    await sleep(400)
    const bootText = await page.locator('#boot').innerText().catch(() => '')
    ok(/正在加载/.test(bootText), '脚本没跑起来时静态骨架仍在（正在加载…）')
    await page.locator('#boot-diag').click()
    const 面板 = await page.waitForSelector('#boot-error', { timeout: 5000 }).then(() => true).catch(() => false)
    const t = 面板 ? (await page.locator('#boot-error').innerText()) + '\n' + (await page.locator('#boot-error textarea').inputValue().catch(() => '')) : ''
    ok(面板 && t.includes('构建号') && t.includes('UA：'), '点「诊断」出错误面板（含构建号/UA）')
    await page.screenshot({ path: 'tests/_v140-offline-boot.png' })
    await ctx.close()
  }
} finally {
  await browser.close()
  try { if (server?.pid) { if (process.platform === 'win32') execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore', windowsHide: true }); else server.kill('SIGTERM') } } catch (e) {}
}
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
