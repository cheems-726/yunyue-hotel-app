// V102 取证截图：经营页 + 决策面板（真机精简 Supabase）
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:4173/'
const OUT = 'D:/教学app/4-审计与报告/V102-联调取证'
const sleep = ms => new Promise(r => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const ctx = await browser.newContext({ viewport: { width: 480, height: 900 } })
const page = await ctx.newPage()
await page.goto(BASE); await page.waitForLoadState('domcontentloaded')
await page.evaluate(() => localStorage.clear())
await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(1100)
await page.evaluate(() => { const b = [...document.querySelectorAll('button, span')].find(x => x.textContent.includes('我是学生')); b && b.click() })
await sleep(400)
await page.evaluate(({ id, pw }) => {
  const ins = [...document.querySelectorAll('input')]
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(ins[0], id); ins[0].dispatchEvent(new Event('input', { bubbles: true }))
  s.call(ins[1], pw); ins[1].dispatchEvent(new Event('input', { bubbles: true }))
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled)
  b && b.click()
}, { id: '20240101', pw: 'test123456' })
for (let k = 0; k < 20; k++) { await sleep(500); if ((await page.evaluate(() => document.body.innerText)).includes('资金状况')) break }
await page.screenshot({ path: OUT + '/01-经营页.png' })
await page.evaluate(() => { const el = [...document.querySelectorAll('div, span')].reverse().find(x => x.textContent.trim() === '去决策'); el && el.click() })
await sleep(1200)
await page.screenshot({ path: OUT + '/02-决策面板.png' })
await page.evaluate(() => { const el = [...document.querySelectorAll('div, span')].reverse().find(x => x.textContent.trim() === '去决策'); el && el.click() })
await sleep(800)
console.log('截图完成 ->', OUT)
await browser.close()
