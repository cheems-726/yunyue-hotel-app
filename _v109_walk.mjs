// V109 验收：走一遍学生选址流程，验三条判据 + 取证
import { chromium } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.BASE || 'http://121.196.196.37/'
const ID = process.env.STU_ID || '20260903'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const log = (...a) => console.log(...a)
const OUT = 'D:/教学app/4-审计与报告/V109-检查取证/'
let bad = 0
const ok = (n, c, d = '') => { log(`  ${c ? '✓' : '✗'} ${n}${d ? '  ' + d : ''}`); if (!c) bad++ }

const b = await chromium.launch({ executablePath: EDGE, headless: true })
const p = await (await b.newContext({ viewport: { width: 480, height: 1000 }, ignoreHTTPSErrors: true })).newPage()
const errs = []
p.on('pageerror', e => { if (!(e.message || '').includes('plugin is not implemented')) errs.push(e.message) })

await p.goto(BASE); await p.waitForLoadState('domcontentloaded')
await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForLoadState('domcontentloaded'); await sleep(1300)
await p.evaluate(() => { const x = [...document.querySelectorAll('button, span')].find(e => e.textContent.includes('我是学生')); x && x.click() }); await sleep(400)
await p.evaluate(({ id }) => {
  const ins = [...document.querySelectorAll('input')]
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(ins[0], id); ins[0].dispatchEvent(new Event('input', { bubbles: true }))
  s.call(ins[1], 'test123456'); ins[1].dispatchEvent(new Event('input', { bubbles: true }))
  const reg = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled); reg && reg.click()
}, { id: ID })
for (let k = 0; k < 24; k++) { await sleep(500); const t = await p.evaluate(() => document.body.innerText); if (/欢迎你|开始我的酒店之旅|地图选点/.test(t)) break }
let t = await p.evaluate(() => document.body.innerText)
for (let k = 0; k < 10; k++) { const tt = await p.evaluate(() => document.body.innerText); if (/地图选点|确认选址/.test(tt)) break; await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find(e => e.textContent.includes('开始我的酒店之旅')); x && x.click() }); await sleep(900) }
const tp=await p.evaluate(()=>document.body.innerText); const bt=await p.evaluate(()=>[...document.querySelectorAll('button')].map(x=>x.textContent.trim().slice(0,18))); console.log('  [按钮]', JSON.stringify(bt)); console.log('  [页面]', tp.replace(/s+/g,' ').slice(0,220)); ok('进入选址页', /地图选点|确认选址|请选择一个区县/.test(tp))

// ── 判据① T1：不填预言 ⇒ 数据卡解锁不了 ──
await p.evaluate(() => { const c = document.querySelectorAll('.district-card')[0]; c && c.click() })
await sleep(900)
let t1 = await p.evaluate(() => document.body.innerText)
const 有预言弹 = /选址前预言/.test(t1)
const 有数据卡 = /客群画像|六维|竞品/.test(t1) && /你的预言 vs 真值/.test(t1) === false && false
ok('① T1 RV：点区划**先弹预言**（数据卡未解锁）', 有预言弹, `弹窗=${有预言弹}`)
await p.screenshot({ path: OUT + 'T1-01-预言弹窗未填.png' })
const 提交前解锁 = await p.evaluate(() => !!document.querySelector('.district-card.selected'))
ok('① 提交前：区划**未被选中**（数据卡确实没解锁）', !提交前解锁)

// 未填三项时提交按钮 disabled（可证伪）
const 提交钮禁用 = await p.evaluate(() => { const b2 = [...document.querySelectorAll('button')].find(x => x.textContent.includes('提交预言并解锁')); return b2 ? b2.disabled : null })
ok('① 三项未填 ⇒ 「提交预言」按钮 disabled', 提交钮禁用 === true)

