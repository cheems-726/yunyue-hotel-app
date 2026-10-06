// V44 · 躺平 vs 尽责 12 周链式对照（状态全链：attrsAfter / prevGoodRate / prevCapital / 处理率全喂回）
// 判据（先行 · 需求 3.2-4「纯躺平 ⇒ 持续亏损倒闭」）：
//   ①躺平组净利 < 0（持续亏损）②躺平 期末资金显著落后尽责 ③若可构造：躺平破产（资金 < 0 或触 isWarning 链）
import { settle } from '../src/settlement.js'

const 品牌 = { name: '汉庭', price: '180-280元', standard: '客房60间起', level: '经济型 · 国民' }
const SITE = { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const NUMERIC = { overbook: '不超售', 'quality-check': '优先整改前 5 项' }   // 与 semesterRun12 的 NUMERIC 同形（不超售/质检）
const 尽责 = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', ...NUMERIC }
const 躺平 = { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', reputation: '模板回复', ...NUMERIC, energy: 20 }

const 跑12 = (decisions) => {
  let attrs = { quality: 60, reputation: 70, morale: 65 }
  let pg = null, cap = 1490000, pn = 0, rs = 0
  const rows = []
  for (let w = 1; w <= 12; w++) {
    const r = settle({ site: SITE, brand: 品牌, decisions, week: w, attrs, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs, bizMode: 'direct' })
    rows.push({ w, occ: r.occupancy, rev: r.revenue, np: r.netProfit, cap: r.capital, warn: r.isWarning, broke: r.isBankrupt, q: r.attrsAfter?.quality })
    pg = r.finalGoodRate; cap = r.capital
    const negCards = (r.generatedReviews || []).filter(x => Number(x.stars) <= 3).length
    rs = Math.ceil(negCards * 0.5); pn = Math.max(0, pn + negCards - rs)
    attrs = r.attrsAfter
  }
  return rows
}

for (const [name, dec] of [['尽责', 尽责], ['躺平', 躺平]]) {
  const rows = 跑12(dec)
  const 总净利 = rows.reduce((s, r) => s + r.np, 0)
  console.log(`【${name}】12 周净利合计 ${总净利} · 期末资金 ${rows[11].cap} · 周均净利 ${Math.round(总净利 / 12)} · 破产=${rows.some(r => r.broke)} · 预警周=${rows.filter(r => r.warn).length}`)
  console.log('  ' + rows.map(r => `w${r.w}:${r.np >= 0 ? '+' : ''}${Math.round(r.np / 1000)}k(${r.occ}%)`).join(' '))
  console.log(`  品质轨迹: ${rows.map(r => r.q).join('→')}`)
}
