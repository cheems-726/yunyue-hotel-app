// N8 验收：decision_log 端到端
//   ① 真账号（云端登录）做一项决策 → ② 线上表出现该行且 feedback 为真实属性变化文案
//   ③ 教师端第二浏览器 2 秒内实时可见 → ④ game_states 保存行为不变 → ⑤ 清理测试数据
// 运行：ALLOW_PROD_WRITE=1 SUPABASE_PG='postgresql://...' node tests/verify-n8.mjs
// 说明：只在收尾清理时对线上做 DELETE（删除本脚本创建的测试账号与其流水行）；
//       不代写 game_states、不代改 profiles —— 开店与决策全部由 App 自身正常流程完成。
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { PG_URL, PG_HINT, PROD_WRITE_OK, PROD_WRITE_HINT, TEST_CREW, TEST_TEACHER } from './testEnv.mjs'

const require2 = createRequire(import.meta.url)
const { Client } = require2('pg')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:4173/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const results = []
const ok = (n, c, extra = '') => { results.push({ n, pass: !!c }); console.log(`  ${c ? '✓' : '✗'} ${n}${c ? '' : '  [' + extra + ']'}`) }

if (!PROD_WRITE_OK) { console.error(PROD_WRITE_HINT); process.exit(1) }
if (!PG_URL) { console.error(PG_HINT); process.exit(1) }

const SID = TEST_CREW.id   // 测试学生账号（脚本结束会删除）
const SPW = TEST_CREW.pw
const EMAIL = `${SID}@yunyue.study`

async function pg(sql, params = []) {
  const c = new Client({ connectionString: PG_URL })
  await c.connect()
  try { const r = await c.query(sql, params); return r.rows } finally { await c.end() }
}
const uidOf = async () => (await pg('select id from auth.users where email=$1', [EMAIL]))[0]?.id || null
const logRows = async uid => pg('select decision_id, answer, feedback, week, group_key from public.decision_log where user_id=$1 order by created_at desc', [uid])

