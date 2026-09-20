// 附带核实：LiveFeed 流水明细是否因 flowsRef 变量遮蔽而永远为空
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require2 = createRequire(import.meta.url)
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const fx = JSON.parse(readFileSync(new URL('./_fixture12w.json', import.meta.url), 'utf8'))

let browser, server
try {
  server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore', shell: true, detached: true })
  for (let i = 0; i < 40; i++) { try { const x = await fetch('http://localhost:4173/'); if (x.ok) break } catch (e) {} await sleep(300) }
  browser = await chromium.launch({ executablePath: EDGE, headless: true })
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  await page.goto('http://localhost:4173/'); await page.waitForLoadState('domcontentloaded'); await sleep(700)
  // 预置一条含 flows 的实时面板存档（键 = 日期+周，与 persist 同格式）
  await page.evaluate(f => {
    localStorage.clear()
    localStorage.setItem('hotel-sim-state', JSON.stringify(f))
    const d = new Date().toISOString().slice(0, 10)
    localStorage.setItem(`hotel-live-${d}-w12`, JSON.stringify({
      income: 12000, expense: 800, checkout: 5, checkin: 3, guests: 120, gameMin: 900,
      pendingClean: [], feed: ['🧪 预置测试流水行'],
      flows: [{ text: '🧪 预置流水A +500元', amt: 500 }, { text: '🧪 预置流水B -80元', amt: -80 }],
    }))
  }, fx)
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(2600)
  const stored = await page.evaluate(() => { const d = new Date().toISOString().slice(0, 10); const raw = localStorage.getItem(`hotel-live-${d}-w12`); return raw ? JSON.parse(raw).flows.length : 'no-store' })
  console.log('localStorage 内存档 flows 条数:', stored)
  // 点"今日入账"三格展开明细
  await page.evaluate(() => { const el = [...document.querySelectorAll('div')].find(x => x.textContent.trim() === '今日入账')?.parentElement; el && el.click() })
  await sleep(600)
  const txt = await page.evaluate(() => document.body.innerText)
  const hasEmpty = txt.includes('暂无流水记录')
  const hasInjected = txt.includes('预置流水A')
  console.log(`展开后：显示"暂无流水记录" = ${hasEmpty} | 显示预置流水 = ${hasInjected}`)
  console.log(hasEmpty && !hasInjected ? '❌ 确认 bug：明细列表读到的是永不更新的 flowsRef（组件级 ref 被 effect 内同名变量遮蔽）' : '✅ 明细正常')
  await page.screenshot({ path: 'tests/_shot-flows.png' })
} catch (e) { console.error('中断:', e.message) } finally {
  try { await browser?.close() } catch (e) {}
  try { if (server?.pid) require2('node:child_process').execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }) } catch (e) {}
}
