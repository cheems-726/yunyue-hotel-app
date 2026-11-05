// V156 阶段一 · 前端"真打开"回归矩阵（角色 × 页面 × 弹层 ≥20 格真渲染）
// 运行：node tests/uiMatrix.mjs   （browser · 全量门禁默认包含；--fast 跳过）
//
// 背景（卡 §0）：三次"测试全绿但线上坏"（V142 域名 / V152 迁移 / V155 教师端漏 import）
//   共同点 = 没有任何套件真的渲染过那个页面。本矩阵让"渲染即抛错"必然变红。
// 每格判据：① 无页面级 JS 错（pageerror / console.error · 排除 StatusBar 插件与网络类噪声）
//           ② 出现该页特征串 ③ 页面不是整页 NaN/undefined/错误兜底
import { chromium } from 'playwright-core'
import { spawn, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { 是当前构建 } from './_previewFresh.mjs'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
let PORT = 4173, BASE = `http://localhost:${PORT}/`, server = null, 复用 = false
let pass = 0, fail = 0
const 结果行 = []
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(2) }
{
  const 有服务 = await fetch(BASE).then(r => r.ok).catch(() => false)
  复用 = 有服务 && await 是当前构建(BASE)
  if (有服务 && !复用) { for (let p = 4206; p <= 4230; p++) { if (!(await fetch(`http://localhost:${p}/`).then(() => true).catch(() => false))) { PORT = p; BASE = `http://localhost:${p}/`; break } } }
  if (!复用) server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true })
}
for (let i = 0; i < 40; i++) { if (await fetch(BASE).then(r => r.ok).catch(() => false)) break; await sleep(300) }
const browser = await chromium.launch({ executablePath: EDGE, headless: true })

// ── 通用：错误监听 + 单格断言 ────────────────────────────────────
const 噪声 = /StatusBar|Failed to load resource|WebSocket|net::E|ERR_/   // 插件/网络类：离线演示下必然出现，非页面坏
function 挂监听(page, 桶) {
  page.on('pageerror', e => { const m = e.message || ''; if (!噪声.test(m)) 桶.push('pageerror: ' + m.split('\n')[0].slice(0, 120)) })
  page.on('console', m => { if (m.type() === 'error' && !噪声.test(m.text())) 桶.push('console: ' + String(m.text()).slice(0, 120)) })
}
async function 断言格(page, 桶, { 角色, 页, 特征, 特判 }) {
  const t = await page.evaluate(() => document.body.innerText)
  const 坏文案 = ['页面出了点问题', '页面启动失败'].filter(x => t.includes(x))
  const 脏 = [t.match(/undefined/g), t.match(/NaN/g)].filter(Boolean)
  const okErr = 桶.length === 0
  const okFeat = 特征.some(f => t.includes(f)) || 特征.length === 0
  const okPage = 坏文案.length === 0 && (脏[0] ? 脏[0].length <= 2 : true) && (脏[1] ? 脏[1].length <= 2 : true)
  const okSpecial = 特判 ? await 特判(page) : true
  const 名 = `[${角色}] ${页}`
  ok(okErr && okFeat && okPage && okSpecial, 名, [...桶.slice(0, 2), okFeat ? '' : '缺特征:' + 特征.join('/'), okFeat ? '' : '[页面]' + t.replace(/\s+/g, ' ').slice(0, 160), ...坏文案, okSpecial ? '' : '特判失败'].filter(Boolean).join(' | '))
  结果行.push({ 名, ok: okErr && okFeat && okPage && okSpecial })
  桶.length = 0
}

