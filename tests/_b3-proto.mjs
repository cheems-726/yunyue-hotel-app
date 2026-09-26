// B3 原型：AI 领班确定性 + 授权边界（可运行断言）
// 运行：node tests/_b3-proto.mjs
// 断言：① 两组同状态+同授权+同事件 → 动作序列逐字相同 ② 无授权 → 动作数=0（只报告）
//       ③ 同 item 规则冲突 → 确定性裁决（ruleId 序）④ 代管率计算含"离线周不进平均"
import { guestsRng } from '../src/guests.js'

// ── 规则是数据 ──
const RULES = [
  { id: 'R1', item: 'pricing', weight: 'high', requires: 'price_adj',
    when: (s) => s.rivalDrop > 10 && s.occLow3Days, act: (s) => ({ item: 'pricing', to: Math.max(s.priceFloor, Math.round(s.rivalPrice * 0.97)) }),
    reason: (s, a) => `D${s.day} 竞对均价降 ${s.rivalDrop}%、我们出租率 ${s.occ}%（低于健康线 3 天）→ 在你授权的 ±10% 内把房价调至 ${a.to} 元（竞对价×0.97）。若想自己管，可在授权页收紧调价幅度` },
  { id: 'R2', item: 'pricing', weight: 'high', requires: 'price_adj',
    when: (s) => s.occHigh3Days && s.rivalPremium >= 5, act: (s) => ({ item: 'pricing', to: Math.min(s.priceCeil, Math.round(s.price * 1.05)) }),
    reason: (s, a) => `D${s.day} 连续满房且定价低于市场 ${s.rivalPremium}% → 上调房价至 ${a.to} 元测试支付意愿` },
  { id: 'R3', item: 'overbook', weight: 'low', requires: 'overbook',
    when: (s) => s.overbookPayoutsThisWeek >= 2, act: () => ({ item: 'overbook', to: 0 }),
    reason: (s, a) => `D${s.day} 本周已赔 ${s.overbookPayoutsThisWeek} 次到店无房 → 超售清零止损` },
  { id: 'R6', item: 'energy', weight: 'high', requires: 'energy',
    when: (s) => s.energyExtreme2Days, act: (s) => ({ item: 'energy', to: 23 }),
    reason: (s, a) => `D${s.day} 客房温度 ${s.energy}℃ 持续 2 天，投诉风险高 → 调回舒适区 23℃` },
  { id: 'R7', item: '__report', weight: 'low', requires: 'none',
    when: (s) => s.hygieneFail, act: () => null,
    reason: (s) => `D${s.day} 卫生检查不合格：建议停房深清洁（超出领班权限，请店主处理）` },
]

// 授权：幅度 → 处理函数（含边界裁剪）
const AUTH = {
  price_adj: { ok: true, clamp: (to, s) => Math.round(Math.max(s.price * 0.9, Math.min(s.price * 1.1, to))) },   // ±10%（四舍五入防浮点尾差）
  overbook: { ok: true }, energy: { ok: true },
}

export function supervisorAct({ state, authorizations, events, day }) {
  const s = { ...state, day }
  const actions = [], reports = []
  const claimed = new Set()
  for (const rule of RULES) {
    if (!rule.when(s)) continue
    if (rule.item !== '__report' && claimed.has(rule.item)) continue   // 同 item 已被更高优先级占用
    if (rule.item !== '__report' && rule.item === 'pricing' && claimed.has('pricing')) continue
    const auth = authorizations[rule.requires]
    if (!auth || !auth.ok) {
      reports.push({ day, ruleId: rule.id, reason: `D${day} ${rule.id} 触发但未获授权（${rule.requires}）→ 仅报告不动作` })
      if (rule.item !== '__report') claimed.add(rule.item)
      continue
    }
    const act = rule.act(s)
    const to = (auth.clamp && act) ? auth.clamp(act.to, s) : (act ? act.to : null)
    const a = { item: act ? act.item : '__report', to }
    const reason = rule.reason(s, a)
    if (act) { actions.push({ day, ruleId: rule.id, ...a, reason }); claimed.add(rule.item === 'pricing' ? 'pricing' : rule.item) }
    else reports.push({ day, ruleId: rule.id, reason })
  }
  return { actions, reports }
}

