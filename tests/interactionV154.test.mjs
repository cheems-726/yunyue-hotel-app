// V154 批1 · 交互保真与可达性（#164）
// 运行：node tests/interactionV154.test.mjs   （浏览器套件 · 只进全量门禁）
// 判据（卡 §1）：① 真拖滑块能改值 ② 390×844 弹层不遮确认按钮 ③ 键盘可达（Tab/Enter/Esc）
//               ④ 可点元素 ≥44px 复扫
import { chromium } from 'playwright-core'
import { spawn, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { 是当前构建 } from './_previewFresh.mjs'
import { 过两道闸门 } from './_v109-site.mjs'   // 选址两道闸（预言+承诺书）· 与 ui-smoke 同一 helper
import { 过命名页 } from './_v114-name.mjs'   // 命名页 helper

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
let PORT = 4173, BASE = `http://localhost:${PORT}/`, server = null, 复用 = false
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const text = (pg) => pg.evaluate(() => document.body.innerText)
const clickText = async (pg, t, mode = 'includes') => pg.evaluate(({ t, mode }) => {
  const items = [...document.querySelectorAll('button, .district-card, div, span')]
    .filter(x => x.children.length === 0 || x.classList.contains('district-card'))
  const el = items.find(x => mode === 'exact' ? x.textContent.trim() === t : x.textContent.includes(t))
  if (el) { el.click(); return true }
  return false
}, { t, mode })
async function clickCard(pg, t, mode = 'includes') {
  const done = await pg.evaluate(({ t, mode }) => {
    const el = [...document.querySelectorAll('.district-card')].find(x => mode === 'starts' ? x.textContent.trim().startsWith(t) : x.textContent.includes(t))
    if (el) { el.click(); return true }
    return false
  }, { t, mode })
  if (!done) await clickText(pg, t, mode)
}
const clickBtn = async (pg, re, exact = false) => pg.evaluate(({ src, exact }) => {
  const re2 = new RegExp(src)
  const b = [...document.querySelectorAll('button')].find(x => !x.disabled && (exact ? x.textContent.trim() === src : re2.test(x.textContent)))
  if (b) { b.click(); return true }
  return false
}, { src: re.source, exact })
const hasOverlay = (pg) => pg.evaluate(() => !![...document.querySelectorAll('div')].find(d => d.style.position === 'fixed' && d.textContent.includes('你的选择会带来')))
const closeOverlay = async (pg) => { await clickText(pg, '明白了'); await sleep(250) }

if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(2) }
{
  const 有服务 = await fetch(BASE).then(r => r.ok).catch(() => false)
  复用 = 有服务 && await 是当前构建(BASE)
  if (有服务 && !复用) { for (let p = 4206; p <= 4230; p++) { if (!(await fetch(`http://localhost:${p}/`).then(() => true).catch(() => false))) { PORT = p; BASE = `http://localhost:${p}/`; break } } }
  if (!复用) server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true })
  console.log(复用 ? '▶ 复用常驻 4173（当前构建）' : '▶ 自起预览 ' + PORT)
}
for (let i = 0; i < 40; i++) { if (await fetch(BASE).then(r => r.ok).catch(() => false)) break; await sleep(300) }
const browser = await chromium.launch({ executablePath: EDGE, headless: true })

