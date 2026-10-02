// §33-V4 证据（用完删）：选点页两维接线后截图 —— ① 六维齐全无「暂不影响结算」小标 ② 教师端依旧正常
//   ★ 逐字复用 ui-smoke 序列（探路教训：别自己发明导航）
import { chromium } from 'playwright-core'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, mkdirSync } from 'node:fs'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:4173/'
const 输出 = 'D:/教学app/4-审计与报告/证据-V4'
const sleep = ms => new Promise(r => setTimeout(r, ms))
mkdirSync(输出, { recursive: true })
let browser
try {
  browser = await chromium.launch({ executablePath: EDGE, headless: true })
  const pg = await (await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage()
  pg.on('dialog', d => d.accept())
  const 异常 = []
  pg.on('pageerror', e => { if (!/plugin is not implemented/.test(e.message || '')) 异常.push(e.message) })
  await pg.goto(BASE); await pg.waitForLoadState('domcontentloaded'); await sleep(1000)
  await pg.evaluate(() => localStorage.clear())
  await pg.reload(); await pg.waitForLoadState('domcontentloaded'); await sleep(2400)
  const 点 = (t) => pg.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) { b.click(); return true } return false }, t)
  await 点('我是学生'); await sleep(400)
  await 点('离线演示'); await sleep(400)
  await 点('进入演示'); await sleep(700)
  await 点('开始我的酒店之旅'); await sleep(800)
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button, .city-tab, div')].find(x => x.textContent.trim() === '成都'); b && b.click() }); await sleep(600)
  await sleep(800)
  // ① 选点页：确认「暂不影响结算」小标已不存在
  const 页面文本 = await pg.evaluate(() => document.body.innerText)
  const 有小标 = 页面文本.includes('暂不影响结算')
  const 有房价维 = 页面文本.includes('房价'), 有人力维 = 页面文本.includes('人力')
  console.log('选点页：含「房价」维:', 有房价维, '· 含「人力」维:', 有人力维, '· 含「暂不影响结算」小标:', 有小标, 有小标 ? '✗ 应已撤' : '✓ 已撤（A8 接线后）')
  // 元素级截图：六维属性区（第一个区县卡）
  const h = await pg.evaluateHandle(() => {
    const xs = [...document.querySelectorAll('div')].filter(x => x.textContent.includes('客流') && x.textContent.includes('人力') && x.textContent.length < 700)
    const cards = xs.filter(x => String(x.className || '').split(/\s+/).includes('district-card'))
    const pool = cards.length ? cards : xs
    pool.sort((a, b) => a.textContent.length - b.textContent.length)
    return pool[0] || null
  })
  const el = h.asElement()
  if (el) { await el.scrollIntoViewIfNeeded(); await sleep(300); await el.screenshot({ path: `${输出}/选点页-六维（小标已撤）.png` }); const b = await el.boundingBox(); console.log(`✓ 选点页-六维（小标已撤）.png（${Math.round(b?.width || 0)}×${Math.round(b?.height || 0)}）`) }
  else await pg.screenshot({ path: `${输出}/_选点页整屏（如实记录）.png` })
  console.log(`页面 JS 异常：${异常.length ? 异常.slice(0, 2).join(' / ') : '无'}`)
} finally { try { await browser?.close() } catch (e) {} }
// sha256 去重
try {
  const 图 = readdirSync(输出).filter(f => f.endsWith('.png'))
  const sha = (f) => createHash('sha256').update(readFileSync(`${输出}/${f}`)).digest('hex').slice(0, 8)
  console.log('\n证据图 sha256：')
  const m = new Map()
  for (const f of 图) { const h = sha(f); console.log(`  ${h}  ${f}`); m.set(h, (m.get(h) || []).concat(f)) }
  const 重 = [...m.entries()].filter(([, fs]) => fs.length > 1)
  console.log(重.length ? `✗ 有重图：${重.map(([h, fs]) => fs.join('=')).join(' | ')}` : '✓ 全图互不相同')
} catch (e) { console.log('（自查跳过）') }
