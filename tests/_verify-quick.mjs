import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`, headless: true })
const page = await (await browser.newContext({ viewport: { width: 480, height: 900 } })).newPage()
await page.goto('https://www.2026911301.xyz/')
await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(2500)
await page.evaluate(() => localStorage.clear())
await page.reload(); await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(1800)
const click = async t => page.evaluate(t2 => { const b = [...document.querySelectorAll('button, span')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) b.click() }, t)
await click('我是老师'); await new Promise(r => setTimeout(r, 500))
await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input')]
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inputs[0], 't001'); inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
  setter.call(inputs[1], '123456'); inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
  const btn = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled)
  if (btn) btn.click(); else { const r = [...document.querySelectorAll('button')].find(x => x.textContent.includes('注册并登录')); r && r.click() }
})
await page.waitForTimeout(3500)
// 轮询等大屏渲染
let ready = false
for (let i = 0; i < 10; i++) {
  if ((await page.evaluate(() => document.body.innerText)).includes('学生决策动向')) { ready = true; break }
  await new Promise(r => setTimeout(r, 1000))
}
// 切排名 → 展开第一组
await page.evaluate(() => {
  const tab = [...document.querySelectorAll('.tab')].find(x => x.textContent.includes('排名'))
  tab && tab.click()
})
await page.waitForTimeout(900)
await page.evaluate(() => {
  const row = [...document.querySelectorAll('div')].find(d => d.textContent.includes('平均出租率') && d.style.cursor === 'pointer')
  row && row.click()
})
await page.waitForTimeout(900)
// 点快捷按钮"👍 优秀"
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('👍 优秀'))
  b && b.click()
})
await new Promise(r => setTimeout(r, 400))
const filled = await page.evaluate(() => {
  const ta = document.querySelector('textarea')
  const num = document.querySelector('input[type="number"]')
  return { noteFilled: ta ? ta.value.length > 5 : false, scoreFilled: num ? num.value : null }
})
// 保存
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('保存批注') && !x.disabled)
  b && b.click()
})
await page.waitForTimeout(2000)
// 时间线应出现新条目
const timeline = await page.evaluate(() => {
  const body = document.body.innerText
  const idx = body.indexOf('批注时间线')
  return idx >= 0 ? body.slice(idx, idx + 120) : 'no-timeline'
})
console.log(JSON.stringify({ ready, filled, timeline }, null, 1))
await browser.close()
