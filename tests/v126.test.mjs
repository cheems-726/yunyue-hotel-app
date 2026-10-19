// V126 · 第 1 周闭环暴露的 6 条缺陷（结算前置闸 / 结算后清决策 / tick 审计流水 / budget 面板）
// 运行：node tests/v126.test.mjs   （挂 run-all fast）
//
// 本套件钉住（§1、§2、§4、§5；§3 酒店名已在 V125 的 v125Ui 里钉住，这里复核关键三条）：
//   §1 周内决策 <6 ⇒ 不结算；周尾仍未达阈值 ⇒ 结算并打 week-end-fallback（周报显式标注）
//   §2 结算成功 ⇒ doneDecisions/decisionChanges 清空；history 记 决策数/决策来源
//   §3 云端有名字 ⇒ 登录回填（不弹补命名）· 命名写云+回读（V125 已修，这里只查仍在位）
//   §4 server_tick_log 不再被历史轮次占满（key 带分钟戳）· 撞键 warn + 计数
//   §5 budget：函数式更新 · 允许按自己顺序分配 · 超预算禁用确认 · 按钮文案不再是"请先做出选择"
import { readFileSync } from 'node:fs'
import { advanceGroupOneDay } from '../src/serverTick.mjs'
import { tickKey, tickLogKey, 结算前置最少决策, 决策计数 } from '../src/serverTick.mjs'
import { settle } from '../src/engine/index.js'
import { decisions } from '../src/decisions.js'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')
const edge = (f) => readFileSync(new URL('../supabase/functions/advance-day/' + f, import.meta.url), 'utf8')

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }

// 18 项合法决策（取值全部来自 decisions.js 的选项/区间 → 不会触发越界校验）
function 十八项() {
  const o = {}
  for (const d of decisions) {
    if (d.type === 'option' || d.type === 'timer') o[d.id] = d.options[0].label
    else if (d.type === 'slider') o[d.id] = d.min ?? 0
    else if (d.type === 'budget') {
      const avg = Math.floor(d.total / d.items.length)
      o[d.id] = Object.fromEntries(d.items.map((it, i) => [it, avg + (i === 0 ? d.total - avg * d.items.length : 0)]))
    } else if (d.type === 'sort') o[d.id] = [...d.items]
  }
  return o
}
const 取前N = (n) => Object.fromEntries(Object.entries(十八项()).slice(0, n))
const mkSave = (d = 十八项()) => ({
  __groupKey: 'g1', location: SITE, brand: BRAND, attrs: { quality: 60, reputation: 70, morale: 65 },
  capital: 5020000, history: [], doneDecisions: d, bizMode: 'direct',
})
const 剥标 = (h) => { const { 决策数, 决策来源, 结算闸, ...rest } = (h || {}); return rest }

console.log('▶ V126 · 第 1 周闭环 6 条缺陷')

// ── §1 结算前置闸 ────────────────────────────────────────────────
console.log('\n[§1] 结算前置闸：周内不足 6 项不结算；周尾兜底并打标')
{
  ok(结算前置最少决策 === 6, `阈值 = 6（实得 ${结算前置最少决策}）`)
  ok(决策计数({ __lastDecisionAt: 'x', pricing: '不跟降' }) === 1, '决策计数排除 __ 辅助键')
  // 0 决策：第 1–6 天不结算
  let s = mkSave({})
  const 各天 = []
  for (let d = 1; d <= 6; d++) { const r = advanceGroupOneDay(s, d); 各天.push(r.advanced); s = r.save }
  ok(各天.every(x => x === false), `0 决策：第 1–6 天都不结算（${各天.join(',')}）`)
  ok(s.history.length === 0, '0 决策：history 仍为 0（复位后不会 10 分钟就被假结算）')
  ok(s.doneDecisions && Object.keys(s.doneDecisions).length === 0, '被闸住时不改存档')
  // 第 7 天（周尾）⇒ 兜底结算，并打标
  const d7 = advanceGroupOneDay(s, 7)
  ok(d7.advanced === true && d7.save.history.length === 1, '周尾（第 7 天）仍会结算（不让整周永远没有结果）')
  ok(d7.save.history[0].决策数 === 0 && d7.save.history[0].决策来源 === 'week-end-fallback', '周尾兜底：决策数=0 · 来源=week-end-fallback')
  ok(!!d7.save.history[0].结算闸, '周报可读的 结算闸 标记在位（显式标注判 0 分侧）')
  // 5 项：仍闸住；6 项：放行
  let s5 = mkSave(取前N(5))
  for (let d = 1; d <= 6; d++) s5 = advanceGroupOneDay(s5, d).save
  ok(s5.history.length === 0, '5 项决策：第 1–6 天不结算')
  const r6 = advanceGroupOneDay(mkSave(取前N(6)), 1)
  ok(r6.advanced === true && r6.save.history.length === 1, '6 项决策：第 1 天即结算（达到阈值）')
}

