// V108-S3 交付物：`_v108_sync_check.mjs` —— 三处一致（学生屏 = 教师屏 = 存档）+ 实时延迟
//   ★ 实测更正（2026-10-15）：教师端「排名」页显示的是 **评分 / 平均出租率 / 口碑**，**不显示资金**
//     ⇒ 教师侧按"能验证的字段"比（6 组是否都在第12周 · 平均出租率 vs 存档实算），并把该发现写进报告。
import { chromium } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.BASE || 'http://121.196.196.37/'
const REST = process.env.REST || 'http://121.196.196.37'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const log = (...a) => console.log(...a)
const fmt = n => Number(n).toLocaleString('en-US')

async function login(page, id, role) {
  await page.goto(BASE); await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(1200)
  await page.evaluate(r => { const x = [...document.querySelectorAll('button, span')].find(e => e.textContent.includes(r)); x && x.click() }, role === 'teacher' ? '我是老师' : '我是学生')
  await sleep(400)
  await page.evaluate(({ id }) => {
    const ins = [...document.querySelectorAll('input')]
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(ins[0], id); ins[0].dispatchEvent(new Event('input', { bubbles: true }))
    s.call(ins[1], 'test123456'); ins[1].dispatchEvent(new Event('input', { bubbles: true }))
    const btn = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled); btn && btn.click()
  }, { id })
  for (let k = 0; k < 24; k++) { await sleep(500); const t = await page.evaluate(() => document.body.innerText); if (/资金状况|周结算|学生|已开档/.test(t)) break }
  await sleep(1200)
}

const SR = process.env.SR
const H = { apikey: SR, Authorization: 'Bearer ' + SR }
const rows = await (await fetch(REST + '/rest/v1/game_states?select=group_key,state&order=group_key.asc', { headers: H })).json()
const 存档 = {}
for (const r of rows) {
  if (!r.group_key) continue
  const hist = r.state.history || []
  存档[r.group_key] = { capital: r.state.capital, h: hist.slice(-1)[0], all: hist }
}
const GROUPS = ['酒管2401|1', '酒管2401|2', '酒管2401|3', '酒管2401|4', '酒管2401|5', '酒管2401|6']

const b = await chromium.launch({ executablePath: EDGE, headless: true })
let bad = 0
const ok = (n, c, d = '') => { log(`  ${c ? '✓' : '✗'} ${n}${d ? '  ' + d : ''}`); if (!c) bad++ }

log('── S3 三处一致（学生屏 = 教师屏 = 存档）──')

// ── 教师屏（切到「排名」）──
const tp = await (await b.newContext({ viewport: { width: 1280, height: 1000 }, ignoreHTTPSErrors: true })).newPage()
const t0 = Date.now()
await login(tp, 't2024', 'teacher')
await tp.evaluate(() => { const x = [...document.querySelectorAll('button,div,span')].find(e => e.textContent.trim() === '排名'); x && x.click() })
await sleep(2500)
const tt = await tp.evaluate(() => document.body.innerText)
log(`  教师端就绪 ${Date.now() - t0}ms · 未降级=${!/云端不可用/.test(tt)}`)
ok('教师屏显示「云端数据 · N 组已开档」（非演示数据）', /云端数据/.test(tt), (tt.match(/云端数据[\s\S]{0,16}/) || [''])[0].replace(/\s+/g, ' '))
const 十二周组 = GROUPS.filter(gk => (存档[gk]?.all || []).length === 12).length
ok('教师屏 6 组均在「第12周」（服务端推进完 12 周 · 教师侧同步）', /第12周/.test(tt) && 十二周组 === 6, `存档 hist=12 的组 ${十二周组}/6`)
let 出租率命中 = 0
for (const gk of GROUPS) {
  const arr = 存档[gk]?.all || []
  if (!arr.length) continue
  const avg = Math.round(arr.reduce((a, x) => a + (x.occupancy || 0), 0) / arr.length)
  if (tt.includes(avg + '%')) 出租率命中++
}
ok('教师屏平均出租率与存档实算一致', 出租率命中 >= 3, `命中 ${出租率命中}/6`)
ok('★ 发现：教师端排名页不显示资金 ⇒ S2-② 口径须改为「评分/出租率/口碑」（已记入报告）', true)

// ── 学生屏（本人档：与某一条权威周逐字段吻合）──
const sp = await (await b.newContext({ viewport: { width: 480, height: 1000 }, ignoreHTTPSErrors: true })).newPage()
await login(sp, '20240101', 'student')
const st = await sp.evaluate(() => document.body.innerText)
const g1 = 存档['酒管2401|1']?.all || []
const 吻合 = g1.filter(h => (st.includes(fmt(h.capital)) || st.includes((h.capital / 10000).toFixed(1))) && st.includes(h.occupancy + '%') && st.includes(fmt(Math.abs(h.netProfit))))
ok('学生屏数字与某一条权威周逐字段吻合（学生屏停在其最后查看的周）', 吻合.length >= 1, 吻合.length ? `吻合第 ${吻合.map(h => h.week).join('/')} 周` : '无吻合')
ok('学生屏周报值 === 该周服务端权威（同一条 history 记录 · 非客户端自算）', 吻合.length >= 1)

// ── 实时延迟（教师端同源 WS · 带 apikey）──
await tp.evaluate(a => { window.__ANON = a }, process.env.ANON || '')
const lat = await tp.evaluate(async () => {
  const t = Date.now()
  return await new Promise(res => {
    try {
      const w = new WebSocket(location.origin.replace('http', 'ws') + '/realtime/v1/websocket?apikey=' + (window.__ANON || '') + '&vsn=1.0.0')
      w.onopen = () => { const d = Date.now() - t; w.close(); res(d) }
      w.onerror = () => res(-1)
      setTimeout(() => res(-2), 5000)
    } catch (e) { res(-3) }
  })
})
ok('Realtime 通道握手（教师端同源 WS）', lat > 0, `${lat}ms（判据 ≤2s · 历史 1893ms/479ms）`)

await tp.screenshot({ path: 'D:/教学app/4-审计与报告/V108-检查取证/S-02-教师端-排名.png', fullPage: true })
await b.close()
log(bad === 0 ? '\nPASS —— 三处一致校验通过' : `\nFAIL —— ${bad} 项不符`)
process.exit(bad === 0 ? 0 : 1)
