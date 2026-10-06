// ✅项④ 验收：资金唯一权威 + B5（prevCapital 累积 / bizMode 落盘）+ 旧档平滑迁移
// 运行：npm run build && node tests/verify-capital.mjs
// 只走离线演示路径（不登录云端、不写生产数据）
import { chromium } from 'playwright-core'
let 复用常驻 = false   // ★ §27：是否复用常驻服务（复用 ⇒ 结束时不清杀）
import { spawn, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
// 🔴 W2-2 重基线（D38-B）：资金三数/版本号【从源头推导】，不再贴死数字 —— 口径再变无需重挂
//   SCALE.IC_NEW = 当前起始资金 · SCALE.m = 由 SCALE_STEPS 各跳推导的累计倍数 · SCALE.VERSION_CURRENT
import { SCALE } from '../src/stateMigration.mjs'

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
async function clickStep(page, t) {
  await page.evaluate((t) => { const sp = [...document.querySelectorAll('span')].find(x => x.textContent === t); const c = sp && sp.previousElementSibling; c && c.click() }, t)
  await sleep(400)
}
async function hasOverlay(page) {
  return page.evaluate(() => !!([...document.querySelectorAll('div')].find(d => d.style.position === 'fixed' && d.textContent.includes('你的选择会带来'))))
}
async function closeOverlay(page) { await clickText(page, '明白了'); await sleep(250) }
const state = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('hotel-sim-state') || '{}') } catch (e) { return {} } })

