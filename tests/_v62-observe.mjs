// V62 批① · 线上复验：未开业态「零动态」≥10 分钟观察（99000001 只观察不提交 · 不清任何状态）
// 期望（V55+R55-1 之后）：无退房/到店动态 · 口碑页 0 条差评 · 三格「—」或未开业
// 红线：观察窗口起止时间写入记录（可证伪）· 不点任何提交类按钮
import { chromium } from 'playwright-core'
import { writeFileSync, appendFileSync, mkdirSync } from 'node:fs'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'https://www.2026911301.xyz/'
const SHOT = '../4-审计与报告/V62-线上观察'
const LOG = '../4-审计与报告/V62-线上观察/观察记录.md'
mkdirSync(SHOT, { recursive: true })
const ts = () => new Date().toLocaleTimeString('zh-CN', { hour12: false })
const log = m => { const line = `- ${ts()} ${m}`; console.log(line); appendFileSync(LOG, line + '\n') }
writeFileSync(LOG, `# V62 线上观察记录（99000001 · 未开业态 · 只观察不提交）\n\n- 开跑：${new Date().toLocaleString('zh-CN')}\n`)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const body = () => page.evaluate(() => document.body.innerText)

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 }); await sleep(2500)
log('线上已打开')
await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === '我是学生' || x.textContent.includes('我是学生')); b && b.click() }); await sleep(500)
await page.getByPlaceholder('如 20240101').fill('99000001')
await page.getByPlaceholder('至少 6 位').fill('hotel2026')
await page.getByRole('button', { name: '登录', exact: true }).click(); await sleep(6000)
let b = await body()
log(`登录后：经营页=${b.includes('本周经营中') || b.includes('资金状况')} · 欢迎/选址=${b.includes('开始我的酒店之旅') || b.includes('第一步 · 选址')} · 含演示角标=${b.includes('演示模式 · 数据只存本机')}`)

// 若落在未选址态（该账号云端档未含选址？）则记三件不硬走（登录 99000001 的云端档应直达经营页）
if (!b.includes('资金状况') && !b.includes('本周经营中')) {
  log('✗ 未落在经营页（云端档状态异常）——记三件：①现场页面片段②不强行走流程（红线：只观察）③替代途径=决策端复核账号态')
  await page.screenshot({ path: `${SHOT}/异常-登录后落点.png` })
  console.log('片段：', b.slice(0, 160).replace(/\n/g, '|'))
  await browser.close(); process.exit(1)
}

const snap = async (tag) => {
  const t = await body()
  const 退房到店 = (t.match(/退房结账|办理入住|到店/g) || []).length
  const 差评待回复 = (t.match(/待回复差评 \((\d+)\)/) || [])[1] || null
  await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === '我的' || x.textContent.trim() === '口碑'); if (b) b.click() })
  await sleep(900)
  const t2 = await body()
  const 差评2 = (t2.match(/待回复差评 \((\d+)\)/) || [])[1] || null
  const 好评条 = (t2.match(/近期好评/) || []).length
  // 回经营页
  await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === '经营'); if (b) b.click() })
  await sleep(900)
  const t3 = await body()
  const 三格段 = (t3.match(/今日入账[\s\S]{0,60}/) || [''])[0].replace(/\n/g, '|')
  log(`[观察] ${tag} · 动态含退房/入住/到店词=${退房到店} · 口碑待回复差评=${差评2 ?? 差评待回复} · 近期好评块=${好评条} · 三格段=${三格段.slice(0, 50)}`)
  return { 退房到店, 差评: 差评2 ?? 差评待回复 }
}

log('── 观察窗口开始（≥10 分钟 · 每 120 秒快照）──')
const t0 = new Date()
const results = []
for (let i = 0; i < 6; i++) {
  results.push(await snap(`第${i + 1}次`))
  if (i === 0) await page.screenshot({ path: `${SHOT}/观察起点-经营页.png` })
  await sleep(120000)
}
await page.screenshot({ path: `${SHOT}/观察终点-经营页.png` })
await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => (x.textContent || '').trim() === '口碑'); b && b.click() }); await sleep(1200)
await page.screenshot({ path: `${SHOT}/观察终点-口碑页.png` })
const 分钟 = ((new Date() - t0) / 60000).toFixed(1)
log(`── 观察窗口结束（历时 ${分钟} 分钟）──`)
const 有动态 = results.some(r => r.退房到店 > 0)
const 有差评 = results.some(r => r.差评 && Number(r.差评) > 0)
log(`判定：全程动态=${有动态 ? '有（✗ 不达零动态）' : '无（✓）'} · 全程差评=${有差评 ? '有（✗）' : '无（✓）'}`)
console.log(有动态 || 有差评 ? '✗ V62 复验不通过' : '✓ V62 复验通过（零动态 · 0 差评）')
await browser.close()
process.exit(有动态 || 有差评 ? 1 : 0)
