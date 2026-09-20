// 教师端是否同款布局回归（结构证据 + 实测）
import { chromium } from 'playwright-core'
import { TEST_TEACHER } from './testEnv.mjs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
const require2 = createRequire(import.meta.url)
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:4173/'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const GEO = () => {
  const tb = document.querySelector('.tabbar')
  const app = document.querySelector('.app')
  const wrap = document.querySelector('.app > div[style*="pageIn"]') || document.querySelector('div[style*="pageIn"]:not([class])')
  const r = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), scrollH: el.scrollHeight } }
  const scroller = document.querySelector('.content')
  let canScroll = 'no-.content'
  if (scroller) { const b0 = scroller.scrollTop; scroller.scrollTop = 400; canScroll = scroller.scrollTop > 0; scroller.scrollTop = b0 }
  return {
    innerH: window.innerHeight,
    app: r(app), wrapper: wrap ? { ...r(wrap), flex: getComputedStyle(wrap).flex, minH: getComputedStyle(wrap).minHeight } : 'none',
    tabbar: r(tb),
    tabbarVisible: tb ? (tb.getBoundingClientRect().bottom <= window.innerHeight + 1 && tb.getBoundingClientRect().top > 0) : 'no-tabbar',
    canScroll,
    structure: app ? [...app.children].map(x => x.className || x.tagName + '[style]').slice(0, 6) : null,
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
    setter.call(inputs[0], TEST_TEACHER.id); inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
    setter.call(inputs[1], TEST_TEACHER.pw); inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled); b && b.click()
  })
  await sleep(6000)
  const body = await page.evaluate(() => document.body.innerText.slice(0, 60).replace(/\n/g, ' | '))
  console.log('教师端落地:', body)
  if (body.includes('教师后台')) {
    console.log('教师端 实时决策视图:', JSON.stringify(await page.evaluate(GEO)))
    console.log('tabbar 父链:', await page.evaluate(() => { let el = document.querySelector('.tabbar'), out = []; while (el && out.length < 5) { out.push(el.tagName + (el.className ? '.' + String(el.className).split(' ')[0] : '')); el = el.parentElement } return out.join(' < ') }))
    console.log('滚动 .content 后 tabbar 位移:', await page.evaluate(() => { const c = document.querySelector('.content'), tb = document.querySelector('.tabbar'); if (!c || !tb) return 'n/a'; const b = Math.round(tb.getBoundingClientRect().top); c.scrollTop = 500; const a = Math.round(tb.getBoundingClientRect().top); c.scrollTop = 0; return `${b} → ${a}（随滚动移动=tabbar在滚动容器内）` }))
    await page.evaluate(() => { const b = [...document.querySelectorAll('.tab')].find(x => x.textContent.includes('排名')); b && b.click() })
    await sleep(2000)
    console.log('教师端 排名视图    :', JSON.stringify(await page.evaluate(GEO)))
    await page.evaluate(() => { const b = [...document.querySelectorAll('.tab')].find(x => x.textContent.includes('我的')); b && b.click() })
    await sleep(1500)
    console.log('教师端 我的视图    :', JSON.stringify(await page.evaluate(GEO)))
    await page.screenshot({ path: 'tests/_shot-teacher.png' })
  }
} catch (e) { console.error('中断:', e.message) } finally {
  try { await browser?.close() } catch (e) {}
  try { if (server?.pid) require2('node:child_process').execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }) } catch (e) {}
}
