// 聚焦探针：动画清单 + DOM规模 + LoAF长动画帧 + 布局几何
// A/B 对照：经营页(动画开) vs 经营页(动画关) vs 周报页
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
const require2 = createRequire(import.meta.url)
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4173, BASE = `http://localhost:${PORT}/`
const CPU = Number(process.argv[2] || 10)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const fixture = readFileSync(new URL('./_fixture12w.json', import.meta.url), 'utf8')

const INIT = () => {
  window.__p = { loaf: [], longtasks: [], frames: 0, errors: [] }
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__p.loaf.push({ d: Math.round(e.duration), block: Math.round(e.blockingDuration || 0), scripts: (e.scripts || []).map(s => (s.name || s.invoker || '?') + ':' + Math.round(s.duration || 0)).slice(0, 4) }) }).observe({ entryTypes: ['long-animation-frame'] }) } catch (e) { window.__p.noLoAF = String(e) }
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__p.longtasks.push(Math.round(e.duration)) }).observe({ entryTypes: ['longtask'] }) } catch (e) {}
  const bump = () => { window.__p.frames++; requestAnimationFrame(bump) }; requestAnimationFrame(bump)
  window.addEventListener('error', e => window.__p.errors.push(String(e.message).slice(0, 100)))
}

async function probe(page, label, secs, scroll = false) {
  await page.evaluate(() => { const p = window.__p; p.loaf = []; p.longtasks = []; p.frames = 0; p._t0 = performance.now() })
  if (scroll) {
    for (let i = 0; i < secs * 8; i++) { await page.mouse.wheel(0, i % 16 < 8 ? 300 : -300); await sleep(120) }
  } else await sleep(secs * 1000)
  const r = await page.evaluate(({ label, scroll }) => {
    const p = window.__p, el = performance.now() - p._t0
    const anims = document.getAnimations().map(a => {
      const eff = a.effect || {}
      const tgt = eff.target || {}
      return { name: (eff.getKeyframes && a.animationName) || a.animationName || '?', iter: eff.getComputedTiming ? eff.getComputedTiming().iterations : '?', play: a.playState, cls: String(tgt.className || tgt.tagName || '?').slice(0, 40) }
    })
    const inf = anims.filter(a => a.iter === Infinity || a.iter === null)
    const appEl = document.querySelector('.app'), tb = document.querySelector('.tabbar'), ct = document.querySelector('.content')
    return {
      label, secs: +(el / 1000).toFixed(1), fps: +(p.frames / (el / 1000)).toFixed(1),
      loafCount: p.loaf.length,
      loafMax: p.loaf.length ? Math.max(...p.loaf.map(x => x.d)) : 0,
      loafTotal: p.loaf.reduce((s, x) => s + x.d, 0),
      loafTop: p.loaf.sort((a, b) => b.d - a.d).slice(0, 5),
      longtasks: p.longtasks.length, ltMax: p.longtasks.length ? Math.max(...p.longtasks) : 0,
      domNodes: document.querySelectorAll('*').length,
      animTotal: anims.length, animInfinite: inf.length,
      animList: inf.slice(0, 8).map(a => `${a.name}[${a.cls}]`),
      animRunning: anims.filter(a => a.play === 'running').length,
      geom: appEl ? { appH: Math.round(appEl.getBoundingClientRect().height), innerH: window.innerHeight, dvhH: (() => { const d = document.createElement('div'); d.style.height = '100dvh'; d.style.position = 'absolute'; document.body.appendChild(d); const h = d.getBoundingClientRect().height; d.remove(); return Math.round(h) })(), tabbar: tb ? { top: Math.round(tb.getBoundingClientRect().top), bottom: Math.round(tb.getBoundingClientRect().bottom), h: Math.round(tb.getBoundingClientRect().height) } : null, contentH: ct ? Math.round(ct.getBoundingClientRect().height) : null, contentScrollH: ct ? ct.scrollHeight : null } : null,
      errors: p.errors.slice(0, 2),
    }
  }, { label, scroll })
  console.log(`\n━━━ ${r.label}（${r.secs}s）━━━`)
  console.log(`  FPS ${r.fps} | 长任务 ${r.longtasks}${r.longtasks ? ' max=' + r.ltMax + 'ms' : ''} | LoAF ${r.loafCount} total=${r.loafTotal}ms max=${r.loafMax}ms`)
  if (r.loafTop.length) console.log(`  LoAF详情: ` + r.loafTop.map(x => `${x.d}ms(block${x.block})${x.scripts.length ? ' [' + x.scripts.join(',') + ']' : ''}`).join(' | '))
  console.log(`  DOM节点 ${r.domNodes} | 动画 总${r.animTotal} 无限${r.animInfinite} 运行中${r.animRunning}`)
  if (r.animList.length) console.log(`  无限动画: ${r.animList.join(' / ')}`)
  if (r.geom) console.log(`  几何: 视口${r.geom.innerH} dvh=${r.geom.dvhH} app=${r.geom.appH} contentScrollH=${r.geom.contentScrollH} tabbar=${JSON.stringify(r.geom.tabbar)}`)
  if (r.errors.length) console.log(`  错误: ${r.errors.join(' | ')}`)
  return r
}

