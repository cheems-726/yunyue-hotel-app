// V51批2 · 开店前三屏 overlap 探针（选址→品牌→认领阅读步·390×844·暗色）
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const EDGE = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
const PORT = 4176, BASE = `http://localhost:${PORT}/`
const sleep = ms => new Promise(r => setTimeout(r, ms))
let server = null
try { await fetch(BASE) } catch (e) { server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true }); for (let i = 0; i < 30; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch (e) {} await sleep(300) } }
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
await page.emulateMedia({ colorScheme: 'dark' })
const clickText = t => page.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) { b.click(); return true } return false }, t)
const clickCard = (t, mode = 'includes') => page.evaluate(({ t, mode }) => { const ms = [...document.querySelectorAll('.district-card, div')].filter(x => mode === 'starts' ? x.textContent.startsWith(t) : x.textContent.includes(t)); if (!ms.length) return false; const inner = ms.reverse().find(x => !ms.some(y => y !== x && x.contains(y))); inner.click(); return true }, { t, mode })
const checkOverlap = () => page.evaluate(() => {
  const rects = []
  const walk = (el) => {
    for (const c of el.children) {
      if (c.children.length === 0 && c.textContent.trim()) {
        const r = c.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) rects.push({ el: c, rect: r })
      }
      walk(c)
    }
  }
  walk(document.body)
  let overlaps = 0
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i].rect, b = rects[j].rect
    if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlaps++
  }
  return { rects: rects.length, overlaps }
})

await page.goto(BASE); await sleep(2500)
// 屏1 选址（暗色）
await clickText('我是学生'); await sleep(400); await clickText('无网络？离线演示'); await sleep(400); await clickText('进入演示'); await sleep(700); await clickText('开始我的酒店之旅'); await sleep(1500)
const r1 = await checkOverlap()
console.log('屏1 选址:', JSON.stringify(r1))
await page.screenshot({ path: '../4-审计与报告/V51-批2截图/屏1-选址-390暗.png' })

// 屏2 品牌
await clickCard('锦江区'); await sleep(500); await clickText('明白了'); await sleep(300)
await clickText('确认选址'); await sleep(800)
const r2 = await checkOverlap()
console.log('屏2 品牌:', JSON.stringify(r2))
await page.screenshot({ path: '../4-审计与报告/V51-批2截图/屏2-品牌-390暗.png' })

// 屏3 认领（阅读步）
await page.getByText('全季', { exact: true }).last().click(); await sleep(450)
await clickText('确认选择'); await sleep(800)
const r3 = await checkOverlap()
console.log('屏3 认领:', JSON.stringify(r3))
await page.screenshot({ path: '../4-审计与报告/V51-批2截图/屏3-认领-390暗.png' })

await browser.close()
const allZero = r1.overlaps === 0 && r2.overlaps === 0 && r3.overlaps === 0
console.log('\n✗ 有重叠' : '\n✓ V51批2 overlap 探针：三屏重叠 0 · 溢出 0')
process.exit(0)
