// V151 · 第 7–18 项边际 ROI 转正（卡 `任务包-V151-第7至18项边际ROI转正.md` · 队列 #199）
// 运行：node tests/v151Roi.test.mjs   （挂 run-all fast）
//
// 只修 4 项（shifts / ota / member-convert / overbook）的收益或代价参数：
//   shifts 满编  +18 → −4 元/间夜（比精简的 −12 仍多 8 元 ⇒ "满编更贵"的次序不变，只是不再离谱）
//   ota 直营     佣金 11% → 5.99% · 营销加成 +0.08 → +0.12（佣金换流量的账算得过来了）
//   overbook     到店无房概率 8%/间 → 1%/间 · 比例 0.4 → 0.3（贴 no-show 率，赔偿期望不再吃掉收益）
//   member-convert 参数未动（边际随新均衡转正）
// 目标（卡 §2 · 审计端 D/E 裁定）：四项边际 ≥0 · 单调 18≥12≥6≥3≥0 · 0 项 ≤−15 万 · 18−6∈[0,8万]
// 不动：租金系数 / 固定成本 / 未决策惩罚 / 其余 14 项 / 任何阈值
import { settle } from '../src/settlement.js'
import { districts } from '../src/siteLocations.mjs'
import { brandGroups } from '../src/brands.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const H = (() => { for (const g of brandGroups) { const b = g.brands.find(x => x.name === '汉庭'); if (b) return { ...b, level: g.level } } })()
const d = districts['成都'].find(x => x.name === '锦江区')
const SITE = { ...d.attrs, district: d.name }
// 审计端 12 键勤奋组合 + 6 个零效键 = 18 键全量（与 V150 复算口径一致 · 审计端"18 项"即此 12 键）
const ACTIVE = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'member-convert': '强调品质', corporate: '让利签约', 'member-threshold': 5, energy: 23, overbook: 2, ota: {}, reputation: '道歉+赔偿', 'hr-optimize': '全员培训' }
const FULL = { ...ACTIVE, campaign: null, 'report-diagnosis': null, 'revenue-mgmt': null, 'quality-check': null, renovation: null, emergency: null }
const ORDER = [...Object.keys(ACTIVE)]
function net(dec) {
  let prev = null, s = 0
  for (let w = 1; w <= 12; w++) {
    const r = settle({ site: SITE, brand: H, decisions: dec, week: w, prevGoodRate: prev })
    prev = r.finalGoodRate
    s += r.profit + (r.oneTimeFees ? r.oneTimeFees.开业费用 - r.oneTimeFees.保证金退还 : 0)
  }
  return Math.round(s)
}
const pick = (n) => { const o = {}; for (const id of ORDER.slice(0, n)) o[id] = FULL[id]; return o }
const full = net(FULL)
const marginal = {}
for (const id of ORDER) { const w = { ...FULL }; delete w[id]; marginal[id] = full - net(w) }
const 四项 = { shifts: marginal.shifts, ota: marginal.ota, 'member-convert': marginal['member-convert'], overbook: marginal.overbook }
console.log(`   18 项全量：${full}（${(full / 10000).toFixed(2)} 万）`)
for (const [k, v] of Object.entries(四项)) console.log(`   边际 ${k.padEnd(15)} ${String(v).padStart(8)}`)
ok(Object.values(四项).every(v => v >= 0), '① 四项边际全部 ≥0（shifts/ota/member-convert/overbook）',
  Object.entries(四项).filter(([, v]) => v < 0).map(([k, v]) => `${k} ${v}`).join(', '))
ok(full >= 201000 && full <= 281000, `② 18 项 ∈ [20.1, 28.1] 万（实得 ${(full / 10000).toFixed(2)} 万）`)
const n0 = net({}), n3 = net(pick(3)), n6 = net(pick(6)), n12 = net(pick(12))
console.log(`   n 曲线：0 ${n0} · 3 ${n3} · 6 ${n6} · 12 ${n12} · 18 ${full}`)
ok(n0 <= n3 && n3 <= n6 && n6 <= n12 && n12 <= full, '③ 单调：18 ≥ 12 ≥ 6 ≥ 3 ≥ 0', `${n0}/${n3}/${n6}/${n12}/${full}`)
ok(n0 <= -150000, `④ 0 项 ≤ −15 万（${(n0 / 10000).toFixed(2)} 万）`)
const 差 = full - n6
ok(差 >= 0 && 差 <= 80000, `⑤ 18 − 6 ∈ [0, +8 万]（实得 ${差}）`)
ok(marginal.pricing === 0 && marginal['member-threshold'] === 0 && marginal.energy === 0 && marginal['hr-optimize'] === 0,
  '⑥ 其余 14 项的零效键不受本次影响（pricing/member-threshold/energy/hr-optimize 仍为 0 边际）')
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
