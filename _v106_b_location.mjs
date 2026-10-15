// V106 B 域：选址页实测（列表重名 B2 / 数据卡 B1 / 地图列表联动 B3 / 品牌 B4 / 五步链 B5）
import { chromium } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.BASE || 'http://121.196.196.37/'
const ID = process.env.STU_ID || '20260901'
const PW = process.env.STU_PW || 'test123456'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const log = (...a) => console.log(...a)
const b = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await b.newContext({ viewport: { width: 480, height: 900 }, ignoreHTTPSErrors: true })).newPage()
const errs = []
page.on('pageerror', e => { if (!(e.message || '').includes('plugin is not implemented')) errs.push(e.message) })
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 120)) })

await page.goto(BASE); await page.waitForLoadState('domcontentloaded')
await page.evaluate(() => localStorage.clear())
await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(1300)
await page.evaluate(() => { const x = [...document.querySelectorAll('button, span')].find(e => e.textContent.includes('我是学生')); x && x.click() })
await sleep(450)
await page.evaluate(({ id, pw }) => {
  const ins = [...document.querySelectorAll('input')]
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(ins[0], id); ins[0].dispatchEvent(new Event('input', { bubbles: true }))
  s.call(ins[1], pw); ins[1].dispatchEvent(new Event('input', { bubbles: true }))
  const btn = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled); btn && btn.click()
}, { id: ID, pw: PW })
for (let k = 0; k < 24; k++) { await sleep(500); const t = await page.evaluate(() => document.body.innerText); if (/欢迎你|开始我的酒店之旅|资金状况|地图选点/.test(t)) break }
let t = await page.evaluate(() => document.body.innerText)
if (t.includes('欢迎你')) { await page.evaluate(() => { const x = [...document.querySelectorAll('button,span,div')].find(e => e.textContent.includes('开始我的酒店之旅')); x && x.click() }); await sleep(900) }
await sleep(600)

// ── B2：把列表项全量拿出来，统计重名 ──
const listNames = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.district-card')]
  return cards.map(c => (c.textContent.match(/[\u4e00-\u9fa5]{2,6}(区|市|县|商圈)/) || [''])[0]).filter(Boolean)
})
const cnt = {}
for (const n of listNames) cnt[n] = (cnt[n] || 0) + 1
const dups = Object.entries(cnt).filter(([, v]) => v > 1)
log('B2 列表项数 =', listNames.length)
log('B2 列表名 :', listNames.join(' '))
log('B2 重名项 :', dups.length ? dups.map(([n, v]) => `${n}×${v}`).join(' · ') : '(无重复)')

// ── B1：逐个点开数据卡，检查是否空白/占位 ──
let opened = 0, blank = 0
for (let i = 0; i < listNames.length; i++) {
  const r = await page.evaluate((idx) => {
    const cards = [...document.querySelectorAll('.district-card')]
    const c = cards[idx]; if (!c) return null
    c.click(); return true
  }, i)
  await sleep(420)
  const card = await page.evaluate(() => {
    const d = [...document.querySelectorAll('div')].find(x => x.style.position === 'fixed' && x.textContent.includes('你的选择会带来'))
    return d ? d.innerText.replace(/\s+/g, ' ').slice(0, 220) : null
  })
  if (r) opened++
  const bad = !card || /undefined|NaN|待补|暂无数据|NaN/.test(card) || card.replace(/\s/g, '').length < 20
  if (bad) { blank++; log(`   ⚠ B1 ${listNames[i]} 数据卡异常: ${JSON.stringify((card || '(无浮层)').slice(0, 90))}`) }
  await page.evaluate(() => { const x = [...document.querySelectorAll('button,span,div')].find(e => e.textContent.trim() === '明白了'); x && x.click() })
  await sleep(200)
}
log(`B1 数据卡：点开 ${opened}/${listNames.length} · 异常 ${blank}`)

// ── B3：地图区划与列表选中态是否一致（点地图 path 看是否回填标题）──
const mapInfo = await page.evaluate(() => {
  const paths = [...document.querySelectorAll('svg path')]
  return { paths: paths.length, sample: paths.slice(0, 3).map(p => p.getAttribute('d') ? 'has-d' : 'no-d') }
})
log('B3 地图 path 数 =', mapInfo.paths, mapInfo.sample.join(','))

log('JS 错误 =', errs.length, errs.slice(0, 3))
await page.screenshot({ path: 'D:/教学app/4-审计与报告/V106-检查取证/B-选址页.png' })
await b.close()
