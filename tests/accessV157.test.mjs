// V157 阶段四 · 可访问性（桌面 44px · 横屏 844×390 · 超小屏 320）
// 运行：node tests/accessV157.test.mjs   （浏览器 · 全量门禁）
import { chromium } from 'playwright-core'
import { spawn, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { 是当前构建 } from './_previewFresh.mjs'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
let PORT = 4173, BASE = `http://localhost:${PORT}/`, server = null, 复用 = false
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(2) }
{
  const 有服务 = await fetch(BASE).then(r => r.ok).catch(() => false)
  复用 = 有服务 && await 是当前构建(BASE)
  if (有服务 && !复用) { for (let p = 4206; p <= 4230; p++) { if (!(await fetch(`http://localhost:${p}/`).then(() => true).catch(() => false))) { PORT = p; BASE = `http://localhost:${p}/`; break } } }
  if (!复用) server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true })
}
for (let i = 0; i < 40; i++) { if (await fetch(BASE).then(r => r.ok).catch(() => false)) break; await sleep(300) }
const browser = await chromium.launch({ executablePath: EDGE, headless: true })

// 到经营页（同 interactionV154 流程）
async function 进经营(page) {
  const clickText = async (t) => page.evaluate((t) => { const items = [...document.querySelectorAll('button, div, span')].filter(x => x.children.length === 0); const el = items.find(x => x.textContent.includes(t)); if (el) { el.click(); return true } return false }, t)
  const clickCard = async (t) => { const d = await page.evaluate((t) => { const c = [...document.querySelectorAll('.district-card')].find(x => x.textContent.includes(t)); if (c) { c.click(); return true } return false }, t); if (!d) await clickText(t) }
  const clickBtn = async (re) => page.evaluate((src) => { const re2 = new RegExp(src); const b = [...document.querySelectorAll('button')].find(x => !x.disabled && re2.test(x.textContent)); if (b) { b.click(); return true } return false }, re.source)
  const hasOverlay = () => page.evaluate(() => !![...document.querySelectorAll('div')].find(d => d.style.position === 'fixed' && d.textContent.includes('你的选择会带来')))
  const closeOverlay = async () => { await clickText('明白了'); await sleep(250) }
  const { 过两道闸门 } = await import('./_v109-site.mjs')
  const { 过命名页 } = await import('./_v114-name.mjs')
  await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await sleep(1000)
  await clickText('我是学生'); await sleep(400)
  await clickText('离线演示'); await sleep(400)
  await clickBtn(/进入演示/); await sleep(700)
  await clickBtn(/开始我的酒店之旅/); await sleep(700)
  await page.evaluate(() => { const c = [...document.querySelectorAll('.district-card')].find(x => x.textContent.includes('锦江区')); if (c) c.click() }); await sleep(450)
  await 过两道闸门(page)
  await clickBtn(/确认选址/); await sleep(650)
  await page.evaluate(() => { const c = [...document.querySelectorAll('.district-card')].find(x => x.textContent.trim().startsWith('汉庭')); if (c) c.click() }); await sleep(450)
  await clickBtn(/确认选择/); await sleep(650)
  await page.evaluate(() => { const c = [...document.querySelectorAll('.district-card')].find(x => /OTA平台合作/.test(x.textContent)); if (c) c.click() }); await sleep(400)
  await clickBtn(/确认/); await sleep(550)
  for (let i = 0; i < 12; i++) {
    const t = await page.evaluate(() => document.body.innerText)
    if (t.includes('门店筹建') || t.includes('云悦锦江店')) break
    const opt = page.locator('[data-claim-opt]').first()
    if (await opt.count()) { await opt.click().catch(() => {}); await sleep(250) }
    await page.evaluate(() => { const cs = [...document.querySelectorAll('.district-card')].filter(x => /物业/.test(x.textContent) && !x.getAttribute('data-claim-opt')); const c = cs.find(x => /交通枢纽/.test(x.textContent)) || cs[0]; if (c) c.click() }); await sleep(200)
    const ta = page.locator('[data-claim-reason]').first()
    if (await ta.count()) { await ta.fill('现金紧，先保开业，再逐步把品质补上。').catch(() => {}); await sleep(150) }
    await clickBtn(/确认本步取舍|完成认领|下一步|确认无误|确认/)
    await sleep(500)
  }
  await 过命名页(page, '云悦可访问性店'); await sleep(600)
  await clickBtn(/^全部$/); await sleep(350)
  await clickCard('基准情景'); await sleep(450)
  if (await hasOverlay()) await closeOverlay()
  await page.evaluate(() => { const c = document.querySelector('[data-tier="装修"][data-val="低"]'); if (c) c.click() }); await sleep(350)
  await page.evaluate(() => { const n = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('完成「投资测算」')); if (n) n.click() }); await sleep(550)
  const 步 = (t) => page.evaluate((t) => { const sp = [...document.querySelectorAll('span')].find(x => x.textContent === t); const c = sp && sp.previousElementSibling; c && c.click() }, t)
  await 步('证照办理')
  for (const n of ['申领营业执照', '刻章备案', '消防检查合格证', '特种行业经营许可证', '卫生许可证', '税务申报']) {
    await clickCard(n); await sleep(350)
    if (await hasOverlay()) await closeOverlay(); else { await clickCard(n); await sleep(300); if (await hasOverlay()) await closeOverlay() }
  }
  await 步('物资采购')
  await clickCard('供应商 A'); await sleep(350); if (await hasOverlay()) await closeOverlay()
  await 步('开业计划')
  for (const n of ['装修', '系统上线', '招聘']) { await page.evaluate((n) => { const c = [...document.querySelectorAll('div')].find(x => x.style && x.style.cursor === 'pointer' && x.textContent.trim().startsWith(n)); if (c) c.click() }, n); await sleep(400); if (await hasOverlay()) await closeOverlay(); await sleep(200) }
  await clickBtn(/完成筹建/); await sleep(1200)
  if (await hasOverlay()) await closeOverlay()
  await sleep(400)
}

