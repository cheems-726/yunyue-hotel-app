import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\154.0.4258.53\\msedge.exe'
const PORT = 4176, BASE = `http://localhost:${PORT}/`
const sleep = ms => new Promise(r => setTimeout(r, ms))
let server = null
try { await fetch(BASE) } catch (e) { server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true }); for (let i = 0; i < 30; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch (e) {} await sleep(300) } }
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 110)) })
await page.goto(BASE); await sleep(2500)
const clickText = t => page.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div, a')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) { b.click(); return true } return false }, t)
await clickText('我是学生'); await sleep(400); await clickText('无网络？离线演示'); await sleep(400); await clickText('进入演示'); await sleep(600); await clickText('开始我的酒店之旅'); await sleep(2200)
const diag = await page.evaluate(async () => {
  const geoStatus = await fetch('geo/510100_full.json').then(x => x.status).catch(e => 'ERR:' + e.message)
  return {
    geoFetch: geoStatus,
    加载中提示: document.body.innerText.includes('真实边界加载中'),
    地图标题: document.body.innerText.includes('地图选点'),
    svgCount: document.querySelectorAll('svg').length,
    aria地图: [...document.querySelectorAll('svg')].filter(s => (s.getAttribute('aria-label') || '').includes('真实行政区划')).length,
  }
})
console.log(JSON.stringify(diag), '· errors:', errors.slice(0, 4))
await browser.close()
process.exit(0)
