// 12周全流程模拟夜测：三种经营策略跑完整学期，检查经济曲线合理性
import { settle } from '../src/settlement.js'

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }

const STRATEGIES = {
  摆烂: {},
  摸鱼: { pricing: '跟降 10%', shifts: '精简省成本', energy: 24 },
  勤奋: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'member-convert': '强调品质', corporate: '让利签约', 'member-threshold': 5, energy: 23, overbook: 2, ota: {}, reputation: '道歉+赔偿', 'hr-optimize': '全员培训' },
}

let anomalies = []
for (const [tag, d] of Object.entries(STRATEGIES)) {
  let prevGood = null, totalProfit = 0, occs = []
  for (let w = 1; w <= 12; w++) {
    const r = settle({ site: SITE, brand: BRAND, decisions: d, week: w, prevGoodRate: prevGood, resolvedCount: tag === '勤奋' ? 2 : 0 })
    prevGood = r.finalGoodRate
    totalProfit += r.profit
    occs.push(r.occupancy)
    if (r.occupancy < 25) anomalies.push(`${tag} 第${w}周出租率异常低 ${r.occupancy}%`)
    if (r.revenue === 0) anomalies.push(`${tag} 第${w}周零营收`)
    if (!Number.isFinite(r.profit)) anomalies.push(`${tag} 第${w}周利润非数字`)
  }
  const avgOcc = Math.round(occs.reduce((a, b) => a + b, 0) / occs.length)
  console.log(`${tag.padEnd(2)} | 平均出租率 ${String(avgOcc).padStart(3)}% | 12周总利润 ${totalProfit >= 0 ? '+' : ''}${totalProfit} 元`)
  // 教学合理性：勤奋应显著好于摆烂
  if (tag === '勤奋') var goodProfit = totalProfit
  if (tag === '摆烂') var badProfit = totalProfit
}
console.log('策略区分度: 勤奋 - 摆烂 =', goodProfit - badProfit, '元（应显著为正）')
if (goodProfit <= badProfit) anomalies.push('勤奋策略收益不高于摆烂——策略区分度失效！')
if (anomalies.length) { console.error('\n❌ 异常:'); anomalies.forEach(a => console.error(' -', a)); process.exit(1) }
console.log('\n✅ 夜测通过：无异常，策略区分度合理')
