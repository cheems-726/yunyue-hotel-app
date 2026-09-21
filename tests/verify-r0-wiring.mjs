// R0 接线验证：真实流程（离线演示态，不登录真账号）
// 验证三条：① 做决策 → 属性变化正常  ② 结算 → 属性因结算/衰减而变化（非恒定）  ③ 刷新 → 属性不回退
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
const require2 = createRequire(import.meta.url)
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:4173/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const results = []
const ok = (n, c, extra = '') => { results.push({ n, pass: !!c }); console.log(`  ${c ? '✓' : '✗'} ${n}${c ? '' : '  [' + extra + ']'}`) }

// 开业态存档（全季/中档 → 品质每周衰减 -2；周1 事件按固定种子）
const FX = JSON.stringify({
  user: { role: 'student', id: 'demo-r0', name: '接线验证', cloud: false, groupNo: null, className: null, groupRole: null },
  location: { city: '成都', district: '锦江区', attrs: { 客流: 5, 房价: 5, 租金: 5, 竞争: 5, 人力: 4, 波动: 2 } },
  brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' },
  property: { name: '社区旁物业', type: '社区型', area: '2600㎡', rooms: '72间', rent: '中等', match: '高' },
  established: true, estChoices: { invest: '基准情景', supplier: '供应商 B：指定供应商', opening: ['装修', '系统上线', '招聘'] },
  doneDecisions: {}, report: null, week: 1, history: [], finished: false, welcomed: true,
})

let browser, server
try {
  if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(1) }
  server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore', shell: true, detached: true })
  for (let i = 0; i < 40; i++) { try { const x = await fetch(BASE); if (x.ok) break } catch (e) {} await sleep(300) }
  browser = await chromium.launch({ executablePath: EDGE, headless: true })
  const page = await (await browser.newContext({ viewport: { width: 480, height: 900 }, isMobile: true, hasTouch: true })).newPage()
  const errs = []
  page.on('pageerror', e => { if (!(e.message || '').includes('plugin is not implemented')) errs.push(e.message) })
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('plugin is not implemented')) errs.push('[console] ' + m.text().slice(0, 140)) })
  page.on('dialog', d => d.accept())
  const st = () => page.evaluate(() => JSON.parse(localStorage.getItem('hotel-sim-state') || '{}'))
  const body = () => page.evaluate(() => document.body.innerText)
  const closeOverlay = async () => { await page.evaluate(() => { const b = [...document.querySelectorAll('*')].find(x => x.textContent.trim() === '明白了'); b && b.click() }); await sleep(300) }

  await page.goto(BASE); await page.waitForLoadState('domcontentloaded'); await sleep(800)
  await page.evaluate(s => { localStorage.clear(); localStorage.setItem('hotel-sim-state', s) }, FX)
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(2600)

  const a0 = (await st()).attrs
  console.log(`   起点属性：${JSON.stringify(a0)}`)
  ok('①-a 起点为中性值 {60,70,65}', a0.quality === 60 && a0.reputation === 70 && a0.morale === 65, JSON.stringify(a0))

  // ── ① 做决策 → 属性变化 ──
  await page.evaluate(() => { const c = [...document.querySelectorAll('.task-card')].find(x => x.textContent.includes('客房质检')); c && c.click() }); await sleep(900)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && (x.textContent.includes('确认决策') || x.textContent.includes('提交'))); b && b.click() }); await sleep(1000)
  await closeOverlay()
  const a1 = (await st()).attrs
  console.log(`   决策后：${JSON.stringify(a1)}`)
  ok('①-b 做决策（客房质检）→ 品质 +5（60→65）', a1.quality === 65, JSON.stringify(a1))

  // ── ② 结算 → 属性因结算/衰减变化（非恒定）──
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('本周结算')); b && b.click() }); await sleep(2600)
  const settled = (await body()).includes('周经营结果')
  ok('②-a 进入周报页', settled)
  const s2 = await st()
  const a2 = s2.attrs
  const rep = s2.report || {}
  console.log(`   结算后：${JSON.stringify(a2)}（周报 attrsAfter=${JSON.stringify(rep.attrsAfter)} / 事件后=${JSON.stringify(rep.attrsAfterEvents)}）`)
  ok('②-b 结算确实改变了属性（衰减生效，非恒定）', a2.quality !== a1.quality, `${a1.quality} → ${a2.quality}`)
  ok('②-c 品质按中档衰减 -2（65 → 约 62-63，视本周事件）', a2.quality <= a1.quality - 2, `65 → ${a2.quality}`)
  ok('②-d 周报带回 attrsAfter 且已写回 state', !!rep.attrsAfter && rep.attrsAfter.quality === a2.quality, `rep=${JSON.stringify(rep.attrsAfter)} state=${JSON.stringify(a2)}`)
  ok('②-e 事件影响与自然衰减都体现在回报里', !!rep.attrsAfterEvents, JSON.stringify(rep.attrsAfterEvents))

  // ── ③ 刷新 → 不回退 ──
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(2600)
  const a3 = (await st()).attrs
  console.log(`   刷新后：${JSON.stringify(a3)}`)
  ok('③ 刷新后属性不回退（仍是结算后的值）', a3.quality === a2.quality && a3.morale === a2.morale, `${JSON.stringify(a2)} vs ${JSON.stringify(a3)}`)
  ok('面板显示与 state 一致', (await body()).includes(String(a3.quality)))
  ok('全程无 JS 报错', errs.length === 0, errs.slice(0, 2).join(' | '))

  const failed = results.filter(r => !r.pass)
  console.log(`\n========== R0 接线验证：${results.length - failed.length} 通过 / ${failed.length} 失败 ==========`)
  failed.forEach(f => console.log('  ✗ ' + f.n))
  process.exitCode = failed.length ? 1 : 0
} catch (e) { console.error('中断:', e.message); process.exitCode = 1 } finally {
  try { await browser?.close() } catch (e) {}
  try { if (server?.pid) require2('node:child_process').execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }) } catch (e) {}
}
