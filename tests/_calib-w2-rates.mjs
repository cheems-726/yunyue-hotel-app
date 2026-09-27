// W2-1 费率标定：求使 6 组【赛季平均】部门成本/营收 落在 42–48% 的 Σ费率
import { settle } from '../src/settlement.js'
import { deptCostWeekly } from '../src/deptCosts.mjs'
import { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } from '../src/attrs.js'
const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const D = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }
const T = { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 20 }
const M = { pricing: '不跟降', shifts: '满编保服务', hygiene: '不停房', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', energy: 23, overbook: 2 }
const AG = { pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 25, overbook: 5, campaign: '大促营销', ota: '全渠道上架' }
const CH = ['不跟降','跟降 10%','精简省成本','不停房','外包','全员培训','强调品质','道歉+赔偿','模板回复','强调优惠','大促营销','全渠道上架']
const lazy = (w) => { const n = 3 + (w % 3); const o = {}; const P = [['pricing','跟降 10%'],['shifts','精简省成本'],['hygiene','不停房'],['linen','外包'],['energy',20],['overbook',2],['reputation','模板回复'],['campaign','大促营销'],['ota','全渠道上架'],['member-convert','强调优惠'],['hr-optimize','裁员1人']]; for (let i=0;i<n;i++){const [k,v]=P[(w*3+i)%P.length];o[k]=v} return o }
const G = { 勤奋型:()=>D, 省钱型:()=>T, 中间型:()=>M, 躺平型:(w)=>lazy(w), 激进型:()=>AG, 逆袭型:(w)=>w<=6?T:D }
function run(dec, scale) {
  let attrs = { ...ATTR_INIT }, pg = null, cap = null, pn = 0, rs = 0
  let dept = 0, rev = 0, pr = 0, gop = 0
  for (let w = 1; w <= 12; w++) {
    const d = dec(w)
    let a = attrs
    for (const [k, v] of Object.entries(d)) a = applyDecisionToAttrs(a, k, v)
    const r = settle({ site: SITE, brand: BRAND, decisions: d, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
    // 用 scale 重算固定部分（标定用，不改引擎）
    const dv = deptCostWeekly({ rooms: r.rooms, decisions: d })
    dept += scale * dv.total; rev += r.revenue; pr += r.profit - (dv.total - 0) + (scale - 1) * dv.total * 0; gop += r.gop
    pg = r.finalGoodRate; cap = r.capital
    const neg = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
    rs = Math.ceil(neg * 0.5); pn = Math.max(0, pn + neg - rs)
    attrs = normalizeAttrs(r.attrsAfter)
  }
  return { ratio: dept / rev, dept, rev, pr }
}
console.log('Σ费率标定（基线 55 元/间/天 ⇒ scale=1）')
for (const scale of [1.0, 1.25, 1.4, 1.5, 1.6, 1.75]) {
  const rows = []
  let tot = { dept: 0, rev: 0 }
  for (const [n, f] of Object.entries(G)) {
    const r = run(f, scale)
    rows.push(`${n} ${(r.ratio * 100).toFixed(1)}%`)
    tot.dept += r.dept; tot.rev += r.rev
  }
  const avg6 = tot.dept / tot.rev
  console.log(` scale=${scale.toFixed(2)}  Σ费率=${(55 * scale).toFixed(1)} 元/间/天  六组加权平均 ${(avg6 * 100).toFixed(1)}%  |  ${rows.join(' · ')}`)
}
