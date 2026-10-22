// V144 §1 · 报表页口径对齐：首屏 12 周经营利润 GOP；净利润/回本折叠；历史周报标口径
import { chromium } from 'playwright-core'
import { spawn, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
let PORT = 4173
let BASE = `http://localhost:${PORT}/`
let server = null
if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(2) }
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

if (!(await fetch(BASE).then(r => r.ok).catch(() => false))) {
  for (let p = 4206; p <= 4230; p++) {
    if (!(await fetch(`http://localhost:${p}/`).then(() => true).catch(() => false))) { PORT = p; BASE = `http://localhost:${p}/`; break }
  }
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true })
}
for (let i = 0; i < 40; i++) { if (await fetch(BASE).then(r => r.ok).catch(() => false)) break; await sleep(300) }

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.route('**/rest/v1/rpc/class_day_now', r => r.fulfill({ status: 200, contentType: 'application/json', body: '84' }))
  await page.goto(BASE)
  await page.evaluate(() => {
    const 周 = (week, gop) => ({
      week, gop, profit: week === 1 ? gop - 608000 : gop,
      occupancy: 70 + (week % 20), revenue: 100000, totalCost: 70000, finalGoodRate: 85, negativeCount: 0,
      events: [], generatedReviews: [], decisions: {}, ...(week === 1 ? { oneTimeFees: { 开业费用: 338000, 保证金: 100000, 保证金退还: 0 } } : (week === 12 ? { oneTimeFees: { 开业费用: 0, 保证金: 0, 保证金退还: 100000 } } : {})),
    })
    const history = []
    for (let w = 1; w <= 11; w++) history.push(周(w, 23400))
    history.push(周(12, 23600))
    const st = {
      user: { role: 'student', id: '20240101', name: 'V144 学生', cloud: false },
      location: { city: '成都', district: '锦江区', attrs: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 } },
      brand: { name: '汉庭', level: '经济型 · 国民', price: '210-310元', standard: '客房70间起', rentFactor: 0.30 },
      property: { name: '交通枢纽物业' }, established: true, hotelName: '云悦V144店', welcomed: true,
      week: 13, capital: 1163000, attrs: { quality: 60, reputation: 70, morale: 65 },
      bizMode: 'direct', scaleVersion: 3, openDayNo: null, report: null, finished: false,
      decisionChanges: [], __autoSettled: [], operatorLogs: [], estChoices: {}, doneDecisions: {}, history,
    }
    localStorage.setItem('hotel-sim-state', JSON.stringify(st))
  })
  await page.reload(); await sleep(1600)
  await page.evaluate(() => { const b = [...document.querySelectorAll('.tabbar button')].find(x => x.textContent.includes('报表')); b && b.click() })
  await sleep(900)

  const t = await page.evaluate(() => document.body.innerText)
  const ans = await page.locator('[data-report-answer="1"]').innerText().catch(() => '')
  ok(/12 周经营净利/.test(ans) && /−8\.9万/.test(ans), `首屏主视觉 = 12 周经营净利 −8.9 万（${ans.split('\n')[0] || ''}）`)
  ok(/GOP/.test(ans) && /未扣租金/.test(ans) && /租金/.test(ans) && /加盟费/.test(ans) && /装修\/其他/.test(ans), '副行拆开：营收/GOP/租金/加盟费/装修其他')
  ok(/一次性开业 33\.8万/.test(ans) && /149\.0万 → 116\.3万/.test(ans), '一次性行含开业 33.8 与账面 149.0→116.3')

  const cash = await page.evaluate(() => { const d = document.querySelector('details[data-cash-details="1"]'); return d ? { open: d.open, text: d.textContent } : null })
  ok(!!cash && cash.open === false, '累计净利润/盈亏平衡折叠且默认收起')
  ok(!/尚未回本/.test(t), '首屏正文不出现「尚未回本」')
  ok(!!cash && /尚未回本/.test(cash.text), '「尚未回本」只在折叠内容里')

  ok(/经营净利/.test(t) && /含开办费净利/.test(t), '历史周报每行标「经营净利 / 含开办费净利」')
} finally {
  await browser.close()
  try { if (server?.pid) { if (process.platform === 'win32') execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore', windowsHide: true }); else server.kill('SIGTERM') } } catch (e) {}
}
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
