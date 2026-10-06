import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4176, BASE = `http://localhost:${PORT}/`
const sleep = ms => new Promise(r => setTimeout(r, ms))
let server = null
try { await fetch(BASE) } catch (e) { server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true }); for (let i = 0; i < 30; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch (e) {} await sleep(300) } }
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await page.emulateMedia({ colorScheme: 'dark' })
const clickNav = t => page.evaluate(t2 => { const a = [...document.querySelectorAll('.t-nav a')].find(a => a.textContent.includes(t2)); if (a) { a.click(); return true } return false }, t)
await page.goto(BASE); await sleep(2500)
await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div, a')].reverse().find(x => x.textContent.trim() === '我是老师' || x.textContent.includes('我是老师')); if (b) b.click() }); await sleep(600)
await page.getByPlaceholder('如 T001').fill('T099')
await page.getByPlaceholder('至少 6 位').fill('hotel2026')
await page.getByRole('button', { name: '登录', exact: true }).click(); await sleep(4500)
await clickNav('实时决策'); await sleep(1500)
// 组详情在【班级总览】页：点组卡标题区 ⇒ setExpandedUid 展开 GroupDetail
await clickNav('班级总览'); await sleep(1800)
const r = await page.evaluate(() => {
  // 总览组卡 = :1454 的 onClick 容器（cursor:pointer 且含 uid 文本）
  const cards = [...document.querySelectorAll('div')].filter(d => (d.style.background === '#fff' || d.style.background === 'rgb(255, 255, 255)') && d.style.cursor === 'pointer' && d.textContent.includes('99000001') && d.offsetParent)
  const inner = cards.sort((a, b) => a.textContent.length - b.textContent.length)[0]
  if (!inner) return 'card not found: ' + cards.length
  inner.scrollIntoView({ block: 'center' })
  inner.click()
  return 'clicked, text=' + inner.textContent.slice(0, 60)
})
await sleep(2200)
console.log('下钻:', r)
const has = await page.evaluate(() => ({ 下钻成功: document.body.innerText.includes('每人操作记录') && document.body.innerText.includes('本周决策完成度') }))
console.log(JSON.stringify(has))
console.log('detail texts:', (await page.evaluate(() => ['职责决策完成明细', '称号', '本周决策完成度', '每人操作记录', '舆情危机期'].map(t => t + '=' + document.body.innerText.includes(t)).join(' · '))))
console.log('PAGE_HEAD:', (await page.evaluate(() => document.body.innerText.slice(0, 280).split(String.fromCharCode(10)).join(' | '))))
await page.evaluate(() => { const d = [...document.querySelectorAll('div')].find(x => x.textContent?.includes('职责决策完成明细')); if (d) { const b = d.getBoundingClientRect(); window.scrollTo(0, window.scrollY + b.top - 120) } })
await sleep(500)
const shot = await page.screenshot()
writeFileSync('../4-审计与报告/V27-教师手册截图/09-单组详情-下钻.png', Buffer.from(shot))
await browser.close()
process.exit(0)
