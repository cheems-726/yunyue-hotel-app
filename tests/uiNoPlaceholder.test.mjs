// D367 · 渲染层禁词扫描（不裸扫包，扫"真的出现在屏幕上的字"）
// 用法：
//   node tests/uiNoPlaceholder.test.mjs                 → 扫线上 http://121.196.196.37
//   BASE=http://127.0.0.1:4173 node tests/uiNoPlaceholder.test.mjs  → 扫本地 preview
//
// 判据：11 个关键页面的 document.body.innerText 不含「数据缺失类」词。
// 注意：只扫"缺数据类"，不扫「暂无/没有」——那是真实空态（A2c 定了）。
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('D:/教学app/hotel-app/package.json')
const { chromium } = require('playwright-core')

const BASE = process.env.BASE || 'http://121.196.196.37/'
const OUT = 'D:/教学app/4-审计与报告/验收-20261110/禁词扫描'
mkdirSync(OUT, { recursive: true })

// 数据缺失类禁用词（真实空态如"暂无待处理差评"不算）
const 禁用 = ['待补', '无公开来源', '无法核算', '无法估算', '装不下', '成本不完整', '缺数据', '未采', '不计费']
const 命中 = []
const sleep = ms => new Promise(r => setTimeout(r, ms))
const 查 = (标签, 文本) => {
  const 中 = 禁用.filter(w => 文本.includes(w))
  if (中.length) {
    const 片段 = 中.map(w => {
      const i = 文本.indexOf(w)
      return w + ' ⇢ ' + 文本.slice(Math.max(0, i - 24), i + 24).replace(/\s+/g, ' ')
    })
    return { 标签, 中, 片段 }
  }
  return null
}

const b = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true, args: ['--no-proxy-server', '--ignore-certificate-errors', '--mute-audio'],
})
const 新页 = async (w = 390) => {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, ignoreHTTPSErrors: true, isMobile: w < 800, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  p.on('pageerror', () => {})
  return p
}
const 扫 = async (p, 标签) => {
  const t = (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, ' ')
  const r = 查(标签, t)
  if (r) 命中.push(r)
  console.log((r ? '❌ ' : '✅ ') + 标签 + (r ? ' · 命中 ' + r.中.join('、') : ''))
  await p.screenshot({ path: `${OUT}/${标签.replace(/[\/\\:*?"<>|\s]/g, '_')}.png`, fullPage: true }).catch(() => {})
}

try {
  // ── A 路：线上真账号（学生 20240907 / 老师 t2026）──
  const p = await 新页()
  await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 }); await sleep(1800)
  await 扫(p, 'A1-首屏')

  await p.getByText('我是学生').last().click(); await sleep(1000)
  await p.locator('input').first().fill('20240907')
  await p.locator('input[type=password]').first().fill('Yunyue2026')
  await p.getByRole('button', { name: /^登录$/ }).click(); await sleep(6000)
  await 扫(p, 'A2-学生经营页')

  // 决策面板
  await p.getByText('去决策').last().click().catch(() => {}); await sleep(2200)
  await 扫(p, 'A3-决策面板')
  const 关 = await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find(y => /返回|关闭|×/.test((y.innerText || '').trim())); if (x) { x.click(); return true } return false })
  if (关) await sleep(1200)

  // 老师端
  const pt = await 新页()
  await pt.goto(BASE, { waitUntil: 'domcontentloaded' }); await sleep(1500)
  await pt.evaluate(() => localStorage.clear()); await pt.reload(); await sleep(1800)
  await pt.getByText('我是老师').last().click(); await sleep(1000)
  await pt.locator('input').first().fill('t2026')
  await pt.locator('input[type=password]').first().fill('Yunyue2026')
  await pt.getByRole('button', { name: /^登录$/ }).click(); await sleep(6500)
  await 扫(pt, 'A4-教师后台')

  // ── B 路：离线演示（走同一批 .jsx，且不污染线上）──
  const po = await 新页()
  await po.goto(BASE, { waitUntil: 'domcontentloaded' }); await sleep(1500)
  await po.evaluate(() => localStorage.clear()); await po.reload(); await sleep(1800)
  await po.getByText('我是学生').last().click(); await sleep(1000)
  await po.getByText('离线演示').last().click(); await sleep(1500)
  await po.getByText('进入演示').last().click().catch(() => {}); await sleep(2500)
  await 扫(po, 'B1-离线演示欢迎页')
  await po.getByRole('button', { name: /开始我的酒店之旅/ }).click().catch(() => {}); await sleep(2500)
  await 扫(po, 'B2-离线选址页')

  // 选区县 → 三预言 → 解锁（品牌页数据卡是"待补"高发区）
  await po.evaluate(() => { const el = [...document.querySelectorAll('.district-card')].find(e => (e.innerText || '').includes('高新')); if (el) el.click() })
  await sleep(1800)
  for (const t of ['中1/3', '中', '70%']) {
    await po.evaluate((s) => { const x = [...document.querySelectorAll('button')].find(y => !y.disabled && (y.innerText || '').replace(/\n/g, '').trim() === s); if (x) x.click() }, t)
    await sleep(400)
  }
  await po.evaluate(() => { const x = [...document.querySelectorAll('button')].find(y => !y.disabled && (y.innerText || '').includes('提交预言')); if (x) x.click() }); await sleep(2600)
  await 扫(po, 'B3-离线区县数据卡')
} catch (e) {
  命中.push({ 标签: '脚本异常', 中: [String(e.message).slice(0, 80)], 片段: [] })
  console.log('❌ 脚本异常: ' + String(e.message).slice(0, 120))
} finally {
  await b.close()
}

console.log('\n================ 结果 ================')
if (命中.length === 0) {
  console.log('✓ 渲染层禁词扫描：0 命中（' + BASE + '）')
  process.exit(0)
}
console.log('✗ 命中 ' + 命中.length + ' 处：')
for (const r of 命中) {
  console.log('  · ' + r.标签 + ' → ' + r.中.join('、'))
  for (const f of r.片段) console.log('      ' + f)
}
console.log('\n截图目录：' + OUT)
process.exit(1)
