// 实时评价联动 · 浏览器端到端验收（真机链路，不是纯函数）
//
// 运行：npm run build && node tests/verify-live-review-ui.mjs
// 前置：dist/ 已构建
//
// 覆盖验收：□ 一节课(45min)的条数区间 □ 下午课时段也能出评价 □ 刷新后计数不归零、上限仍生效
//           □ 决策上首页流水（🎯） □ 结算后数字与卡片一致
//
// ⚠️ 关键前提：LiveFeed 用固定种子的独立随机流（0x5A17A2），其第 1 个抽取 = 0.104、
//    第 14 个抽取 = 0.038 —— 因此本脚本把 Math.random 钉成 0.01（强制每 tick 都触发事件），
//    再配合高位属性（p 大）与高入住（crowd=1），让"命中时刻"可预期。

import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { CAUSE_SOURCE } from '../src/guests.js'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4176
const BASE = `http://localhost:${PORT}/`
const results = []
let browser, server, lastText = ''
function ok(name, cond) {
  results.push({ name, pass: !!cond })
  console.log((cond ? '  ✓ ' : '  ✗ ') + name)
  if (!cond) console.log('    [页面] ' + String(lastText).slice(0, 160).replace(/\n/g, ' | '))
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function text(page) { lastText = await page.evaluate(() => document.body.innerText); return lastText }
async function clickText(page, t) {
  return page.evaluate(t2 => {
    const b = [...document.querySelectorAll('button, span, div')].reverse().find(x => x.textContent.trim() === t2 || x.textContent.includes(t2))
    if (b) { b.click(); return true }
    return false
  }, t)
}
async function clickCard(page, t, mode = 'includes') {
  return page.evaluate(({ t, mode }) => {
    const matches = [...document.querySelectorAll('.district-card, div')].filter(x =>
      mode === 'starts' ? x.textContent.startsWith(t) : x.textContent.includes(t))
    if (!matches.length) return false
    // 最内层匹配：不再包含其他匹配元素的元素（真正绑事件的那层）——与 ui-smoke 同实现
    const inner = matches.reverse().find(x => !matches.some(y => y !== x && x.contains(y)))
    inner.click()
    return true
  }, { t, mode })
}
async function hasOverlay(page) {
  return page.evaluate(() => !!([...document.querySelectorAll('div')].find(d => d.style.position === 'fixed' && d.textContent.includes('你的选择会带来'))))
}
// 底部导航精确点击：只找 .tabbar 里的按钮（'经营'这类词在正文里到处都是，全局匹配会点错）
async function clickTab(page, label) {
  return page.evaluate(l => {
    const tb = document.querySelector('.tabbar')
    if (!tb) return false
    const b = [...tb.querySelectorAll('button, div, span')].find(x => x.textContent.includes(l))
    if (b) { b.click(); return true }
    return false
  }, label)
}
async function closeOverlay(page) { await clickText(page, '明白了'); await sleep(250) }
const reviews = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('hotel-sim-reviews') || '[]') } catch (e) { return [] } })

if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(1) }

