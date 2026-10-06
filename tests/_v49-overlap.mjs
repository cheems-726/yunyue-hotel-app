// V49 批5 · 决策列表「文字碰撞/溢出」可证伪验收（移动视口 390×844 · 暗色模拟）
// 判据（卡内红线 · 我会亲跑）：重叠对数 = 0 · 溢出元素数 = 0（设计上该叠的 ⇒ 白名单列明）
// 驱动方式 = 仿 verify-live-review-ui（playwright-core + Edge headless + vite preview 4176 常驻复用）
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4176
const BASE = `http://localhost:${PORT}/`
const SHOT_DIR = '../4-审计与报告/V49-暗色截图'
const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── 起服务（复用常驻：已在监听 ⇒ 不 spawn 不清杀）──
let server = null
try { const r = await fetch(BASE); if (!r.ok) throw 0; console.log('▶ 复用常驻预览 ' + BASE) } catch (e) {
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true })
  console.log('▶ 已起预览 ' + BASE)
  for (let i = 0; i < 30; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch (e) {} await sleep(300) }
}
mkdirSync(SHOT_DIR, { recursive: true })

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const sleepP = ms => page.waitForTimeout(ms)
const clickText = t => page.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) { b.click(); return true } return false }, t)
const clickCard = (t, mode = 'includes') => page.evaluate(({ t, mode }) => { const ms = [...document.querySelectorAll('.district-card, div')].filter(x => mode === 'starts' ? x.textContent.startsWith(t) : x.textContent.includes(t)); if (!ms.length) return false; const inner = ms.reverse().find(x => !ms.some(y => y !== x && x.contains(y))); inner.click(); return true }, { t, mode })
const closeOverlay = async () => { await clickText('明白了'); await sleepP(250) }

// ── 暗色模拟（批3/批4 核心）：prefers-color-scheme: dark ──
await page.emulateMedia({ colorScheme: 'dark' })

// ── 走到经营页（离线演示全流程 · 与 vlr-ui 同一条路）──
await page.goto(BASE); await sleepP(2500)
await clickText('我是学生'); await sleepP(400)
await clickText('离线演示'); await sleepP(400)
await clickText('进入演示'); await sleepP(700)
await clickText('开始我的酒店之旅'); await sleepP(800)
await clickCard('锦江区'); await sleepP(500); await closeOverlay()
await clickText('确认选址'); await sleepP(700)
await page.getByText('全季', { exact: true }).last().click(); await sleepP(450)
await clickText('确认选择'); await sleepP(700)
await clickCard('自主直营'); await sleepP(400)
await clickText('确认'); await sleepP(650)
await clickCard('商圈核心物业'); await sleepP(400)
for (let i = 0; i < 7; i++) {
  const done = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('完成认领'))
    if (b) { b.click(); return true }
    const n = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('下一步'))
    if (n) { n.click(); return false }
    return false
  })
  await sleepP(550); if (done) break
}
await sleepP(800)
await clickCard('基准情景', 'starts'); await sleepP(500); await closeOverlay()
await clickText('完成「投资测算」'); await sleepP(900)
await clickText('完成「证照办理」'); await sleepP(900)
await clickCard('供应商 A'); await sleepP(500); await closeOverlay()
await clickText('完成「物资采购」'); await sleepP(900)
for (const n of ['装修', '招聘', '系统上线']) { await clickCard(n, 'starts'); await sleepP(400); await closeOverlay(); await clickCard(n, 'starts'); await sleepP(280) }
await clickText('完成筹建，正式开业'); await sleepP(1300); await closeOverlay()
const bodyText = await page.evaluate(() => document.body.innerText)
console.log('▶ 已进经营页：', bodyText.includes('资金状况') ? '✓' : '✗ ' + bodyText.slice(0, 120).replace(/\n/g, ' '))

