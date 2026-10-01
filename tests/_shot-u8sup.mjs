// §32-U8-补 证据（用完删）：五张元素级截图（★ 后端 = Playwright 本地 mock · 前端 = 真实构建产物）
//
// 为什么要 mock 后端：迁移 `supabase-migration-u8-class-events.sql` 需用户执行后才有效列 ——
//   在此之前无法连真实通道取证。本脚本用真实前端 + 被拦截的 Supabase REST（返回真引擎生成的存档）
//   走通「老师注入 → 学生结算收到事件卡/离线标注/领班复盘」全链路 ⇒ 证明**前端代码路径**成立；
//   迁移执行后的真实链路核验另列（见批次报告-unit8补.md 的"待部署"栏）。
//
// 五张（+1 附）：① 老师端弹窗（学生选择 + 代价）② 注入面板（选中事件 + 周 + 校验）
//   ③ 领班授权页（全班默认 · 默认全关）④ 学生周报事件卡（老师注入徽章）⑤ 离线补算标注（红条）
//   ⑥ 学生领班复盘卡（代管记录 + 我的授权）
import { chromium } from 'playwright-core'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, mkdirSync } from 'node:fs'
import { settle } from '../src/settlement.js'
import { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } from '../src/attrs.js'
import { SCALE } from '../src/stateMigration.mjs'
import { 构建注入事件 } from '../src/teacherEvents.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:4173/'
const 输出 = 'D:/教学app/4-审计与报告/证据-U8'
const sleep = ms => new Promise(r => setTimeout(r, ms))
mkdirSync(输出, { recursive: true })

