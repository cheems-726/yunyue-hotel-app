import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`, headless: true })
const page = await (await browser.newContext({ viewport: { width: 480, height: 900 } })).newPage()
const errors = []
page.on('pageerror', e => errors.push('PAGEERR: ' + (e.stack || e.message).slice(0, 500)))
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 300)) })
await page.goto('http://localhost:5173/')
await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(1200)
await page.evaluate(() => localStorage.clear())
await page.reload(); await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(1300)
const click = async t => page.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) b.click() }, t)
const clickCard = async t => page.evaluate(t2 => { const m = [...document.querySelectorAll('.district-card, div')].filter(x => x.textContent.includes(t2)); const inner = m.reverse().find(x => !m.some(y => y !== x && x.contains(y))); if (inner) inner.click() }, t)
await click('我是学生'); await new Promise(r => setTimeout(r, 400))
await click('离线演示'); await new Promise(r => setTimeout(r, 400))
await click('进入演示'); await new Promise(r => setTimeout(r, 700))
await click('开始我的酒店之旅'); await new Promise(r => setTimeout(r, 800))
await clickCard('锦江区'); await new Promise(r => setTimeout(r, 500))
await click('确认选址'); await new Promise(r => setTimeout(r, 700))
await clickCard('汉庭'); await new Promise(r => setTimeout(r, 450))
await click('确认选择'); await new Promise(r => setTimeout(r, 700))
await clickCard('OTA平台合作'); await new Promise(r => setTimeout(r, 400))
await click('确认'); await new Promise(r => setTimeout(r, 600))
await clickCard('社区旁物业'); await new Promise(r => setTimeout(r, 450))
for (let i = 0; i < 7; i++) {
  const done = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('完成认领'))
    if (b) { b.click(); return true }
    const n = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('下一步'))
    if (n) { n.click(); return false }
    return false
  })
  await new Promise(r => setTimeout(r, 600))
  if (done) break
}
const body = await page.evaluate(() => document.body.innerText.slice(0, 80))
console.log('=== AFTER CLAIM DONE ===')
console.log('body:', JSON.stringify(body))
console.log('errors:', errors.length ? errors.join('\n---\n') : 'none')
await browser.close()
