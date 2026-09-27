// W2-1/W2-4 权威数字（供报告引用；单配置 vs 六组赛季均值【分开列】）
// ★ 六组场景与聚合统一走 tests/_season6.mjs（同一份定义，避免"报告数字"与"门禁断言"两处口径漂移）
import { settle } from '../src/settlement.js'
import { runSeason6, SEASON_SITE, SEASON_BRAND, SEASON_GROUPS, variableOf } from './_season6.mjs'

// ── 单配置（确定性可复算：中档全季 80 间 / 勤奋型 / 第 1 周）──
const D = SEASON_GROUPS['1勤奋型'](1)
const one = settle({ site: SEASON_SITE, brand: SEASON_BRAND, decisions: D, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } })
console.log('── 单配置（中档全季 80 间 / 勤奋型 / 第 1 周 / 固定输入，确定性可复算）──')
console.log(`  revenue ${one.revenue} · totalCost ${one.totalCost} · profit ${one.profit} · deptCost ${one.deptCost}`)
console.log(`  gop ${one.gop} (${(one.gopRate * 100).toFixed(1)}%) · netProfit ${one.netProfit} (${(one.netProfitRate * 100).toFixed(1)}%) · ΣweeklyExpenses ${Object.values(one.weeklyExpenses).reduce((a, b) => a + b, 0)}`)
const oneVar = variableOf(one)
console.log(`  【完整部门成本】/营收 ${((one.deptCost + oneVar) / one.revenue * 100).toFixed(1)}%（固定 ${(one.deptCost / one.revenue * 100).toFixed(1)}% + 变动 ${(oneVar / one.revenue * 100).toFixed(1)}%）`)

// ── 六组 × 12 周赛季（加权平均）──
const { perGroup, weighted: tot } = runSeason6()
console.log('\n── 六组 × 12 周赛季（加权平均）──')
for (const g of perGroup) {
  console.log(`  ${g.name}：部门成本/营收 ${(g.deptRate * 100).toFixed(1)}% · 租金率 ${(g.rentRate * 100).toFixed(2)}% · 净利率 ${(g.netRate * 100).toFixed(1)}% · 期末资金 ${g.capitalEnd}`)
}
console.log(`  ★ 六组加权：部门成本/营收 ${(tot.deptRate * 100).toFixed(1)}% · 租金率 ${(tot.rentRate * 100).toFixed(2)}% · GOP 率 ${(tot.gopRate * 100).toFixed(1)}% · 净利率 ${(tot.netRate * 100).toFixed(1)}%`)
console.log(`  ★ 总成本/营收（含租金）${(tot.costRate * 100).toFixed(1)}%`)

// ── W2-4 华住现金流率对拍（结构口径，与 dataDict F 段同源）──
const hzDept = 1 - 0.55, hzRent = 1916250 / 6570000, hzFran = 0.05
const hzCfo = 1 - hzDept - hzRent - hzFran
const usCfo = 1 - tot.deptRate - tot.rentRate - hzFran
console.log('\n── W2-4 华住现金流率对拍（结构口径 · 不调参）──')
console.log(`  华住：1 − ${(hzDept * 100).toFixed(2)}% − ${(hzRent * 100).toFixed(2)}% − ${(hzFran * 100).toFixed(2)}% = ${(hzCfo * 100).toFixed(2)}%`)
console.log(`  我们：1 − ${(tot.deptRate * 100).toFixed(2)}% − ${(tot.rentRate * 100).toFixed(2)}% − ${(hzFran * 100).toFixed(2)}%(代入) = ${(usCfo * 100).toFixed(2)}%`)
console.log(`  差 ${((hzCfo - usCfo) * 100).toFixed(2)}pp，其中租金项贡献 ${((tot.rentRate - hzRent) * 100).toFixed(2)}pp，残差 ${(Math.abs((hzCfo - usCfo) - (tot.rentRate - hzRent)) * 100).toFixed(2)}pp`)
console.log('  ▸ 部门成本项已对齐（45.05% vs 45%）；引擎无特许费科目 ⇒ 代入华住同费率 5%')
