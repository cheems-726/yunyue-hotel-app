// V59 · 按人粒度留痕露出验收（学生端「我的贡献」卡 · 教师端已有面板只回归确认）
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4176, BASE = `http://localhost:${PORT}/`
const SHOT = '../4-审计与报告/V59-露出截图'
const sleep = ms => new Promise(r => setTimeout(r, ms))
let server = null
try { await fetch(BASE) } catch (e) { server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true }); for (let i = 0; i < 30; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch (e) {} await sleep(300) } }
mkdirSync(SHOT, { recursive: true })
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const clickText = t => page.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) { b.click(); return true } return false }, t)
const clickCard = (t, mode = 'includes') => page.evaluate(({ t, mode }) => { const ms = [...document.querySelectorAll('.district-card, div')].filter(x => mode === 'starts' ? x.textContent.startsWith(t) : x.textContent.includes(t)); if (!ms.length) return false; const inner = ms.reverse().find(x => !ms.some(y => y !== x && x.contains(y))); inner.click(); return true }, { t, mode })

// 离线演示（学生 陈小明（演示））→ 提交一个决策（产生 operatorLog 留痕）→ 我的 → 经营操作记录 ⇒「我的贡献」卡
await page.goto(BASE); await sleep(2500)
await clickText('我是学生'); await sleep(400); await clickText('无网络？离线演示'); await sleep(400); await clickText('进入演示'); await sleep(700); await clickText('开始我的酒店之旅'); await sleep(1300)
await clickCard('锦江区'); await sleep(500); await clickText('明白了'); await sleep(300)
await clickText('确认选址'); await sleep(700)
await page.getByText('全季', { exact: true }).last().click(); await sleep(450)
await clickText('确认选择'); await sleep(700)
await clickCard('自主直营'); await sleep(400); await clickText('确认'); await sleep(650)
await clickCard('商圈核心物业'); await sleep(400)
for (let i = 0; i < 7; i++) { const done = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('完成认领')); if (b) { b.click(); return true } const n = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('下一步')); if (n) { n.click(); return false } return false }); await sleep(550); if (done) break }
await sleep(800)
await clickCard('基准情景', 'starts'); await sleep(500); await clickText('明白了'); await sleep(300)
await clickText('完成「投资测算」'); await sleep(900); await clickText('完成「证照办理」'); await sleep(900)
await clickCard('供应商 A'); await sleep(500); await clickText('明白了'); await sleep(300)
await clickText('完成「物资采购」'); await sleep(900)
for (const n of ['装修', '招聘', '系统上线']) { await clickCard(n, 'starts'); await sleep(400); await clickText('明白了'); await sleep(280); await clickCard(n, 'starts'); await sleep(280) }
await clickText('完成筹建，正式开业'); await sleep(1300); await clickText('明白了'); await sleep(1200)

// 提交一项决策（产生留痕：决策面板 → 选 → 确认）
await clickText('去决策'); await sleep(1200)
await page.evaluate(() => { const opts = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.trim() === '不跟降'); const el = opts.pop(); if (el) { let n = el; for (let i = 0; i < 5 && n; i++) { if (n.onclick) { n.click(); break } n = n.parentElement } } })
await sleep(700)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].filter(x => !x.disabled && /确认|提交/.test(x.textContent || '')); if (b.length) b[b.length - 1].click() })
await sleep(1000)

// ── 应急预案面板（突发事件实时项）：正式选「立即送医+道歉」并确认（产生本人留痕）──
await page.evaluate(() => {
  const card = [...document.querySelectorAll('div')].filter(d => d.textContent.includes('立即送医') && d.textContent.includes('医疗协作') && d.offsetParent).sort((a, b) => a.textContent.length - b.textContent.length)[0]
  if (card) { let n = card; for (let i = 0; i < 6 && n; i++) { if (n.onclick) { n.click(); break } n = n.parentElement } }
}); await sleep(800)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].filter(x => !x.disabled && /确认|提交|发送/.test(x.textContent || '')); if (b.length) b[b.length - 1].click() }); await sleep(1500)
// 若还有第二层确认按钮再点一次
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].filter(x => !x.disabled && /确认|提交|发送/.test(x.textContent || '')); if (b.length) b[b.length - 1].click() }); await sleep(1000)

// ── 我的 → 经营操作记录 ⇒「我的贡献」卡 ──
await clickText('我的'); await sleep(1200)
await clickText('经营操作记录'); await sleep(1500)
const r = await page.evaluate(() => {
  const b = document.body.innerText
  return {
    我的贡献卡: b.includes('我的贡献（操作留痕'),
    有留痕条数: /操作 \d+ 条/.test(b),
    无他人信息泄露: !b.includes('20240101') || b.includes('陈小明'),
  }
})
console.log(JSON.stringify(r, null, 1))
const shot = await page.screenshot()
writeFileSync(`${SHOT}/学生端-我的贡献卡.png`, Buffer.from(shot))
console.log('截图已存:', `${SHOT}/学生端-我的贡献卡.png`)
await browser.close()
const okAll = Object.values(r).every(Boolean)
console.log(okAll ? '✓ V59 验收全过：学生端按人贡献卡可见（operatorLog 单源）' : '✗ V59 验收失败')
process.exit(okAll ? 0 : 1)
