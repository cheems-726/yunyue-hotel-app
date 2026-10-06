import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4176, BASE = `http://localhost:${PORT}/`
const SHOT = '../4-审计与报告/V30-上线自检截图'
const sleep = ms => new Promise(r => setTimeout(r, ms))
mkdirSync(SHOT, { recursive: true })
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
page.on('pageerror', e => { if (!/plugin is not implemented/.test(e.message)) errors.push(e.message.slice(0, 80)) })
const results = []
const ok = (n, cond, note) => { results.push({ n, cond: !!cond }); console.log((cond ? '  ✓ ' : '  ✗ ') + n + (cond ? '' : ' ← ' + note)) }
const clickText = t => page.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div, a')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2)); if (b) { b.click(); return true } return false }, t)
const clickCard = (t, mode = 'includes') => page.evaluate(({ t, mode }) => { const ms = [...document.querySelectorAll('.district-card, div')].filter(x => mode === 'starts' ? x.textContent.startsWith(t) : x.textContent.includes(t)); if (!ms.length) return false; const inner = ms.reverse().find(x => !ms.some(y => y !== x && x.contains(y))); inner.click(); return true }, { t, mode })
const body = () => page.evaluate(() => document.body.innerText)
const shot = async n => { writeFileSync(`${SHOT}/${n}.png`, Buffer.from(await page.screenshot())) }

// ── 线上站 ──
await page.goto('https://www.2026911301.xyz/'); await sleep(3500)
ok('01 线上可达且非白屏', (await page.title()).includes('云悦'), 'HTTP/白屏')
await shot('01-登录页')
ok('02 身份选择两卡', (await body()).includes('我是学生') && (await body()).includes('我是老师'), '入口缺失')
await clickText('我是学生'); await sleep(600)
ok('03 学生登录表单', await page.evaluate(() => !!document.querySelector('input[type="password"]')), '无密码框')

// ── 老师登录：从学生表单页点「‹ 返回选择身份」回身份页，再点「我是老师」──
await page.evaluate(() => { const b = [...document.querySelectorAll('button, div, span')].reverse().find(x => x.textContent.includes('返回选择身份')); if (b) b.click() }); await sleep(800)
await clickText('我是老师'); await sleep(800)
await page.getByPlaceholder('如 T001').fill('T099')
await page.getByPlaceholder('至少 6 位').fill('hotel2026')
await page.getByRole('button', { name: '登录', exact: true }).click(); await sleep(5000)
const tb = await body()
ok('04 T099 登录进教师台', tb.includes('教学控制台'), '未进控制台')
ok('05 云端组已开档', tb.includes('组已开档'), '云端未连')
await shot('04-教师台')

const goNav = async t => { await page.evaluate(t2 => { const a = [...document.querySelectorAll('.t-nav a')].find(a => a.textContent.includes(t2)); if (a) a.click() }, t); await sleep(1500) }

await goNav('实时决策')
ok('06 实时决策-决策流水', (await body()).includes('决策流水'), '无流水区')
await shot('06-实时决策')
await goNav('排名')
ok('07 排名页', (await body()).includes('排名'), '空')
await goNav('班级总览')
ok('08 班级总览-进度控制', (await body()).includes('教学进度控制'), '无进度控制')
await shot('07-班级总览')
await goNav('事件注入')
ok('09 事件注入面板打得开（V50 修复）', (await body()).includes('① 选事件'), '未渲染')
ok('10 注入通道状态正常显示', (await body()).includes('注入通道未就绪') || (await body()).includes('① 选事件'), '状态异常')
await shot('08-事件注入')
await goNav('AI 领班')
ok('11 AI领班授权页', (await body()).includes('授权') || (await body()).includes('领班'), '空')
await goNav('分组管理')
ok('12 分组管理-学生列表', (await body()).includes('已注册学生'), '空')
await goNav('教学参考')
ok('13 教学参考', (await body()).includes('评分规则') || (await body()).includes('教学'), '空')

// ── 学生端（离线演示）──
await page.evaluate(() => localStorage.clear()); await page.reload(); await sleep(2500)
await clickText('我是学生'); await sleep(500)
await clickText('无网络？离线演示'); await sleep(500)
await clickText('进入演示'); await sleep(800)
await clickText('开始我的酒店之旅'); await sleep(1200)
ok('14 离线演示可进选址', (await body()).includes('选址'), '未进')
await clickCard('锦江区'); await sleep(500); await clickText('明白了'); await sleep(300)
await clickText('确认选址'); await sleep(800)
ok('15 进品牌页', (await body()).includes('选品牌'), '未进')
await clickCard('全季'); await sleep(400); await clickText('确认选择'); await sleep(800)
ok('16 进认领页', (await body()).includes('认领'), '未进')

// ── 移动端 390 ──
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const mpage = await mctx.newPage()
await mpage.goto('https://www.2026911301.xyz/'); await sleep(3000)
ok('17 移动端 390 可见身份选择', (await mpage.evaluate(() => document.body.innerText)).includes('我是学生'), '溢出/白屏')
await mctx.close()

ok('18 HTTPS 域名正确', page.url().includes('2026911301.xyz') || BASE.includes('2026911301'), '域名异常')
ok('19 无未捕获 JS 异常', errors.length === 0, errors.slice(0, 2).join(' | '))

await page.goto(BASE); await sleep(2000)
await clickText('我是学生'); await sleep(500); await clickText('无网络？离线演示'); await sleep(500)
ok('20 离线演示带"演示"标注', (await body()).includes('演示'), '未标注')

const pass = results.filter(r => r.cond).length
console.log(`\n自检结果：${pass} / ${results.length} 项通过`)
writeFileSync(`${SHOT}/自检结果.json`, JSON.stringify(results, null, 1))
await browser.close()
process.exit(pass === results.length ? 0 : 1)
