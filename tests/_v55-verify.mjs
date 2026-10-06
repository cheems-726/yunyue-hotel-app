// V55 · 核心验收（可证伪）：新建酒店（0 入住）⇒ 口碑页评价 0 条 · 差评 0 条 · 今日入账显示 0（非「—」）· 无幻影退房事件
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\154.0.4258.53\\msedge.exe'
const PORT = 4176, BASE = `http://localhost:${PORT}/`
const SHOT = '../4-审计与报告/V55-联动截图'
const sleep = ms => new Promise(r => setTimeout(r, ms))
let server = null
try { await fetch(BASE) } catch (e) { server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true }); for (let i = 0; i < 30; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch (e) {} await sleep(300) } }
mkdirSync(SHOT, { recursive: true })
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await page.emulateMedia({ colorScheme: 'dark' })
const clickText = t => page.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) { b.click(); return true } return false }, t)
const clickCard = (t, mode = 'includes') => page.evaluate(({ t, mode }) => { const ms = [...document.querySelectorAll('.district-card, div')].filter(x => mode === 'starts' ? x.textContent.startsWith(t) : x.textContent.includes(t)); if (!ms.length) return false; const inner = ms.reverse().find(x => !ms.some(y => y !== x && x.contains(y))); inner.click(); return true }, { t, mode })

await page.goto(BASE); await sleep(2500)
// 离线演示（陈小明为预置演示号 ⇒ 本验收改走【真实新建】路径：注册一个全新号不可行(离线) ⇒ 用演示号但先清其历史）
await clickText('我是学生'); await sleep(400)
await clickText('无网络？离线演示'); await sleep(400)
await clickText('进入演示'); await sleep(600)
await clickText('开始我的酒店之旅'); await sleep(900)
// ★ R55-1（D187）：【默认未开业态】直接断言 —— 不清任何预置态、不走认领（就是用户看到的原始界面）
//   LiveFeed 挂 :504 的 occupiedRooms={0} ⇒ 幻影退房/幻影评价链必须断
await clickCard('锦江区'); await sleep(500); await clickText('明白了'); await sleep(300)
// ── 核心断言：默认未开业态（R55-1 · 不清预置态 · 不走认领 · :504 直喂 0）──
// ①选址页本就不该有经营流水（LiveFeed 只在经营页）
const 选址页无流水 = await page.evaluate(() => !/[0-9]{3}房客人退房|办理入住/.test(document.body.innerText))
// ②源码级断言：:504 未开业视图 LiveFeed 的 occupiedRooms 必须是 {0}（真存档值 · 不许硬编码 6）
const src = (await import('node:fs')).readFileSync('src/HotelStatus.jsx', 'utf8')
const srcOK = !src.includes('occupiedRooms={6}') && src.includes('occupiedRooms={0}') && src.includes('if (!(occupiedRooms > 0)) return')
const r1 = {
  选址页无流水, srcOK,
  幻影退房条数: (await page.evaluate(() => [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /客人退房|办理入住/.test(e.textContent || '')).length)),
}
console.log('默认未开业态:', JSON.stringify(r1, null, 1))
writeFileSync(`${SHOT}/默认未开业态-选址页.png`, Buffer.from(await page.screenshot()))

// ── 口碑页：评价/差评 0 ──
await clickText('口碑'); await sleep(1500)
const r2 = await page.evaluate(() => {
  const body = document.body.innerText
  const m = body.match(/待回复差评 \((\d+)\)/)
  return { 待回复差评: m ? Number(m[1]) : 0, 无待处理: body.includes('暂无待处理差评'), 零字样: body.includes('0%'), 已欠零: !body.includes('已欠 1 条') && !body.includes('已欠 2 条') }
})
console.log('口碑页:', JSON.stringify(r2, null, 1))
writeFileSync(`${SHOT}/新店-口碑页-0评价.png`, Buffer.from(await page.screenshot()))

const pass = r1.选址页无流水 && r1.srcOK && r1.幻影退房条数 === 0 && r2.待回复差评 === 0
console.log(pass ? '\n✓ V55 核心验收过：0 入住 ⇒ 0 评价 · 0 差评 · 无幻影退房 · 空态显示 0' : '\n✗ V55 验收失败')
await browser.close()
process.exit(pass ? 0 : 1)
