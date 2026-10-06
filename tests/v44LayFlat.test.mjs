// V44 · 躺平必亏守门（可证伪 · 挂 run-all fast）
// 背景：V12批10 实测"躺平反超尽责 4.1 万（净利率 +3.1%）" ⇒ 需求 3.2-4 不成立 ⇒ V46+V48 校准后翻转。
// 本套件钉住翻转后的形态（判据先行 · 删对应机制必红）：
//   ①躺平 12 周净利 < 0（持续亏损 · 删 V48 ②底仓下沉或保底机制回归 ⇒ 可能转正 ⇒ 红）
//   ②躺平期末资金落后尽责 ≥5 万（"反超"不得回归 · 5 万 = 卡内失衡量级 4.1 万的反向钉）
//   ③躺平品质触底 ≤25 且 出租率钉 30% 保底周数 ≥4（"客源死亡"形态可见）
//   ④尽责平均出租率 > 躺平（投入回报方向）
// 状态全链：attrsAfter / prevGoodRate / prevCapital / 处理率逐周喂回（与 batch10 旧 harness 的区别 = 属性链在）。
import { settle } from '../src/settlement.js'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const 品牌 = { name: '汉庭', price: '180-280元', standard: '客房60间起', level: '经济型 · 国民' }
const SITE = { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const NUMERIC = { overbook: '不超售', 'quality-check': '优先整改前 5 项' }
const 尽责 = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', ...NUMERIC }
const 躺平 = { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', reputation: '模板回复', ...NUMERIC, energy: 20 }

const 跑12 = (decisions) => {
  let attrs = { quality: 60, reputation: 70, morale: 65 }
  let pg = null, cap = 1490000, pn = 0, rs = 0
  const rows = []
  for (let w = 1; w <= 12; w++) {
    const r = settle({ site: SITE, brand: 品牌, decisions, week: w, attrs, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs, bizMode: 'direct' })
    rows.push({ w, occ: r.occupancy, np: r.netProfit, cap: r.capital, q: r.attrsAfter?.quality })
    pg = r.finalGoodRate; cap = r.capital
    const negCards = (r.generatedReviews || []).filter(x => Number(x.stars) <= 3).length
    rs = Math.ceil(negCards * 0.5); pn = Math.max(0, pn + negCards - rs)
    attrs = r.attrsAfter
  }
  return rows
}

console.log('▶ V44 · 躺平必亏（需求 3.2-4 · 校准后形态钉死）')
const Z = 跑12(躺平), J = 跑12(尽责)
const Z净利 = Z.reduce((s, r) => s + r.np, 0), J净利 = J.reduce((s, r) => s + r.np, 0)

ok(Z净利 < 0, `① 纯躺平 12 周净利 < 0（持续亏损）：${Z净利}（周均 ${Math.round(Z净利 / 12)}）`)
ok(J净利 - Z净利 >= 50000, `② 躺平落后尽责 ≥5 万（反超不回归）：差 ${J净利 - Z净利}`)
ok(Z[11].q <= 25 && Z.filter(r => r.occ <= 32).length >= 4, `③ 躺平品质触底 ${Z[11].q} + 出租率钉保底周数 ${Z.filter(r => r.occ <= 32).length}/12 ≥ 4（客源死亡形态）`)
const Jocc = J.reduce((s, r) => s + r.occ, 0) / 12, Zocc = Z.reduce((s, r) => s + r.occ, 0) / 12
ok(Jocc > Zocc, `④ 尽责平均出租率 ${Jocc.toFixed(0)}% > 躺平 ${Zocc.toFixed(0)}%（投入回报方向）`)

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