// ── 批5 核心测量：每张决策卡内 两两矩形重叠 + 文字溢出 ──
const report = await page.evaluate(() => {
  const WHITELIST_CLASSES = ['task-badge', 'task-icon']   // 设计上就该叠：角标（去决策徽章·右上）、图标区（含右上红点）
  const overlaps = [], overflows = []
  const cards = [...document.querySelectorAll('.task-card')]
  const intersects = (a, b) => {
    const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
    const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
    return ox > 1 && oy > 1 ? { ox: Math.round(ox), oy: Math.round(oy) } : null
  }
  for (let ci = 0; ci < cards.length; ci++) {
    const card = cards[ci]
    const els = [...card.querySelectorAll('*')].filter(e => {
      if (e.offsetParent === null && e.getClientRects().length === 0) return false
      const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false
      const hasText = e.children.length === 0 && e.textContent.trim().length > 0
      const isBtn = e.tagName === 'BUTTON'
      return hasText || isBtn
    })
    // 溢出：文字超容器且未做裁剪
    for (const e of els) {
      const cs = getComputedStyle(e)
      const clipped = ['hidden', 'clip'].includes(cs.overflowX) || ['hidden', 'clip'].includes(cs.overflow)
      if (e.scrollWidth > e.clientWidth + 1 && !clipped) overflows.push({ card: ci, tag: e.tagName, cls: e.className, text: (e.textContent || '').trim().slice(0, 30), scrollW: e.scrollWidth, clientW: e.clientWidth })
    }
    // 重叠：两两（跳过祖先-后代包含关系与白名单）
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i], b = els[j]
      if (a.contains(b) || b.contains(a)) continue
      if ([a, b].some(e => WHITELIST_CLASSES.some(c => String(e.className).includes(c)))) continue
      const rA = a.getBoundingClientRect(), rB = b.getBoundingClientRect()
      const hit = intersects(rA, rB)
      if (hit) overlaps.push({ card: ci, a: (a.textContent || a.tagName).trim().slice(0, 18), b: (b.textContent || b.tagName).trim().slice(0, 18), ox: hit.ox, oy: hit.oy, rectA: { t: Math.round(rA.top), l: Math.round(rA.left), w: Math.round(rA.width), h: Math.round(rA.height) }, rectB: { t: Math.round(rB.top), l: Math.round(rB.left), w: Math.round(rB.width), h: Math.round(rB.height) } })
    }
  }
  return { cards: cards.length, overlaps, overflows }
})
console.log(`\n▶ 批5 结果：决策卡 ${report.cards} 张 · 重叠对数 = ${report.overlaps.length} · 溢出元素数 = ${report.overflows.length}`)
for (const o of report.overlaps.slice(0, 8)) console.log('  ✗ 重叠:', JSON.stringify(o))
for (const o of report.overflows.slice(0, 8)) console.log('  ✗ 溢出:', JSON.stringify(o))

// ── 批4 截图（暗色一组 · 亮色对照一组）──
const shot = async name => { const b = await page.screenshot(); writeFileSync(`${SHOT_DIR}/${name}.png`, Buffer.from(b)); return name }
await shot('暗色-经营页-决策列表')
// 展开一行长文本看换行
await page.evaluate(() => { const d = [...document.querySelectorAll('.task-body .desc')][0]; if (d) d.click() })
await sleepP(400)
await shot('暗色-经营页-展开全文')
// 口碑页（批6 弹层入口）
await page.evaluate(() => { const b = [...document.querySelectorAll('button, div, span')].find(x => x.textContent?.trim() === '口碑'); if (b) b.click() })
await sleepP(1500)
await shot('暗色-口碑页')
// 亮色对照
await page.emulateMedia({ colorScheme: 'light' })
await sleepP(700)
await shot('亮色-口碑页')
await page.evaluate(() => { const b = [...document.querySelectorAll('button, div, span')].find(x => x.textContent?.trim() === '经营'); if (b) b.click() })
await sleepP(1200)
await shot('亮色-经营页-决策列表')

await browser.close()
const cardsOk = report.cards >= 10   // 18 项决策应全渲染（少于 10 ⇒ 没进决策列表 = 测了个空）
const pass = cardsOk && report.overlaps.length === 0 && report.overflows.length === 0
if (!cardsOk) console.log(`✗ 决策卡仅 ${report.cards} 张（<10）⇒ 未进决策列表，测量无效`)
console.log(pass ? '\n✓ V49 批5 验收：重叠 0 · 溢出 0（移动 390×844 · 暗色）' : '\n✗ V49 批5 验收失败 ⇒ 上述坐标即病灶')
process.exit(pass ? 0 : 1)
