// 线上（生产）无痕自检 —— 口碑页卡片 + 🔍 关联经营 + 不白屏
// ⚠️ 只读：走「离线演示」路径（不登录云端账号、不写任何生产数据），只在本地 localStorage 造场景
// 运行：node tests/_prod-check.mjs
import { chromium } from 'playwright-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'https://www.2026911301.xyz/'
const results = []
const sleep = ms => new Promise(r => setTimeout(r, ms))
let lastText = ''
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
    const ms = [...document.querySelectorAll('.district-card, div')].filter(x => mode === 'starts' ? x.textContent.startsWith(t) : x.textContent.includes(t))
    if (!ms.length) return false
    const inner = ms.reverse().find(x => !ms.some(y => y !== x && x.contains(y)))
    inner.click(); return true
  }, { t, mode })
}
async function hasOverlay(page) {
  return page.evaluate(() => !!([...document.querySelectorAll('div')].find(d => d.style.position === 'fixed' && d.textContent.includes('你的选择会带来'))))
}
async function closeOverlay(page) { await clickText(page, '明白了'); await sleep(250) }
async function clickTab(page, label) {
  return page.evaluate(l => {
    const tb = document.querySelector('.tabbar')
    if (!tb) return false
    const b = [...tb.querySelectorAll('button, div, span')].find(x => x.textContent.includes(l))
    if (b) { b.click(); return true }
    return false
  }, label)
}

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const ctx = await browser.newContext({ viewport: { width: 480, height: 900 } })
const page = await ctx.newPage()
let jsErrors = 0
page.on('pageerror', e => { if (!String(e.message).includes('plugin is not implemented')) { jsErrors++; ok('页面JS异常: ' + e.message, false) } })
page.on('console', m => { if (m.type() === 'error' && !String(m.text()).includes('plugin is not implemented')) { jsErrors++; ok('控制台报错: ' + m.text().slice(0, 80), false) } })

