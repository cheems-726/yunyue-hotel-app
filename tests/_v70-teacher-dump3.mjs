// V70 第二轮修 · 精确匹配导航（text 全等）逐 tab 实读
import { chromium } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'https://www.2026911301.xyz/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const body = () => page.evaluate(() => document.body.innerText)
const shot = n => page.screenshot({ path: `../4-审计与报告/V70-速查实读/${n}.png` })
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 }); await sleep(2500)
await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === '我是老师' || x.textContent.includes('我是老师')); b && b.click() }); await sleep(400)
await page.getByPlaceholder('如 T001').fill('T099')
await page.getByPlaceholder('至少 6 位').fill('hotel2026')
await page.getByRole('button', { name: '登录', exact: true }).click(); await sleep(7000)
for (const tab of ['实时决策', '排名', '班级总览', '事件注入', 'AI 领班', '分组管理', '教学参考', '我的']) {
  const clicked = await page.evaluate(t => {
    // 全等匹配的可点击候选里取最上层（导航按钮/标签）
    const cands = [...document.querySelectorAll('button, span, div, a')].filter(x => x.textContent.trim() === t && x.offsetParent !== null)
    if (!cands.length) return '无候选'
    const el = cands[cands.length - 1]
    el.click()
    return 'clicked(' + el.tagName + ')'
  }, tab)
  await sleep(1400)
  const b = await body()
  const lines = b.split('\n').map(x => x.trim()).filter(Boolean)
  const bodyLines = lines.slice(0, 26).join(' | ')
  console.log(`◆ ${tab} [${clicked}]`)
  console.log('   ' + bodyLines.slice(0, 260))
  await shot(tab)
}
await browser.close()
