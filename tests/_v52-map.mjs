// V52 · 真实地图验收（宽屏 + 窄屏截图 · GeoJSON 加载 · 点击选中联动）
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4176, BASE = `http://localhost:${PORT}/`
const SHOT = '../4-审计与报告/V52-地图截图'
const sleep = ms => new Promise(r => setTimeout(r, ms))
let server = null
try { await fetch(BASE) } catch (e) { server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true }); for (let i = 0; i < 30; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch (e) {} await sleep(300) } }
mkdirSync(SHOT, { recursive: true })
const browser = await chromium.launch({ executablePath: EDGE, headless: true })

for (const [name, vp] of [['宽屏1440', { width: 1440, height: 900 }], ['窄屏390', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp })
  const page = await ctx.newPage()
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto(BASE); await sleep(2500)
  const clickText = t => page.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div, a')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) { b.click(); return true } return false }, t)
  await clickText('我是学生'); await sleep(400)
  await clickText('无网络？离线演示'); await sleep(400)
  await clickText('进入演示'); await sleep(600)
  await clickText('开始我的酒店之旅'); await sleep(900)
  // GeoJSON 加载 + path 数量
  await sleep(1500)
  const r1 = await page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')].find(s => (s.getAttribute('aria-label') || '').includes('真实行政区划'))
    return { 有地图SVG: !!svg, path数: svg ? svg.querySelectorAll('path').length : 0, 标注: svg ? svg.querySelectorAll('text').length : 0 }
  })
  console.log(`[${name}] GeoJSON 加载:`, JSON.stringify(r1))
  // 点击一个区划 path（旌阳区）⇒ 选中联动（右侧详情/高亮）
  const clicked = await page.evaluate(() => {
    const paths = [...document.querySelectorAll('svg path')]
    const jy = paths.find(p => { const t = p.nextSibling; return false }) // path 无文本
    // 改为点 text「旌阳区」的邻接 path：直接找 fill=primary-bg 的 relevant path 中第 4 个（旌阳）
    const rel = paths.filter(p => p.getAttribute('fill') === 'var(--primary-bg)')
    if (rel.length) { rel[3] ? rel[3].dispatchEvent(new MouseEvent('click', { bubbles: true })) : rel[0].dispatchEvent(new MouseEvent('click', { bubbles: true })); return rel.length }
    return 0
  })
  await sleep(900)
  const r2 = await page.evaluate(() => ({ 选中反馈: document.body.innerText.includes('确认选址') , 详情: document.body.innerText.includes('旌阳区') || document.body.innerText.includes('锦江区') }))
  console.log(`[${name}] 点击区划:`, clicked, '· 确认按钮可见:', JSON.stringify(r2))
  await page.evaluate(() => { const s = [...document.querySelectorAll('svg')].find(s => (s.getAttribute('aria-label') || '').includes('真实行政区划')); if (s) { const r = s.getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top - 60) } })
  await clickText('明白了'); await sleep(700)   // 关结果卡 ⇒ 拍地图本体
  await page.evaluate(() => { const s = [...document.querySelectorAll('svg')].find(s => (s.getAttribute('aria-label') || '').includes('真实行政区划')); if (s) { const r = s.getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top - 60) } })
  await sleep(400)
  writeFileSync(`${SHOT}/${name}-暗色-真实地图.png`, Buffer.from(await page.screenshot()))
  await ctx.close()
}
await browser.close()
console.log('✓ V52 截图完成')
process.exit(0)
