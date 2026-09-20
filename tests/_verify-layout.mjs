// 第1步验证：布局断链修复 —— 几何断言（非截图目测）
// 覆盖：4个主tab + 4个子页面，各自断言 tabbar 在视口内 + .content 溢出时可滚动
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require2 = createRequire(import.meta.url)
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:4173/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const fx12 = readFileSync(new URL('./_fixture12w.json', import.meta.url), 'utf8')

const results = []
const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond }); console.log(`  ${cond ? '✓' : '✗'} ${name}${cond ? '' : '  [' + extra + ']'}`) }

// 页面探测：tabbar 可见性 + content 滚动能力（真实滚动测试，非只看 scrollHeight）
const PROBE = () => {
  const tb = document.querySelector('.tabbar')
  const c = document.querySelector('.content')
  const rect = tb ? tb.getBoundingClientRect() : null
  let scrollTest = 'no-content'
  let overflow = false
  if (c) {
    overflow = c.scrollHeight > c.clientHeight + 1
    if (overflow) {
      const b0 = c.scrollTop
      c.scrollTop = 250
      scrollTest = c.scrollTop > 0
      c.scrollTop = b0
    } else scrollTest = 'not-overflowing'
  }
  return {
    innerH: window.innerHeight,
    tabbar: rect ? { top: Math.round(rect.top), bottom: Math.round(rect.bottom) } : null,
    tabbarInViewport: rect ? (rect.bottom <= window.innerHeight + 1 && rect.top > 0) : false,
    tabbarCheckVisibility: tb ? tb.checkVisibility() : false,
    content: c ? { boxH: Math.round(c.getBoundingClientRect().height), scrollH: c.scrollHeight, overflow } : null,
    scrollTest,
  }
}

let browser, server
try {
  server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore', shell: true, detached: true })
  for (let i = 0; i < 40; i++) { try { const x = await fetch(BASE); if (x.ok) break } catch (e) {} await sleep(300) }
  browser = await chromium.launch({ executablePath: EDGE, headless: true })
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  page.on('dialog', d => d.accept())
  await page.goto(BASE); await page.waitForLoadState('domcontentloaded'); await sleep(800)
  await page.evaluate(f => { localStorage.clear(); localStorage.setItem('hotel-sim-state', f) }, fx12)
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(2600)

  const goTab = async label => {
    await page.evaluate(t => { const b = [...document.querySelectorAll('.tab')].find(x => x.textContent.includes(t)); b && b.click() }, label)
    await sleep(900)
  }
  const check = async label => {
    const p = await page.evaluate(PROBE)
    ok(`【${label}】导航栏在视口内 (top=${p.tabbar ? p.tabbar.top : 'n/a'} bottom=${p.tabbar ? p.tabbar.bottom : 'n/a'} / 视口${p.innerH})`, p.tabbarInViewport)
    ok(`【${label}】checkVisibility() 为 true`, p.tabbarCheckVisibility)
    if (p.content) {
      if (p.content.overflow) ok(`【${label}】内容溢出可实际滚动 (boxH=${p.content.boxH} scrollH=${p.content.scrollH})`, p.scrollTest === true)
      else ok(`【${label}】内容未溢出（无需滚动, boxH=${p.content.boxH}）`, true)
    }
    return p
  }

  console.log('\n▶ 主 tab 遍历（12周存档 · 412×915）')
  const pBiz = await check('经营')
  await goTab('报表'); await check('报表')
  await goTab('口碑'); await check('口碑')
  await goTab('我的'); await check('我的')

  console.log('\n▶ "我的"页 4 个子页面')
  for (const [label, txt] of [['经营操作记录', '经营操作记录'], ['积分与评分明细', '积分与评分明细'], ['小组成员', '小组成员'], ['玩法说明', '玩法说明']]) {
    await goTab('我的')
    await page.evaluate(t => { const el = [...document.querySelectorAll('div')].filter(x => x.textContent.trim().startsWith(t)); const inner = el.reverse().find(x => !el.some(y => y !== x && x.contains(y))); (inner || el[0]) && (inner || el[0]).click() }, txt)
    await sleep(1000)
    const body = await page.evaluate(() => document.body.innerText.slice(0, 40).replace(/\n/g, ' '))
    if (body.includes('返回')) await check(label)
    else ok(`【${label}】子页打开`, false, body)
  }
  // 回经营页截图（导航栏可见取证）
  await goTab('经营')
  await page.evaluate(() => { const c = document.querySelector('.content'); if (c) c.scrollTop = c.scrollHeight })
  await sleep(600)
  await page.screenshot({ path: 'tests/_shot-fix-biz-bottom.png' })
  await page.evaluate(() => { const c = document.querySelector('.content'); if (c) c.scrollTop = 0 })
  await sleep(400)
  await page.screenshot({ path: 'tests/_shot-fix-biz-top.png' })

  const failed = results.filter(r => !r.pass)
  console.log(`\n========== 第1步几何验证: ${results.length - failed.length} 通过 / ${failed.length} 失败 ==========`)
  failed.forEach(f => console.log('  ✗ ' + f.name))
  console.log(`\n经营页几何：修复前 content boxH=3061 / tabbar top=3105（视口外,不可滚）`)
  console.log(`            修复后 content boxH=${pBiz.content ? pBiz.content.boxH : '?'} / tabbar top=${pBiz.tabbar ? pBiz.tabbar.top : '?'} bottom=${pBiz.tabbar ? pBiz.tabbar.bottom : '?'} / 可滚动=${pBiz.scrollTest}`)
  process.exitCode = failed.length ? 1 : 0
} catch (e) { console.error('中断:', e.message); process.exitCode = 1 } finally {
  try { await browser?.close() } catch (e) {}
  try { if (server?.pid) require2('node:child_process').execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }) } catch (e) {}
}
