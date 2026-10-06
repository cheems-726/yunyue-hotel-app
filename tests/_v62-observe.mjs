// V62 批① · 线上复验：未开业态「零动态」≥10 分钟观察（99000001 只观察不提交 · 不清任何状态）
// R62-1 指标精确化：只统计【实时运营动态列表条目】（^[HH:MM] 行）· 逐条打印命中文本 · 排除常驻图例
// 期望（V55+R55-1+V62 修复后）：动态条目 0 · 口碑页 0 条差评 · 三格 0（快照缺失不显示估算值）
import { chromium } from 'playwright-core'
import { writeFileSync, appendFileSync, mkdirSync } from 'node:fs'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.V62_BASE || 'https://www.2026911301.xyz/'
const SHOT = '../4-审计与报告/V62-线上观察'
const LOG = '../4-审计与报告/V62-线上观察/观察记录.md'
mkdirSync(SHOT, { recursive: true })
const ts = () => new Date().toLocaleTimeString('zh-CN', { hour12: false })
const log = m => { const line = `- ${ts()} ${m}`; console.log(line); appendFileSync(LOG, line + '\n') }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const body = () => page.evaluate(() => document.body.innerText)

writeFileSync(LOG, `# V62 线上观察记录（99000001 · 未开业态 · 只观察不提交 · R62-1 精确指标版）\n\n- 开跑：${new Date().toLocaleString('zh-CN')}\n`)
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 }); await sleep(2500)
log('线上已打开')
await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === '我是学生' || x.textContent.includes('我是学生')); b && b.click() }); await sleep(500)
await page.getByPlaceholder('如 20240101').fill('99000001')
await page.getByPlaceholder('至少 6 位').fill('hotel2026')
await page.getByRole('button', { name: '登录', exact: true }).click(); await sleep(6000)
let b = await body()
log(`登录后：经营页=${b.includes('本周经营中') || b.includes('资金状况')} · 含时间不推进说明行=${b.includes('日子暂时不前进属正常')}`)

if (!b.includes('资金状况') && !b.includes('本周经营中')) {
  log('✗ 未落在经营页——记三件：①现场片段②不强行走流程③替代途径=决策端复核账号态')
  await page.screenshot({ path: `${SHOT}/异常-登录后落点.png` })
  await browser.close(); process.exit(1)
}

const snap = async (tag) => {
  const t = await body()
  const 条目 = await page.evaluate(() => {
    const lines = document.body.innerText.split('\n').map(x => x.trim())
    return lines.filter(l => /^\[\d{1,2}:\d{2}\]/.test(l))
  })
  const 差评待回复 = (t.match(/待回复差评 \((\d+)\)/) || [])[1] || null
  await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => (x.textContent || '').trim() === '口碑'); if (b) b.click() })
  await sleep(900)
  const t2 = await body()
  const 差评2 = (t2.match(/待回复差评 \((\d+)\)/) || [])[1] || null
  await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => (x.textContent || '').trim() === '经营'); if (b) b.click() })
  await sleep(900)
  const t3 = await body()
  const 三格段 = (t3.match(/今日入账[\s\S]{0,40}/) || [''])[0].replace(/\n/g, '|')
  log(`[观察] ${tag} · 动态条目数=${条目.length}${条目.length ? ' · 逐条=' + JSON.stringify(条目) : ''} · 口碑待回复差评=${差评2 ?? 差评待回复} · 三格段=${三格段.slice(0, 46)}`)
  return { 条目, 差评: Number(差评2 ?? 差评待回复 ?? 0) }
}

log('── 观察窗口开始（12 分钟 · 每 120 秒快照 · R62-1 精确指标）──')
const t0 = new Date()
const results = []
for (let i = 0; i < 6; i++) {
  results.push(await snap(`第${i + 1}次`))
  if (i === 0) await page.screenshot({ path: `${SHOT}/R62-1起点-经营页.png` })
  await sleep(120000)
}
await page.screenshot({ path: `${SHOT}/R62-1终点-经营页.png` })
await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => (x.textContent || '').trim() === '口碑'); b && b.click() }); await sleep(1200)
await page.screenshot({ path: `${SHOT}/R62-1终点-口碑页.png` })
const 分钟 = ((new Date() - t0) / 60000).toFixed(1)
log(`── 观察窗口结束（历时 ${分钟} 分钟）──`)
const 有动态 = results.some(r => r.条目.length > 0)
const 有差评 = results.some(r => r.差评 > 0)
log(`判定：动态条目=${有动态 ? '有（✗）' : '无（✓ 零动态）'} · 差评=${有差评 ? '有（✗）' : '无（✓）'}`)
console.log(有动态 || 有差评 ? '✗ V62 复验不通过' : '✓ V62 复验通过（零动态 · 0 差评 · R62-1 精确指标）')
await browser.close()
process.exit(有动态 || 有差评 ? 1 : 0)
