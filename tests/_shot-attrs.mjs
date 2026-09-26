// 3-C 视觉取证：属性面板 + 飘字瞬间 + toast
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
const require2 = createRequire(import.meta.url)
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:4173/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const freshSave = JSON.stringify({
  user: { role: 'student', id: 'demo-c', name: '验收同学', cloud: false, groupNo: null, className: null, groupRole: null },
  location: { city: '成都', district: '锦江区', attrs: { 客流: 5, 房价: 5, 租金: 5, 竞争: 5, 人力: 4, 波动: 2 } },
  brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' },
  property: { name: '社区旁物业', type: '社区型', area: '2600㎡', rooms: '72间', rent: '中等', match: '高' },
  established: true, estChoices: { invest: '基准情景', supplier: '供应商 B：指定供应商', opening: ['装修', '系统上线', '招聘'] },
  doneDecisions: {}, report: null, week: 1, history: [], finished: false, welcomed: true,
})
const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore', shell: true, detached: true })
let browser
try {
  for (let i = 0; i < 40; i++) { try { const x = await fetch(BASE); if (x.ok) break } catch (e) {} await sleep(300) }
  browser = await chromium.launch({ executablePath: EDGE, headless: true })
  const page = await (await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage()
  await page.goto(BASE); await page.waitForLoadState('domcontentloaded'); await sleep(800)
  await page.evaluate(s => { localStorage.clear(); localStorage.setItem('hotel-sim-state', s) }, freshSave)
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(2600)
  // 滚到属性面板
  await page.evaluate(() => { const s = [...document.querySelectorAll('span')].find(x => x.textContent.includes('酒店属性')); s && s.scrollIntoView({ block: 'center' }) })
  await sleep(500)
  await page.screenshot({ path: 'tests/_shot-attrs-before.png' })
  // 做客房质检 → 300ms 内截图抓飘字 + toast
  await page.evaluate(() => { const c = [...document.querySelectorAll('.task-card')].find(x => x.textContent.includes('客房质检')); c && c.click() }); await sleep(900)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && (x.textContent.includes('确认决策') || x.textContent.includes('提交'))); b && b.click() })
  await sleep(350)
  await page.evaluate(() => { const s = [...document.querySelectorAll('span')].find(x => x.textContent.includes('酒店属性')); s && s.scrollIntoView({ block: 'center' }) })
  await sleep(120)
  await page.screenshot({ path: 'tests/_shot-attrs-after.png' })
  console.log('截图: tests/_shot-attrs-before.png（决策前）/ _shot-attrs-after.png（+5 飘字瞬间）')
} catch (e) { console.error('中断:', e.message) } finally {
  try { await browser?.close() } catch (e) {}
  try { require2('node:child_process').execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }) } catch (e) {}
}
