// V155 §3 · 打印页 A4 + 投屏 1920 真截图 + DOM 结构断言（不靠肉眼）
// 运行：node tests/v155Verify.test.mjs   （浏览器套件 · 全量门禁；产物截图存 4-审计与报告/验收截图-V155/）
// 数据：拦截 /rest/v1/* 用 6 组假档（确定性 · 不依赖云端）；组件/页面是真渲染 ⇒ 截图 = 真截图。
import { readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { spawn, execSync } from 'node:child_process'
import { 是当前构建 } from './_previewFresh.mjs'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
let PORT = 4173, BASE = `http://localhost:${PORT}/`, server = null, 复用 = false
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const SHOT_DIR = join(process.cwd(), '..', '4-审计与报告', '验收截图-V155')
if (!existsSync(SHOT_DIR)) mkdirSync(SHOT_DIR, { recursive: true })

// 6 组假档（前 12 周 · 各组净利/出租率/好评率不同 ⇒ 截图能看出差异）
const 组 = (n, 净, occ, good) => ({
  user_id: 'uid' + n, group_key: `酒管2401|${n}`, updated_at: new Date().toISOString(),   // group_key 必须与 组键(profile)=班级|组号 一致（rosterIntegrity）
  state: {
    hotelName: `云悦·${n}号店`, capital: 1500000 + n * 10000,
    history: Array.from({ length: 12 }, (_, i) => ({
      week: i + 1, revenue: 90000 + n * 2000, netProfit: 净 + (i % 3) * 1500, profit: 净 + (i % 3) * 1500,
      occupancy: occ + (i % 4), finalGoodRate: good + (i % 5), negativeCount: i % 2,
      handleStats: { pending: 1, resolved: 1 }, decisions: { pricing: '不跟降' }, events: [],
      gop: 40000 + n * 1000, rentCost: 19600,
      oneTimeFees: i === 0 ? { 合计: 349000, 开业费用: 349000, 保证金: 100000 } : undefined,
    })),
    doneDecisions: { pricing: '不跟降' }, attrs: { quality: 60, reputation: 70, morale: 65 },
  },
})
const FAKE_STATES = [1, 2, 3, 4, 5, 6].map(n => 组(n, n * 3000, 55 + n * 3, 68 + n * 2))
const FAKE_PROFILES = FAKE_STATES.map((s, i) => ({ user_id: s.user_id, role: 'student', class_name: '酒管2401', group_no: i + 1, display_name: '学生' + (i + 1) }))

if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(2) }
{
  const 有服务 = await fetch(BASE).then(r => r.ok).catch(() => false)
  复用 = 有服务 && await 是当前构建(BASE)
  if (有服务 && !复用) { for (let p = 4206; p <= 4230; p++) { if (!(await fetch(`http://localhost:${p}/`).then(() => true).catch(() => false))) { PORT = p; BASE = `http://localhost:${p}/`; break } } }
  if (!复用) server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true })
  console.log(复用 ? '▶ 复用常驻 4173' : '▶ 自起预览 ' + PORT)
}
for (let i = 0; i < 40; i++) { if (await fetch(BASE).then(r => r.ok).catch(() => false)) break; await sleep(300) }
const browser = await chromium.launch({ executablePath: EDGE, headless: true })

