// 批次 B2-2 · 日报（T3.3/T3.4）验收套件
// 运行：node tests/dailyReport.test.mjs   （已挂 run-all）
// 判据（§二十一·五 批次 B2-2）：
//   ① Σ7天 === 周报（revenue / cost / cashDelta / occupied / reviews）
//   ② 零变化（不影响结算）：日报模块是纯函数、不被引擎引用
//   ③ 旧档/未接线（无 dailySnapshots）→ 返回空数组，不抛异常
//   ④ D30：日快照随周报持久化（history 条目里真的带着它）
import { buildDailyReport, sumDaily, reconcileWithWeek, DAY_LABELS } from '../src/dailyReport.mjs'
import { settle } from '../src/settlement.js'
import { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } from '../src/attrs.js'
import { readFileSync, readdirSync } from 'node:fs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const SRC = new URL('../src/', import.meta.url)
const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const STRATEGIES = {
  勤奋型: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' },
  省钱型: { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 20 },
  超售型: { pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', overbook: 3, linen: '外包' },
}

console.log('▶ 批次 B2-2 · 日报（T3.3/T3.4）')

// 跑 12 周，逐周核对
function runWeeks(dec, weeks = 12) {
  let attrs = { ...ATTR_INIT }, pg = null, cap = null, pn = 0, rs = 0
  const out = []
  for (let w = 1; w <= weeks; w++) {
    let a = attrs
    for (const [id, ans] of Object.entries(dec)) a = applyDecisionToAttrs(a, id, ans)
    const r = settle({ site: SITE, brand: BRAND, decisions: dec, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
    out.push(r)
    pg = r.finalGoodRate; cap = r.capital
    const negCards = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
    rs = Math.ceil(negCards * 0.5); pn = Math.max(0, pn + negCards - rs)
    attrs = normalizeAttrs(r.attrsAfter)
  }
  return out
}

console.log('\n[1] ① Σ7天 === 周报（3 策略 × 12 周 × 5 项 = 180 个恒等式）')
{
  let bad = 0, cases = 0
  for (const [name, dec] of Object.entries(STRATEGIES)) {
    const rs = runWeeks(dec)
    for (const r of rs) {
      const rows = buildDailyReport(r)
      const s = sumDaily(rows)
      cases++
      const pairs = [['revenue', r.revenue], ['cost', r.totalCost], ['cashDelta', r.profit], ['occupied', r.occupiedRooms], ['reviews', r.reviewCount]]
      for (const [k, v] of pairs) {
        if (s[k] !== v) { bad++; if (bad <= 3) console.error(`     ✗ ${name} w${r.week} Σ${k}=${s[k]} ≠ ${v}`) }
      }
      const rec = reconcileWithWeek(r)
      if (!rec.ok) { bad++; if (bad <= 3) console.error(`     ✗ ${name} w${r.week} reconcile 不通过：${rec.diff.join(',')}`) }
    }
  }
  ok(bad === 0, `${cases} 周 × 5 项恒等式全部成立（不符 ${bad} 处）`)
}

console.log('\n[2] 结构：7 行 / dayIndex 1..7 / 标签齐备')
{
  const r = runWeeks(STRATEGIES.勤奋型, 1)[0]
  const rows = buildDailyReport(r)
  ok(rows.length === 7, `日报 7 行（实测 ${rows.length}）`)
  ok(rows.map(x => x.dayIndex).join(',') === '1,2,3,4,5,6,7', 'dayIndex 1..7 连续')
  ok(rows.every((x, i) => x.label === DAY_LABELS[i]), '标签与 DAY_LABELS 一致')
  ok(rows.every(x => [x.revenue, x.cost, x.cashDelta, x.occupied, x.reviews].every(Number.isFinite)),
    '每行的 5 个数值字段均为有限数')
}

console.log('\n[3] ③ 旧档兼容：无 dailySnapshots / 空数组 / null → 空结果不抛异常')
{
  ok(buildDailyReport(null).length === 0, 'null → []')
  ok(buildDailyReport({}).length === 0, '{} → []')
  ok(buildDailyReport({ dailySnapshots: [] }).length === 0, '空数组 → []')
  const rec = reconcileWithWeek({})
  ok(rec.ok === false && rec.rows === 0, 'reconcile 对无快照档返回 ok=false（UI 据此不显示徽标）')
  const r = runWeeks(STRATEGIES.勤奋型, 1)[0]
  const legacy = { ...r }; delete legacy.dailySnapshots
  ok(buildDailyReport(legacy).length === 0, '旧档（删掉 dailySnapshots）→ []（降级而非报错）')
}

console.log('\n[4] ② 零变化：日报模块是纯函数、不被引擎引用')
{
  const files = readdirSync(SRC).filter(f => /\.(js|jsx|mjs)$/.test(f) && !f.startsWith('settle-old'))
  const codeOf = (f) => readFileSync(new URL(f, SRC), 'utf8')
  const importers = files.filter(f => f !== 'dailyReport.mjs' && /from\s*['"].*dailyReport/.test(codeOf(f)))
  ok(!importers.includes('settlement.js'), 'settlement.js 不 import dailyReport（引擎不受影响）')
  ok(importers.includes('WeeklyReport.jsx'), `dailyReport 的消费者是展示层（${importers.join(',')}）`)
  const dr = codeOf('dailyReport.mjs')
  ok(!/from\s*['"].*settlement/.test(dr), 'dailyReport 不 import settlement（纯派生，无反向依赖）')
  ok(!/localStorage|document\.|window\./.test(dr), 'dailyReport 不碰 DOM / 存储（纯函数）')
}

console.log('\n[5] ④ D30：日快照随周报持久化（history 条目里真的带着它）')
{
  const r = runWeeks(STRATEGIES.勤奋型, 1)[0]
  // App 的写档是 JSON.stringify(整个 result 对象) ⇒ dailySnapshots 必须仍在序列化结果里
  const round = JSON.parse(JSON.stringify({ report: r }))
  ok(Array.isArray(round.report.dailySnapshots) && round.report.dailySnapshots.length === 7,
    'JSON 往返后 dailySnapshots 仍在（刷新不丢日报，D30 选 a）')
  ok(buildDailyReport(round.report).length === 7, '从往返后的存档也能生成 7 行日报')
  // 体积：日报带来的增量（与 D30 实测一致）
  const withDays = Buffer.byteLength(JSON.stringify(r), 'utf8')
  const noDays = Buffer.byteLength(JSON.stringify((() => { const x = { ...r }; delete x.dailySnapshots; return x })()), 'utf8')
  console.log(`     单周存档：无日快照 ${noDays} 字节 → 含日快照 ${withDays} 字节（+${withDays - noDays} 字节/周）`)
  ok(withDays - noDays < 2000, `单周日快照增量 ${withDays - noDays} 字节（<2KB，与 D30 实测 ~894 字节/周同量级）`)
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