if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(1) }
let server, browser
// ★ 复用优先：端口已在监听 ⇒ 直接用常驻服务（**不 spawn、不清杀** —— 避免起停抖动/窗口闪烁）
复用常驻 = await fetch(BASE).then(r => r.ok).catch(() => false)
if (!复用常驻) {
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true })
} else {
  console.log('▶ 检测到 ' + PORT + ' 已有常驻预览服务 ⇒ 直接复用（不起新进程）')
}
for (let i = 0; i < 30; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch (e) {} await sleep(300) }
browser = await chromium.launch({ executablePath: EDGE, headless: true })
const ctx = await browser.newContext({ viewport: { width: 480, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', e => { if (!String(e.message).includes('plugin is not implemented')) ok('页面JS异常: ' + e.message, false) })
let 监听 = false
page.on('console', m => { const t = m.text(); if (!监听 && (t.includes('CSSStyleDeclaration') || t.includes('Error'))) { 监听 = true; console.error('CONSOLE-STACK ' + t.slice(0, 1500)) } })
page.on('pageerror', e => { const st = String(e.stack || e.message || ''); if (st.includes('CSSStyleDeclaration')) { console.error('STACK-START'); console.error(st.slice(0, 1200)); console.error('STACK-END') } })

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
      const n = [...document.querySelectorAll('button')].find(x => !x.disabled && /下一步|确认无误/.test(x.textContent))
      if (n) { n.click(); return false }
      return false
    })
    await sleep(550); if (done) break
  }
  await clickCard(page, '基准情景', 'starts'); await sleep(500); await closeOverlay(page)
  await clickStep(page, '证照办理')
  for (const n of ['申领营业执照', '刻章备案', '消防检查合格证', '特种行业经营许可证', '卫生许可证', '税务申报']) {
    await clickCard(page, n, 'starts'); await sleep(450)
    if (!(await hasOverlay(page))) { await closeOverlay(page); await clickCard(page, n, 'starts'); await sleep(450) }
    await closeOverlay(page)
  }
  await clickStep(page, '物资采购')
  await clickCard(page, '供应商 A'); await sleep(500); await closeOverlay(page)
  await clickStep(page, '开业计划')
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
  // 🔴 W2-2 重基线：新档起始资金必须 = SCALE.IC_NEW（1,490,000），且不再是 v1 时代的 50 万旧口径
  ok(`新档起始资金 = SCALE.IC_NEW ${SCALE.IC_NEW}（实测 ${st1.capital}）`, st1.capital === SCALE.IC_NEW)
  ok(`起始资金已不是最旧档口径 ${SCALE.IC_OLD}（旧式「50万 − 成本 + 利润」）`, st1.capital !== SCALE.IC_OLD)

  // ── ③ 做一项决策 + 结算 → 资金必须累积（= 上一周 + 本周利润）──
  await page.evaluate(() => { const c = [...document.querySelectorAll('.task-card')].find(x => x.textContent.includes('前台排班')); c && c.click() }); await sleep(700)
  await page.evaluate(() => { const o = [...document.querySelectorAll('div, button')].reverse().find(x => x.textContent.includes('精简省成本') && x.children.length <= 2); o && o.click() }); await sleep(400)
  await page.evaluate(() => { const b = document.querySelector('.btn-confirm'); if (b && !b.disabled) b.click() }); await sleep(1000)
  // 🔴 E2（N-2）：手动「本周结算」已退场 ⇒ 用【自动成报】路径：把开学教学日设为 6 天前，今天=第 7 游戏日
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('hotel-sim-state') || '{}')
    const d = new Date(Date.now() - 8 * 3600 * 1000)
    const today = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000)
    st.openDayNo = today - 6
    localStorage.setItem('hotel-sim-state', JSON.stringify(st))
  })
  await page.reload(); await sleep(2600)
  for (let i = 0; i < 8 && !(await text(page)).includes('周经营结果'); i++) await sleep(1500)
  let wr = await text(page)
  for (let i = 0; i < 5 && !wr.includes('周经营结果'); i++) { await sleep(2000); wr = await text(page) }
  const mProfit = wr.match(/利润[^\d-]*(-?[\d,]+)\s*元/)
  ok('周报已出（含利润）', !!mProfit)
  const st2 = await state(page)
  const profit = mProfit ? Number(mProfit[1].replace(/,/g, '')) : null
  ok(`结算后资金 = IC_NEW + 本周利润（${st2.capital} vs ${SCALE.IC_NEW + (profit || 0)}）`, profit != null && st2.capital === SCALE.IC_NEW + profit)

  // ── P5 对账：周报「期末资金」=== 权威 state（精确）=== 资金卡显示（容差 ±500，显示为 x.x 万）──
  let wrCap = null
  {
    const mCap = wr.match(/期末资金\s*([\d,]+)\s*元/)
    ok(`周报显示「期末资金」（${mCap ? mCap[1] : '未匹配'}）`, !!mCap)
    if (mCap) {
      wrCap = Number(mCap[1].replace(/,/g, ''))
      ok(`周报期末资金 === 权威 state（${wrCap} vs ${st2.capital}）`, wrCap === st2.capital)
    }
  }

  // ── ★ E1 新增：出租率 / 好评率 也要【界面 === 周报 === 权威 state】（不止资金）──
  //   做法：从 DOM 的 .metric 块取数（标签与数值分处两个 div，innerText 里夹着环比 chip ⇒ 不能用正则扫整页）
  {
    // ★ 权威口径：结算后那一刻，权威对象 = state.report（引擎本次输出，App 写回存档）；
    //   history 要到"进入下一周"才落档 ⇒ 这里对 report，落档一致性在 ④ 段单独验（不放过）
    const R = st2.report || {}
    const metrics = await page.evaluate(() => [...document.querySelectorAll('.metric')].map(m => m.innerText.replace(/\s+/g, ' ').trim()))
    const occBlock = metrics.find(t => t.startsWith('出租率'))
    const goodBlocks = [...wr.matchAll(/好评率\s*([\d.]+)%\s*→\s*([\d.]+)%/g)]
    ok(`周报「出租率」指标块可读（${occBlock || '未匹配'}）`, !!occBlock)
    if (occBlock) {
      const n = Number((occBlock.match(/([\d.]+)\s*%/) || [])[1])
      ok(`周报出租率 === 权威 state.report（${n} vs ${R.occupancy}）`, n === R.occupancy)
    }
    ok(`周报「好评率 X% → Y%」可读（${goodBlocks.length ? goodBlocks[0][0] : '未匹配'}）`, goodBlocks.length > 0)
    if (goodBlocks.length) {
      // 末值 = finalGoodRate（本周结算后的好评率）—— 必须 === 权威 state 的同名字段
      ok(`周报好评率（finalGoodRate）=== 权威 state.report（${Number(goodBlocks[0][2])} vs ${R.finalGoodRate}）`,
        Number(goodBlocks[0][2]) === R.finalGoodRate)
    }
  }

  // ── ④ 进入下一周 → 资金卡显示累积值（不再是每周重置的 50 万+本周）──
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /进入第|最终成绩/.test(x.textContent)); if (b) b.click() }); await sleep(1400)
  { const t = await text(page); console.log('PROBE1 资金状况=' + t.includes('资金状况') + ' 进入第=' + t.includes('进入第') + ' len=' + t.length) }
  { const t2 = await text(page); console.log('PROBE2 ' + JSON.stringify(t2.slice(0, 260))) }
  const st3 = await state(page)
  const card2 = await readCardCap()
  // 卡片显示格式为 (cap/10000).toFixed(1) 万 → 容差 ±500（显示精度，不是精度差）
  // 🔴 W2-2 重基线：累积的判据改为【= IC_NEW + 本周利润】（原来写的是 "> 5020000"，随 IC 变即失效）
  ok(`第 2 周资金卡仍是累积值（显示 ${card2} ≈ 权威 ${st3.capital}，且 = IC_NEW + 本周利润）`,
    card2 != null && Math.abs(card2 - st3.capital) <= 500 && profit != null && st3.capital === SCALE.IC_NEW + profit)
  // P5 对账（卡片可见时才比）：资金卡显示 === 上一份周报的「期末资金」（容差 ±500 = x.x 万显示精度）
  if (wrCap != null) ok(`资金卡显示 ≈ 周报期末资金（${card2} vs ${wrCap}）`, card2 != null && Math.abs(card2 - wrCap) <= 500)
  // ── ★ E1 新增：落档一致性（账本进 history 时不得被改写）──
  {
    const last = (st3.history || [])[st3.history.length - 1] || null
    const R = st2.report || {}
    ok('history 已落档至少 1 周', !!last)
    if (last) {
      ok(`落档三量与结算时权威值一致（capital ${last.capital ?? '—'} / occ ${last.occupancy} / 好评 ${last.finalGoodRate}）`,
        last.occupancy === R.occupancy && last.finalGoodRate === R.finalGoodRate && Number.isFinite(last.profit))
      ok('落档周值含 gop / netProfit / dailySnapshots（唯一账本链条完整）',
        Number.isFinite(last.gop) && Number.isFinite(last.netProfit) && Array.isArray(last.dailySnapshots) && last.dailySnapshots.length === 7)
    }
  }

  // ── ⑤ 旧档平滑迁移：真旧档 = 【既无 capital、也无 scaleVersion】──
  //   🔴 批次 B1：用例必须把 scaleVersion 一并删掉 —— 否则从当前存档派生出来的对象
  //      已带 scaleVersion=2，migrateSave 会【正确地】跳过它，用例就不再是"旧档"了
  //      （这正是 B1 的幂等契约：带版本标记的档不再迁移）
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('hotel-sim-state') || '{}')
    st.history = [{ week: 1, profit: 12345 }, { week: 2, profit: 6789 }]
    delete st.capital
    delete st.scaleVersion          // ★ 关键：不删它就不是旧档
    localStorage.setItem('hotel-sim-state', JSON.stringify(st))
  })
  await page.reload(); await sleep(1600)
  const card3 = await readCardCap()
  // 🔴 D25 公式：capital_new = IC_new + (capital_old − IC_old) × m
  //   capital_old（无 capital 字段时）= IC_old + Σ历史利润 = 500000 + 19134
  //   ★ W2-2 重基线：期望值【由版本序表推导】（SCALE.m = 各跳 m 的累计），并【打印推导式】便于复核
  const legacyCapital = SCALE.IC_OLD + (12345 + 6789)
  const expect3 = SCALE.IC_NEW + (legacyCapital - SCALE.IC_OLD) * SCALE.m
  console.log(`    [推导] IC_NEW ${SCALE.IC_NEW} + (旧档 ${legacyCapital} − IC_old ${SCALE.IC_OLD}) × 累计 m ${SCALE.m.toFixed(6)} = ${Math.round(expect3)}`)
  ok(`旧档（无 capital / 无 scaleVersion）平滑迁移 = ${Math.round(expect3)}（显示 ${card3}，容差 ±1000）`, card3 != null && Math.abs(card3 - expect3) <= 1000)
  // 迁移后必须落【当前】版本号（否则下次还会再迁一次）
  const ver = await page.evaluate(() => (JSON.parse(localStorage.getItem('hotel-sim-state') || '{}')).scaleVersion)
  ok(`迁移后存档已写回 scaleVersion = ${SCALE.VERSION_CURRENT}（幂等闭环）`, ver === SCALE.VERSION_CURRENT)
  ok('无 JS 异常', true)
} catch (e) {
  ok('脚本异常: ' + (e && e.message), false)
} finally {
  console.log(`\n========== 结果: ${results.filter(r => r.pass).length} 通过 / ${results.filter(r => !r.pass).length} 失败 ==========`)
  try { await browser.close() } catch (e) {}
  try { if (server?.pid && !复用常驻) { if (process.platform === 'win32') execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore', windowsHide: true }); else server.kill('SIGTERM') } } catch (e) {}
}
process.exit(results.some(r => !r.pass) ? 1 : 0)
