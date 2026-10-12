// V102 T3 阶段A：真机在线完整入驻（注册→选址→品牌→认领→筹建）→ 组档落库
// 目标：证明「完整决策流程」在测试机精简 Supabase 上端到端可用；并产出组档 state 供 6 组播种
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4173
const BASE = `http://localhost:${PORT}/`
const ID = process.env.STU_ID || '20240101'
const PW = process.env.STU_PW || 'test123456'
const sleep = ms => new Promise(r => setTimeout(r, ms))
let browser, server
const log = (...a) => console.log(...a)

async function txt(page) { return page.evaluate(() => document.body.innerText) }
async function clickText(page, t) {
  return page.evaluate(t2 => {
    const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2))
    if (b) { b.click(); return true } return false
  }, t)
}
async function clickCard(page, t) {
  return page.evaluate(t2 => {
    const m = [...document.querySelectorAll('.district-card, div')].filter(x => x.textContent.includes(t2))
    if (!m.length) return false
    const inner = m.reverse().find(x => !m.some(y => y !== x && x.contains(y)))
    inner.click(); return true
  }, t)
}
async function closeOverlay(page) {
  await clickText(page, '明白了'); await sleep(300)
}
async function nextStep(page) {
  return page.evaluate(() => {
    const n = [...document.querySelectorAll('button')].find(x => !x.disabled && /下一步|确认无误/.test(x.textContent))
    if (n) { n.click(); return n.textContent.trim() } return null
  })
}

