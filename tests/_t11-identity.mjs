// T1.1 重基线探针：验证 ×7 的精确算式
//   revenue_new === 7 * revenue_old
//   profit_new  === profit_old + 6 * (revenue_old - fixed_old - variable_old)
import { settle as settleNew } from '../src/settlement.js'
import { settle as settleOld } from '../src/settle-old-rev.mjs'

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const DEC = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }
const A = { quality: 60, reputation: 70, morale: 65 }

for (const w of [1, 2, 6, 12]) {
  const o = settleOld({ site: SITE, brand: BRAND, decisions: DEC, week: w, attrs: A })
  const n = settleNew({ site: SITE, brand: BRAND, decisions: DEC, week: w, attrs: A })
  console.log(`w${w}: occ ${o.occupancy}/${n.occupancy} occRooms ${o.occupiedRooms}/${n.occupiedRooms}`)
  console.log(`   rev  old=${o.revenue} new=${n.revenue}  7×old=${o.revenue * 7}  比=${(n.revenue / o.revenue).toFixed(3)}`)
  console.log(`   cost old=${o.totalCost} new=${n.totalCost}  Δ=${n.totalCost - o.totalCost}  Δ/6=${(n.totalCost - o.totalCost) / 6}`)
  console.log(`   prof old=${o.profit} new=${n.profit}  Δ=${n.profit - o.profit}`)
  console.log(`   cap  old=${o.capital} new=${n.capital}  Δ=${n.capital - o.capital}`)
}
console.log('\n-- 反解 fixed+variable（旧口径）：Δcost/6 --')
for (const w of [1, 6]) {
  const o = settleOld({ site: SITE, brand: BRAND, decisions: DEC, week: w, attrs: A })
  const n = settleNew({ site: SITE, brand: BRAND, decisions: DEC, week: w, attrs: A })
  const fixedVar = (n.totalCost - o.totalCost) / 6
  console.log(` w${w} fixed+var(旧)=${fixedVar}  rooms*65=${o.rooms * 65}  occRooms=${o.occupiedRooms}`)
  console.log(`   → 推 profit_new 应 = ${o.profit + 6 * (o.revenue - fixedVar)}  实测 ${n.profit}`)
}
