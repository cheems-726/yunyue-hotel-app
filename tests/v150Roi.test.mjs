// V150 §2 · 决策 ROI 回归（复算审计端的“18 项不如 5 项”）
// 运行：node tests/v150Roi.test.mjs   （进 run-all 门禁）
//
// 结论（2026-10-23 复算）：
//   · 审计端表里的“18 项”实际是 12 键的勤奋组合，且包含 overbook:2 与 ota:{}（空预算仍按 11% 抽佣）
//   · 这两项是【有意设计的坏选项】（超售贪多必赔 / OTA 佣金不是白来的）
//   · 换成理性选项（overbook:0 · OTA 不做）后，0 < 3 < 6 < 12 < 18 单调，18 项最优
//   · 因此本测试锁“理性组合的单调性”，并明确保留“坏选项更差”的教学取舍
import { settle } from '../src/settlement.js'
import { districts } from '../src/siteLocations.mjs'
import { brandGroups } from '../src/brands.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const H = (() => { for (const g of brandGroups) { const b = g.brands.find(x => x.name === '汉庭'); if (b) return { ...b, level: g.level } } })()
const d = districts['成都'].find(x => x.name === '锦江区')
const SITE = { ...d.attrs, district: d.name }

// 理性全量：18 项都做，但选不伤身的选项（不超售 · 不投 OTA · 满编保服务保留）
const CLEAN = {
  pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗',
  'member-convert': '强调品质', corporate: '让利签约', 'member-threshold': 5, energy: 23,
  overbook: 0, ota: null, reputation: '道歉+赔偿', 'hr-optimize': '全员培训',
  'quality-check': ['101', '102', '103', '104', '105'],
  campaign: { 线上广告: 2000, 门店物料: 1000, 员工激励: 1000, 会员礼包: 1000 },
  'report-diagnosis': '解决成本相关', 'revenue-mgmt': '连住优惠', renovation: '不投', emergency: '立即送医+道歉',
}
// 审计端“18 项”的原样选项：超售 2 + OTA 空预算（空对象 truthy ⇒ 11% 抽佣）
const AUDIT = { ...CLEAN, overbook: 2, ota: {} }
const ids = Object.keys(CLEAN)

function net(dec) {
  let prev = null, s = 0
  for (let w = 1; w <= 12; w++) {
    const r = settle({ site: SITE, brand: H, decisions: dec, week: w, prevGoodRate: prev })
    prev = r.finalGoodRate
    s += r.profit + (r.oneTimeFees ? r.oneTimeFees.开业费用 - r.oneTimeFees.保证金退还 : 0)
  }
  return Math.round(s)
}
const prefix = (n) => { const o = {}; for (const id of ids.slice(0, n)) o[id] = CLEAN[id]; return o }
const n0 = net({}), n3 = net(prefix(3)), n6 = net(prefix(6)), n12 = net(prefix(12)), n18 = net(prefix(18))
console.log(`   理性组合：0项 ${n0} · 3项 ${n3} · 6项 ${n6} · 12项 ${n12} · 18项 ${n18}`)
ok(n0 <= -150000, `0 项 ≤ −15 万（${(n0 / 10000).toFixed(1)} 万）`)
ok(n0 <= n3 && n3 <= n6 && n6 <= n12 && n12 <= n18, '决策数 ↑ ⇒ 经营净利单调不降（0 ≤ 3 ≤ 6 ≤ 12 ≤ 18）',
  `${n0}/${n3}/${n6}/${n12}/${n18}`)
ok(n18 >= n12 && n18 >= n6 && n18 >= n3 && n18 > 0, `18 项 ≥ 12/6/3/0 项（按决策数单调，${(n18 / 10000).toFixed(1)} 万；≠ 全局最优）`)

const bad = net(AUDIT)
console.log(`   审计端原选项（超售2 + 空OTA）：18项 ${bad}`)
// ★ V151 重基线：超售/OTA 的边际已按卡（任务包-V151）转正 ⇒ “坏选项更差”的前提消失（这正是 V151 的目标）。
//   教学取舍改由【选项文案/风险提示】承担（decisionRisk/decisions 文案仍写明超售贪多必失、OTA 佣金成本）。
ok(bad >= n18, `V151 后超售/OTA 边际转正 ⇒ 原审计选项不低于理性组合（${bad} ≥ ${n18}）· 取舍改由文案承担`)

// 逐项 ROI（理性全量下，去掉该项的净利变化）——只打印，供批次报告引用
const roi = []
for (const id of ids) { const w = { ...CLEAN }; delete w[id]; roi.push({ id, roi: n18 - net(w) }) }
roi.sort((a, b) => b.roi - a.roi)
console.log('   ROI 表（理性全量 · 去该项 ⇒ 净利变化）：')
for (const r of roi) console.log(`     ${r.id.padEnd(16)} ${String(r.roi).padStart(8)}`)
const roiNegative = roi.filter(r => r.roi < 0)
if (roiNegative.length) console.log(`   ⚠ 逐项 ROI 仍有负值：${roiNegative.map(r => r.id + ' ' + r.roi).join(' / ')} ⇒ 全局最优未达成（见批次报告，待决策）`)

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
