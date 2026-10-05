// V35 · 批3 前后对照实测（同一输入 · 解冻纪律②）+ 批4 断言计划的数据底座
// 运行：node tests/_v35-verify.mjs（对照数字原样进批次报告-v35）
import { settle } from '../src/settlement.js'
import { 季节因子 } from '../src/season.mjs'

const 基座 = (week) => ({
  site: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 },
  brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' },
  decisions: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', 'revenue-mgmt': '组合套餐', overbook: '保守 1 间' },
  week, attrs: { quality: 60, reputation: 70, morale: 65 },
})

console.log('▶ V35 批3 · OTA 流量循环 12 周对照（全季 · ota 模式 · 改后引擎）')
let 总营收 = 0, 总净利 = 0
const rows = []
for (let w = 1; w <= 12; w++) {
  const r = settle({ ...基座(w), bizMode: 'ota' })
  const 循环 = (1 + (季节因子(w) - 1) * 0.5)
  总营收 += r.revenue; 总净利 += r.netProfit
  rows.push({ w, season: 季节因子(w).toFixed(2), cycle: 循环.toFixed(3), rev: r.revenue, occ: r.occupancy })
  console.log(`  W${String(w).padStart(2)} 季节=${季节因子(w).toFixed(2)} 循环因子=${循环.toFixed(3)} 营收=${r.revenue} 出租率=${r.occupancy}%`)
}
console.log(`  12 周合计：营收 ${总营收} · 净利 ${总净利}`)

console.log('\n▶ V35 批3 · 断崖对照（低房价区 × 组合套餐 vs 高房价区）')
const 低 = settle({ ...基座(1), bizMode: 'direct', site: { ...基座(1).site, 房价: 2 } })
const 高 = settle({ ...基座(1), bizMode: 'direct', site: { ...基座(1).site, 房价: 4 } })
console.log(`  房价2区 + 组合套餐：出租率 ${低.occupancy}%`)
console.log(`  房价4区 + 组合套餐：出租率 ${高.occupancy}%（同决策 · 无断崖对照面）`)
console.log('  （完整改前/改后对照见批次报告-v35 —— 改前引擎快照已由 git 历史保留）')
