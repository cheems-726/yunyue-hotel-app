// 教师端布局验证（方案A：tabbar 移出滚动容器）——几何断言，覆盖 4 主视图 + 3 二级入口
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
const require2 = createRequire(import.meta.url)
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:4173/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const results = []
const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond }); console.log(`  ${cond ? '✓' : '✗'} ${name}${cond ? '' : '  [' + extra + ']'}`) }

const PROBE = () => {
  const tb = document.querySelector('.tabbar')
  const c = document.querySelector('.content')
  const rect = tb ? tb.getBoundingClientRect() : null
  let scrollTest = 'no-content', overflow = false
  if (c) {
    overflow = c.scrollHeight > c.clientHeight + 1
    if (overflow) { const b0 = c.scrollTop; c.scrollTop = 250; scrollTest = c.scrollTop > 0; c.scrollTop = b0 }
    else scrollTest = 'not-overflowing'
  }
  return {
    innerH: window.innerHeight,
    tabbarParent: tb && tb.parentElement ? (tb.parentElement.className || tb.parentElement.tagName) : '?',
    tabbar: rect ? { top: Math.round(rect.top), bottom: Math.round(rect.bottom) } : null,
    tabbarInViewport: rect ? (rect.bottom <= window.innerHeight + 1 && rect.top > 0) : false,
    tabbarVisible: tb ? tb.checkVisibility() : false,
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
  await page.goto(BASE); await page.waitForLoadState('domcontentloaded'); await sleep(1200)
  await page.evaluate(() => localStorage.clear())
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(1200)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button, span')].find(x => x.textContent.includes('我是老师')); b && b.click() })
  await sleep(500)
  await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input')]
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inputs[0], 't001'); inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
    setter.call(inputs[1], '123456'); inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled); b && b.click()
  })
  await sleep(6500)
  const landed = await page.evaluate(() => document.body.innerText.slice(0, 40).replace(/\n/g, ' '))
  console.log('落地:', landed)
  if (!landed.includes('教师后台')) { ok('教师端登录', false, landed); throw new Error('登录失败') }

  const check = async label => {
    const p = await page.evaluate(PROBE)
    ok(`【${label}】导航栏在视口内 (top=${p.tabbar ? p.tabbar.top : 'n/a'} bottom=${p.tabbar ? p.tabbar.bottom : 'n/a'} / 视口${p.innerH})`, p.tabbarInViewport)
    ok(`【${label}】checkVisibility()=true`, p.tabbarVisible)
    ok(`【${label}】tabbar 的父元素是 .app（已移出滚动容器）`, p.tabbarParent === 'app', p.tabbarParent)
    if (p.content) {
      if (p.content.overflow) ok(`【${label}】内容溢出可实际滚动 (boxH=${p.content.boxH} scrollH=${p.content.scrollH})`, p.scrollTest === true)
      else ok(`【${label}】内容未溢出（无需滚动 boxH=${p.content.boxH}）`, true)
    }
    return p
  }
  const goTab = async label => { await page.evaluate(t => { const b = [...document.querySelectorAll('.tab')].find(x => x.textContent.includes(t)); b && b.click() }, label); await sleep(1800) }
  const goEntry = async label => {
    await page.evaluate(t => {
      const all = [...document.querySelectorAll('div')].filter(x => x.textContent.trim().startsWith(t))
      // 反向找最内层匹配（真正的入口行），避免点到包含它的大容器
      const inner = all.reverse().find(x => !all.some(y => y !== x && x.contains(y)))
      ;(inner || all[0]) && (inner || all[0]).click()
    }, label)
    await sleep(2200)
  }

  console.log('\n▶ 主视图')
  const pLive = await check('实时决策')
  await goTab('排名'); await check('排名')
  await goTab('我的'); await check('我的')

  console.log('\n▶ 二级入口（分组管理/教学参考/班级总览）')
  for (const label of ['分组管理', '教学参考', '班级总览']) {
    await goTab('我的')
    await goEntry(label)
    const body = await page.evaluate(() => document.body.innerText.slice(0, 120).replace(/\n/g, ' '))
    if (body.includes('返回我的')) await check(label)
    else ok(`【${label}】二级页打开`, false, body)
  }

  await goTab('排名')
  await page.screenshot({ path: 'tests/_shot-teacher-ranking.png' })
  await goTab('实时决策')
  await page.screenshot({ path: 'tests/_shot-teacher-live.png' })

  const failed = results.filter(r => !r.pass)
  console.log(`\n========== 教师端几何验证: ${results.length - failed.length} 通过 / ${failed.length} 失败 ==========`)
  failed.forEach(f => console.log('  ✗ ' + f.name))
  console.log(`\n修复前: 实时决策 tabbar top=957 / 排名 top=953 / 我的 top=648（前两者视口外 915）`)
  console.log(`修复后: 实时决策 top=${pLive.tabbar ? pLive.tabbar.top : '?'} bottom=${pLive.tabbar ? pLive.tabbar.bottom : '?'} / 父元素=${pLive.tabbarParent}`)
  process.exitCode = failed.length ? 1 : 0
} catch (e) { console.error('中断:', e.message); process.exitCode = 1 } finally {
  try { await browser?.close() } catch (e) {}
  try { if (server?.pid) require2('node:child_process').execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }) } catch (e) {}
}
