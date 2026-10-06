// V61 批① · 线上取证：登录页 / 离线演示态 / （教师端 t001 无法登录·静态扫源码）逐处扫「演示」标注
import { chromium } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.V61_BASE || 'https://www.2026911301.xyz/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const body = () => page.evaluate(() => document.body.innerText)
const shot = n => page.screenshot({ path: `../4-审计与报告/V61-线上取证/${n}.png` })

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 }); await sleep(2500)
const b1 = await body()
console.log('── 登录页 ──')
console.log('含「离线演示」入口:', b1.includes('离线演示'))
console.log('含【演示数据·非真实经营】标注:', b1.includes('演示数据'))
console.log('「演示」出现次数:', (b1.match(/演示/g) || []).length)
await shot('01-登录页')

await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === '我是学生' || x.textContent.includes('我是学生')); b && b.click() }); await sleep(500)
await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.includes('离线演示')); b && b.click() }); await sleep(500)
const b2 = await body()
console.log('── 离线演示确认弹层 ──')
console.log('含「演示」:', (b2.match(/演示/g) || []).length, '· 含「演示数据」:', b2.includes('演示数据'), '· 含「不连服务器」:', b2.includes('不连服务器'))
await shot('02-离线演示确认')

await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === '进入演示' || x.textContent.includes('进入演示')); b && b.click() }); await sleep(1500)
await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.includes('开始我的酒店之旅')); b && b.click() }); await sleep(2000)
const b3 = await body()
console.log('── 进入演示后（选址页/经营页） ──')
console.log('「演示」出现次数:', (b3.match(/演示/g) || []).length)
console.log('含「（演示）」用户名后缀:', b3.includes('（演示）'))
console.log('含常驻水印字样「演示数据」:', b3.includes('演示数据'))
console.log('页面片段:', b3.slice(0, 100).replace(/\n/g, '|'))
await shot('03-进入演示后')

// 找 DOM 里有没有 position:fixed 的水印元素
const wm = await page.evaluate(() => [...document.querySelectorAll('div,span')].filter(e => {
  const cs = getComputedStyle(e)
  return (cs.position === 'fixed' || cs.position === 'absolute') && /演示/.test(e.textContent || '') && e.children.length <= 2
}).map(e => ({ tag: e.tagName, text: (e.textContent || '').trim().slice(0, 30), pos: getComputedStyle(e).position, op: getComputedStyle(e).opacity })))
console.log('常驻「演示」浮层元素:', JSON.stringify(wm))
await browser.close()
