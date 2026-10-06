// V53 · 证照弹层本地信息验证（点「申领营业执照」⇒ 弹层含 办理地点/材料/依据/来源/免责）+ 截图
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\154.0.4258.53\\msedge.exe'
const PORT = 4176, BASE = `http://localhost:${PORT}/`
const SHOT = '../4-审计与报告/V53-证照详情截图'
const sleep = ms => new Promise(r => setTimeout(r, ms))
let server = null
try { await fetch(BASE) } catch (e) { server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true }); for (let i = 0; i < 30; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch (e) {} await sleep(300) } }
mkdirSync(SHOT, { recursive: true })
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await page.emulateMedia({ colorScheme: 'dark' })
const clickText = t => page.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) { b.click(); return true } return false }, t)
const clickCard = (t, mode = 'includes') => page.evaluate(({ t, mode }) => { const ms = [...document.querySelectorAll('.district-card, div')].filter(x => mode === 'starts' ? x.textContent.startsWith(t) : x.textContent.includes(t)); if (!ms.length) return false; const inner = ms.reverse().find(x => !ms.some(y => y !== x && x.contains(y))); inner.click(); return true }, { t, mode })
await page.goto(BASE); await sleep(2500)
await clickText('我是学生'); await sleep(400); await clickText('无网络？离线演示'); await sleep(400); await clickText('进入演示'); await sleep(600); await clickText('开始我的酒店之旅'); await sleep(900)
await clickCard('锦江区'); await sleep(500); await clickText('明白了'); await sleep(300)
await clickText('确认选址'); await sleep(700)
await page.getByText('全季', { exact: true }).last().click(); await sleep(450)
await clickText('确认选择'); await sleep(700)
await clickCard('自主直营'); await sleep(400); await clickText('确认'); await sleep(650)
await clickCard('商圈核心物业'); await sleep(400)
for (let i = 0; i < 7; i++) { const done = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('完成认领')); if (b) { b.click(); return true } const n = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('下一步')); if (n) { n.click(); return false } return false }); await sleep(550); if (done) break }
await sleep(800)
// 筹建：投资测算 → 证照办理
await clickCard('基准情景', 'starts'); await sleep(500); await clickText('明白了'); await sleep(300)
await clickText('完成「投资测算」'); await sleep(900)
// 第四步证照：点「申领营业执照」卡
const clicked = await page.evaluate(() => {
  const els = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.trim() === '申领营业执照')
  const el = els.pop()
  if (!el) return '未找到证照卡'
  let n = el
  for (let i = 0; i < 5 && n; i++) { if (n.onclick) { n.click(); return 'clicked(ancest' + i + ')' } n = n.parentElement }
  el.click(); return 'leaf clicked'
})
await sleep(1200)
const r = await page.evaluate(() => {
  const b = document.body.innerText
  return {
    弹层标题含本地办事信息: b.includes('本地办事信息'),
    办理地点行: b.includes('办理地点 · 线上') && b.includes('办理地点 · 线下'),
    政务网域名: b.includes('www.sczwfw.gov.cn'),
    材料清单行: b.includes('材料清单'),
    依据法规: b.includes('市场主体登记管理条例'),
    来源含实测日期: b.includes('2026-10-06 实测可达'),
    教学免责: b.includes('教学演示'),
  }
})
console.log('点击:', clicked, '\n', JSON.stringify(r, null, 1))
const okAll = Object.values(r).every(Boolean)
const shot = await page.screenshot()
writeFileSync(`${SHOT}/证照弹层-本地信息-暗色.png`, Buffer.from(shot))
console.log('截图已存:', `${SHOT}/证照弹层-本地信息-暗色.png`)
await browser.close()
console.log(okAll ? '✓ V53 验收全过' : '✗ V53 验收失败')
process.exit(okAll ? 0 : 1)