let browser, server
try {
  if (!existsSync('dist/index.html')) { console.error('✗ 先 npm run build'); process.exit(1) }
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true })
  for (let i = 0; i < 40; i++) { try { const x = await fetch(BASE); if (x.ok) break } catch (e) {} await sleep(300) }
  browser = await chromium.launch({ executablePath: EDGE, headless: true })
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await page.addInitScript(INIT)
  await page.goto(BASE); await page.waitForLoadState('domcontentloaded'); await sleep(700)
  await page.evaluate(fx => { localStorage.clear(); localStorage.setItem('hotel-sim-state', fx) }, fixture)
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(2500)
  console.log(`▶ CPU ${CPU}x | 落地: ${await page.evaluate(() => document.body.innerText.slice(0, 60).replace(/\n/g, ' | '))}`)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  await sleep(1200)

  const A = await probe(page, 'A 经营页 · 动画开（基线）', 12)
  const B = await probe(page, 'B 经营页 · 动画开 + 滚动（复现"拖不动"）', 10, true)

  // 对照实验：注入样式关掉全部动画（不改业务代码，仅运行时诊断）
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' })
  await sleep(600)
  const C = await probe(page, 'C 经营页 · 动画全关（对照）', 12)
  const D = await probe(page, 'D 经营页 · 动画全关 + 滚动（对照）', 10, true)

  // 周报页对照
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('本周结算')); b && b.click() })
  await sleep(2500)
  const E = await probe(page, 'E 周报页（用户报"正常"的对照页）', 12)

  console.log('\n══════════ 结论对比 ══════════')
  console.log(`经营页静置 : FPS ${A.fps} | LoAF ${A.loafCount}/${A.loafMax}ms | 长任务 ${A.longtasks}(max ${A.ltMax}ms) | 无限动画 ${A.animInfinite}`)
  console.log(`经营页滚动 : FPS ${B.fps} | LoAF ${B.loafCount}/${B.loafMax}ms | 长任务 ${B.longtasks}(max ${B.ltMax}ms)`)
  console.log(`经营页静置*: FPS ${C.fps} | LoAF ${C.loafCount}/${C.loafMax}ms | 长任务 ${C.longtasks}(max ${C.ltMax}ms)  ←动画全关`)
  console.log(`经营页滚动*: FPS ${D.fps} | LoAF ${D.loafCount}/${D.loafMax}ms | 长任务 ${D.longtasks}(max ${D.ltMax}ms)  ←动画全关`)
  console.log(`周报页静置 : FPS ${E.fps} | LoAF ${E.loafCount}/${E.loafMax}ms | 长任务 ${E.longtasks}(max ${E.ltMax}ms) | 无限动画 ${E.animInfinite} | DOM ${E.domNodes}`)
} catch (e) { console.error('中断:', e.message) } finally {
  try { await browser?.close() } catch (e) {}
  try { if (server?.pid) require2('node:child_process').execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }) } catch (e) {}
}
