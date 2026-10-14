// V104 R1 验收：教师端是否仍降级（真实浏览器，公网 https 域名）
import { chromium } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.BASE || 'https://test.2026911301.xyz/'
const ID = process.env.T_ID || 't2025'
const PW = process.env.T_PW || 'test123456'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const b = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
const errs = []
page.on('pageerror', e => { if (!(e.message || '').includes('plugin is not implemented')) errs.push(e.message) })
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 130)) })

await page.goto(BASE); await page.waitForLoadState('domcontentloaded')
await page.evaluate(() => localStorage.clear())
await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(1300)
await page.evaluate(() => { const b = [...document.querySelectorAll('button, span')].find(x => x.textContent.includes('我是老师')); b && b.click() })
await sleep(500)
await page.evaluate(({ id, pw }) => {
  const ins = [...document.querySelectorAll('input')]
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(ins[0], id); ins[0].dispatchEvent(new Event('input', { bubbles: true }))
  s.call(ins[1], pw); ins[1].dispatchEvent(new Event('input', { bubbles: true }))
  const btn = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled); btn && btn.click()
}, { id: ID, pw: PW })

let txt = ''
for (let k = 0; k < 26; k++) { await sleep(500); txt = await page.evaluate(() => document.body.innerText); if (/教师|看板|云端|开档|班/.test(txt)) break }
await sleep(1500)
txt = await page.evaluate(() => document.body.innerText)
console.log('── 教师端页面文本（前 700 字）──')
console.log(txt.slice(0, 700).replace(/\n{2,}/g, '\n'))
console.log('── 判据 ──')
console.log('  含「云端不可用」/演示数据 :', /云端不可用|显示演示数据|演示数据/.test(txt))
console.log('  含「云端」字样            :', /云端/.test(txt))
const m = txt.match(/(\d+)\s*(?:名|位)?\s*学生/) || txt.match(/学生[^\d]{0,6}(\d+)/) || txt.match(/(\d+)\s*组/)
console.log('  解析到的数字              :', m ? m[0] : '(未匹配)')
console.log('  JS 错误                   :', errs.length, errs.slice(0, 2))
await page.screenshot({ path: 'D:/教学app/4-审计与报告/V102-联调取证/04-教师端.png' })
await b.close()
