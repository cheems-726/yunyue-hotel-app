// V31 批1 · CDP printToPDF 打印终验（学生端周报页 + 教师端排名页）
// 通路：playwright-core CDP session → Page.printToPDF（headless Chromium/Edge 原生支持）
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4176, BASE = `http://localhost:${PORT}/`
const SHOT = '../4-审计与报告/V31-打印终验'
const sleep = ms => new Promise(r => setTimeout(r, ms))
let server = null
try { await fetch(BASE) } catch (e) { server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true }); for (let i = 0; i < 30; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch (e) {} await sleep(300) } }
mkdirSync(SHOT, { recursive: true })
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
const clickText = t => page.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) { b.click(); return true } return false }, t)
const clickCard = (t, mode = 'includes') => page.evaluate(({ t, mode }) => { const ms = [...document.querySelectorAll('.district-card, div')].filter(x => mode === 'starts' ? x.textContent.startsWith(t) : x.textContent.includes(t)); if (!ms.length) return false; const inner = ms.reverse().find(x => !ms.some(y => y !== x && x.contains(y))); inner.click(); return true }, { t, mode })

// 离线演示 → 走完认领筹建到经营页（有周报可打印）
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
console.log('已进经营页')

// ── CDP printToPDF：经营页 ──
const cdp = await ctx.newCDPSession(page)
const result = await cdp.send('Page.printToPDF', { printBackground: true, marginTop: 0.4, marginBottom: 0.4, marginLeft: 0.3, marginRight: 0.3 })
const buf = Buffer.from(result.data, 'base64')
writeFileSync(`${SHOT}/经营页-打印.pdf`, buf)
console.log('PDF1 经营页:', buf.length, 'bytes')

// 周报页（离线演示下点左下「报表」）
await clickText('报表'); await sleep(1800)
const result2 = await cdp.send('Page.printToPDF', { printBackground: true, marginTop: 0.4, marginBottom: 0.4 })
const buf2 = Buffer.from(result2.data, 'base64')
writeFileSync(`${SHOT}/周报页-打印.pdf`, buf2)
console.log('PDF2 周报页:', buf2.length, 'bytes')

await browser.close()
console.log('✓ CDP printToPDF 通路可用 · 两份 PDF 落盘')
process.exit(0)
