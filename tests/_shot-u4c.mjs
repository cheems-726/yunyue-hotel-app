// U4c 证据（用完删）：决策面板「代价行」截图 —— ★ 逐字复用 ui-smoke 的筹建序列（探路 4 次的教训：别自己发明导航）
import { chromium } from 'playwright-core'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, mkdirSync } from 'node:fs'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:4173/'
const 输出 = 'D:/教学app/4-审计与报告/证据-U4c'
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
  // ── ui-smoke 序列（登录 → 选址 → 品牌 → 认领 → 筹建 → 开业 → 经营）──
  const clickText = (t) => pg.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) { b.click(); return true } return false }, t)
  const clickCard = (t, mode = 'includes') => pg.evaluate(({ t, mode }) => {
    const ms = [...document.querySelectorAll('.district-card, div')].filter(x => mode === 'starts' ? x.textContent.startsWith(t) : x.textContent.includes(t))
    if (!ms.length) return false
    const inner = ms.reverse().find(x => !ms.some(y => y !== x && x.contains(y)))
    inner.click(); return true
  }, { t, mode })
  const 点图标 = (e) => pg.evaluate(e2 => { const s = [...document.querySelectorAll('div')].find(d => d.textContent === e2 && d.style.cursor === 'pointer'); s && s.click() }, e)
  await clickText('我是学生'); await sleep(400)
  await clickText('离线演示'); await sleep(400)
  await clickText('进入演示'); await sleep(700)
  await clickText('开始我的酒店之旅'); await sleep(800)
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button, .city-tab, div')].find(x => x.textContent.trim() === '成都'); b && b.click() }); await sleep(500)
  await clickCard('锦江区'); await sleep(500)
  await clickText('明白了'); await sleep(250)
  await clickText('确认选址'); await sleep(700)
  await clickCard('汉庭'); await sleep(450)
  await clickText('确认选择'); await sleep(700)
  await clickCard('OTA平台合作'); await sleep(400)
  await clickCard('社区旁物业'); await sleep(600)
  // 认领 6 步（★ 按钮文本 = 「完成「xx」，下一步 →」/ 最后一步「完成认领，进入筹建 →」）
  for (let i = 0; i < 14; i++) {
    const 文 = await pg.evaluate(() => document.body.innerText)
    if (/第四步|门店筹建/.test(文)) break
    const 点了 = await pg.evaluate(() => {
      const b = [...document.querySelectorAll('button')].filter(y => !y.disabled).find(y => /下一步|完成|进入筹建|签约/.test(y.textContent))
      if (b) { b.click(); return b.textContent.trim().slice(0, 16) }
      return null
    })
    if (!点了) break
    await sleep(900)
  }
  // 筹建（ui-smoke 序列）：投资 → 证照 → 采购 → 开业
  await clickCard('基准情景', 'starts'); await sleep(500)
  await clickText('明白了'); await sleep(300)
  await 点图标('📄'); await sleep(400)
  for (const n of ['申领营业执照', '消防检查合格证', '卫生许可证']) { await clickCard(n, 'starts'); await sleep(400); await clickText('明白了'); await sleep(250) }
  await 点图标('🛒'); await sleep(400)
  await clickCard('供应商 A'); await sleep(500)
  await clickText('明白了'); await sleep(250)
  await 点图标('🎉'); await sleep(400)
  for (const n of ['装修', '系统上线', '招聘']) { await clickCard(n, 'starts'); await sleep(400) }
  await clickText('完成筹建'); await sleep(1500)
  await clickText('明白了'); await sleep(800)
  await sleep(2000)
  const 经营页 = await pg.evaluate(() => document.body.innerText)
  console.log('到经营页：', /第 1 周|经营|决策/.test(经营页) ? '✓' : '✗', '｜', 经营页.split('\n').slice(0, 5).join(' | '))
  // 找决策项入口（ui-smoke 的"去决策"按钮）
  const 开 = await pg.evaluate(() => {
    const el = [...document.querySelectorAll('div, span')].reverse().find(x => x.textContent.trim() === '去决策')
    if (el) { el.click(); return '去决策' }
    return null
  })
  console.log('点决策入口：', JSON.stringify(开))
  await sleep(1500)
  const 有代价 = await pg.evaluate(() => [...document.querySelectorAll('div')].some(y => y.textContent.includes('代价：')))
  console.log('★ 决策面板含代价行：', 有代价)
  if (有代价) {
    const h = await pg.evaluateHandle(() => [...document.querySelectorAll('div')].filter(x => x.textContent.includes('代价：') && x.textContent.length < 400).sort((a, b) => a.textContent.length - b.textContent.length)[0])
    const el = h.asElement()
    if (el) {
      await el.scrollIntoViewIfNeeded(); await sleep(300)
      const h2 = await pg.evaluateHandle((n) => n.parentElement && n.parentElement.parentElement ? n.parentElement.parentElement : n, el)
      const 盒 = await h2.asElement()?.boundingBox()
      await h2.asElement()?.screenshot({ path: `${输出}/决策面板-代价行.png` })
      console.log(`✓ 决策面板-代价行 → ${输出}/决策面板-代价行.png（${Math.round(盒?.width || 0)}×${Math.round(盒?.height || 0)}）`)
    }
  } else {
    await pg.screenshot({ path: `${输出}/决策面板-未含代价行（如实记录）.png` })
    console.log('✗ 无代价行（已存当前屏，如实记录）：', (await pg.evaluate(() => document.body.innerText)).split('\n').slice(0, 8).join(' | '))
  }
  console.log(`页面 JS 异常：${异常.length ? 异常.slice(0, 2).join(' / ') : '无'}`)
} finally { try { await browser?.close() } catch (e) {} }
// sha256 查重
try {
  const 图 = readdirSync(输出).filter(f => f.endsWith('.png'))
  const sha = (f) => createHash('sha256').update(readFileSync(`${输出}/${f}`)).digest('hex').slice(0, 8)
  console.log('\n证据图 sha256：')
  for (const f of 图) console.log(`  ${sha(f)}  ${f}`)
} catch (e) { console.log('（自查跳过）') }
