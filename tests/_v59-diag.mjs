import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4176, BASE = `http://localhost:${PORT}/`
const sleep = ms => new Promise(r => setTimeout(r, ms))
let server = null
try { await fetch(BASE) } catch (e) { server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true }); for (let i = 0; i < 30; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch (e) {} await sleep(300) } }
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const clickText = t => page.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) { b.click(); return true } return false }, t)
await page.goto(BASE); await sleep(2500)
await clickText('我是学生'); await sleep(400); await clickText('无网络？离线演示'); await sleep(400); await clickText('进入演示'); await sleep(700); await clickText('开始我的酒店之旅'); await sleep(1500)
await clickText('去决策'); await sleep(1500)
await page.evaluate(() => { const opts = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.trim() === '不跟降'); const el = opts.pop(); if (el) { let n = el; for (let i = 0; i < 5 && n; i++) { if (n.onclick) { n.click(); break } n = n.parentElement } } })
await sleep(700)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].filter(x => !x.disabled && /确认|提交/.test(x.textContent || '')); if (b.length) b[b.length - 1].click() })
await sleep(1200)
const r = await page.evaluate(() => {
  const raw = localStorage.getItem('yunyue-hotel-v45')
  const st = raw ? JSON.parse(raw) : {}
  return { 用户名: st.user?.name, uid: st.user?.uid, id: st.user?.id, opCount: (st.operatorLogs || []).length, firstOp: (st.operatorLogs || [])[0] || null }
})
console.log(JSON.stringify(r, null, 1))
await browser.close()
process.exit(0)
