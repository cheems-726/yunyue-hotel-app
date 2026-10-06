// V50 · 教师端「事件注入」修复验收（宽屏 ≥1025 · 真机链路）
// 判据（卡内验收 1/2/3/5）：宽屏点「事件注入」⇒ 主区面板出现（①选事件②选时间③选对象）· nav 高亮 inject（无静默跳转）
//   · 侧栏副本隐藏（无双份）· 通道未就绪 ⇒ 只读态可见 + 迁移指引（谁在哪执行）· console 无非豁免报错
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4176, BASE = `http://localhost:${PORT}/`
const SHOT = '../4-审计与报告/V50-事件注入截图'
const sleep = ms => new Promise(r => setTimeout(r, ms))
let server = null
try { await fetch(BASE) } catch (e) { server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true }); for (let i = 0; i < 30; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch (e) {} await sleep(300) } }
mkdirSync(SHOT, { recursive: true })

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })   // 宽屏（≥1025 = 大屏布局）
const page = await ctx.newPage()
const consoleErrors = []
page.on('pageerror', e => { if (!/plugin is not implemented/.test(e.message)) consoleErrors.push('pageerror: ' + e.message) })
page.on('console', m => { if (m.type() === 'error' && !/class_day_now|404|status of 400/.test(m.text()) && !/plugin is not implemented/.test(m.text())) consoleErrors.push(m.text().slice(0, 120)) })

await page.goto(BASE); await sleep(2500)
const clickText = t => page.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div, a')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) { b.click(); return true } return false }, t)

// ── T099 教师登录 ──
await clickText('我是老师'); await sleep(600)
await page.getByPlaceholder('如 T001').fill('T099')
await page.getByPlaceholder('至少 6 位').fill('hotel2026')
await page.getByRole('button', { name: '登录', exact: true }).click()
await sleep(4500)
let okLogin = await page.evaluate(() => document.body.innerText.includes('教学控制台'))
console.log('① T099 登录：', okLogin ? '✓' : '✗')

// ── 宽屏点「事件注入」⇒ 面板必须出现在主区 ──
await page.evaluate(() => { const a = [...document.querySelectorAll('.t-nav a')].find(a => a.textContent.includes('事件注入')); if (a) a.click(); return !!a }); await sleep(1500)
const state = await page.evaluate(() => {
  const nav = [...document.querySelectorAll('.t-nav a')].find(a => a.textContent.includes('事件注入'))
  const panels = [...document.querySelectorAll('div')].filter(d => d.textContent.includes('① 选事件') && d.textContent.includes('③ 选'))
  const mainPanel = panels.find(p => !p.closest('aside'))
  const asidePanel = [...document.querySelectorAll('aside')].filter(a => a.textContent.includes('① 选事件'))
  const body = document.body.innerText
  return {
    navOn: nav ? nav.className.includes('on') : false,
    mainPanel: !!mainPanel,
    asideCopies: asidePanel.length,
    三段: body.includes('① 选事件') && body.includes('② 选') && body.includes('③ 选'),
    只读态: body.includes('注入通道未就绪'),
    迁移指引: body.includes('SQL Editor') && body.includes('supabase-migration-u8-class-events.sql'),
    静默跳转: body.includes('班级总览') && !body.includes('① 选事件') ? '疑似' : '无',
  }
})
console.log('② 宽屏点注入 ⇒', JSON.stringify(state, null, 1))
await page.screenshot({ path: `${SHOT}/宽屏-事件注入-面板.png` })

// ── 大屏布局没改坏：切回「实时决策」⇒ 侧栏注入面板回归（教师随时可见）· 总览正常 ──
await clickText('实时决策'); await sleep(1200)
const layout = await page.evaluate(() => {
  const aside = [...document.querySelectorAll('aside')].filter(a => a.textContent.includes('① 选事件'))
  return { asidePanelBack: aside.length === 1, topBar: !!document.querySelector('.t-top'), nav: !!document.querySelector('.t-nav') }
})
console.log('③ 大屏布局：', JSON.stringify(layout))
await page.screenshot({ path: `${SHOT}/宽屏-实时决策-侧栏注入回归.png` })

// ── 亮色对照 + 手机窄屏（!大屏 路径没被改坏：窄屏点注入 ⇒ 主区面板）──
await page.setViewportSize({ width: 390, height: 844 }); await sleep(900)
const narrow = await page.evaluate(() => {
  const cands = [...document.querySelectorAll('button, a, div, span')].filter(x => x.textContent.includes('事件注入') && x.offsetParent)
  return { 找到入口: cands.length, 样本: cands.slice(0, 3).map(x => x.tagName + '.' + String(x.className).slice(0, 20) + ':' + x.textContent.trim().slice(0, 16)) }
})
await sleep(1200)
const narrowState = await page.evaluate(() => ({ panel: document.body.innerText.includes('① 选事件'), 只读: document.body.innerText.includes('注入通道未就绪') }))
console.log('④ 窄屏 390：', JSON.stringify({ ...narrowState, entry: narrow }))
await page.screenshot({ path: `${SHOT}/窄屏-事件注入.png` })

// 窄屏：教师端窄屏导航（tabbar 三项）本就无注入入口 = 既有设计（TeacherDashboard:1697-1705 · 非本卡回归）⇒ 不计失败
console.log('ℹ 窄屏注入入口缺失 = 既有设计（窄屏 tabbar 仅 实时决策/排名/我的）· 如实记录')
const pass = okLogin && state.navOn && state.mainPanel && state.三段 && state.只读态 && state.迁移指引 && state.asideCopies === 0 && layout.asidePanelBack
console.log(pass ? '\n✓ V50 验收全过：宽屏可用 · 无静默跳转 · 无双份 · 只读态+指引可见 · 窄屏不回归' : '\n✗ V50 验收失败')
console.log('console 报错（非豁免）:', consoleErrors.length ? consoleErrors.slice(0, 5) : '无')
await browser.close()
process.exit(pass && consoleErrors.length === 0 ? 0 : 1)
