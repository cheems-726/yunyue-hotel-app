// V104 R2 验收：IP 入口（http://121.196.196.37）手机视口端到端 + 计时（R2-c/R2-d）
// 目的：① 首页出现（不再 301）② 前端同源（API 打到 IP 而非被拦域名）③ 学生提交→教师端秒级 ④ 记三个数字
import { chromium, devices } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.BASE || 'http://121.196.196.37/'
const T = { id: process.env.T_ID || 't2025', pw: process.env.T_PW || 'test123456' }
const S = { id: process.env.STU_ID || '20240101', pw: 'test123456' }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const log = (...a) => console.log(...a)
const errs = []
const watch = (p, tag) => {
  p.on('pageerror', e => { if (!(e.message || '').includes('plugin is not implemented')) errs.push(tag + ':' + e.message) })
  p.on('console', m => { if (m.type() === 'error') errs.push(tag + ':console ' + m.text().slice(0, 120)) })
}
async function login(page, who, role) {
  await page.goto(BASE); await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => localStorage.clear())
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(1200)
  await page.evaluate(r => { const b = [...document.querySelectorAll('button, span')].find(x => x.textContent.includes(r)); b && b.click() }, role === 'teacher' ? '我是老师' : '我是学生')
  await sleep(450)
  await page.evaluate(w => {
    const ins = [...document.querySelectorAll('input')]
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(ins[0], w.id); ins[0].dispatchEvent(new Event('input', { bubbles: true }))
    s.call(ins[1], w.pw); ins[1].dispatchEvent(new Event('input', { bubbles: true }))
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled); b && b.click()
  }, who)
}

const browser = await chromium.launch({ executablePath: EDGE, headless: true })

// ── 教师端（桌面视口）：挂看板不刷新 ──
const tctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true })
const tp = await tctx.newPage(); watch(tp, 'T')
const t0 = Date.now()
await login(tp, T, 'teacher')
let ttxt = ''
for (let k = 0; k < 26; k++) { await sleep(500); ttxt = await tp.evaluate(() => document.body.innerText); if (/学生/.test(ttxt)) break }
const tTeaLogin = Date.now() - t0
await sleep(1200)
const cnt = t => (t.match(new RegExp(S.id, 'g')) || []).length
const before = cnt(await tp.evaluate(() => document.body.innerText))
log(`教师端就绪（${tTeaLogin}ms）· 降级=${/云端不可用/.test(ttxt)} · 「${S.id}」出现 ${before} 次`)

// ── 学生端（**手机视口**，模拟手机）──
const sctx = await browser.newContext({ ...devices['Pixel 7'], ignoreHTTPSErrors: true })
const sp = await sctx.newPage(); watch(sp, 'S')
const t1 = Date.now()
await login(sp, S, 'student')
let biz = ''
for (let k = 0; k < 26; k++) { await sleep(500); biz = await sp.evaluate(() => document.body.innerText); if (biz.includes('资金状况')) break }
const tStuLogin = Date.now() - t1
log(`学生端（手机视口）进入经营页 = **${tStuLogin} ms**`)

let panel = ''
for (let k = 0; k < 4 && !panel; k++) {
  await sp.evaluate(() => { const el = [...document.querySelectorAll('div, span')].reverse().find(x => x.textContent.trim() === '去决策'); el && el.click() })
  await sleep(900)
  const t = await sp.evaluate(() => document.body.innerText)
  if (/提交|确认决策|请先做出选择/.test(t)) panel = t
}
const pick = await sp.evaluate(() => {
  for (const k of ['立即送医+道歉', '先安抚再处理', '推卸责任']) {
    const el = [...document.querySelectorAll('div,button')].find(x => x.textContent.trim().startsWith(k)); if (el) { el.click(); return 'known:' + k }
  }
  const cost = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.trim().startsWith('代价：'))
  if (cost.length) {
    let n = cost[0].parentElement, best = null
    while (n && n !== document.body) { if (n.tagName === 'DIV' && [...n.querySelectorAll('*')].filter(e => e.textContent.trim().startsWith('代价：')).length === 1) { best = n; break } n = n.parentElement }
    if (best) { best.click(); return 'cost-card' }
  }
  return null
})
await sleep(600)
await sp.evaluate(() => { const b = [...document.querySelectorAll('div')].find(d => d.style.position === 'fixed' && d.textContent.includes('你的选择会带来')); const x = [...document.querySelectorAll('button,span,div')].find(y => y.textContent.trim() === '明白了'); if (b && x) x.click() })
await sleep(400)
const tSubmit = Date.now()
const sub = await sp.evaluate(() => { const s = [...document.querySelectorAll('button')].find(b => !b.disabled && /提交|确认决策|确认/.test(b.textContent)); if (s) { s.click(); return s.textContent.trim() } return null })
// 提交往返：等学生端刷新回读出现计数变化
let backMs = null
for (let k = 0; k < 60; k++) { await sleep(150); const t = await sp.evaluate(() => document.body.innerText); if (/\d+\s*\/\s*18/.test(t) && !t.includes('请先做出选择')) { backMs = Date.now() - tSubmit; break } }
log(`学生提交：pick=${pick} · submit=${sub} · 提交→回读 ≈ ${backMs === null ? '未捕获' : backMs + ' ms'}`)

// ── 教师端：看板是否秒级出现（不刷新）──
let hit = null
for (let k = 0; k < 100; k++) { await sleep(150); if (cnt(await tp.evaluate(() => document.body.innerText)) > before) { hit = Date.now(); break } }
log(hit ? `\n★ 教师端看板出现延迟（**未刷新**）= **${hit - tSubmit} ms**` : '\n✗ 15 秒内教师端未更新')
await tp.screenshot({ path: 'D:/教学app/4-审计与报告/V102-联调取证/06-IP入口教师端.png' })
await sp.screenshot({ path: 'D:/教学app/4-审计与报告/V102-联调取证/07-IP入口学生端手机.png' })
log(`\n【R2-d 数字】学生登录=${tStuLogin}ms · 提交→回读=${backMs}ms · 教师端实时=${hit ? hit - tSubmit : 'N/A'}ms · 页面JS错误=${errs.length}${errs.length ? ' ' + JSON.stringify(errs.slice(0, 3)) : ''}`)
await browser.close()
process.exit(hit ? 0 : 1)
