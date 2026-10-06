// V64 节点核验 · 教师端线上快探（T099/hotel2026 · 只看不改）：总览/事件注入入口/演示标注/V63 说明行
import { chromium } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'https://www.2026911301.xyz/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const ts = () => new Date().toLocaleTimeString('zh-CN', { hour12: false })
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const body = () => page.evaluate(() => document.body.innerText)
const shot = n => page.screenshot({ path: `../4-审计与报告/V64-演示节点核验/${n}.png` })
const r = {}
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 }); await sleep(2500)
await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === '我是老师' || x.textContent.includes('我是老师')); b && b.click() }); await sleep(500)
await page.getByPlaceholder('如 T001').fill('T099')
await page.getByPlaceholder('至少 6 位').fill('hotel2026')
await page.getByRole('button', { name: '登录', exact: true }).click(); await sleep(7000)
const b = await body()
r['教师台加载'] = b.includes('教师') && (b.includes('组') || b.includes('班'))
r['总览要素'] = b.includes('全班') || b.includes('排名') || b.includes('经营总览')
r['事件注入入口'] = b.includes('注入') || b.includes('事件')
r['演示数据标注'] = b.includes('演示数据（未连云端') || b.includes('云端不可用')
r['V63全班不动说明'] = b.includes('全班经营时间暂不推进属正常') || b.includes('教学日程同步未就绪')
console.log(`${ts()} ${JSON.stringify(r, null, 1)}`)
await shot('教师端-总览')
console.log(r['教师台加载'] ? '✓ 教师端节点可跑通' : '✗ 教师端落点异常')
await browser.close()
process.exit(r['教师台加载'] ? 0 : 1)
