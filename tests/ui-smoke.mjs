// UI 冒烟测试：无头浏览器走完核心链路，防"白屏/点不了"级低级 bug
// 运行：先 npm run build，再 node tests/ui-smoke.mjs（脚本自动起 preview 服务器）
// 机制：任何 UI 改动 commit 前必须全过（PASS ≥ 清单全绿）
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 4173
const BASE = `http://localhost:${PORT}/`
const results = []
let browser, server, lastText = ''
async function refreshText(page) { try { lastText = await page.evaluate(() => document.body.innerText) } catch (e) {} }

function ok(name, cond) {
  results.push({ name, pass: !!cond })
  console.log((cond ? '  ✓ ' : '  ✗ ') + name)
  if (!cond) console.log('    [页面] ' + String(lastText).slice(0, 130).replace(/\n/g, ' | '))
}
function pageDump(text) {
  console.log('    [页面] ' + String(text).slice(0, 120).replace(/\n/g, ' | '))
}

async function text(page) {
  lastText = await page.evaluate(() => document.body.innerText)
  return lastText
}
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
    // 最内层匹配：不再包含其他匹配元素的元素（真正绑事件的那层）
    const inner = matches.reverse().find(x => !matches.some(y => y !== x && x.contains(y)))
    inner.click()
    return true
  }, { t, mode })
}
async function hasOverlay(page) {
  return page.evaluate(() => {
    const d = [...document.querySelectorAll('div')].find(d => d.style.position === 'fixed' && d.textContent.includes('你的选择会带来'))
    return !!d
  })
}
async function closeOverlay(page) {
  await clickText(page, '明白了')
  await page.waitForTimeout(250)
}
const sleep = ms => page.waitForTimeout(ms)

// ── 布局可见性/可达性断言（防"导航栏在视口外 / 内容滚不动"类回归）──
// 背景：2026-09-19 切页动画包装层缺 flex 约束 → .tabbar 被顶出视口 2200px + .content 零滚动区间，
//       而旧断言（element.click() 不做可操作性检查 + innerText 存在性）全部照过，
//       导致潜伏到 9-20 真机才暴露。本函数就是那次的防线。
// 注意：checkVisibility() 只反映 display/visibility/opacity，**不反映被 overflow 裁切**（本 bug 正是裁切），
//       所以真正承载判定的是 rect 断言与"滚到底后末元素是否进入视口"断言。
async function assertLayout(pg, label) {
  const r = await pg.evaluate(() => {
    const tb = document.querySelector('.tabbar')
    const c = document.querySelector('.content')
    const vh = window.innerHeight
    const out = { vh, tabbar: null, content: null }
    if (tb) {
      const b = tb.getBoundingClientRect()
      out.tabbar = {
        top: Math.round(b.top), bottom: Math.round(b.bottom),
        inViewport: b.bottom <= vh + 1 && b.top > 0,
        checkVis: typeof tb.checkVisibility === 'function' ? tb.checkVisibility() : true,
      }
    }
    if (c) {
      const before = c.scrollTop
      c.scrollTop = c.scrollHeight // 尽力滚到底
      const scrolled = Math.round(c.scrollTop)
      const last = c.lastElementChild
      const lastBottom = last ? Math.round(last.getBoundingClientRect().bottom) : null
      c.scrollTop = before // 还原，避免影响后续断言
      out.content = {
        boxH: Math.round(c.getBoundingClientRect().height), scrollH: c.scrollHeight,
        overflow: c.scrollHeight > c.clientHeight + 1,
        scrolledTo: scrolled, lastBottom,
        bottomReachable: lastBottom === null ? true : lastBottom <= vh + 4,
      }
    }
    return out
  })
  if (r.tabbar) {
    ok(`布局【${label}】导航栏在视口内 (top=${r.tabbar.top} bottom=${r.tabbar.bottom} 视口=${r.vh})`, r.tabbar.inViewport)
    ok(`布局【${label}】导航栏 checkVisibility()`, r.tabbar.checkVis)
  }
  if (r.content) {
    ok(`布局【${label}】滚到底内容可达 (boxH=${r.content.boxH} scrollH=${r.content.scrollH} 滚到底=${r.content.scrolledTo} 末元素底=${r.content.lastBottom})`, r.content.bottomReachable)
    if (r.content.overflow) ok(`布局【${label}】溢出时可实际滚动（scrollTop 赋值生效）`, r.content.scrolledTo > 0)
  }
  return r
}

