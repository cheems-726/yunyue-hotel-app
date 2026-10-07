// V67 批① · 三处空态实测（线上 99000001 + 离线演示 各一遍）：周报页 / 期末成绩页 / 教师端成绩区
import { chromium } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const clickText = t => page.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) { b.click(); return true } return false }, t)
const body = () => page.evaluate(() => document.body.innerText)
const shot = n => page.screenshot({ path: `../4-审计与报告/V67-空态实测/${n}.png` })
const out = []
const probe = async (tag, 想点) => {
  const t = await body()
  const has = w => t.includes(w)
  out.push(`【${tag}】周报入口=${has('周报')} · 成绩=${has('成绩')} · 空态说明类文字=${has('解锁') || has('首次周结算') || has('还没有') || has('尚未')} · 片段=${t.slice(0, 80).replace(/\n/g, '|')}`)
  await shot(tag)
}

// ── 线上 99000001（未开业·第1/7天）──
await page.goto('https://www.2026911301.xyz/', { waitUntil: 'networkidle', timeout: 45000 }); await sleep(2500)
await clickText('我是学生'); await sleep(400)
await page.getByPlaceholder('如 20240101').fill('99000001')
await page.getByPlaceholder('至少 6 位').fill('hotel2026')
await page.getByRole('button', { name: '登录', exact: true }).click(); await sleep(6000)
// 周报相关：经营页有没有周报入口/按钮
let b = await body()
console.log('线上-经营页：周报按钮=' + (b.includes('查看本周周报') || b.includes('周报')), '· 指标解锁说明=' + b.includes('首次周结算后解锁'))
await shot('线上-经营页')
// 找周报/成绩/评分入口
for (const t of ['周报', '成绩', '评分', '报表']) {
  const okClick = await clickText(t)
  if (okClick) { await sleep(1200); await probe('线上-点「' + t + '」'); await page.goBack().catch(() => {}); await sleep(800) }
}
// 我的页有没有成绩入口
await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => (x.textContent || '').trim() === '我的'); b && b.click() }); await sleep(1000)
await probe('线上-我的页')

// ── 离线演示（新店未开业）──
await page.evaluate(() => localStorage.clear()); await sleep(300)
await page.goto('https://www.2026911301.xyz/', { waitUntil: 'networkidle' }); await sleep(2500)
await clickText('我是学生'); await sleep(400); await clickText('无网络？离线演示'); await sleep(400); await clickText('进入演示'); await sleep(700); await clickText('开始我的酒店之旅'); await sleep(1300)
await probe('离线-选址页')
console.log(out.join('\n'))
await browser.close()
