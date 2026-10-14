// V104 T6 验收：Realtime 端到端延迟（学生提交决策 → 教师端实时收到）
// 教师端 = 真实 Realtime postgres_changes 订阅（教师 JWT，RLS 允许读全部 decision_log）
// 学生端 = 真实浏览器（Playwright/Edge）走「去决策 → 选项 → 提交」
import { chromium } from 'playwright-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'https://test.2026911301.xyz'
const ANON = process.env.ANON
const TEACHER = { email: process.env.TEACHER_EMAIL || 't2025@yunyue.study', password: process.env.TEACHER_PW || 'test123456' }
const STUDENT = { id: process.env.STU_ID || '20240103', pw: 'test123456' }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const log = (...a) => console.log(...a)

async function login(email, password) {
  const r = await fetch(BASE + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON },
    body: JSON.stringify({ email, password }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error('教师登录失败: ' + JSON.stringify(j).slice(0, 200))
  return j.access_token
}

// ── 1. 教师端：建立真实 Realtime 订阅 ──
const ttoken = await login(TEACHER.email, TEACHER.password)
log('教师登录 ✓  JWT 长度=' + ttoken.length)

const events = []
const ws = new WebSocket(`${BASE.replace('https', 'wss')}/realtime/v1/websocket?apikey=${ANON}&vsn=1.0.0`)
const wsReady = new Promise((res, rej) => {
  ws.onopen = () => {
    ws.send(JSON.stringify({
      topic: 'realtime:v104probe', event: 'phx_join', ref: '1',
      payload: { config: { postgres_changes: [{ event: 'INSERT', schema: 'public', table: 'decision_log' }] }, access_token: ttoken },
    }))
  }
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.event === 'phx_reply' && d.ref === '1') { res(d.payload && d.payload.status); return }
    if (d.event === 'postgres_changes') {
      events.push({ t: Date.now(), rec: d.payload && d.payload.data && d.payload.data.record })
      log('  ⇢ 教师端收到实时事件，decision_id=' + (d.payload?.data?.record?.decision_id || '?'))
    }
  }
  ws.onerror = e => rej(new Error('WS 错误 ' + (e.message || e.type)))
  setTimeout(() => rej(new Error('WS join 超时')), 12000)
})
log('Realtime join: ' + (await wsReady))

// ── 2. 学生端：真实浏览器提交一次决策 ──
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 480, height: 900 } })).newPage()
const errs = []
page.on('pageerror', e => { if (!(e.message || '').includes('plugin is not implemented')) errs.push(e.message) })
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 120)) })

await page.goto(BASE + '/'); await page.waitForLoadState('domcontentloaded')
await page.evaluate(() => localStorage.clear())
await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(1200)
await page.evaluate(() => { const b = [...document.querySelectorAll('button, span')].find(x => x.textContent.includes('我是学生')); b && b.click() })
await sleep(400)
await page.evaluate(({ id, pw }) => {
  const ins = [...document.querySelectorAll('input')]
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(ins[0], id); ins[0].dispatchEvent(new Event('input', { bubbles: true }))
  s.call(ins[1], pw); ins[1].dispatchEvent(new Event('input', { bubbles: true }))
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled); b && b.click()
}, { id: STUDENT.id, pw: STUDENT.pw })
for (let k = 0; k < 24; k++) { await sleep(500); if ((await page.evaluate(() => document.body.innerText)).includes('资金状况')) break }
log('学生登录进入经营页 ✓')

let panel = ''
for (let k = 0; k < 4 && !panel; k++) {
  await page.evaluate(() => { const el = [...document.querySelectorAll('div, span')].reverse().find(x => x.textContent.trim() === '去决策'); el && el.click() })
  await sleep(900)
  const t = await page.evaluate(() => document.body.innerText)
  if (/提交|确认决策|请先做出选择/.test(t)) panel = t
}
for (const k of ['立即送医+道歉', '先安抚再处理', '推卸责任']) {
  try { const loc = page.getByText(k).first(); if (await loc.count()) { await loc.click(); break } } catch (e) {}
}
await sleep(600)
await page.evaluate(() => { const b = [...document.querySelectorAll('div')].find(d => d.style.position === 'fixed' && d.textContent.includes('你的选择会带来')); const x = [...document.querySelectorAll('button,span,div')].find(y => y.textContent.trim() === '明白了'); if (b && x) x.click() })
await sleep(400)
const tSubmit = Date.now()
const submitted = await page.evaluate(() => {
  const s = [...document.querySelectorAll('button')].find(b => !b.disabled && /提交|确认决策|确认/.test(b.textContent))
  if (s) { s.click(); return s.textContent.trim() } return null
})
log('学生提交决策 ✓  (' + submitted + ')')

// ── 3. 等实时事件到达 ──
let got = null
for (let k = 0; k < 40; k++) { if (events.length) { got = events[events.length - 1]; break } await sleep(100) }
await browser.close()
if (got) log(`\n★ 端到端实时延迟（提交→教师端收到）= **${got.t - tSubmit} ms**  （decision_id=${got.rec?.decision_id}）`)
else log('\n✗ 40 秒内未收到实时事件')
log('页面 JS 错误: ' + errs.length + (errs.length ? ' ' + JSON.stringify(errs.slice(0, 2)) : ''))
ws.close()
process.exit(got ? 0 : 1)
