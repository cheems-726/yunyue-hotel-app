// 选址数据任务 · 视觉取证：截图【选址页】看竞品/人流/经济三块是否正常渲染
// 运行：node tests/_shot-locations.mjs
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:4173/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const fresh = JSON.stringify({
  user: { role: 'student', id: 'demo-loc', name: '选址验收', cloud: false, groupNo: null, className: null, groupRole: null },
  welcomed: true,
})
const child = spawn('npx', ['vite', 'preview', '--port', '4188', '--strictPort'], { stdio: 'ignore', shell: true, detached: true })
let browser
try {
  for (let i = 0; i < 40; i++) { try { const x = await fetch(BASE); if (x.ok) break } catch (e) {} await sleep(300) }
  browser = await chromium.launch({ executablePath: EDGE, headless: true })
  const page = await (await browser.newContext({ viewport: { width: 412, height: 1400 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage()
  await page.goto(BASE); await page.waitForLoadState('domcontentloaded'); await sleep(700)
  await page.evaluate(s => { localStorage.clear(); localStorage.setItem('hotel-sim-state', s) }, fresh)
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(2600)
  // 进入选址页（若在登录页则点离线演示）
  const txt0 = await page.evaluate(() => document.body.innerText)
  if (/离线演示|演示模式/.test(txt0)) {
    await page.evaluate(() => { const b = [...document.querySelectorAll('button,div')].find(x => /离线演示/.test(x.textContent) && x.children.length <= 2); b && b.click() })
    await sleep(1800)
  }
  const txt1 = await page.evaluate(() => document.body.innerText)
  console.log('页面含「选择你的酒店所在地」:', /选择你的酒店所在地/.test(txt1))
  console.log('含「竞品」:', /周边竞品/.test(txt1), '｜含「人流」:', /人流/.test(txt1), '｜含「经济」:', /经济/.test(txt1))
  // 切到德阳（含精细画像 + 商圈）与承德（未采）各截一张
  for (const [city, district, file] of [['成都', '简阳市', '_shot-loc-jianyang.png'], ['德阳', '中江县', '_shot-loc-zhongjiang.png'], ['承德', '承德县', '_shot-loc-chengdexian.png']]) {
    await page.evaluate(c => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === c); b && b.click() }, city)
    await sleep(800)
    const got = await page.evaluate(n => {
      const c = [...document.querySelectorAll('.district-card')].find(x => x.textContent.includes(n))
      if (!c) return null
      c.scrollIntoView({ block: 'center' })
      return c.innerText.replace(/\s+/g, ' ')
    }, district)
    await sleep(500)
    await page.screenshot({ path: 'tests/' + file, fullPage: false })
    console.log('已截图', file, '｜', (got || '未找到').slice(0, 260))
  }
  // 断言式摘要：锦江区那块的三行文本
  const probe = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.district-card')]
    const pick = (n) => { const c = cards.find(x => x.textContent.includes(n)); return c ? c.innerText.replace(/\s+/g, ' ').slice(0, 320) : null }
    return { 成都: pick('锦江区') }
  })
  console.log('摘要（切回成都后需要，若为空说明切城市时序）:', JSON.stringify(probe).slice(0, 400))
} finally {
  if (browser) await browser.close()
  try { process.kill(-child.pid) } catch (e) {}
}
