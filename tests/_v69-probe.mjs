// V69 · 通电前现状实读（2026-10-07 下午 · 线上 99000001 + T099 两态 · 走查单底稿）
import { chromium } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'https://www.2026911301.xyz/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const clickText = t => page.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) { b.click(); return true } return false }, t)
const body = () => page.evaluate(() => document.body.innerText)
const shot = n => page.screenshot({ path: `../4-审计与报告/V69-走查实读/${n}.png` })
const O = []
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 }); await sleep(2500)
await clickText('我是学生'); await sleep(500)
await page.getByPlaceholder('如 20240101').fill('99000001')
await page.getByPlaceholder('至少 6 位').fill('hotel2026')
await page.getByRole('button', { name: '登录', exact: true }).click(); await sleep(6000)
let b = await body()
O.push(`[经营页] 时间行=${(b.match(/第 \d+\/7 天/) || ['无'])[0]} · 时间说明行=${b.includes('日子暂时不前进属正常')} · 三格=${(b.match(/今日入账[\s\S]{0,26}/) || [''])[0].replace(/\n/g, '|')} · 周报按钮=${b.includes('查看本周周报')} · 实时动态条数=${(b.match(/^\[\d{1,2}:\d{2}\]/gm) || []).length}`)
await shot('通电前-经营页')
// 口碑页
await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => (x.textContent || '').trim() === '口碑'); b && b.click() }); await sleep(1200)
b = await body()
O.push(`[口碑页] 待回复差评=${(b.match(/待回复差评 \((\d+)\)/) || ['未出现'])[0]} · 实时评价区=${b.includes('实时评价') || b.includes('即时评价')}`)
await shot('通电前-口碑页')
// 报表页
await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => (x.textContent || '').trim() === '经营'); b && b.click() }); await sleep(800)
await clickText('报表'); await sleep(1500)
b = await body()
O.push(`[报表页] 暂无数据=${b.includes('暂无经营数据')} · 期末时点句=${b.includes('12 周经营结束后将生成期末成绩')} · 趋势解锁句=${b.includes('结算满 2 周后解锁趋势图')}`)
await shot('通电前-报表页')
// 我的页（期末成绩入口存在性）
await page.evaluate(() => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => (x.textContent || '').trim() === '我的'); b && b.click() }); await sleep(1000)
b = await body()
O.push(`[我的页] 最终成绩入口=${b.includes('最终成绩') || b.includes('期末成绩')} · 评语卡=${b.includes('评语')}`)
await shot('通电前-我的页')
// ── 教师端 T099 ──
await page.evaluate(() => localStorage.clear()); await sleep(300)
await page.goto(BASE, { waitUntil: 'networkidle' }); await sleep(2500)
await clickText('我是老师'); await sleep(400)
await page.getByPlaceholder('如 T001').fill('T099')
await page.getByPlaceholder('至少 6 位').fill('hotel2026')
await page.getByRole('button', { name: '登录', exact: true }).click(); await sleep(7000)
b = await body()
O.push(`[教师端] 组行数=${(b.match(/第\d+组|组 \d+/g) || []).length} · 未结算态=${b.includes('未结算')} · 零分显示=${/综合评分/.test(b) && /\b0\b/.test(b.slice(0, 800))} · V63说明行=${b.includes('全班经营时间暂不推进属正常')} · V67时点句=${b.includes('第 7 个游戏日自动出第一份周报')} · 注入入口=${b.includes('注入')}`)
await shot('通电前-教师端')
console.log(O.join('\n'))
await browser.close()
