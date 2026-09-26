// 残差根因分解：C 与 A 的比值偏差，是否完全由「每周科目不参与 ×7」造成？
//   若成立，则逐周应有恒等式：profit_C = 7·profit_A + 6·other_A
//   other_A = 每周科目（营销）+ 单次科目（超售赔偿 / 事件罚款）
import { settle as settleNew } from '../src/settlement.js'
import { settle as settleOld } from '../src/settle-old-t11.mjs'
import { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } from '../src/attrs.js'

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const DILIGENT = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', corporate: '让利签约', energy: 23, overbook: 2, 'member-threshold': 5 }
const AGGRESSIVE = { pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 25, overbook: 5, campaign: '大促营销', ota: '全渠道上架' }
const LAZY_POOL = [['pricing', '跟降 10%'], ['shifts', '精简省成本'], ['hygiene', '不停房'], ['linen', '外包'], ['energy', 20], ['overbook', 2], ['reputation', '模板回复'], ['campaign', '大促营销'], ['ota', '全渠道上架'], ['member-convert', '强调优惠'], ['hr-optimize', '裁员1人']]
const lazyWeek = (w) => { const n = 3 + (w % 3); const o = {}; for (let i = 0; i < n; i++) { const [id, a] = LAZY_POOL[(w * 3 + i) % LAZY_POOL.length]; o[id] = a } return o }

for (const [gname, decf] of [['勤奋型', () => DILIGENT], ['激进型', () => AGGRESSIVE], ['躺平型', (w) => lazyWeek(w)]]) {
  let attrs = { ...ATTR_INIT }, pg = null, cap = 500000, pn = 0, rs = 0
  const miss = []
  let sumOther = 0, sumMkt = 0, sumRev = 0
  for (let w = 1; w <= 12; w++) {
    const decisions = decf(w)
    let a = attrs
    for (const [id, ans] of Object.entries(decisions)) a = applyDecisionToAttrs(a, id, ans)
    const o = settleOld({ site: SITE, brand: BRAND, decisions, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
    const n = settleNew({ site: SITE, brand: BRAND, decisions, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
    const we = o.weeklyExpenses || {}
    const other = (we.营销推广 || 0) + (we.超售赔偿 || 0) + (we.事件罚款 || 0)
    if (n.profit !== 7 * o.profit + 6 * other) miss.push(`w${w}: ${n.profit} ≠ 7×${o.profit}+6×${other}=${7 * o.profit + 6 * other}（差 ${n.profit - (7 * o.profit + 6 * other)}）`)
    sumOther += other; sumMkt += we.营销推广 || 0; sumRev += o.revenue
    // 前进用【改后】引擎的状态（与 App 一致）
    pg = o.finalGoodRate; cap = cap + o.profit
    const negCards = o.generatedReviews.filter(x => Number(x.stars) <= 3).length
    rs = Math.ceil(negCards * 0.5); pn = Math.max(0, pn + negCards - rs)
    attrs = normalizeAttrs(o.attrsAfter)
  }
  console.log(`━━━ ${gname} ━━━`)
  console.log(`   恒等式 profit_C = 7·profit_A + 6·other_A：${miss.length === 0 ? '✅ 12 周全成立' : '❌ ' + miss.length + ' 周不符'}`)
  if (miss.length) console.log('     ' + miss.slice(0, 3).join('\n     '))
  console.log(`   12 周合计：每周/单次科目 other=${sumOther}（其中营销 ${sumMkt}）· 旧口径营收 ${sumRev}`)
  console.log(`   ⇒ other 占旧口径营收 ${(sumOther / sumRev * 100).toFixed(1)}%，占新口径营收 ${(sumOther / (sumRev * 7) * 100).toFixed(1)}%（相对权重降 7 倍）\n`)
}
