// V141 · 经营表现（GOP）/ 周策略归因 / 回本折叠 / 游戏入口 / 服务端状态条
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
  await page.route('**/rest/v1/rpc/class_day_now', r => r.fulfill({ status: 200, contentType: 'application/json', body: '27' }))
  await page.goto(BASE)
  await page.evaluate(() => {
    const 周 = (week, gop, profit, pricing, shifts) => ({
      week, occupancy: 70 + week, revenue: 180000 + week * 10000, profit, gop,
      finalGoodRate: 85, negativeCount: 0, events: [], generatedReviews: [],
      decisions: { pricing, shifts, ota: { 携程: 60, 美团: 20 } },
      ...(week === 1 ? { oneTimeFees: { 合计: 608000, 保证金: 100000 } } : {}),
    })
    const st = {
      user: { role: 'student', id: '20240101', name: 'V141 学生', cloud: false },
      location: { city: '成都', district: '锦江区', attrs: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 } },
      brand: { name: '汉庭', level: '经济型 · 国民', price: '210-310元', standard: '客房70间起', rentFactor: 0.30 },
      property: { name: '交通枢纽物业' }, established: true, hotelName: '云悦V141店', welcomed: true,
      week: 5, capital: 1490000, attrs: { quality: 60, reputation: 70, morale: 65 },
      bizMode: 'direct', scaleVersion: 3, openDayNo: null, report: null, finished: false,
      decisionChanges: [], __autoSettled: [], operatorLogs: [], estChoices: {},
      doneDecisions: { pricing: '不跟降', shifts: '满编保服务' },
      history: [
        周(1, 28000, -50000, '不跟降', '满编保服务'),
        周(2, 30000, -40000, '跟降 10%', '满编保服务'),
        周(3, 32000, -30000, '不跟降', '精简省成本'),
        周(4, 32000, -30000, '不跟降', '精简省成本'),
      ],
    }
    localStorage.setItem('hotel-sim-state', JSON.stringify(st))
  })
  await page.reload(); await sleep(1800)

  console.log('▶ V141 · 经营表现 / 周策略 / 回本折叠')
  const t = await page.evaluate(() => document.body.innerText)
  ok(t.includes('云悦V141店') && t.includes('经营表现'), '进入经营页且首屏有「经营表现」')
  ok(t.includes('+12.2万') && t.includes('累计经营利润'), '累计经营利润 = +12.2万（GOP 四周和）')
  ok(t.includes('本周 -3.0万'), '本周经营净利 = -3.0万')
  ok(t.includes('第 1 周') && t.includes('第 2 周') && t.includes('第 3 周') && t.includes('第 4 周'), '12 周清单含已结算的 4 周')
  ok(t.includes('首周策略：') && t.includes('调整：') && t.includes('归因：') && /动态调价|排班策略/.test(t), '每周有「策略/调整 → 归因」且来自决策目录')
  const pay = await page.evaluate(() => { const d = document.querySelector('details[data-payback="1"]'); return d ? { open: d.open, text: d.textContent } : null })
  ok(!!pay && pay.open === false, '投资回收默认折叠')
  if (pay) ok(/一次性投入|待补/.test(pay.text) || /一次性投入/.test(t), '折叠项含一次性投入（或待补）')

  console.log('\n▶ V141 · 服务端状态条（★ V180 改：离线/演示态不显示）')
  const st = await page.evaluate(() => { const e = document.querySelector('[data-server-status="1"]'); return e ? e.innerText : '' })
  // ★ V180（2026-11-05 审查端）：本地种子是 cloud:false = 演示模式，没有服务端 ⇒ 不许显示「服务端已推进 · 第 N 周」
  //   （旧断言要求显示；实测演示模式会拿到线上 classDay，写出与存档周次矛盾的第 15 周）
  ok(st === '', `演示模式（cloud:false）不显示服务端状态条（实得「${st.slice(0, 60)}」）`)
  ok(/本周还有 \d+ 项决策待做/.test(t) || /去决策/.test(t), '改为由首屏 CTA 表达本周待办')
  ok(/本周未调整决策/.test(t), '第 4 周与上周决策相同 ⇒ 显示「未调整」')

  console.log('\n▶ V141 · 游戏入口')
  ok(await page.locator('[data-game-entry="1"]').count() === 1, '经营页有游戏入口卡')
  ok((await page.evaluate(() => [...document.querySelectorAll('.tabbar button')].some(b => b.textContent.includes('实训游戏')))), '底部 tab 文案 = 实训游戏')
  await page.locator('[data-game-entry="1"] button').click()
  await sleep(1500)
  const frame = page.frames().find(f => f.url().includes('/games/room-arrange/'))
  ok(!!frame, '点「去玩」直接进游戏 iframe（不经过列表）')
  if (frame) {
    await frame.evaluate(() => { const c = document.querySelector('.room-card'); c && c.click() })
    await sleep(500)
    const rooms = await frame.evaluate(() => document.querySelectorAll('.room-card').length)
    ok(rooms >= 7, `游戏内房型 ≥7（实得 ${rooms}）`)
  }
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('‹ 返回')); b && b.click() })
  await sleep(800)
  ok((await page.evaluate(() => document.body.innerText)).includes('经营表现'), '从游戏返回仍在经营页（不回首页）')
} finally {
  await browser.close()
  try { if (server?.pid) { if (process.platform === 'win32') execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore', windowsHide: true }); else server.kill('SIGTERM') } } catch (e) {}
}
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
