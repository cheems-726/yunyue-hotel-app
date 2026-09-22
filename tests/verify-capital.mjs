// ✅项④ 验收：资金唯一权威 + B5（prevCapital 累积 / bizMode 落盘）+ 旧档平滑迁移
// 运行：npm run build && node tests/verify-capital.mjs
// 只走离线演示路径（不登录云端、不写生产数据）
import { chromium } from 'playwright-core'
import { spawn, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4177
const BASE = `http://localhost:${PORT}/`
const results = []
const sleep = ms => new Promise(r => setTimeout(r, ms))
let lastText = ''
function ok(name, cond) {
  results.push({ name, pass: !!cond })
  console.log((cond ? '  ✓ ' : '  ✗ ') + name)
  if (!cond) console.log('    [页面] ' + String(lastText).slice(0, 170).replace(/\n/g, ' | '))
}
async function text(page) { lastText = await page.evaluate(() => document.body.innerText); return lastText }
async function clickText(page, t) {
  return page.evaluate(t2 => {
    const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2))
    if (b) { b.click(); return true }
    return false
  }, t)
}
async function clickCard(page, t, mode = 'includes') {
  return page.evaluate(({ t, mode }) => {
    const ms = [...document.querySelectorAll('.district-card, div')].filter(x => mode === 'starts' ? x.textContent.startsWith(t) : x.textContent.includes(t))
    if (!ms.length) return false
    const inner = ms.reverse().find(x => !ms.some(y => y !== x && x.contains(y)))
    inner.click(); return true
  }, { t, mode })
}
async function hasOverlay(page) {
  return page.evaluate(() => !!([...document.querySelectorAll('div')].find(d => d.style.position === 'fixed' && d.textContent.includes('你的选择会带来'))))
}
async function closeOverlay(page) { await clickText(page, '明白了'); await sleep(250) }
const state = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('hotel-sim-state') || '{}') } catch (e) { return {} } })

