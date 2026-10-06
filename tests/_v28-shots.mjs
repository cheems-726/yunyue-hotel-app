import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const FILE = 'file:///D:/' + '%E6%95%99%E5%AD%A6app' + '/7-%E6%95%99%E5%AD%A6%E6%9D%90%E6%96%99/%E8%AF%BE%E4%BB%B6/12%E5%91%A8%E6%8A%95%E5%B1%8F%E8%AF%BE%E4%BB%B6-v1.html'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage()
await page.goto('file:///D:/教学app/7-教学材料/课件/12周投屏课件-v1.html'); await sleep(1200)

const fs = await import('node:fs')
fs.mkdirSync('../4-审计与报告/V28-课件截图', { recursive: true })
const shot = async n => { writeFileSync(`../4-审计与报告/V28-课件截图/${n}.png`, Buffer.from(await page.screenshot())); console.log('SHOOT', n) }
await shot('01-第1周-选址')
await page.keyboard.press('ArrowRight'); await sleep(500)
await page.keyboard.press('ArrowRight'); await sleep(500)
await shot('03-第2周-定价')
// 跳到第 9 周客群
for (let i = 0; i < 7; i++) { await page.keyboard.press('ArrowRight'); await sleep(150) }
await shot('09-第9周-客群')
// 翻周功能验证：进度文本
const prog = await page.evaluate(() => document.getElementById('progress').textContent)
console.log('进度指示:', prog)
await page.keyboard.press('Home'); await sleep(400)
const back = await page.evaluate(() => document.getElementById('progress').textContent)
console.log('Home 回第1屏:', back)
await browser.close()
process.exit(0)
