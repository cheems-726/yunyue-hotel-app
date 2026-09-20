// 确认实验：给包装层注入 flex/min-height 修复 → 导航栏是否复活 + 能否滚动
// 同时测：第1周存档是否也已损坏（判断是否"一直坏"还是"随周数恶化"）
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { settle } from '../src/settlement.js'
const require2 = createRequire(import.meta.url)
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4173, BASE = `http://localhost:${PORT}/`
const sleep = ms => new Promise(r => setTimeout(r, ms))
const fx12 = readFileSync(new URL('./_fixture12w.json', import.meta.url), 'utf8')

// 造一个第1周存档（history 为空）
const s1 = JSON.parse(fx12)
s1.week = 1; s1.history = []; s1.doneDecisions = {}
const fx1 = JSON.stringify(s1)

const GEO = () => {
  const c = document.querySelector('.content'), tb = document.querySelector('.tabbar')
  const r = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), scrollH: el.scrollHeight } }
  const wrapper = document.querySelector('.app > div[style*="pageIn"]')
  const before = c ? c.scrollTop : null
  if (c) c.scrollTop = 500
  const scrolled = c ? c.scrollTop : 0
  if (c) c.scrollTop = before || 0
  return {
    innerH: window.innerHeight,
    wrapper: wrapper ? { ...r(wrapper), flex: getComputedStyle(wrapper).flex, minH: getComputedStyle(wrapper).minHeight, display: getComputedStyle(wrapper).display } : 'none',
    content: r(c), tabbar: r(tb),
    tabbarVisible: tb ? (tb.getBoundingClientRect().top < window.innerHeight - 10 && tb.getBoundingClientRect().bottom <= window.innerHeight + 1) : 'none',
    canScroll: scrolled > 0,
  }
}

let browser, server
try {
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true })
  for (let i = 0; i < 40; i++) { try { const x = await fetch(BASE); if (x.ok) break } catch (e) {} await sleep(300) }
  browser = await chromium.launch({ executablePath: EDGE, headless: true })
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  await page.goto(BASE); await page.waitForLoadState('domcontentloaded'); await sleep(700)

  for (const [tag, fx] of [['第12周存档', fx12], ['第1周存档', fx1]]) {
    await page.evaluate(f => { localStorage.clear(); localStorage.setItem('hotel-sim-state', f) }, fx)
    await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(2400)
    const g = await page.evaluate(GEO)
    console.log(`\n══ ${tag} · 修复前 ══`)
    console.log(`  包装层: ${g.wrapper === 'none' ? 'none' : `h=${g.wrapper.h} flex=${g.wrapper.flex} minH=${g.wrapper.minH} display=${g.wrapper.display}`}`)
    console.log(`  content h=${g.content.h} scrollH=${g.content.scrollH} | tabbar top=${g.tabbar.top} bottom=${g.tabbar.bottom} (视口${g.innerH})`)
    console.log(`  → 导航栏可见: ${g.tabbarVisible} | 可滚动: ${g.canScroll}`)
  }

  // 注入修复（仅运行时诊断，不改源码）
  await page.evaluate(f => { localStorage.clear(); localStorage.setItem('hotel-sim-state', f) }, fx12)
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(2400)
  await page.addStyleTag({ content: '.app > div[style*="pageIn"] { flex: 1 1 0 !important; min-height: 0 !important; display: flex !important; flex-direction: column !important; }' })
  await sleep(800)
  const g2 = await page.evaluate(GEO)
  console.log(`\n══ 第12周存档 · 注入修复后 ══`)
  console.log(`  包装层: h=${g2.wrapper.h} flex=${g2.wrapper.flex} minH=${g2.wrapper.minH} display=${g2.wrapper.display}`)
  console.log(`  content h=${g2.content.h} scrollH=${g2.content.scrollH} | tabbar top=${g2.tabbar.top} bottom=${g2.tabbar.bottom} (视口${g2.innerH})`)
  console.log(`  → 导航栏可见: ${g2.tabbarVisible} | 可滚动: ${g2.canScroll}`)
  await page.screenshot({ path: 'tests/_shot-fixed.png' })
  console.log(`  截图: tests/_shot-fixed.png`)
} catch (e) { console.error('中断:', e.message) } finally {
  try { await browser?.close() } catch (e) {}
  try { if (server?.pid) require2('node:child_process').execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }) } catch (e) {}
}