try {
  console.log('▶ 线上无痕自检（离线演示路径，不碰云端）')
  let bundle = ''
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  bundle = await page.evaluate(() => [...document.querySelectorAll('script[src]')].map(s => s.src).find(s => /assets\/index-.*\.js/.test(s)) || '')
  console.log('    线上 bundle: ' + bundle.split('/').pop())
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(1500)
  ok('登录页渲染（不白屏）', (await text(page)).includes('请选择你的身份'))

  await clickText(page, '我是学生'); await sleep(500)
  await clickText(page, '离线演示'); await sleep(500)
  await clickText(page, '进入演示'); await sleep(800)
  ok('演示模式进入欢迎页', (await text(page)).includes('欢迎你'))

  await clickText(page, '开始我的酒店之旅'); await sleep(900)
  await clickCard(page, '锦江区'); await sleep(600); await closeOverlay(page)
  await clickText(page, '确认选址'); await sleep(800)
  await clickCard(page, '汉庭'); await sleep(500)
  await clickText(page, '确认选择'); await sleep(800)
  await clickCard(page, 'OTA平台合作'); await sleep(500)
  await clickText(page, '确认'); await sleep(700)
  await clickCard(page, '社区旁物业'); await sleep(500)
  for (let i = 0; i < 7; i++) {
    const done = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('完成认领'))
      if (b) { b.click(); return true }
      const n = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('下一步'))
      if (n) { n.click(); return false }
      return false
    })
    await sleep(600); if (done) break
  }
  await clickCard(page, '基准情景', 'starts'); await sleep(600); await closeOverlay(page)
  await page.evaluate(() => { const s = [...document.querySelectorAll('div')].find(d => d.textContent === '📄' && d.style.cursor === 'pointer'); s && s.click() }); await sleep(500)
  for (const n of ['申领营业执照', '刻章备案', '消防检查合格证', '特种行业经营许可证', '卫生许可证', '税务申报']) {
    await clickCard(page, n, 'starts'); await sleep(500)
    if (!(await hasOverlay(page))) { await closeOverlay(page); await clickCard(page, n, 'starts'); await sleep(500) }
    await closeOverlay(page)
  }
  await page.evaluate(() => { const s = [...document.querySelectorAll('div')].find(d => d.textContent === '🛒' && d.style.cursor === 'pointer'); s && s.click() }); await sleep(500)
  await clickCard(page, '供应商 A'); await sleep(500); await closeOverlay(page)
  await page.evaluate(() => { const s = [...document.querySelectorAll('div')].find(d => d.textContent === '🎉' && d.style.cursor === 'pointer'); s && s.click() }); await sleep(500)
  for (const n of ['装修', '系统上线', '招聘']) { await clickCard(page, n, 'starts'); await sleep(500); await closeOverlay(page); await clickCard(page, n, 'starts'); await sleep(350) }
  await clickText(page, '完成筹建'); await sleep(1400); await closeOverlay(page)
  ok('开业完成 → 经营页（不白屏）', (await text(page)).includes('资金状况'))

  // 造场景：一条带 cause/房型/天数的待处理差评 + 一张实时评价（本地存储，不碰云端）
  await page.evaluate(() => {
    const list = [
      { id: 'prod-n1', avatar: '👩', bg: 'blue', name: '李女士 · 家庭出游', date: '入住2天 · 今天 10:20', stars: 1,
        text: '「前台办理入住等了半小时，孩子在旁边闹得不行。」', status: 'pending', roomType: '标准双床', nights: 2,
        cause: 'front_slow', relatedDecision: 'shifts', guest: { gender: 'female', card: '李女士 · 家庭出游' } },
      { id: 'prod-live1', avatar: '🧑', bg: 'green', name: '王先生 · 商务出差', date: '入住1天 · 09:41', stars: 5,
        text: '「房间干净整洁，床品很舒服，住得踏实。」', status: 'good', roomType: '大床房', nights: 1,
        cause: 'praise_clean', relatedDecision: 'hygiene', live: true, liveWeek: 1, liveDate: new Date().toISOString().slice(0, 10),
        guest: { gender: 'male', card: '王先生 · 商务出差' } },
    ]
    localStorage.setItem('hotel-sim-reviews', JSON.stringify(list))
    const st = JSON.parse(localStorage.getItem('hotel-sim-state') || '{}')
    st.doneDecisions = { ...(st.doneDecisions || {}), shifts: '精简省成本' }
    localStorage.setItem('hotel-sim-state', JSON.stringify(st))
  })
  await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(1800)
  ok('刷新后仍不白屏（经营页）', (await text(page)).includes('资金状况'))

  await clickTab(page, '口碑'); await sleep(1400)
  const rep = await text(page)
  ok('口碑页渲染（口碑构成拆解/待处理区）', rep.includes('口碑构成拆解') || rep.includes('待处理'))
  ok('待处理差评卡渲染（含身份与星级）', rep.includes('李女士') && rep.includes('标准双床'))
  ok('实时评价卡渲染（好评区）', rep.includes('王先生'))
  ok('🛏 房型/天数展示', rep.includes('标准双床') && rep.includes('入住2天'))

  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('🔍 关联经营'))
    if (!b) return 'no-button'
    b.click(); return 'clicked'
  })
  await sleep(700)
  const rep2 = await text(page)
  ok('「🔍 关联经营」按钮存在且可点', clicked === 'clicked')
  ok('展开后反查到本组决策与选择（前台排班 → 精简省成本）', rep2.includes('前台排班') && rep2.includes('精简省成本'))
  ok('全过程无 JS 异常 / 控制台报错', jsErrors === 0)
} catch (e) {
  ok('脚本异常: ' + (e && e.message), false)
} finally {
  console.log(`\n========== 线上自检: ${results.filter(r => r.pass).length} 通过 / ${results.filter(r => !r.pass).length} 失败 ==========`)
  try { await browser.close() } catch (e) {}
}
process.exit(results.some(r => !r.pass) ? 1 : 0)
