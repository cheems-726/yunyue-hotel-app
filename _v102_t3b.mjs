// V102 T3 阶段B：6 个浏览器窗口并发提交一次决策（真机精简 Supabase）
// 每窗口：登录(GoTrue) → 读组档(PostgREST+RLS) → 去决策 → 选项 → 提交(落库) → 刷新回读
import { chromium } from 'playwright-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.BASE || 'http://localhost:4173/'
const N = Number(process.env.N || 6)
const PW = 'test123456'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const log = (...a) => console.log(...a)

async function rec(r, name, cond, extra = '') {
  r.steps.push({ name, pass: !!cond })
  log(`  [G${r.i}] ${cond ? '✓' : '✗'} ${name}${cond ? '' : ' ' + extra}`)
}

async function session(browser, i, phase) {
  const r = { i, steps: [], errs: [], t: {} }
  const id = `2024010${i}`
  const ctx = await browser.newContext({ viewport: { width: 480, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', e => { const m = e.message || ''; if (!m.includes('plugin is not implemented')) r.errs.push(m) })
  page.on('console', m => { if (m.type() === 'error') r.errs.push('console: ' + m.text().slice(0, 140)) })
  const T = () => Date.now()
  try {
    const t0 = T()
    await page.goto(BASE); await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => localStorage.clear())
    await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(1100)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button, span')].find(x => x.textContent.includes('我是学生')); b && b.click() })
    await sleep(400)
    const tLoginClick = T()
    await page.evaluate(({ id, pw }) => {
      const ins = [...document.querySelectorAll('input')]
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(ins[0], id); ins[0].dispatchEvent(new Event('input', { bubbles: true }))
      s.call(ins[1], pw); ins[1].dispatchEvent(new Event('input', { bubbles: true }))
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled)
      b && b.click()
    }, { id, pw: PW })

    let biz = ''
    for (let k = 0; k < 26; k++) { await sleep(500); biz = await page.evaluate(() => document.body.innerText); if (biz.includes('资金状况')) break }
    r.t.loginMs = T() - tLoginClick
    await rec(r, '登录进入经营页', biz.includes('资金状况'), biz.slice(0, 70).replace(/\n/g, '|'))
    const before = (biz.match(/已决策\s*(\d+)\s*\/\s*18/) || biz.match(/(\d+)\s*\/\s*18/) || [])[1]
    r.before = before

    // 打开决策面板（渲染竞态，重试）
    const tDecide = T()
    let panel = ''
    for (let k = 0; k < 4 && !panel; k++) {
      await page.evaluate(() => { const el = [...document.querySelectorAll('div, span')].reverse().find(x => x.textContent.trim() === '去决策'); el && el.click() })
      await sleep(900)
      const t = await page.evaluate(() => document.body.innerText)
      if (t.includes('应急预案') || t.includes('30秒') || t.includes('提交') || t.includes('确认决策') || t.includes('请先做出选择')) panel = t
    }
    await rec(r, '决策面板打开', !!panel, panel.slice(0, 70).replace(/\n/g, '|'))
    if (phase === 'probe') { r.panel = panel.slice(0, 800); await ctx.close(); return r }

    // 选一个选项：优先已知标签（getByText 命中卡片外层，点击冒泡到 onClick），回退"代价："结构
    let pick = null
    const labels = (process.env.PICK ? process.env.PICK.split(',') : ['立即送医+道歉', '先安抚再处理', '推卸责任'])
    for (const k of labels) {
      try { const loc = page.getByText(k).first(); if (await loc.count()) { await loc.click({ timeout: 2500 }); pick = 'text:' + k; break } } catch (e) {}
    }
    if (!pick) pick = await page.evaluate(() => {
      const cost = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.trim().startsWith('代价：'))
      if (cost.length) {
        let n = cost[0].parentElement, best = null
        while (n && n !== document.body) {
          if (n.tagName === 'DIV' && [...n.querySelectorAll('*')].filter(e => e.textContent.trim().startsWith('代价：')).length === 1) { best = n; break }
          n = n.parentElement
        }
        if (best) { best.click(); return 'cost-card:' + best.textContent.trim().slice(0, 16) }
      }
      return null
    })
    await sleep(600)
    // 关"预期结果"浮层
    if (await page.evaluate(() => [...document.querySelectorAll('div')].some(d => d.style.position === 'fixed' && d.textContent.includes('你的选择会带来')))) {
      await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div')].find(x => x.textContent.trim() === '明白了'); b && b.click() })
      await sleep(500)
    }
    const submitted = await page.evaluate(() => {
      const s = [...document.querySelectorAll('button')].find(b => !b.disabled && /提交|确认决策|确认/.test(b.textContent))
      if (s) { s.click(); return s.textContent.trim().slice(0, 20) } return null
    })
    r.t.decideMs = T() - tDecide
    r.pick = pick
    await rec(r, '选项+提交', !!submitted, `pick=${pick} submit=${submitted}`)
    const tSubmit = T()
    await sleep(2200)
    // 刷新回读
    await page.reload(); await page.waitForLoadState('domcontentloaded')
    let after = ''
    for (let k = 0; k < 16; k++) { await sleep(500); after = await page.evaluate(() => document.body.innerText); if (after.includes('资金状况')) break }
    const m = after.match(/已决策\s*(\d+)\s*\/\s*18/) || after.match(/(\d+)\s*\/\s*18/)
    r.after = m && m[1]
    r.t.totalMs = T() - t0
    r.t.flushMs = T() - tSubmit
    await rec(r, `刷新回读已决策 ${r.before}→${r.after}`, r.after && Number(r.after) === Number(r.before || 0) + 1, after.slice(0, 90).replace(/\n/g, '|'))
    r.biz = after.slice(0, 300)
  } catch (e) {
    r.steps.push({ name: '中断: ' + e.message, pass: false })
    log(`  [G${r.i}] ✗✗ 中断: ${e.message}`)
    log(`     栈: ${(e.stack || '').split('\n').slice(0, 3).join(' | ')}`)
  }
  await ctx.close().catch(() => {})
  return r
}

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const tAll = Date.now()
const results = await Promise.all(Array.from({ length: N }, (_, k) => session(browser, k + 1, process.env.PHASE || 'run')))
const wall = Date.now() - tAll
await browser.close()

log('\n════════ 汇总 ════════')
let pass = 0, fail = 0, errs = 0
for (const r of results) {
  const p = r.steps.filter(s => s.pass).length, f = r.steps.filter(s => !s.pass).length
  pass += p; fail += f; errs += r.errs.length
  log(`G${r.i}: ${p}✓ ${f}✗ | 登录 ${r.t.loginMs}ms · 决策 ${r.t.decideMs}ms · 刷新落库 ${r.t.flushMs}ms · 总 ${r.t.totalMs}ms | 已决策 ${r.before}→${r.after} | JS错误 ${r.errs.length}`)
  if (r.errs.length) log('   errs:', r.errs.slice(0, 2))
  if (r.panel) log('   panel:', r.panel.replace(/\n/g, ' | ').slice(0, 400))
}
log(`合计: ${pass}✓ / ${fail}✗ · JS错误 ${errs} · 总墙钟 ${wall}ms · 并发 ${N}`)