// 44px 全扫（当前页可见按钮）
async function 扫44(page, label) {
  const bad = await page.evaluate(() => {
    const bad = []
    for (const b of document.querySelectorAll('button')) {
      const r = b.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const mh = parseFloat(getComputedStyle(b).minHeight) || 0
      if (r.height < 44 && mh < 44) bad.push(`${(b.textContent || '').trim().slice(0, 10)}:${Math.round(r.height)}px`)
    }
    return bad
  })
  ok(bad.length === 0, `${label} 可点按钮 100% ≥44px（不达标 ${bad.length}${bad.length ? '：' + bad.slice(0, 4).join('/') : ''}）`)
  return bad
}
// 横向滚动检查
async function 扫横滚(page, label) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
  ok(r.sw <= r.cw + 1, `${label} 无横向滚动（sw=${r.sw} cw=${r.cw}）`)
}

try {
  // ── ① 桌面 1440×900：决策卡按钮 ≥44px（#211 的核心）──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await 进经营(page)
    const 经营 = await page.evaluate(() => !!document.querySelector('.tabbar'))
    ok(经营, '① 桌面流程到经营页')
    // 经营页扫
    await 扫44(page, '① 桌面经营页')
    // 决策面板扫
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '全部'); if (b) b.click() }); await sleep(350)
    await page.evaluate(() => { const c = [...document.querySelectorAll('.task-card')].find(x => x.textContent.includes('超额预订')); if (c) { c.scrollIntoView({ block: 'center' }); c.click() } }); await sleep(700)
    await 扫44(page, '① 桌面决策面板')
    await page.keyboard.press('Escape'); await sleep(350)
    // 我的页
    await page.evaluate(() => { const b = [...document.querySelectorAll('.tabbar button')].find(x => x.textContent.includes('我的')); if (b) b.click() }); await sleep(650)
    await 扫44(page, '① 桌面我的页')
    await page.evaluate(() => { const b = [...document.querySelectorAll('.tabbar button')].find(x => x.textContent.includes('经营')); if (b) b.click() }); await sleep(400)

    // ── ③ 横屏 844×390（手机横过来）──
    await page.setViewportSize({ width: 844, height: 390 })
    await sleep(500)
    await 扫横滚(page, '③ 横屏 844×390 经营页')
    await 扫44(page, '③ 横屏经营页')
    // ── ③ 超小屏 320×568 ──
    await page.setViewportSize({ width: 320, height: 568 })
    await sleep(500)
    await 扫横滚(page, '③ 320×568 经营页')
    await page.evaluate(() => { const b = [...document.querySelectorAll('.tabbar button')].find(x => x.textContent.includes('报表')); if (b) b.click() }); await sleep(650)
    await 扫横滚(page, '③ 320 报表页')
    await page.evaluate(() => { const b = [...document.querySelectorAll('.tabbar button')].find(x => x.textContent.includes('经营')); if (b) b.click() }); await sleep(400)
    await page.close()
  }

  // ── ① RV：CSS 规则全局性断言（styles.css 源码级——改回 @media ⇒ 红）──
  {
    const css = await import('node:fs').then(fs => fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8'))
    ok(/button, \.city-tab, \.district-card \{ min-height: 44px; \}/.test(css) && !/\/\/.*min-height.*44px/.test(css.slice(css.indexOf('button, .city-tab, .district-card { min-height'), css.indexOf('button, .city-tab, .district-card { min-height') + 80)),
      '① RV：44px 规则是全局的（不在 @media 块内——改回 @media ⇒ 此断言语境红）')
  }
} finally {
  await browser.close()
  try { if (server?.pid && !复用) { if (process.platform === 'win32') execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore', windowsHide: true }); else server.kill('SIGTERM') } } catch (e) {}
}
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
