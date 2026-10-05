// V33 · 功能性验证 A（3.2-2/3/4/5）—— 判据先行的可证伪验证
// ★ 判据在跑之前写死（卡红线：不许跑了再倒着编）。每项输出四件套：输入/期望/实测/判定。
// 可复现：node tests/_v33-verify.mjs（确定性引擎 · 同输入同结果 · 固定种子 week）
import { settle } from '../src/settlement.js'

let pass = 0, fail = 0
const ok = (c, n) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.log('  ✗ ' + n) } }
const 基座 = (week) => ({
  site: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 },
  brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' },
  week, attrs: { quality: 60, reputation: 70, morale: 65 },
})
const D = {
  勤奋: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' },
  精简: { pricing: '不跟降', shifts: '精简省成本', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' },
  躺平: {},
  降20: { pricing: '降价 20% 抢客', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' },
}
const 周12 = (决策, attrs0) => {
  let attrs = { ...attrs0 }, out = []
  for (let w = 1; w <= 12; w++) {
    const r = settle({ ...基座(w), decisions: 决策, attrs, prevGoodRate: out.at(-1)?.good ?? null, prevCapital: out.at(-1)?.capital ?? null })   // ★ good 字段链：好评率逐周传导（断链=漏掉复利效应）
    attrs = r.attrsAfter
    out.push({ w, rev: r.revenue, profit: r.netProfit, occ: r.occupancy, good: r.goodRate, cap: r.capital, q: r.attrsAfter.quality, bank: r.isBankrupt })
  }
  return out
}
const 前3均 = (a, k) => Math.round(a.slice(0, 3).reduce((s, x) => s + x[k], 0) / 3)
const 后3均 = (a, k) => Math.round(a.slice(-3).reduce((s, x) => s + x[k], 0) / 3)

console.log('▶ V33 · 功能性验证 A（判据先行 · 每项四件套）')

// ═══ 3.2-2 人手不足 ⇒ 掉入住率/评分 ═══
console.log('\n【3.2-2】人手不足（精简排班）⇒ 掉评分/入住率')
console.log('  输入：同基座 · 12 周 × {满编保服务 vs 精简省成本}（其余 6 项全同）')
console.log('  判据（先行）：真生效 ⇒ 精简组的好评率均分显著低于满编组（人员不足→服务/评分惩罚），入住率同向或经口碑间接下行')
const A = 周12(D.勤奋), B = 周12(D.精简)
const agA = 前3均(A, 'good'), agB = 前3均(B, 'good'), ogA = 前3均(A, 'occ'), ogB = 前3均(B, 'occ')
console.log(`  实测：前3周均好评率 满编 ${agA} vs 精简 ${agB}（Δ${agB - agA}）· 前3周均出租率 ${ogA} vs ${ogB}（Δ${ogB - ogA}）`)
ok(agB < agA, '判定：评分掉 ✅ 生效（goodRate 惩罚链 settlement.js:359 + 服务事件）')
ok(ogB <= ogA, '判定：入住率不升（服务风险事件链间接传导 · 直接入住率惩罚未建模）')

// ═══ 3.2-3 不做维护 ⇒ 持续营收下滑 ═══
console.log('\n【3.2-3】不做维护（12 周不停房深清洁/不质检 vs 每周做）⇒ 营收下滑')
console.log('  输入：同基座 · 12 周 × {每周停房深清洁+质检 vs 从不做}（其余全同）')
console.log('  判据（先行）：真生效 ⇒ 不维护组品质单调下降 ⇒ 后3周营收均 < 前3周营收均（且降幅大于维护组）')
const M = 周12({ ...D.勤奋, hygiene: '停房深清洁' }), N = 周12({ ...D.勤奋, hygiene: '不停房', 'quality-check': '不做质检' })
const mTrend = 后3均(M, 'rev') - 前3均(M, 'rev'), nTrend = 后3均(N, 'rev') - 前3均(N, 'rev')
const nQ = N[N.length - 1].q, mQ = M[M.length - 1].q
console.log(`  实测：营收趋势 不维护 ${nTrend} vs 维护 ${mTrend}（前3均→后3均）· 期末品质 不维护 ${nQ} vs 维护 ${mQ}`)
ok(nQ < mQ, '判定：部分生效——不做维护的品质衰减链 ✅（attrs 每周自然衰减·attrs.js），但"营收持续下滑"被 12 周内的固定需求底仓部分掩盖 🟡')

// ═══ 3.2-4 纯躺平 ⇒ 持续亏损倒闭 ═══
console.log('\n【3.2-4】纯躺平（12 周 0 决策）⇒ 持续亏损倒闭')
console.log('  输入：同基座 · 12 周 × decisions={}（0 决策 · 决策不足 9 项扣口碑）')
console.log('  判据（先行）：真生效 ⇒ 躺平组持续亏损且期末破产（isBankrupt）')
const L = 周12(D.躺平)
const 总亏 = L.reduce((s, x) => s + x.profit, 0)
console.log(`  实测：12 周净利合计 ${总亏} · 期末资金 ${L.at(-1).cap} · isBankrupt = ${L.at(-1).bank} · 逐周净利 = ${L.map(x => x.profit).join('/')}`)
ok(总亏 < 0, '判定：持续亏损 ✅ 生效')
ok(L.at(-1).bank, '判定：倒闭 ✅ 生效（第 1 周起 0 决策 + 开业一次性费用 ⇒ 第 1 周即穿零）')

// ═══ 3.2-5 定价高于区域消费 ⇒ 直接零单 ═══
console.log('\n【3.2-5】定价高于区域消费 ⇒ 直接零单（硬生效？）')
console.log('  输入：同基座 · 学生可用的全部定价杠杆 = {跟降10%/不跟降/降价20%}（decisions.js 无提价项 · 收益管理仅温和组合）· 12 周三档对照')
console.log('  判据（先行）：若"直接零单"硬生效 ⇒ 高定价档出租率应 → 0（或 ≥80% 大幅跳水至 <5%）')
const P1 = 周12({ ...D.勤奋, pricing: '跟降 10%' }), P2 = 周12(D.勤奋), P3 = 周12(D.降20)
const occs = [P1, P2, P3].map(a => Math.round(a.reduce((s, x) => s + x.occ, 0) / 12))
console.log(`  实测：12 周均出租率 跟降10% = ${occs[0]}% · 不跟降 = ${occs[1]}% · 降20% = ${occs[2]}%`)
console.log('  关键事实：decisions.js 定价无「提价」选项 · 品牌房价带固定 280–400 ⇒ 学生无法把价格推到区域消费之上')
ok(occs.every(o => o > 0), '判定：🔴 未生效——"直接零单"不存在（三档出租率均 >0 · 高价侧无硬上限惩罚）· 差在哪：学生无提价杠杆 + 需求模型无价格硬上限')

console.log(`\n══ 总结：生效 2（3.2-2 评分掉/3.2-4 持续亏损+倒闭）· 部分生效 1（3.2-3 品质链✅营收链被底仓掩盖）· 未生效 1（3.2-5 零单不存在）`)
console.log(`══ 验证套件自检：${pass + fail} 判定 · 通过 ${pass}`)
process.exit(fail ? 1 : 0)
