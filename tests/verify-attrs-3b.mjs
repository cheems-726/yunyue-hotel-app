// 3-B 验收：属性池接线（旧档兼容 / 决策 +5 / 持久化 / est-supplier 只应用一次）
// 运行：先 npm run build，再 node tests/verify-attrs-3b.mjs
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
const require2 = createRequire(import.meta.url)
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:4173/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const results = []
const ok = (n, c, extra = '') => { results.push({ n, pass: !!c }); console.log(`  ${c ? '✓' : '✗'} ${n}${c ? '' : '  [' + extra + ']'}`) }

const oldSave = readFileSync(new URL('./_fixture12w.json', import.meta.url), 'utf8')      // 旧档：无 attrs
const dirtySave = JSON.stringify({ ...JSON.parse(oldSave), attrs: { quality: null, reputation: 'x' } })
const oobSave = JSON.stringify({ ...JSON.parse(oldSave), attrs: { quality: 999, reputation: -50, morale: 55 } })
// 全新开业态（无 attrs / 无决策），用于"新账号做客房质检"这条验收
const freshSave = JSON.stringify({
  user: { role: 'student', id: 'demo-new', name: '新同学', cloud: false, groupNo: null, className: null, groupRole: null },
  location: { city: '成都', district: '锦江区', attrs: { 客流: 5, 房价: 5, 租金: 5, 竞争: 5, 人力: 4, 波动: 2 } },
  brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' },
  property: { name: '社区旁物业', type: '社区型', area: '2600㎡', rooms: '72间', rent: '中等', match: '高' },
  established: true, estChoices: { invest: '基准情景', supplier: '供应商 B：指定供应商', opening: ['装修', '系统上线', '招聘'] },
  doneDecisions: {}, report: null, week: 1, history: [], finished: false, welcomed: true,
})

