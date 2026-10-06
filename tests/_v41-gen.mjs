// V41 · 竞品 121 家逐家明细机械生成（只搬不编 · 数据源 = src/siteLocations.mjs COMPETITORS 同源）
// 运行：node tests/_v41-gen.mjs > "../4-审计与报告/数据-竞品121家逐家明细-20261006.md"（重定向生成 · 幂等可重跑）
import { COMPETITORS, districts } from '../src/siteLocations.mjs'

const 档中文 = { luxury: '奢华', upscale: '高档', mid: '中档', budget: '经济型' }
const 区位城市 = {}
for (const [城市, arr] of Object.entries(districts)) for (const d of arr) 区位城市[d.name] = 城市

let 总数 = 0
const 行 = []
for (const [区, arr] of Object.entries(COMPETITORS)) {
  for (const c of arr) {
    总数++
    const 价格带 = c.priceFrom != null && c.priceAvg != null ? `${c.priceFrom}–${c.priceAvg}` : `起始 ${c.basePrice}`
    行.push(`| ${c.name} | ${档中文[c.level] || c.level} | ${区位城市[区] || '🔴 城市映射缺失'} | ${区} | ${价格带}（基准=${c.priceBasis === 'avg' ? '均价' : '起始价'}） | ${c.source || '🔴 无来源'} | ${c.confidence || '🔴 无置信度'} |`)
  }
}
console.log(`# 数据 · 竞品 121 家逐家明细（模块一 1.2-3 · V41 · 2026-10-06）`)
console.log(``)
console.log(`> **来源（机械生成）**：\`node tests/_v41-gen.mjs\` 从 \`src/siteLocations.mjs\` COMPETITORS 导出 · **只搬不编**。`)
console.log(`> 档次依据 = Trip.com 繁中站抓取时的平台分类字段（level · 与引擎竞品 AI 同源同字段）· **非人工分档**。`)
console.log(`> 价格区间 = priceFrom–priceAvg（抓取页"起始价/均价" · curr=CNY · 2026-09-27）· 基准列标明该家采用哪个口径。`)
console.log(`> ★ 汇总口径（26 区位 × 4 档家数与占比）见同日《数据-档次分布表-26区位-20261006.md》（V32 · 同源 · 家数合计 ${总数}）。`)
console.log(``)
console.log(`| 酒店名称 | 档位 | 城市 | 区域 | 价格区间（元） | 来源 | 置信度 |`)
console.log(`|---|---|---|---|---|---|---|`)
for (const r of 行) console.log(r)
console.log(``)
console.log(`**合计：${总数} 家**（应与 COMPETITORS 总数 121 一致 · 与汇总表家数合计一致）`)
