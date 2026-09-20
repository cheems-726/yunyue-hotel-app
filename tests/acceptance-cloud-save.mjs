// 云端保存修复真验收：决策后 1 秒内刷新，数据必须已在 Supabase
// 流程：注册队友 B → pg 编入 酒管2401|1 组 → B 登录读到组档 → 做一个决策 → 150ms 后刷新
//      → pg 验证：updated_at 变化 + done_cnt=1 + user_id 仍是原属主（P3）
// 运行：先 npm run build，再 node tests/acceptance-cloud-save.mjs
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const require2 = createRequire(import.meta.url)
const { Client } = require2('pg')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4173
const BASE = `http://localhost:${PORT}/`
const PG = 'postgresql://postgres.jgytwxaeeezmdbxfsyvs:Yunyue2026!Hotel%23Teach@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres'
const GROUP_KEY = '酒管2401|1'
const CREATOR_UID = 'a0079c63-380e-4ef0-ae8d-e5edbbd966f0' // 20240999，组档原属主
const B_ID = '20249998'
const B_PW = '123456'

const results = []
function ok(name, cond, extra = '') {
  results.push({ name, pass: !!cond })
  console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : '  [' + extra + ']'))
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function pgQ(sql, params = []) {
  const c = new Client({ connectionString: PG })
  await c.connect()
  const r = await c.query(sql, params)
  await c.end()
  return r.rows
}
async function groupRow() {
  const rows = await pgQ(`select user_id, week, finished, updated_at,
    (select count(*) from jsonb_object_keys(COALESCE(state->'doneDecisions','{}'::jsonb))) as done_cnt
    from game_states where group_key = $1`, [GROUP_KEY])
  return rows[0]
}

