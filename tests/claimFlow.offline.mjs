// 离线演示 · 从选址到认领 6 步真走（观察 11/15 项取舍与渲染）
import { chromium } from 'playwright-core'
const E = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const b = await chromium.launch({ executablePath: E, headless: true, args: ['--disable-features=HttpsUpgrades,HTTPS-FirstMode,HttpsFirstBalancedModeAutoEnable'] })
const p = await b.newPage({ viewport: { width: 430, height: 1100 } })
const errs = []
p.on('pageerror', e => errs.push('pageerror:' + e.message))
p.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text()) })
const 点 = async (t) => { const r = await p.evaluate(tt => { const es = [...document.querySelectorAll('button,span,div,a,label')].reverse(); const x = es.find(y => y.textContent.trim() === tt) || es.find(y => y.textContent.includes(tt)); if (x) { x.click(); return true } return false }, t); await p.waitForTimeout(300); return r }
const T = () => p.evaluate(() => document.body.innerText)
const 问题 = []
const 扫 = (n, t) => { const bad = ['待补', '无法核算', '装不下', '未采', '不计费', 'NaN', 'undefined', '演示设定'].filter(w => t.includes(w)); if (bad.length) 问题.push(n + ':' + bad.join('/')) }
const 步号 = async () => { const m = (await T()).match(/现在是第 (\d)\/6 步/); return m ? Number(m[1]) : null }

await p.goto('http://121.196.196.37/', { waitUntil: 'networkidle' })
await 点('我是学生'); await 点('离线演示'); await 点('进入演示'); await p.waitForTimeout(1000)
await 点('开始我的酒店之旅')
await 点('锦江区')
for (const el of await p.$$('[data-pred-opt]')) await el.click().catch(() => {})
await 点('提交预言并解锁数据卡')
await 点('写承诺书（4 项必填）')
for (const ta of await p.$$('textarea')) await ta.fill('我判断锦江区客流稳定，商务与游客兼顾，出租率可达七成五以上；另外两个备选区租金更高或客流更弱；最怕淡旺季波动；验尸：客流不足、成本失控、竞争加剧')
await 点('签署承诺书（不可编辑）')
await 点('确认选址')
await p.waitForTimeout(600)
await 点('全季'); await p.waitForTimeout(300)
await 点('确认选择'); await p.waitForTimeout(800)

await 点('自主直营'); await p.waitForTimeout(300)
for (const ta of await p.$$('textarea')) { const v = await ta.inputValue().catch(() => '__'); if (!v) await ta.fill('我们选自主直营：利润全归自己、定价自由，愿意承担前期获客成本与营销风险，不做平台流量依赖') }

const 步名 = ['意向申请', '项目初审', '实地勘址', '项目决策', '商务洽谈', '合同签署']
let 上一步 = 0
for (let guard = 0; guard < 12; guard++) {
  // 首次进入的 GuideTip 引导层会挡住页面（其「明白了」也是 .btn-confirm）
  if (await p.locator('text=明白了').count()) { await p.locator('text=明白了').last().click({ force: true }).catch(() => {}); await p.waitForTimeout(300) }
  const n = await 步号(); const i = (n || 1) - 1
  if (n !== 上一步) {
    console.log('\n========== 第 ' + n + ' 步 · ' + 步名[i] + ' ==========')
    上一步 = n
  }
  const t = await T()
  扫(步名[i], t)
  const 选项 = await p.$$eval('[data-claim-opt]', els => els.map(e => e.getAttribute('data-claim-opt')))
  console.log('选项(' + 选项.length + '): ' + 选项.join(' | '))
  // 第 1 步必须选物业（disabled 条件含 step===0 && !selectedProperty）；第 3 步可重选
  if (i === 0 || i === 2) {
    const cards = await p.$$('.district-card')
    const 物业 = []
    for (const c of cards) { const tx = (await c.innerText()); if (/㎡/.test(tx)) 物业.push([tx.split('\n')[0], c]) }
    console.log('候选物业(' + 物业.length + '): ' + 物业.map(x => x[0]).join(' / '))
    if (物业[0]) { await 物业[0][1].click().catch(() => {}); await p.waitForTimeout(500) }
    // 选物业会弹出 ResultFeedback（整屏反馈卡）⇒ 必须点「明白了」关掉，否则挡住底部按钮
    const 明白 = p.locator('button', { hasText: '明白了' })
    if (await 明白.count()) { await 明白.last().click({ force: true }).catch(() => {}); await p.waitForTimeout(400) }
  }
  if (选项.length) {
    const label = 选项[0]
    await p.evaluate(l => { const e = [...document.querySelectorAll('[data-claim-opt]')].find(x => x.getAttribute('data-claim-opt') === l); e && e.click() }, label)
    await p.waitForTimeout(300)
  }
  const reason = await p.$('[data-claim-reason]')
  if (reason) { await reason.fill('我们选这个方案：现金压力可控，同时保留品质与口碑空间，愿意承担相应代价'); await p.waitForTimeout(200) }
  // 页面里存在多个 .btn-confirm（外层壳 + 内容），只点**可见**的那个
  const btns = p.locator('.btn-confirm:visible')
  const cnt = await btns.count()
  console.log('可见确认按钮数: ' + cnt)
  const target = btns.last()
  const btn = await target.evaluate(e => ({ disabled: e.disabled, text: e.textContent.trim() })).catch(() => null)
  console.log('底部: ' + JSON.stringify(btn))
  if (!btn || btn.disabled) { console.log('!! 按钮不可点，页面尾部：\n' + (await T()).slice(-800)); break }
  if (/完成认领/.test(btn.text)) { await target.click({ force: true }); await p.waitForTimeout(1200); break }
  await target.click({ force: true }).catch(e => console.log('  真点击失败:', e.message.slice(0, 80)))
  await p.waitForTimeout(900)
}
console.log('\n=== 末页 ===\n' + (await T()).slice(0, 700))
console.log('\n问题:', 问题.length ? 问题 : '无')
console.log('JS 错误:', errs.filter(x => !/favicon|Download the React DevTools/.test(x)).slice(0, 5))

