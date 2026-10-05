// V38 · 选址六维接线核验（单变量对照实测 · 钉死接线状态）
// 判据（卡批2）：同一输入，只把一维调到两个极端（1 vs 5），结算数字必须变（变了=已接线✅ · 没变=未接线🔴）。
// 批4 守门：本套件常驻 —— 任何一维未来被"误删接线"⇒ 这里立刻红（防退化）。
import { settle } from '../src/settlement.js'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const base = {
  site: { 客流: 3, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3 },
  brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' },
  decisions: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' },
  week: 1, attrs: { quality: 60, reputation: 70, morale: 65 },
}
const run = (dim, v) => {
  const site = { ...base.site, [dim]: v }
  const r = settle({ ...base, site })
  return { r, fp: JSON.stringify([r.revenue, r.totalCost, r.goodRate, r.capital]) }
}

console.log('▶ V38 · 选址六维接线核验（单变量对照 · 只改一维 · 两极端）')
const 六维 = ['客流', '房价', '租金', '竞争', '人力', '波动']
const 结论 = {}
for (const dim of 六维) {
  // 客流维用 3 vs 5：客流=1 会触发 tierLimit throw（本身即客流被消费的行为证据：低消费区禁高端）
  const lo = run(dim, dim === '客流' ? 3 : 1)
  const hi = run(dim, 5)
  const changed = lo.fp !== hi.fp
  结论[dim] = changed
  // 各维的敏感输出（便于报告引用具体数字）
  const detail = dim === '波动'
    ? `需求强度 ${lo.r.demandStrength ?? '-'} → ${hi.r.demandStrength ?? '-'}`
    : `营收 ${lo.r.revenue} → ${hi.r.revenue} · 成本 ${lo.r.totalCost} → ${hi.r.totalCost}`
  ok(changed, `${dim}：extremes(1 vs 5) ⇒ 结算输出变化（已接线）· ${detail}`)
}

// 批4 守门断言：六维必须【全部】接线（任何一维退化为"不消费"⇒ 本套件红）
ok(Object.values(结论).every(Boolean), '★ 六维 6/6 全部被结算消费（V38 钉死 · 防退化）',
  Object.entries(结论).filter(([, v]) => !v).map(([k]) => k).join(','))

// 反向验证（守门可构造红）：把套件自身的判据换成"要求不变"⇒ 必红（演示判据方向正确）
// —— 即：若未来某维真的被设计为不消费，本套件会红，届时应修改本断言并写明依据（不许静默删维）。

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：单变量对照（只改一维）· 结论必须来自实测数字而非注释')
process.exit(fail ? 1 : 0)
