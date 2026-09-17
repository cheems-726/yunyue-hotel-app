import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`, headless: true })
const page = await (await browser.newContext({ viewport: { width: 480, height: 900 } })).newPage()
const errors = []
page.on('pageerror', e => errors.push('PAGEERR: ' + (e.stack || e.message).slice(0, 700)))
await page.goto('http://localhost:5173/')
await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(1200)
await page.evaluate(() => localStorage.clear())
// 注入一条测试差评+一条好评（模拟结算后口碑页）
await page.evaluate(() => {
  const key = 'hotel-sim-reviews'
  const list = [
    { id: 't1', avatar: '🧑', bg: 'blue', name: '王先生 · 商务出差', date: '第1周', stars: 1, text: '「空调坏了，一晚上没睡好。」', status: 'pending' },
    { id: 't2', avatar: '👩', bg: 'green', name: '李女士 · 家庭出游', date: '第1周', stars: 5, text: '「位置很好，下次还来。」', status: 'good' },
  ]
  localStorage.setItem(key, JSON.stringify(list))
  // 伪造已完成开局的存档（跳过流程直达经营页）
  const state = { user: { role: 'student', id: '20240101', name: '测试', cloud: false }, location: { city: '成都', district: '锦江区', attrs: { 客流: 5, 房价: 5, 租金: 4, 竞争: 5, 人力: 4, 波动: 2 } }, brand: { name: '汉庭', level: '经济型 · 国民', price: '180-280元' }, property: { name: '社区旁物业', rooms: '72间' }, established: true, estChoices: { invest: '基准情景', supplier: '供应商 A', opening: ['装修', '系统上线', '招聘'] }, doneDecisions: {}, report: null, week: 1, history: [{ week: 1, occupancy: 60, finalGoodRate: 78, profit: 500, revenue: 9000, totalCost: 8500, rooms: 72, occupiedRooms: 43, price: 230, reviewCount: 5, negativeCount: 2, totalExpenses: 8500, generatedReviews: [], events: [], insights: [], decisions: {} }], finished: false, welcomed: true }
  localStorage.setItem('hotel-sim-state-v1', JSON.stringify(state))
})
await page.reload(); await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(1500)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('口碑')); b && b.click() })
await page.waitForTimeout(1200)
const body = await page.evaluate(() => document.body.innerText.slice(0, 150))
console.log('=== reputation page ===')
console.log(JSON.stringify(body))
console.log('=== errors ===')
console.log(errors.length ? errors.join('\n---\n') : 'none')
await browser.close()
