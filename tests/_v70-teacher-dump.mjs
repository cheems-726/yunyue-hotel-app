// V70 · 教师端入口盘点（T099 线上只读）：dump 全部可点元素与视图切换，供速查卡逐条实测
import { chromium } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'https://www.2026911301.xyz/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const clickText = t => page.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) { b.click(); return true } return false }, t)
const body = () => page.evaluate(() => document.body.innerText)
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 }); await sleep(2500)
await clickText('我是老师'); await sleep(400)
await page.getByPlaceholder('如 T001').fill('T099')
await page.getByPlaceholder('至少 6 位').fill('hotel2026')
await page.getByRole('button', { name: '登录', exact: true }).click(); await sleep(7000)
// 首屏 dump：全部 button/可点文本（去重）
const dump = () => page.evaluate(() => {
  const items = [...document.querySelectorAll('button, [role=button], .tab, .city-tab')].map(b => (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)).filter(t => t && t.length <= 20)
  return [...new Set(items)]
})
console.log('── 首屏可点元素 ──')
console.log(JSON.stringify(await dump(), null, 0))
// 逐个疑似导航词点击并抓片段
const navs = ['分组管理', '决策流水', '操作记录', '事件', '领班', '授权', '注入', '报表', '报告', '导出', '成绩', '排名', '批注', '通知', '公告', '设置', '开学', '口碑', '投诉', '存档', '备份', '帮助', '指引', '评分']
for (const n of navs) {
  const hit = await clickText(n)
  if (hit) {
    await sleep(1100)
    const b = await body()
    const frag = b.slice(0, 150).replace(/\n/g, '|')
    console.log(`点「${n}」⇒ ${frag}`)
    // 回到总览
    await clickText('总览').catch(() => {}); await sleep(500)
  }
}
await browser.close()
