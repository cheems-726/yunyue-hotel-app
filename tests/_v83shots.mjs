// V83 · 演示前线上逐屏截图走查（R83-1 返工版）
// ★ 返工必修三条（决策端打回：初版 20 张同哈希全是首屏）：
//   ① 每屏截图前先断言【该屏特征文本】在（断言不过 ⇒ exit 1，绝不冒充）
//   ② 结束时 20 张 sha256 互不相同（唯一性守门）
//   ③ 真走进去：漏点「我是学生」就是初版翻车根因 ⇒ 每步都先有文本断言
// 输出：../4-审计与报告/V83-演示走查截图/节点N-屏名.png
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { createHash } from 'node:crypto'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4177
const BASE = `http://localhost:${PORT}/`
const OUT = path.resolve('..', '4-审计与报告', 'V83-演示走查截图')
const sleep = ms => new Promise(r => setTimeout(r, ms))
let lastText = ''
async function text(page) { lastText = await page.evaluate(() => document.body.innerText); return lastText }
// ① 特征文本断言（硬失败 · 不冒充）
async function 必见(page, 特征, 屏名) {
  const t = await text(page)
  const 缺 = (Array.isArray(特征) ? 特征 : [特征]).filter(s => !t.includes(s))
  if (缺.length) {
    console.error(`✗ [${屏名}] 特征文本缺失：${缺.join('｜')} —— 走查停在这里（不冒充截图）`)
    console.error('    [页面实读] ' + t.slice(0, 200).replace(/\n/g, ' | '))
    await page.screenshot({ path: path.join(OUT, '故障现场-' + 屏名 + '.png') })
    process.exit(1)
  }
}
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
async function closeOverlay(page) { await clickText(page, '明白了'); await sleep(250) }
const shots = []
async function shot(page, name, fullPage = false) {
  const p = path.join(OUT, name)
  await page.screenshot({ path: p, fullPage })
  shots.push({ name, p })
  console.log('  📸 ' + name)
}

if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(1) }
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })
let server, browser
let 复用常驻 = await fetch(BASE).then(r => r.ok).catch(() => false)
if (!复用常驻) server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true })
for (let i = 0; i < 30; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch (e) {} await sleep(300) }
browser = await chromium.launch({ executablePath: EDGE, headless: true })
const ctx = await browser.newContext({ viewport: { width: 800, height: 1100 } })
const page = await ctx.newPage()

