// V103 · 用真实浏览器栈（Edge/BoringSSL）复核公网 https 站点可用性
import { chromium } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const D = process.env.D || 'https://test.2026911301.xyz/'
const b = await chromium.launch({ executablePath: EDGE, headless: true })
const p = await (await b.newContext({ viewport: { width: 480, height: 900 } })).newPage()
const errs = []
p.on('pageerror', e => { if (!(e.message || '').includes('plugin is not implemented')) errs.push(e.message) })
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 120)) })
const resp = await p.goto(D, { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(2500)
const t = await p.evaluate(() => document.body.innerText.slice(0, 130).replace(/\s+/g, ' '))
console.log('HTTP状态 :', resp.status())
console.log('页面内容 :', t)
console.log('JS错误   :', errs.length, errs.slice(0, 2))
const api = await p.evaluate(async () => (await fetch('/auth/v1/health')).status)
console.log('同源 /auth/v1/health :', api)
await p.screenshot({ path: 'D:/教学app/4-审计与报告/V102-联调取证/03-公网https首页.png' })
await b.close()