server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true })
for (let i = 0; i < 30; i++) { try { const r = await fetch(BASE); if (r.ok) break } catch (e) {} await sleep(300) }
browser = await chromium.launch({ executablePath: EDGE, headless: true })
const ctx = await browser.newContext({ viewport: { width: 480, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', e => { const m = e.message || ''; if (!m.includes('plugin is not implemented')) ok('页面JS异常: ' + m, false) })
page.on('console', m => { if (m.type() === 'error' && !String(m.text()).includes('plugin is not implemented')) ok('控制台报错: ' + m.text().slice(0, 90), false) })

try {
  console.log('▶ 实时评价联动 · 端到端验收')
  await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload(); await sleep(1200)

  // ── 开店（与 ui-smoke 同一条路，离线演示）──
  await clickText(page, '我是学生'); await sleep(400)
  await clickText(page, '离线演示'); await sleep(400)
  await clickText(page, '进入演示'); await sleep(700)
  await clickText(page, '开始我的酒店之旅'); await sleep(800)
  await clickCard(page, '锦江区'); await sleep(500); await closeOverlay(page)
  await clickText(page, '确认选址'); await sleep(700)
  await clickCard(page, '汉庭'); await sleep(450)
  await clickText(page, '确认选择'); await sleep(700)
  await clickCard(page, 'OTA平台合作'); await sleep(400)
  await clickText(page, '确认'); await sleep(650)
  await clickCard(page, '社区旁物业'); await sleep(400)
  for (let i = 0; i < 7; i++) {
    const done = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('完成认领'))
      if (b) { b.click(); return true }
      const n = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('下一步'))
      if (n) { n.click(); return false }
      return false
    })
    await sleep(550); if (done) break
  }
  await clickCard(page, '基准情景', 'starts'); await sleep(500); await closeOverlay(page)
  await page.evaluate(() => { const s = [...document.querySelectorAll('div')].find(d => d.textContent === '📄' && d.style.cursor === 'pointer'); s && s.click() }); await sleep(400)
  for (const n of ['申领营业执照', '刻章备案', '消防检查合格证', '特种行业经营许可证', '卫生许可证', '税务申报']) {
    await clickCard(page, n, 'starts'); await sleep(450)
    if (!(await hasOverlay(page))) { await closeOverlay(page); await clickCard(page, n, 'starts'); await sleep(450) }
    await closeOverlay(page)
  }
  await page.evaluate(() => { const s = [...document.querySelectorAll('div')].find(d => d.textContent === '🛒' && d.style.cursor === 'pointer'); s && s.click() }); await sleep(400)
  await clickCard(page, '供应商 A'); await sleep(500); await closeOverlay(page)
  await page.evaluate(() => { const s = [...document.querySelectorAll('div')].find(d => d.textContent === '🎉' && d.style.cursor === 'pointer'); s && s.click() }); await sleep(400)
  for (const n of ['装修', '系统上线', '招聘']) { await clickCard(page, n, 'starts'); await sleep(450); await closeOverlay(page); await clickCard(page, n, 'starts'); await sleep(300) }
  await clickText(page, '完成筹建'); await sleep(1200); await closeOverlay(page)
  ok('已进入经营页', (await text(page)).includes('资金状况'))

  // ── 注入验收前置：高属性 + 高入住（否则 occupancy=0 → crowd=0 → 永远不出评价）──
  const week = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('hotel-sim-state') || '{}')
    st.attrs = { quality: 95, reputation: 95, morale: 95, ...(st.attrs || {}) }
    st.attrs = { quality: 95, reputation: 95, morale: 95 }
    st.history = [{ week: 1, occupancy: 85, occupiedRooms: 60, rooms: 70, price: 230, revenue: 200000, profit: 8000, goodRate: 90, finalGoodRate: 90, negativeCount: 0, reviewCount: 5, totalCost: 3000, totalExpenses: 0 }]
    localStorage.setItem('hotel-sim-state', JSON.stringify(st))
    return st.week || 1
  }).catch(() => 1)
  const today = new Date().toISOString().slice(0, 10)
  const liveKey = `hotel-live-${today}-w${week}`
  const weekKey = `hotel-review-week-w${week}`
  await page.addInitScript(() => { Math.random = () => 0.01 })   // 每次 tick 都触发事件（否则 4% 命中率等不起）
  const seed = async (gameMin, dayCount) => {
    await page.evaluate(({ liveKey, gameMin, dayCount }) => {
      localStorage.setItem(liveKey, JSON.stringify({
        income: 0, expense: 0, checkout: 0, checkin: 0, guests: 60, gameMin,
        pendingClean: [], feed: [], flows: [], rvDayNo: String(Math.floor(gameMin / 1440)), rvDayCount: dayCount,
      }))
    }, { liveKey, gameMin, dayCount })
    await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(1500)
  }

  // ── A. 退房时段（06:00）：命中 → 落库 → 日上限封顶 ──
  console.log('\n▶ A 退房时段（06:00 起跑）')
  await seed(6 * 60, 0)
  ok('经营页已恢复', (await text(page)).includes('资金状况'))
  let liveA = []
  for (let i = 0; i < 30; i++) {   // 最多等 60 秒（留足流位置波动）
    await sleep(2000)
    liveA = (await reviews(page)).filter(r => r.live)
    if (liveA.length >= 3) break
  }
  ok(`退房时段产生实时评价（${liveA.length} 条）`, liveA.length >= 1)
  await sleep(6000)
  liveA = (await reviews(page)).filter(r => r.live)
  ok(`游戏日上限生效：当日实时评价 = 3 条（实际 ${liveA.length}）`, liveA.length === 3)
  const e0 = liveA[0] || {}
  ok('卡片字段齐全（live 标记/周/日期/房型/天数/原因）', e0.live === true && e0.liveWeek === week && e0.liveDate === today && !!e0.roomType && e0.nights >= 1 && !!e0.cause)
  ok('身份自洽（性别↔头像）', !!e0.guest && e0.avatar === (e0.guest.gender === 'male' ? '🧑' : '👩'))
  ok(`流水区出现 💬 评价动态（${String(lastText).includes('💬') ? '已出现' : '未出现'}）`, String(lastText).includes('💬'))
  const afterA = await page.evaluate(({ liveKey, weekKey }) => ({
    store: JSON.parse(localStorage.getItem(liveKey) || '{}'),
    weekCount: Number(localStorage.getItem(weekKey) || 0),
  }), { liveKey, weekKey })
  ok(`计数已持久化（游戏日 ${afterA.store.rvDayCount} / 当周 ${afterA.weekCount}）`, afterA.store.rvDayCount === 3 && afterA.weekCount === 3)

  // ── B. 刷新不归零 ──
  console.log('\n▶ B 刷新后计数不归零')
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(2500)
  const afterB = await page.evaluate(({ liveKey, weekKey }) => ({
    store: JSON.parse(localStorage.getItem(liveKey) || '{}'),
    weekCount: Number(localStorage.getItem(weekKey) || 0),
    live: JSON.parse(localStorage.getItem('hotel-sim-reviews') || '[]').filter(r => r.live).length,
  }), { liveKey, weekKey })
  ok(`刷新后游戏日计数仍是 ${afterB.store.rvDayCount}`, afterB.store.rvDayCount === 3)
  ok(`刷新后当周计数仍是 ${afterB.weekCount}（未归零）`, afterB.weekCount === 3)
  ok(`刷新后卡片仍在（${afterB.live} 张）`, afterB.live === 3)
  await sleep(6000)
  const stillCapped = (await reviews(page)).filter(r => r.live).length
  ok(`刷新后上限仍生效（未突破 3 条 → ${stillCapped}）`, stillCapped === 3)
  ok('刷新后流水区仍有 💬 动态', (await text(page)).includes('💬'))

  // ── C. 下午课时段（14:00，非退房 ×1/5）也能出评价 ──
  console.log('\n▶ C 下午课时段（14:00，非退房时段）')
  await seed(14 * 60, 0)   // 新的一天 → 日计数归零
  let liveC = 0
  for (let i = 0; i < 45; i++) {   // 最多等 90 秒（固定随机流命中位置会随命中次数微移）
    await sleep(2000)
    liveC = (await reviews(page)).filter(r => r.live).length
    if (liveC > 3) break
  }
  ok(`下午时段也能出评价（新增 ${liveC - 3} 条）`, liveC > 3)
  const cEntry = (await reviews(page)).filter(r => r.live).slice(-1)[0] || {}
  ok(`该条时间戳落在下午时段（${cEntry.date}）`, /1[4-9]:\d\d/.test(String(cEntry.date)) || /2[0-3]:\d\d/.test(String(cEntry.date)))

  // ── D. 决策上首页流水（🎯）──
  console.log('\n▶ D 真实决策进入流水')
  await clickTab(page, '经营'); await sleep(600)
  const openedDec = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.task-card')].find(x => x.textContent.includes('前台排班'))
    if (c) { c.click(); return true }
    return false
  })
  await sleep(800)
  ok('决策面板已打开（前台排班）', openedDec)
  await page.evaluate(() => {
    const o = [...document.querySelectorAll('div, button')].reverse().find(x => x.textContent.includes('精简省成本') && x.children.length <= 2)
    if (o) o.click()
  })
  await sleep(500)
  const confirmed = await page.evaluate(() => {
    const b = document.querySelector('.btn-confirm')
    if (b && !b.disabled) { b.click(); return b.textContent.trim() }
    return ''
  })
  await sleep(1200)
  ok(`确认按钮文案：${confirmed || '未找到 .btn-confirm'}`, !!confirmed)
  const done = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('hotel-sim-state') || '{}')
    return Object.keys(st.doneDecisions || {})
  })
  ok(`决策已提交（已记录 ${done.length} 项）`, done.length >= 1)
  await clickTab(page, '经营'); await sleep(1200)
  const feedText = await text(page)
  const zhLine = (feedText.match(/🎯 \[\d\d:\d\d\][^\n]*/) || [''])[0]
  console.log('    [🎯 流水] ' + zhLine.slice(0, 90))
  ok('流水区出现 🎯 决策条目（含时刻）', /🎯 \[\d\d:\d\d\] 完成「/.test(feedText))
  ok('决策条目带决策名与选项', /完成「.*前台排班/.test(zhLine) && /精简省成本/.test(zhLine))

  // ── E. 口碑页：实时评价卡片可见 ──
  console.log('\n▶ E 口碑页队列')
  await clickTab(page, '口碑'); await sleep(1500)
  const repText = await text(page)
  ok('口碑页已切换（口碑构成拆解/待处理区出现）', repText.includes('口碑构成拆解') || repText.includes('待处理'))
  ok('实时评价卡片进入口碑页', !!e0.name && (repText.includes(String(e0.name)) || repText.includes(String(e0.text).slice(1, 8))))

  // ── F. 结算：数字与卡片一致 ──
  console.log('\n▶ F 结算后数字与卡片一致（严谨版差额）')
  await clickTab(page, '经营'); await sleep(1000)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('本周结算')); if (b) b.click() })
  await sleep(1200)
  await clickText(page, '确认'); await sleep(1200)
  let wr = await text(page)
  for (let i = 0; i < 6 && !wr.includes('周经营结果'); i++) { await sleep(2000); wr = await text(page) }
  const m = wr.match(/本周\s*(\d+)\s*条评价[，,]\s*(\d+)\s*条差评/)
  ok(`周报读取到评价数（${m ? m[1] + ' 条评价 / ' + m[2] + ' 条差评' : '未匹配：' + wr.slice(0, 80).replace(/\n/g, ' | ')}）`, !!m)
  if (m) {
    const card = (await reviews(page)).filter(r => (r.live ? Number(r.liveWeek) === week : Number(r.week) === week))
    const negCards = card.filter(r => Number(r.stars) <= 3).length
    ok(`【数字=卡片】本周差评卡 ${negCards} 张 === 周报差评数 ${m[2]}（不封顶 → 恒等）`, negCards === Number(m[2]))
    const surge = card.length - Number(m[1])
    ok(`【守恒】本周卡片 ${card.length} 张 = 评价数 ${m[1]} + 口碑爆发追加 ${surge}（0~2）`, surge >= 0 && surge <= 2)
    ok('实时卡片未被结算覆盖（仍在库里）', card.some(r => r.live))
  }

  // ── G. 口碑页即时评价（spawnRelated）也走结构化生成 ──
  // Math.random 被钉成 0.01 → "处理妥当后 50% 生成新评价"必定触发（确定性）
  console.log('\n▶ G 口碑页即时评价结构化')
  await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('hotel-sim-reviews') || '[]')
    list.push({ id: 'rev-e2e-pending', avatar: '🧑', bg: 'blue', name: '验收测试客 · 剧本', date: '第1周', stars: 1, text: '「空调坏了，一晚上没睡好。」', status: 'pending' })
    // 第3步展示验收用：带 cause/房型/天数的待处理卡（relatedDecision=shifts，D 段刚提交过"精简省成本"）
    list.push({ id: 'rev-e2e-card', avatar: '👩', bg: 'blue', name: '展示验收客 · 家庭出游', date: '第1周', stars: 2, text: '「前台排了二十分钟。」', status: 'pending', roomType: '标准双床', nights: 2, cause: 'front_slow', relatedDecision: 'shifts', guest: { gender: 'female', card: '展示验收客 · 家庭出游' } })
    localStorage.setItem('hotel-sim-reviews', JSON.stringify(list))
  })
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(1500)
  // 结算态（report 已存档）会重载后停在周报页 —— 先点「进入第 N 周」回到带导航的壳
  await page.evaluate(() => { const b = document.querySelector('.btn-confirm'); if (b && /进入第|最终成绩/.test(b.textContent)) b.click() })
  await sleep(1200)
  // 「关联经营」要能反查到"当时选了什么"：进入下一周会清空 doneDecisions，故此刻补回并二次重载
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('hotel-sim-state') || '{}')
    st.doneDecisions = { ...(st.doneDecisions || {}), shifts: '精简省成本' }
    localStorage.setItem('hotel-sim-state', JSON.stringify(st))
  })
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(1500)
  await clickTab(page, '口碑'); await sleep(900)
  let replyBtn = false
  for (let i = 0; i < 5 && !replyBtn; i++) {
    replyBtn = await page.evaluate(() => {
      const el = [...document.querySelectorAll('button')].find(x => x.textContent.includes('💬 回复'))
      if (!el) return false
      el.click(); return true
    })
    if (!replyBtn) await sleep(1500)
  }
  const repG = await text(page)
  ok(`口碑页出现可回复的待处理差评（注入卡片可见）`, replyBtn)
  if (!replyBtn) console.log('    [G 页面] ' + repG.slice(0, 200).replace(/\n/g, ' | '))
  await sleep(600)
  let hasTa = await page.evaluate(() => !!document.querySelector('textarea'))
  if (!hasTa) console.log('    [G 无 textarea] ' + (await text(page)).slice(0, 200).replace(/\n/g, ' | '))
  ok('回复弹窗已打开（textarea 就绪）', hasTa)
  if (hasTa) {
    await page.evaluate(() => {
      const ta = document.querySelector('textarea')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      setter.call(ta, '尊敬的客人您好，非常抱歉给您带来不便。我们已第一时间检修空调并更换配件，同时为您申请了房型升级与补偿，24 小时内会电话回访确认，期待您再次给我们机会。')
      ta.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await sleep(400)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('发送回复')); b && b.click() })
    await sleep(1000)
    await closeOverlay(page)
  }
  // 第3步展示：房型/天数行 + 🔍 关联经营（默认折叠 → 展开能反查到本组当周决策）
  const cardText = await text(page)
  ok('口碑页卡片显示房型与入住天数（🛏 标准双床 · 入住2天）', cardText.includes('标准双床') && cardText.includes('入住2天'))
  const traceOk = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('🔍 关联经营'))
    if (!b) return 'no-button'
    b.click()
    return 'clicked'
  })
  await sleep(600)
  const traced = await text(page)
  ok('🔍 关联经营默认折叠、点击可展开', traceOk === 'clicked')
  ok('展开后反查到本组决策与当时选择（前台排班 → 精简省成本）', traced.includes('前台排班') && traced.includes('精简省成本'))

  let spawn = null
  for (let i = 0; i < 6 && !spawn; i++) {
    await sleep(2000)
    spawn = (await reviews(page)).find(r => r.source === 'spawn')
  }
  ok('处理妥当 → 口碑页即时生成新评价（source=spawn）', !!spawn)
  if (spawn) {
    const g = spawn.guest || {}
    ok('即时评价身份自洽（性别↔头像↔称呼）', spawn.avatar === (g.gender === 'male' ? '🧑' : '👩') && /先生|女士/.test(String(spawn.name)))
    ok(`即时评价字段齐全（cause=${spawn.cause} / ${spawn.roomType} / ${spawn.nights}晚）`, !!spawn.cause && !!spawn.roomType && spawn.nights >= 1 && !!g.card)
    // 断言口径修正（2026-09-22）：不是"恒有来源"，而是"与 CAUSE_SOURCE 一致"——
    // misc / praise_location / praise_misc 三类 cause 按设计就是 null（位置来自选址，不是周决策），
    // 旧口径要求恒非空 → 命中这三类时必假，约 15~20% 概率假红（A5 系统健康总检定位）
    ok('即时评价的关联经营来源与 CAUSE_SOURCE 一致（可反查时必有，设计上无来源时为 null）',
      spawn.relatedDecision === (CAUSE_SOURCE[spawn.cause] || null))
    ok('即时评价文案为组合生成（带「」且够长）', /^「.+」$/.test(String(spawn.text)) && String(spawn.text).length > 12)
  }
} catch (e) {
  ok('脚本异常: ' + (e && e.message), false)
} finally {
  console.log(`\n========== 结果: ${results.filter(r => r.pass).length} 通过 / ${results.filter(r => !r.pass).length} 失败 ==========`)
  try { await browser.close() } catch (e) {}
  try { process.kill(-server.pid) } catch (e) {}
}
process.exit(results.some(r => !r.pass) ? 1 : 0)
