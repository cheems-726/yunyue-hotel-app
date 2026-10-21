// V135 §1-2 · V99 空态逐面：新档（无 history/report）下各页不白屏
// 运行：node tests/emptyState.test.mjs（浏览器档；自起 preview 复用 4173）
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const BASE = 'http://localhost:4173/'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
let up = await fetch(BASE).then(r => r.ok).catch(() => false)
if (!up) { spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true }); for (let i = 0; i < 40 && !up; i++) { await sleep(300); up = await fetch(BASE).then(r => r.ok).catch(() => false) } }
if (!up) { console.error('✗ 预览未启动'); process.exit(2) }
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 480, height: 900 } })).newPage()
try {
  await page.goto(BASE)
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('hotel-sim-state', JSON.stringify({
      user: { role: 'student', id: '20240109', name: '空态学生', cloud: false },
      location: { city: '成都', district: '锦江区', attrs: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 } },
      brand: { name: '汉庭', level: '经济型 · 国民', price: '210-310元', standard: '客房70间起', rentFactor: 0.5 },
      property: { name: '交通枢纽物业' }, established: true, hotelName: '空态店', welcomed: true,
      week: 1, history: [], doneDecisions: {}, capital: 1490000, attrs: { quality: 60, reputation: 70, morale: 65 },
      bizMode: 'direct', scaleVersion: 3, openDayNo: null, report: null, finished: false, decisionChanges: [], __autoSettled: [], operatorLogs: [], estChoices: {},
    }))
  })
  await page.reload(); await sleep(1500)
  ok((await page.evaluate(() => document.body.innerText)).includes('空态店'), '空档进入经营页')
  for (const 名 of ['报表', '口碑', '我的', '游戏']) {
    await page.evaluate((n) => { const b = [...document.querySelectorAll('.tabbar button')].find(x => x.textContent.includes(n)); b && b.click() }, 名)
    await sleep(700)
    const t = await page.evaluate(() => document.body.innerText)
    ok(t.trim().length > 30 && !/页面出了点问题/.test(t), `空态·${名}：非白屏、无错误页（${t.trim().length} 字）`)
  }
} catch (e) { console.error('✗ ' + e.message); fail++ } finally { await browser.close() }
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
