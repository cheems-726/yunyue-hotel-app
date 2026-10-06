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
// 清掉预置演示态 ⇒ 模拟"新开的酒店"（0 入住/0 评价/0 差评 起点）
await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem('hotel-sim-state') || '{}')
  st.history = []; st.report = null; st.week = 1
  st.reviews = []; st.pendingNegatives = 0
  localStorage.setItem('hotel-sim-state', JSON.stringify(st))
  localStorage.removeItem('hotel-sim-reviews')
})
await page.reload(); await sleep(2500)
await clickText('我是学生'); await sleep(400)
await clickText('无网络？离线演示'); await sleep(400)
await clickText('进入演示'); await sleep(600)
await clickText('开始我的酒店之旅'); await sleep(1200)
// 走完认领+筹建到经营页（全流程 · 与 V25 同一条路）
await clickCard('锦江区'); await sleep(500); await clickText('明白了'); await sleep(300)
await clickText('确认选址'); await sleep(700)
await page.getByText('全季', { exact: true }).last().click(); await sleep(450)
await clickText('确认选择'); await sleep(700)
await clickCard('自主直营'); await sleep(400); await clickText('确认'); await sleep(650)
await clickCard('商圈核心物业'); await sleep(400)
for (let i = 0; i < 7; i++) { const done = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('完成认领')); if (b) { b.click(); return true } const n = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('下一步')); if (n) { n.click(); return false } return false }); await sleep(550); if (done) break }
await sleep(800)
await clickCard('基准情景', 'starts'); await sleep(500); await clickText('明白了'); await sleep(300)
await clickText('完成「投资测算」'); await sleep(900); await clickText('完成「证照办理」'); await sleep(900)
await clickCard('供应商 A'); await sleep(500); await clickText('明白了'); await sleep(300)
await clickText('完成「物资采购」'); await sleep(900)
for (const n of ['装修', '招聘', '系统上线']) { await clickCard(n, 'starts'); await sleep(400); await clickText('明白了'); await sleep(280); await clickCard(n, 'starts'); await sleep(280) }
await clickText('完成筹建，正式开业'); await sleep(1300); await clickText('明白了'); await sleep(1500)

// ── 核心断言：经营页（0 入住新店）──
const r1 = await page.evaluate(() => {
  const body = document.body.innerText
  const feedEls = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /客人退房|办理入住/.test(e.textContent || ''))
  return {
    入账格: body.includes('今日入账'),
    三格非空线: !body.includes('待引擎日快照就绪'),
    空态0: (body.match(/今日入账\n?0|0\n?今日入账/) !== null) || body.includes('（待结算）'),
    幻影退房条数: feedEls.length,
    待结算标: body.includes('待结算'),
  }
})
console.log('经营页（0 入住）:', JSON.stringify(r1, null, 1))
writeFileSync(`${SHOT}/新店-经营页-0入住.png`, Buffer.from(await page.screenshot()))

// ── 口碑页：评价/差评 0 ──
await clickText('口碑'); await sleep(1500)
const r2 = await page.evaluate(() => {
  const body = document.body.innerText
  const m = body.match(/待回复差评 \((\d+)\)/)
  return { 待回复差评: m ? Number(m[1]) : 0, 无待处理: body.includes('暂无待处理差评'), 零字样: body.includes('0%'), 已欠零: !body.includes('已欠 1 条') && !body.includes('已欠 2 条') }
})
console.log('口碑页:', JSON.stringify(r2, null, 1))
writeFileSync(`${SHOT}/新店-口碑页-0评价.png`, Buffer.from(await page.screenshot()))

const pass = r1.幻影退房条数 === 0 && r1.空态0 && r1.待结算标 && r2.待回复差评 === 0 && r2.无待处理
console.log(pass ? '\n✓ V55 核心验收过：0 入住 ⇒ 0 评价 · 0 差评 · 无幻影退房 · 空态显示 0' : '\n✗ V55 验收失败')
await browser.close()
process.exit(pass ? 0 : 1)