// ── 学生端：离线演示全流程走到经营页（与 interactionV154 同路）────
async function 进经营(page) {
  const text = () => page.evaluate(() => document.body.innerText)
  const clickText = async (t, mode = 'includes') => page.evaluate(({ t, mode }) => {
    const items = [...document.querySelectorAll('button, .district-card, div, span')].filter(x => x.children.length === 0 || x.classList.contains('district-card'))
    const el = items.find(x => mode === 'exact' ? x.textContent.trim() === t : x.textContent.includes(t))
    if (el) { el.click(); return true }
    return false
  }, { t, mode })
  const clickCard = async (t) => {
    const d = await page.evaluate((t) => {
      const c = [...document.querySelectorAll('.district-card')].find(x => x.textContent.includes(t))
      if (c) { c.click(); return true }
      // ★ V187：情景卡是普通 div + onClick（无 .district-card）⇒ 找「文本以 t 开头的最内层 div」点它，冒泡到卡片
      const cands = [...document.querySelectorAll('div')].filter(x => x.textContent.trim().startsWith(t))
      const inner = cands[cands.length - 1]
      if (inner) { inner.click(); return true }
      return false
    }, t)
    if (!d) await clickText(t)
  }
  const clickBtn = async (re) => page.evaluate((src) => { const re2 = new RegExp(src); const b = [...document.querySelectorAll('button')].find(x => !x.disabled && re2.test(x.textContent)); if (b) { b.click(); return true } return false }, re.source)
  const hasOverlay = () => page.evaluate(() => !![...document.querySelectorAll('div')].find(d => d.style.position === 'fixed' && d.textContent.includes('你的选择会带来')))
  const closeOverlay = async () => { await clickText('明白了'); await sleep(250) }
  const { 过两道闸门 } = await import('./_v109-site.mjs')
  const { 过命名页 } = await import('./_v114-name.mjs')

  await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await sleep(1000)
  await clickText('我是学生'); await sleep(400)
  await clickText('离线演示'); await sleep(400)
  await clickBtn(/进入演示/); await sleep(700)
  await clickBtn(/开始我的酒店之旅/); await sleep(700)
  await page.evaluate(() => { const c = [...document.querySelectorAll('.district-card')].find(x => x.textContent.includes('锦江区')); if (c) c.click() }); await sleep(450)
  await 过两道闸门(page)
  await clickBtn(/确认选址/); await sleep(650)
  await page.evaluate(() => { const c = [...document.querySelectorAll('.district-card')].find(x => x.textContent.trim().startsWith('汉庭')); if (c) c.click() }); await sleep(450)
  await clickBtn(/确认选择/); await sleep(650)
  await page.evaluate(() => { const c = [...document.querySelectorAll('.district-card')].find(x => /OTA平台合作/.test(x.textContent)); if (c) c.click() }); await sleep(400)
  await clickBtn(/确认/); await sleep(550)
  for (let i = 0; i < 12; i++) {
    const t = await text()
    if (t.includes('门店筹建') || t.includes('云悦锦江店')) break
    const opt = page.locator('[data-claim-opt]').first()
    if (await opt.count()) { await opt.click().catch(() => {}); await sleep(250) }
    await page.evaluate(() => { const cs = [...document.querySelectorAll('.district-card')].filter(x => /物业/.test(x.textContent) && !x.getAttribute('data-claim-opt')); const c = cs.find(x => /交通枢纽/.test(x.textContent)) || cs[0]; if (c) c.click() }); await sleep(200)
    const ta = page.locator('[data-claim-reason]').first()
    if (await ta.count()) { await ta.fill('现金紧，先保开业，再逐步把品质补上。').catch(() => {}); await sleep(150) }
    await clickBtn(/确认本步取舍|完成认领|下一步|确认无误|确认/)
    await sleep(500)
  }
  await 过命名页(page, '云悦矩阵店'); await sleep(600)
  await clickBtn(/^全部$/); await sleep(350)
  await clickCard('基准情景'); await sleep(450)
  if (await hasOverlay()) await closeOverlay()
  await page.evaluate(() => { const c = document.querySelector('[data-tier="装修"][data-val="低"]'); if (c) c.click() }); await sleep(350)
  await page.evaluate(() => { const n = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('完成「投资测算」')); if (n) n.click() }); await sleep(550)
  // ★ V187 热修：V186 已禁止「圆圈前跳」（未完成步点不动）⇒ 不再点圆圈；已在目标步=空操作，否则点【下一步】
  const 步 = (t) => page.evaluate((t) => {
    const title = (document.querySelector('.card-title') && document.querySelector('.card-title').textContent) || ''
    if (title.includes(t)) return 'already'
    const b = [...document.querySelectorAll('button')].find(x => !x.disabled && /完成「|完成筹建/.test(x.textContent))
    if (b) { b.click(); return 'next' } return 'stuck'
  }, t)
  await 步('证照办理')
  for (const n of ['申领营业执照', '刻章备案', '消防检查合格证', '特种行业经营许可证', '卫生许可证', '税务申报']) {
    await clickCard(n); await sleep(350)
    if (await hasOverlay()) await closeOverlay(); else { await clickCard(n); await sleep(300); if (await hasOverlay()) await closeOverlay() }
  }
  await 步('物资采购')
  await clickCard('供应商 A'); await sleep(350); if (await hasOverlay()) await closeOverlay()
  await 步('开业计划')
  for (const n of ['装修', '系统上线', '招聘']) { await page.evaluate((n) => { const c = [...document.querySelectorAll('div')].find(x => x.style && x.style.cursor === 'pointer' && x.textContent.trim().startsWith(n)); if (c) c.click() }, n); await sleep(400); if (await hasOverlay()) await closeOverlay(); await sleep(200) }
  await clickBtn(/完成筹建/); await sleep(1200)
  if (await hasOverlay()) await closeOverlay()
  await sleep(400)
}

