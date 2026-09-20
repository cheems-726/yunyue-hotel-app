// 3-C 验收：属性显示 + 实时反馈（当场变化/飘字/toast 真实变化文案）+ 旧档安全
// 运行：先 npm run build，再 node tests/verify-attrs-3c.mjs
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

const oldSave = readFileSync(new URL('./_fixture12w.json', import.meta.url), 'utf8') // 旧档：无 attrs
const freshSave = JSON.stringify({
  user: { role: 'student', id: 'demo-c', name: '验收同学', cloud: false, groupNo: null, className: null, groupRole: null },
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
  // ErrorBoundary 接住的渲染错误只走 console.error，必须一并监听（否则白屏会被漏判）
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('plugin is not implemented')) jsErrors.push('[console] ' + m.text().slice(0, 160)) })
  page.on('dialog', d => d.accept())
  const readState = () => page.evaluate(() => JSON.parse(localStorage.getItem('hotel-sim-state') || '{}'))
  const bodyText = () => page.evaluate(() => document.body.innerText)
  const load = async s => { await page.evaluate(x => { localStorage.clear(); localStorage.setItem('hotel-sim-state', x) }, s); await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(2600) }
  // 读属性面板：按标签定位行，再读该行进度条的 inline width%（= 属性值，不受飘字文本干扰）
  const readPanel = () => page.evaluate(() => {
    const out = {}
    for (const el of document.querySelectorAll('span')) {
      const t = el.textContent
      for (const lb of ['品质', '声誉', '士气']) {
        if (!t.includes(lb) || t.length > 26) continue
        const outer = el.closest('div')?.parentElement
        if (!outer) continue
        const divs = [...outer.querySelectorAll('div')]
        for (let k = divs.length - 1; k >= 0; k--) {
          const m = String(divs[k].style.width || '').match(/^(\d+)%$/)
          if (m) { out[lb] = Number(m[1]); break }
        }
      }
    }
    return out
  })
  const floatText = () => page.evaluate(() => [...document.querySelectorAll('.float-num')].map(x => x.textContent.trim()).join('|'))
  const toastText = () => page.evaluate(() => { const els = [...document.querySelectorAll('div')].filter(d => /已保存/.test(d.textContent) && d.textContent.length < 90); return els.length ? els[els.length - 1].textContent.trim() : '' })

  // ── 场景1：旧档（无 attrs）→ 面板显示初值、不报错 ──
  console.log('\n▶ 场景1 · 旧档（无 attrs）面板显示')
  await page.goto(BASE); await page.waitForLoadState('domcontentloaded'); await sleep(800)
  await load(oldSave)
  let t = await bodyText()
  ok('经营页正常渲染（非错误页）', t.includes('酒店状态') && !t.includes('页面出了点问题'))
  ok('页面无 NaN / undefined', !/NaN|undefined/.test(t), t.slice(0, 80).replace(/\n/g, '|'))
  ok('无 JS 报错', jsErrors.length === 0, jsErrors.join(' | '))
  const p1 = await readPanel()
  ok('面板显示三属性初值 品质60/声誉70/士气65', p1['品质'] === 60 && p1['声誉'] === 70 && p1['士气'] === 65, JSON.stringify(p1))
  ok('旧的派生条目已移除（无"满意度"）', !t.includes('满意度'))

  // ── 场景2：新账号做客房质检 → 当场 +5 + 飘字 + toast 文案 ──
  console.log('\n▶ 场景2 · 客房质检：当场变化 + 飘字 + feedback 文案')
  await load(freshSave)
  const pBefore = await readPanel()
  ok('起点 品质=60', pBefore['品质'] === 60, JSON.stringify(pBefore))
  const st0 = await readState()
  await page.evaluate(() => { const c = [...document.querySelectorAll('.task-card')].find(x => x.textContent.includes('客房质检')); c && c.click() }); await sleep(900)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && (x.textContent.includes('确认决策') || x.textContent.includes('修改决策') || x.textContent.includes('提交'))); b && b.click() })
  await sleep(400)
  const fl = await floatText()
  const tt = await toastText()
  const pAfter = await readPanel()          // 未刷新直接读面板（当场）
  const st1 = await readState()
  console.log(`   面板: ${JSON.stringify(pBefore)} → ${JSON.stringify(pAfter)}`)
  console.log(`   飘字: "${fl}"  | toast: "${tt}"`)
  ok('【当场】品质条 60 → 65（未刷新）', pAfter['品质'] === 65, JSON.stringify(pAfter))
  ok('【当场】飘字出现且含"品质 +5"', /品质\s*\+5/.test(fl), fl)
  ok('【当场】toast 含真实变化「品质 +5（60→65）」', /品质 \+5（60→65）/.test(tt), tt)
  ok('state.attrs 同步为 65', st1.attrs.quality === 65, JSON.stringify(st1.attrs))
  await sleep(1600)
  ok('飘字 1.5s 后自动消失', (await floatText()) === '')

  // ── 场景3：刷新不回退 ──
  console.log('\n▶ 场景3 · 刷新后不回退')
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(2600)
  const p3 = await readPanel()
  ok('刷新后品质仍 65', p3['品质'] === 65, JSON.stringify(p3))
  ok('刷新后无 NaN / 非错误页', !/NaN|undefined/.test(await bodyText()))

  // ── 场景4：无属性变化的决策 —— 不出现空反馈 ──
  console.log('\n▶ 场景4 · 无属性变化的决策（收益管理）')
  await page.evaluate(() => { const c = [...document.querySelectorAll('.task-card')].find(x => x.textContent.includes('收益管理')); c && c.click() }); await sleep(900)
  await page.evaluate(() => { const o = [...document.querySelectorAll('div')].find(x => x.textContent.trim() === '连住优惠'); o && o.click() }); await sleep(500)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '明白了'); b && b.click() }); await sleep(400)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && (x.textContent.includes('确认决策') || x.textContent.includes('修改决策') || x.textContent.includes('提交'))); b && b.click() })
  await sleep(700)
  const tt4 = await toastText()
  const p4 = await readPanel()
  console.log(`   toast: "${tt4}"`)
  ok('该决策无属性变化 → 属性不变', p4['品质'] === 65 && p4['声誉'] === 70, JSON.stringify(p4))
  ok('toast 不为空且不含空反馈尾巴（无"· "结尾）', tt4.includes('收益管理 已保存') && !/·\s*$/.test(tt4), tt4)

  // ── 场景5：改答案 → toast 显示净变化 ──
  console.log('\n▶ 场景5 · 改答案（模板回复 → 道歉+赔偿）')
  await page.evaluate(() => { const c = [...document.querySelectorAll('.task-card')].find(x => x.textContent.includes('口碑管理')); c && c.click() }); await sleep(900)
  await page.evaluate(() => { const o = [...document.querySelectorAll('div')].find(x => x.textContent.trim() === '模板回复'); o && o.click() }); await sleep(400)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '明白了'); b && b.click() }); await sleep(300)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && (x.textContent.includes('确认决策') || x.textContent.includes('修改决策') || x.textContent.includes('提交'))); b && b.click() }); await sleep(700)
  const tt5a = await toastText(); const p5a = await readPanel()
  ok('模板回复 → 声誉 70-5=65，toast 含「声誉 -5（70→65）」', p5a['声誉'] === 65 && /声誉 -5（70→65）/.test(tt5a), `${JSON.stringify(p5a)} | ${tt5a}`)
  await page.evaluate(() => { const c = [...document.querySelectorAll('.task-card')].find(x => x.textContent.includes('口碑管理')); c && c.click() }); await sleep(900)
  await page.evaluate(() => { const o = [...document.querySelectorAll('div')].find(x => x.textContent.trim() === '道歉+赔偿'); o && o.click() }); await sleep(400)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '明白了'); b && b.click() }); await sleep(300)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && (x.textContent.includes('确认决策') || x.textContent.includes('修改决策') || x.textContent.includes('提交'))); b && b.click() }); await sleep(700)
  const tt5b = await toastText(); const p5b = await readPanel()
  console.log(`   改答案后: ${JSON.stringify(p5b)} | toast: "${tt5b}"`)
  ok('改答案后声誉 = 初始70 + 当前答案+5 = 75（撤销旧答案-5 后应用新答案+5）', p5b['声誉'] === 75, JSON.stringify(p5b))
  ok('改答案 toast 显示净变化「声誉 +10（65→75）」', /声誉 \+10（65→75）/.test(tt5b), tt5b)
  ok('全程无 JS 报错', jsErrors.length === 0, jsErrors.join(' | '))

  const failed = results.filter(r => !r.pass)
  console.log(`\n========== 3-C 验收：${results.length - failed.length} 通过 / ${failed.length} 失败 ==========`)
  failed.forEach(f => console.log('  ✗ ' + f.n))
  process.exitCode = failed.length ? 1 : 0
} catch (e) { console.error('中断:', e.message); process.exitCode = 1 } finally {
  try { await browser?.close() } catch (e) {}
  try { if (server?.pid) require2('node:child_process').execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }) } catch (e) {}
}