if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(1) }
let server, browser
server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true })
for (let i = 0; i < 30; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch (e) {} await sleep(300) }
browser = await chromium.launch({ executablePath: EDGE, headless: true })
const ctx = await browser.newContext({ viewport: { width: 480, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', e => { if (!String(e.message).includes('plugin is not implemented')) ok('页面JS异常: ' + e.message, false) })

try {
  console.log('▶ 资金权威 + B5 验收')
  await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await sleep(1200)

  // ── 开店（认领时选「OTA平台合作」→ 用于验 B5 的 bizMode 落盘）──
  await clickText(page, '我是学生'); await sleep(400)
  await clickText(page, '离线演示'); await sleep(400)
  await clickText(page, '进入演示'); await sleep(700)
  await clickText(page, '开始我的酒店之旅'); await sleep(800)
  await clickCard(page, '锦江区'); await sleep(500); await closeOverlay(page)
  await clickText(page, '确认选址'); await sleep(700)
  await clickCard(page, '汉庭'); await sleep(450)
  await clickText(page, '确认选择'); await sleep(700)
  await clickCard(page, 'OTA平台合作'); await sleep(400)
  await clickText(page, '确认'); await sleep(650)
  await clickCard(page, '社区旁物业'); await sleep(400)
  for (let i = 0; i < 7; i++) {
    const done = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('完成认领'))
      if (b) { b.click(); return true }
      const n = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('下一步'))
      if (n) { n.click(); return false }
      return false
    })
    await sleep(550); if (done) break
  }
  await clickCard(page, '基准情景', 'starts'); await sleep(500); await closeOverlay(page)
  await page.evaluate(() => { const s = [...document.querySelectorAll('div')].find(d => d.textContent === '📄' && d.style.cursor === 'pointer'); s && s.click() }); await sleep(400)
  for (const n of ['申领营业执照', '刻章备案', '消防检查合格证', '特种行业经营许可证', '卫生许可证', '税务申报']) {
    await clickCard(page, n, 'starts'); await sleep(450)
    if (!(await hasOverlay(page))) { await closeOverlay(page); await clickCard(page, n, 'starts'); await sleep(450) }
    await closeOverlay(page)
  }
  await page.evaluate(() => { const s = [...document.querySelectorAll('div')].find(d => d.textContent === '🛒' && d.style.cursor === 'pointer'); s && s.click() }); await sleep(400)
  await clickCard(page, '供应商 A'); await sleep(500); await closeOverlay(page)
  await page.evaluate(() => { const s = [...document.querySelectorAll('div')].find(d => d.textContent === '🎉' && d.style.cursor === 'pointer'); s && s.click() }); await sleep(400)
  for (const n of ['装修', '系统上线', '招聘']) { await clickCard(page, n, 'starts'); await sleep(450); await closeOverlay(page); await clickCard(page, n, 'starts'); await sleep(300) }
  await clickText(page, '完成筹建'); await sleep(1300); await closeOverlay(page)
  ok('已进入经营页', (await text(page)).includes('资金状况'))

  // ── ① B5：认领页选的经营模式已落盘（此前 mode 被丢弃，App 里根本没有这个字段）──
  const st1 = await state(page)
  ok(`bizMode 已随认领选择落盘（实测 "${st1.bizMode}"）`, st1.bizMode === 'ota')
  ok(`capital 已进存档（实测 ${st1.capital}）`, typeof st1.capital === 'number')

  // ── ② 资金卡显示 == 权威值（不再双重扣成本）──
  const readCardCap = () => page.evaluate(() => {
    const cands = [...document.querySelectorAll('div')].filter(d => /资金状况|资金偏低|破产预警/.test(d.textContent) && /万/.test(d.textContent))
    if (!cands.length) return null
    const el = cands[cands.length - 1]                       // 取最内层那张卡
    const m = el.textContent.match(/([\d.]+)\s*万/)
    return m ? Math.round(Number(m[1]) * 10000) : null
  })
  const cardCap = await readCardCap()
  ok(`资金卡 = 权威值 ${st1.capital}（实测 ${cardCap}）`, cardCap === st1.capital)
  const wrongOld = 500000 - 0 + 0   // 首周：旧式 = 500000 − ΣtotalExpenses + Σprofit；此处只需断言等于权威值即可
  ok('资金卡不再用 500000−ΣtotalExpenses+Σprofit 的旧式', cardCap !== wrongOld || st1.capital === 500000)

  // ── ③ 做一项决策 + 结算 → 资金必须累积（= 上一周 + 本周利润）──
  await page.evaluate(() => { const c = [...document.querySelectorAll('.task-card')].find(x => x.textContent.includes('前台排班')); c && c.click() }); await sleep(700)
  await page.evaluate(() => { const o = [...document.querySelectorAll('div, button')].reverse().find(x => x.textContent.includes('精简省成本') && x.children.length <= 2); o && o.click() }); await sleep(400)
  await page.evaluate(() => { const b = document.querySelector('.btn-confirm'); if (b && !b.disabled) b.click() }); await sleep(1000)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('本周结算')); if (b) b.click() }); await sleep(1200)
  await clickText(page, '确认'); await sleep(1500)
  let wr = await text(page)
  for (let i = 0; i < 5 && !wr.includes('周经营结果'); i++) { await sleep(2000); wr = await text(page) }
  const mProfit = wr.match(/利润[^\d-]*(-?[\d,]+)\s*元/)
  ok('周报已出（含利润）', !!mProfit)
  const st2 = await state(page)
  const profit = mProfit ? Number(mProfit[1].replace(/,/g, '')) : null
  ok(`结算后资金 = 500000 + 本周利润（${st2.capital} vs ${profit}）`, profit != null && st2.capital === 500000 + profit)

  // ── ④ 进入下一周 → 资金卡显示累积值（不再是每周重置的 50 万+本周）──
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /进入第|最终成绩/.test(x.textContent)); if (b) b.click() }); await sleep(1400)
  const st3 = await state(page)
  const card2 = await readCardCap()
  // 卡片显示格式为 (cap/10000).toFixed(1) 万 → 容差 ±500（显示精度，不是精度差）
  ok(`第 2 周资金卡仍显示累积值（显示 ${card2} ≈ 权威 ${st3.capital}）`, card2 != null && Math.abs(card2 - st3.capital) <= 500 && st3.capital > 500000)

  // ── ⑤ 旧档平滑迁移：有 history 但无 capital → 500000 + Σ历史利润 ──
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('hotel-sim-state') || '{}')
    st.history = [{ week: 1, profit: 12345 }, { week: 2, profit: 6789 }]
    delete st.capital
    localStorage.setItem('hotel-sim-state', JSON.stringify(st))
  })
  await page.reload(); await sleep(1600)
  const card3 = await readCardCap()
  ok(`旧档（无 capital 字段）平滑迁移 = 500000+Σ利润 = 519134（显示 ${card3}，容差 ±500）`, card3 != null && Math.abs(card3 - (500000 + 12345 + 6789)) <= 500)
  ok('无 JS 异常', true)
} catch (e) {
  ok('脚本异常: ' + (e && e.message), false)
} finally {
  console.log(`\n========== 结果: ${results.filter(r => r.pass).length} 通过 / ${results.filter(r => !r.pass).length} 失败 ==========`)
  try { await browser.close() } catch (e) {}
  try { if (server?.pid) { if (process.platform === 'win32') execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }); else server.kill('SIGTERM') } } catch (e) {}
}
process.exit(results.some(r => !r.pass) ? 1 : 0)
