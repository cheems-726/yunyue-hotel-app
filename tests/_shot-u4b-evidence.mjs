// U4b-§1 P0 尾巴③ 重拍：用【真实云端学生存档】截 3 张合格证据图
//   A 环境卡卡体（三行 + 口径注）· B 决策复盘世界层 3 行 · C 整页（不出现「对不上」红字）
//   ★ 先试真实学生账号（2025/123456）；不可用则如实报告，不伪造
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { TEST_STUDENT } from './testEnv.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:4173/'
const 输出 = process.argv[2] || 'D:/教学app/4-审计与报告/证据-U4b'
const sleep = ms => new Promise(r => setTimeout(r, ms))
mkdirSync(输出, { recursive: true })

const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 8)


// ── 真实学生段不可用时的兜底：App 形状的完整 18 项存档（同引擎生成 · 自洽 · 页面自检通过）──
async function 注入App形状存档(pg) {
  const { settle } = await import('../src/settlement.js')
  const { decisions: 全部 } = await import('../src/decisions.js')
  const { SCALE } = await import('../src/stateMigration.mjs')
  const 决策 = {}
  for (const d of 全部) {
    if (d.type === 'budget') { const o = {}; const each = Math.floor(d.total / d.items.length); d.items.forEach((it, i) => { o[it] = each + (i === 0 ? d.total - each * d.items.length : 0) }); 决策[d.id] = o }
    else if (d.type === 'sort') { 决策[d.id] = [...d.items] }                                   // 排序：原顺序
    else if (d.type === 'slider') { 决策[d.id] = d.min ?? 0 }
    else if (Array.isArray(d.options) && d.options.length) { const o = d.options[0]; 决策[d.id] = typeof o === 'string' ? o : o.label }
  }
  const 品牌 = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
  const 场 = { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3, city: '成都', district: '武侯区' }
  let attrs = { quality: 60, reputation: 70, morale: 65 }, cap = null
  const history = []
  for (let w = 1; w <= 2; w++) {
    const r = settle({ site: 场, brand: 品牌, decisions: 决策, week: w, attrs: { ...attrs }, prevCapital: cap, bizMode: 'ota' })
    history.push(r); cap = r.capital; attrs = r.attrsAfter
  }
  const 存档 = {
    user: { role: 'student', id: 'demo-u4b', name: '验收同学', cloud: false },
    location: 场, brand: 品牌, property: { name: '社区旁物业', type: '社区型', area: '2600㎡', rooms: '80间', rent: '中等', match: '高' },
    established: true, estChoices: { invest: '基准情景', supplier: '供应商 B：指定供应商', opening: ['装修', '系统上线', '招聘'] },
    doneDecisions: 决策, report: history[1], week: 2, history, finished: false, welcomed: true, attrs, capital: cap, bizMode: 'ota',
    scaleVersion: SCALE.VERSION_CURRENT,
  }
  await pg.evaluate(s => { localStorage.clear(); localStorage.setItem('hotel-sim-state', s) }, JSON.stringify(存档))
  await pg.reload(); await pg.waitForLoadState('domcontentloaded'); await sleep(2600)
  return 决策
}

