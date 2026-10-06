// V54批2 · 浏览器验收（真机走查）：证照排序交互 + 延误警告 + 不可逆预告
// 走线照抄 _v59-verify（离线演示 · 稳定）：选址 → 品牌 → 认领 → 筹建·证照步
// 判据（与 v54Flow.test.mjs 同一状态机表口径 · 纯 UI 验收，引擎零改动）：
//   D1/D2. 选址页与品牌页确认条带「本学期不可更改」副文案
//   A. 证照步初始 = 真实顺序 ⇒ 绿色「顺序合理」+ 下一步可点
//   B. 点营业执照 ↓ ⇒ 红「延误警告」（含为什么）+ 完成按钮禁用且文案说明原因
//   C. 再点 ↑ 复原 ⇒ 绿色回归 + 完成按钮恢复可点
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4176, BASE = `http://localhost:${PORT}/`
const SHOT = '../4-审计与报告/V54-验收截图'
const sleep = ms => new Promise(r => setTimeout(r, ms))
mkdirSync(SHOT, { recursive: true })
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const clickText = t => page.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) { b.click(); return true } return false }, t)
const clickCard = (t, mode = 'includes') => page.evaluate(({ t, mode }) => { const ms = [...document.querySelectorAll('.district-card, div')].filter(x => mode === 'starts' ? x.textContent.startsWith(t) : x.textContent.includes(t)); if (!ms.length) return false; const inner = ms.reverse().find(x => !ms.some(y => y !== x && x.contains(y))); inner.click(); return true }, { t, mode })
const body = () => page.evaluate(() => document.body.innerText)
const r = {}

await page.goto(BASE); await sleep(2500)
await clickText('我是学生'); await sleep(400); await clickText('无网络？离线演示'); await sleep(400); await clickText('进入演示'); await sleep(700); await clickText('开始我的酒店之旅'); await sleep(1300)

// ── D1. 选址页不可逆预告 ──
r['D1 选址不可更改预告'] = (await body()).includes('选址确认后本学期不可更改')
await page.screenshot({ path: `${SHOT}/D1-选址不可逆预告.png` }).catch(() => {})
await clickCard('锦江区'); await sleep(500); await clickText('明白了'); await sleep(300)
await clickText('确认选址'); await sleep(700)

// ── D2. 品牌页不可逆预告 ──
r['D2 品牌不可更改预告'] = (await body()).includes('品牌确认后本学期不可更改')
await page.screenshot({ path: `${SHOT}/D2-品牌不可逆预告.png` }).catch(() => {})
await page.getByText('全季', { exact: true }).last().click(); await sleep(450)
await clickText('确认选择'); await sleep(700)
await clickCard('自主直营'); await sleep(400); await clickText('确认'); await sleep(650)
await clickCard('商圈核心物业'); await sleep(400)
for (let i = 0; i < 10; i++) { const done = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('完成认领')); if (b) { b.click(); return true } const n = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('确认无误')); if (n) { n.click(); return false } return false }); await sleep(600); if (done) break }
await sleep(800)
await clickCard('基准情景', 'starts'); await sleep(500); await clickText('明白了'); await sleep(300)
await clickText('完成「投资测算」'); await sleep(900)

// ── 证照步验收 ──
let b = await body()
r['E0 到达证照步'] = b.includes('证照办理顺序')
r['A1 初始绿色顺序合理'] = b.includes('✓ 顺序合理')
const 可点1 = await page.evaluate(() => { const x = [...document.querySelectorAll('button')].find(b => b.textContent.includes('完成「证照办理」')); return x ? !x.disabled : null })
r['A2 初始完成按钮可点'] = 可点1 === true
await page.screenshot({ path: `${SHOT}/A-初始顺序合理.png` })

// B. 营业执照 ↓ ⇒ 红警告 + 拦截
await page.evaluate(() => { const x = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').includes('营业执照') && (b.getAttribute('aria-label') || '').includes('下移')); if (x) x.click() }); await sleep(500)
b = await body()
r['B1 打乱出延误警告'] = b.includes('延误警告')
r['B2 警告含为什么'] = b.includes('没有主体资格')
const 禁用 = await page.evaluate(() => { const x = [...document.querySelectorAll('button')].find(b => b.textContent.includes('完成「证照办理」') || b.textContent.includes('证照前后置未排对')); return x ? x.disabled : null })
r['B3 完成按钮被拦'] = 禁用 === true
r['B4 拦截文案说明原因'] = b.includes('证照前后置未排对')
await page.screenshot({ path: `${SHOT}/B-延误警告拦截.png` })

// C. ↑ 复原 ⇒ 绿回归 + 恢复
await page.evaluate(() => { const x = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').includes('营业执照') && (b.getAttribute('aria-label') || '').includes('上移')); if (x) x.click() }); await sleep(500)
b = await body()
r['C1 复原绿色回归'] = b.includes('✓ 顺序合理')
const 可点2 = await page.evaluate(() => { const x = [...document.querySelectorAll('button')].find(b => b.textContent.includes('完成「证照办理」')); return x ? !x.disabled : null })
r['C2 复原按钮恢复'] = 可点2 === true
await page.screenshot({ path: `${SHOT}/C-复原放行.png` })

console.log(JSON.stringify(r, null, 1))
await browser.close()
const need = Object.keys(r)
const 失败 = need.filter(k => r[k] !== true)
console.log(失败.length ? '✗ V54 验收失败: ' + 失败.join(' · ') : '✓ V54 验收全过（12/12 · 截图3张在 ' + SHOT + '）')
process.exit(失败.length ? 1 : 0)
