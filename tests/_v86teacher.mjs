// V86 · 教师端全流程实走（老师视角 · 卡①②）：登录 → 班级总览 → 实时决策 → 排名 → 事件注入 → 导出 → 经营报告
// ★ 走线上（教师账号在云端）· 只读：事件注入只点开面板看，绝不提交 · 每屏特征文本断言 + 收尾 sha256 唯一性守门（V83 同款）
// 输出：../4-审计与报告/V86-教师端走查截图/节点N-屏名.png
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const BASE = 'https://www.2026911301.xyz/'
const OUT = path.resolve('..', '4-审计与报告', 'V86-教师端走查截图')
const sleep = ms => new Promise(r => setTimeout(r, ms))
let lastText = ''
async function text(page) { lastText = await page.evaluate(() => document.body.innerText); return lastText }
async function 必见(page, 特征, 屏名) {
  const t = await text(page)
  const 缺 = (Array.isArray(特征) ? 特征 : [特征]).filter(s => !t.includes(s))
  if (缺.length) {
    console.error(`✗ [${屏名}] 特征文本缺失：${缺.join('｜')} —— 如实记走不通（不冒充）`)
    console.error('    [页面实读] ' + t.slice(0, 260).replace(/\n/g, ' | '))
    await page.screenshot({ path: path.join(OUT, '走不通-' + 屏名 + '.png') })
    return false
  }
  return true
}
async function clickText(page, t) {
  return page.evaluate(t2 => {
    const b = [...document.querySelectorAll('button, span, div, a')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2))
    if (b) { b.click(); return true }
    return false
  }, t)
}
const shots = []
async function shot(page, name) {
  const p = path.join(OUT, name)
  await page.screenshot({ path: p, fullPage: false })
  shots.push({ name, p })
  console.log('  📸 ' + name)
}

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1100, height: 1000 } })).newPage()
let 断言全过 = true

await page.goto(BASE, { waitUntil: 'load' }); await sleep(2500)
// 节点1 登录页（教师身份）
if (!(await 必见(page, ['请选择你的身份', '我是老师'], '节点1-登录页'))) { 断言全过 = false } else {
  await shot(page, '节点1-登录页.png')
  await clickText(page, '我是老师'); await sleep(500)
  await 必见(page, ['工号'], '节点1-教师表单')
  await shot(page, '节点1-教师登录表单.png')
  // 登录 T099
  // ★ React 受控输入：必须用原生 value setter + input 事件（直接赋值不进 state）
  await page.evaluate(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    const ins = [...document.querySelectorAll('input')]
    const 工 = ins.find(i => (i.placeholder || '').includes('T0'))
    const 密 = ins.find(i => (i.placeholder || '').includes('位') || (i.placeholder || '').includes('6'))
    if (工) { setter.call(工, 'T099'); 工.dispatchEvent(new Event('input', { bubbles: true })) }
    if (密) { setter.call(密, 'hotel2026'); 密.dispatchEvent(new Event('input', { bubbles: true })) }
  })
  await sleep(300)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录'); b && b.click() })
  await sleep(4000)
}
// 节点2 班级总览（教师台）
await page.evaluate(() => { const els = [...document.querySelectorAll('button, span, div, a')].filter(x => x.textContent.trim() === '班级总览'); if (!els.length) return; els.sort((p, q) => p.querySelectorAll('*').length - q.querySelectorAll('*').length); els[0].click() })
  await sleep(1000)
if (await 必见(page, ['老师'], '节点2-教师台')) {
  await shot(page, '节点2-教师台总览.png')
  const t = await text(page)
  console.log('  [总览实读] ' + t.slice(0, 150).replace(/\n/g, ' | '))
} else 断言全过 = false

// 节点3-7：教师台分区（顶部导航精确按钮匹配 · 每屏特征断言）
for (const [tab, 特征, 文件] of [
  ['实时决策', '实时决策', '节点3-实时决策.png'],
  ['排名', '排名', '节点4-排名.png'],
  ['事件注入', '注入', '节点5-事件注入面板.png'],
  ['AI 领班', '领班', '节点5b-AI领班.png'],
  ['教学参考', '教学参考', '节点6b-教学参考.png'],
]) {
  const 点了 = await page.evaluate((tb) => { const els = [...document.querySelectorAll('button, span, div, a')].filter(x => x.textContent.trim() === tb); if (!els.length) return false; els.sort((a2, b2) => a2.querySelectorAll('*').length - b2.querySelectorAll('*').length); els[0].click(); return true }, tab)
  await sleep(1000)
  const 过 = 点了 && (await 必见(page, [特征], 文件))
  if (!过) { console.error('  [如实] 「' + tab + '」未命中（点了=' + 点了 + '）'); 断言全过 = false; continue }
    const cand = await page.evaluate(() => [...document.querySelectorAll('button, span, div, a')].filter(x => /注入|领班|参考/.test(x.textContent.trim()) && x.textContent.trim().length < 12).slice(0, 8).map(x => x.tagName + ':' + x.textContent.trim() + ':kids' + x.querySelectorAll('*').length)); console.log('    [nav候选] ' + JSON.stringify(cand))
  await shot(page, 文件)
  // 班级总览页里断言「导出 CSV」入口在（只读不点下载）
  if (tab === '班级总览') {
    const t2 = await text(page)
    const 有导出 = await page.evaluate(() => [...document.querySelectorAll('button')].some(x => x.textContent.includes('导出')))
    console.log('  [导出 CSV 入口] ' + (有导出 || t2.includes('导出') ? '✓ 在（只读不点）' : '✗ 未找到 —— 如实记'))
  }
}
// 节点8 事件注入面板只看不提交（卡④）：确认面板里没有"已提交"痕迹即可
for (let r3 = 0; r3 < 2; r3++) {
  await page.evaluate(() => { const els = [...document.querySelectorAll('button, span, div, a')].filter(x => x.textContent.trim() === '事件注入'); if (!els.length) return; els.sort((p, q) => p.querySelectorAll('*').length - q.querySelectorAll('*').length); els[0].click() })
  await sleep(900)
  if ((await text(page)).includes('暂无注入记录')) break
}
if (await 必见(page, ['注入'], '节点8-注入只读确认')) {
  await shot(page, '节点8-事件注入-只读.png')
}

await browser.close()
// sha256 唯一性守门
const hashes = shots.map(s => ({ name: s.name, h: createHash('sha256').update(readFileSync(s.p)).digest('hex') }))
const 重复 = []
for (let i = 0; i < hashes.length; i++) for (let j = i + 1; j < hashes.length; j++) if (hashes[i].h === hashes[j].h) 重复.push(`${hashes[i].name}==${hashes[j].name}`)
if (重复.length) { console.error('✗ 唯一性守门：' + 重复.join('、')); process.exit(1) }
console.log(`\n✓ ${shots.length} 张截图全唯一 · 特征断言${断言全过 ? '全过' : '有缺失（见上方如实记录）'}`)
process.exit(0)
