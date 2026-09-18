import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`, headless: true })
const page = await (await browser.newContext({ viewport: { width: 480, height: 900 } })).newPage()
const SB = 'https://jgytwxaeeezmdbxfsyvs.supabase.co'
const K = 'sb_publishable_bIXR5wi0l43WcRUsa0di0Q_2nVhdsU8'
await page.goto('https://www.2026911301.xyz/')
await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(2200)
await page.evaluate(() => localStorage.clear())
await page.reload(); await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(1500)
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
const result = await page.evaluate(async ({ SB, K }) => {
  const key = Object.keys(localStorage).find(k => k.includes('auth-token'))
  const raw = key ? JSON.parse(localStorage.getItem(key)) : null
  const token = raw?.access_token || raw?.currentSession?.access_token
  if (!token) return { token: 'none' }
  const H = { apikey: K, Authorization: 'Bearer ' + token, Prefer: 'return=representation' }
  // 找一条目标行
  const find = await fetch(`${SB}/rest/v1/teacher_notes?select=id,note,teacher_uid&note=like.*经营策略清晰*`, { headers: { apikey: K, Authorization: 'Bearer ' + token } })
  const found = await find.json()
  if (!Array.isArray(found) || !found.length) return { find: 'no-target', status: find.status }
  const id = found[0].id
  const del = await fetch(`${SB}/rest/v1/teacher_notes?id=eq.${id}`, { method: 'DELETE', headers: { apikey: K, Authorization: 'Bearer ' + token, Prefer: 'return=representation' } })
  const delBody = await del.text()
  return { find: found.length, delStatus: del.status, delBody: delBody.slice(0, 200) }
}, { SB, K })
console.log(JSON.stringify(result, null, 1))
await browser.close()
