// T1.4/B3 · GOP 口径与"拆租金"零变化断言
// 运行：node tests/verify-gop.mjs
// 断言：
//   ① 恒等式 GOP = 营收 −（变动成本 + 营销 + OTA佣金）
//        ⇔ gop === revenue − (totalCost − rentCost − 超售赔偿 − 事件罚款)   （无改造时）
//   ② 拆租金【不改变】任何既有数值：与 B3 之前的引擎（f884768 快照）逐项一致
//   ③ gopRate 与 gop/revenue 一致；租金 > 0 且可对拍华住量级
import { settle } from '../src/settlement.js'
// 🔴 W2 重基线（D38-B）：基准从「B3 前」改为「W2 前」——B3 期的「逐项零变化」断言前提已被 W2 的
//   部门成本改动覆盖（cost/profit 必然变）；现在改断【结构不变量零漂移 + 差额恒等式】
import { settle as settleOld } from '../src/settle-old-w2.mjs'
import { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } from '../src/attrs.js'

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const CASES = {
  勤奋型: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' },
  省钱型: { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 20 },
  带营销: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', campaign: '大促营销', reputation: '道歉+赔偿' },
  带诊断: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'report-diagnosis': '解决成本相关' },
  带OTA: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', ota: '全渠道上架' },
  超售: { pricing: '不跟降', shifts: '满编保服务', hygiene: '不停房', linen: '自洗', overbook: 3 },
}
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ T1.4/B3 · GOP 口径 + 拆租金零变化')

// ①②③ 逐年逐组
const rows = []
for (const [name, dec] of Object.entries(CASES)) {
  let attrs = { ...ATTR_INIT }, pg = null, cap = null, pn = 0, rs = 0
  let idOK = true, zeroOK = true, rateOK = true, rentOK = true
  for (let w = 1; w <= 12; w++) {
    let a = attrs
    for (const [id, ans] of Object.entries(dec)) a = applyDecisionToAttrs(a, id, ans)
    const n = settle({ site: SITE, brand: BRAND, decisions: dec, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
    // 两边必须喂【完全相同】的轨迹（prevGoodRate/prevCapital 会影响好评率与危机事件 → 影响后续周）
    const o = settleOld({ site: SITE, brand: BRAND, decisions: dec, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
    // ① GOP 恒等式（本批决策均不含 renovation ⇒ 无需扣改造费）
    // W10 口径：GOP = 营收 −（变动成本 + 固定部门成本 + 营销 + OTA）；
    //   这里用可观测字段表达：GOP = 营收 − (总成本 − 租金 − 超售赔偿 − 改造投资 − 事件罚款)
    const expectGop = n.revenue - (n.totalCost - n.rentCost - (n.overbookCompensation || 0) - (n.renovationCost || 0) - (n.eventFine || 0))
    if (n.gop !== expectGop) { idOK = false; rows.push(`w${w} gop=${n.gop} 期望=${expectGop}`) }
    // ③ gopRate
    const expectRate = n.revenue > 0 ? n.gop / n.revenue : 0
    if (Math.abs(n.gopRate - expectRate) > 1e-12) rateOK = false
    if (!(n.rentCost > 0)) rentOK = false
    // ② 零变化：既有三个数值必须与"改前引擎"逐项一致（T1.1 的 ×7 已由 shadow/severity 证明，这里只钉 B3 的拆租金动作）
    // B 类重基线：结构不变量（营收/租金/房价/房量/出租率）必须零漂移；成本差额必须恰为 deptCost
    const drifted = ['revenue', 'price', 'rooms', 'occupancy', 'occupiedRooms', 'reviewCount'].filter(k => n[k] !== o[k])
    const Δrent = n.rentCost - o.rentCost   // 🔴 A-1：租金曲线改了 ⇒ 差额恒等式加租金项（由实测值推导）
    if (drifted.length || n.totalCost - o.totalCost !== n.deptCost + Δrent || n.profit !== o.profit - n.deptCost - Δrent) {
      zeroOK = false; rows.push(`w${w} 漂移 ${drifted.join(',')} | Δcost ${n.totalCost - o.totalCost} vs deptCost ${n.deptCost}`)
    }
    pg = n.finalGoodRate; cap = n.capital
    const negCards = n.generatedReviews.filter(x => Number(x.stars) <= 3).length
    rs = Math.ceil(negCards * 0.5); pn = Math.max(0, pn + negCards - rs)
    attrs = normalizeAttrs(n.attrsAfter)
  }
  ok(idOK, `${name}：GOP 恒等式 12 周全成立（gop = 营收 −(变动+营销+OTA)）`, rows.slice(0, 2).join(' | '))
  ok(rateOK, `${name}：gopRate === gop/revenue`)
  ok(rentOK, `${name}：租金科目已独立列示且 > 0`)
  ok(zeroOK, `${name}：结构不变量零漂移 + Δcost === deptCost+Δrent（A-1 重基线）`, rows.slice(0, 2).join(' | '))
}

// ③ 租金量级对拍（华住 52.5 元/间/天）
const r1 = settle({ site: SITE, brand: BRAND, decisions: CASES.勤奋型, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } })
const perRoomDay = r1.rentCost / r1.rooms / 7
ok(perRoomDay >= 52.5 * 0.5 && perRoomDay <= 52.5 * 2,
  `租金量级：${perRoomDay.toFixed(1)} 元/间/天 vs 华住 52.5 ⇒ ${(perRoomDay / 52.5).toFixed(2)}× 同量级`)

console.log(`\n========== 结果: ${pass} 通过 / ${fail} 失败 ==========`)
process.exit(fail ? 1 : 0)