try {
  // ===== ① 打印页 A4（print 媒体仿真 + 真截图）=====
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })   // 大屏（.t-nav 存在）· A4 布局由 emulateMedia(print) 驱动
    // 预检三入口全探不通 ⇒「先用离线演示」按钮出现（stub fetch 比路由更早、更可靠）
    await page.addInitScript(() => {
      const raw = window.fetch.bind(window)
      window.fetch = (input, init) => {
        const u = typeof input === 'string' ? input : (input && input.url) || ''
        if (u.includes('/health')) return Promise.reject(new TypeError('offline-test: health blocked'))
        return raw(input, init)
      }
    })
    await page.route('**/rest/v1/game_states**', r => { if (process.env.V155_DEBUG) console.log('   [DBG route] game_states 命中'); return r.fulfill({ json: FAKE_STATES }) })
    await page.route('**/rest/v1/profiles**', r => r.fulfill({ json: FAKE_PROFILES }))
    await page.route('**/rest/v1/teacher_notes**', r => r.fulfill({ json: [] }))


    await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await sleep(700)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('我是老师')); if (b) b.click() }); await sleep(900)   // 等预检横幅（onDemo 挂上才有点）
    for (let i = 0; i < 10; i++) {
      const 点了 = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('离线演示')); if (b) { b.click(); return true } return false })
      if (点了) break
      await sleep(400)
    }
    await sleep(500)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('进入演示')); if (b) b.click() }); await sleep(1200)
    // 班级总览 → 期末成绩单 → 打印页
    await page.evaluate(() => {
      const a = [...document.querySelectorAll('.t-nav a')].find(x => x.textContent.includes('班级总览'))
      if (a) { a.click(); return }
      const me = [...document.querySelectorAll('button, a, div')].find(x => x.textContent.trim() === '我的'); if (me) me.click()
    }); await sleep(500)
    await page.evaluate(() => {
      const a = [...document.querySelectorAll('.t-nav a')].find(x => x.textContent.includes('班级总览'))
      if (a) { a.click(); return }
      const ds = [...document.querySelectorAll('div')].filter(x => x.textContent.includes('班级总览 & 教学进度控制')); const b = ds[ds.length - 1]; if (b) b.click()   // 最内层 = 带 onClick 的入口行
    }); await sleep(700)
    await page.evaluate(() => { const b = document.querySelector('[data-open-report-card]'); if (b) b.click() }); await sleep(700)
    const 在 = await page.evaluate(() => !!document.querySelector('.rc-page'))
    ok(在, '① 打印页已打开（.rc-page）')
    // DOM 断言（不靠肉眼）
    const dom = await page.evaluate(() => {
      const rows = document.querySelectorAll('.rc-table tbody tr').length
      const 口径 = document.querySelector('[data-caliber-a]')?.textContent || ''
      const noprint = document.querySelector('.rc-noprint')
      return { rows, 口径A文本: 口径, 口径A: /口径 A：利润 40\/口碑 25\/出租率 20\/差评处理率 15/.test(口径), noprint存在: !!noprint, 表头: document.querySelector('.rc-table thead th')?.textContent || '' }
    })
    ok(dom.rows === 6, `① 打印页六行成绩单（${dom.rows}）`)
    ok(/利润 40 \/ 口碑 25 \/ 出租率 20 \/ 差评处理率 15/.test(dom.口径A文本), '① 页眉含「口径 A：利润 40 / 口碑 25 / 出租率 20 / 差评处理率 15」（data-caliber-a）')
    // print 媒体仿真：工具条必须消失（A4 无截断的机制层）+ 截图
    await page.emulateMedia({ media: 'print' })
    await sleep(200)
    const 打印态 = await page.evaluate(() => {
      const n = document.querySelector('.rc-noprint')
      return { 工具条隐藏: !n || getComputedStyle(n).display === 'none', 表格高: Math.round(document.querySelector('.rc-table').getBoundingClientRect().height), 字号: getComputedStyle(document.querySelector('.rc-table')).fontSize }
    })
    ok(打印态.工具条隐藏, '① @media print 下工具条隐藏（rc-noprint 生效）')
    ok(parseFloat(打印态.字号) >= 11 * (96 / 72) - 0.5, `① 打印字号 ≥11pt（${打印态.字号}）`)
    await page.screenshot({ path: join(SHOT_DIR, '成绩单打印页-A4.png'), fullPage: true })
    ok(existsSync(join(SHOT_DIR, '成绩单打印页-A4.png')), '① 真截图已存：验收截图-V155/成绩单打印页-A4.png')
    await page.emulateMedia({ media: 'screen' })
    await page.close()
  }

  // ===== ② 投屏视图 1920×1080（真截图 + DOM 断言）=====
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })


    // 预检三入口全探不通 ⇒「先用离线演示」按钮出现（stub fetch 比路由更早、更可靠）
    await page.addInitScript(() => {
      const raw = window.fetch.bind(window)
      window.fetch = (input, init) => {
        const u = typeof input === 'string' ? input : (input && input.url) || ''
        if (u.includes('/health')) return Promise.reject(new TypeError('offline-test: health blocked'))
        return raw(input, init)
      }
    })
    await page.route('**/rest/v1/game_states**', r => { if (process.env.V155_DEBUG) console.log('   [DBG route] game_states 命中'); return r.fulfill({ json: FAKE_STATES }) })
    await page.route('**/rest/v1/profiles**', r => r.fulfill({ json: FAKE_PROFILES }))
    await page.route('**/rest/v1/teacher_notes**', r => r.fulfill({ json: [] }))
    await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await sleep(700)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('我是老师')); if (b) b.click() }); await sleep(400)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('离线演示')); if (b) b.click() }); await sleep(400)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('进入演示')); if (b) b.click() }); await sleep(900)
    await page.evaluate(() => {
      // ★ 投屏入口在总览页：先到总览（t-nav a）再点 data-open-screen
      const a = [...document.querySelectorAll('.t-nav a')].find(x => x.textContent.includes('班级总览'))
      if (a) { a.click(); return true }
      const me = [...document.querySelectorAll('.tabbar button, button')].find(x => x.textContent.includes('我的')); if (me) me.click(); return false
    }); await sleep(600)
    await page.evaluate(() => {
      const a = [...document.querySelectorAll('.t-nav a')].find(x => x.textContent.includes('班级总览'))
      if (a) { a.click(); return true }
      const ds = [...document.querySelectorAll('div')].filter(x => x.textContent.includes('班级总览 & 教学进度控制')); const b = ds[ds.length - 1]; if (b) { b.click(); return true } return false
    }); await sleep(800)
    const 开屏 = await page.evaluate(() => { const b = document.querySelector('[data-open-screen]'); if (b) { b.click(); return true } return false })
    if (process.env.V155_DEBUG && !开屏) console.log('   [DBG screen按钮缺失] ' + (await page.evaluate(() => document.body.innerText)).slice(0, 200).split(String.fromCharCode(10)).join(' | '))
    await sleep(900)
    const dom = await page.evaluate(() => {
      const tiles = [...document.querySelectorAll('[data-screen-tile]')]
      const name = tiles[0]?.querySelector('.cs-name')
      const root = document.querySelector('[data-classroom-screen]')
      const bg = root ? getComputedStyle(root).backgroundColor : 'none'
      const 文本 = document.body.innerText
      // 扫描前剥掉【声明句】（"不是名次，无第 1 名"本就是"不排名"的说明，非排名本身 —— 与 classroomPack.test 同款口径）
      const 净文本 = 文本.replace(/不是名次，无第 1 名|只排序，不排名|无排名字段/g, '')
      const m2 = /第 1 名|名次[:：]/.exec(净文本)
      const 命中 = m2 ? m2[0] : ''
      const ctx = m2 ? JSON.stringify(净文本.slice(Math.max(0, m2.index - 80), m2.index + 80)) : ''
      return { 组数: tiles.length, 字号: name ? getComputedStyle(name).fontSize : null, bg, 命中, ctx, 深色: bg === 'rgb(16, 17, 20)' }
    })
    ok(dom.组数 === 6, `② 投屏六组 tile 都在（${dom.组数}）`)
    ok(dom.字号 && parseFloat(dom.字号) >= 20, `② 组名字号 ≥20px（${dom.字号}）`)
    ok(dom.深色, `② 深色底（${dom.bg}）`)
    if (dom.命中 && process.env.V155_DEBUG) { const i = 文本dummy } 
    ok(!dom.命中, `② 全屏无「第 1 名/名次：」字样（${dom.命中 ? '命中上下文: ' + dom.ctx : '文本扫描通过'}）`)
    await page.screenshot({ path: join(SHOT_DIR, '投屏视图-1920.png') })
    ok(existsSync(join(SHOT_DIR, '投屏视图-1920.png')), '② 真截图已存：验收截图-V155/投屏视图-1920.png')
    // 班级对比表文本扫描（总览内嵌）
    await page.evaluate(() => { const b = document.querySelector('.cs-exit'); if (b) b.click() }); await sleep(400)
    const 对比 = await page.evaluate(() => {
      const el = document.querySelector('[data-classroom-compare]')
      const 文本 = el ? el.textContent : ''
      const 净文本 = 文本.replace(/不是名次，无第 1 名|只排序，不排名/g, '')
      return { 在: !!el, 排序钮: document.querySelectorAll('[data-compare-metric]').length, 文本, 命中: (/第 1 名/.exec(净文本) || [])[0] || '' }
    })
    ok(对比.在 && 对比.排序钮 >= 6, `② 班级对比表在位 + 指标切换 ≥6（${对比.排序钮}）`)
    ok(!对比.命中, `② 对比表无「第 1 名」（文本扫描${对比.命中 ? ' · 命中：' + 对比.命中 : ''}）`)
    await page.close()
  }
} finally {
  await browser.close()
  try { if (server?.pid && !复用) { if (process.platform === 'win32') execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore', windowsHide: true }); else server.kill('SIGTERM') } } catch (e) {}
}
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
