// V62 批② · 精确核对：抓实时运营动态【条目本体】+ 全页含"退房/入住/到店"的行原文（辨静态文案 vs 幻影事件）
import { chromium } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'https://www.2026911301.xyz/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const ts = () => new Date().toLocaleTimeString('zh-CN', { hour12: false })
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const body = () => page.evaluate(() => document.body.innerText)
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 }); await sleep(2500)
await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === '我是学生' || x.textContent.includes('我是学生')); b && b.click() }); await sleep(500)
await page.getByPlaceholder('如 20240101').fill('99000001')
await page.getByPlaceholder('至少 6 位').fill('hotel2026')
await page.getByRole('button', { name: '登录', exact: true }).click(); await sleep(6000)

const dump = async (tag) => {
  const r = await page.evaluate(() => {
    // 实时运营动态块的条目：找标题行后面的兄弟 feed 行（[HH:MM] 开头的行）
    const lines = document.body.innerText.split('\n').map(x => x.trim())
    const feedLines = lines.filter(l => /^\[\d{1,2}:\d{2}\]/.test(l))
    const hitLines = lines.filter(l => /退房|入住|到店/.test(l))
    return { feedLines, hitLines }
  })
  console.log(`── ${ts()} ${tag} ──`)
  console.log('feed条目本体:', JSON.stringify(r.feedLines))
  console.log('含词行原文:', JSON.stringify(r.hitLines))
  return r
}
const a = await dump('进场')
for (let i = 0; i < 6; i++) { await sleep(30000); await dump(`+${(i + 1) * 30}s`) }
await browser.close()
console.log(a.feedLines.length === 0 ? '✓ 全程 feed 零条目（幻影退房链已断）' : '✗ feed 有条目 ⬆ 见原文')
