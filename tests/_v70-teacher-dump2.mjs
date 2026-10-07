// V70 第二轮 · 逐 tab 内容实读（每屏截取正文关键句）+ 总览行内按钮
import { chromium } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'https://www.2026911301.xyz/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const clickText = t => page.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) { b.click(); return true } return false }, t)
const body = () => page.evaluate(() => document.body.innerText)
const shot = n => page.screenshot({ path: `../4-审计与报告/V70-速查实读/${n}.png` })
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 }); await sleep(2500)
await clickText('我是老师'); await sleep(400)
await page.getByPlaceholder('如 T001').fill('T099')
await page.getByPlaceholder('至少 6 位').fill('hotel2026')
await page.getByRole('button', { name: '登录', exact: true }).click(); await sleep(7000)
const grab = async (tab, keys) => {
  await clickText(tab); await sleep(1400)
  const b = await body()
  const lines = b.split('\n').map(x => x.trim()).filter(Boolean)
  const hits = keys.map(k => { const l = lines.find(x => x.includes(k)); return k + ' ⇒ ' + (l ? l.slice(0, 60) : '未见') })
  console.log(`◆ ${tab}\n   ${hits.join('\n   ')}`)
  await shot(tab)
}
await grab('实时决策', ['流水', '条目', '暂无', '决策'])
await grab('排名', ['综合评分', '四维', '未结算', '经营报告', '第 1 组', '99000001'])
await grab('班级总览', ['出租率', '净利润', 'GOP', '口碑', '进度落后', '导出', 'CSV'])
await grab('事件注入', ['内置', '自定义', '注入', '生效', '全班'])
await grab('AI 领班', ['授权', '领班', '默认'])
await grab('分组管理', ['新建', '组号', '成员', '移除', '加入'])
await grab('教学参考', ['参考', '课件', '讲义', '指引'])
await grab('我的', ['T099', '退出', '备份', '版本'])
// 总览首屏行内按钮（经营报告/批注/下钻）
await clickText('班级总览'); await sleep(1200)
const btns = await page.evaluate(() => [...new Set([...document.querySelectorAll('button')].map(b => (b.textContent || '').trim().slice(0, 18)).filter(t => t && t.length <= 14))])
console.log('◆ 班级总览行内按钮：', JSON.stringify(btns))
await browser.close()
