// V148-H · 躺平必亏：整周 0 决策收“无人管理成本”1.8 万/周（H 口径：放弃“锦江模拟勤奋≤5/半<勤”两条冲突判据）
import { settle } from '../src/settlement.js'
import { districts } from '../src/siteLocations.mjs'
import { brandGroups } from '../src/brands.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
console.log('▶ V148-H · 躺平必亏')
const H = (() => { for (const g of brandGroups) { const b = g.brands.find(x => x.name === '汉庭'); if (b) return { ...b, level: g.level } } })()
const d = districts['成都'].find(x => x.name === '锦江区')
const DILIGENT = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'member-convert': '强调品质', corporate: '让利签约', 'member-threshold': 5, energy: 23, overbook: 2, ota: {}, reputation: '道歉+赔偿', 'hr-optimize': '全员培训' }
const SEMI = { pricing: '不跟降', shifts: '满编保服务', hygiene: '不停房', linen: '自洗', energy: 23, overbook: 2, reputation: '解释原因', 'hr-optimize': '全员培训', 'member-convert': '强调品质' }
const run = (dec) => { let prev = null, net = 0, fee = 0; for (let w = 1; w <= 12; w++) { const r = settle({ site: { ...d.attrs, district: d.name }, brand: H, decisions: dec, week: w, prevGoodRate: prev }); prev = r.finalGoodRate; net += r.profit + (r.oneTimeFees ? r.oneTimeFees.开业费用 - r.oneTimeFees.保证金退还 : 0); fee += (r.weeklyExpenses && r.weeklyExpenses.未决策成本) || 0 } return { net: Math.round(net), fee } }
const diligent = run(DILIGENT), lazy = run({}), semi = run(SEMI), one = run({ pricing: '不跟降' })
console.log(`   勤奋 ${diligent.net} · 半勤奋 ${semi.net} · 懒惰 ${lazy.net}（未决策成本 ${lazy.fee}）`)
ok(lazy.net <= -150000, `懒惰 12 周经营净利 ${(lazy.net / 10000).toFixed(1)} 万 ≤ −15 万`)
ok(diligent.net - lazy.net >= 100000, `勤奋−懒惰 = ${((diligent.net - lazy.net) / 10000).toFixed(1)} 万 ≥10 万`)
ok(lazy.fee === 20000 * 12, `整周 0 决策收 2 万/周（12 周 ${lazy.fee}）`)
ok(diligent.fee === 0 && semi.fee === 0, '有决策（12/9 项 ≥6）不误收“无人管理成本”')
ok(one.fee === 16667 * 12, `只做 1 项 ⇒ 分级 16667/周（12 周 ${one.fee}），不再白拿`)
ok(diligent.net > 0, `勤奋仍为正（${(diligent.net / 10000).toFixed(1)} 万；H 口径不要求 ≤5）`)

// ★ V150 §1：0–5 项逐档计费（旧 0/1 两档 ⇒ n=2 起为 0 ⇒ 本节必红）
const FIX6 = { pricing: '不跟降', shifts: '满编保服务', hygiene: '不停房', linen: '自洗', energy: 23, overbook: 0 }
let 公式OK = true, 单调OK = true, 上档 = Infinity
for (let n = 0; n <= 6; n++) {
  const dec = Object.fromEntries(Object.entries(FIX6).slice(0, n))
  const r = settle({ site: { ...d.attrs, district: d.name }, brand: H, decisions: dec, week: 1 })
  const fee = r.weeklyExpenses.未决策成本 || 0
  const 应缴 = n >= 6 ? 0 : Math.round((6 - n) / 6 * 20000)
  if (fee !== 应缴) 公式OK = false
  if (fee > 上档) 单调OK = false
  上档 = fee
}
ok(公式OK, '§1 分级公式 0–5 项逐档：20000/16667/13333/10000/6667/3333/0')
ok(单调OK, '§1 罚金随决策数单调不增（项数越少罚越多）')
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
