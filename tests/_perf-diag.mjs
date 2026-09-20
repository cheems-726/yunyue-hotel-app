// 经营页卡死诊断：CPU降频模拟手机 + 全量插桩 + CPU Profile 归因
// 用法：node tests/_perf-diag.mjs [cpuRate]   默认 6
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const require2 = createRequire(import.meta.url)
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4173
const BASE = `http://localhost:${PORT}/`
const CPU = Number(process.argv[2] || 6)
const sleep = ms => new Promise(r => setTimeout(r, ms))

const fixture = readFileSync(new URL('./_fixture12w.json', import.meta.url), 'utf8')

const INSTRUMENT = () => {
  const d = window.__diag = { timers: {}, setItems: {}, stringify: { n: 0, ms: 0 }, longtasks: [], mutations: 0, frames: 0, errors: [] }
  const _st = window.setTimeout, _si = window.setInterval
  window.setTimeout = function (fn, delay, ...a) { const k = 'T' + (delay || 0); d.timers[k] = (d.timers[k] || 0) + 1; return _st.call(this, fn, delay, ...a) }
  window.setInterval = function (fn, delay, ...a) { const k = 'I' + (delay || 0); d.timers[k] = (d.timers[k] || 0) + 1; return _si.call(this, fn, delay, ...a) }
  const _set = Storage.prototype.setItem
  Storage.prototype.setItem = function (k, v) {
    const t = performance.now(); _set.call(this, k, v); const dt = performance.now() - t
    const g = d.setItems; const key = String(k).replace(/-\d{4}-\d{2}-\d{2}/, '-<date>').replace(/-w\d+/, '-w#')
    g[key] = g[key] || { n: 0, ms: 0, bytes: 0 }; g[key].n++; g[key].ms += dt; g[key].bytes += String(v).length
  }
  const _js = JSON.stringify
  JSON.stringify = function (...a) { const t = performance.now(); const r = _js.apply(this, a); d.stringify.n++; d.stringify.ms += performance.now() - t; return r }
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) d.longtasks.push(Math.round(e.duration)) }).observe({ entryTypes: ['longtask'] }) } catch (e) {}
  const bump = () => { d.frames++; requestAnimationFrame(bump) }; requestAnimationFrame(bump)
  try { new MutationObserver(recs => { d.mutations += recs.length }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true }) } catch (e) {}
  window.addEventListener('error', e => d.errors.push(String(e.message).slice(0, 120)))
}

async function snapshot(page, label, seconds) {
  await page.evaluate(() => {
    const d = window.__diag
    d.timers = {}; d.setItems = {}; d.stringify = { n: 0, ms: 0 }; d.longtasks = []; d.mutations = 0; d.frames = 0
    d._t0 = performance.now()
  })
  await sleep(seconds * 1000)
  return await page.evaluate(({ label, seconds }) => {
    const d = window.__diag
    const el = performance.now() - d._t0
    const fps = d.frames / (el / 1000)
    const lt = d.longtasks
    const rows = Object.entries(d.setItems).map(([k, v]) => `${k}: ${v.n}次/${v.ms.toFixed(1)}ms${v.bytes ? '/' + (v.bytes / 1024).toFixed(1) + 'KB' : ''}`)
    return {
      label, seconds: +(el / 1000).toFixed(1),
      fps: +fps.toFixed(1),
      frames: d.frames,
      timers: Object.entries(d.timers).sort().map(([k, v]) => `${k}:${v}`).join(' '),
      setItems: rows,
      stringify: `n=${d.stringify.n} total=${d.stringify.ms.toFixed(1)}ms avg=${(d.stringify.ms / Math.max(1, d.stringify.n)).toFixed(2)}ms`,
      longtasks: lt.length ? `count=${lt.length} max=${Math.max(...lt)}ms avg=${Math.round(lt.reduce((a, b) => a + b, 0) / lt.length)}ms total=${lt.reduce((a, b) => a + b, 0)}ms` : 'none',
      mutations: d.mutations,
      errors: d.errors.slice(0, 3),
    }
  }, { label, seconds })
}

function print(s) {
  console.log(`\n━━━ ${s.label}（${s.seconds}s 实测）━━━`)
  console.log(`  FPS            : ${s.fps}  (frames=${s.frames})`)
  console.log(`  长任务         : ${s.longtasks}`)
  console.log(`  DOM 变动       : ${s.mutations} 次`)
  console.log(`  定时器创建     : ${s.timers}`)
  console.log(`  localStorage写 : ${s.setItems.join('\n                   ') || '(无)'}`)
  console.log(`  JSON.stringify : ${s.stringify}`)
  if (s.errors.length) console.log(`  页面错误       : ${s.errors.join(' | ')}`)
}