let browser, server
try {
  if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(1) }
  server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore', shell: true, detached: true })
  for (let i = 0; i < 40; i++) { try { const x = await fetch(BASE); if (x.ok) break } catch (e) {} await sleep(300) }

  // 幂等：清掉上次残留的测试账号与其流水
  const old = await uidOf()
  if (old) {
    await pg('delete from public.decision_log where user_id=$1', [old])
    await pg('delete from auth.users where id=$1', [old])
    console.log('  [复位] 已清理上次残留的测试账号')
  }
  const baseCount = (await pg('select count(*)::int n from public.decision_log'))[0].n
  console.log(`  [基线] decision_log 现有 ${baseCount} 行`)

  browser = await chromium.launch({ executablePath: EDGE, headless: true })

  // ── 浏览器 A：测试学生（云端注册 + 开店 + 做决策）──
  const ctxA = await browser.newContext({ viewport: { width: 480, height: 900 }, isMobile: true, hasTouch: true })
  const A = await ctxA.newPage()
  A.on('dialog', d => d.accept())
  const errsA = []
  A.on('pageerror', e => { if (!(e.message || '').includes('plugin is not implemented')) errsA.push(e.message) })
  A.on('console', m => { if (m.type() === 'error' && !m.text().includes('plugin is not implemented')) errsA.push('[console] ' + m.text().slice(0, 140)) })

  await A.goto(BASE); await A.waitForLoadState('domcontentloaded'); await sleep(1200)
  await A.evaluate(() => localStorage.clear())
  await A.reload(); await A.waitForLoadState('domcontentloaded'); await sleep(1300)
  await A.evaluate(() => { const b = [...document.querySelectorAll('button, span')].find(x => x.textContent.includes('我是学生')); b && b.click() }); await sleep(500)
  await A.evaluate(({ id, pw }) => {
    const inputs = [...document.querySelectorAll('input')]
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inputs[0], id); inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
    setter.call(inputs[1], pw); inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
    const reg = [...document.querySelectorAll('button')].find(x => x.textContent.includes('注册并登录'))
    if (reg) { reg.click(); return }
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled); b && b.click()
  }, { id: SID, pw: SPW })
  await sleep(5000)
  let bodyA = await A.evaluate(() => document.body.innerText)
  ok('测试学生注册并登录（云端）', !bodyA.includes('学生登录') && !bodyA.includes('注册失败'), bodyA.slice(0, 70).replace(/\n/g, '|'))
  const uid = await uidOf()
  ok('线上已生成该账号（auth.users）', !!uid)

  // 开店流程（与 App 正常流程一致，全程 App 自身写库）
  const click = async t => { await A.evaluate(x => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(e => e.textContent.trim() === x || e.textContent.includes(x)); b && b.click() }, t); await sleep(600) }
  const clickCard = async (t, mode = 'includes') => A.evaluate(({ t, mode }) => {
    const m = [...document.querySelectorAll('.district-card, div')].filter(x => mode === 'starts' ? x.textContent.startsWith(t) : x.textContent.includes(t))
    if (!m.length) return false
    const inner = m.reverse().find(x => !m.some(y => y !== x && x.contains(y)))
    inner.click(); return true
  }, { t, mode })
  const hasOverlay = () => A.evaluate(() => [...document.querySelectorAll('div')].some(d => d.style.position === 'fixed' && d.textContent.includes('你的选择会带来')))
  const closeOverlay = async () => { await A.evaluate(() => { const b = [...document.querySelectorAll('*')].find(x => x.textContent.trim() === '明白了'); b && b.click() }); await sleep(300) }

  await click('开始我的酒店之旅'); await sleep(900)
  await clickCard('锦江区'); await sleep(400); await click('确认选址'); await sleep(800)
  await clickCard('汉庭'); await sleep(400); await click('确认选择'); await sleep(800)
  await clickCard('OTA平台合作'); await sleep(400); await click('确认'); await sleep(700)
  await clickCard('社区旁物业'); await sleep(400)
  for (let i = 0; i < 7; i++) {
    const done = await A.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('完成认领'))
      if (b) { b.click(); return true }
      const n = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('下一步'))
      if (n) n.click(); return false
    })
    await sleep(600); if (done) break
  }
  ok('认领完成进入筹建', (await A.evaluate(() => document.body.innerText)).includes('门店筹建'))
  await clickCard('基准情景', 'starts'); await sleep(500); if (await hasOverlay()) await closeOverlay()
  await A.evaluate(() => { const s = [...document.querySelectorAll('div')].find(d => d.textContent === '📄' && d.style.cursor === 'pointer'); s && s.click() }); await sleep(400)
  for (const n of ['申领营业执照', '刻章备案', '消防检查合格证', '特种行业经营许可证', '卫生许可证', '税务申报']) {
    await clickCard(n, 'starts'); await sleep(450)
    if (!(await hasOverlay())) { await closeOverlay(); await clickCard(n, 'starts'); await sleep(450) }
    await closeOverlay()
  }
  await A.evaluate(() => { const s = [...document.querySelectorAll('div')].find(d => d.textContent === '🛒' && d.style.cursor === 'pointer'); s && s.click() }); await sleep(400)
  await clickCard('供应商 A'); await sleep(600); if (await hasOverlay()) await closeOverlay()
  await A.evaluate(() => { const s = [...document.querySelectorAll('div')].find(d => d.textContent === '🎉' && d.style.cursor === 'pointer'); s && s.click() }); await sleep(400)
  for (const n of ['装修', '系统上线', '招聘']) {
    await clickCard(n, 'starts'); await sleep(450); if (await hasOverlay()) await closeOverlay()
    await clickCard(n, 'starts'); await sleep(400)
  }
  await click('完成筹建'); await sleep(1300); await closeOverlay(); await sleep(800)
  bodyA = await A.evaluate(() => document.body.innerText)
  ok('开店完成进入经营页', bodyA.includes('资金状况') && bodyA.includes('0 / 18'), bodyA.slice(0, 60).replace(/\n/g, '|'))

  // ── 浏览器 B：教师（实时决策页，等待流水实时出现）──
  const ctxB = await browser.newContext({ viewport: { width: 480, height: 900 }, isMobile: true, hasTouch: true })
  const B = await ctxB.newPage()
  B.on('dialog', d => d.accept())
  const errsB = []
  B.on('pageerror', e => { if (!(e.message || '').includes('plugin is not implemented')) errsB.push(e.message) })
  await B.goto(BASE); await B.waitForLoadState('domcontentloaded'); await sleep(1200)
  await B.evaluate(() => localStorage.clear())
  await B.reload(); await B.waitForLoadState('domcontentloaded'); await sleep(1300)
  await B.evaluate(() => { const b = [...document.querySelectorAll('button, span')].find(x => x.textContent.includes('我是老师')); b && b.click() }); await sleep(500)
  await B.evaluate(({ id, pw }) => {
    const inputs = [...document.querySelectorAll('input')]
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inputs[0], id); inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
    setter.call(inputs[1], pw); inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled); b && b.click()
  }, { id: TEST_TEACHER.id, pw: TEST_TEACHER.pw })
  await sleep(6500)
  let bodyB = await B.evaluate(() => document.body.innerText)
  ok('教师端登录（实时决策页）', bodyB.includes('教师后台'), bodyB.slice(0, 60).replace(/\n/g, '|'))
  ok('决策流水区已渲染', bodyB.includes('决策流水'), bodyB.slice(0, 80).replace(/\n/g, '|'))

  // ── 关键一步：学生在"客房质检"上做决策，教师端应 2 秒内出现新记录 ──
  const t0 = Date.now()
  await A.evaluate(() => { const c = [...document.querySelectorAll('.task-card')].find(x => x.textContent.includes('客房质检')); c && c.click() }); await sleep(900)
  await A.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && (x.textContent.includes('确认决策') || x.textContent.includes('修改决策') || x.textContent.includes('提交'))); b && b.click() })
  await closeOverlay()

  let seenMs = null
  for (let i = 0; i < 30; i++) {   // 最多等 ~7.5s
    await sleep(250)
    const t = await B.evaluate(() => document.body.innerText)
    if (t.includes('品质 +5') || t.includes('客房质检')) { seenMs = Date.now() - t0; break }
  }
  console.log(`   学生决策 → 教师端可见：${seenMs == null ? '未出现' : seenMs + 'ms'}`)
  ok('教师端流水区在 ~2 秒内出现该条', seenMs != null && seenMs <= 2500, `seenMs=${seenMs}`)

  // ── 线上表落库核验 ──
  await sleep(1200)
  const rows = await logRows(uid)
  console.log('   decision_log 落库：', JSON.stringify(rows))
  ok('线上 decision_log 多了一条', rows.length === 1, `rows=${rows.length}`)
  ok('decision_id 正确', rows[0] && rows[0].decision_id === 'quality-check', rows[0] && rows[0].decision_id)
  ok('answer 非空', !!(rows[0] && rows[0].answer), rows[0] && rows[0].answer)
  // 不断言固定数值：起手品质取决于开店时选的采购渠道（供应商A +4 → 64），只校验"真实变化"结构
  const fb = rows[0] ? String(rows[0].feedback) : ''
  const m = fb.match(/品质 \+(\d+)（(\d+)→(\d+)）/)
  ok('feedback 是真实属性变化文案（品质 +N（before→after）且 after=before+N）',
    !!m && Number(m[3]) === Number(m[2]) + Number(m[1]), fb)
  ok('feedback 非静态 result 文本', !!(rows[0] && !/出租率|成本|回收期/.test(rows[0].feedback)), rows[0] && rows[0].feedback)

  // ── game_states 保存行为不变 ──
  const gs1 = (await pg('select state->>\'week\' as w, jsonb_object_keys_count from (select state, (select count(*) from jsonb_object_keys(coalesce(state->\'doneDecisions\',\'{}\'::jsonb))) as jsonb_object_keys_count from public.game_states where user_id=$1) t', [uid]))
    .map(r => ({ w: r.w, done: r.jsonb_object_keys_count }))[0]
  ok('game_states 已按原链路保存（周次存在）', !!gs1 && !!gs1.w, JSON.stringify(gs1))
  await A.reload(); await A.waitForLoadState('domcontentloaded'); await sleep(2600)
  const bodyA2 = await A.evaluate(() => document.body.innerText)
  ok('学生端刷新后决策仍在（1/18）', bodyA2.includes('1 / 18'), bodyA2.slice(0, 70).replace(/\n/g, '|'))
  ok('双方页面无 JS 报错', errsA.length === 0 && errsB.length === 0, [...errsA, ...errsB].slice(0, 2).join(' | '))

  // ── 清理：删除本次测试账号与其流水行（表内不留测试脏数据）──
  await pg('delete from public.decision_log where user_id=$1', [uid])
  await pg('delete from auth.users where id=$1', [uid])
  const after = (await pg('select count(*)::int n from public.decision_log'))[0].n
  const stillUid = await uidOf()
  console.log(`   [清理] decision_log 行数 ${baseCount} → ${after}；测试账号残留：${stillUid ? '有 ❌' : '无 ✓'}`)
  ok('测试数据已清理（表行数回到基线）', after === baseCount, `${baseCount} → ${after}`)
  ok('测试账号已删除', !stillUid)

  const failed = results.filter(r => !r.pass)
  console.log(`\n========== N8 验收：${results.length - failed.length} 通过 / ${failed.length} 失败 ==========`)
  failed.forEach(f => console.log('  ✗ ' + f.n))
  process.exitCode = failed.length ? 1 : 0
} catch (e) { console.error('中断:', e.message); process.exitCode = 1 } finally {
  try { await browser?.close() } catch (e) {}
  try { if (server?.pid) require2('node:child_process').execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }) } catch (e) {}
}
