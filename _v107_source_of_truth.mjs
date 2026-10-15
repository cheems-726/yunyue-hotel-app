// V107-E1 验收：学生屏「可见数字」是否 === 服务端权威（history 末条）
// 判据：权威组出现 / 客户端自算组不出现（改前：客户端组出现、期末资金 = report.capital）
import { chromium } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.BASE || 'http://121.196.196.37/'
const ID = process.env.STU_ID || '20240101'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const log = (...a) => console.log(...a)

// 权威组（服务端 history[0]）vs 客户端自算组（state.report）—— 由调用方传入
const AUTH = JSON.parse(process.env.AUTH || '{"capital":816294,"occupancy":55,"revenue":67816,"netProfit":-352342}')
const CLIENT = JSON.parse(process.env.CLIENT || '{"capital":1168636,"occupancy":96,"netProfit":-321364}')
const fmt = (n) => n.toLocaleString('en-US')
const groupOf = (o) => ({
  capital: [String(o.capital), fmt(o.capital)],
  occupancy: [`${o.occupancy}%`],
  netProfit: [String(o.netProfit), fmt(o.netProfit), fmt(Math.abs(o.netProfit))],
})

const b = await chromium.launch({ executablePath: EDGE, headless: true })
const p = await (await b.newContext({ viewport: { width: 480, height: 1000 }, ignoreHTTPSErrors: true })).newPage()
const errs = []
p.on('pageerror', e => { if (!(e.message || '').includes('plugin is not implemented')) errs.push(e.message) })
await p.goto(BASE); await p.waitForLoadState('domcontentloaded')
await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForLoadState('domcontentloaded'); await sleep(1200)
await p.evaluate(() => { const x = [...document.querySelectorAll('button, span')].find(e => e.textContent.includes('我是学生')); x && x.click() }); await sleep(400)
await p.evaluate(({ id }) => {
  const ins = [...document.querySelectorAll('input')]
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(ins[0], id); ins[0].dispatchEvent(new Event('input', { bubbles: true }))
  s.call(ins[1], 'test123456'); ins[1].dispatchEvent(new Event('input', { bubbles: true }))
  const btn = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled); btn && btn.click()
}, { id: ID })
for (let k = 0; k < 20; k++) { await sleep(500); const t = await p.evaluate(() => document.body.innerText); if (/周结算|资金状况/.test(t)) break }
await sleep(1200)
let txt = await p.evaluate(() => document.body.innerText)
const hit = (pats) => pats.filter(x => txt.includes(x))

log('── 屏幕 1：经营页/周结算卡 ──')
log('  权威组命中:', JSON.stringify(hit(Object.values(groupOf(AUTH)).flat())) )
log('  客户端组命中:', JSON.stringify(hit(Object.values(groupOf(CLIENT)).flat())))
log('  含「期末资金」:', /期末资金/.test(txt))

// 打开「查看本周周报」看完整周报页
try {
  await p.evaluate(() => { const x = [...document.querySelectorAll('button,span,div')].find(e => /查看.*周报/.test(e.textContent)); x && x.click() })
  await sleep(1500)
  const t2 = await p.evaluate(() => document.body.innerText)
  log('── 屏幕 2：周报页 ──')
  log('  权威组命中:', JSON.stringify(hit(Object.values(groupOf(AUTH)).flat()).filter(x => t2.includes(x))))
  log('  客户端组命中:', JSON.stringify(hit(Object.values(groupOf(CLIENT)).flat()).filter(x => t2.includes(x))))
  log('  含「期末资金」:', /期末资金/.test(t2))
  await p.screenshot({ path: 'D:/教学app/4-审计与报告/V107-检查取证/E1-02-周报页.png', fullPage: true })
} catch (e) { log('  周报页打开失败:', e.message) }

log('JS错误:', errs.length)
await p.screenshot({ path: 'D:/教学app/4-审计与报告/V107-检查取证/E1-01-周结算屏.png', fullPage: true })
await b.close()