// 走到经营页（离线演示 · 全流程 · 与 ui-smoke 同路）
async function 进经营(page) {
  await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await sleep(1000)
  await clickText(page, '我是学生'); await sleep(400)
  await clickText(page, '离线演示'); await sleep(400)
  await clickBtn(page, /进入演示/); await sleep(700)
  await clickBtn(page, /开始我的酒店之旅/); await sleep(700)
  await page.evaluate(() => { const c = [...document.querySelectorAll('.district-card')].find(x => x.textContent.includes('锦江区')); if (c) c.click() }); await sleep(450)   // 精确点位卡（不回落到泛文本点击）
  if (process.env.I154_DEBUG) console.log('   [DBG after district] ' + (await text(page)).slice(0, 260).split(String.fromCharCode(10)).join(' | '))
  const 闸 = await 过两道闸门(page)   // 预言 + 承诺书（不签 ⇒ 确认选址点不动）
  if (process.env.I154_DEBUG) {
    const st = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /确认选址/.test(x.textContent))
      return { 确认选址禁用: b ? b.disabled : '按钮不存在', 有预言: document.body.innerText.includes('选址前预言'), 有承诺: document.body.innerText.includes('承诺书') }
    })
    console.log('   [DBG 闸门] ' + JSON.stringify(闸) + ' ' + JSON.stringify(st))
  }
  await clickBtn(page, /确认选址/); await sleep(650)
  await page.evaluate(() => { const c = [...document.querySelectorAll('.district-card')].find(x => x.textContent.trim().startsWith('汉庭')); if (c) c.click() }); await sleep(450)
  if (process.env.I154_DEBUG) console.log('   [DBG brand sel] ' + (await text(page)).slice(0, 120).split(String.fromCharCode(10)).join(' | '))
  await clickBtn(page, /确认选择/); await sleep(650)
  if (process.env.I154_DEBUG) console.log('   [DBG after brand] ' + (await text(page)).slice(0, 140).split(String.fromCharCode(10)).join(' | '))
  await page.evaluate(() => { const c = [...document.querySelectorAll('.district-card')].find(x => /OTA平台合作/.test(x.textContent)); if (c) c.click() }); await sleep(400)
  await clickBtn(page, /确认/); await sleep(550)
  if (process.env.I154_DEBUG) console.log('   [DBG after mode] ' + (await text(page)).slice(0, 140).split(String.fromCharCode(10)).join(' | '))
  // 认领 6 步（有 [data-claim-opt] 的选第一项 + 填一句理由）
  for (let i = 0; i < 12; i++) {
    const t = await text(page)
    if (t.includes('门店筹建') || t.includes('给你的酒店取名')) break
    const opt = page.locator('[data-claim-opt]').first()
    if (await opt.count()) { await opt.click().catch(() => {}); await sleep(250) }
    // 步 0（意向申请）：必须选中候选物业（可继续的前置）；其余步有 data-claim-opt
    await page.evaluate(() => { const cs = [...document.querySelectorAll('.district-card')].filter(x => /物业/.test(x.textContent) && !x.getAttribute('data-claim-opt')); const c = cs.find(x => /交通枢纽/.test(x.textContent)) || cs[0]; if (c) c.click() }); await sleep(200)   // 优先枢纽型（3000㎡ · 房量达标）
    const ta = page.locator('[data-claim-reason]').first()
    const 有框 = await ta.count()
    if (有框) { await ta.fill('现金紧，先保开业，再逐步把品质补上。').catch(() => {}); await sleep(200) }
    const 点了 = await clickBtn(page, /确认本步取舍|完成认领|下一步|确认无误|确认/)
    if (process.env.I154_DEBUG) console.log(`   [DBG claim ${i}] 框=${有框} 点=${点了} 步=${/第 \d+ \/ 共 6 步|第 \d+步/.exec(t)?.[0] || '?'}`)
    await sleep(500)
  }
  await 过命名页(page, '云悦·保真测试店'); await sleep(600)
  // 筹建：投资（降装修档）→ 完成投资 → 证照全点 → 采购 → 开业 → 进入经营
  await clickCard(page, '基准情景', 'starts'); await sleep(450)
  if (await hasOverlay(page)) await closeOverlay(page)
  await page.evaluate(() => { const c = document.querySelector('[data-tier="装修"][data-val="低"]'); if (c) c.click() }); await sleep(350)
  await page.evaluate(() => { const n = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('完成「投资测算」')); if (n) n.click() }); await sleep(550)
  const 步 = async (t) => page.evaluate((t) => { const sp = [...document.querySelectorAll('span')].find(x => x.textContent === t); const c = sp && sp.previousElementSibling; c && c.click() }, t)
  await 步('证照办理')
  for (const n of ['申领营业执照', '刻章备案', '消防检查合格证', '特种行业经营许可证', '卫生许可证', '税务申报']) {
    await clickCard(page, n, 'starts'); await sleep(350)
    if (await hasOverlay(page)) await closeOverlay(page); else { await clickCard(page, n, 'starts'); await sleep(300); if (await hasOverlay(page)) await closeOverlay(page) }
  }
  await 步('物资采购')
  await clickCard(page, '供应商 A'); await sleep(350); if (await hasOverlay(page)) await closeOverlay(page)
  await 步('开业计划')
  for (const n of ['装修', '系统上线', '招聘']) { await page.evaluate((n) => { const c = [...document.querySelectorAll('div')].find(x => x.style && x.style.cursor === 'pointer' && x.textContent.trim().startsWith(n) && /优先级/.test(x.textContent) === false); if (c) c.click() }, n); await sleep(450); if (await hasOverlay(page)) await closeOverlay(page); await sleep(200) }   // 开业任务卡 = 带 onClick 的裸 div（非 district-card）
  await clickBtn(page, /完成筹建/); await sleep(1200)
  if (await hasOverlay(page)) await closeOverlay(page)   // 开业反馈弹层（含《开店宣言》）
  await sleep(400)
  return (await text(page)).includes('本周经营中')
}

