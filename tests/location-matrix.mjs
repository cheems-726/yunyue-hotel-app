// 选址 × 策略 可行性矩阵：找出"死亡选址"（勤奋策略也持续大亏的区县）
import { settle } from '../src/settlement.js'
import { districts } from '../src/siteLocations.mjs'

const BRANDS = [
  { name: '汉庭', price: '180-280元', standard: '客房70间起', level: '经济型 · 国民' },
  { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' },
]

const DILIGENT = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'member-convert': '强调品质', corporate: '让利签约', 'member-threshold': 5, energy: 23, overbook: 2, ota: {}, reputation: '道歉+赔偿', 'hr-optimize': '全员培训' }
const LAZY = {}

let rows = []
for (const [city, list] of Object.entries(districts)) {
  for (const d of list) {
    for (const brand of BRANDS) {
      let prev = null, total = 0
      for (let w = 1; w <= 12; w++) {
        const r = settle({ site: d.attrs, brand, decisions: DILIGENT, week: w, prevGoodRate: prev })
        prev = r.finalGoodRate
        total += r.profit
      }
      rows.push({ loc: `${city}·${d.name}`, brand: brand.name, profit: total })
    }
  }
}

// 输出最差12个组合
rows.sort((a, b) => a.profit - b.profit)
console.log('最差12个组合（勤奋策略12周）:')
rows.slice(0, 12).forEach(r => console.log(`  ${r.loc} [${r.brand}] ${r.profit >= 0 ? '+' : ''}${r.profit} 元`))
const dead = rows.filter(r => r.profit < -20000)
console.log(`\n重亏组合（<-2万）: ${dead.length}/${rows.length}`)
if (dead.length > rows.length * 0.15) {
  console.error('❌ 死亡选址过多（>15%），需要调整租金成本曲线')
  process.exit(1)
}
console.log('✅ 可行性检查完成')
