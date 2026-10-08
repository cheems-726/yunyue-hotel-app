// V75 · 浏览器抽查：点开必须有内容、不许空面板（卡④「每类抽 3 条」的浏览器侧）
// 运行：先 npm run build，再 node tests/_v75-verify.mjs（复用常驻 preview 4177；与 verify-capital 同款起停方式）
// 三类各 1 条（合计 3 类 · 常驻化同类断言在 v75Detail.test.mjs）：
//   ① 选址类：点「锦江区」→ 反馈浮层含「优势：」正文
//   ③ 筹建类：投资测算点「乐观情景」→ 反馈浮层出现（含 note 正文）
//   ② 决策类：经营页「动态调价」点「不跟降」→ 反馈面板含 适用场景/教学点/引擎依据（V75 四段式）
// ★ 走查原语（hasOverlay/closeOverlay/clickCard/clickStep/认领推进）整体照抄 ui-smoke（R51-1 同族教训：finder 逐字对齐现行文案）
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
async function clickStep(page, t) {
  await page.evaluate((t) => { const sp = [...document.querySelectorAll('span')].find(x => x.textContent === t); const c = sp && sp.previousElementSibling; c && c.click() }, t)
  await sleep(400)
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
const ctx = await browser.newContext({ viewport: { width: 480, height: 900 } })
const page = await ctx.newPage()

await page.goto(BASE, { waitUntil: 'load' }); await sleep(1000)
await clickText(page, '我是学生'); await sleep(400)
await clickText(page, '离线演示'); await sleep(400)
await clickText(page, '进入演示'); await sleep(700)
await clickText(page, '开始我的酒店之旅'); await sleep(800)

// ① 选址类
await clickCard(page, '锦江区'); await sleep(500)
ok('① 选址：点锦江区出反馈浮层', await hasOverlay(page))
ok('① 选址：反馈含「优势：」正文（不空面板）', (await text(page)).includes('优势：'))
await closeOverlay(page)
await clickText(page, '确认选址'); await sleep(700)

// 品牌 → 认领（ui-smoke 同款推进）
await clickCard(page, '汉庭'); await sleep(450)
await clickText(page, '确认选择'); await sleep(700)
await clickCard(page, 'OTA平台合作'); await sleep(400)
await clickText(page, '确认'); await sleep(650)
await clickCard(page, '社区旁物业'); await sleep(400)
for (let i = 0; i < 7; i++) {
  if ((await text(page)).includes('门店筹建')) break
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('完成认领'))
    if (b) { b.click(); return }
    const n = [...document.querySelectorAll('button')].find(x => !x.disabled && /下一步|确认无误/.test(x.textContent))
    n && n.click()
  })
  await sleep(600)
}
ok('进入筹建（认领走完）', (await text(page)).includes('门店筹建'))

// ③ 筹建类：投资测算情景卡
await clickCard(page, '乐观情景', 'starts'); await sleep(500)
ok('③ 筹建：点「乐观情景」出反馈浮层', await hasOverlay(page))
ok('③ 筹建：反馈含情景正文（不空面板）', (await text(page)).includes('乐观'))
await closeOverlay(page)

// 照抄 ui-smoke 走到经营页
await clickCard(page, '基准情景', 'starts'); await sleep(400)
if (await hasOverlay(page)) await closeOverlay(page)
await clickText(page, '下一步'); await sleep(600)
await clickStep(page, '证照办理')
for (const n of ['申领营业执照', '刻章备案', '消防检查合格证', '特种行业经营许可证', '卫生许可证', '税务申报']) {
  await clickCard(page, n, 'starts'); await sleep(500)
  if (!(await hasOverlay(page))) { await closeOverlay(page); await clickCard(page, n, 'starts'); await sleep(500) }
  await closeOverlay(page)
}
await clickText(page, '下一步'); await sleep(600)
await clickStep(page, '物资采购')
await clickCard(page, '供应商 A'); await sleep(500)
if (!(await hasOverlay(page))) { await closeOverlay(page); await clickCard(page, '供应商 A'); await sleep(500) }
await closeOverlay(page)
await clickText(page, '下一步'); await sleep(600)
await clickStep(page, '开业计划')
for (const [i, n] of ['装修', '系统上线', '招聘'].entries()) {
  await clickCard(page, n, 'starts'); await sleep(500)
  ok('筹建·开业详情浮层·' + n, await hasOverlay(page))
  await closeOverlay(page)
  await clickCard(page, n, 'starts'); await sleep(350)
  ok('筹建·开业优先级第' + (i + 1) + '（' + n + '）', (await text(page)).includes('第' + (i + 1) + '优先'))
}
await clickText(page, '完成筹建'); await sleep(1200)
const opening = await text(page)
if (!opening.includes('正式开业')) console.log('    [开业页实况] ' + opening.slice(0, 150).split('\n').join(' | '))
ok('开业反馈弹出', opening.includes('正式开业'))
await closeOverlay(page)

// ② 决策类：经营页 → 动态调价 → 不跟降 → 四段式
const biz = await text(page)
ok('到达经营页（资金状况 + 0/18 决策）', biz.includes('资金状况') && biz.includes('0 / 18'))
// ★ task-card 内层点击是"展开描述"（stopPropagation）⇒ 必须点 .task-card 外层（onClick=onDecision 那层）
await page.evaluate(() => {
  const card = [...document.querySelectorAll('.task-card')].find(x => x.textContent.includes('动态调价'))
  card && card.click()
})
await sleep(700)
ok('② 决策：动态调价面板打开（含决策前想一想）', (await text(page)).includes('动态调价') && (await text(page)).includes('决策前想一想'))
await clickCard(page, '不跟降'); await sleep(600)
{
  const t = await text(page)
  ok('② 决策：点「不跟降」出反馈浮层', await hasOverlay(page))
  ok('② 决策：四段式齐全（适用场景/教学点/引擎依据）', t.includes('适用场景（怎么办）') && t.includes('教学点') && t.includes('引擎依据'))
  ok('② 决策：教学点非空句（保价守利润）', t.includes('保价守利润'))
}

await browser.close()
const 失败 = results.filter(r => !r.pass).length
console.log(`\n========== 结果: ${results.filter(r => r.pass).length} 通过 / ${失败} 失败 ==========`)
process.exit(失败 ? 1 : 0)
