import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4176, BASE = `http://localhost:${PORT}/`
const sleep = ms => new Promise(r => setTimeout(r, ms))
let server = null
try { await fetch(BASE) } catch (e) { server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true }); for (let i = 0; i < 30; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch (e) {} await sleep(300) } }
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await page.emulateMedia({ colorScheme: 'dark' })
const clickNav = t => page.evaluate(t2 => { const a = [...document.querySelectorAll('.t-nav a')].find(a => a.textContent.includes(t2)); if (a) { a.click(); return true } return false }, t)
await page.goto(BASE); await sleep(2500)
await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div, a')].reverse().find(x => x.textContent.trim() === '我是老师' || x.textContent.includes('我是老师')); if (b) b.click() }); await sleep(600)
await page.getByPlaceholder('如 T001').fill('T099')
await page.getByPlaceholder('至少 6 位').fill('hotel2026')
await page.getByRole('button', { name: '登录', exact: true }).click(); await sleep(4500)
await clickNav('实时决策'); await sleep(1500)
const r = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].filter(e => e.textContent?.includes('99000001') && e.textContent.includes('全季') && e.offsetParent).sort((a, b) => a.textContent.length - b.textContent.length)[0]
  if (!el) return 'not found'
  let n = el
  for (let i = 0; i < 6 && n; i++) { if (n.onclick) { n.click(); return 'clicked-' + i } n = n.parentElement }
  el.click(); return 'leaf'
})
await sleep(2000)
console.log('下钻:', r)
await page.evaluate(() => { const d = [...document.querySelectorAll('div')].find(x => x.textContent?.includes('职责决策完成明细')); if (d) { const b = d.getBoundingClientRect(); window.scrollTo(0, window.scrollY + b.top - 100) } })
await sleep(500)
const shot = await page.screenshot()
writeFileSync('../4-审计与报告/V27-教师手册截图/09-单组详情-下钻.png', Buffer.from(shot))
console.log('重拍完成')
await browser.close()
process.exit(0)
