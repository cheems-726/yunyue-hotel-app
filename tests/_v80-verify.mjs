// V80 · 浏览器走查：12 周任务书 学生端可点开 + 教师端打印版（卡②③ 界面可见）
// 运行：先 npm run build，再 node tests/_v80-verify.mjs（复用常驻 preview 4177）
//   ① 学生：登录演示 → 开店全链 → 我的 → 玩法说明 → 「12 周任务书」覆盖层（12 周五字段 + 打印按钮）
//   ② 教师：独立 context → 老师演示 → 教师后台 → 「12 周任务书（打印版）」同覆盖层
// 走查原语照抄 ui-smoke/_v76-verify（R51-1 同族教训）
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
async function clickStep(page, t) {
  await page.evaluate((t) => { const sp = [...document.querySelectorAll('span')].find(x => x.textContent === t); const c = sp && sp.previousElementSibling; c && c.click() }, t)
  await sleep(400)
}
async function assertTasksOverlay(page, 标签) {
  const t = await text(page)
  ok(标签 + '：覆盖层标题', t.includes('学生端 12 周任务书'))
  ok(标签 + '：首末周都在（第 1 周/第 12 周）', t.includes('第 1 周') && t.includes('第 12 周'))
  ok(标签 + '：首末周主题', t.includes('开局立打法') && t.includes('收官与复盘'))
  for (const 字段 of ['任务：', '涉及决策：', '知识点：', '交付物：', '常见错误：']) {
    ok(标签 + '：字段「' + 字段 + '」', t.includes(字段))
  }
  ok(标签 + '：决策显示为名称（动态调价而非 id）', t.includes('动态调价') && !t.includes("'pricing'"))
  ok(标签 + '：打印按钮在（可打印/另存 PDF）', t.includes('打印 / 另存 PDF'))
  ok(标签 + '：三档口径声明', t.includes('实时 9 项') && t.includes('周期 7 项') && t.includes('一次性 2 项'))
  const back = await clickText(page, '← 返回')
  await sleep(300)
  ok(标签 + '：返回可关覆盖层', back && !(await text(page)).includes('学生端 12 周任务书'))
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

// ── ① 学生端：开店全链 → 我的 → 玩法说明 → 12 周任务书
{
  const ctx = await browser.newContext({ viewport: { width: 720, height: 1000 } })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'load' }); await sleep(1000)
  await clickText(page, '我是学生'); await sleep(400)
  await clickText(page, '离线演示'); await sleep(400)
  await clickText(page, '进入演示'); await sleep(700)
  await clickText(page, '开始我的酒店之旅'); await sleep(800)
  await clickCard(page, '锦江区'); await sleep(500)
  if (await hasOverlay(page)) await closeOverlay(page)
  await clickText(page, '确认选址'); await sleep(700)
  await clickCard(page, '汉庭'); await sleep(450)
  await clickText(page, '确认选择'); await sleep(700)
  await clickCard(page, 'OTA平台合作'); await sleep(400)
  await clickText(page, '确认'); await sleep(650)
  await clickCard(page, '社区旁物业'); await sleep(400)
  for (let i = 0; i < 7; i++) {
    const done = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('完成认领'))
      if (b) { b.click(); return true }
      const n = [...document.querySelectorAll('button')].find(x => !x.disabled && /下一步|确认无误/.test(x.textContent))
      if (n) { n.click(); return false }
      return false
    })
    await sleep(550)
    if (done) break
  }
  await sleep(600)
  await clickCard(page, '基准情景', 'starts'); await sleep(500)
  if (await hasOverlay(page)) await closeOverlay(page)
  await clickStep(page, '证照办理')
  for (const n of ['申领营业执照', '刻章备案', '消防检查合格证', '特种行业经营许可证', '卫生许可证', '税务申报']) {
    await clickCard(page, n, 'starts'); await sleep(450)
    if (!(await hasOverlay(page))) { await closeOverlay(page); await clickCard(page, n, 'starts'); await sleep(450) }
    await closeOverlay(page)
  }
  await clickStep(page, '物资采购')
  await clickCard(page, '供应商 A'); await sleep(450)
  if (!(await hasOverlay(page))) { await closeOverlay(page); await clickCard(page, '供应商 A'); await sleep(450) }
  await closeOverlay(page)
  await clickStep(page, '开业计划')
  for (const n of ['装修', '系统上线', '招聘']) {
    await clickCard(page, n, 'starts'); await sleep(400)
    if (await hasOverlay(page)) await closeOverlay(page)
    await clickCard(page, n, 'starts'); await sleep(300)
  }
  await clickText(page, '完成筹建'); await sleep(1200)
  if (await hasOverlay(page)) await closeOverlay(page)
  await clickText(page, '明白了'); await sleep(400)
  ok('① 学生进入经营页', (await text(page)).includes('资金状况'))
  await clickText(page, '我的'); await sleep(700)
  ok('① 我的页可达', (await text(page)).includes('玩法说明'))
  await clickText(page, '玩法说明'); await sleep(700)
  ok('① 玩法说明页含 12 周任务书入口', (await text(page)).includes('12 周任务书'))
  await clickText(page, '12 周任务书'); await sleep(600)
  await assertTasksOverlay(page, '① 学生端')
  await ctx.close()
}

// ── ② 教师端：独立 context（干净登录态）→ 老师演示 → 教师后台 → 打印版
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'load' }); await sleep(1000)
  await clickText(page, '我是老师'); await sleep(400)
  await clickText(page, '离线演示'); await sleep(400)
  await clickText(page, '进入演示'); await sleep(900)
  ok('② 教师后台渲染', (await text(page)).includes('教师后台'))
  ok('② 打印版入口在', (await text(page)).includes('12 周任务书（打印版）'))
  await clickText(page, '12 周任务书（打印版）'); await sleep(600)
  await assertTasksOverlay(page, '② 教师端')
  await ctx.close()
}

await browser.close()
const 失败 = results.filter(r => !r.pass).length
console.log(`\n========== 结果: ${results.filter(r => r.pass).length} 通过 / ${失败} 失败 ==========`)
process.exit(失败 ? 1 : 0)