// ── 真引擎生成存档（不用手写假数）────────────────────────────────
// ★ 选址口径：用【涪城区】（绵阳 · 真实竞对数据里含 budget/mid 档 ⇒ 领班 R1/R3 有真实动作可演示；
//   锦江区竞对全是 luxury（均价 ~1251）⇒ R1 按新口径正确地不触发）
const 场 = { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3, district: '涪城区' }
const 品牌 = { name: '汉庭', price: '180-280元', standard: '客房70间起', level: '经济型' }
const 决策 = {
  pricing: '不跟降', shifts: '满编保服务', hygiene: '不停房', linen: '自洗',
  'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿',
  energy: 23, overbook: 8, 'member-threshold': 5, 'quality-check': '每周抽检',   // ★ overbook=8：超售激进打法 ⇒ 第 3 周有真实超售赔偿 ⇒ 领班 R3（超售清零）有真动作可演示
}
function 造档(名) {
  let attrs = { ...ATTR_INIT }, pg = null, cap = null, pn = 0, rs = 0
  const history = []
  for (let w = 1; w <= 2; w++) {
    let a = attrs
    for (const [id, ans] of Object.entries(决策)) a = applyDecisionToAttrs(a, id, ans)
    const r = settle({ site: 场, brand: 品牌, decisions: 决策, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
    history.push(r)
    pg = r.finalGoodRate; cap = r.capital; attrs = normalizeAttrs(r.attrsAfter)
    const neg = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
    rs = Math.ceil(neg * 0.5); pn = Math.max(0, pn + neg - rs)
  }
  return {
    location: { ...场, city: '绵阳', name: '涪城区' },
    brand: 品牌, property: { name: '社区旁物业' }, established: true,
    estChoices: { 装修: '标准', 系统: '上线', 招聘: '到位' },
    doneDecisions: 决策, week: 3, history, finished: false, welcomed: true,
    attrs, capital: cap, bizMode: 'direct', operatorLogs: [], decisionChanges: [], __autoSettled: [],
    scaleVersion: SCALE.VERSION_CURRENT,
  }
}
const 档1 = 造档('第1组')
const 档2 = 造档('第2组')
const 老师 = { id: '00000000-0000-4000-8000-0000000000t1'.replace('t1', '01'), email: 't001@yunyue.study', name: '王老师' }
const 学生 = { id: '00000000-0000-4000-8000-0000000000s1'.replace('s1', '01'), email: '20240101@yunyue.study', name: '张小明' }
const 注入 = [ { ...构建注入事件({ 事件id: 'E1', 周: 3, injectedBy: '王老师', injectedAt: '2026-10-01T09:00:00.000Z' }), targets: null } ]
const 领班授权 = { price_adj: { ok: true }, overbook: { ok: true } }

// ── Supabase mock ────────────────────────────────────────────────
function 装mock(ctx, 角色, classDay) {
  const 会话 = (u) => ({ access_token: 'mock-at-' + u.id, token_type: 'bearer', expires_in: 86400, refresh_token: 'mock-rt-' + u.id, user: { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {} } })
  ctx.route('**/auth/v1/**', async route => {
    const url = route.request().url()
    if (url.includes('/auth/v1/token') || url.includes('/auth/v1/signup')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(会话(角色 === 'teacher' ? 老师 : 学生)) })
    if (url.includes('/auth/v1/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: (角色 === 'teacher' ? 老师 : 学生).id, aud: 'authenticated', role: 'authenticated', email: (角色 === 'teacher' ? 老师 : 学生).email }) })
    return route.fulfill({ status: 204, body: '' })
  })
  ctx.route('**/rest/v1/**', async route => {
    const req = route.request()
    const url = req.url()
    const obj = (req.headers()['accept'] || '').includes('pgrst.object')
    const J = (b, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'content-range': '0-0/1' }, body: JSON.stringify(b) })
    const 空 = (st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'content-range': '*/0' }, body: req.method() === 'GET' ? '[]' : '' })
    if (url.includes('/rpc/class_day_now')) return J(classDay)
    if (url.includes('/rest/v1/profiles')) {
      const list = 角色 === 'teacher'
        ? [
            { user_id: 老师.id, role: 'teacher', display_name: 老师.name, group_no: null, class_name: null, student_no: null, role_in_group: null },
            { user_id: 学生.id, role: 'student', display_name: 学生.name, group_no: 1, class_name: '人力2401', student_no: '20240101', role_in_group: null },
            { user_id: '00000000-0000-4000-8000-0000000000s2'.replace('s2', '02'), role: 'student', display_name: '李小红', group_no: 2, class_name: '人力2401', student_no: '20240102', role_in_group: null },
          ]
        : [{ user_id: 学生.id, role: 'student', display_name: 学生.name, group_no: 1, class_name: '人力2401', student_no: '20240101', role_in_group: null }]
      const 过滤 = url.includes('role=eq.teacher') ? list.filter(x => x.role === 'teacher') : list
      return J(obj ? (过滤[0] || null) : 过滤)
    }
    if (url.includes('/rest/v1/game_states')) {
      if (req.method() !== 'GET') return route.fulfill({ status: 204, body: '' })
      const rows = 角色 === 'teacher'
        ? [
            { user_id: 学生.id, group_name: '第1组', state: 档1, week: 3, finished: false, updated_at: '2026-10-01T09:20:00.000Z' },
            { user_id: '00000000-0000-4000-8000-0000000000s2'.replace('s2', '02'), group_name: '第2组', state: 档2, week: 4, finished: false, updated_at: '2026-10-01T09:10:00.000Z' },
          ]
        : [{ state: 档1, week: 3, finished: false, updated_at: '2026-10-01T09:20:00.000Z' }]
      if (url.includes('select=state') && obj) return J(rows[0])
      return J(rows)
    }
    if (url.includes('/rest/v1/class_state')) {
      if (req.method() !== 'GET') return route.fulfill({ status: 204, body: '' })
      return J({ current_week: 0, injected_events: 注入, supervisor_auth: 领班授权 })
    }
    if (url.includes('/rest/v1/teacher_notes') || url.includes('/rest/v1/decision_log') || url.includes('/rest/v1/daily_snapshots')) return 空()
    return 空()
  })
}