let browser, server
try {
  if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(1) }
  server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore', shell: true, detached: true })
  for (let i = 0; i < 40; i++) { try { const x = await fetch(BASE); if (x.ok) break } catch (e) {} await sleep(300) }
  browser = await chromium.launch({ executablePath: EDGE, headless: true })
  const ctx = await browser.newContext({ viewport: { width: 480, height: 900 }, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const jsErrors = []
  page.on('pageerror', e => { if (!(e.message || '').includes('plugin is not implemented')) jsErrors.push(e.message) })
  page.on('dialog', d => d.accept())

  const readState = () => page.evaluate(() => JSON.parse(localStorage.getItem('hotel-sim-state') || '{}'))
  const bodyText = () => page.evaluate(() => document.body.innerText)
  const errBoundary = t => t.includes('页面出了点问题')
  const hasBad = t => /NaN|undefined|\$\{/.test(t)
  const load = async s => { await page.evaluate(x => { localStorage.clear(); localStorage.setItem('hotel-sim-state', x) }, s); await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(2500) }

  // 冒烟同款交互助手
  const clickCard = async (t, mode = 'includes') => page.evaluate(({ t, mode }) => {
    const m = [...document.querySelectorAll('.district-card, div')].filter(x => mode === 'starts' ? x.textContent.startsWith(t) : x.textContent.includes(t))
    if (!m.length) return false
    const inner = m.reverse().find(x => !m.some(y => y !== x && x.contains(y)))
    inner.click(); return true
  }, { t, mode })
  const hasOverlay = () => page.evaluate(() => [...document.querySelectorAll('div')].some(d => d.style.position === 'fixed' && d.textContent.includes('你的选择会带来')))
  const closeOverlay = async () => { await page.evaluate(() => { const b = [...document.querySelectorAll('*')].find(x => x.textContent.trim() === '明白了'); b && b.click() }); await sleep(300) }
  const clickText = async t => page.evaluate(x => { const b = [...document.querySelectorAll('button, span, div')].reverse().find(e => e.textContent.trim() === x || e.textContent.includes(x)); b && b.click() }, t)

  // ── 场景1：老存档（无 attrs） ──
  console.log('\n▶ 场景1 · 老存档（无 attrs 字段）打开经营页')
  await page.goto(BASE); await page.waitForLoadState('domcontentloaded'); await sleep(800)
  await load(oldSave)
  let t = await bodyText()
  ok('经营页正常渲染（非错误页）', t.includes('酒店状态') && !errBoundary(t), t.slice(0, 90).replace(/\n/g, '|'))
  ok('页面无 NaN / undefined', !hasBad(t), t.slice(0, 90).replace(/\n/g, '|'))
  ok('无 JS 报错', jsErrors.length === 0, jsErrors.join(' | '))
  let st = await readState()
  ok('attrs 补全为初值 {60,70,65}', JSON.stringify(st.attrs) === JSON.stringify({ quality: 60, reputation: 70, morale: 65 }), JSON.stringify(st.attrs))
  ok('旧档既有数据未受影响（week=12 / 11 周历史）', st.week === 12 && st.history.length === 11)

  // ── 场景2：脏数据 ──
  console.log('\n▶ 场景2 · 脏数据存档（quality:null / reputation:"x"）')
  await load(dirtySave)
  t = await bodyText()
  ok('正常渲染且无 NaN', t.includes('酒店状态') && !hasBad(t) && !errBoundary(t))
  st = await readState()
  ok('脏数据回退初值（null 不被当成 0）', JSON.stringify(st.attrs) === JSON.stringify({ quality: 60, reputation: 70, morale: 65 }), JSON.stringify(st.attrs))

  // ── 场景3：越界 clamp ──
  console.log('\n▶ 场景3 · 越界存档（quality:999 / reputation:-50）')
  await load(oobSave)
  st = await readState()
  ok('越界值 clamp 到 [20,100]', st.attrs.quality === 100 && st.attrs.reputation === 20 && st.attrs.morale === 55, JSON.stringify(st.attrs))

  // ── 场景4：新账号（开业态）做"客房质检" → quality +5 ──
  console.log('\n▶ 场景4 · 新账号做客房质检（验收点1）')
  await load(freshSave)
  st = await readState()
  const before = st.attrs
  ok('起点：开业态 attrs=初值', JSON.stringify(before) === JSON.stringify({ quality: 60, reputation: 70, morale: 65 }), JSON.stringify(before))
  // 打开"客房质检"决策卡
  await page.evaluate(() => { const c = [...document.querySelectorAll('.task-card')].find(x => x.textContent.includes('客房质检')); c && c.click() })
  await sleep(900)
  const panelTxt = await bodyText()
  ok('客房质检面板打开', panelTxt.includes('整改优先级') || panelTxt.includes('客房质检'), panelTxt.slice(0, 70).replace(/\n/g, '|'))
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && (x.textContent.includes('确认决策') || x.textContent.includes('提交'))); b && b.click() })
  await sleep(1100)
  await closeOverlay()
  st = await readState()
  const afterQC = st.attrs
  console.log(`   attrs: ${JSON.stringify(before)} → ${JSON.stringify(afterQC)}`)
  ok('客房质检 quality +5（60 → 65）', afterQC.quality === 65, `got ${afterQC.quality}`)
  ok('声誉/士气不受质检影响', afterQC.reputation === 70 && afterQC.morale === 65)
  ok('doneDecisions.quality-check 已记录', st.doneDecisions && st.doneDecisions['quality-check'] !== undefined)
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(2500)
  st = await readState()
  ok('刷新后属性不回退（仍 65）', st.attrs.quality === 65, JSON.stringify(st.attrs))
  ok('刷新后无 NaN / 非错误页', !hasBad(await bodyText()) && !errBoundary(await bodyText()))

  // ── 场景5：改答案不重复累加（同一决策改成另一个选项） ──
  console.log('\n▶ 场景5 · 改答案（撤销旧增量）')
  await page.evaluate(() => { const c = [...document.querySelectorAll('.task-card')].find(x => x.textContent.includes('口碑管理')); c && c.click() }); await sleep(900)
  await page.evaluate(() => { const o = [...document.querySelectorAll('div')].find(x => x.textContent.trim() === '模板回复'); o && o.click() }); await sleep(500)
  await closeOverlay()
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && (x.textContent.includes('确认决策') || x.textContent.includes('提交'))); b && b.click() }); await sleep(1100)
  await closeOverlay()
  st = await readState()
  ok('口碑·模板回复 → 声誉 70-5=65', st.attrs.reputation === 65, JSON.stringify(st.attrs))
  ok('品质不受影响（仍 65）', st.attrs.quality === 65, JSON.stringify(st.attrs))

  // ── 场景6：全新开店走完筹建 → est-supplier 只应用一次 ──
  console.log('\n▶ 场景6 · 全新开店（筹建物资采购 → est-supplier）')
  await page.evaluate(() => localStorage.clear())
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(1400)
  await clickText('我是学生'); await sleep(400)
  await clickText('离线演示'); await sleep(400)
  await clickText('进入演示'); await sleep(800)
  await clickText('开始我的酒店之旅'); await sleep(900)
  await clickCard('锦江区'); await sleep(400); await clickText('确认选址'); await sleep(700)
  await clickCard('汉庭'); await sleep(400); await clickText('确认选择'); await sleep(700)  // 经济型物业列表含'社区旁物业'（中档列表没有）
  await clickCard('OTA平台合作'); await sleep(400); await clickText('确认'); await sleep(650)
  await clickCard('社区旁物业'); await sleep(400)
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
  ok('认领完成进入筹建', (await bodyText()).includes('门店筹建'))
  // 投资 → 基准情景
  await clickCard('基准情景', 'starts'); await sleep(500)
  if (await hasOverlay()) await closeOverlay()
  // 证照（点步骤导航 📄）
  await page.evaluate(() => { const s = [...document.querySelectorAll('div')].find(d => d.textContent === '📄' && d.style.cursor === 'pointer'); s && s.click() }); await sleep(400)
  for (const n of ['申领营业执照', '刻章备案', '消防检查合格证', '特种行业经营许可证', '卫生许可证', '税务申报']) {
    await clickCard(n, 'starts'); await sleep(500)
    if (!(await hasOverlay())) { await closeOverlay(); await clickCard(n, 'starts'); await sleep(500) }
    await closeOverlay()
  }
  // 采购（点步骤导航 🛒）→ 选"官方"渠道（应 +4）
  await page.evaluate(() => { const s = [...document.querySelectorAll('div')].find(d => d.textContent === '🛒' && d.style.cursor === 'pointer'); s && s.click() }); await sleep(400)
  await clickCard('供应商 A'); await sleep(600)
  if (await hasOverlay()) await closeOverlay()
  await clickCard('供应商 A'); await sleep(400)
  ok('筹建·已选定供应商 A', (await bodyText()).includes('✅ 供应商 A'))
  // 开业（🎉）
  await page.evaluate(() => { const s = [...document.querySelectorAll('div')].find(d => d.textContent === '🎉' && d.style.cursor === 'pointer'); s && s.click() }); await sleep(400)
  for (const n of ['装修', '系统上线', '招聘']) {
    await clickCard(n, 'starts'); await sleep(500)
    if (await hasOverlay()) await closeOverlay()
    await clickCard(n, 'starts'); await sleep(400)
  }
  await clickText('完成筹建'); await sleep(1300)
  await closeOverlay()
  await sleep(800)
  st = await readState()
  console.log(`   开业后 attrs = ${JSON.stringify(st.attrs)}（供应商A 应 +4）`)
  ok('est-supplier 已应用（quality 60+4=64）', st.attrs && st.attrs.quality === 64, JSON.stringify(st.attrs))
  ok('开业页进入经营页（资金状况可见）', (await bodyText()).includes('资金状况'))
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(2500)
  st = await readState()
  ok('刷新后未重复应用（仍 64，不是 68）', st.attrs.quality === 64, JSON.stringify(st.attrs))
  ok('全程无 JS 报错', jsErrors.length === 0, jsErrors.join(' | '))

  const failed = results.filter(r => !r.pass)
  console.log(`\n========== 3-B 验收：${results.length - failed.length} 通过 / ${failed.length} 失败 ==========`)
  failed.forEach(f => console.log('  ✗ ' + f.n))
  process.exitCode = failed.length ? 1 : 0
} catch (e) { console.error('中断:', e.message); process.exitCode = 1 } finally {
  try { await browser?.close() } catch (e) {}
  try { if (server?.pid) require2('node:child_process').execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }) } catch (e) {}
}