async function profileTop(cdp, ms, label) {
  await cdp.send('Profiler.setSamplingInterval', { interval: 250 })
  await cdp.send('Profiler.start')
  await sleep(ms)
  const { profile } = await cdp.send('Profiler.stop')
  const byId = new Map(profile.nodes.map(n => [n.id, n]))
  const self = new Map()
  for (const id of profile.samples) {
    const n = byId.get(id); if (!n) continue
    const cf = n.callFrame
    const name = (cf.functionName || '(anonymous)') + ' @ ' + String(cf.url || '').split('/').pop() + ':' + cf.lineNumber
    self.set(name, (self.get(name) || 0) + 1)
  }
  const total = profile.samples.length
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)
  console.log(`\n【CPU Profile · ${label}】总样本 ${total}（≈${(total * 0.25 / 1000).toFixed(1)}s CPU 时间 / ${(ms / 1000).toFixed(0)}s 墙钟）`)
  top.forEach(([k, v]) => console.log(`   ${String(v).padStart(5)} (${(v / total * 100).toFixed(1).padStart(4)}%)  ${k}`))
}

let browser, server
try {
  if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(1) }
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true })
  for (let i = 0; i < 40; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch (e) {} await sleep(300) }
  browser = await chromium.launch({ executablePath: EDGE, headless: true })
  const ctx = await browser.newContext({ viewport: { width: 480, height: 900 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await page.addInitScript(INSTRUMENT)
  await page.goto(BASE); await page.waitForLoadState('domcontentloaded'); await sleep(800)
  await page.evaluate(fx => { localStorage.clear(); localStorage.setItem('hotel-sim-state', fx) }, fixture)
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(2500)

  const landed = await page.evaluate(() => document.body.innerText.slice(0, 120).replace(/\n/g, ' | '))
  console.log(`▶ CPU 降频 ${CPU}x · 落地页: ${landed}`)

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  await sleep(1500)

  // ── 阶段 A：经营页 静置 ──
  const A = await snapshot(page, '阶段A · 经营页静置（12周大存档）', 15)
  print(A)
  await profileTop(cdp, 12000, '经营页静置')

  // ── 阶段 B：经营页 交互（滚动——用户报"拖不动"）──
  const B0 = await page.evaluate(() => {
    const d = window.__diag; d.timers = {}; d.longtasks = []; d.frames = 0; d._t0 = performance.now()
    return !!document.querySelector('.content')
  })
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 400); await sleep(120) }
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, -400); await sleep(120) }
  const B = await page.evaluate(() => {
    const d = window.__diag; const el = performance.now() - d._t0; const lt = d.longtasks
    return { label: '阶段B · 经营页滚动', seconds: +(el / 1000).toFixed(1), fps: +(d.frames / (el / 1000)).toFixed(1), frames: d.frames, timers: Object.entries(d.timers).sort().map(([k, v]) => `${k}:${v}`).join(' '), longtasks: lt.length ? `count=${lt.length} max=${Math.max(...lt)}ms total=${lt.reduce((a, b) => a + b, 0)}ms` : 'none', mutations: d.mutations, setItems: [], stringify: '-' }
  })
  print(B)

  // ── 阶段 C：对比——周报页（同存档点结算）──
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('本周结算')); b && b.click() })
  await sleep(2500)
  const onReport = await page.evaluate(() => document.body.innerText.includes('周经营结果'))
  console.log(`\n▶ 已进入周报页: ${onReport}`)
  const C = await snapshot(page, '阶段C · 周报页静置（对比组）', 15)
  print(C)
  await profileTop(cdp, 12000, '周报页静置')

  // ── 摘要对比 ──
  console.log('\n══════════ 对比摘要 ══════════')
  console.log(`经营页静置 FPS ${A.fps}  vs  周报页静置 FPS ${C.fps}`)
  console.log(`经营页长任务 ${A.longtasks}`)
  console.log(`周报页长任务 ${C.longtasks}`)
  console.log(`经营页定时器 ${A.timers}`)
  console.log(`周报页定时器 ${C.timers}`)
} catch (e) {
  console.error('诊断中断:', e.message)
} finally {
  try { await browser?.close() } catch (e) {}
  try { if (server?.pid) require2('node:child_process').execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }) } catch (e) {}
}
