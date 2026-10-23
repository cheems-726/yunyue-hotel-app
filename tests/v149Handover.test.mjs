// V149 §3 · 移交/代提交：toast + 状态 + 持久化 + 撤销；周报渲染
import { chromium } from 'playwright-core'
import { spawn, execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
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
  await page.route('**/rest/v1/rpc/class_day_now', r => r.fulfill({ status: 200, contentType: 'application/json', body: '9' }))
  await page.goto(BASE)
  await page.evaluate(() => {
    const st = {
      user: { role: 'student', id: '20240101', name: 'V149', cloud: false, groupRole: 'manager' },
      location: { city: '成都', district: '锦江区', attrs: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 } },
      brand: { name: '汉庭', level: '经济型 · 国民', price: '210-310元', standard: '客房70间起', rentFactor: 0.30 },
      property: { name: '交通枢纽物业' }, established: true, hotelName: '云悦V149店', welcomed: true,
      week: 2, capital: 1490000, attrs: { quality: 60, reputation: 70, morale: 65 }, bizMode: 'direct', scaleVersion: 3,
      openDayNo: null, report: null, finished: false, decisionChanges: [], __autoSettled: [], operatorLogs: [], estChoices: {}, doneDecisions: {},
      history: [{ week: 1, occupancy: 70, revenue: 100000, profit: 1000, gop: 5000, finalGoodRate: 80, negativeCount: 0, events: [], generatedReviews: [], decisions: {} }],
    }
    localStorage.setItem('hotel-sim-state', JSON.stringify(st))
  })
  await page.reload(); await sleep(1600)
  console.log('▶ V149 · 移交/代提交反馈')
  const 移交 = page.getByRole('button', { name: '移交给他' }).first()
  ok(await 移交.count() === 1, '经营页有「移交给他」按钮')
  await 移交.click(); await sleep(500)
  const t1 = await page.evaluate(() => document.body.innerText)
  ok(/已记录移交/.test(t1), '点击后出现 toast「已记录移交」')
  ok(await page.getByRole('button', { name: /已移交 ✓（撤销）/ }).count() >= 1, '按钮变为「已移交 ✓（撤销）」')
  ok((await page.evaluate(() => document.body.innerText)).includes('已移交：'), '决策卡有「已移交：职务」小标签')

  const beforeReload = await page.evaluate(() => JSON.parse(localStorage.getItem('hotel-sim-state') || '{}').operatorLogs)
  console.log('   [debug] operatorLogs before reload:', JSON.stringify(beforeReload))
  await page.reload(); await sleep(1500)
  const afterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('hotel-sim-state') || '{}').operatorLogs)
  console.log('   [debug] operatorLogs after reload:', JSON.stringify(afterReload))
  ok(await page.getByRole('button', { name: /已移交 ✓（撤销）/ }).count() >= 1, '刷新后移交状态保留（跟存档）')
  const undo = page.getByRole('button', { name: /已移交 ✓（撤销）/ }).first()
  await undo.click(); await sleep(500)
  const st2 = await page.evaluate(() => JSON.parse(localStorage.getItem('hotel-sim-state') || '{}'))
  ok((st2.operatorLogs || []).filter(x => x.type === 'handover').length === 0, '再点一次撤销（operatorLogs 清除该条）')
  ok(await page.getByRole('button', { name: '移交给他' }).count() >= 1, '撤销后按钮恢复「移交给他」')

  const 代交 = page.getByRole('button', { name: '代提交' }).first()
  await 代交.click(); await sleep(500)
  const t3 = await page.evaluate(() => document.body.innerText)
  ok(/已代提交/.test(t3) && /代提交人：你/.test(t3), '代提交 toast 含代提交人/责任人')
  ok(await page.getByRole('button', { name: /已代提交 ✓（撤销）/ }).count() >= 1, '按钮变为「已代提交 ✓（撤销）」')

  const wr = readFileSync('src/WeeklyReport.jsx', 'utf8')
  ok(/data-handover-log="1"/.test(wr) && /本周移交 \/ 代提交/.test(wr), '周报有「本周移交 / 代提交」渲染块')
} finally {
  await browser.close()
  try { if (server?.pid) { if (process.platform === 'win32') execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore', windowsHide: true }); else server.kill('SIGTERM') } } catch (e) {}
}
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
