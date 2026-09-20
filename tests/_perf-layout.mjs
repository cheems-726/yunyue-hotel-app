// 布局取证：截图经营页（顶部/底部）与周报页 + 精确几何
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
const require2 = createRequire(import.meta.url)
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4173, BASE = `http://localhost:${PORT}/`
const sleep = ms => new Promise(r => setTimeout(r, ms))
const fixture = readFileSync(new URL('./_fixture12w.json', import.meta.url), 'utf8')

const GEO = () => {
  const q = s => document.querySelector(s)
  const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), boxH: Math.round(el.getBoundingClientRect().height), scrollH: el.scrollHeight, scrollTop: Math.round(el.scrollTop), flex: cs.flex, minH: cs.minHeight, overflowY: cs.overflowY, display: cs.display, position: cs.position } }
  const c = q('.content'), app = q('.app'), tb = q('.tabbar')
  // 能否滚动？尝试滚动 .content 与 window
  const before = { contentTop: c ? Math.round(c.scrollTop) : null, winY: window.scrollY }
  if (c) c.scrollTop = 400
  window.scrollTo(0, 400)
  const after = { contentTop: c ? Math.round(c.scrollTop) : null, winY: window.scrollY }
  if (c) c.scrollTop = before.contentTop || 0
  return {
    innerH: window.innerHeight,
    bodyOverflow: getComputedStyle(document.body).overflow,
    docScrollH: document.documentElement.scrollHeight,
    app: box(app), content: c ? box(c) : null, tabbar: tb ? box(tb) : null,
    tabbarVisible: tb ? (tb.getBoundingClientRect().top < window.innerHeight && tb.getBoundingClientRect().bottom > 0) : 'no-tabbar',
    canScrollContent: before.contentTop !== after.contentTop || (after.contentTop > 0),
    canScrollWindow: after.winY > 0,
    appChildren: app ? [...app.children].map(x => x.className || x.tagName).slice(0, 8) : null,
  }
}

let browser, server
try {
  if (!existsSync('dist/index.html')) { console.error('✗ 先 build'); process.exit(1) }
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true })
  for (let i = 0; i < 40; i++) { try { const x = await fetch(BASE); if (x.ok) break } catch (e) {} await sleep(300) }
  browser = await chromium.launch({ executablePath: EDGE, headless: true })
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  await page.goto(BASE); await page.waitForLoadState('domcontentloaded'); await sleep(700)
  await page.evaluate(fx => { localStorage.clear(); localStorage.setItem('hotel-sim-state', fx) }, fixture)
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(2600)

  console.log('══ 经营页布局 ══')
  console.log(JSON.stringify(await page.evaluate(GEO), null, 1))
  await page.screenshot({ path: 'tests/_shot-biz-top.png' })
  await page.evaluate(() => { const c = document.querySelector('.content'); if (c) c.scrollTop = c.scrollHeight })
  await sleep(400)
  await page.screenshot({ path: 'tests/_shot-biz-bottom.png' })

  console.log('\n══ 切到周报页 ══')
  await page.evaluate(() => { const c = document.querySelector('.content'); if (c) c.scrollTop = 0 })
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('本周结算')); b && b.click() })
  await sleep(2600)
  console.log(JSON.stringify(await page.evaluate(GEO), null, 1))
  await page.screenshot({ path: 'tests/_shot-report.png' })
  console.log('\n截图: tests/_shot-biz-top.png / _shot-biz-bottom.png / _shot-report.png')
} catch (e) { console.error('中断:', e.message) } finally {
  try { await browser?.close() } catch (e) {}
  try { if (server?.pid) require2('node:child_process').execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }) } catch (e) {}
}