try {
  // ===== 390×844 主视口 =====
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await 进经营(page)
  const 在经营 = await page.evaluate(() => !!document.querySelector('.tabbar'))
  ok('演示流程走到经营页（批1 的靶场就位）', 在经营)
  if (!在经营 || process.env.I154_DEBUG) console.log('   [DBG 经营页?] ' + (await text(page)).slice(0, 400).split(String.fromCharCode(10)).join(' | '))

  // ① 真拖押注滑块（data-bet-range · 原生 input[type=range]）
  {
    await page.evaluate(() => document.querySelector('input[data-bet-range]').scrollIntoView({ block: 'center' })); await sleep(300)
    const box = await page.locator('input[data-bet-range]').boundingBox()
    if (!box) { ok(false, '① 押注滑块在场（找不到 data-bet-range）'); }
    else {
      const 读值 = () => page.evaluate(() => { const el = document.querySelector('input[data-bet-range]'); const 卡 = el.closest('.card'); const m = /(\d+)\s*%/.exec(卡.textContent); return { v: Number(el.value), 文本: m ? Number(m[1]) : null } })
      const 前 = await 读值()
      const cx = box.x + box.width * 0.25, cy = box.y + box.height / 2
      await page.mouse.move(cx, cy); await page.mouse.down()
      await page.mouse.move(cx + 22, cy, { steps: 6 })   // 真拖 ≥20px
      await page.mouse.move(cx + 45, cy, { steps: 6 })
      await page.mouse.up(); await sleep(250)
      const 后 = await 读值()
      ok(Math.abs(后.v - 前.v) >= 1, `① 真拖 ≥20px ⇒ 押注出租率 ${前.v} → ${后.v}（变化 ≥1 档）`)
      ok(后.文本 != null && Math.abs(后.文本 - 后.v) <= 1, `① 拖动后显示值同步（文本 ${后.文本}% ≈ 值 ${后.v}）`)
    }
  }

  // ② 390×844 弹层不遮确认按钮（决策面板 + 押注卡）
  {
    // 押注卡提交按钮
    const 押 = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => /锁定本周押注|先给出出租率和净利方向/.test(b.textContent))
      if (!btn) return null
      const r = btn.getBoundingClientRect()
      const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return { h: Math.round(r.height), inVp: r.bottom <= innerHeight + 1 && r.top >= 0, covered: el !== btn && !btn.contains(el) }
    })
    ok(押 && 押.inVp && !押.covered, `② 390 押注提交按钮在视口内且未被遮挡（h=${押 && 押.h} covered=${押 && 押.covered}）`)
    // 决策面板（overbook 滑块类）：经决策区打开
    await clickBtn(page, /^全部$/); await sleep(350)   // 超额预订不在「每日关键」筛选里
    await page.evaluate(() => { const c = [...document.querySelectorAll('.task-card')].find(x => x.textContent.includes('超额预订')); if (c) { c.scrollIntoView({ block: 'center' }); c.click() } }); await sleep(700)
    await sleep(600)
    const 面板确认 = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => /确认决策，保存/.test(b.textContent))
      if (!btn) return null
      const r = btn.getBoundingClientRect()
      const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return { h: Math.round(r.height), inVp: r.bottom <= innerHeight + 1 && r.top >= 0, covered: el !== btn && !btn.contains(el) }
    })
    ok(面板确认 != null, '② 决策面板已打开（确认按钮存在）')
    ok(面板确认 && 面板确认.inVp && !面板确认.covered, `② 390 决策确认按钮可见且未被遮挡（inVp=${面板确认 && 面板确认.inVp} covered=${面板确认 && 面板确认.covered}）`)
    // 决策滑块真拖
    const 滑 = page.locator('.content input[type=range]').first()
    if (await 滑.count()) {
      await 滑.scrollIntoViewIfNeeded(); await sleep(250)
      const box = await 滑.boundingBox()
      const 读 = () => 滑.inputValue().then(Number)
      const 前 = await 读()
      await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2); await page.mouse.down()
      await page.mouse.move(box.x + box.width * 0.2 + 25, box.y + box.height / 2, { steps: 6 }); await page.mouse.up()
      await sleep(200)
      const 后 = await 读()
      ok(Math.abs(后 - 前) >= 1, `① 决策面板滑块真拖 ⇒ ${前} → ${后}（变化 ≥1 档）`)
    }
    // ③ 键盘：Esc 退出决策面板（面板整页替换经营页 ⇒ Esc 必须能回去）
    await page.keyboard.press('Escape'); await sleep(350)
    const 回到经营 = await page.evaluate(() => !!document.querySelector('.task-card'))
    ok(回到经营, '③ Esc 退出决策面板回到经营页（键盘可达）')
  }

  // ④ 44px 复扫（经营页 + 押注卡 + 决策面板范围内的可见按钮）
  {
    const 扫 = await page.evaluate(() => {
      const bad = []
      for (const b of document.querySelectorAll('button')) {
        const r = b.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        const style = getComputedStyle(b)
        const mh = parseFloat(style.minHeight) || 0
        if (r.height < 44 && mh < 44) bad.push(`${(b.textContent || '').trim().slice(0, 10)}:${Math.round(r.height)}px/mh${Math.round(mh)}`)
      }
      return bad
    })
    ok(扫.length === 0, `④ 经营页可点按钮 100% ≥44px（不达标 ${扫.length} 个${扫.length ? '：' + 扫.slice(0, 4).join(' / ') : ''}）`)
  }

  // ===== ③ 补充：Esc 关全屏层（native 游戏播放器 · 复用已进经营的 page）=====
  {
    await page.evaluate(() => { const t = [...document.querySelectorAll('.tabbar button')].find(x => x.textContent.includes('实训游戏')); if (t) t.click() }); await sleep(550)
    await page.evaluate(() => { const c = [...document.querySelectorAll('.card')].find(x => x.textContent.includes('价格弹性猜数')); const b = c && [...c.querySelectorAll('button')].find(x => /开始/.test(x.textContent)); if (b) b.click() }); await sleep(650)   // 精确点第二张卡的开始
    const 在玩 = await page.evaluate(() => !!document.querySelector('[data-elastic-q]'))
    ok(在玩, '③ native 游戏层已打开（Esc 靶场）')
    await page.keyboard.press('Escape'); await sleep(300)
    ok(!(await page.evaluate(() => !!document.querySelector('[data-elastic-q]'))), '③ Esc 关闭游戏播放器（键盘可达）')
  }
} finally {
  await browser.close()
  try { if (server?.pid && !复用) { if (process.platform === 'win32') execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore', windowsHide: true }); else server.kill('SIGTERM') } } catch (e) {}
}
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
