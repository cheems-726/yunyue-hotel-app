// V46 · 提价杠杆 + 直接零单（断言 · 挂 run-all fast）
// 判据先行（V46 卡验收2）：提价必须看到【断崖】，不是"降一点"；断崖须随【区域消费水平】分化（需求 1.3）。
// 实测基线（tests/_v46-scan.mjs · 全季 base340 · 周1）：不跟降 63–70%；提价50% 低消费区 3%/营收1万、核心商圈 43%/12万。
// ★ 如实：出租率不会到字面 0%（零单钳上限 3% + 保底已绕过）—— "近零单"形态钉死，与 V33 结论一致。
import { settle } from '../src/settlement.js'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.log('  ✗ ' + n + (extra ? '  [' + extra + ']' : '')) } }

const mk = (pricing, 房价, brand) => {
  const site = { 客流: 4, 房价, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
  const b = brand ?? { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
  return settle({ site, brand: b, decisions: { pricing, shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } })
}

console.log('▶ V46 · 提价杠杆 + 直接零单')

// ① 杠杆生效：价格按档位上浮
const base = mk('不跟降', 4)      // 340
const up20 = mk('提价 20%', 4)    // 408
const up50 = mk('提价 50%', 4)    // 510
ok(up20.price === 408 && up50.price === 510 && base.price === 340, `① 价格 = base340 / +20%=408 / +50%=510（实得 ${base.price}/${up20.price}/${up50.price}）`)

// ② 挤出客流（高消费区 H4 · 不触发钳位）：提价越高出租率越低
ok(up50.occupancy < up20.occupancy && up20.occupancy < base.occupancy, `② H4 单调挤出：${base.occupancy}% > ${up20.occupancy}% > ${up50.occupancy}%`)

// ③ 直接零单 · 区县分化（同 提价50%）：低消费区 H1 断崖 ≤5%，核心商圈 H5 ≥40%
const cliffH1 = mk('提价 50%', 1)   // 510/180=2.83 触发
const safeH5 = mk('提价 50%', 5)    // 510/300=1.70 不触发
ok(cliffH1.occupancy <= 5, `③ 低消费区断崖：H1 出租率 ${cliffH1.occupancy}% ≤ 5%（零单钳位生效）`)
ok(safeH5.occupancy >= 40, `③ 核心商圈平安：H5 出租率 ${safeH5.occupancy}% ≥ 40%`)
ok(safeH5.occupancy - cliffH1.occupancy >= 30, `③ 区县分化 ≥30pp：${safeH5.occupancy}% − ${cliffH1.occupancy}% = ${safeH5.occupancy - cliffH1.occupancy}pp（需求 1.3 区域联动）`)

// ④ 营收断崖（同区县 H1 对照）：提价50% 营收 < 基线 20%（断崖，不是"降一点"）
const baseH1 = mk('不跟降', 1)
ok(cliffH1.revenue < baseH1.revenue * 0.2, `④ 营收断崖：H1 提价50% ${Math.round(cliffH1.revenue)} < 基线 ${Math.round(baseH1.revenue)} × 20%`)

// ⑤ 品牌低基数安全（同一低消费区 H1）：海友 base160 ⇒ 提价50%=240 < 2×180 ⇒ 不触发
const hiyou = mk('提价 50%', 1, { name: '海友', price: '120-200元', standard: '客房60间起', level: '经济' })
ok(hiyou.price === 240 && hiyou.occupancy >= 30, `⑤ 海友低基数安全：价 ${hiyou.price}（240<360）⇒ 出租率 ${hiyou.occupancy}% ≥ 30%`)

// ⑥ 只打提价侧（与降价对称 · 不双扣）：降价/跟降永不触发零单
const cutH1 = mk('降价 20% 抢客', 1)
ok(cutH1.occupancy >= 30, `⑥ 降价侧不触发零单：H1 降价20% 出租率 ${cutH1.occupancy}% ≥ 30%`)

// ⑦ 提价20% 触发边界：H1 触发（408/180=2.27）、H2 不触发（408/210=1.94）
const up20H1 = mk('提价 20%', 1)
const up20H2 = mk('提价 20%', 2)
ok(up20H1.occupancy <= 5 && up20H2.occupancy >= 40, `⑦ 提价20% 边界：H1 ${up20H1.occupancy}%（触发）· H2 ${up20H2.occupancy}%（不触发）`)

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
