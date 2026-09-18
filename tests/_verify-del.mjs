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
// 进入总览 → 展开第一组 → 滚到批注表单保存一条
// 切排名tab → 展开第一组
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
const hasForm = await page.evaluate(() => document.body.innerText.includes('教师批注'))
// 填批注并保存
const taState = await page.evaluate(() => {
  const ta = document.querySelector('textarea')
  if (!ta) return { ta: false, body: document.body.innerText.slice(0, 100) }
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
  setter.call(ta, '验证删除功能-测试批注')
  ta.dispatchEvent(new Event('input', { bubbles: true }))
  return { ta: true }
})
console.log('taState:', JSON.stringify(taState))
await page.evaluate(() => {
  const s = [...document.querySelectorAll('button')].find(x => x.textContent.includes('保存批注'))
  s && s.click()
})
await page.waitForTimeout(2000)
const savedBody = await page.evaluate(() => document.body.innerText)
const saved = savedBody.includes('验证删除功能-测试批注')
if (!saved) console.log('保存后实况:', JSON.stringify(savedBody.slice(0, 150)))
// 时间线里找到这条的删除按钮并点击（confirm 已自动 accept）
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('div')].filter(d => d.textContent.includes('验证删除功能-测试批注') && d.style.borderRadius === '8px')
  const btn = rows.length ? [...rows[0].querySelectorAll('button')].find(b => b.textContent.includes('🗑')) : null
  btn && btn.click()
})
await page.waitForTimeout(2500)
const still = await page.evaluate(() => document.body.innerText.includes('验证删除功能-测试批注'))
console.log(JSON.stringify({ hasForm, saved, deletedOk: saved && !still }, null, 1))
await browser.close()