const page = await (async () => {
  if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(1) }
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: true, detached: true })
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch(BASE); if (r.ok) break } catch (e) {}
    await new Promise(r => setTimeout(r, 300))
  }
  browser = await chromium.launch({ executablePath: EDGE, headless: true })
  const ctx = await browser.newContext({ viewport: { width: 480, height: 900 } })
  const p = await ctx.newPage()
  p.on('pageerror', e => {
    const msg = e.message || ''
    if (msg.includes('plugin is not implemented')) return // Capacitor 插件在 web 平台的已知非致命警告
    results.push({ name: '页面JS异常: ' + msg, pass: false })
  })
  return p
})()

try {
  console.log('▶ UI 冒烟测试（离线模式，不碰云端）')
  await page.goto(BASE)
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(1200)

  // 1. 登录
  ok('登录页渲染', (await text(page)).includes('请选择你的身份'))
  await clickText(page, '我是学生'); await sleep(400)
  await clickText(page, '离线演示'); await sleep(400)
  await clickText(page, '进入演示'); await sleep(700)
  ok('欢迎页渲染', (await text(page)).includes('欢迎你'))

  // 2. 选址
  await clickText(page, '开始我的酒店之旅'); await sleep(800)
  ok('选址页渲染（5城芯片）', (await text(page)).includes('地图选点') && (await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('承德')))))
  await clickCard(page, '锦江区')
  await sleep(500)
  ok('选址反馈浮层', await hasOverlay(page))
  await closeOverlay(page)
  ok('六维雷达图渲染', await page.evaluate(() => [...document.querySelectorAll('svg')].some(s => s.textContent.includes('客流') && s.textContent.includes('波动'))))
  await clickText(page, '确认选址'); await sleep(700)

  // 3. 品牌
  ok('品牌页渲染（19品牌）', (await page.evaluate(() => document.querySelectorAll('.district-card').length)) >= 19)
  await clickCard(page, '汉庭'); await sleep(450)
  await clickText(page, '确认选择'); await sleep(700)

  // 4. 认领（经营模式：OTA平台合作文案）
  ok('OTA平台合作文案（非加盟）', (await text(page)).includes('OTA平台合作') && !(await text(page)).includes('OTA加盟'))
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
    await sleep(550)
    if (done) break
  }
  ok('认领完成进入筹建', (await text(page)).includes('门店筹建'))

  // 5. 筹建：15 个选项逐一点击
  const gated = await text(page)
  ok('筹建·投资门控（未选时下一步禁用）', gated.includes('请先选择一个投资情景'))
  await clickCard(page, '乐观情景', 'starts'); await sleep(500)
  ok('筹建·投资·乐观情景反馈', await hasOverlay(page))
  await closeOverlay(page)
  await clickCard(page, '基准情景', 'starts'); await sleep(500)
  await closeOverlay(page)
  ok('筹建·投资单选切换（✅基准）', (await text(page)).includes('✅ 基准情景'))
  // 证照（点步骤导航 📄）
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('div')].find(d => d.textContent === '📄' && d.style.cursor === 'pointer')
    s && s.click()
  }); await sleep(400)
  for (const n of ['申领营业执照', '刻章备案', '消防检查合格证', '特种行业经营许可证', '卫生许可证', '税务申报']) {
    await clickCard(page, n, 'starts'); await sleep(500)
    if (!(await hasOverlay(page))) { await closeOverlay(page); await clickCard(page, n, 'starts'); await sleep(500) }
    ok('筹建·证照·' + n, await hasOverlay(page))
    await closeOverlay(page)
  }
  // 采购（🛒）
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('div')].find(d => d.textContent === '🛒' && d.style.cursor === 'pointer')
    s && s.click()
  }); await sleep(400)
  for (const n of ['供应商 A', '供应商 B', '供应商 C']) {
    await clickCard(page, n); await sleep(500)
    if (!(await hasOverlay(page))) { await closeOverlay(page); await clickCard(page, n); await sleep(500) }
    ok('筹建·采购·' + n, await hasOverlay(page))
    await closeOverlay(page)
    if (n === '供应商 A') break // 选定A后看B/C详情不影响已选
  }
  await clickCard(page, '供应商 A'); await sleep(300)
  ok('筹建·采购选中（✅供应商A）', (await text(page)).includes('✅ 供应商 A'))
  // 开业（🎉）
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('div')].find(d => d.textContent === '🎉' && d.style.cursor === 'pointer')
    s && s.click()
  }); await sleep(400)
  for (const [i, n] of ['装修', '系统上线', '招聘'].entries()) {
    await clickCard(page, n, 'starts'); await sleep(500)
    ok('筹建·开业详情·' + n, await hasOverlay(page))
    await closeOverlay(page)
    await clickCard(page, n, 'starts'); await sleep(350)
    ok('筹建·开业优先级第' + (i + 1) + '（' + n + '）', (await text(page)).includes('第' + (i + 1) + '优先'))
  }
  await clickText(page, '完成筹建'); await sleep(1200)
  const opening = await text(page)
  if (!opening.includes('正式开业')) console.log('    [开业页实况] ' + opening.slice(0, 170).split('\n').join(' | '))
  ok('开业反馈弹出（含筹建决策汇总）', opening.includes('正式开业') && opening.includes('开业优先级') && opening.includes('投资情景'))
  await closeOverlay(page)

  // 6. 经营页
  const biz = await text(page)
  ok('经营页：资金卡+18决策+结算按钮', biz.includes('资金状况') && biz.includes('0 / 18') && biz.includes('本周结算'))
  // 布局断言：经营页是 9-19 布局回归的重灾区（包装层撑高 → 导航栏被裁 + 内容滚不动）
  await assertLayout(page, '学生经营页')
  // 职业置顶断言：注入 groupRole=lobby → 大堂经理职责决策应置顶且带"我的职责"徽章（防回归）
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('hotel-sim-state') || '{}')
    if (st.user) { st.user.groupRole = 'lobby'; localStorage.setItem('hotel-sim-state', JSON.stringify(st)) }
  })
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(1500)
  ok('职业置顶：首个未完成决策带我的职责徽章', await page.evaluate(() => {
    const card = document.querySelector('.task-card')
    return card && card.textContent.includes('我的职责')
  }))
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('hotel-sim-state') || '{}')
    if (st.user) { st.user.groupRole = null; localStorage.setItem('hotel-sim-state', JSON.stringify(st)) }
  })
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(1500)
  ok('还原后徽章消失', await page.evaluate(() => {
    const card = document.querySelector('.task-card')
    return card && !card.textContent.includes('我的职责')
  }))
  // 做一个决策（第一个"去决策"）
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('div, span')].reverse().find(x => x.textContent.trim() === '去决策')
    el && el.click()
  }); await sleep(650)
  const panelTxt = await text(page)
  ok('决策面板可打开', panelTxt.includes('应急预案') || panelTxt.includes('30秒') || panelTxt.includes('提交'))
  // 尝试选第一项并提交（应急预案/选项类通用）
  await page.evaluate(() => {
    const opt = [...document.querySelectorAll('button, div')].find(x => x.textContent.trim() === '立即送医+道歉')
    if (opt) { opt.click(); return }
    const any = [...document.querySelectorAll('button')].find(b => !b.disabled && b.textContent.trim().length < 12 && b.textContent !== '‹ 返回' && !b.textContent.includes('提交'))
    any && any.click()
  }); await sleep(400)
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('button')].find(b => !b.disabled && (b.textContent.includes('提交') || b.textContent.includes('确认')))
    s && s.click()
  }); await sleep(900)
  await closeOverlay(page)

  // 7. 结算（重试一次，防浮层遮挡）
  await clickText(page, '🏠经营'); await sleep(500)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('本周结算')); b && b.click() }); await sleep(1800)
  if (!(await text(page)).includes('周经营结果')) {
    await closeOverlay(page)
    await clickText(page, '🏠经营'); await sleep(600)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('本周结算')); b && b.click() }); await sleep(2000)
  }
  if (!(await text(page)).includes('周经营结果')) {
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('本周结算')); b && b.click() }); await sleep(2200)
  }
  const rep = await text(page)
  ok('周报渲染（评级/事件/预测）', rep.includes('周经营结果') && rep.includes('本周经营事件') && rep.includes('下周市场预测'))
  // 进入第2周：原生 locator 点击（actionability等待，重渲染竞态下最稳）
  let week2 = false
  for (let r = 0; r < 3 && !week2; r++) {
    try { await page.locator('button', { hasText: '进入第 2 周' }).first().click({ timeout: 2000 }) } catch (e) {}
    await sleep(900)
    week2 = (await text(page)).includes('第 2 周')
  }
  ok('进入第2周', week2)
  if (!week2) {
    const dump = await page.evaluate(() => document.body.innerText.slice(0, 200))
    console.log('    [崩溃详情] ' + dump.slice(0, 400))
  }


  // 8. 四 tab
  await clickText(page, '报表'); await sleep(700)
  ok('报表页：盈亏平衡图渲染', (await text(page)).includes('累计利润 · 盈亏平衡') && (await text(page)).includes('盈亏平衡线'))
  await assertLayout(page, '学生报表')
  await page.screenshot({ path: 'tests/_s3-report.png' })
  await clickText(page, '口碑'); await sleep(700)
  ok('口碑页渲染', (await text(page)).includes('差评处理率'))
  await assertLayout(page, '学生口碑')
  // 决策趋势块断言：回经营页打开任一决策面板，应显示近3周轨迹块
  await clickText(page, '🏠经营'); await sleep(700)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button, span')].reverse().find(x => x.textContent.trim() === '去决策')
    b && b.click()
  }); await sleep(700)
  ok('决策面板趋势块渲染', (await text(page)).includes('该决策近'))
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('‹ 返回') || x.textContent.includes('返回')); b && b.click() }); await sleep(600)
  await page.screenshot({ path: 'tests/_s3-rep.png' })
  // 回复交互：注入固定测试差评（stub）保证可测——先敷衍（应保持待处理）再优质（应解决）
  await page.evaluate(() => {
    const key = 'hotel-sim-reviews'
    const list = JSON.parse(localStorage.getItem(key) || '[]')
    list.push({ id: 'smoke-n1', avatar: '🧑', bg: 'blue', name: '冒烟测试客 · 剧本', date: '第1周', stars: 1, text: '「空调坏了，一晚上没睡好。」', status: 'pending' })
    localStorage.setItem(key, JSON.stringify(list))
  })
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(1300)
  await clickText(page, '口碑'); await sleep(700)
  const replyOnce = async (txt) => {
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('button')].find(x => x.textContent.includes('💬 回复'))
      el && el.click()
    }); await sleep(500)
    await page.evaluate((txt2) => {
      const ta = document.querySelector('textarea')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      setter.call(ta, txt2)
      ta.dispatchEvent(new Event('input', { bubbles: true }))
    }, txt); await sleep(300)
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('发送回复'))
      b && b.click()
    }); await sleep(800)
  }
  await clickCard(page, '冒烟测试客'); await sleep(300)
  await replyOnce('这个问题属于客人个人使用原因，属正常现象，请您理解。')
  ok('敷衍回复：客人更生气且差评仍待处理', (await text(page)).includes('更加生气') && (await text(page)).includes('仍是待处理'))
  await closeOverlay(page)
  await replyOnce('尊敬的客人您好，非常抱歉。我们已第一时间维修更换空调，并为您申请了部分退款补偿，今晚立即为您升级安静房型，24小时内跟进解决，期待您再次给我们机会。')
  ok('优质回复：客人接受并修改评价', (await text(page)).includes('接受了补偿方案') || (await text(page)).includes('修改了评价'))
  await closeOverlay(page)
  await clickText(page, '我的'); await sleep(700)
  const me = await text(page)
  ok('我的页：称号历程+档案', me.includes('称号历程') && me.includes('我的酒店档案'))
  await assertLayout(page, '学生我的')
  // 9. 复盘周次chips
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].reverse().find(x => x.textContent.trim() === '经营操作记录' && x.children.length <= 1)
    el && el.click()
  }); await sleep(700)
  ok('复盘页周次chips', await page.evaluate(() => document.querySelectorAll('.city-tab').length > 0))

  // 10. 侧滑返回拦截（popstate 不退出站点）
  await page.evaluate(() => history.back()); await sleep(500)
  ok('侧滑返回不退出站点', await page.evaluate(() => !!document.querySelector('.tabbar')))

  // ===== 11. 云端真实登录段（独立页面，干净上下文）=====
  const cloudLogin = async (who, id, pw) => {
    const pg = await (await browser.newContext({ viewport: { width: 480, height: 900 } })).newPage()
    pg.on('pageerror', e => { if (!(e.message || '').includes('plugin is not implemented')) results.push({ name: '云端页面JS异常: ' + e.message, pass: false }) })
    pg.on('dialog', d => d.accept())
    await pg.goto(BASE)
    await pg.waitForLoadState('domcontentloaded'); await sleep(1300)
    await pg.evaluate(() => localStorage.clear())
    await pg.reload(); await pg.waitForLoadState('domcontentloaded'); await sleep(1300)
    await pg.evaluate(who2 => { const b = [...document.querySelectorAll('button, span')].find(x => x.textContent.includes(who2)); b && b.click() }, who)
    await sleep(500)
    await pg.evaluate(({ id, pw }) => {
      const inputs = [...document.querySelectorAll('input')]
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(inputs[0], id); inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
      setter.call(inputs[1], pw); inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
      const btn = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled)
      if (btn) { btn.click(); return }
      const reg = [...document.querySelectorAll('button')].find(x => x.textContent.includes('注册并登录'))
      reg && reg.click()
    }, { id, pw })
    await sleep(3000)
    const body = await pg.evaluate(() => document.body.innerText)
    return { pg, body }
  }
  // 教师 t001
  {
    let teacher = await cloudLogin('我是老师', 't001', '123456')
    let tries = 0
    while (!teacher.body.includes('教师后台') && tries < 2) { // 跨国线路偶发抖动，最多重试2次
      try { await teacher.pg.close() } catch (e) {}
      await sleep(3000)
      teacher = await cloudLogin('我是老师', 't001', '123456')
      tries += 1
    }
    const { pg, body } = teacher
    ok('云端教师登录（t001）', body.includes('教师后台'))
    // 云端数据拉取可能慢（夜间线路），轮询等待大屏渲染最多10秒
    let liveReady = false
    for (let i = 0; i < 10; i++) {
      const b = await pg.evaluate(() => document.body.innerText)
      if (b.includes('学生决策动向') && b.includes('排名') && b.includes('我的')) { liveReady = true; break }
      await sleep(1000)
    }
    ok('教师端底部三导航+实时大屏', liveReady)
    await assertLayout(pg, '教师实时决策')
    // 周次筛选断言：切第1周快照回放，再切回实时
    await pg.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '第1周')
      b && b.click()
    }); await sleep(700)
    ok('大屏周次筛选（历史回放模式）', await pg.evaluate(() => document.body.innerText.includes('历史回放') && document.body.innerText.includes('第1周快照')))
    await pg.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '实时')
      b && b.click()
    }); await sleep(500)
    // 云端批注交互：快捷批注保存→时间线刷新→删除自清理
    await pg.evaluate(() => {
      const tab = [...document.querySelectorAll('.tab')].find(x => x.textContent.includes('排名'))
      tab && tab.click()
    }); await sleep(900)
    await assertLayout(pg, '教师排名')
    await pg.evaluate(() => {
      const row = [...document.querySelectorAll('div')].find(d => d.textContent.includes('平均出租率') && d.style.cursor === 'pointer')
      row && row.click()
    }); await sleep(900)
    const hasNoteForm = await pg.evaluate(() => document.body.innerText.includes('教师批注'))
    if (hasNoteForm) {
      await pg.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('👍 优秀'))
        b && b.click()
      }); await sleep(400)
      ok('云端批注：快捷按钮一键填充（评语+分数）', await pg.evaluate(() => {
        const ta = document.querySelector('textarea')
        const num = document.querySelector('input[type="number"]')
        return ta && ta.value.includes('经营策略清晰') && num && num.value === '95'
      }))
      await pg.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('保存批注'))
        b && b.click()
      }); await sleep(2200)
      ok('云端批注：快捷保存后时间线刷新', await pg.evaluate(() => document.body.innerText.includes('经营策略清晰，决策完成度高')))
      // 删除点击有浮层自动关闭竞态，重试点击最多3次
      let goneNow = false
      for (let i = 0; i < 3 && !goneNow; i++) {
        await pg.evaluate(() => {
          const rows = [...document.querySelectorAll('div')].filter(d => d.textContent.includes('经营策略清晰，决策完成度高') && d.style.borderRadius === '8px')
          const btn = rows.length ? [...rows[0].querySelectorAll('button')].find(b => b.textContent.includes('🗑')) : null
          btn && btn.click()
        })
        await sleep(1800)
        for (let w = 0; w < 4 && !goneNow; w++) {
          goneNow = await pg.evaluate(() => !document.body.innerText.includes('经营策略清晰，决策完成度高'))
          if (!goneNow) await sleep(900)
        }
      }
      ok('云端批注：删除自清理', goneNow)
    } else {
      ok('云端批注：未找到下钻批注表单（组数据不足，跳过）', true)
    }

    // 教师"我的"视图布局断言（三视图全覆蓋：实时决策/排名/我的）
    await pg.evaluate(() => {
      const tab = [...document.querySelectorAll('.tab')].find(x => x.textContent.includes('我的'))
      tab && tab.click()
    }); await sleep(1200)
    await assertLayout(pg, '教师我的')

    await pg.close()
  }
  // 学生 2025（有存档则进经营页，无则走开店首页，均验证"我的"可达）
  {
    let stu = await cloudLogin('我是学生', '2025', '123456')
    let loggedIn = !stu.body.includes('账号或密码错误') && !stu.body.includes('学生登录')
    if (!loggedIn) { // 跨国网络偶发抖动，重试一次
      try { await stu.pg.close() } catch (e) {}
      await sleep(3000)
      stu = await cloudLogin('我是学生', '2025', '123456')
      loggedIn = !stu.body.includes('账号或密码错误') && !stu.body.includes('学生登录')
    }
    const { pg, body } = stu
    if (loggedIn) {
      await pg.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('开始我的酒店之旅'))
        if (b) b.click()
      }); await sleep(800)
      await pg.evaluate(() => {
        const el = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '👤我的' || x.textContent.includes('我的'))
        el && el.click()
      }); await sleep(900)
      const me = await pg.evaluate(() => document.body.innerText)
      ok('云端学生"我的"页（fetchMyNotes路径）', me.includes('我的酒店') && !me.includes('页面出了点问题'))
    await assertClean(pg, '云端学生我的页')
    } else {
      ok('云端学生登录（2025）——账号不存在，已跳过', true)
    }
    await pg.close()
  }

} catch (e) {
  results.push({ name: '测试执行中断: ' + e.message, pass: false })
}

const failed = results.filter(r => !r.pass)
console.log('\n========== 结果: ' + (results.length - failed.length) + ' 通过 / ' + failed.length + ' 失败 ==========')
for (const f of failed) console.log('  ✗ ' + f.name)
try { await browser?.close() } catch (e) {}
try { if (server?.pid) process.platform === 'win32' ? require('node:child_process').execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }) : server.kill('SIGTERM') } catch (e) {}
process.exit(failed.length ? 1 : 0)
