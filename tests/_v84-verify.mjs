// V84 · 竞品逐家可见性核查（浏览器行为断言 · 抽 3 区位：渲染条数 = 数据家数）
// 运行：先 npm run build，再 node tests/_v84-verify.mjs（复用常驻 preview 4177）
// 判据（卡③）：展开后界面渲染的竞品条目数 === COMPETITORS 数据侧家数（防界面漏渲染）
//   抽样：锦江区(5) · 双桥区(6) · 沙坪坝区(4)
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 4177
const BASE = `http://localhost:${PORT}/`
const sleep = ms => new Promise(r => setTimeout(r, ms))
let server
if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(1) }
let 复用常驻 = await fetch(BASE).then(r => r.ok).catch(() => false)
if (!复用常驻) server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true })
for (let i = 0; i < 30; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch (e) {} await sleep(300) }
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 800, height: 1200 } })).newPage()
await page.goto(BASE, { waitUntil: 'load' }); await sleep(1200)
const click = async t => page.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) { b.click(); return true } return false }, t)
let pass = 0, fail = 0
const ok = (c, n) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.log('  ✗ ' + n) } }

await click('我是学生'); await sleep(400)
await click('无网络？离线演示'); await sleep(400)
await click('进入演示'); await sleep(700)
await click('开始我的酒店之旅'); await sleep(900)

// 逐区位：点卡 → 展开逐家清单 → 数 data-v84-compete 行数
const 样本 = [['锦江区', 5], ['双桥区', 6], ['沙坪坝区', 4]]
for (const [区, 家数] of 样本) {
  // 切城市
  const 城市 = { 锦江区: '成都', 双桥区: '承德', 沙坪坝区: '重庆' }[区]
  await page.evaluate((c) => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === c); b && b.click() }, 城市)
  await sleep(500)
  // 选中 + 展开合成一次 evaluate（同一张卡内定位，消除中间态；未选中重试）
  let 展开钮 = 'nocard'
  for (let r2 = 0; r2 < 3 && 展开钮 !== 'ok'; r2++) {
    展开钮 = await page.evaluate((区) => {
      const cards = [...document.querySelectorAll('.district-card')].filter(c => c.textContent.includes(区))
      const card = cards.find(c => !cards.some(y => y !== c && c.contains(y)))
      if (!card) return 'nocard'
      if (!card.classList.contains('selected')) card.click()
      const b = [...card.querySelectorAll('button')].find(x => x.textContent.includes('展开全部'))
      if (!b) return 'nobutton'
      b.click()
      return 'ok'
    }, 区)
    await sleep(400)
  }
  if (展开钮 !== 'ok') { console.error('✗ ' + 区 + ' 定位失败：' + 展开钮 + ' —— 不冒充'); process.exit(1) }
  await sleep(300)
  const 行数 = await page.evaluate(() => document.querySelectorAll('[data-v84-compete="1"]').length)
  ok(行数 === 家数, `${区}：展开后逐家条数 ${行数} = 数据家数 ${家数}`)
  if (行数 !== 家数) { const 行s = await page.evaluate(() => [...document.querySelectorAll('[data-v84-compete="1"]')].map(x => x.textContent.slice(0, 30))); const 选中 = await page.evaluate(() => { const c = document.querySelector('.district-card.selected'); return c ? c.textContent.slice(0, 20) : '(无选中)' }); console.log('    [debug] 选中卡=' + 选中 + ' 行=' + JSON.stringify(行s)) }
  await page.evaluate((q) => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('收起逐家清单')); b && b.click() }, 区)
  await sleep(300)
}

await browser.close()
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
