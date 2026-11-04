// V178 · 归档班的「服务端状态条」不许自相矛盾（审查端 2026-11-04）
// 现场：线上归档班学生端 首屏写「第 12 周」，下面状态条写「● 服务端已推进 · 第 15 周第 2/7 天」
//   ⇒ 同一屏两个周次，老师一看就以为坏了（classDay 由 start_date+offset 算，归档后已无意义）
// 判据：
//   [1] 源码：状态条必须有归档分支（文案「学期已归档 · 服务端不再推进」· data-server-archived）
//   [2] 源码：「已结算 / 已达门槛 / 周天」都被归档分支挡住（不许只改一半）
//   [3] DOM（running）：行为零变化 —— 仍显示 服务端已推进 + 第 N 周第 D/7 天 + 门槛说明
//   [4] DOM（归档）：状态条若存在，必须 data-server-archived=1 且不含「第 N 周第 D/7 天」
//       —— 本地 cloud:false 会落到「周结算页」（无状态条）⇒ 存在才判；归档态真实渲染由审查端线上实测取证
//          （4-审计与报告/验收-全链路-20261104/L1-账号矩阵.md），不假装本地覆盖。
//   RV：把 data-server-archived 分支去掉（回到一律「服务端已推进」）⇒ [1][2] 必红
import { chromium } from 'playwright-core'
import { spawn, execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const APP = 'D:/教学app/hotel-app/'
let PORT = 4173
let BASE = `http://localhost:${PORT}/`
let server = null
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const sleep = ms => new Promise(r => setTimeout(r, ms))

if (!existsSync(APP + 'dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(2) }

const src = readFileSync(APP + 'src/App.jsx', 'utf8')
console.log('▶ V178 · 归档班状态条')

console.log('\n[1] 源码：归档分支存在且是同一处三元')
{
  ok(/data-server-archived=\{学期已停 \? '1' : '0'\}/.test(src), '状态条带 data-server-archived 标记（可被断言定位）')
  ok(/学期已停 \? '● 学期已归档 · 服务端不再推进' : '● 服务端已推进'/.test(src), '归档/运行两套文案在同一处三元（不可只改一半）')
  ok(/const 学期已停 = 班级学期状态 !== 'running'/.test(src), '分支条件 = 班级学期状态 !== running')
}

console.log('\n[2] 源码：「已结算 / 已达门槛 / 周天」都被归档分支挡住')
{
  ok(/\{!学期已停 && 已结算 &&/.test(src), '「本周已结算」被 !学期已停 挡住')
  ok(/\{!学期已停 && !已结算 && doneCount >= 阈 &&/.test(src), '「已达结算门槛」被 !学期已停 挡住')
  ok(/\{!学期已停 && <span> · 第 \{wd\.week\} 周第 \{wd\.dayIndex\}\/7 天/.test(src), '服务端周/天被 !学期已停 挡住')
}

if (!(await fetch(BASE).then(r => r.ok).catch(() => false))) {
  for (let p = 4206; p <= 4230; p++) {
    if (!(await fetch(`http://localhost:${p}/`).then(() => true).catch(() => false))) { PORT = p; BASE = `http://localhost:${p}/`; break }
  }
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true })
}
for (let i = 0; i < 40; i++) { if (await fetch(BASE).then(r => r.ok).catch(() => false)) break; await sleep(300) }

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
async function 渲染({ 状态, classDay }) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.route('**/rest/v1/rpc/class_day_now', r => r.fulfill({ status: 200, contentType: 'application/json', body: String(classDay) }))
  await page.route('**/rest/v1/class_state**', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: 1, class_code: '酒管2401', semester_status: 状态, current_week: 12, start_date: '2026-10-19', teacher_offset_days: 83 }]),
  }))
  await page.goto(BASE)
  await page.evaluate(() => {
    const 周 = (week) => ({ week, occupancy: 70, revenue: 180000, profit: -20000, gop: 20000, finalGoodRate: 85, negativeCount: 0, events: [], generatedReviews: [], decisions: {}, capital: 1163122 })
    const st = {
      user: { role: 'student', id: '20240101', name: 'V178 学生', cloud: false, class_name: '酒管2401', group_no: 1 },
      location: { city: '成都', district: '锦江区', attrs: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 } },
      brand: { name: '汉庭', level: '经济型 · 国民', price: '210-310元', standard: '客房70间起', rentFactor: 0.30 },
      property: { name: '交通枢纽物业' }, established: true, hotelName: '云悦V178店', welcomed: true,
      week: 12, capital: 1163122, attrs: { quality: 60, reputation: 70, morale: 65 },
      bizMode: 'direct', scaleVersion: 3, openDayNo: null, report: null, finished: false,
      decisionChanges: [], __autoSettled: [], operatorLogs: [], estChoices: {}, doneDecisions: {},
      history: Array.from({ length: 12 }, (_, i) => 周(i + 1)),
    }
    localStorage.setItem('hotel-sim-state', JSON.stringify(st))
  })
  await page.reload()
  await sleep(2200)
  const el = page.locator('[data-server-status="1"]').first()
  const 有 = await el.count() > 0
  return { page, 有, 文本: 有 ? await el.innerText() : '', 归档标记: 有 ? await el.getAttribute('data-server-archived') : null }
}

