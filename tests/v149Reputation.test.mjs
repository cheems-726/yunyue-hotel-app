// V149 §2 · 差评四分支（生成→回复→不处理→无差评周）
import { chromium } from 'playwright-core'
import { spawn, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
let PORT = 4173, BASE = `http://localhost:${PORT}/`, server = null
if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(2) }
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const sleep = ms => new Promise(r => setTimeout(r, ms))
if (!(await fetch(BASE).then(r => r.ok).catch(() => false))) {
  for (let p = 4206; p <= 4230; p++) if (!(await fetch(`http://localhost:${p}/`).then(() => true).catch(() => false))) { PORT = p; BASE = `http://localhost:${p}/`; break }
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true })
}
for (let i = 0; i < 40; i++) { if (await fetch(BASE).then(r => r.ok).catch(() => false)) break; await sleep(300) }
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.route('**/rest/v1/rpc/class_day_now', r => r.fulfill({ status: 200, contentType: 'application/json', body: '7' }))
  const seed = async (reviews, rate = 50) => {
    await page.goto(BASE)
    await page.evaluate(({ reviews: rv, rate }) => {
      const st = {
        user: { role: 'student', id: '20240101', name: 'V149', cloud: false },
        location: { city: '成都', district: '锦江区', attrs: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 } },
        brand: { name: '汉庭', level: '经济型 · 国民', price: '210-310元', standard: '客房70间起', rentFactor: 0.30 },
        property: { name: '交通枢纽物业' }, established: true, hotelName: '云悦V149店', welcomed: true,
        week: 2, capital: 1490000, attrs: { quality: 60, reputation: 70, morale: 65 }, bizMode: 'direct', scaleVersion: 3,
        openDayNo: null, report: null, finished: false, decisionChanges: [], __autoSettled: [], operatorLogs: [], estChoices: {}, doneDecisions: {},
        history: [{ week: 1, occupancy: 70, revenue: 100000, profit: 1000, gop: 5000, finalGoodRate: rate, negativeCount: rate >= 90 ? 0 : 1, events: [], generatedReviews: [], decisions: {} }],
      }
      localStorage.setItem('hotel-sim-state', JSON.stringify(st))
      for (const k of Object.keys(localStorage)) if (k.startsWith('hotel-sim-floor-')) localStorage.removeItem(k)
      localStorage.setItem('hotel-sim-reviews', JSON.stringify(rv))
    }, { reviews, rate })
    await page.reload(); await sleep(1500)
    await page.evaluate(() => { const b = [...document.querySelectorAll('.tabbar button')].find(x => x.textContent.includes('口碑')); b && b.click() })
    await sleep(700)
  }
  const 差评 = { id: 'r1', avatar: 'guest', bg: 'blue', name: '客人 · 商务', date: '昨天', stars: 2, text: '「隔音太差，一夜没睡好。」', status: 'pending' }

  console.log('▶ V149 · 差评处理四分支')
  await seed([差评, { id: 'g1', avatar: 'guest', bg: 'green', name: '客人 · 家庭', date: '昨天', stars: 5, text: '「很好。」', status: 'good' }])
  const t0 = await page.evaluate(() => document.body.innerText)
  ok(/差评处理率 0%/.test(t0) && /隔音太差/.test(t0), '有 1 条待处理差评 ⇒ 处理率 0%、该差评可见')
  await page.getByRole('button', { name: /^回复$/ }).first().click()
  await sleep(400)
  await page.locator('textarea').fill('非常抱歉给您带来不好的体验，我们已排查整改并为您申请补偿，期待再次光临。')
  await page.getByRole('button', { name: '发送回复' }).click()
  await sleep(700)
  const t1 = await page.evaluate(() => document.body.innerText)
  const ls1 = await page.evaluate(() => JSON.parse(localStorage.getItem('hotel-sim-reviews') || '[]'))
  ok(ls1.find(x => x.id === 'r1')?.status === 'resolved', '回复后该差评状态 = resolved')
  ok(/差评处理率 100%/.test(t1), '回复后处理率 100%')

  await seed([差评])
  await page.getByRole('button', { name: '不处理' }).first().click()
  await sleep(500)
  const ls2 = await page.evaluate(() => JSON.parse(localStorage.getItem('hotel-sim-reviews') || '[]'))
  const t2 = await page.evaluate(() => document.body.innerText)
  ok(ls2.find(x => x.id === 'r1')?.status === 'ignored', '「不处理」状态 = ignored')
  ok(/差评处理率 0%/.test(t2), '「不处理」不提升处理率（仍 0%）')

  await seed([], 95)
  const t3 = await page.evaluate(() => document.body.innerText)
  ok(/差评处理率 —/.test(t3) && /暂无待处理差评/.test(t3), '无差评周 ⇒ 处理率「—」+ 暂无待处理（不显示 0%）')
  ok(!/差评处理率 0%/.test(t3), '无差评周不出现「0%」讥讽')

  // 好评率<90 且页面无待处理 ⇒ 必须生成 1 条可处理差评（回执 §3）
  await seed([], 50)
  const tf = await page.evaluate(() => document.body.innerText)
  const ids = await page.evaluate(() => JSON.parse(localStorage.getItem('hotel-sim-reviews') || '[]').filter(x => String(x.id).startsWith('floor-w')).length)
  ok(ids === 1 && /差评处理率 0%/.test(tf), '好评率 50% 且无待处理 ⇒ 自动生成 1 条可处理差评（处理率 0%）')

  await page.getByText('处理率明细（分子/分母）').click().catch(() => {})
  const t4 = await page.evaluate(() => document.body.innerText)
  ok(/已解决 0 · 待处理 1 · 忽略 0/.test(t4), '点开可见处理率分子/分母')
} finally {
  await browser.close()
  try { if (server?.pid) { if (process.platform === 'win32') execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore', windowsHide: true }); else server.kill('SIGTERM') } } catch (e) {}
}
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
