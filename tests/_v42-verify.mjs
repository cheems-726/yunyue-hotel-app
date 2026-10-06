// V42 · 批2 单变量对照实测（只改本店配置 ⇒ 各客群加权满意度/口碑/营收随之变 · 结论进报告-v42 与学生一页）
// 消费点（批1 · 文件:行号）：settlement.js :621-694 客群画像匹配（三路并行 × 归一化占比 → personaBonus → goodRate）
//   商务路 :642-648（温度 22-24 +0.02 · 满编 +0.015 · 非深清洁 −0.01）
//   游客路 :650-656（价 ≤ basePrice×0.9 +0.02 · 深清洁 +0.015 · 降价20% −0.01）
//   家庭路 :658-664（温度 22-25 +0.015 · 满编 +0.01 · 外包布草 −0.015）
//   占比加权 :636-641 · 兜底 :666-670 · 施加点 :694
import { settle } from '../src/settlement.js'

const 品牌 = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const mk = (区, 房价档, decisions) => settle({
  site: { 客流: 4, 房价: 房价档, 租金: 3, 竞争: 3, 人力: 3, 波动: 2, district: 区 },
  brand: 品牌, decisions: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', reputation: '道歉+赔偿', ...decisions },
  week: 2, attrs: { quality: 60, reputation: 70, morale: 65 }, bizMode: 'direct',
})

const 场次 = [
  { 名: '高新区（商65/游15/家20）', 区: '高新区', 档: 5 },
  { 名: '围场（商10/游70/家20）', 区: '围场满族蒙古族自治县', 档: 2 },
  { 名: '中江县（商15/游10/家75）', 区: '中江县', 档: 2 },
]
console.log('▶ V42 批2 · 同一配置只换一个变量 ⇒ 客群加权口碑（personaBonus→goodRate）响应对照')
for (const 场 of 场次) {
  const 基线 = mk(场.区, 场.档, {})
  const 换深清洁 = mk(场.区, 场.档, { hygiene: '不停房' })
  const 换外包 = mk(场.区, 场.档, { linen: '外包' })
  console.log(`【${场.名}】基线 口碑 ${基线.goodRate}% 营收 ${基线.revenue}`)
  console.log(`  只换 hygiene→不停房（商务路−0.01·游客路+0.015 反向）: 口碑 ${换深清洁.goodRate}%（Δ${换深清洁.goodRate - 基线.goodRate}pp）营收 Δ${换深清洁.revenue - 基线.revenue}`)
  console.log(`  只换 linen→外包（家庭路−0.015）: 口碑 ${换外包.goodRate}%（Δ${换外包.goodRate - 基线.goodRate}pp）营收 Δ${换外包.revenue - 基线.revenue}`)
}
console.log('\n★ 如实：占比由【区位】给定（选址决定客源结构），本店配置改变的是各类客群的【满意度加权分】（→口碑→营收），不改变占比本身 —— 占比展示在选址页 personaLine（V6 口径）。')
