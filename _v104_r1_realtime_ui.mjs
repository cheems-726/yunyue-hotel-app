// V104 R1 验收·实时性端到端：学生提交决策 ⇒ **教师端看板**秒级出现（不刷新）
import { chromium } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'https://test.2026911301.xyz/'
const T = { id: 't2025', pw: 'test123456' }
const S = { id: '20240201', pw: 'test123456' }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const log = (...a) => console.log(...a)

async function login(page, who, role) {
  await page.goto(BASE); await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => localStorage.clear())
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(1200)
  await page.evaluate(r => { const b = [...document.querySelectorAll('button, span')].find(x => x.textContent.includes(r)); b && b.click() },
    role === 'teacher' ? '我是老师' : '我是学生')
  await sleep(500)
  await page.evaluate(w => {
    const ins = [...document.querySelectorAll('input')]
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(ins[0], w.id); ins[0].dispatchEvent(new Event('input', { bubbles: true }))
    s.call(ins[1], w.pw); ins[1].dispatchEvent(new Event('input', { bubbles: true }))
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled); b && b.click()
  }, who)
}

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const errs = []

// ── 教师端：登入看板并挂着（不刷新）──
const tp = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
tp.on('pageerror', e => { if (!(e.message || '').includes('plugin is not implemented')) errs.push('T:' + e.message) })
await login(tp, T, 'teacher')
let ttxt = ''
for (let k = 0; k < 26; k++) { await sleep(500); ttxt = await tp.evaluate(() => document.body.innerText); if (/学生/.test(ttxt)) break }
await sleep(1500)
const cnt = (t) => (t.match(/20240201/g) || []).length
const before = cnt(await tp.evaluate(() => document.body.innerText))
log(`教师端就绪：含「云端不可用」= ${/云端不可用/.test(ttxt)} · 学生号 20240201 出现次数 = ${before}`)

// ── 学生端：提交一次决策 ──
const sp = await (await browser.newContext({ viewport: { width: 480, height: 900 } })).newPage()
sp.on('pageerror', e => { if (!(e.message || '').includes('plugin is not implemented')) errs.push('S:' + e.message) })
await login(sp, S, 'student')
for (let k = 0; k < 24; k++) { await sleep(500); if ((await sp.evaluate(() => document.body.innerText)).includes('资金状况')) break }
let panel = ''
for (let k = 0; k < 4 && !panel; k++) {
  await sp.evaluate(() => { const el = [...document.querySelectorAll('div, span')].reverse().find(x => x.textContent.trim() === '去决策'); el && el.click() })
  await sleep(900)
  const t = await sp.evaluate(() => document.body.innerText)
  if (/提交|确认决策|请先做出选择/.test(t)) panel = t
}
const pick = await sp.evaluate(() => {
  const cost = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.trim().startsWith('代价：'))
  if (cost.length) {
    let n = cost[0].parentElement, best = null
    while (n && n !== document.body) {
      if (n.tagName === 'DIV' && [...n.querySelectorAll('*')].filter(e => e.textContent.trim().startsWith('代价：')).length === 1) { best = n; break }
      n = n.parentElement
    }
    if (best) { best.click(); return 'cost-card:' + best.textContent.trim().slice(0, 14) }
  }
  for (const k of ['立即送医+道歉', '先安抚再处理', '推卸责任']) {
    const el = [...document.querySelectorAll('div,button')].find(x => x.textContent.trim().startsWith(k))
    if (el) { el.click(); return 'known:' + k }
  }
  return null
})
await sleep(600)
await sp.evaluate(() => { const b = [...document.querySelectorAll('div')].find(d => d.style.position === 'fixed' && d.textContent.includes('你的选择会带来')); const x = [...document.querySelectorAll('button,span,div')].find(y => y.textContent.trim() === '明白了'); if (b && x) x.click() })
await sleep(400)
const tSubmit = Date.now()
const sub = await sp.evaluate(() => { const s = [...document.querySelectorAll('button')].find(b => !b.disabled && /提交|确认决策|确认/.test(b.textContent)); if (s) { s.click(); return s.textContent.trim() } return null })
log(`学生提交：pick=${pick} submit=${sub}`)

// ── 教师端轮询：看新条目何时出现（不刷新）──
let hit = null
for (let k = 0; k < 100; k++) {
  await sleep(150)
  const now = cnt(await tp.evaluate(() => document.body.innerText))
  if (now > before) { hit = Date.now(); log(`  ⇢ 教师端看板第 ${now} 次出现该学号`); break }
}
log(hit ? `\n★ 教师端看板实时出现延迟（提交→看板可见，**未刷新**）= **${hit - tSubmit} ms**` : '\n✗ 15 秒内教师端看板未更新')
await tp.screenshot({ path: 'D:/教学app/4-审计与报告/V102-联调取证/05-教师端实时.png' })
log('JS 错误: ' + errs.length + (errs.length ? ' ' + JSON.stringify(errs.slice(0, 2)) : ''))
await browser.close()
process.exit(hit ? 0 : 1)