// 填三项并提交
await p.evaluate(() => {
  const click = (txt) => { const b2 = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === txt); b2 && b2.click() }
  click('前1/3'); click('高'); click('70%')
})
await sleep(400)
await p.evaluate(() => { const b2 = [...document.querySelectorAll('button')].find(x => x.textContent.includes('提交预言并解锁')); b2 && b2.click() })
await sleep(1200)
const t2 = await p.evaluate(() => document.body.innerText)
ok('① 提交预言后 ⇒ 数据卡解锁（出现「你的预言 vs 真值」与预言分）', /你的预言 vs 真值/.test(t2) && /预言分/.test(t2))
await p.screenshot({ path: OUT + 'T1-02-预言提交后解锁.png' })

// ── 判据② T2：不写承诺书 ⇒ 确认选址按钮点不动 ──
const 确认禁用 = await p.evaluate(() => { const b2 = [...document.querySelectorAll('button')].find(x => /确认选址|写完承诺书/.test(x.textContent)); return b2 ? { disabled: b2.disabled, text: b2.textContent.trim() } : null })
ok('② T2 RV：未写承诺书 ⇒「确认选址」**disabled**', 确认禁用 && 确认禁用.disabled === true, JSON.stringify(确认禁用))

// 写承诺书
await p.evaluate(() => { const b2 = [...document.querySelectorAll('button')].find(x => x.textContent.includes('写承诺书')); b2 && b2.click() })
await sleep(800)
const t3 = await p.evaluate(() => document.body.innerText)
ok('② 承诺书弹窗 4 项必填 + 事前验尸', /选址承诺书/.test(t3) && /事前验尸/.test(t3))
const 签钮禁用 = await p.evaluate(() => { const b2 = [...document.querySelectorAll('button')].find(x => x.textContent.includes('签署承诺书')); return b2 ? b2.disabled : null })
ok('② 未填必填项 ⇒ 「签署承诺书」disabled', 签钮禁用 === true)
await p.screenshot({ path: OUT + 'T2-01-承诺书弹窗.png' })
await p.evaluate(() => {
  const tas = [...document.querySelectorAll('textarea')]
  const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
  const vals = ['押锦江区客流与租金双优，目标出租率 75%', '不选金牛区（租金高 1 档）也不选双流区（客流低 1 档）', '竞争维度最容易被竞品密度打脸', '无', '1 租金超预算 2 客流不及预期 3 竞品价格战']
  tas.forEach((el, i) => { set.call(el, vals[i] || ''); el.dispatchEvent(new Event('input', { bubbles: true })) })
})
await sleep(500)
await p.evaluate(() => { const b2 = [...document.querySelectorAll('button')].find(x => x.textContent.includes('签署承诺书')); b2 && b2.click() })
await sleep(1000)
const t4 = await p.evaluate(() => document.body.innerText)
ok('② 签署后：承诺书回显 + **过程分表**（4 项 × 0-2）', /过程分/.test(t4) && /引用了几维真实数据/.test(t4) && /与结果分是两条独立曲线/.test(t4))
const 确认2 = await p.evaluate(() => { const b2 = [...document.querySelectorAll('button')].find(x => /确认选址|写完承诺书/.test(x.textContent)); return b2 ? { disabled: b2.disabled, text: b2.textContent.trim() } : null })
ok('② 签署后 ⇒「确认选址」**变为可用**', 确认2 && 确认2.disabled === false, JSON.stringify(确认2))
await p.screenshot({ path: OUT + 'T2-02-承诺书回显与过程分.png', fullPage: true })
ok('③ 过程分与结果分**独立展示**（无求和/加权文案）', /不求和不加权/.test(t4))
ok('④ 学生端**无推理排行榜**（守 §3-① 红线）', !/推理排行|理由排行|预言排行榜/.test(t4))

log('JS 错误:', errs.length, errs.slice(0, 2))
await b.close()
log(bad === 0 ? '\nPASS' : `\nFAIL —— ${bad} 项`)
process.exit(bad === 0 ? 0 : 1)