try {
  if (!existsSync(EDGE)) throw new Error('Edge 不存在: ' + EDGE)
  const up = await fetch(BASE).then(r => r.ok).catch(() => false)
  if (!up) {
    server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true })
    for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE)).ok) break } catch (e) {} await sleep(300) }
    log('▶ 已启动 preview')
  } else log('▶ 复用已有 preview')

  browser = await chromium.launch({ executablePath: EDGE, headless: true })
  const ctx = await browser.newContext({ viewport: { width: 480, height: 900 } })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', e => { const m = e.message || ''; if (!m.includes('plugin is not implemented')) errs.push(m) })
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })

  await page.goto(BASE); await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => localStorage.clear())
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(1200)

  log('◆ 登录页:', (await txt(page)).slice(0, 60).replace(/\n/g, ' | '))
  await clickText(page, '我是学生'); await sleep(400)
  await page.evaluate(({ id, pw }) => {
    const ins = [...document.querySelectorAll('input')]
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(ins[0], id); ins[0].dispatchEvent(new Event('input', { bubbles: true }))
    s.call(ins[1], pw); ins[1].dispatchEvent(new Event('input', { bubbles: true }))
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled)
    b && b.click()
  }, { id: ID, pw: PW })
  await sleep(4500)
  let t = await txt(page)
  log('◆ 登录后:', t.slice(0, 120).replace(/\n/g, ' | '))

  if (t.includes('欢迎你')) { await clickText(page, '开始我的酒店之旅'); await sleep(900); t = await txt(page); log('◆ 欢迎页→:', t.slice(0, 80).replace(/\n/g, ' | ')) }

  // 选址
  if (t.includes('地图选点') || t.includes('选址')) {
    await clickCard(page, '锦江区'); await sleep(600)
    log('  选址点击后含浮层:', (await txt(page)).includes('你的选择会带来'))
    await closeOverlay(page)
    await clickText(page, '确认选址'); await sleep(900)
    t = await txt(page); log('◆ 选址后:', t.slice(0, 90).replace(/\n/g, ' | '))
  }
  // 品牌
  if (t.includes('品牌')) {
    await clickCard(page, '汉庭'); await sleep(500)
    await clickText(page, '确认选择'); await sleep(900)
    t = await txt(page); log('◆ 品牌后:', t.slice(0, 90).replace(/\n/g, ' | '))
  }
  // 认领
  if (t.includes('认领') || t.includes('OTA')) {
    await clickCard(page, 'OTA平台合作'); await sleep(500)
    await clickText(page, '确认'); await sleep(700)
    await clickCard(page, '社区旁物业'); await sleep(500)
    for (let i = 0; i < 10; i++) {
      const done = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('完成认领'))
        if (b) { b.click(); return true }
        return false
      })
      await sleep(600)
      if (done) break
      await nextStep(page); await sleep(600)
    }
    t = await txt(page); log('◆ 认领后:', t.slice(0, 120).replace(/\n/g, ' | '))
  }
  // 筹建：选情景
  if (t.includes('筹建')) {
    const pickOption = (prefix) => page.evaluate(p => {
      const all = [...document.querySelectorAll('div')].filter(d => d.textContent.trim().startsWith(p))
      if (!all.length) return null
      const innermost = all.find(x => !all.some(y => y !== x && x.contains(y))) || all[0]
      innermost.click()
      return innermost.textContent.trim().slice(0, 22)
    }, prefix)
    const confirmInfo = () => page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /完成筹建|完成「|请先|请为|下一步/.test(x.textContent))
      return b ? { text: b.textContent.trim(), disabled: !!b.disabled } : null
    })
    for (let i = 0; i < 24; i++) {
      const t0 = await txt(page)
      if (t0.includes('去决策') || t0.includes('资金状况')) { log('◆ 已进入经营页（第' + i + '轮）'); break }
      let ci = await confirmInfo()
      log(`  轮${i} 确认钮=${ci ? (ci.disabled ? '[禁用]' : '') + ci.text.slice(0, 30) : '(无)'}`)
      if (ci && ci.disabled) {
        if (ci.text.includes('投资情景')) { log('    → 选 基准情景:', await pickOption('基准情景')) }
        else if (ci.text.includes('采购渠道')) { log('    → 选 供应商:', await pickOption('供应商 A')) }
        else if (ci.text.includes('优先级')) { for (const n of ['装修', '招聘', '系统上线']) { log(`    → 排 ${n}:`, await pickOption(n)); await sleep(350) } }
        else if (ci.text.includes('证照')) {
          const fixed = await page.evaluate(() => {
            const up = [...document.querySelectorAll('button[aria-label*="上移"]')].find(b => !b.disabled)
            if (up) { up.click(); return up.getAttribute('aria-label') } return null
          })
          log('    → 排序修正:', fixed)
        } else { log('    ⚠ 未知禁用原因，停止'); break }
        await sleep(500)
      }
      if (await page.evaluate(() => [...document.querySelectorAll('div')].some(d => d.style.position === 'fixed' && d.textContent.includes('你的选择会带来')))) await closeOverlay(page)
      const clicked = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => !x.disabled && /完成筹建|完成「|下一步/.test(x.textContent))
        if (b) { b.click(); return b.textContent.trim().slice(0, 26) } return null
      })
      log('    下一步 =', clicked)
      await sleep(800)
      if (!clicked) break
    }
    t = await txt(page)
  }

  log('◆◆ 最终页面前 200:', t.slice(0, 200).replace(/\n/g, ' | '))
  log('◆◆ 含「去决策」=', t.includes('去决策'), '含「资金状况」=', t.includes('资金状况'))
  log('◆◆ 页面JS错误数=', errs.length, errs.slice(0, 3))

  // 导出本机存档供播种
  const state = await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('hotel-sim')) { try { return JSON.parse(localStorage.getItem(k)) } catch (e) {} }
    return null
  })
  if (state) { writeFileSync('_v102_state.json', JSON.stringify(state)); log('◆◆ 已导出 state 到 _v102_state.json，键=', Object.keys(state).join(','), 'week=', state.week, 'established=', state.established) }
  else log('◆◆ 未取到本机存档')
} catch (e) {
  console.error('中断:', e.message)
} finally {
  try { await browser?.close() } catch (e) {}
  if (server?.pid) { try { process.kill(server.pid) } catch (e) {} }
}
