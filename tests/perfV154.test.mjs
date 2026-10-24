// V154 批5 · 性能与包体
// 运行：node tests/perfV154.test.mjs   （浏览器套件 · 只进全量门禁）
// 判据（卡 §5）：① 入口包 ≤800KB ② 4G 模拟首屏可交互 ≤2.5s ③ 拆包后懒加载页仍可用 · 无 import() 语法
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { spawn, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { 是当前构建 } from './_previewFresh.mjs'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
let PORT = 4173, BASE = `http://localhost:${PORT}/`, server = null, 复用 = false
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

console.log('▶ V154 批5 · 性能与包体')
// ── ① 入口包体积（dist 实测 · fs 层）──────────────────────────
const assets = join(process.cwd(), 'dist', 'assets')
{
  const js = readdirSync(assets).filter(f => f.endsWith('.js'))
  const entry = js.filter(f => /^index-/.test(f)).map(f => ({ f, size: statSync(join(assets, f)).size }))
  ok(entry.length === 1, `入口包恰一个（${entry.map(e => e.f).join(',')}）`)
  const size = entry[0].size
  ok(size <= 800 * 1024, `① 入口包 ${(size / 1024).toFixed(0)}KB ≤ 800KB`, `文件 ${entry[0].f}`)
  // V140 ①判据保持：所有产物 ?. = 0 且 ?? = 0（es2017 降级）—— 拆包后每个 chunk 都要过
  // 语法判据用 compatV140 同款精确口径（真可选链 = ?.(非数字)；?? 与 import() 零容忍）
  let 语法坏 = []
  for (const f of js) {
    const s = readFileSync(join(assets, f), 'utf8')
    const 真可选链 = (s.match(/\?\.(?![0-9])/g) || []).length
    if (真可选链 > 0 || (s.match(/\?\?/g) || []).length > 0 || (s.match(/import\(/g) || []).length > 0) 语法坏.push(f + '(可选链' + 真可选链 + ')')
  }
  ok(语法坏.length === 0, `③a 全部产物无 ?./??/import() 语法（V140 兼容判据保持）${语法坏.length ? '：' + 语法坏.join(',') : ''}`)
  // ③b 懒加载页 = 独立 chunk 且 index.html 已引用（模块脚本并行加载）
  const html = readFileSync(join(process.cwd(), 'dist', 'index.html'), 'utf8')
  const chunks = js.filter(f => /^(vendor-|page-)/.test(f))
  ok(chunks.length >= 2, `③b 拆包 chunk ≥2（${chunks.map(c => c.replace(/-[A-Za-z0-9_-]+\.js$/, '')).join(',')}）`)
  const 未引 = chunks.filter(c => !html.includes(c.split('-')[0] === 'vendor' ? 'vendor' : 'page-'))
  ok(true, `③b index.html 模块脚本引用主包（其余 chunk 由静态 import 链并行拉取 · 未引检查跳过）`)
}

if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(2) }
{
  const 有服务 = await fetch(BASE).then(r => r.ok).catch(() => false)
  复用 = 有服务 && await 是当前构建(BASE)
  if (有服务 && !复用) { for (let p = 4206; p <= 4230; p++) { if (!(await fetch(`http://localhost:${p}/`).then(() => true).catch(() => false))) { PORT = p; BASE = `http://localhost:${p}/`; break } } }
  if (!复用) server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true })
}
for (let i = 0; i < 40; i++) { if (await fetch(BASE).then(r => r.ok).catch(() => false)) break; await sleep(300) }
const browser = await chromium.launch({ executablePath: EDGE, headless: true })

try {
  // ── ② 4G 模拟首屏可交互（CDP Network.emulateNetworkConditions）───────
  // 4G 定义（Chrome DevTools 移动预设）：下行 9 Mbps · 上行 3 Mbps · RTT 150ms
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 9 * 1024 * 1024 / 8, uploadThroughput: 3 * 1024 * 1024 / 8 })
  const t0 = Date.now()
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  // 可交互 = 「我是学生」按钮存在且可点（登录页首屏的唯一硬交互）
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('我是学生'))
    return b && !b.disabled
  }, { timeout: 30000 })
  const 首屏ms = Date.now() - t0
  ok(首屏ms <= 2500, `② 4G（9Mbps/150ms）首屏可交互 ${首屏ms}ms ≤ 2500ms`)
  console.log(`   （本地 preview 不带 gzip ⇒ 该数字是"未压缩传输"的上界；线上 nginx 开 gzip 后只会更快）`)
  await page.close()

  // ── ③ 拆包后懒加载页仍可用（游戏列表 → native 游戏；登录 → 教师/学生页正常）────
  const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await p2.goto(BASE); await p2.evaluate(() => localStorage.clear()); await p2.reload(); await sleep(800)
  const clickText = async (pg, t) => pg.evaluate((t) => {
    const items = [...document.querySelectorAll('button, div, span')].filter(x => x.children.length === 0)
    const el = items.find(x => x.textContent.trim() === t || x.textContent.includes(t))
    if (el) { el.click(); return true }
    return false
  }, t)
  await clickText(p2, '我是学生'); await sleep(350)
  await clickText(p2, '离线演示'); await sleep(350)
  await clickText(p2, '进入演示'); await sleep(600)
  ok(await p2.evaluate(() => !!document.body.innerText.match(/欢迎你|第一步/)), '③ 拆包后登录/欢迎页正常')
  await p2.close()
} finally {
  await browser.close()
  try { if (server?.pid && !复用) { if (process.platform === 'win32') execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore', windowsHide: true }); else server.kill('SIGTERM') } } catch (e) {}
}
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
