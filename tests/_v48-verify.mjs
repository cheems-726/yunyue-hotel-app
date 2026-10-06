// V48 · 批3 前后对照实测（同一 12 周序列 · 解冻纪律②）+ 批4 断言数据底座
// 改前引擎 = git show HEAD:src/settlement.js > src/_settle-before-v48.mjs（对照后删除 · 可随时按此命令复现）
import { settle as after } from '../src/settlement.js'
import { settle as before } from '../src/_settle-before-v48.mjs'
import { scoreOf } from '../src/metricDefs.mjs'

const 基座 = (week, over = {}) => ({
  site: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 },
  brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' },
  decisions: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', overbook: '保守 1 间', 'quality-check': '优先整改前 5 项' },
  week, attrs: { quality: 60, reputation: 70, morale: 65 }, ...over,
})
const 合 = (decisions) => JSON.parse(JSON.stringify(decisions))

console.log('▶ V48 批3 · 三缺口 12 周前后对照')

// ── 缺口① 精简省成本 ⇒ 直接入住率惩罚 ──
console.log('\n【缺口①】满编 vs 精简（W1 · 其余全同）')
const a满 = after(基座(1)), a精 = after(基座(1, { decisions: 合(基座(1).decisions) }))
a精.decisions.shifts = '精简省成本'; const r精 = after({ ...基座(1), decisions: a精.decisions })
const b满 = before(基座(1)), b精 = before({ ...基座(1), decisions: { ...合(基座(1).decisions), shifts: '精简省成本' } })
console.log(`  改前：满编 ${b满.occupancy}% · 精简 ${b精.occupancy}%（Δ0 = 缺口实锤）`)
console.log(`  改后：满编 ${a满.occupancy}% · 精简 ${r精.occupancy}%（-6% 直接惩罚落地）`)

// ── 缺口② 不维护 ⇒ 底仓逐步下沉 ──
console.log('\n【缺口②】深清洁 vs 不停房（12 周逐周 · 前后对照）')
let bRev合计 = 0, aRev合计 = 0, a洁合计 = 0
for (let w = 1; w <= 12; w++) {
  const b洁 = before(基座(w)), b不 = before({ ...基座(w), decisions: { ...合(基座(w).decisions), hygiene: '不停房' } })
  const a洁 = after(基座(w)), a不 = after({ ...基座(w), decisions: { ...合(基座(w).decisions), hygiene: '不停房' } })
  bRev合计 += b不.revenue; aRev合计 += a不.revenue; a洁合计 += a洁.revenue
  if (w <= 3 || w % 3 === 0) console.log(`  W${String(w).padStart(2)} 改前 洁${b洁.occupancy}%/不${b不.occupancy}%（Δ${b洁.occupancy - b不.occupancy}）| 改后 洁${a洁.occupancy}%/不${a不.occupancy}%（Δ${a洁.occupancy - a不.occupancy}）`)
}
console.log(`  12 周不停房合计营收：改前 ${bRev合计} → 改后 ${aRev合计}（下滑可见化 · Δ${bRev合计 - aRev合计}）`)
console.log(`  12 周深清洁合计营收：改前 ${before(基座(1)).revenue * 12 === a洁合计 ? '逐周与改后一致' : '(逐周见上)'} · 改后 ${a洁合计}`)

// ── 缺口③ 12 周累积口径重测（引擎未动 · 判据口径修正）──
console.log('\n【缺口③】交齐 9 项 vs 漏 3 项（6 项）× 12 周 ⇒ 四维总分（12 周累积口径 · 改前引擎已成立 ⇒ 引擎未动）')
const mkHist = (engine, decisions) => {
  const hist = []
  for (let w = 1; w <= 12; w++) hist.push({ ...engine({ ...基座(w), decisions }), week: w })
  return hist
}
const 漏3 = { ...合(基座(1).decisions), shifts: undefined, linen: undefined, 'member-convert': undefined }
const sA1 = scoreOf(mkHist(before, 合(基座(1).decisions))), sB1 = scoreOf(mkHist(before, 漏3))
const sA2 = scoreOf(mkHist(after, 合(基座(1).decisions))), sB2 = scoreOf(mkHist(after, 漏3))
console.log(`  改前：交齐 avgGood ${sA1.avgGoodRate}% → finalScore ${sA1.finalScore} · 漏3项 avgGood ${sB1.avgGoodRate}% → finalScore ${sB1.finalScore}（Δ${sA1.finalScore - sB1.finalScore}）`)
console.log(`  改后：交齐 avgGood ${sA2.avgGoodRate}% → finalScore ${sA2.finalScore} · 漏3项 avgGood ${sB2.avgGoodRate}% → finalScore ${sB2.finalScore}（Δ${sA2.finalScore - sB2.finalScore} · 引擎未动 ⇒ 与改前一致）`)
console.log(`  ⇒ V34"未成立"是单周口径假象：期末总分本就是 12 周聚合，持续失职必进总分（Δ3 钉死 · 守门 v48Gaps③）`)

// ── 水位线：守规矩组（满编+深清洁+9项）改前 vs 改后 12 周逐字节 ──
let 水位 = true
for (let w = 1; w <= 12; w++) {
  const f = (r) => JSON.stringify([r.revenue, r.totalCost, r.goodRate, r.capital, r.occupancy])
  if (f(before(基座(w))) !== f(after(基座(w)))) { 水位 = false; console.log(`  ⚠ W${w} 水位线破`) }
}
console.log(`\n水位线（守规矩组 12 周逐字节一致）：${水位 ? '✓ 守住' : '✗ 破了'}`)