try {
  console.log('\n[3] DOM（cloud:false / 演示态）：不显示服务端状态条（V180）')
  {
    // 演示态没有服务端；旧实现仍拿 classDay（线上第 15 周）⇒ 与存档周次矛盾。running 分支的源码断言见 [1][2]。
    const { page, 有 } = await 渲染({ 状态: 'running', classDay: 20 })
    ok(!有, `演示态无状态条（实得 ${有}）`)
    await page.close()
  }

  console.log('\n[4] DOM（归档）：若状态条存在，不许出现服务端周/天')
  {
    const { page, 有, 文本, 归档标记 } = await 渲染({ 状态: 'archived', classDay: 98 })
    if (!有) {
      ok(true, '本地 cloud:false 落到周结算页、无状态条 ⇒ 不判（线上渲染由实测取证）')
    } else {
      ok(归档标记 === '1', `data-server-archived=1（实得 ${归档标记}）`)
      ok(/学期已归档/.test(文本), `文案含「学期已归档」（实得：${文本.slice(0, 60)}）`)
      ok(!/第\s*\d+\s*周第\s*\d+\/7\s*天/.test(文本), '不再显示服务端周/天（避免与存档 week 冲突）')
      ok(!/服务端已推进/.test(文本), '不再说「服务端已推进」')
    }
    await page.close()
  }

  console.log('\n[5] V180 · 离线演示（cloud:false）不显示「服务端已推进」')
  {
    // 离线演示：数据只存本机，没有服务端；旧实现仍拿 classDay（线上第 15 周）⇒ 演示学生第 1 周却看到第 15 周
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.route('**/rest/v1/rpc/class_day_now', r => r.fulfill({ status: 200, contentType: 'application/json', body: '98' }))
    await page.goto(BASE)
    await page.evaluate(() => {
      const st = {
        user: { role: 'student', id: 'offline', name: '离线', cloud: false },
        location: { city: '成都', district: '锦江区', attrs: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 } },
        brand: { name: '汉庭', level: '经济型 · 国民', price: '210-310元', standard: '客房70间起', rentFactor: 0.30 },
        property: { name: '交通枢纽物业' }, established: true, hotelName: '云悦离线店', welcomed: true,
        week: 1, capital: 1490000, attrs: { quality: 60, reputation: 70, morale: 65 },
        bizMode: 'direct', scaleVersion: 3, openDayNo: null, report: null, finished: false,
        decisionChanges: [], __autoSettled: [], operatorLogs: [], estChoices: {}, doneDecisions: {}, history: [],
      }
      localStorage.setItem('hotel-sim-state', JSON.stringify(st))
    })
    await page.reload(); await sleep(2200)
    const 有 = await page.locator('[data-server-status="1"]').count()
    const t = await page.evaluate(() => document.body.innerText)
    ok(有 === 0, `离线演示无服务端状态条（实得 ${有}）`)
    ok(!/服务端已推进/.test(t), '离线演示不再写「服务端已推进」')
    ok(/演示模式/.test(t), '仍标明演示模式（数据不上云）')
    await page.close()
  }
} finally {
  await browser.close()
  try { if (server?.pid) execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore', windowsHide: true }) } catch (e) {}
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
