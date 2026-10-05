// V46 批3 · 前后对照扫描：同一输入，定价档 × 区县房价档 ⇒ 客流/出租率/营收
// 判据先行（卡内验收2）：提价必须看到【断崖或零单】，不是"降一点"；且断崖须依【区域消费水平】分化
import { settle } from '../src/settlement.js'

const mk = (pricing, 房价, brand) => {
  const site = { 客流: 4, 房价, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
  const b = brand ?? { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
  return settle({ site, brand: b, decisions: { pricing, shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } })
}

const LADDER = ['不跟降', '提价 20%', '提价 50%']
console.log('【表A · 全季(中档 base 340) × 区县房价档 1-5】')
console.log('定价\\房价档 | ' + [1,2,3,4,5].map(h => `H${h}(消费力代理${150+h*30})`).join(' | '))
for (const p of LADDER) {
  const row = [1,2,3,4,5].map(h => {
    const r = mk(p, h)
    return `occ ${String(r.occupancy).padStart(2)}% 营收${String(Math.round(r.revenue/10000))}万 ds${r.demandStrength}`
  })
  console.log(`${p.padEnd(8)} | ${row.join(' | ')}`)
}
console.log('\n【表B · 品牌梯度（房价档2 低消费区 · 海友/汉庭/全季）】')
const brands = [
  { name: '海友', price: '120-200元', standard: '客房60间起', level: '经济' },
  { name: '汉庭', price: '180-280元', standard: '客房70间起', level: '中档' },
]
for (const b of brands) {
  const row = LADDER.map(p => {
    const r = mk(p, 2, b)
    return `occ ${String(r.occupancy).padStart(2)}% ds${r.demandStrength}`
  })
  console.log(`${b.name}(base${mk('不跟降',2,b).price}) | ${row.join(' | ')}`)
}
console.log('\n【表C · 钳位触发矩阵（提价50% · 全季）】')
for (const h of [1,2,3,4,5]) {
  const r = mk('提价 50%', h)
  console.log(`H${h}: 有效价${r.price} ÷ ${150+h*30} = ${(r.price/(150+h*30)).toFixed(2)} ⇒ ${r.price/(150+h*30) >= 2 ? '触发×0.10' : '不触发'} ⇒ occ ${r.occupancy}%`)
}
