// V106 验证：D2④ 密码尾随空格可登录（修复前会报「账号或密码错误」）
import { chromium } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.BASE || 'http://121.196.196.37/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const log = (...a) => console.log(...a)
const b = await chromium.launch({ executablePath: EDGE, headless: true })

async function tryLogin(id, pw, label) {
  const page = await (await b.newContext({ viewport: { width: 420, height: 860 }, ignoreHTTPSErrors: true })).newPage()
  await page.goto(BASE); await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(1200)
  await page.evaluate(() => { const x = [...document.querySelectorAll('button, span')].find(e => e.textContent.includes('我是学生')); x && x.click() })
  await sleep(400)
  await page.evaluate(({ id, pw }) => {
    const ins = [...document.querySelectorAll('input')]
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(ins[0], id); ins[0].dispatchEvent(new Event('input', { bubbles: true }))
    s.call(ins[1], pw); ins[1].dispatchEvent(new Event('input', { bubbles: true }))
    const btn = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled); btn && btn.click()
  }, { id, pw })
  let t = ''
  for (let k = 0; k < 20; k++) { await sleep(500); t = await page.evaluate(() => document.body.innerText); if (/资金状况|周结算|经营结果|账号或密码错误|登录失败/.test(t)) break }
  const ok = /资金状况|周结算|经营结果|欢迎你|已决策/.test(t) && !/账号或密码错误/.test(t)
  log(`  ${ok ? '✓' : '✗'} ${label}  →  ${ok ? '进入应用' : (t.match(/账号或密码错误|登录失败[^\n]*/) || ['(未进入)'])[0]}`)
  await page.context().close()
  return ok
}

log('D2④ 密码 trim 验证（学号 20240101）：')
const a = await tryLogin('20240101', 'test123456   ', '密码带 3 个尾随空格')
const c = await tryLogin('20240101', '  test123456', '密码带 2 个前导空格')
const d = await tryLogin('20240101', 'test123456', '密码正常（对照）')
await b.close()
process.exit(a && c && d ? 0 : 1)