try {
  console.log('▶ V156 阶段一 · 真打开回归矩阵')

  // ═══ 学生 ═══
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const 桶 = []
    挂监听(page, 桶)
    await 进经营(page)
    const tab = async (label, 特征) => {
      await page.evaluate((t) => { const b = [...document.querySelectorAll('.tabbar button')].find(x => x.textContent.includes(t)); if (b) b.click() }, label)
      await sleep(650)
      // ★ V156 RV 钩子：V156_INJECT_REPORT=1 时在「报表」页抛一个真 ReferenceError（未捕获）⇒ 该格必须红
      if (process.env.V156_INJECT_REPORT === '1' && label === '报表') {
        await page.evaluate(() => { setTimeout(() => { throw new ReferenceError('undefinedVar is not defined') }, 0) })
        await sleep(400)
      }
      await 断言格(page, 桶, { 角色: '学生', 页: label, 特征 })
    }
    await 断言格(page, 桶, { 角色: '学生', 页: '经营页', 特征: ['资金状况', '本周经营中'] })
    await tab('报表', ['第 1 周', '周报', '暂无'])   // 首周空态也合法（有周报文案即可）
    await tab('口碑', ['好评率', '差评'])
    await tab('我的', ['积分与评分明细', '经营操作记录'])
    await tab('实训游戏', ['价格弹性猜数', '客房摆放'])

    // 帮助页 + 经营操作记录（先回「我的」tab；两个都是 openPage 覆盖层，各自从干净的「我的」开 ⇒ 不依赖层间返回）
    await page.evaluate((t) => { const b = [...document.querySelectorAll('.tabbar button')].find(x => x.textContent.includes(t)); if (b) b.click() }, '我的'); await sleep(650)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('玩法说明')); if (b) b.click(); else { const d = [...document.querySelectorAll('div')].filter(x => x.textContent.trim() === '玩法说明').pop(); if (d) d.click() } }); await sleep(800)
    if (process.env.V156_DEBUG) console.log('   [DBG 玩法点击后] ' + (await page.evaluate(() => document.body.innerText)).slice(0, 300).split(String.fromCharCode(10)).join(' | '))
    await 断言格(page, 桶, { 角色: '学生', 页: '帮助页', 特征: ['遇到问题先看这里', '游戏目标'] })
    { // 覆盖层返回 = <span onClick>：坐标真点
      const box = await page.evaluate(() => { const el = [...document.querySelectorAll('span')].find(x => x.textContent.trim() === '‹ 返回'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
      if (box) await page.mouse.click(box.x, box.y)
      await sleep(600)
    }
    await page.evaluate((t) => { const b = [...document.querySelectorAll('.tabbar button')].find(x => x.textContent.includes(t)); if (b) b.click() }, '我的'); await sleep(650)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('经营操作记录')); if (b) b.click(); else { const d = [...document.querySelectorAll('div')].filter(x => x.textContent.trim() === '经营操作记录').pop(); if (d) d.click() } }); await sleep(700)
    await 断言格(page, 桶, { 角色: '学生', 页: '经营操作记录', 特征: ['记录', '第', '周'] })
    { const box = await page.evaluate(() => { const el = [...document.querySelectorAll('span')].find(x => x.textContent.trim() === '‹ 返回'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }); if (box) await page.mouse.click(box.x, box.y); await sleep(600) }

    // 决策面板 ×5 类（option/slider/budget/sort/timer）
    await tab('经营', ['资金状况'])
    const 开决策 = async (名, 特征) => {
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '全部'); if (b) b.click() }); await sleep(350)
      await page.evaluate((n) => { const c = [...document.querySelectorAll('.task-card')].find(x => x.textContent.includes(n)); if (c) { c.scrollIntoView({ block: 'center' }); c.click() } }, 名)
      await sleep(700)
      await 断言格(page, 桶, { 角色: '学生', 页: `决策·${名}`, 特征 })
      await page.keyboard.press('Escape'); await sleep(350)   // Esc 返回经营页（V154批1）
    }
    await 开决策('超额预订', ['超售', '间'])
    await 开决策('前台排班', ['满编保服务', '精简省成本'])
    await 开决策('OTA优化', ['携程', '美团', '飞猪'])
    await 开决策('客房质检', ['隔音', '卫生'])
    await 开决策('应急预案', ['选择', '应对'])

    // 游戏：价格弹性（native）+ 客房摆放（iframe）
    await tab('实训游戏', ['价格弹性猜数'])
    await page.evaluate(() => { const c = [...document.querySelectorAll('.card')].find(x => x.textContent.includes('价格弹性猜数')); const b = c && [...c.querySelectorAll('button')].find(x => /开始/.test(x.textContent)); if (b) b.click() }); await sleep(650)
    await 断言格(page, 桶, { 角色: '学生', 页: '游戏·价格弹性', 特征: ['再涨 10%', '上周出租率'] })
    await page.keyboard.press('Escape'); await sleep(300)
    await page.evaluate(() => { const c = [...document.querySelectorAll('.card')].find(x => x.textContent.includes('客房摆放')); const b = c && [...c.querySelectorAll('button')].find(x => /开始/.test(x.textContent)); if (b) b.click() }); await sleep(1200)
    const 摆放ok = await page.evaluate(() => !!document.querySelector('iframe[src*="room-arrange"]'))
    ok(摆放ok, '[学生] 游戏·客房摆放 iframe 打开（src 挂载）')
    结果行.push({ 名: '[学生] 游戏·客房摆放', ok: 摆放ok })
    await page.keyboard.press('Escape'); await sleep(300)
    await page.close()
  }

  // ═══ 教师（假档 6 组 · 与 v155Verify 同法）═══
  {
    const 组 = (n, 净, occ, good) => ({
      user_id: 'uid' + n, group_key: `酒管2401|${n}`, updated_at: new Date().toISOString(),
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
    const FAKE = [1, 2, 3, 4, 5, 6].map(n => 组(n, n * 3000, 55 + n * 3, 68 + n * 2))
    const PROFILES = FAKE.map((s, i) => ({ user_id: s.user_id, role: 'student', class_name: '酒管2401', group_no: i + 1, display_name: '学生' + (i + 1) }))

    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
    const 桶 = []
    挂监听(page, 桶)
    await page.route('**/rest/v1/game_states**', r => r.fulfill({ json: FAKE }))
    await page.route('**/rest/v1/profiles**', r => r.fulfill({ json: PROFILES }))
    await page.route('**/rest/v1/teacher_notes**', r => r.fulfill({ json: [] }))
    await page.addInitScript(() => {
      const raw = window.fetch.bind(window)
      window.fetch = (input, init) => {
        const u = typeof input === 'string' ? input : (input && input.url) || ''
        if (u.includes('/health')) return Promise.reject(new TypeError('offline-test'))
        return raw(input, init)
      }
    })
    await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await sleep(700)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('我是老师')); if (b) b.click() }); await sleep(900)
    for (let i = 0; i < 10; i++) { const d = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('离线演示')); if (b) { b.click(); return true } return false }); if (d) break; await sleep(400) }
    await sleep(500)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('进入演示')); if (b) b.click() }); await sleep(1300)

    const nav = async (label, 页, 特征) => {
      await page.evaluate((t) => { const a = [...document.querySelectorAll('.t-nav a')].find(x => x.textContent.includes(t)); if (a) a.click() }, label)
      await sleep(800)
      await 断言格(page, 桶, { 角色: '教师', 页, 特征 })
    }
    await 断言格(page, 桶, { 角色: '教师', 页: '实时决策', 特征: ['本周已完成决策', '实时'] })
    await nav('排名', '排名', ['组', '评分'])
    await nav('班级总览', '班级总览', ['六组一句话', '期末成绩单'])
    await nav('事件注入', '事件注入', ['事件', '注入'])
    await nav('AI 领班', 'AI 领班', ['授权', '领班'])
    await nav('分组管理', '分组管理', ['分组', '班级'])
    await nav('教学参考', '教学参考', ['四维', '事件'])
    await nav('我的', '教师我的', ['续营', '功能入口'])

    // ★ V167§2：班级管理入口 —— 真点导航「班级管理」⇒ 面板出现 ⇒ 建班输入框在
    await page.evaluate(() => { const a = document.querySelector('[data-open-class-admin]'); if (a) a.click() }); await sleep(1000)
    await 断言格(page, 桶, { 角色: '教师', 页: '班级管理', 特征: ['班级管理（建班', '新建班级'], 特判: (page) => page.evaluate(() => !!document.querySelector('[data-class-admin-panel]') && !!document.querySelector('[data-new-class-name]')) })

    // 总览内嵌三块 + 两个覆盖层
    await page.evaluate(() => { const a = [...document.querySelectorAll('.t-nav a')].find(x => x.textContent.includes('班级总览')); if (a) a.click() }); await sleep(800)
    await 断言格(page, 桶, { 角色: '教师', 页: '学期成果并排', 特征: ['学期成果（并排', '续营净利'] })
    await 断言格(page, 桶, { 角色: '教师', 页: '班级对比', 特征: ['按经营净利排序', '不是名次'] })
    await page.evaluate(() => { const b = document.querySelector('[data-open-screen]'); if (b) b.click() }); await sleep(900)
    await 断言格(page, 桶, { 角色: '教师', 页: '课堂投屏', 特征: ['经营净利（前 12 周）', '口径 A'] })
    await page.keyboard.press('Escape'); await sleep(350)
    await page.evaluate(() => { const b = document.querySelector('[data-open-report-card]'); if (b) b.click() }); await sleep(800)
    await 断言格(page, 桶, { 角色: '教师', 页: '成绩单打印页', 特征: ['期末成绩单', '口径 A：利润 40'] })
    await page.keyboard.press('Escape'); await sleep(350)
    await page.close()
  }

  console.log(`\n矩阵覆盖 ${结果行.length} 格`)
  const 红格 = 结果行.filter(r => !r.ok)
  if (红格.length) { console.log('红格：'); 红格.forEach(r => console.log('  · ' + r.名)) }
} finally {
  await browser.close()
  try { if (server?.pid && !复用) { if (process.platform === 'win32') execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore', windowsHide: true }); else server.kill('SIGTERM') } } catch (e) {}
}
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
