// V76 · 品牌内容补全守门（2026-10-08 · 挂 run-all fast）
// 判据：
//   [1] 七字段：19 品牌全有 档次/加盟费/单房造价/价带/房量（fee 允许「费率待补」的诚实标记）
//   [2] 单源：保证金/管理费只从 FRANCHISE_MODEL 现值取 —— BrandSelection 源码不得手写这些数字
//   [3] 适配区位真的在算：汉庭（经济·180-280）匹配 ≥5 个区位；奢华旗舰也有 ≥1 个对标；映射表覆盖 5 档
//   [4] 对比功能：源码含并排对比表（最多 3 个）
//   [5] 诚实空态：无源字段必须出「待补（无公开来源 · 不编造）」文案，不许空字符串或假数
// 运行：node tests/v76Brand.test.mjs
import { readFileSync } from 'node:fs'
import { brandGroups } from '../src/brands.mjs'   // ★ V76 抽出的纯数据模块（单源）
import { FRANCHISE_MODEL } from '../src/franchiseModel.mjs'
import { COMPETITORS } from '../src/siteLocations.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ V76 品牌内容补全')
{
  const 全部 = brandGroups.flatMap(g => g.brands.map(b => ({ ...b, level: g.level })))
  ok(全部.length >= 19, `品牌数 ${全部.length}（≥19 · 华住五档全梯度）`)
  const 缺 = []
  for (const b of 全部) {
    if (!b.name || !b.level) 缺.push(`${b.name}:档次`)
    if (!b.fee) 缺.push(`${b.name}:加盟费`)
    if (!b.cost) 缺.push(`${b.name}:造价`)
    if (!b.price) 缺.push(`${b.name}:价带`)
    if (!b.standard) 缺.push(`${b.name}:房量`)
    if (!b.desc) 缺.push(`${b.name}:一句话简介`)
  }
  ok(缺.length === 0, '19 品牌全有 档次/加盟费/造价/价带/房量/简介（fee 允许「费率待补」）', 缺.slice(0, 3).join(','))
  const 待补数 = 全部.filter(b => String(b.fee).includes('待补')).length
  ok(待补数 >= 1 && 待补数 <= 5, `加盟费「费率待补」诚实标记保持（现 ${待补数} 个 · §16.2-B1 口径）`)
}

{
  const src = readFileSync(new URL('../src/BrandSelection.jsx', import.meta.url), 'utf8')
  const 剥 = src.split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
  ok(/import \{ FRANCHISE_MODEL \} from '\.\/franchiseModel\.mjs'/.test(src), '单源：BrandSelection 从 FRANCHISE_MODEL 取条款')
  ok(!/保证金['"]?\s*[:=]\s*['"`]?1?0?0?000/.test(剥), '单源：界面没手写保证金金额（只许 FRANCHISE_MODEL 一份）')
  for (const 标 of ['品牌对比（并排看差异 · 最多 3 个）', '加入对比', '适配区位', '主力客群', '待补（无公开来源 · 不编造）']) {
    ok(src.includes(标), `界面含「${标}」`)
  }
  // 五档 → 竞品档映射齐全
  for (const 档 of ['经济型 · 国民', '中档', '精选 · 中高档', '高档', '奢华']) ok(new RegExp("'" + 档 + "'\\s*:").test(src), `档位映射含「${档}」`)
}

// 适配区位行为抽查（与浏览器同判据的纯数据版）：直接复算
{
  const 复算 = (level, priceStr) => {
    const m = /(\d+)-(\d+)/.exec(priceStr)
    if (!m) return []
    const lo = Number(m[1]) * 0.8, hi = Number(m[2]) * 1.3
    const MAP = { '经济型 · 国民': ['budget'], '中档': ['mid'], '精选 · 中高档': ['upscale'], '高档': ['upscale', 'luxury'], '奢华': ['luxury'] }
    const out = []
    for (const [区, list] of Object.entries(COMPETITORS)) {
      if ((list || []).some(c => MAP[level].includes(c.level) && ((c.priceBasis === 'from' ? c.basePrice : (c.priceAvg || c.basePrice)) >= lo && (c.priceBasis === 'from' ? c.basePrice : (c.priceAvg || c.basePrice)) <= hi))) out.push(区)
    }
    return out
  }
  const 汉庭 = 复算('经济型 · 国民', '180-280元')
  ok(汉庭.length >= 5, `适配区位在算：汉庭（180-280）匹配 ${汉庭.length} 个区位（≥5）`, 汉庭.join(','))
  const 宋品 = 复算('奢华', '1000-2000元')
  ok(宋品.length >= 1, `适配区位：奢华旗舰（宋品 1000-2000）也有 ${宋品.length} 个同档对标`, 宋品.join(','))
  ok(Object.keys(FRANCHISE_MODEL).length >= 8, `FRANCHISE_MODEL 有源品牌 ${Object.keys(FRANCHISE_MODEL).length}（≥8）`)
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：品牌七字段齐（无源=待补）· 条款单源 · 对比可见 · 适配区位真在算')
process.exit(fail ? 1 : 0)