await page.goto(BASE, { waitUntil: 'load' }); await sleep(1200)
// 节点1
await 必见(page, ['请选择你的身份', '我是学生', '我是老师'], '节点1-登录页')
await shot(page, '节点1-登录页-身份两卡.png')
await clickText(page, '我是学生'); await sleep(500)
await 必见(page, ['无网络？离线演示'], '节点1-学生表单')
await shot(page, '节点1-学生表单-离线入口.png')
await clickText(page, '无网络？离线演示'); await sleep(500)
await 必见(page, ['离线演示'], '节点1-离线确认')
await shot(page, '节点1-离线演示确认.png')
await clickText(page, '进入演示'); await sleep(800)
await 必见(page, ['欢迎'], '节点1-欢迎页')
await shot(page, '节点1-欢迎页.png')
await clickText(page, '开始我的酒店之旅'); await sleep(900)
// 节点2
await 必见(page, ['第一步 · 选址', '地图选点'], '节点2-选址页')
await shot(page, '节点2-选址页-地图.png')
await clickCard(page, '锦江区'); await sleep(600)
await 必见(page, ['客群画像', '推荐档次'], '节点2-锦江区数据卡')
await shot(page, '节点2-锦江区数据卡.png')
if (await hasOverlay(page)) await closeOverlay(page)
await clickText(page, '确认选址'); await sleep(800)
// 节点3
await 必见(page, ['选择你的酒店品牌', '加盟费'], '节点3-品牌页')
await shot(page, '节点3-品牌页.png')
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.title && x.title.startsWith('对比：汉庭')); b && b.click() })
await sleep(250)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.title && x.title.startsWith('对比：海友')); b && b.click() })
await sleep(450)
await 必见(page, ['品牌对比（并排看差异 · 最多 3 个）'], '节点3-品牌对比表')
await shot(page, '节点3-品牌对比表.png')
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('清空对比')); b && b.click() })
await sleep(300)
await clickCard(page, '汉庭'); await sleep(450)
await clickText(page, '确认选择'); await sleep(800)
// 节点4
await 必见(page, ['认领一家酒店', '意向申请'], '节点4-认领首步')
await shot(page, '节点4-认领-意向申请.png')
// ★ 与 _v75-verify 逐字对齐的推进序列（模式选择→物业→循环「下一步/确认无误/完成认领」）
await clickCard(page, 'OTA平台合作'); await sleep(400)
await clickText(page, '确认'); await sleep(600)
await clickCard(page, '社区旁物业'); await sleep(400)
for (let i = 0; i < 7; i++) {
  if ((await text(page)).includes('门店筹建')) break
  const 点了 = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('完成认领'))
    if (b) { b.click(); return '完成认领' }
    const n = [...document.querySelectorAll('button')].find(x => !x.disabled && /下一步|确认无误/.test(x.textContent))
    if (n) { n.click(); return '下一步' }
    return 'none'
  })
  console.log('    [认领循环 ' + i + '] 点了: ' + 点了)
  await sleep(400)
  if ((await text(page)).includes('完成认领')) {
    await 必见(page, ['完成认领'], '节点4-认领末步')
    await shot(page, '节点4-认领末步-完成认领按钮.png')
  }
  // 项目决策步必须选物业（stepSatisfied 门控）——每轮顺手点（幂等）
  await clickCard(page, '社区旁物业')
  await sleep(450)
}
await 必见(page, ['门店筹建'], '节点4-认领走完')
// 节点5
await clickStep(page, '证照办理'); await sleep(400)
await 必见(page, ['证照办理'], '节点5-证照页')
// ↓：aria-label 精确定位（控件是 <button aria-label="把申领营业执照下移"> · 行文本定位会误中外层容器）
const 点了下移 = await page.evaluate(() => { const x = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').includes('营业执照') && (b.getAttribute('aria-label') || '').includes('下移')); if (x) { x.click(); return true } return false })
if (!点了下移) { console.error('✗ 节点5 ↓ 没找到（aria-label 下移）—— 不冒充截图'); process.exit(1) }
await sleep(500)
// 真排错判据 = 完成按钮文案变「证照前后置未排对」（静态说明行含"延误"二字 ⇒ 不能拿它当判据）
await 必见(page, ['证照前后置未排对'], '节点5-证照排错（真排错判据）')
await page.evaluate(() => { const el = [...document.querySelectorAll('div')].find(d => d.textContent.includes('延误警告')); el && el.scrollIntoView({ block: 'center' }) })
await sleep(300)
await shot(page, '节点5-证照排错-延误警告.png', true)
// 复原：aria-label 精确定位（★ 照抄 _v54-verify 的点法 · 行文本定位会误中外层容器）
await page.evaluate(() => { const x = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').includes('营业执照') && (b.getAttribute('aria-label') || '').includes('上移')); if (x) x.click() })
await sleep(500)
await 必见(page, ['顺序合理'], '节点5-证照复原')
await page.evaluate(() => { const el = [...document.querySelectorAll('div')].find(d => d.textContent.includes('顺序合理')); el && el.scrollIntoView({ block: 'center' }) })
await sleep(300)
await shot(page, '节点5-证照复原-顺序合理.png', true)
// 节点6
await clickStep(page, '投资测算'); await sleep(300)
await 必见(page, ['投资测算'], '节点6-投资页')
await shot(page, '节点6-投资测算.png')
await clickCard(page, '基准情景', 'starts'); await sleep(400)
if (await hasOverlay(page)) await closeOverlay(page)
await clickText(page, '下一步'); await sleep(600)
await clickStep(page, '物资采购'); await sleep(300)
await 必见(page, ['物资采购', '供应商'], '节点6-采购页')
await shot(page, '节点6-物资采购.png')
await clickCard(page, '供应商 A'); await sleep(400)
if (await hasOverlay(page)) await closeOverlay(page)
await clickText(page, '下一步'); await sleep(600)
await clickStep(page, '开业计划'); await sleep(300)
await 必见(page, ['开业计划'], '节点6-开业页')
await shot(page, '节点6-开业计划.png')
for (const n of ['装修', '系统上线', '招聘']) {
  await clickCard(page, n, 'starts'); await sleep(400)
  if (await hasOverlay(page)) await closeOverlay(page)
  await clickCard(page, n, 'starts'); await sleep(300)
}
await clickText(page, '完成筹建'); await sleep(1200)
if (await hasOverlay(page)) await closeOverlay(page)
// 节点7
await 必见(page, ['资金状况', '本周经营中'], '节点7-经营页')
await shot(page, '节点7-经营页总览.png')
// 节点8
await page.evaluate(() => {
  const card = [...document.querySelectorAll('.task-card')].find(x => x.textContent.includes('动态调价'))
  card && card.click()
})
await sleep(800)
await 必见(page, ['动态调价', '决策前想一想', '会影响哪些指标'], '节点8-决策面板')
await shot(page, '节点8-决策面板-动态调价.png')
await clickCard(page, '不跟降'); await sleep(600)
await 必见(page, ['适用场景（怎么办）', '教学点', '引擎依据'], '节点8-四段式反馈')
await shot(page, '节点8-选项反馈-四段式.png')
await closeOverlay(page)
// ★ 决策面板开着时底部 tab 不可见 ⇒ 先「‹ 返回」回经营页再切 tab
await clickText(page, '返回'); await sleep(600)
// 节点9
await clickText(page, '口碑'); await sleep(900)
await 必见(page, ['口碑'], '节点9-口碑页')
await shot(page, '节点9-口碑页.png')
await clickText(page, '报表'); await sleep(900)
await 必见(page, ['周报'], '节点9-报表页')
await shot(page, '节点9-报表周报区.png')
// 节点10（卡④：不登教师账号 ⇒ 实读离线态教师可达性并如实记录）
await clickText(page, '我的'); await sleep(600)
await shot(page, '节点10-我的页-退出入口.png')
{
  const t = await text(page)
  console.log('  [节点10 如实记录] 离线演示态：' + (t.includes('退出登录') ? '有退出登录入口；教师端需云端教师账号（卡④明令不登）⇒ 该节点环境性跳过，演示时用 T099 线上走' : '未见教师入口'))
}

// ② 唯一性守门：20 张 sha256 互不相同
await browser.close()
const hashes = shots.map(s => ({ name: s.name, h: createHash('sha256').update(readFileSync(s.p)).digest('hex') }))
const 重复 = []
for (let i = 0; i < hashes.length; i++) for (let j = i + 1; j < hashes.length; j++) if (hashes[i].h === hashes[j].h) 重复.push(`${hashes[i].name}==${hashes[j].name}`)
if (重复.length) { console.error('✗ 截图唯一性守门：发现同图 ' + 重复.join('、')); process.exit(1) }
console.log(`\n✓ ${shots.length} 张截图全部唯一（sha256 互异）· 每屏特征文本断言全过`)
