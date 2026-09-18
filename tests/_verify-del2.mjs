import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`, headless: true })
const page = await (await browser.newContext({ viewport: { width: 480, height: 900 } })).newPage()
page.on('dialog', d => d.accept())
const SB = 'https://jgytwxaeeezmdbxfsyvs.supabase.co'
const K = 'sb_publishable_bIXR5wi0l43WcRUsa0di0Q_2nVhdsU8'
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
await page.evaluate(() => { const tab = [...document.querySelectorAll('.tab')].find(x => x.textContent.includes('排名')); tab && tab.click() })
await page.waitForTimeout(900)
await page.evaluate(() => { const row = [...document.querySelectorAll('div')].find(d => d.textContent.includes('平均出租率') && d.style.cursor === 'pointer'); row && row.click() })
await page.waitForTimeout(900)
await page.evaluate(() => {
  const ta = document.querySelector('textarea')
  if (!ta) return
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
  setter.call(ta, '诊断删除-测试批注')
  ta.dispatchEvent(new Event('input', { bubbles: true }))
})
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('保存批注')); b && b.click() })
await page.waitForTimeout(2000)
// 从 supabase 直接查该批注 id
const token = await page.evaluate(() => {
  const key = Object.keys(localStorage).find(k => k.includes('auth-token'))
  return key ? (JSON.parse(localStorage.getItem(key)).access_token || JSON.parse(localStorage.getItem(key)).currentSession?.access_token) : null
})
const query = await page.evaluate(async ({ SB, K, token }) => {
  const r = await fetch(`${SB}/rest/v1/teacher_notes?select=id,note`, { headers: { apikey: K, Authorization: 'Bearer ' + token } })
  return r.status + ' ' + (await r.text()).slice(0, 300)
}, { SB, K })
// 点🗑删除
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('div')].filter(d => d.textContent.includes('诊断删除-测试批注') && d.style.borderRadius === '8px')
  const btn = rows.length ? [...rows[0].querySelectorAll('button')].find(b => b.textContent.includes('🗑')) : null
  btn && btn.click()
})
await page.waitForTimeout(2500)
const after = await page.evaluate(() => document.body.innerText.includes('诊断删除-测试批注'))
// 再直接查库
const query2 = await page.evaluate(async ({ SB, K, token }) => {
  const r = await fetch(`${SB}/rest/v1/teacher_notes?select=id,note&note=like.*诊断删除*`, { headers: { apikey: K, Authorization: 'Bearer ' + token } })
  return r.status + ' ' + (await r.text()).slice(0, 300)
}, { SB, K })
console.log('list:', query)
console.log('UI仍显示:', after)
console.log('库里残留:', query2)
await browser.close()
