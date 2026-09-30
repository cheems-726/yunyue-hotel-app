// §32-U4-§1③ 认领页平台规则取证（离线演示入口 ⇒ 认领流程 ⇒ 选经营模式那一步）
import { chromium } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:4173/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const 输出 = process.argv[2] || 'D:/教学app/4-审计与报告/证据-U4'
let browser
try {
  browser = await chromium.launch({ executablePath: EDGE, headless: true })
  const pg = await (await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage()
  pg.on('dialog', d => d.accept())   // ★ 弹窗必须接（离线演示/确认框 —— 实测踩过）
  const 异常 = []
  pg.on('pageerror', e => { if (!/plugin is not implemented/.test(e.message || '')) 异常.push(e.message) })
  await pg.goto(BASE); await pg.waitForLoadState('domcontentloaded'); await sleep(1000)
  await pg.evaluate(() => localStorage.clear())
  await pg.reload(); await pg.waitForLoadState('domcontentloaded'); await sleep(2400)

  // ① 离线演示（★ 两步：离线演示 → 进入演示 —— ui-smoke 的既有序列，实测漏第二步就卡住）
  await pg.getByText('我是学生', { exact: false }).first().click({ timeout: 3000 }); await sleep(500)
  await pg.getByText('离线演示', { exact: false }).first().click({ timeout: 3000 }); await sleep(500)
  await pg.getByText('进入演示', { exact: false }).first().click({ timeout: 3000 }); await sleep(1200)
  console.log('  ⓘ 进入演示后首屏：' + (await pg.evaluate(() => document.body.innerText)).split('\n').slice(0, 4).join(' | '))

  // ② 走到认领页 —— ★ 逐字复用 ui-smoke 的既有序列（它每轮都在跑 ⇒ 是最可靠的路径）
  const clickText = (t) => pg.evaluate(t2 => {
    const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2))
    if (b) { b.click(); return true }
    return false
  }, t)
  const clickCard = (t) => pg.evaluate(t2 => {
    const matches = [...document.querySelectorAll('.district-card, div')].filter(x => x.textContent.includes(t2))
    if (!matches.length) return false
    const inner = matches.reverse().find(x => !matches.some(y => y !== x && x.contains(y)))
    inner.click(); return true
  }, t)
  await clickText('开始我的酒店之旅'); await sleep(800)
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button, .city-tab, div')].find(x => x.textContent.trim() === '成都'); b && b.click() })
  await sleep(500)
  await clickCard('锦江区'); await sleep(600)
  await clickText('明白了'); await sleep(300)     // 选址反馈浮层
  await clickText('确认选址'); await sleep(800)
  await clickCard('汉庭'); await sleep(500)
  await clickText('确认选择'); await sleep(1000)
  console.log('  ⓘ 认领页首屏：' + (await pg.evaluate(() => document.body.innerText)).split('\n').slice(0, 6).join(' | '))

  // ③ 截规则块（或如实记录未达）
  const 找到 = await pg.evaluate(() => {
    const s = [...document.querySelectorAll('div')].filter(x => x.textContent.includes('平台规则（会真实生效）')).sort((a, b) => a.textContent.length - b.textContent.length)[0]
    if (s) { s.scrollIntoView({ block: 'center' }); return true }
    return false
  })
  await sleep(500)
  if (找到) {
    const h = await pg.evaluateHandle(() => [...document.querySelectorAll('div')].filter(x => x.textContent.includes('平台规则（会真实生效）')).sort((a, b) => a.textContent.length - b.textContent.length)[0])
    await h.asElement()?.screenshot({ path: `${输出}/U3-认领页-平台规则.png` })
    console.log(`  ✓ 认领页平台规则 → ${输出}/U3-认领页-平台规则.png`)
  } else {
    await pg.screenshot({ path: `${输出}/U3-认领页-导航未达（如实记录）.png` })
    console.log('  ✗ 未到达平台规则（已存当前屏，如实记录）')
  }
  console.log(`  ⓘ 页面 JS 异常：${异常.length ? 异常.slice(0, 2).join(' / ') : '无'}`)
} finally { try { await browser?.close() } catch (e) {} }
