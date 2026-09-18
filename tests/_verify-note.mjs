import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`, headless: true })
const page = await (await browser.newContext({ viewport: { width: 480, height: 900 } })).newPage()
page.on('dialog', d => d.accept())
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
let ready = false
for (let i = 0; i < 10; i++) {
  if ((await page.evaluate(() => document.body.innerText)).includes('学生决策动向')) { ready = true; break }
  await new Promise(r => setTimeout(r, 1000))
}
// 排名 → 展开第一组 → 快捷批注保存 → 时间线断言 → 删除自清理
await page.evaluate(() => { const tab = [...document.querySelectorAll('.tab')].find(x => x.textContent.includes('排名')); tab && tab.click() })
await page.waitForTimeout(900)
await page.evaluate(() => { const row = [...document.querySelectorAll('div')].find(d => d.textContent.includes('平均出租率') && d.style.cursor === 'pointer'); row && row.click() })
await page.waitForTimeout(900)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('👍 优秀')); b && b.click() })
await new Promise(r => setTimeout(r, 400))
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('保存批注')); b && b.click() })
await page.waitForTimeout(2000)
const appeared = await page.evaluate(() => document.body.innerText.includes('经营策略清晰，决策完成度高'))
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('div')].filter(d => d.textContent.includes('经营策略清晰，决策完成度高') && d.style.borderRadius === '8px')
  const btn = rows.length ? [...rows[0].querySelectorAll('button')].find(b => b.textContent.includes('🗑')) : null
  btn && btn.click()
})
await page.waitForTimeout(2500)
const gone = await page.evaluate(() => !document.body.innerText.includes('经营策略清晰，决策完成度高'))
console.log(JSON.stringify({ ready, appeared, deletedSelfClean: gone }, null, 1))
await browser.close()
