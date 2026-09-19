import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`, headless: true })
const page = await (await browser.newContext({ viewport: { width: 480, height: 900 } })).newPage()
const errors = []
page.on('pageerror', e => errors.push('PAGEERR: ' + (e.stack || e.message).slice(0, 300)))
await page.goto('http://localhost:5173/')
await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(1500)
await page.evaluate(() => localStorage.clear())
await page.reload(); await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(1400)
const click = async t => page.evaluate(t2 => { const b = [...document.querySelectorAll('button, span')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) b.click() }, t)
await click('我是学生'); await new Promise(r => setTimeout(r, 450))
await click('离线演示'); await new Promise(r => setTimeout(r, 450))
await click('进入演示'); await new Promise(r => setTimeout(r, 700))
await click('开始我的酒店之旅'); await new Promise(r => setTimeout(r, 900))
await page.evaluate(() => { const c = [...document.querySelectorAll('.district-card')].find(x => x.textContent.includes('锦江区')); c && c.click() }); await new Promise(r => setTimeout(r, 450))
await click('确认选址'); await new Promise(r => setTimeout(r, 700))
await page.evaluate(() => { const c = [...document.querySelectorAll('.district-card')].find(x => x.textContent.includes('汉庭')); c && c.click() }); await new Promise(r => setTimeout(r, 450))
await click('确认选择'); await new Promise(r => setTimeout(r, 700))
await page.evaluate(() => { const c = [...document.querySelectorAll('.district-card')].find(x => x.textContent.includes('OTA平台合作')); c && c.click() }); await new Promise(r => setTimeout(r, 450))
await click('确认'); await new Promise(r => setTimeout(r, 600))
await page.evaluate(() => { const c = [...document.querySelectorAll('.district-card')].find(x => x.textContent.includes('社区旁物业')); c && c.click() }); await new Promise(r => setTimeout(r, 450))
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
// 筹建快速走（预抵格在经营页，筹建页不受影响）
for (let i = 0; i < 8; i++) {
  const body = await page.evaluate(() => document.body.innerText.slice(0, 40))
  if (body.includes('第 1 周')) break
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => !x.disabled && (x.textContent.includes('下一步') || x.textContent.includes('完成筹建')))
    if (b) b.click()
  })
  await new Promise(r => setTimeout(r, 600))
}
// 点预抵格（明日预抵）触发构成
await page.evaluate(() => {
  const cells = [...document.querySelectorAll('div')].filter(d => d.textContent.startsWith('明日预抵') && d.onclick)
  const c2 = cells.length ? [...document.querySelectorAll('div')].find(d => d.textContent.includes('明日预抵 5 间') || d.textContent.includes('明日预抵')) : null
})
await page.evaluate(() => {
  const cells = [...document.querySelectorAll('#root div')].filter(d => d.textContent.trim().startsWith('明日预抵') && d.querySelector && !d.querySelector('div div div'))
})
await page.waitForTimeout(800)
// 结算测试：做0决策直接结算
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('本周结算')); b && b.click() })
await page.waitForTimeout(1800)
const hasReport = await page.evaluate(() => document.body.innerText.includes('周经营结果'))
await page.evaluate(() => {
  const els = [...document.querySelectorAll('button, div')].reverse()
  const b = els.find(x => x.textContent.trim().startsWith('进入第 2 周'))
  b && b.click()
})
await page.waitForTimeout(1000)
const body = await page.evaluate(() => document.body.innerText.slice(0, 80))
console.log('=== body after week2 ===')
console.log(JSON.stringify(body))
console.log('=== errors ===')
console.log(errors.length ? errors.join('\n---\n') : 'none')
await browser.close()
