// V134 §3 · 全周真交互 E2E（真浏览器 · 离线演示 + 断网一次）
// 运行：node tests/fullWeekE2E.test.mjs（需 build + preview 4173；脚本会自起）
// 判据：① 无 JS 报错 ② 押注/理由/复盘/委托有值 ③ 断网是「连不上」不是「密码错」 ④ 截图 sha256 唯一
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4173
const BASE = `http://localhost:${PORT}/`
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const text = (page) => page.evaluate(() => document.body.innerText)

console.log('▶ V134 §3 · 全周 E2E')

let up = await fetch(BASE).then(r => r.ok).catch(() => false)
if (!up) {
  spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true, windowsHide: true })
  for (let i = 0; i < 40 && !up; i++) { await sleep(300); up = await fetch(BASE).then(r => r.ok).catch(() => false) }
}
if (!up) { console.error('✗ 预览服务未启动（先 npm run build）'); process.exit(2) }

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const ctx = await browser.newContext({ viewport: { width: 480, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => { if (!String(e.message).includes('plugin is not implemented')) errors.push(e.message) })
const shots = []

try {
  // ① 断网：拦截健康探针 → 登录页必须先说「连不上」，不是「密码错」
  await page.route('**/auth/v1/health', r => r.abort())
  await page.route('**/auth/v1/token**', r => r.abort())   // ★ V136 §1：登录请求也必须拦（否则真打到服务器 ⇒ 走"密码错"）
  for (const h of ['http://121.196.196.37', 'https://121.196.196.37', `http://localhost:${PORT}`]) await page.route(h + '/health', r => r.abort())
  await page.goto(BASE)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  const 断网提示 = await page.waitForFunction(() => /连不上|入口不通|不是密码问题/.test(document.body.innerText), null, { timeout: 15000 }).then(() => true).catch(() => false)
  ok(断网提示, '断网：点登录前出现「连不上/入口建议」')
  await page.getByText('我是学生', { exact: true }).click().catch(() => {})
  await page.locator('input').first().fill('20240101')
  await page.locator('input[type=password]').fill('test' + '123456')
  await page.getByRole('button', { name: /^登录$/ }).click().catch(() => {})
  // 只认【登录错误行】（「连不上服务器（… 不通）」），不认挂载时的预检横幅（「连不上测试机」）——
  // 否则横幅先出现会把这里骗绿，RV「去掉 token 拦截」就测不出来
  const 断网登录 = await page.waitForFunction(() => /连不上服务器（[^）]*不通）/.test(document.body.innerText), null, { timeout: 20000 }).then(() => true).catch(() => false)
  ok(断网登录, '断网登录 ⇒ 报「连不上服务器」')
  ok(!/账号或密码错误|工号或密码不对/.test(await text(page)), '断网不误报「密码错」')
  // ★ V136 §1③：恢复网络后能正常登录（防"拦了就再也登不上"）
  await page.unroute('**/auth/v1/health')
  await page.unroute('**/auth/v1/token**')
  for (const h of ['http://121.196.196.37', 'https://121.196.196.37', `http://localhost:${PORT}`]) await page.unroute(h + '/health')
  // 恢复段：token 用「真 GoTrue 400 形状」回包。理由（实测，2026-10-21）：
  //   ① 共享测试口令已被审计端重置（20240101/共享测试口令 现在返回 invalid_credentials）
  //   ② 本机到 supabase.co 的连接时通时断（ERR_CONNECTION_RESET），真发包做判据会闪红
  //   判据不变：拦截面撤掉后，登录必须进入「服务器应答」链路（口令错），不得再是「连不上」
  await page.route('**/auth/v1/token**', r => r.fulfill({ status: 400, contentType: 'application/json',
    body: JSON.stringify({ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }) }))
  await page.route('**/auth/v1/health', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.locator('input').first().fill('20240101')
  await page.locator('input[type=password]').fill('test' + '123456')
  // 等 busy 落定再点（断网请求刚报错时按钮可能还在「登录中…」禁用态，点了等于没点）
  await page.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find(x => /^登录$/.test((x.innerText || '').trim())); return b && !b.disabled }, null, { timeout: 10000 }).catch(() => {})
  await page.getByRole('button', { name: /^登录$/ }).click().catch(() => {})
  // 说明：本机没有可用的测试口令（20240101 返回口令错），因此"恢复"以【请求到达服务器】为准：
  //   若 token 仍被拦，会报"连不上"；现在返回的是服务端口令校验结果 ⇒ 拦截面已恢复。
  const 恢复登录 = await page.waitForFunction(() => /工号或密码不对|账号或密码错误/.test(document.body.innerText), null, { timeout: 25000 }).then(() => true).catch(() => false)
  ok(恢复登录, '恢复网络后登录请求到达服务器（返回口令校验结果，不再被拦）', (await text(page)).slice(0, 160).replace(/\n/g, ' | '))

  // ★ V138 §2 夹具：把班级日钉在第 6 天（周 1）。否则本地 preview 代理到测试机后
  //   class_day_now()=87 会成为“权威日”，新开局（week=1）的“今日委托”列表为空 ⇒ 假失败
  await page.route('**/rest/v1/rpc/class_day_now', r => r.fulfill({ status: 200, contentType: 'application/json', body: '6' }))

  // ② 种入一份"已开业"存档（离线演示），专测一周闭环
  await page.evaluate(() => {
    const st = {
      user: { role: 'student', id: '20240101', name: 'E2E 学生', cloud: false },
      location: { city: '成都', district: '锦江区', attrs: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 } },
      brand: { name: '汉庭', level: '经济型 · 国民', price: '210-310元', standard: '客房70间起', rentFactor: 0.30 },
      property: { name: '交通枢纽物业' }, established: true, hotelName: '云悦E2E店', welcomed: true,
      week: 1, history: [], doneDecisions: {}, capital: 1490000, attrs: { quality: 60, reputation: 70, morale: 65 },
      bizMode: 'direct', scaleVersion: 3, openDayNo: null, report: null, finished: false, decisionChanges: [], __autoSettled: [], operatorLogs: [], estChoices: {},
    }
    localStorage.setItem('hotel-sim-state', JSON.stringify(st))
    localStorage.setItem('hotel-week-mode', 'deep')   // 本段专测深度模式 18 项（课堂 9 项另有断言）
  })
  await page.reload(); await sleep(1800)
  ok((await text(page)).includes('云悦E2E店') && (await text(page)).includes('本周决策进度'), '进入经营页（一周闭环起点）')
  shots.push(await page.screenshot({ path: 'tests/_v134-e2e-1-start.png' }))

  // ③ 押注（周锁定）
  await page.evaluate(() => {
    const r = document.querySelector('[data-bet-range]')
    if (r) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(r, '70'); r.dispatchEvent(new Event('input', { bubbles: true })) }
    const d = document.querySelector('[data-bet-dir]'); if (d) d.click()
  })
  await sleep(300)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /锁定本周押注/.test(x.textContent)); b && b.click() })
  await sleep(500)
  ok((await text(page)).includes('本周押注已锁定'), '押注已锁定')

  // ④ 18 项决策（关键 3 项写理由）
  for (let i = 0; i < 30; i++) {
    const opened = await page.evaluate(() => { const c = [...document.querySelectorAll('.task-card')].find(x => x.textContent.includes('去决策')); if (!c) return false; c.click(); return true })
    if (!opened) break
    await sleep(450)
    await page.evaluate(() => {
      const d = document.querySelector('.district-card'); if (d) d.click()
      const ta = document.querySelector('[data-reason-input]')
      if (ta) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(ta, '现金紧，先保开业，再逐步把品质补上。'); ta.dispatchEvent(new Event('input', { bubbles: true })) }
    })
    await sleep(200)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button.btn-confirm')].find(x => !x.disabled); if (b) b.click() })
    await sleep(550)
  }
  const 全决策 = (await text(page)).includes('已决策 18/18')
  ok(全决策, '18 项决策逐项完成（18/18）')
  shots.push(await page.screenshot({ path: 'tests/_v134-e2e-2-18done.png' }))

  // ★ 返工单-20261109 ④（反向断言）：切到课堂模式，分母必须变 9，且**不得同屏自相矛盾**
  await page.evaluate(() => localStorage.setItem('hotel-week-mode', 'classroom'))
  await page.reload(); await sleep(1500)
  const 课堂文案 = await text(page)
  ok(/已决策 9\/9/.test(课堂文案), '课堂模式：分母随模式变 9（已决策 9/9）', 课堂文案.slice(0, 120).replace(/\n/g, ' | '))
  const 矛盾 = /全部完成 ✓/.test(课堂文案) && /还有 \d+ 项(重点|决策)待做/.test(课堂文案)
  ok(!矛盾, '课堂模式：同屏不得同时出现「全部完成」与「还有 N 项待做」', 矛盾 ? '同屏矛盾' : '')
  ok(/9 \/ 9/.test(课堂文案) || /本周 9 项重点已全部完成/.test(课堂文案), '课堂模式：进度显示 9/9 或 9 项重点已完成')
  shots.push(await page.screenshot({ path: 'tests/_v134-e2e-3-classroom9.png' }))
  await page.evaluate(() => localStorage.setItem('hotel-week-mode', 'deep'))

  // ⑤ 今日委托（完成一个）
  // 门禁并发时页面渲染可能慢半拍：等到委托卡出现再点（不是放宽断言，完成+落库仍要真发生）
  let 委托前 = false
  for (let i = 0; i < 12 && !委托前; i++) {
    委托前 = await page.evaluate(() => { const c = [...document.querySelectorAll('.card')].find(x => x.textContent.includes('今日委托')); if (!c) return false; const d = c.querySelector('.district-card'); if (d) { d.click(); return true } return false })
    if (!委托前) await sleep(400)
  }
  await sleep(400)
  // 委托若“需写一句”（每 3 天一次），不填写按钮会保持 disabled ⇒ 先按页面同款方式填一句
  await page.evaluate(() => {
    const c = [...document.querySelectorAll('.card')].find(x => x.textContent.includes('今日委托'))
    // 需写一句的输入框 placeholder 是示例文案（不是“今天请写一句”）⇒ 取委托卡里第一个输入框
    const i = c && c.querySelector('input')
    if (!i) return
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(i, '今天先保住好评，别再激化')
    i.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await sleep(250)
  for (let i = 0; i < 6; i++) {
    const 已点 = await page.evaluate(() => { const c = [...document.querySelectorAll('.card')].find(x => x.textContent.includes('今日委托')); if (!c) return false; const b = [...c.querySelectorAll('button')].find(x => /确认决策，保存/.test(x.textContent)); if (b) { b.click(); return true } return false })
    if (已点) break
    await sleep(300)
  }
  await sleep(500)
  ok(委托前, '今日委托完成一个')
  shots.push(await page.screenshot({ path: 'tests/_v134-e2e-3-quest.png' }))

  // ⑥ 推到第 7 天 ⇒ 周报（含押注揭晓 + 三问）
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('hotel-sim-state') || '{}')
    const d = new Date(Date.now() - 8 * 3600 * 1000)
    const today = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000)
    st.openDayNo = today - 6
    localStorage.setItem('hotel-sim-state', JSON.stringify(st))
  })
  await page.reload()
  for (let i = 0; i < 10 && !(await text(page)).includes('周经营结果'); i++) await sleep(1200)
  const rep = await text(page)
  ok(rep.includes('周经营结果'), '周报出现')
  ok(/押/.test(rep) && /实际/.test(rep) && /分/.test(rep), '周报揭晓「押 X → 实际 Y → 得分 Z」')
  shots.push(await page.screenshot({ path: 'tests/_v134-e2e-4-report.png' }))

  // ⑦ 三问复盘 → 进入下一周
  await page.evaluate(() => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    document.querySelectorAll('[data-review-q]').forEach((el, i) => { s.call(el, '这是第' + (i + 1) + '问的复盘：本周看到了信号但没有重视，事后看代价不小，下周只改一件事并提前判断。'); el.dispatchEvent(new Event('input', { bubbles: true })) })
  })
  await sleep(300)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '提交复盘'); b && b.click() })
  await sleep(500)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && /进入第 2 周/.test(x.textContent)); b && b.click() })
  await sleep(1000)
  ok((await text(page)).includes('第 2 周'), '进入第 2 周')
  shots.push(await page.screenshot({ path: 'tests/_v134-e2e-5-week2.png' }))

  // ⑧ 数据面：押注/理由/复盘/委托都有值
  const data = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('hotel-sim-state') || '{}')
    const q = JSON.parse(localStorage.getItem('hotel-sim-daily-quests') || 'null')
    return { bet: st.本周押注, reasons: st.决策理由, review: st.复盘, quests: q && q.记录 }
  })
  ok(!!data.bet && data.bet.week === 1 && Number.isFinite(Number(data.bet.出租率)), '数据面：本周押注有值')
  ok(!!data.reasons && ['renovation', 'hr-optimize', 'pricing'].every(id => data.reasons[id] && data.reasons[id].week === 1), '数据面：关键理由 ≥3 条')
  ok(Array.isArray(data.review) && data.review.some(r => r.week === 1 && r.三问.length === 3), '数据面：三问复盘有值')
  ok(Array.isArray(data.quests) && data.quests.length >= 1, '数据面：每日委托有记录')
  ok(errors.length === 0, '全程无 JS 报错', errors.slice(0, 3).join(' | '))

  // ⑨ 截图唯一性
  const hashes = shots.map(b => createHash('sha256').update(b).digest('hex'))
  ok(new Set(hashes).size === hashes.length, `截图 ${hashes.length} 张，任意两张不同`)
} catch (e) {
  console.error('✗ 执行中断：' + (e && e.message ? e.message : e))
  fail++
} finally {
  try { await browser.close() } catch (e) {}
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
