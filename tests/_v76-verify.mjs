// V76 · 浏览器抽查：品牌七字段面板 + 并排对比（卡②④ 界面可见）
// 运行：先 npm run build，再 node tests/_v76-verify.mjs（复用常驻 preview 4177）
//   ① 点「汉庭」→ 反馈面板含 保证金/管理费/适配区位/主力客群/数据来源（七字段齐）
//   ② 「＋加入对比」汉庭+海友 → 并排对比表出现（两列 + 清空对比按钮）
// 走查原语照抄 ui-smoke（R51-1 同族教训）
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4177
const BASE = `http://localhost:${PORT}/`
const results = []
let lastText = ''
const sleep = ms => new Promise(r => setTimeout(r, ms))
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
    const matches = [...document.querySelectorAll('.district-card, .task-card, div')].filter(x =>
      mode === 'starts' ? x.textContent.startsWith(t) : x.textContent.includes(t))
    if (!matches.length) return false
    const inner = matches.reverse().find(x => !matches.some(y => y !== x && x.contains(y)))
    inner.click(); return true
  }, { t, mode })
}
async function hasOverlay(page) {
  return page.evaluate(() => {
    const d = [...document.querySelectorAll('div')].find(d => d.style.position === 'fixed' && d.textContent.includes('你的选择会带来'))
    return !!d
  })
}
async function closeOverlay(page) {
  await clickText(page, '明白了')
  await sleep(250)
}

if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(1) }
let server, browser
let 复用常驻 = await fetch(BASE).then(r => r.ok).catch(() => false)
if (!复用常驻) {
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true })
} else {
  console.log('▶ 复用常驻预览 ' + PORT)
}
for (let i = 0; i < 30; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch (e) {} await sleep(300) }
browser = await chromium.launch({ executablePath: EDGE, headless: true })
const ctx = await browser.newContext({ viewport: { width: 720, height: 1000 } })
const page = await ctx.newPage()

await page.goto(BASE, { waitUntil: 'load' }); await sleep(1000)
await clickText(page, '我是学生'); await sleep(400)
await clickText(page, '离线演示'); await sleep(400)
await clickText(page, '进入演示'); await sleep(700)
await clickText(page, '开始我的酒店之旅'); await sleep(800)

// 选址（任选即可进品牌页）—— 用锦江区走标准链
await clickCard(page, '锦江区'); await sleep(500)
if (await hasOverlay(page)) await closeOverlay(page)
await clickText(page, '确认选址'); await sleep(700)

// ① 品牌卡点开 → 七字段
ok('品牌页渲染（华住全品牌文案）', (await text(page)).includes('选择你的酒店品牌'))
await clickCard(page, '汉庭'); await sleep(600)
{
  const t = await text(page)
  ok('① 汉庭反馈浮层（七字段）', await hasOverlay(page))
  for (const 字段 of ['档次', '保证金', '管理费', '标准要求', '适配区位', '主力客群', '数据来源']) {
    ok('① 面板含「' + 字段 + '」', t.includes(字段))
  }
  ok('① 有源品牌保证金真值（10 万）', t.includes('10 万（置信度'))
  ok('① 来源行可见（OTA 实测+人工分级口径）', t.includes('OTA 实测') && t.includes('人工分级'))
}
await closeOverlay(page)

// ② 并排对比：汉庭 + 海友
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.title.startsWith('对比：汉庭')); b && b.click() })
await sleep(300)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.title.startsWith('对比：海友')); b && b.click() })
await sleep(400)
{
  const t = await text(page)
  ok('② 对比表出现（≥2 个品牌）', t.includes('品牌对比（并排看差异 · 最多 3 个）'))
  ok('② 两品牌同表（汉庭+海友）', t.includes('汉庭') && t.includes('海友'))
  ok('② 对比行含保证金/管理费/适配区位', t.includes('保证金') && t.includes('管理费') && t.includes('适配区位'))
  ok(/\d+ 个/.test(t.split('适配区位')[1] || ''), '② 对比表适配区位行有数值（不许 —）')
  ok('② 海友管理费有真值（旧官方 5%）', /月营收 × 5%/.test(t))
  const 清空 = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('清空对比')); if (b) { b.click(); return true } return false })
  await sleep(300)
  ok('② 清空对比生效', 清空 && !(await text(page)).includes('品牌对比（并排看差异'))
}

await browser.close()
const 失败 = results.filter(r => !r.pass).length
console.log(`\n========== 结果: ${results.filter(r => r.pass).length} 通过 / ${失败} 失败 ==========`)
process.exit(失败 ? 1 : 0)
