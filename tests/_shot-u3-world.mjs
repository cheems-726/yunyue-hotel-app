// §32-U4-§1③ 学生可见面取证（U3 世界层 + 后续 R6/R4 复用）
//   · 周报「🌤 本周外部环境」卡 + 决策复盘（世界层行）—— 元素级截图（不受滚动位置影响）
//   · 认领页「平台规则」（OTA 卡片内）
//   · 顺带读「日报与周报对账」提示行（如实记录，不隐藏）
//   用法：node tests/_shot-u3-world.mjs [输出目录]
import { chromium } from 'playwright-core'
import { spawn, execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4173
const BASE = `http://localhost:${PORT}/`
const 输出目录 = process.argv[2] || 'D:/教学app/4-审计与报告/证据-U4'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const { settle } = await import('../src/settlement.js')
const { decisions: 全部决策 } = await import('../src/decisions.js')
const { SCALE } = await import('../src/stateMigration.mjs')

const 品牌 = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const 场 = { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3, city: '成都', district: '武侯区' }
// ★ 用【全 18 项】决策（贴近真实班级存档 ∨ 只填 7 项会让自动补算出怪数）
const 决策 = {}
for (const d of 全部决策) {
  if (d.type === 'budget' || d.type === 'sort' || d.type === 'timer') continue   // 形状特殊的类型不合成（避免触发器迁移/面板异常）
  const o = Array.isArray(d.options) && d.options.length ? d.options[0] : null
  决策[d.id] = o ? (typeof o === 'string' ? o : o.label) : (d.type === 'slider' ? (d.min ?? 0) : null)
}
let attrs = { quality: 60, reputation: 70, morale: 65 }, capital = null
const history = []
for (let w = 1; w <= 2; w++) {
  const r = settle({ site: 场, brand: 品牌, decisions: 决策, week: w, attrs: { ...attrs }, prevCapital: capital })
  history.push(r); capital = r.capital; attrs = r.attrsAfter
}
// ★ week 与 history 保持一致（week = 已结算 + 1）⇒ 不触发自动补算，页面展示的就是这份存档
const 周报档 = {
  user: { role: 'student', id: 'demo-u3', name: '验收同学', cloud: false, groupNo: null, className: null, groupRole: null },
  location: 场, brand: 品牌, property: { name: '社区旁物业', type: '社区型', area: '2600㎡', rooms: '80间', rent: '中等', match: '高' },
  established: true, estChoices: { invest: '基准情景', supplier: '供应商 B：指定供应商', opening: ['装修', '系统上线', '招聘'] },
  doneDecisions: 决策, report: history[1], week: 2, history, finished: false, welcomed: true, attrs, capital, bizMode: 'ota', scaleVersion: SCALE.VERSION_CURRENT,
}
// 认领阶段存档（选模式那一步）
const 认领档 = {
  user: { role: 'student', id: 'demo-claim', name: '验收同学', cloud: false },
  location: 场, brand: null, property: null, established: false, week: 1, history: [], scaleVersion: SCALE.VERSION_CURRENT,
}
mkdirSync(输出目录, { recursive: true })

const 复用 = await fetch(BASE).then(r => r.ok).catch(() => false)
let server = null
if (!复用) {
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true })
  for (let i = 0; i < 40; i++) { try { const x = await fetch(BASE); if (x.ok) break } catch (e) {} await sleep(300) }
}
let browser
const 截元素 = async (page, 包含文本, 路径, 标签) => {
  const h = await page.evaluateHandle((t) => {
    const 节点 = [...document.querySelectorAll('div')].filter(x => x.textContent.includes(t))
    // 取【最小】的那个容器（自身文本最短 = 最贴近该卡片）
    return 节点.sort((a, b) => a.textContent.length - b.textContent.length)[0] || null
  }, 包含文本)
  const el = h.asElement()
  if (!el) { console.log(`  ✗ 未找到「${包含文本}」（${标签}）`); return false }
  await el.scrollIntoViewIfNeeded()
  await sleep(300)
  await el.screenshot({ path: 路径 })
  console.log(`  ✓ ${标签} → ${路径}`)
  return true
}
try {
  browser = await chromium.launch({ executablePath: EDGE, headless: true })

  // ① 周报（世界层卡 + 复盘）
  const page = await (await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage()
  const 异常 = []
  page.on('pageerror', e => { if (!/plugin is not implemented/.test(e.message || '')) 异常.push(e.message) })
  await page.goto(BASE); await page.waitForLoadState('domcontentloaded'); await sleep(900)
  await page.evaluate(s => { localStorage.clear(); localStorage.setItem('hotel-sim-state', s) }, JSON.stringify(周报档))
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(2600)
  for (const 文案 of ['经营周报', '周报']) {
    const 点了 = await page.evaluate(t => { const el = [...document.querySelectorAll('button, span, div')].find(x => x.textContent.trim() === t); if (el) { el.click(); return true } return false }, 文案)
    if (点了) break
  }
  await sleep(1200)
  const 全文 = await page.evaluate(() => document.body.innerText)
  const 对账行 = (全文.split('\n').find(l => /对不上|7 天合计/.test(l)) || '（未出现）')
  console.log(`  ⓘ 日报与周报对账提示：${对账行}`)
  await 截元素(page, '本周外部环境', `${输出目录}/U3-周报-本周外部环境卡.png`, '周报·本周外部环境卡')
  await 截元素(page, '决策复盘', `${输出目录}/U3-周报-决策复盘.png`, '周报·决策复盘')

  // ② 认领页平台规则
  const p2 = await (await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage()
  p2.on('pageerror', e => { if (!/plugin is not implemented/.test(e.message || '')) 异常.push(e.message) })
  await p2.goto(BASE); await p2.waitForLoadState('domcontentloaded'); await sleep(900)
  await p2.evaluate(s => { localStorage.clear(); localStorage.setItem('hotel-sim-state', s) }, JSON.stringify(认领档))
  await p2.reload(); await p2.waitForLoadState('domcontentloaded'); await sleep(2600)
  console.log("  ⓘ 认领档按钮：", JSON.stringify(await p2.evaluate(() => [...document.querySelectorAll("button")].map(b => b.textContent.trim()).filter(Boolean).slice(0, 12))))
  console.log("  ⓘ 认领档关键文本：", JSON.stringify((await p2.evaluate(() => document.body.innerText)).split("
").slice(0, 10)))
  await 截元素(p2, '平台规则（会真实生效）', `${输出目录}/U3-认领页-平台规则.png`, '认领页·平台规则')
  console.log(`  ⓘ 页面 JS 异常：${异常.length ? 异常.slice(0, 2).join(' / ') : '无'}`)
} finally {
  try { await browser?.close() } catch (e) {}
  if (server?.pid && !复用) { try { execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore', windowsHide: true }) } catch (e) {} }
}
