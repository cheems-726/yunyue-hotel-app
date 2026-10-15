// V106 B2 扩大扫描：整页所有"区/市/县"名全量计数（含地图标注、分组标题、非 .district-card 的元素）
import { chromium } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.BASE || 'http://121.196.196.37/'
const ID = process.env.STU_ID || '20260901'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const log = (...a) => console.log(...a)
const b = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await b.newContext({ viewport: { width: 480, height: 1000 }, ignoreHTTPSErrors: true })).newPage()
await page.goto(BASE); await page.waitForLoadState('domcontentloaded')
await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(1300)
await page.evaluate(() => { const x = [...document.querySelectorAll('button, span')].find(e => e.textContent.includes('我是学生')); x && x.click() })
await sleep(450)
await page.evaluate(({ id }) => {
  const ins = [...document.querySelectorAll('input')]
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(ins[0], id); ins[0].dispatchEvent(new Event('input', { bubbles: true }))
  s.call(ins[1], 'test123456'); ins[1].dispatchEvent(new Event('input', { bubbles: true }))
  const btn = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled); btn && btn.click()
}, { id: ID })
for (let k = 0; k < 24; k++) { await sleep(500); const t = await page.evaluate(() => document.body.innerText); if (/欢迎你|开始我的酒店之旅|资金状况|地图选点/.test(t)) break }
let t = await page.evaluate(() => document.body.innerText)
if (t.includes('欢迎你')) { await page.evaluate(() => { const x = [...document.querySelectorAll('button,span,div')].find(e => e.textContent.includes('开始我的酒店之旅')); x && x.click() }); await sleep(900) }
await sleep(700)

const r = await page.evaluate(() => {
  const NAMES = ['锦江区', '高新区', '武侯区', '青羊区', '金牛区', '龙泉驿区', '双流区', '都江堰市', '简阳市', '郫都区', '蒲江县', '彭州市', '新都区', '温江区', '新津区', '德阳市', '旌阳区', '广汉市', '绵阳市', '涪城区']
  const cnt = {}
  for (const n of NAMES) {
    // 文本节点级计数（避免父元素把子元素文本重复计入）
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let c = 0, node
    while ((node = walker.nextNode())) if (node.nodeValue && node.nodeValue.includes(n)) c++
    cnt[n] = c
  }
  const cards = [...document.querySelectorAll('.district-card')]
  const svgText = [...document.querySelectorAll('svg text')].map(x => x.textContent.trim())
  return { cnt, cardCount: cards.length, svgTexts: svgText, bodyLen: document.body.innerText.length }
})
log('district-card 数 =', r.cardCount, '· 页面文本长度 =', r.bodyLen)
log('各名"文本节点"命中次数：')
for (const [n, c] of Object.entries(r.cnt)) if (c) log(`   ${n.padEnd(8)} ${c}`)
log('svg 文本标注 =', JSON.stringify(r.svgTexts.slice(0, 20)))
await page.screenshot({ path: 'D:/教学app/4-审计与报告/V106-检查取证/B2-选址全页.png', fullPage: true })
await b.close()
