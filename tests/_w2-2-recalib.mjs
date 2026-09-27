// W2-2 准备：新利润量级下的 m / 资金三数 / profitScore 分段（D20 两判据实测）
//   改前 = src/settle-old-w2.mjs（W2-1 之前）  改后 = src/settlement.js（W2-1 之后）
//   m := 改后「6组12周利润总和」/ 改前「6组12周利润总和」
//   判据① 6 组资金曲线形状一致（预警/破产触发周次差异 ≤1 周）
//   判据② 6 组评级分布一致（S/A/B/C/D）
import { settle as settleNew } from '../src/settlement.js'
import { settle as settleOld } from '../src/settle-old-w2.mjs'
import { DEPT_COST_PER_ROOM_DAY } from '../src/deptCosts.mjs'
import { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } from '../src/attrs.js'

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const D = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }
const T = { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 20 }
const M = { pricing: '不跟降', shifts: '满编保服务', hygiene: '不停房', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', energy: 23, overbook: 2 }
const AG = { pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 25, overbook: 5, campaign: '大促营销', ota: '全渠道上架' }
const LP = [['pricing', '跟降 10%'], ['shifts', '精简省成本'], ['hygiene', '不停房'], ['linen', '外包'], ['energy', 20], ['overbook', 2], ['reputation', '模板回复'], ['campaign', '大促营销'], ['ota', '全渠道上架'], ['member-convert', '强调优惠'], ['hr-optimize', '裁员1人']]
const lazy = (w) => { const n = 3 + (w % 3); const o = {}; for (let i = 0; i < n; i++) { const [k, v] = LP[(w * 3 + i) % LP.length]; o[k] = v } return o }
const GROUPS = { '1勤奋型': () => D, '2省钱型': () => T, '3中间型': () => M, '4躺平型': (w) => lazy(w), '5激进型': () => AG, '6逆袭型': (w) => (w <= 6 ? T : D) }
const RESOLVE = { '1勤奋型': 0.9, '2省钱型': 0.2, '3中间型': 0.5, '4躺平型': 0, '5激进型': 0.1, '6逆袭型': 0.5 }
const r10k = (x) => Math.round(x / 10000) * 10000
const grade = (s) => (s >= 90 ? 'S' : s >= 80 ? 'A' : s >= 70 ? 'B' : s >= 60 ? 'C' : 'D')

function run(engine, decf, IC) {
  let attrs = { ...ATTR_INIT }, pg = null, cap = null, pn = 0, rs = 0
  const h = []
  for (let w = 1; w <= 12; w++) {
    const d = decf(w)
    let a = attrs
    for (const [k, v] of Object.entries(d)) a = applyDecisionToAttrs(a, k, v)
    const r = engine({ site: SITE, brand: BRAND, decisions: d, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
    h.push({ profit: r.profit, occupancy: r.occupancy, finalGoodRate: r.finalGoodRate, negativeCount: r.negativeCount, capital: r.capital, isWarning: r.isWarning, isBankrupt: r.isBankrupt })
    pg = r.finalGoodRate; cap = r.capital
    const neg = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
    rs = Math.ceil(neg * RESOLVE[Object.keys(GROUPS).find(k => GROUPS[k] === decf)] ?? 0.5)
    pn = Math.max(0, pn + neg - rs)
    attrs = normalizeAttrs(r.attrsAfter)
  }
  return h
}
function fourDim(h, seg) {
  const tp = h.reduce((a, x) => a + x.profit, 0)
  const ao = Math.round(h.reduce((a, x) => a + x.occupancy, 0) / h.length)
  const ag = Math.round(h.reduce((a, x) => a + x.finalGoodRate, 0) / h.length)
  const tn = h.reduce((a, x) => a + x.negativeCount, 0)
  const p = tp >= seg[0] ? 100 : tp >= seg[1] ? 85 : tp >= seg[2] ? 70 : tp >= seg[3] ? 55 : 40
  const rep = ag >= 90 ? 95 : ag >= 85 ? 85 : ag >= 75 ? 70 : ag >= 60 ? 55 : 40
  const occ = ao >= 75 ? 95 : ao >= 65 ? 80 : ao >= 55 ? 65 : ao >= 45 ? 50 : 40
  const neg = tn === 0 ? 100 : tn <= 5 ? 80 : tn <= 10 ? 65 : 50
  return Math.round(p * 0.4 + rep * 0.25 + occ * 0.2 + neg * 0.15)
}

console.log('▶ W2-2 准备 · 新量级下的 m / 三数 / 分段（Σ费率=' + DEPT_COST_PER_ROOM_DAY + '）\n')
const OLD_IC = 5020000, OLD_WARN = 1004000, OLD_SEG = [500000, 300000, 100000, 0]
const oldH = {}, newH = {}
for (const k of Object.keys(GROUPS)) { oldH[k] = run(settleOld, GROUPS[k], OLD_IC); newH[k] = run(settleNew, GROUPS[k], OLD_IC) }
const sumOld = Object.values(oldH).reduce((a, h) => a + h.reduce((x, y) => x + y.profit, 0), 0)
const sumNew = Object.values(newH).reduce((a, h) => a + h.reduce((x, y) => x + y.profit, 0), 0)
const m = sumNew / sumOld
console.log(`改前「6组12周利润总和」 ${sumOld}`)
console.log(`改后「6组12周利润总和」 ${sumNew}`)
console.log(`m = ${sumNew} / ${sumOld} = ${m.toFixed(4)}`)
console.log('逐组倍数：' + Object.keys(GROUPS).map(k => {
  const po = oldH[k].reduce((a, x) => a + x.profit, 0), pn = newH[k].reduce((a, x) => a + x.profit, 0)
  return `${k} ${(pn / po).toFixed(2)}×`
}).join(' · '))
const IC = r10k(OLD_IC * m)
const WARN = Math.round(IC * 0.2), RED = Math.round(IC * 0.1)
const SEG = OLD_SEG.map(t => r10k(t * m))
console.log(`\n候选三数：initialCapital ${OLD_IC} → ${IC} ｜ 变黄 ${OLD_WARN} → ${WARN} ｜ 变红 ${Math.round(OLD_WARN*0.5)} → ${RED} ｜ 破产 0`)
console.log(`候选分段：${OLD_SEG.join('/')} → ${SEG.join('/')}`)

console.log('\n【判据② 评级分布】')
let distOld = '', distNew = '', same = 0
for (const k of Object.keys(GROUPS)) {
  const so = fourDim(oldH[k], OLD_SEG), sn = fourDim(newH[k], SEG)
  distOld += grade(so); distNew += grade(sn)
  if (grade(so) === grade(sn)) same++
  console.log(`  ${k}：改前 ${so}(${grade(so)}) → 改后 ${sn}(${grade(sn)}) ${grade(so) === grade(sn) ? '✅' : '⚠️'}`)
}
console.log(`  分布：改前 ${distOld} vs 改后 ${distNew} ⇒ ${distOld === distNew ? '✅ 一致' : `⚠️ ${same}/6 组一致`}`)

console.log('\n【判据① 资金曲线：触发周次】')
const trig = (h, warn, bank) => {
  const w = h.findIndex(x => x.capital < warn && x.capital >= bank)
  const b = h.findIndex(x => x.capital < bank)
  return `${w < 0 ? '—' : 'w' + (w + 1)}/${b < 0 ? '—' : 'w' + (b + 1)}`
}
for (const k of Object.keys(GROUPS)) {
  const a = trig(oldH[k], 1004000, 0), b = trig(newH[k], WARN, 0)
  console.log(`  ${k}：改前(预警/破产) ${a} · 改后 ${b} ${a === b ? '✅' : '⚠️'}`)
}
