// 反证实验：display:contents 关掉包装层盒子 = 模拟 cc0931b9 之前的结构
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require2 = createRequire(import.meta.url)
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const fx12 = readFileSync(new URL('./_fixture12w.json', import.meta.url), 'utf8')

const GEO = () => {
  const c = document.querySelector('.content'), tb = document.querySelector('.tabbar')
  const r = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), scrollH: el.scrollHeight } }
  const before = c ? c.scrollTop : 0
  if (c) c.scrollTop = 500
  const sc = c ? c.scrollTop : 0
  if (c) c.scrollTop = before
  return {
    innerH: window.innerHeight,
    content: r(c), tabbar: r(tb),
    tabbarVisible: tb ? (tb.getBoundingClientRect().bottom <= window.innerHeight + 1 && tb.getBoundingClientRect().top > 0) : 'none',
    canScroll: sc > 0,
  }
}

let browser, server
try {
  server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore', shell: true, detached: true })
  for (let i = 0; i < 40; i++) { try { const x = await fetch('http://localhost:4173/'); if (x.ok) break } catch (e) {} await sleep(300) }
  browser = await chromium.launch({ executablePath: EDGE, headless: true })
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  await page.goto('http://localhost:4173/'); await page.waitForLoadState('domcontentloaded'); await sleep(700)
  await page.evaluate(f => { localStorage.clear(); localStorage.setItem('hotel-sim-state', f) }, fx12)
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(2400)

  console.log('① 原样（含包装层盒子）          :', JSON.stringify(await page.evaluate(GEO)))
  await page.addStyleTag({ content: '.app > div[style*="pageIn"] { display: contents !important; }' })
  await sleep(700)
  console.log('② display:contents（=改坏前结构）:', JSON.stringify(await page.evaluate(GEO)))
  await page.screenshot({ path: 'tests/_shot-contents.png' })
} catch (e) { console.error('中断:', e.message) } finally {
  try { await browser?.close() } catch (e) {}
  try { if (server?.pid) require2('node:child_process').execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }) } catch (e) {}
}