// ── 取名 → 筹建（离线路径）──
const nameInput = p.locator('input').first()
if (await nameInput.count()) {
  await nameInput.fill('云悦天府三街店')
  await p.waitForTimeout(300)
  const btn = p.locator('.btn-confirm:visible').last()
  const bt = await btn.evaluate(e => ({ t: e.textContent.trim(), d: e.disabled })).catch(() => null)
  console.log('\n取名页按钮:', JSON.stringify(bt))
  if (bt && !bt.d) { await btn.click({ force: true }); await p.waitForTimeout(2500) }
  console.log('\n=== 取名后 ===\n' + (await T()).slice(0, 900))
  console.log('禁词:', ['待补', '无法核算', '装不下', 'NaN', 'undefined'].filter(w => ('' + '') || false).length)
}
// ── 筹建 4 步（离线）──
for (let k = 0; k < 8; k++) {
  const t = await T()
  const 第 = t.match(/第 (\d) 步 \/ 共 4 步/)?.[1]
  console.log('\n--- 筹建第 ' + (第 || '?') + ' 步 ---')
  console.log(t.slice(-700))
  if (/开业|进入经营|开始经营/.test(t) && /完成筹建/.test(t)) break
  // 情景卡（投资测算步）优先；其余步骤点第一张可选卡
  const 情景 = p.locator('text=基准情景').first()
  if (await 情景.count()) { await 情景.click({ force: true }).catch(() => {}); await p.waitForTimeout(400) }
  else {
    const cards = await p.$$('.district-card')
    if (cards.length) { await cards[0].click().catch(() => {}); await p.waitForTimeout(400) }
  }
  const 明白 = p.locator('button', { hasText: '明白了' })
  if (await 明白.count()) { await 明白.last().click({ force: true }).catch(() => {}); await p.waitForTimeout(300) }
  // 填 WhyNot 文本域
  for (const ta of await p.$$('textarea')) { const v = await ta.inputValue().catch(() => '__'); if (!v) await ta.fill('我们选择这个方案：投入与现金流折中，先保证按时开业，再按周复盘调整') }
  const btn = p.locator('.btn-confirm:visible').last()
  const bt = await btn.evaluate(e => ({ t: e.textContent.trim(), d: e.disabled })).catch(() => null)
  console.log('按钮: ' + JSON.stringify(bt))
  if (!bt || bt.d) break
  await btn.click({ force: true }).catch(() => {})
  await p.waitForTimeout(900)
  if (/开业成功|经营页|第 1 周/.test(await T())) break
}
console.log('\n=== 筹建后 ===\n' + (await T()).slice(0, 600))
console.log('最终 JS 错误:', errs.filter(x => !/favicon|Download the React DevTools/.test(x)).slice(0, 5))
await b.close()
