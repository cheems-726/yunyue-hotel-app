// V129-R109-1/3 · 真浏览器：登录前连通预检 + 断网登录报"连不上服务器"（不是"密码错"）
// 运行：node tests/offlineLogin.test.mjs（需先 build + 起 preview 4173；挂 run-all 浏览器档）
// 做法：只拦截"健康探针/登录 token"请求（页面与静态资源正常加载），模拟"服务器不可达"。
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:4173/'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

let browser
try {
  let up = await fetch(BASE).then(r => r.ok).catch(() => false)
  if (!up) {
    // 复用优先；没有就自己起（与 ui-smoke 同一策略）
    spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true })
    for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 300)); up = await fetch(BASE).then(r => r.ok).catch(() => false); if (up) break }
  }
  if (!up) { console.error('✗ 预览服务未启动（请先 build）'); process.exit(2) }

  browser = await chromium.launch({ executablePath: EDGE, headless: true })
  const ctx = await browser.newContext({ viewport: { width: 480, height: 900 } })
  const page = await ctx.newPage()

  // 只打断"服务器可达性"相关请求：健康探针 + 登录 token；页面/静态资源照常
  await page.route('**/auth/v1/health', r => r.abort())
  await page.route('**/auth/v1/token**', r => r.abort())
  for (const host of ['http://121.196.196.37', 'https://121.196.196.37', 'http://localhost:4173']) {
    await page.route(host + '/health', r => r.abort())
  }

  await page.goto(BASE)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForLoadState('domcontentloaded')

  console.log('▶ V129 · 真浏览器断网登录')

  // ① 点登录之前：预检横幅出现（不等用户操作）
  const 出现 = await page.waitForFunction(() => /连不上|入口不通|不是密码问题/.test(document.body.innerText), null, { timeout: 15000 }).then(() => true).catch(() => false)
  const 文本 = await page.evaluate(() => document.body.innerText)
  ok(出现, '登录页在点登录之前就出现"连不上/入口建议"提示', 文本.slice(0, 160).replace(/\n/g, ' | '))
  ok(/不是密码问题|连不上登录服务器/.test(文本), '提示文案明确"不是密码问题"或"入口不通"')

  // ② 断网登录 ⇒ 报"连不上服务器"，不是"账号或密码错误"
  await page.getByText('我是学生', { exact: true }).click().catch(() => {})
  await page.locator('input').first().fill('20240101')
  await page.locator('input[type=password]').fill('test123456')
  await page.getByRole('button', { name: /^登录$/ }).click().catch(() => {})
  const 报错 = await page.waitForFunction(() => /连不上服务器|网络不可达|连不上测试机/.test(document.body.innerText), null, { timeout: 20000 }).then(() => true).catch(() => false)
  const 报错文本 = await page.evaluate(() => document.body.innerText)
  ok(报错, '断网登录 ⇒ 报"连不上服务器"', 报错文本.slice(0, 200).replace(/\n/g, ' | '))
  ok(!/账号或密码错误|工号或密码不对/.test(报错文本), '绝不误报"密码错"（假活着的反面）')

  await browser.close()
} catch (e) {
  console.error('✗ 测试执行中断: ' + (e && e.message ? e.message : e))
  try { await browser?.close() } catch (e2) {}
  process.exitCode = 1
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 && process.exitCode !== 1 ? 0 : 1)
