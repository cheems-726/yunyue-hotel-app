// N2 验收：四端品质来源统一（差值验证 + 旧档安全）
// 手法：同一份存档，只改 attrs.quality（20 vs 65），四个界面的称号/综合分必须随之变化。
//       若某界面仍在读品牌基线（全季=75，恒定），两次输出会完全相同 → 判定失败。
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
const require2 = createRequire(import.meta.url)
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:4173/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const results = []
const ok = (n, c, extra = '') => { results.push({ n, pass: !!c }); console.log(`  ${c ? '✓' : '✗'} ${n}${c ? '' : '  [' + extra + ']'}`) }

const fx = JSON.parse(readFileSync(new URL('./_fixture12w.json', import.meta.url), 'utf8'))
const mkState = (quality, extra = {}) => JSON.stringify({ ...fx, attrs: { quality, reputation: 70, morale: 65 }, ...extra })
// 周报页需要 report 非空（会用 result 渲染）；期末页需要 finished + 12 周历史
const wk1 = fx.history[0]
const reportState = (quality) => mkState(quality, { report: wk1, history: [] })
const finalState = (quality) => mkState(quality, { finished: true, history: fx.history.concat([wk1]) })

let browser, server
try {
  if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(1) }
  server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore', shell: true, detached: true })
  for (let i = 0; i < 40; i++) { try { const x = await fetch(BASE); if (x.ok) break } catch (e) {} await sleep(300) }
  browser = await chromium.launch({ executablePath: EDGE, headless: true })
  const ctx = await browser.newContext({ viewport: { width: 480, height: 900 }, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', e => { if (!(e.message || '').includes('plugin is not implemented')) errs.push(e.message) })
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('plugin is not implemented')) errs.push('[console] ' + m.text().slice(0, 150)) })
  page.on('dialog', d => d.accept())
  await page.goto(BASE); await page.waitForLoadState('domcontentloaded'); await sleep(800)  // 必须先落到同源页面，否则 localStorage 访问被拒
  const body = () => page.evaluate(() => document.body.innerText)
  const load = async st => { await page.evaluate(s => { localStorage.clear(); localStorage.setItem('hotel-sim-state', s) }, st); await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(2600) }
  const bad = t => /NaN|undefined/.test(t)
  const boundary = t => t.includes('页面出了点问题')

  // 各界面萃取"品质相关文本"
  const grabBiz = t => (t.match(/综合\s*\d+/) || [''])[0]                       // 经营页称号条
  const grabMe = t => (t.match(/还差综合\s*\d+\s*分/) || t.match(/当前称号：\S+/) || [''])[0]
  const grabReport = t => (t.match(/(首周评级|酒店晋升|酒店降级)[：!！]?\s*[^\n]{0,30}/) || [''])[0]
  const grabFinal = t => (t.match(/(普通旅社|舒适旅店|精品酒店|人气名店|标杆酒店)/g) || []).join(',')

  const run = async (st, grab, tap) => {
    await load(st)
    if (tap) { await page.evaluate(() => { const b = [...document.querySelectorAll('.tab')].find(x => x.textContent.includes('我的')); b && b.click() }); await sleep(1200) }
    const t = await body()
    return { txt: grab(t), raw: t, ok: !boundary(t) && !bad(t) }
  }

  console.log('\n▶ 差值验证：同一存档，attrs.quality 20 vs 65（品牌固定全季）')
  // ① 经营页
  const biz20 = await run(mkState(20), grabBiz)
  const biz65 = await run(mkState(65), grabBiz)
  console.log(`   经营页: q20 → "${biz20.txt}"  |  q65 → "${biz65.txt}"`)
  ok('【经营页】称号综合分随 attrs.quality 变化', biz20.txt && biz65.txt && biz20.txt !== biz65.txt, `${biz20.txt} vs ${biz65.txt}`)
  ok('【经营页】无白屏 / 无 NaN', biz20.ok && biz65.ok)

  // ② 我的页
  const me20 = await run(mkState(20), grabMe, true)
  const me65 = await run(mkState(65), grabMe, true)
  console.log(`   我的页: q20 → "${me20.txt}"  |  q65 → "${me65.txt}"`)
  ok('【我的页】称号/距下一称号随品质变化', me20.txt && me65.txt && me20.txt !== me65.txt, `${me20.txt} vs ${me65.txt}`)
  ok('【我的页】无白屏 / 无 NaN', me20.ok && me65.ok)

  // ③ 周报页（首周评级沿用 quality）
  const rp20 = await run(reportState(20), grabReport)
  const rp65 = await run(reportState(65), grabReport)
  console.log(`   周报页: q20 → "${rp20.txt}"  |  q65 → "${rp65.txt}"`)
  ok('【周报页】评级称号随品质变化', rp20.txt && rp65.txt && rp20.txt !== rp65.txt, `${rp20.txt} vs ${rp65.txt}`)
  ok('【周报页】无白屏 / 无 NaN', rp20.ok && rp65.ok)

  // ④ 期末成绩（称号轨迹）
  const fn20 = await run(finalState(20), grabFinal)
  const fn65 = await run(finalState(65), grabFinal)
  console.log(`   期末页: q20 → "${fn20.txt}"  |  q65 → "${fn65.txt}"`)
  ok('【期末成绩】称号轨迹随品质变化', fn20.txt && fn65.txt && fn20.txt !== fn65.txt, `${fn20.txt} vs ${fn65.txt}`)
  ok('【期末成绩】无白屏 / 无 NaN', fn20.ok && fn65.ok)

  // ⑤ 旧档（完全无 attrs 字段）四处不报错
  console.log('\n▶ 旧档安全：无 attrs 字段的 12 周存档走过四个界面')
  const legacy = JSON.stringify(fx)
  for (const [name, gen] of [['经营页', () => legacy], ['周报页', () => JSON.stringify({ ...fx, report: wk1, history: [] })], ['期末页', () => JSON.stringify({ ...fx, finished: true })]]) {
    const r = await run(gen(), () => '')
    ok(`【旧档】${name} 不报错、无 NaN`, r.ok, r.raw.slice(0, 60).replace(/\n/g, '|'))
  }
  const legacyMe = await run(legacy, () => '', true)
  ok('【旧档】我的页不报错、无 NaN', legacyMe.ok, legacyMe.raw.slice(0, 60).replace(/\n/g, '|'))
  ok('全程无 JS 报错', errs.length === 0, errs.slice(0, 2).join(' | '))

  const failed = results.filter(r => !r.pass)
  console.log(`\n========== N2 验收：${results.length - failed.length} 通过 / ${failed.length} 失败 ==========`)
  failed.forEach(f => console.log('  ✗ ' + f.n))
  process.exitCode = failed.length ? 1 : 0
} catch (e) { console.error('中断:', e.message); process.exitCode = 1 } finally {
  try { await browser?.close() } catch (e) {}
  try { if (server?.pid) require2('node:child_process').execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }) } catch (e) {}
}