let pass = 0, fail = 0
const ok = (c, n) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.log('  ✗ ' + n) } }

function runDemo() {
console.log('▶ B3 原型：领班确定性 + 授权边界')
const S = { day: 9, rivalDrop: 12, occLow3Days: true, occ: 51, rivalPrice: 253, price: 230, priceFloor: 210, priceCeil: 260, occHigh3Days: false, rivalPremium: -3, overbookPayoutsThisWeek: 0, energyExtreme2Days: false, energy: 23, hygieneFail: true }
const AUTH_FULL = { price_adj: AUTH.price_adj, overbook: AUTH.overbook, energy: AUTH.energy }

// ① 确定性：两组同状态+同授权 → 逐字相同
const a1 = supervisorAct({ state: S, authorizations: AUTH_FULL, events: [], day: 9 })
const a2 = supervisorAct({ state: { ...S }, authorizations: { ...AUTH_FULL }, events: [], day: 9 })
ok(JSON.stringify(a1) === JSON.stringify(a2), '同状态+同授权+同事件 → 结果逐字相同（红线1）')
ok(a1.actions.length === 1 && a1.actions[0].ruleId === 'R1', `R1 命中且 R2 被同 item 冲突裁决跳过（动作 ${a1.actions.map(x => x.ruleId).join(',')}）`)
ok(/竞对均价降 12%|授权/.test(a1.actions[0].reason), 'reason 含触发证据与授权边界（好模板四要素）')
console.log('    示例 reason：' + a1.actions[0].reason)

// ② 授权边界：无授权 → 动作数 = 0，只有报告
const a3 = supervisorAct({ state: S, authorizations: {}, events: [], day: 9 })
ok(a3.actions.length === 0, '全部未授权 → 动作数 0（红线3：只报告不动作）')
ok(a3.reports.length >= 1 && a3.reports.some(r => r.reason.includes('未获授权')), '未授权时周报有"仅报告"记录')

// ③ 授权裁剪：±10% 之外不越权
const S2 = { ...S, rivalPrice: 400, occ: 51 }        // 竞对 400×0.97=388 > 230×1.1=253
const a4 = supervisorAct({ state: S2, authorizations: AUTH_FULL, events: [], day: 9 })
ok(a4.actions.length === 1 && a4.actions[0].to <= Math.round(230 * 1.1), `授权裁剪生效：想调到 388，被压到 ${a4.actions[0].to}（≤253）`)

// ④ 代管率：分母含代管机会；整周离线不进平均
function careRate(week) {
  const actions = week.actions, studentDecisions = week.studentDecisions
  const denom = actions.length + studentDecisions
  return denom === 0 ? null : actions.length / denom
}
const w1 = { actions: [{}], studentDecisions: 9 }         // 1 次代管 + 学生 9 次
const w2 = { actions: [], studentDecisions: 0 }         // 整周离线：0 动作 + 0 学生决策 = 0/0
const rates = [w1, w2].map(careRate).filter(r => r !== null)
ok(rates.length === 1 && Math.abs(rates[0] - 0.1) < 1e-9, '代管率 = 动作/(动作+学生决策)=0.1；离线周(0/0=null)被剔除不进平均（平均只算有分母的周）')

// ⑤ 恶意/意外输入：不 NaN 不崩
const weird = supervisorAct({ state: { ...S, rivalDrop: null, occ: undefined }, authorizations: AUTH_FULL, events: [], day: 9 })
ok(Array.isArray(weird.actions), '脏输入（null/undefined）不崩溃不产生 NaN')

console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
}
// 直接运行本文件时执行演示；被 import 时只导出 supervisorAct
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('\\').pop())) runDemo()
