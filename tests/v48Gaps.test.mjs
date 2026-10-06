// V48 · 三缺口守门（可证伪 · 挂 run-all fast）
// 判据 = 删掉对应实现行必红：①删 -6% 行 ⇒ ①红 ②删下沉 ⇒ ②红 ③删 -0.02 ⇒ ③红
// 实测基线（tests/_v48-verify.mjs · 全季 12 周）：①68→65 ②W1 Δ0→W12 Δ18·营收-97580 ③avgGood 91→86 ⇒ finalScore 87→84
import { settle } from '../src/settlement.js'
import { scoreOf } from '../src/metricDefs.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const 基座 = (week) => ({
  site: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 },
  brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' },
  decisions: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', overbook: '保守 1 间', 'quality-check': '优先整改前 5 项' },
  week, attrs: { quality: 60, reputation: 70, morale: 65 },
})
const 改决策 = (week, patch) => settle({ ...基座(week), decisions: { ...基座(week).decisions, ...patch } })

console.log('▶ V48 · 三缺口守门（需求 3.2-2 / 3.2-3 / 5.2）')

// ① 精简省成本 ⇒ 直接入住率惩罚（需求 3.2-2）
const 满1 = settle(基座(1)), 精1 = 改决策(1, { shifts: '精简省成本' })
ok(满1.occupancy - 精1.occupancy >= 2, `① 精简直接掉入住率：满编 ${满1.occupancy}% − 精简 ${精1.occupancy}% ≥ 2pp（-6% 预事件惩罚）`)
const 满6 = settle(基座(6)), 精6 = 改决策(6, { shifts: '精简省成本' })
ok(满6.occupancy - 精6.occupancy >= 2, `① 惩罚不随周衰减：W6 ${满6.occupancy}% − ${精6.occupancy}% ≥ 2pp`)

// ② 不维护 ⇒ 底仓逐步下沉（需求 3.2-3 · 第 1 周不沉 · 复利下沉触底 -10%）
const 洁1 = settle(基座(1)), 不1 = 改决策(1, { hygiene: '不停房' })
ok(洁1.occupancy === 不1.occupancy, `② 第 1 周不沉（不许开局就崩）：深清洁 ${洁1.occupancy}% === 不停房 ${不1.occupancy}%`)
let 洁合计 = 0, 不合计 = 0, w12洁 = 0, w12不 = 0
for (let w = 1; w <= 12; w++) {
  const a = settle(基座(w)), b = 改决策(w, { hygiene: '不停房' })
  洁合计 += a.revenue; 不合计 += b.revenue
  if (w === 12) { w12洁 = a.occupancy; w12不 = b.occupancy }
}
ok(w12洁 - w12不 >= 10, `② W12 下沉可见：深清洁 ${w12洁}% − 不停房 ${w12不}% ≥ 10pp（触底 -10% 复合）`)
ok(洁合计 > 不合计, `② 12 周营收对照：深清洁 ${洁合计} > 不停房 ${不合计}（持续下滑可见化）`)

// ③ 失职 ⇒ 期末总分下降（5.2 · 两柱：罚本体纯对照 + 多人持续跨阶梯）
// 柱a 罚本体（可证伪）：同输入只差 1 项 doneCount（report-diagnosis=解决利润相关 是当前无消费的无参考项）
//   ⇒ 好评率必降 ~2pp；删掉 -0.02 行 ⇒ 此柱红。
const 齐10 = { ...基座(1).decisions, 'report-diagnosis': '解决利润相关' }   // 10 项（不触罚）
const 齐9删项 = { ...齐10 }; delete 齐9删项['report-diagnosis']            // 9 项？⇒ 9 不触罚 —— 再删一项触罚
delete 齐9删项.linen                                                        // 8 项 ⇒ 触罚 -0.02（其余链路同 · linen 无口碑加成）
const a罚 = settle({ ...基座(1), decisions: 齐10 }), b罚 = settle({ ...基座(1), decisions: 齐9删项 })
ok(b罚.goodRate < a罚.goodRate, `③a 罚本体：10 项 ${a罚.goodRate}% > 8 项 ${b罚.goodRate}%（-0.02 在场 · 删行必红）`)

// 柱b 多人持续 ⇒ 跨阶梯进总分（漏 3 项 × 12 周 · 含连带加成损失 ⇒ 87→84 实测）
const 交齐12 = [], 漏3项12 = []
for (let w = 1; w <= 12; w++) {
  交齐12.push({ ...settle(基座(w)), week: w })
  const d = { ...基座(w).decisions }; delete d.shifts; delete d.linen; delete d['member-convert']
  漏3项12.push({ ...settle({ ...基座(w), decisions: d }), week: w })
}
const sA = scoreOf(交齐12), sB = scoreOf(漏3项12)
ok(sB.avgGoodRate < sA.avgGoodRate, `③b 多人失职 ⇒ 好评率降（12 周均值 ${sA.avgGoodRate}% → ${sB.avgGoodRate}%）`)
ok(sB.finalScore < sA.finalScore, `③b 多人持续失职 ⇒ 期末总分降：${sA.finalScore} → ${sB.finalScore}（跨 85 阶梯 · 单人漏1项被团队总分稀释=口径内）`)

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