let browser, server
try {
  if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(1) }
  // 清理占用 4173 的残留服务器（Windows 已知坑：旧进程持有端口 → 测的是旧代码）
  try { require2('node:child_process').execSync('for /f "tokens=5" %a in (\'netstat -ano ^| findstr :4173 ^| findstr LISTENING\') do @taskkill /PID %a /T /F', { stdio: 'ignore', shell: 'cmd.exe' }) } catch (e) {}
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true })
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch(BASE); if (r.ok) break } catch (e) {}
    await sleep(300)
  }
  browser = await chromium.launch({ executablePath: EDGE, headless: true })

  // 幂等复位：清 B 账号 + 把组档 doneDecisions 归零（演示档，每周决策记录非结算数据）
  await pgQ(`delete from profiles where user_id in (select id from auth.users where email = $1)`, [`${B_ID}@yunyue.study`])
  await pgQ(`delete from auth.users where email = $1`, [`${B_ID}@yunyue.study`])
  await pgQ(`update game_states set state = jsonb_set(state, '{doneDecisions}', '{}'::jsonb) where group_key = $1`, [GROUP_KEY])

  const before = await groupRow()
  console.log('  [before]', JSON.stringify(before))

  // ── 1. 注册队友 B（无组新号）──
  const ctx1 = await browser.newContext({ viewport: { width: 480, height: 900 } })
  const p1 = await ctx1.newPage()
  p1.on('dialog', d => d.accept())
  await p1.goto(BASE); await p1.waitForLoadState('domcontentloaded'); await sleep(1300)
  await p1.evaluate(() => localStorage.clear())
  await p1.reload(); await p1.waitForLoadState('domcontentloaded'); await sleep(1300)
  await p1.evaluate(() => { const b = [...document.querySelectorAll('button, span')].find(x => x.textContent.includes('我是学生')); b && b.click() })
  await sleep(500)
  await p1.evaluate(({ id, pw }) => {
    const inputs = [...document.querySelectorAll('input')]
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inputs[0], id); inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
    setter.call(inputs[1], pw); inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
    const reg = [...document.querySelectorAll('button')].find(x => x.textContent.includes('注册并登录'))
    reg && reg.click()
  }, { id: B_ID, pw: B_PW })
  await sleep(5000)
  const regBody = await p1.evaluate(() => document.body.innerText)
  ok('队友B注册并进入App', !regBody.includes('学生登录') && !regBody.includes('注册失败'), regBody.slice(0, 80).replace(/\n/g, ' | '))
  await ctx1.close()

  // ── 2. pg 把 B 编入组 1 ──
  await pgQ(`update profiles set class_name = '酒管2401', group_no = '1' where user_id in (select id from auth.users where email = $1)`, [`${B_ID}@yunyue.study`])
  const bProfile = await pgQ(`select user_id, class_name, group_no from profiles where user_id in (select id from auth.users where email = $1)`, [`${B_ID}@yunyue.study`])
  ok('B已编入酒管2401第1组', bProfile[0] && bProfile[0].class_name === '酒管2401' && String(bProfile[0].group_no) === '1')

  // ── 3. B 重新登录：应读到组档（A 开的店，第5周 0/18）──
  const ctx2 = await browser.newContext({ viewport: { width: 480, height: 900 } })
  const pg = await ctx2.newPage()
  pg.on('dialog', d => d.accept())
  pg.on('pageerror', e => console.log('  [pageerror]', (e.message || '').slice(0, 140)))
  await pg.goto(BASE); await pg.waitForLoadState('domcontentloaded'); await sleep(1300)
  await pg.evaluate(() => localStorage.clear())
  await pg.reload(); await pg.waitForLoadState('domcontentloaded'); await sleep(1300)
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button, span')].find(x => x.textContent.includes('我是学生')); b && b.click() })
  await sleep(500)
  await pg.evaluate(({ id, pw }) => {
    const inputs = [...document.querySelectorAll('input')]
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inputs[0], id); inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
    setter.call(inputs[1], pw); inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
    const btn = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled)
    btn && btn.click()
  }, { id: B_ID, pw: B_PW })
  await sleep(4000)
  const biz = await pg.evaluate(() => document.body.innerText)
  ok('B登录读到组档（经营页，非开店页）', biz.includes('0 / 18') && biz.includes('资金状况') && !biz.includes('开始我的酒店之旅'), biz.slice(0, 100).replace(/\n/g, ' | '))

  // ── 4. 做一个决策 → 150ms 后立刻刷新（防抖 800ms 未到，只能靠 flushSave 兜底）──
  let panelTxt = ''
  for (let i = 0; i < 3 && !panelTxt; i++) { // 面板打开有渲染竞态，最多重试3次
    await pg.evaluate(() => {
      const el = [...document.querySelectorAll('div, span')].reverse().find(x => x.textContent.trim() === '去决策')
      el && el.click()
    }); await sleep(900)
    panelTxt = await pg.evaluate(() => document.body.innerText || '')
    if (!(panelTxt.includes('应急预案') || panelTxt.includes('30秒') || panelTxt.includes('提交'))) panelTxt = ''
  }
  ok('决策面板可打开', !!panelTxt, panelTxt.slice(0, 60))
  await pg.evaluate(() => {
    const opt = [...document.querySelectorAll('button, div')].find(x => x.textContent.trim() === '立即送医+道歉')
    if (opt) { opt.click(); return }
    const any = [...document.querySelectorAll('button')].find(b => !b.disabled && b.textContent.trim().length < 12 && b.textContent !== '‹ 返回' && !b.textContent.includes('提交'))
    any && any.click()
  }); await sleep(400)
  await pg.evaluate(() => {
    const s = [...document.querySelectorAll('button')].find(b => !b.disabled && (b.textContent.includes('提交') || b.textContent.includes('确认')))
    s && s.click()
  })
  const tDecision = Date.now()
  await sleep(150) // 距提交仅 150ms，防抖 800ms 未到
  const tReload = Date.now()
  await pg.reload() // 触发 visibilitychange(hidden) + pagehide → flushSave keepalive PATCH
  await pg.waitForLoadState('domcontentloaded'); await sleep(3500)
  const afterReload = await pg.evaluate(() => document.body.innerText)
  const expectDone = `${Number(before.done_cnt) + 1} / 18`
  ok(`刷新后 UI 恢复（${expectDone}，本机即显）`, afterReload.includes(expectDone), afterReload.slice(0, 100).replace(/\n/g, ' | '))
  console.log(`  [时序] 决策提交 → 发起刷新 ≈ ${tReload - tDecision}ms（防抖窗口 800ms 内 = 必须走 flush 路径）`)

  // ── 5. pg 权威验证：云端真的落库了 + user_id 仍是原属主 ──
  await sleep(2500) // 留给 keepalive 请求完成
  const after = await groupRow()
  console.log('  [after] ', JSON.stringify(after))
  ok('云端已落库（done_cnt 0→1）', Number(after.done_cnt) === Number(before.done_cnt) + 1, `before=${before.done_cnt} after=${after.done_cnt}`)
  ok('P3：队友写入后 user_id 仍是原属主', after.user_id === CREATOR_UID, `got=${after.user_id}`)
  ok('week 未被误改（仍=5）', Number(after.week) === Number(before.week), `got=${after.week}`)

  // ── 6. P1 验证：断网拦截 → 保存失败 → 3s 重试仍失败 → toast 提示 ──
  await pg.route('**/rest/v1/game_states**', r => r.abort())
  let submitted = false
  for (let i = 0; i < 3 && !submitted; i++) { // 面板打开有渲染竞态（实时流水重渲染），原生 locator 点击 + 重试
    try {
      await pg.locator('span, div').filter({ hasText: /^去决策$/ }).last().click({ timeout: 4000 })
    } catch (e) {}
    await sleep(900)
    const hasPanel = await pg.evaluate(() => {
      const btts = [...document.querySelectorAll('button')].map(b => b.textContent)
      return btts.some(t => t.includes('提交') || t.includes('确认') || t.includes('请先做出选择'))
    })
    if (!hasPanel) continue
    const pickInfo = await pg.evaluate(() => {
      // 选项可能是 button 或 div（如"装修改造"的选项是 div），按已知选项精确匹配优先
      const wanted = ['立即送医+道歉', '不投', '投150万改造']
      for (const t of wanted) {
        const el = [...document.querySelectorAll('button, div')].find(x => x.textContent.trim() === t)
        if (el) { el.click(); return { clicked: t } }
      }
      const any = [...document.querySelectorAll('button')].find(b => !b.disabled && b.textContent.trim().length < 12 && b.textContent !== '‹ 返回' && !b.textContent.includes('提交'))
      if (any) { any.click(); return { clicked: 'fallback:' + any.textContent.trim() } }
      return { clicked: null }
    })
    await sleep(600)
    const sel = await pg.evaluate(() => ({
      selectedCards: document.querySelectorAll('.district-card.selected').length,
      confirmLabel: ([...document.querySelectorAll('button')].find(b => b.textContent.includes('确认决策') || b.textContent.includes('请先做出选择')) || {}).textContent || '(无确认钮)',
      overlay: !![...document.querySelectorAll('div')].find(d => d.style.position === 'fixed' && d.textContent.includes('你的选择会带来')),
    }))
    console.log('  [断网诊断]', JSON.stringify(pickInfo), JSON.stringify(sel))
    if (sel.overlay) { // 关"预期结果"浮层后再确认
      await pg.evaluate(() => { const b = [...document.querySelectorAll('button, span, div')].find(x => x.textContent.trim() === '明白了'); b && b.click() })
      await sleep(400)
    }
    submitted = await pg.evaluate(() => {
      const s = [...document.querySelectorAll('button')].find(b => !b.disabled && (b.textContent.includes('提交') || b.textContent.includes('确认')))
      if (s) { s.click(); return true }
      return false
    })
  }
  ok('断网段：第二项决策已提交', submitted)
  let toastSeen = false, lastBody = ''
  for (let i = 0; i < 20; i++) { // 首次失败(800ms防抖+RTT) → 3s重试 → 仍失败才提示，共约5s
    await sleep(500)
    lastBody = await pg.evaluate(() => document.body.innerText)
    if (lastBody.includes('云端同步失败')) { toastSeen = true; break }
  }
  ok('P1：保存失败时 toast 提示（重试1次后）', toastSeen, lastBody.slice(-80).replace(/\n/g, ' | '))
  await pg.unroute('**/rest/v1/game_states**')
  console.log('  [注] 断网段的决策只存了本机（云端 done_cnt 停在1），属预期演示')

  // ── 7. 诊断：确认 sb- 会话键格式与 saveGameStateNow 的取键规则一致 ──
  const keys = await pg.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('sb-')))
  console.log('  [诊断] localStorage sb- 键：', keys.join(', ') || '(无)')
} catch (e) {
  results.push({ name: '测试执行中断: ' + e.message, pass: false })
  console.error(e)
}

const failed = results.filter(r => !r.pass)
console.log('\n========== 结果: ' + (results.length - failed.length) + ' 通过 / ' + failed.length + ' 失败 ==========')
for (const f of failed) console.log('  ✗ ' + f.name)
if (!failed.length) {
  // 全过后复位演示档：组档决策记录清零 + 删测试队友 B，留给用户手动体验时是干净状态
  try {
    await pgQ(`update game_states set state = jsonb_set(state, '{doneDecisions}', '{}'::jsonb) where group_key = $1`, [GROUP_KEY])
    await pgQ(`delete from profiles where user_id in (select id from auth.users where email = $1)`, [`${B_ID}@yunyue.study`])
    await pgQ(`delete from auth.users where email = $1`, [`${B_ID}@yunyue.study`])
    console.log('  [复位] 演示档已还原（酒管2401|1 → 0/18，测试账号B已删）')
  } catch (e) { console.log('  [复位失败]', e.message) }
}
try { await browser?.close() } catch (e) {}
try { if (server?.pid) require2('node:child_process').execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }) } catch (e) {}
process.exit(failed.length ? 1 : 0)
