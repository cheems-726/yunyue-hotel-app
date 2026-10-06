import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4176, BASE = `http://localhost:${PORT}/`
const SHOT = '../4-审计与报告/V27-教师手册截图'
const sleep = ms => new Promise(r => setTimeout(r, ms))
let server = null
try { await fetch(BASE) } catch (e) { server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true }); for (let i = 0; i < 30; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch (e) {} await sleep(300) } }
mkdirSync(SHOT, { recursive: true })
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
await page.emulateMedia({ colorScheme: 'dark' })
const clickNav = t => page.evaluate(t2 => { const a = [...document.querySelectorAll('.t-nav a')].find(a => a.textContent.includes(t2)); if (a) { a.click(); return true } return false }, t)
const clickText = t => page.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div, a')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) { b.click(); return true } return false }, t)
const shot = async name => { writeFileSync(`${SHOT}/${name}.png`, Buffer.from(await page.screenshot())); console.log('SHOOT', name) }

await page.goto(BASE); await sleep(2500)
await shot('00-登录-身份选择')
await clickText('我是老师'); await sleep(600)
await page.getByPlaceholder('如 T001').fill('T099')
await page.getByPlaceholder('至少 6 位').fill('hotel2026')
await page.getByRole('button', { name: '登录', exact: true }).click()
await sleep(4500)

for (const [n, t] of [['01-我的-功能入口', '我的'], ['02-实时决策-学生动向', '实时决策'], ['03-排名', '排名'], ['04-班级总览-进度控制', '班级总览'], ['05-事件注入-面板', '事件注入'], ['06-AI领班-授权', 'AI 领班'], ['07-分组管理', '分组管理'], ['08-教学参考', '教学参考']]) {
  await clickNav(t); await sleep(1600)
  await shot(n)
}

// 屏9 单组详情下钻
await clickNav('实时决策'); await sleep(1500)
const opened = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('div')].filter(d => /\d\/18 项/.test(d.textContent || '') && d.offsetParent)
  const inner = cards.sort((a, b) => a.textContent.length - b.textContent.length)[0]
  if (!inner) return 'card-not-found'
  let n = inner
  for (let i = 0; i < 6 && n; i++) { if (n.onclick) { n.click(); return 'clicked-' + i } n = n.parentElement }
  inner.click(); return 'leaf'
})
await sleep(1800)
console.log('单组下钻:', opened)
await shot('09-单组详情-下钻')

await browser.close()
console.log('V27 shots done')
process.exit(0)