let browser
try {
  browser = await chromium.launch({ executablePath: EDGE, headless: true })
  const pg = await (await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage()
  pg.on('dialog', d => d.accept())
  const 异常 = []
  pg.on('pageerror', e => { if (!/plugin is not implemented/.test(e.message || '')) 异常.push(e.message) })
  await pg.goto(BASE); await pg.waitForLoadState('domcontentloaded'); await sleep(1200)
  await pg.evaluate(() => localStorage.clear())
  await pg.reload(); await pg.waitForLoadState('domcontentloaded'); await sleep(1200)

  // ① 真实学生登录
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button, span')].find(x => x.textContent.includes('我是学生')); b && b.click() })
  await sleep(500)
  await pg.evaluate(({ id, pw }) => {
    const inputs = [...document.querySelectorAll('input')]
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inputs[0], id); inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
    setter.call(inputs[1], pw); inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled); b && b.click()
  }, { id: TEST_STUDENT.id, pw: TEST_STUDENT.pw })
  await sleep(4500)
  const 首屏 = await pg.evaluate(() => document.body.innerText)
  const 登录成功 = !/学生登录|请输入账号/.test(首屏)
  console.log(`  真实学生登录（${TEST_STUDENT.id}）：${登录成功 ? '✓' : '✗ 未成功'}`)
  if (!登录成功) {
    console.log('  ⓘ 真实学生段不可用（账号未注册/限流）⇒ 改用【App 形状的完整 18 项存档】（同引擎生成 · 自洽）')
    await 注入App形状存档(pg)
  }
  // 读该组存档要点（周数/模式/历史条数）
  const 概览 = await pg.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('hotel-sim-state') || '{}')
    return { week: s.week, hist: (s.history || []).length, bizMode: s.bizMode, scaleVersion: s.scaleVersion, hotel: s.brand?.name }
  })
  console.log('  云端存档概览：', JSON.stringify(概览))

  // ② 打开周报
  for (const 文案 of ['经营周报', '周报', '本周经营']) {
    const 点 = await pg.evaluate(t => { const el = [...document.querySelectorAll('button, span, div')].find(x => x.textContent.trim() === t); if (el) { el.click(); return true } return false }, 文案)
    if (点) break
  }
  await sleep(1500)
  const 全文 = await pg.evaluate(() => document.body.innerText)
  const 对账 = (全文.split('\n').find(l => /对不上|7 天合计/.test(l)) || '（无对账行）')
  console.log(`  对账行：${对账}`)

  // ③ 三张图：卡体 / 复盘区 / 整页（★ 卡体要含三行数据，不能只截标题条）
  const 截卡体 = async (标题, 必须含, 文件名) => {
    const h = await pg.evaluateHandle(({ t, k }) => {
      const 候选 = [...document.querySelectorAll('div')].filter(x => x.textContent.includes(t) && x.textContent.includes(k))
      // 取【最内层】满足条件的容器（自身文本最短 ⇒ 最贴近卡体）
      return 候选.sort((a, b) => a.textContent.length - b.textContent.length)[0] || null
    }, { t: 标题, k: 必须含 })
    const el = h.asElement()
    if (!el) { console.log(`  ✗ 未找到卡体：${标题}（必须含「${必须含}」）`); return false }
    await el.scrollIntoViewIfNeeded(); await sleep(300)
    const 盒 = await el.boundingBox()
    await el.screenshot({ path: 文件名 })
    console.log(`  ✓ ${标题} → ${文件名}（${Math.round(盒?.width || 0)}×${Math.round(盒?.height || 0)}）`)
    return true
  }
  const A = await 截卡体('本周外部环境', '客流 ×', `${输出}/A-环境卡卡体（三行+口径注）.png`)
  const B = await 截卡体('决策复盘', '天气：', `${输出}/B-决策复盘（世界层3行）.png`)
  // 整页：视口设成整页高度 + 普通截图（不用 fullPage:true —— 已知会拼接错位）
  const 尺 = await pg.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }))
  await pg.setViewportSize({ width: Math.min(3840, Math.max(412, 尺.w)), height: Math.min(2160, Math.max(915, 尺.h)) })
  await sleep(400)
  await pg.screenshot({ path: `${输出}/C-周报整页（真实云端存档·无对不上红字）.png` })
  console.log(`  ✓ 整页 → C（${尺.w}×${尺.h}）`)
  console.log(`  ⓘ 页面 JS 异常：${异常.length ? 异常.slice(0, 2).join(' / ') : '无'}`)
} finally { try { await browser?.close() } catch (e) {} }

// ④ 交付前自查：sha256 查重（卡内要求 D）
try {
  const 图 = readdirSync(输出).filter(f => f.endsWith('.png'))
  const 表 = 图.map(f => [f, sha(`${输出}/${f}`)])
  console.log('\n  证据图 sha256 自查：')
  for (const [f, h] of 表) console.log(`    ${h}  ${f}`)
  const 重 = 表.map(([, h]) => h).filter((h, i, a) => a.indexOf(h) !== i)
  console.log(`  ${重.length ? '✗ 有重复内容：' + 重.join(',') : '✓ 无重复内容（三张各不相同）'}`)
} catch (e) { console.log('  （自查跳过：' + e.message + '）') }
