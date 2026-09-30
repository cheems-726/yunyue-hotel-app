// §32-U2 浏览器实核：教师端「📄 经营报告」真的能点开、真的能渲染（★ 构建通过 ≠ 能跑）
//
//   为什么必须有这一步：本项目两次真实事故（§26）都是"构建绿、运行才炸"（组件作用域串用 / useMemo 未导入），
//   静态测试与 Node 守门都抓不到 —— 只有浏览器能抓。
//   本脚本以【测试教师账号】登录云端教师后台，对每个有存档的组：
//     ① 点「📄 经营报告」② 断言报告页渲染出关键区块（未开业的组走友好提示分支）③ 无 pageerror ④ 渲染 <1 秒
//     ⑤ 打印样式在位（@media print）⑥ 点「← 返回」能回到总览
//
// 用法：node tests/_verify-teacher-report.mjs      （常驻预览 4173 已在监听时直接复用）
import { chromium } from 'playwright-core'
import { spawn, execSync } from 'node:child_process'
import { TEST_TEACHER } from './testEnv.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4173
const BASE = `http://localhost:${PORT}/`
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

let browser, server
let 复用常驻 = await fetch(BASE).then(r => r.ok).catch(() => false)
if (!复用常驻) {
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true })
  for (let i = 0; i < 40; i++) { try { const x = await fetch(BASE); if (x.ok) break } catch (e) {} await sleep(300) }
}
console.log(`▶ U2 教师经营报告 · 浏览器实核（${复用常驻 ? '复用常驻预览' : '已起临时预览'} :${PORT}）\n`)