// ── §2 结算后清决策 + 来源留痕 ──────────────────────────────────
console.log('\n[§2] 结算后清空本周决策；history 记 决策数/决策来源；第 2 周不沿用')
{
  const w1 = advanceGroupOneDay(mkSave(十八项()), 1)
  ok(w1.advanced && Object.keys(w1.save.doneDecisions || {}).length === 0, '结算后 doneDecisions = {}')
  ok(Object.keys(w1.save.history[0].decisions || {}).length === 18, 'history[0].decisions 仍保留本周 18 项（复盘要用）')
  ok(w1.save.history[0].决策数 === 18 && w1.save.history[0].决策来源 === 'student', 'history 记 决策数=18 · 来源=student')
  // 第 2 周：第 8 天不做决策 ⇒ 闸住；第 14 天（周尾）⇒ 报 0 项，而不是沿用 18
  const d8 = advanceGroupOneDay(w1.save, 8)
  ok(d8.advanced === false && d8.gated === true, '第 2 周第 1 天未做决策 ⇒ 闸住')
  const d14 = advanceGroupOneDay(d8.save, 14)
  ok(d14.advanced === true && d14.save.history.length === 2, '第 2 周周尾 ⇒ 结算')
  ok(d14.save.history[1].决策数 === 0, `第 2 周结算报 0 项（实得 ${d14.save.history[1].决策数}）—— 不沿用第 1 周的 18 项`)
  // ★ 连接中的客户端仍停在 week=1、把上周 18 项又传上来 ⇒ 服务端结算第 2 周时不得采用
  const 残留 = { ...w1.save, week: 1, doneDecisions: 十八项() }
  const d14stale = advanceGroupOneDay(残留, 14)
  ok(d14stale.save.history[1].决策数 === 0, '陈旧上传（state.week=1）的 18 项不得被当成第 2 周决策')
  ok(d14stale.save.history[1].决策来源 === 'week-end-fallback', '陈旧上传 ⇒ 来源标 week-end-fallback（不是 student）')
  // 变更记录/周基准也不得残留（否则 decisionsByDay 会把上周改动重放进本周）
  const withChanges = { ...mkSave(十八项()), decisionChanges: [{ key: 'pricing', from: '不跟降', to: '跟降 10%', 生效日: 2 }], weekBase: { week: 1, decisions: {} } }
  const wc = advanceGroupOneDay(withChanges, 1)
  ok(Array.isArray(wc.save.decisionChanges) && wc.save.decisionChanges.length === 0, '结算后 decisionChanges 清空')
  ok(wc.save.weekBase === null, '结算后 weekBase 清空')
}

// ── §1 零变化纪律：金额逐字节不变 ───────────────────────────────
console.log('\n[零变化] 前置闸只改"该不该结算"，不改金额算法')
{
  const r = advanceGroupOneDay(mkSave(十八项()), 1)
  const browser = settle({ site: SITE, brand: BRAND, decisions: 十八项(), week: 1, attrs: mkSave().attrs, prevGoodRate: null, prevCapital: 5020000, bizMode: 'direct' })
  ok(JSON.stringify(剥标(r.save.history[0])) === JSON.stringify(browser), '剥掉审计标记后，服务端结算 === 浏览器 settle（逐字节）')
}

