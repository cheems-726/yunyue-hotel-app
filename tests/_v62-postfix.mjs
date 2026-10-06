// V62 修复后即时复验（本地 dist · 真实 night 窗 h<6 · 99000001 云端号 · 3 分钟窗口）
import { chromium } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.V62_BASE || 'http://localhost:4176/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const ts = () => new Date().toLocaleTimeString('zh-CN', { hour12: false })
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 }); await sleep(2500)
await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === '我是学生' || x.textContent.includes('我是学生')); b && b.click() }); await sleep(500)
await page.getByPlaceholder('如 20240101').fill('99000001')
await page.getByPlaceholder('至少 6 位').fill('hotel2026')
await page.getByRole('button', { name: '登录', exact: true }).click(); await sleep(6000)
const dump = async tag => {
  const r = await page.evaluate(() => {
    const lines = document.body.innerText.split('\n').map(x => x.trim())
    return { feed: lines.filter(l => /^\[\d{1,2}:\d{2}\]/.test(l)), 差评: (document.body.innerText.match(/待回复差评 \((\d+)\)/) || [])[1] ?? '0' }
  })
  console.log(`${ts()} ${tag} feed=${JSON.stringify(r.feed)} 差评=${r.差评}`)
  return r.feed.length
}
console.log('当前小时:', new Date().getHours(), '（<6 = night 窗生效中）')
let total = 0
total += await dump('进场')
for (let i = 0; i < 5; i++) { await sleep(30000); total += await dump(`+${(i + 1) * 30}s`) }
console.log(total === 0 ? '✓ 修复后 night 窗全程零动态' : '✗ 仍有动态 ' + total)
await browser.close()
process.exit(total ? 1 : 0)