try {
  browser = await chromium.launch({ executablePath: EDGE, headless: true })
  const 页面错误 = []
  const pg = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
  pg.on('pageerror', e => { const m = e.message || ''; if (!m.includes('plugin is not implemented')) 页面错误.push(m) })
  pg.on('dialog', d => d.accept())

  await pg.goto(BASE); await pg.waitForLoadState('domcontentloaded'); await sleep(1200)
  await pg.evaluate(() => localStorage.clear())
  await pg.reload(); await pg.waitForLoadState('domcontentloaded'); await sleep(1200)
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button, span')].find(x => x.textContent.includes('我是老师')); b && b.click() })
  await sleep(400)
  await pg.evaluate(({ id, pw }) => {
    const inputs = [...document.querySelectorAll('input')]
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inputs[0], id); inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
    setter.call(inputs[1], pw); inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
    const btn = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled)
    if (btn) btn.click()
  }, { id: TEST_TEACHER.id, pw: TEST_TEACHER.pw })
  await sleep(3500)

  let 后台就绪 = false
  for (let i = 0; i < 12; i++) {
    const b = await pg.evaluate(() => document.body.innerText)
    if (b.includes('教师后台')) { 后台就绪 = true; break }
    await sleep(1000)
  }
  ok(后台就绪, `教师后台登录成功（${TEST_TEACHER.id}）`)
  if (!后台就绪) {
    console.log('\n⚠ 云端教师段不可用（疑限流/跨国线路）⇒ 实核无法进行，如实报告，不伪造结论')
    console.log(`\n结果: ${pass} 通过 / ${fail} 失败（未完成 · 环境）`)
    await browser.close(); if (server?.pid && !复用常驻) { try { execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore', windowsHide: true }) } catch (e) {} }
    process.exit(2)
  }

  // ★ 组卡片在「排名」视图（实时决策视图是决策流水；我的视图是设置）—— 先切到排名
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('排名')); b && b.click() })
  await sleep(1500)

  // 等到组卡片出现（报表按钮在卡片右上角）
  let 有按钮 = false
  for (let i = 0; i < 15; i++) {
    有按钮 = await pg.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('经营报告')))
    if (有按钮) break
    await sleep(1000)
  }
  ok(有按钮, '排名页出现「📄 经营报告」按钮')
  if (!有按钮) { console.log('    [页面] ' + String(await pg.evaluate(() => document.body.innerText)).slice(0, 200).replace(/\n/g, ' | ')) }

  const 组数 = await pg.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.textContent.includes('经营报告')).length)
  console.log(`     · 本班有存档的组：${组数} 组`)

  // 逐组开报告（最多抽 3 组，省时间）：断言渲染 + 计时 + 返回
  for (let k = 0; k < Math.min(3, 组数); k++) {
    const 开了 = await pg.evaluate((i) => {
      const bs = [...document.querySelectorAll('button')].filter(b => b.textContent.includes('经营报告'))
      if (!bs[i]) return false
      bs[i].click(); return true
    }, k)
    if (!开了) break
    await sleep(600)
    const t0 = Date.now()
    let 文本 = ''
    for (let i = 0; i < 20; i++) {   // 等渲染出报告主体
      文本 = await pg.evaluate(() => document.body.innerText)
      if (文本.includes('关键数') || 文本.includes('还没有可报告的经营数据')) break
      await sleep(100)
    }
    const 耗时 = Date.now() - t0
    const 未开业 = 文本.includes('还没有可报告的经营数据')
    ok(文本.includes('关键数') || 未开业, `第 ${k + 1} 组：报告页渲染（${未开业 ? '未开业友好提示分支' : '完整报告'}）· ${耗时}ms`)
    ok(耗时 < 1000, `第 ${k + 1} 组：渲染 < 1 秒（实测 ${耗时}ms）`)
    if (!未开业) {
      const 齐 = ['运营启动资金', '累计营收', '经营口径', '逐周经营', '关键事件时间线', '老师批注', '最好周（经营口径）', '期末评分'].filter(x => 文本.includes(x))
      ok(齐.length === 8, `第 ${k + 1} 组：报告六区块齐全（缺：${['运营启动资金', '累计营收', '经营口径', '逐周经营', '关键事件时间线', '老师批注', '最好周（经营口径）', '期末评分'].filter(x => !文本.includes(x)).join('、') || '无'}）`)
      // 数字非空：累计营收行后面应有"元"
      const 有金额 = /\d[\d,]{3,}\s*元/.test(文本)
      ok(有金额, `第 ${k + 1} 组：关键数区含真实金额（非空/非 0 占位）`)
    }
    const 打印样式 = await pg.evaluate(() => [...document.querySelectorAll('style')].some(s => (s.textContent || '').includes('@media print')))
    ok(打印样式, `第 ${k + 1} 组：打印样式 @media print 在位`)
    const 有打印按钮 = await pg.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('打印')))
    ok(有打印按钮, `第 ${k + 1} 组：有「🖨 打印 / 另存 PDF」按钮`)
    // 返回
    await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('返回')); b && b.click() })
    await sleep(500)
    const 关了 = await pg.evaluate(() => !document.body.innerText.includes('逐周经营') && !document.body.innerText.includes('还没有可报告的经营数据'))
    ok(关了, `第 ${k + 1} 组：「← 返回」能回到总览（覆盖层关闭）`)
  }

  ok(页面错误.length === 0, `全程无页面 JS 异常（React 崩溃防线）${页面错误.length ? '：' + 页面错误.slice(0, 2).join(' / ') : ''}`)

  // 可选：存一张证据图（--shot <输出路径>）—— 供批次报告引用
  //   ★ 不用 fullPage:true（本项目实测会拼接错位）：改成"把视口设成整页高度 + 普通截图"，
  //     宽高上限 3840×2160（超了浏览器会截不全）
  const shotIdx = process.argv.indexOf('--shot')
  if (shotIdx > -1 && process.argv[shotIdx + 1]) {
    await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].filter(x => x.textContent.includes('经营报告'))[0]; b && b.click() })
    await sleep(800)
    const 尺寸 = await pg.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }))
    await pg.setViewportSize({ width: Math.min(3840, Math.max(1080, 尺寸.w)), height: Math.min(2160, Math.max(900, 尺寸.h)) })
    await sleep(400)
    await pg.screenshot({ path: process.argv[shotIdx + 1] })
    console.log(`  ✓ 证据图已存：${process.argv[shotIdx + 1]}（${尺寸.w}×${尺寸.h}）`)
  }
} catch (e) {
  fail++
  console.error('  ✗ FAIL: 实核脚本异常 —— ' + (e && e.message))
} finally {
  try { await browser?.close() } catch (e) {}
  if (server?.pid && !复用常驻) { try { execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore', windowsHide: true }) } catch (e) {} }
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