// ── 浏览器 ───────────────────────────────────────────────────────
let browser
const 站损 = []
async function 登录(pg, 角色) {
  await pg.goto(BASE); await pg.waitForLoadState('domcontentloaded'); await sleep(1200)
  const 点 = (t) => pg.evaluate(t2 => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.trim().includes(t2)); if (b) { b.click(); return true } return false }, t)
  await 点(角色 === 'teacher' ? '我是老师' : '我是学生'); await sleep(700)
  await pg.fill('input:not([type=password])', 角色 === 'teacher' ? 'T001' : '20240101'); await sleep(200)
  await pg.fill('input[type=password]', '123456'); await sleep(200)
  // ★ 精确匹配「登录」（不能用 includes —— 会命中「注册并登录（首次使用）」走注册路径）
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录'); if (b) b.click() }); await sleep(2600)
}
const 字 = (pg) => pg.evaluate(() => document.body.innerText)
async function 击文本(pg, t, 精确 = true) {
  return pg.evaluate(({ t, 精确 }) => {
    const xs = [...document.querySelectorAll('button, span, div')]
    const hit = xs.filter(x => 精确 ? x.textContent.trim() === t : x.textContent.includes(t))
    const el = hit[hit.length - 1]
    if (el) { el.click(); return el.textContent.trim().slice(0, 24) }
    return null
  }, { t, 精确 })
}
async function 元素截图(pg, 片段, 文件, maxLen = 900, 模式 = 'card') {
  const h = await pg.evaluateHandle(({ 片段, maxLen, 模式 }) => {
    const xs = [...document.querySelectorAll('div')].filter(x => x.textContent.includes(片段) && x.textContent.length < maxLen)
    let pool = xs
    if (模式 === 'bgFFF4E0') {
      pool = xs.filter(x => String(x.style && x.style.background || '').includes('255, 244, 224'))
      if (!pool.length) pool = xs
    } else if (模式 === 'tight') {
      pool = xs
    } else if (模式 === 'card') {
      // ★ 类名要【整词】匹配 —— includes('card') 会把 'card-title' 也算进来（实测踩到：截出 336×20 的标题条）
      const isCard = (x) => String(x.className || '').split(/\s+/).includes('card')
      const cards = xs.filter(isCard)
      const tight = xs.filter(x => !isCard(x))
      pool = cards.length ? (tight.length && tight[0].textContent.length * 2 < cards[0].textContent.length ? tight : cards) : xs
    }
    pool = [...pool].sort((a, b) => a.textContent.length - b.textContent.length)
    return pool[0] || null
  }, { 片段, maxLen, 模式 })
  const el = h.asElement()
  if (!el) { console.log(`   ✗ 元素截图失败（找不到含「${片段}」的容器）→ ${文件}`); return false }
  await el.scrollIntoViewIfNeeded(); await sleep(350)
  await el.screenshot({ path: `${输出}/${文件}` })
  const 盒 = await el.boundingBox()
  console.log(`   ✓ ${文件}（${Math.round(盒?.width || 0)}×${Math.round(盒?.height || 0)}）`)
  return true
}

