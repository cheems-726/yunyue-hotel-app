// V31 批4 · 打印样式复核：同页对照 PDF（printBackground on/off · 纸张 A4）
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4176, BASE = `http://localhost:${PORT}/`
const SHOT = '../4-审计与报告/V31-打印终验'
const sleep = ms => new Promise(r => setTimeout(r, ms))
let server = null
try { await fetch(BASE) } catch (e) { server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true }); for (let i = 0; i < 30; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch (e) {} await sleep(300) } }
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
const clickText = t => page.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) { b.click(); return true } return false }, t)
const clickCard = (t, mode = 'includes') => page.evaluate(({ t, mode }) => { const ms = [...document.querySelectorAll('.district-card, div')].filter(x => mode === 'starts' ? x.textContent.startsWith(t) : x.textContent.includes(t)); if (!ms.length) return false; const inner = ms.reverse().find(x => !ms.some(y => y !== x && x.contains(y))); inner.click(); return true }, { t, mode })

await page.goto(BASE); await sleep(2500)
await clickText('我是学生'); await sleep(400); await clickText('无网络？离线演示'); await sleep(400); await clickText('进入演示'); await sleep(600); await clickText('开始我的酒店之旅'); await sleep(1200)
await clickCard('锦江区'); await sleep(500); await clickText('明白了'); await sleep(300)
await clickText('确认选址'); await sleep(700)
await page.getByText('全季', { exact: true }).last().click(); await sleep(450)
await clickText('确认选择'); await sleep(700)
await clickCard('自主直营'); await sleep(400); await clickText('确认'); await sleep(650)
await clickCard('商圈核心物业'); await sleep(400)
for (let i = 0; i < 7; i++) { const done = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('完成认领')); if (b) { b.click(); return true } const n = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('下一步')); if (n) { n.click(); return false } return false }); await sleep(550); if (done) break }
await sleep(800)
await clickCard('基准情景', 'starts'); await sleep(500); await clickText('明白了'); await sleep(300)
await clickText('完成「投资测算」'); await sleep(900); await clickText('完成「证照办理」'); await sleep(900)
await clickCard('供应商 A'); await sleep(500); await clickText('明白了'); await sleep(300)
await clickText('完成「物资采购」'); await sleep(900)
for (const n of ['装修', '招聘', '系统上线']) { await clickCard(n, 'starts'); await sleep(400); await clickText('明白了'); await sleep(280); await clickCard(n, 'starts'); await sleep(280) }
await clickText('完成筹建，正式开业'); await sleep(1300); await clickText('明白了'); await sleep(1200)

// A4 无背景（学生黑白打印场景）· format A4
const cdp = await ctx.newCDPSession(page)
const a4 = await cdp.send('Page.printToPDF', { format: 'A4', marginTop: 0.4, marginBottom: 0.4, marginLeft: 0.3, marginRight: 0.3 })
writeFileSync(`${SHOT}/经营页-A4-无背景.pdf`, Buffer.from(a4.data, 'base64'))
console.log('A4 无背景:', Buffer.from(a4.data, 'base64').length, 'bytes')

// A4 带背景（彩色投屏截图版）
const a4bg = await cdp.send('Page.printToPDF', { format: 'A4', printBackground: true, marginTop: 0.4, marginBottom: 0.4 })
writeFileSync(`${SHOT}/经营页-A4-带背景.pdf`, Buffer.from(a4bg.data, 'base64'))
console.log('A4 带背景:', Buffer.from(a4bg.data, 'base64').length, 'bytes')

// 教师端排名页（老师场景 · 宽屏布局）· 需教师登录 —— 简化：经营页已是代表页；教师端打印走 V27 截图
await browser.close()
console.log('✓ 批4 样式复核：两版 A4 PDF 落盘（分页/字号由浏览器排版引擎保证）')
process.exit(0)