// ── §4 tick 审计流水 ────────────────────────────────────────────
console.log('\n[§4] server_tick_log：key 带分钟戳 · 撞键 warn+计数')
{
  const a = tickLogKey(7, 'g1', new Date('2026-10-19T09:50:00Z'))
  const b = tickLogKey(7, 'g1', new Date('2026-10-19T09:51:00Z'))
  const c = tickLogKey(7, 'g1', new Date('2026-10-19T09:50:30Z'))
  ok(a !== b, '不同分钟 ⇒ 不同 key（历史轮次不再占满 d1–d84）')
  ok(a === c, '同一分钟内 ⇒ 同一 key（重复调用可识别）')
  ok(tickKey(7, 'g1') === 'd7|g1', '结算幂等键形状不变（兼容既有调用与断言）')
  const db = edge('db.ts')
  const idx = edge('index.ts')
  ok(/console\.warn/.test(db) && /duplicate:\s*true/.test(db), '撞键 ⇒ console.warn + duplicate 计数（不再静默）')
  ok(/tickLogKey/.test(idx), 'Edge 用 tickLogKey 写审计流水')
  ok(/if \(!dry && r\.advanced\)/.test(idx), '只在真结算时写流水（闸住的日子不写）')
  ok(/duplicates/.test(idx), '响应里回报 duplicates（可被巡检发现）')
}

// ── §5 budget 面板 ──────────────────────────────────────────────
console.log('\n[§5] budget：函数式更新 · 允许自选分配顺序 · 超预算禁用 · 文案正确')
{
  const dp = src('DecisionPanel.jsx')
  ok(/setBudget\(prev =>/.test(dp), '★ 函数式更新 setBudget(prev => …)：连续拖动不读旧闭包')
  ok(!/maxAllow/.test(dp), '不再把单项硬夹到"剩余额度"（45/30/25 这类分法设不进去的根因）')
  ok(/budgetTotal <= decision\.total/.test(dp), '超预算时确认键禁用（hasSelection 含上限判断）')
  ok(/还剩 \$\{decision\.total - budgetTotal\} 未分配/.test(dp), '界面显示"还剩 N 未分配"')
  ok(/decision\.type === 'budget' && hasSelection/.test(dp), '★ 有有效分配时按钮文案 =「确认决策，保存」（不再是"请先做出选择"）')
  ok(/分配超出预算，请调整/.test(dp), '超预算时按钮文案明确')
}

// ── §3 酒店名（V125 已修，复核仍在位）───────────────────────────
console.log('\n[§3] 酒店名：云端回填 + 写云回读（V125 · 不得回退）')
{
  const app = src('App.jsx')
  const sc = src('supabaseClient.js')
  ok(/setHotelName\(cloudSaved\.hotelName \|\| ''\)/.test(app), '登录回填 hotelName（云端有名字 ⇒ 不弹补命名）')
  ok(/report, hotelName, week, history/.test(app), '云端载荷含 hotelName')
  ok(/export async function saveHotelName/.test(sc) && /回读\?\.hotelName/.test(app), '命名写云 + GET 回读')
}

// ── §7 闭环：六组 × 18 项 → 7 天 → 结算 → 第 2 周不沿用 ──────────
console.log('\n[闭环] 6 组 × 18 项 → 7 天 ⇒ history=1 · n_done=0；第 2 周不做决策 ⇒ 报 0 项')
{
  const 组 = Array.from({ length: 6 }, (_, i) => mkSave(十八项()))
  const 结果 = 组.map(s => {
    let cur = s
    for (let d = 1; d <= 7; d++) cur = advanceGroupOneDay(cur, d).save
    return cur
  })
  ok(结果.every(s => s.history.length === 1), `6 组都恰好 1 条 history（${结果.map(s => s.history.length).join(',')}）`)
  ok(结果.every(s => Object.keys(s.doneDecisions || {}).length === 0), '6 组结算后 doneDecisions 都清空（n_done=0）')
  ok(结果.every(s => s.history[0].决策数 === 18), '6 组 history[0] 都记 决策数=18')
  // 第 2 周：什么都不做，推 7 天 ⇒ 周尾兜底结算，报 0 项
  const 第二周 = 结果.map(s => { let cur = s; for (let d = 8; d <= 14; d++) cur = advanceGroupOneDay(cur, d).save; return cur })
  ok(第二周.every(s => s.history.length === 2), '6 组第 2 周各新增 1 条（history=2）')
  ok(第二周.every(s => s.history[1].决策数 === 0), '第 2 周未做决策 ⇒ 6 组都报 0 项（不沿用 18）')
  ok(第二周.every(s => s.history[1].决策来源 === 'week-end-fallback'), '第 2 周来源标 week-end-fallback')
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