try {
  browser = await chromium.launch({ executablePath: EDGE, headless: true })

  // ══ 老师端（三张）══
  {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
    装mock(ctx, 'teacher', 24)
    const pg = await ctx.newPage()
    pg.on('dialog', d => d.accept())
    const 异常 = []
    pg.on('pageerror', e => { if (!/plugin is not implemented/.test(e.message || '')) 异常.push(e.message) })
    await 登录(pg, 'teacher')
    console.log('老师端到页：', /学生决策动向|实时决策/.test(await 字(pg)) ? '✓' : '✗', '|', (await 字(pg)).split('\n').slice(0, 4).join(' | '))
    // ① 点开某条决策 ⇒ 弹窗（学生选择 + 代价）
    const 开了 = await pg.evaluate(() => {
      const chips = [...document.querySelectorAll('span')].filter(x => x.style.cursor === 'pointer' && /不跟降|满编保服务/.test(x.textContent))
      if (!chips.length) return null
      chips[0].click(); return chips[0].textContent.trim().slice(0, 30)
    })
    console.log('   点芯片：', JSON.stringify(开了))
    await sleep(800)
    const 有代价 = await pg.evaluate(() => [...document.querySelectorAll('div')].some(x => x.textContent.includes('代价：') && x.textContent.length < 600))
    console.log('   弹窗含「代价：」：', 有代价)
    // 弹窗卡片 = 「课堂提示」行的父元素（fixed overlay 里的白卡）
    const h弹 = await pg.evaluateHandle(() => {
      const marker = [...document.querySelectorAll('div')].find(x => x.textContent.includes('课堂提示：可现场问学生') && x.textContent.length < 200)
      return marker && marker.parentElement ? marker.parentElement : null
    })
    const el弹 = h弹.asElement()
    if (el弹) { await el弹.screenshot({ path: `${输出}/老师端-弹窗（学生选择+代价）.png` }); const b = await el弹.boundingBox(); console.log(`   ✓ 老师端-弹窗（学生选择+代价）.png（${Math.round(b?.width || 0)}×${Math.round(b?.height || 0)}）`) }
    else console.log('   ✗ 弹窗卡片未找到')
    if (!有代价) await pg.screenshot({ path: `${输出}/_老师端-弹窗未含代价（如实记录）.png` })
    // ② 注入面板：我的 → 事件注入
    await 击文本(pg, '我的'); await sleep(600)
    await 击文本(pg, '事件注入（课堂用）'); await sleep(800)
    await 击文本(pg, '会展周', false); await sleep(300)   // 选中 E2
    const 周输入 = await pg.$('input[inputmode=numeric]')
    if (周输入) { await 周输入.fill('4'); await sleep(400) }
    console.log('   注入前校验区出现：', /注入前校验/.test(await 字(pg)) ? '✓' : '✗（可能目标组为空）')
    // 真做一次注入（前端 → mock 后端 → 列表刷新）—— 证明链路
    await 击文本(pg, '注入到第 4 周（全班）'); await sleep(1200)
    const 注入后 = await 字(pg)
    console.log('   注入结果：', /已注入/.test(注入后) ? '✓ 提示出现' : '✗', /第 4 周/.test(注入后) ? '｜列表含第 4 周' : '')
    await 元素截图(pg, '老师事件注入（一期', '老师端-注入面板.png', 12000)
    // ③ 领班授权页
    await 击文本(pg, '‹ 返回我的'); await sleep(500)
    await 击文本(pg, 'AI 领班（全班默认授权）'); await sleep(800)
    const 授权文 = await 字(pg)
    console.log('   领班页：', /默认全关|未授权/.test(授权文) ? '✓ 默认状态可见' : '✗')
    await 元素截图(pg, 'AI 领班 · 全班默认授权', '老师端-领班授权页.png', 12000)
    console.log(`   页面 JS 异常：${异常.length ? 异常.slice(0, 2).join(' / ') : '无'}`)
    await ctx.close()
  }

  // ══ 学生端：A 应对卡可见（本周注入）══
  {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
    装mock(ctx, 'student', 24)   // 第 4 周第 3 天 ⇒ 不触发自动结算 ⇒ 经营页显示"本周注入应对卡"
    const pg = await ctx.newPage()
    pg.on('dialog', d => d.accept())
    await 登录(pg, 'student')
    const 文 = await 字(pg)
    console.log('学生端到页：', /本周决策进度|经营/.test(文) ? '✓' : '✗', '| 注入卡：', /老师注入/.test(文) ? '✓' : '✗')
    const 有卡 = await 元素截图(pg, '老师注入', '学生-注入应对卡.png', 3000, 'bgFFF4E0')
    if (!有卡) await pg.screenshot({ path: `${输出}/_学生端-未见注入卡（如实记录）.png` })
    await ctx.close()
  }

  // ══ 学生端：B 离线补算 ⇒ 自动结算 ⇒ 周报事件卡 + 离线标注 + 领班复盘 ══
  {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
    装mock(ctx, 'student', 28)   // 第 4 周第 7 天 ⇒ 自动成报；学生档还在第 3 周 ⇒ 补算（迟到结算）
    const pg = await ctx.newPage()
    pg.on('dialog', d => d.accept())
    const 异常 = []
    pg.on('pageerror', e => { if (!/plugin is not implemented/.test(e.message || '')) 异常.push(e.message) })
    await 登录(pg, 'student')
    await sleep(2500)
    const 文 = await 字(pg)
    console.log('学生端(补算)：周报出现：', /本周经营事件|第3周|周报/.test(文) ? '✓' : '✗', '|', 文.split('\n').slice(0, 5).join(' | '))
    const 有标注 = await pg.evaluate(() => [...document.querySelectorAll('div')].some(x => x.textContent.includes('离线未应对')))
    console.log('   离线标注：', 有标注 ? '✓' : '✗')
    // ④ 周报事件卡（老师注入徽章）
    await 元素截图(pg, '老师注入', '学生-周报事件卡（老师注入）.png', 4000)
    // ⑤ 离线标注红条（元素级）
    if (有标注) await 元素截图(pg, '离线未应对', '学生-离线补算标注.png', 260, 'tight')
    // ⑥ 领班复盘卡
    await 元素截图(pg, 'AI 领班', '学生-领班复盘卡（代管记录）.png', 8000)
    console.log(`   页面 JS 异常：${异常.length ? 异常.slice(0, 2).join(' / ') : '无'}`)
    await ctx.close()
  }
} finally { try { await browser?.close() } catch (e) {} }

// ── sha256 自查去重（本项目出过"两个文件名一个文件"）────────────────
try {
  const 图 = readdirSync(输出).filter(f => f.endsWith('.png'))
  const sha = (f) => createHash('sha256').update(readFileSync(`${输出}/${f}`)).digest('hex').slice(0, 12)
  const m = new Map()
  console.log('\n证据图 sha256：')
  for (const f of 图) { const h = sha(f); console.log(`  ${h}  ${f}`); m.set(h, (m.get(h) || []).concat(f)) }
  const 重 = [...m.entries()].filter(([, fs]) => fs.length > 1)
  console.log(重.length ? `✗ 有重图：${重.map(([h, fs]) => fs.join('=')).join(' | ')}` : '✓ 全图互不相同（sha256 去重通过）')
} catch (e) { console.log('（自查跳过）', String(e && e.message)) }
void 站损
