// 自动巡检：线上整套交互（每 30 分钟由定时任务调用）
// 用法：node tests/autoProbe.mjs            → 打印结果 + 追加到 4-审计与报告/自动巡检.md
//       node tests/autoProbe.mjs --quiet    → 只打印一行结论
// 退出码：0 全通过 / 1 有失败（供调度判断）
import { createRequire } from 'node:module'
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
const require = createRequire('D:/教学app/hotel-app/package.json')
const { chromium } = require('playwright-core')

const BASE = 'https://test.2026911301.xyz/'
const OUT_DIR = 'D:/教学app/4-审计与报告/巡检截图'
const LOG = 'D:/教学app/4-审计与报告/自动巡检.md'
const QUIET = process.argv.includes('--quiet')
const sleep = ms => new Promise(r => setTimeout(r, ms))
const 结果 = []
const 记 = (名, ok, 证据 = '') => { 结果.push({ 名, ok, 证据 }); if (!QUIET) console.log(`${ok ? '✅' : '❌'} ${名}${证据 ? ' · ' + 证据 : ''}`) }

const now = new Date()
const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
const 印章 = stamp.replace(/[-: ]/g, '').slice(0, 12)

let b
try {
  // ① 入口（HTTP 层用 curl，Node 的 fetch 在本机会因证书链失败）
  const { execFileSync } = await import('node:child_process')
  let ipInfo = ''
  try {
    ipInfo = execFileSync('curl.exe', ['-s', '-o', 'NUL', '-k', '-w', '%{http_code} %{redirect_url}', '--max-time', '12', 'https://121.196.196.37/'], { encoding: 'utf8', timeout: 20000 }).trim()
  } catch (e) { ipInfo = 'curl失败' }
  const [ipCode, ipLoc] = ipInfo.split(' ')
  记('IP 入口跳正式域名', ipCode === '302' && /test\.2026911301\.xyz/.test(ipLoc || ''), `code=${ipCode} → ${ipLoc || '无'}`)

  b = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true, args: ['--no-proxy-server', '--ignore-certificate-errors', '--mute-audio'],
  })
  const mk = async () => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true, isMobile: true, deviceScaleFactor: 2 })
    const p = await ctx.newPage()
    p.on('pageerror', () => {})
    return p
  }

  // ② 首屏
  const p = await mk()
  await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 }); await sleep(2000)
  const t0 = (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ')
  记('首屏出「请选择你的身份」', /请选择你的身份/.test(t0), t0.slice(0, 50))
  记('首屏无诊断面板占屏', !/^APP端 \| 网页端 \| [^|]*诊断/.test(t0), '')

  // ③ 离线演示：入口可见 → 进入 → 选址
  await p.getByText('我是学生').last().click(); await sleep(1200)
  const 演示可见 = await p.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(x => (x.innerText || '').trim().startsWith('无网络？离线演示'))
    if (!el) return false
    const r = el.getBoundingClientRect()
    return r.top >= 0 && r.bottom <= window.innerHeight
  })
  记('离线演示入口免滚动可见', 演示可见, '')
  if (演示可见) {
    await p.getByText('离线演示').last().click(); await sleep(1500)
    await p.getByText('进入演示').last().click().catch(() => {}); await sleep(2500)
    // 主链入口页 → 点「开始我的酒店之旅」进入选址（用 role 选择器，文本点击会点到内层 span 而无效）
    await p.getByRole('button', { name: /开始我的酒店之旅|开始经营|开始/ }).last().click({ timeout: 8000 }).catch(() => {})
    await sleep(2500)
    const t1 = (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ')
    记('进入演示主链', /选址|选品牌|经营/.test(t1), t1.slice(0, 60))
    const 变了 = await p.evaluate(() => {
      const d = document.querySelector('.district-card, .district-name')
      if (!d) return false
      d.click(); return true
    })
    await sleep(2000)
    const t2 = (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ')
    记('选址可点且界面有变化', 变了 && t2 !== t1, 变了 ? '已点区县' : '没找到区县卡')
  }

  // ④ 学生真实登录
  const ps = await mk()
  await ps.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 }); await sleep(1500)
  await ps.evaluate(() => localStorage.clear()); await ps.reload(); await sleep(1800)
  await ps.getByText('我是学生').last().click(); await sleep(1000)
  await ps.locator('input').first().fill('20240901')
  await ps.locator('input[type=password]').first().fill('test123456')
  await ps.getByRole('button', { name: /^登录$/ }).click(); await sleep(5000)
  const ts = (await ps.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ')
  记('学生 20240901 登录', /经营|本周|决策|周结算/.test(ts) && !/密码错误|账号或密码/.test(ts), ts.slice(0, 60))

  // ⑤ 教师真实登录 + 默认班
  const pt = await mk()
  await pt.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 }); await sleep(1500)
  await pt.evaluate(() => localStorage.clear()); await pt.reload(); await sleep(1800)
  await pt.getByText('我是老师').last().click(); await sleep(1000)
  await pt.locator('input').first().fill('t2024')
  await pt.locator('input[type=password]').first().fill('Yunyue2024')
  await pt.getByRole('button', { name: /^登录$/ }).click(); await sleep(5500)
  const tt = (await pt.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ')
  记('教师 t2024 登录', /班级|小组|周次|推进/.test(tt) && !/密码错误|账号或密码/.test(tt), tt.slice(0, 60))
  记('教师默认「彩排-V105」', /彩排-V105/.test(tt), (tt.match(/彩排-V105[^ |]*/) || [''])[0])

  // 失败时留证据
  const fails = 结果.filter(r => !r.ok)
  if (fails.length) {
    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
    await p.screenshot({ path: `${OUT_DIR}/失败-${印章}.png`, fullPage: true }).catch(() => {})
  }
} catch (e) {
  记('巡检脚本异常', false, String(e.message).slice(0, 120))
} finally {
  if (b) await b.close()
}

const pass = 结果.filter(r => r.ok).length
const 行 = `| ${stamp} | ${pass}/${结果.length} | ${结果.filter(r => !r.ok).map(r => r.名).join('；') || '—'} |`
if (!QUIET) console.log(`\n合计 ${pass}/${结果.length}`)

// 记录（首次建表头）
try {
  if (!existsSync(LOG)) {
    appendFileSync(LOG, `# 自动巡检记录（线上整套交互 · 每 30 分钟）\n\n| 时间 | 通过 | 失败项 |\n|---|---|---|\n`, 'utf8')
  }
  appendFileSync(LOG, 行 + '\n', 'utf8')
} catch {}

if (QUIET) console.log(行)
process.exit(pass === 结果.length ? 0 : 1)
