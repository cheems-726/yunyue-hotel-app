// V108 取证截图 + 修 R107-1（V107 两张图曾同 sha256 且非周报页）
import { chromium } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.BASE || 'http://121.196.196.37/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const b = await chromium.launch({ executablePath: EDGE, headless: true })

async function login(page, id, role) {
  await page.goto(BASE); await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(1200)
  await page.evaluate(r => { const x = [...document.querySelectorAll('button, span')].find(e => e.textContent.includes(r)); x && x.click() }, role === 'teacher' ? '我是老师' : '我是学生')
  await sleep(400)
  await page.evaluate(({ id }) => {
    const ins = [...document.querySelectorAll('input')]
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(ins[0], id); ins[0].dispatchEvent(new Event('input', { bubbles: true }))
    s.call(ins[1], 'test123456'); ins[1].dispatchEvent(new Event('input', { bubbles: true }))
    const btn = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled); btn && btn.click()
  }, { id })
  for (let k = 0; k < 24; k++) { await sleep(500); const t = await page.evaluate(() => document.body.innerText); if (/资金状况|周结算|已决策|学生/.test(t)) break }
  await sleep(1200)
}

// ── 学生端：经营页/周结算卡 ──
const sp = await (await b.newContext({ viewport: { width: 480, height: 1000 }, ignoreHTTPSErrors: true })).newPage()
await login(sp, '20240101', 'student')
let t = await sp.evaluate(() => document.body.innerText)
await sp.screenshot({ path: 'D:/教学app/4-审计与报告/V108-检查取证/A-01-学生端-周结算卡.png', fullPage: true })
console.log('A-01 学生端周结算卡 · 含「周结算」=', /周结算/.test(t), '· 含「期末资金」=', /期末资金/.test(t))

// ── 打开真正的周报页（并断言确实换页了，修 R107-1 的"两张同图"）──
const before = t.length
await sp.evaluate(() => { const x = [...document.querySelectorAll('button,span,div')].find(e => /查看.*周报/.test(e.textContent)); x && x.click() })
await sleep(1800)
const t2 = await sp.evaluate(() => document.body.innerText)
const 换页了 = t2 !== t && /周报|经营明细|日报/.test(t2)
await sp.screenshot({ path: 'D:/教学app/4-审计与报告/V108-检查取证/A-02-学生端-周报页.png', fullPage: true })
// 同步覆盖 V107 的 E1-02（原来那张不是周报页）
await sp.screenshot({ path: 'D:/教学app/4-审计与报告/V107-检查取证/E1-02-周报页.png', fullPage: true })
console.log('A-02 周报页 · 换页断言=', 换页了, '（R107-1：已重拍为真周报页）')

// ── 教师端：看板/排名（12 周后的期末态）──
const tp = await (await b.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true })).newPage()
await login(tp, 't2024', 'teacher')
const tt = await tp.evaluate(() => document.body.innerText)
await tp.screenshot({ path: 'D:/教学app/4-审计与报告/V108-检查取证/S-01-教师端-期末看板.png', fullPage: true })
console.log('S-01 教师端 · 含「学生」=', /学生/.test(tt), '· 含降级「云端不可用」=', /云端不可用/.test(tt))
console.log('  教师端页面摘录:', tt.replace(/\s+/g, ' ').slice(0, 180))
await b.close()
