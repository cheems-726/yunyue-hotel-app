// V106 诊断：登录后页面到底停在哪（排查 15s 登录 + 决策面板打不开）
import { chromium } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.BASE || 'http://121.196.196.37/'
const ID = process.env.STU_ID || '20240101'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const b = await chromium.launch({ executablePath: EDGE, headless: true })
const p = await (await b.newContext({ viewport: { width: 420, height: 860 }, ignoreHTTPSErrors: true })).newPage()
const errs = []
p.on('pageerror', e => { if (!(e.message || '').includes('plugin is not implemented')) errs.push(e.message) })
p.on('console', m => { if (m.type() === 'error') errs.push('C:' + m.text().slice(0, 160)) })
p.on('requestfailed', r => errs.push('REQFAIL ' + r.url().slice(0, 90) + ' ' + (r.failure()?.errorText || '')))
await p.goto(BASE); await p.waitForLoadState('domcontentloaded')
await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForLoadState('domcontentloaded'); await sleep(1200)
await p.evaluate(() => { const x = [...document.querySelectorAll('button, span')].find(e => e.textContent.includes('我是学生')); x && x.click() }); await sleep(400)
const t0 = Date.now()
await p.evaluate(({ id }) => {
  const ins = [...document.querySelectorAll('input')]
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(ins[0], id); ins[0].dispatchEvent(new Event('input', { bubbles: true }))
  s.call(ins[1], 'test123456'); ins[1].dispatchEvent(new Event('input', { bubbles: true }))
  const btn = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled); btn && btn.click()
}, { id: ID })
for (const w of [2000, 4000, 8000, 12000, 18000]) {
  const wait = w - (Date.now() - t0)
  if (wait > 0) await sleep(wait)
  const t = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 150))
  console.log(`t≈${w}ms: ${t}`)
}
console.log('JS错误/请求失败:', errs.length)
for (const e of errs.slice(0, 6)) console.log('   ', e)
const keys = await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('sb-')).join(',') || '(无 sb- 键)')
console.log('localStorage sb- 键:', keys)
await p.screenshot({ path: 'D:/教学app/4-审计与报告/V106-检查取证/D-diag-登录后.png' })
await b.close()
