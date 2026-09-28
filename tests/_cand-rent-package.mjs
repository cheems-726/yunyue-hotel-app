// §21.4-② 《租金曲线候选 × 后果全景表》生成器（**只罗列后果，不选值**）
//
// ── 边界（D56 / §21.4-② · 必须守）──────────────────────────────
//   · **不改现状数值**：本脚本只把租金表达式**临时替换进一个临时模块**（`settle-old-calibtmp.mjs`，
//     被所有扫描器按 `settle-old*` 前缀排除），**跑完即删**；`src/settlement.js` 一个字节不动。
//   · **不动门禁判据**：本脚本不碰 run-all / location-matrix / 任何断言。
//   · **不写"建议选 X"**：只输出各候选的**后果**（死亡选址 / 六组排序 / 代价），拍板权在用户。
//
// 运行：node tests/_cand-rent-package.mjs        （约 1–3 分钟）
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { districts } from '../src/siteLocations.mjs'

const TMP = new URL('../src/settle-old-calibtmp.mjs', import.meta.url)
const SRC = new URL('../src/settlement.js', import.meta.url)
const 原式 = '=> 25 + (Number.isFinite(档) ? 档 : 兜底) * 5'

const BRANDS = [
  { name: '汉庭', price: '180-280元', standard: '客房70间起', level: '经济型 · 国民' },
  { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' },
]
const DILIGENT = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'member-convert': '强调品质', corporate: '让利签约', 'member-threshold': 5, energy: 23, overbook: 2, ota: {}, reputation: '道歉+赔偿', 'hr-optimize': '全员培训' }

// 六组（与长跑/参数表同源；12 周赛季口径）
const NUMERIC = { energy: 23, overbook: 2, 'member-threshold': 5 }
const STRATEGIES = {
  '1勤奋型': { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', ...NUMERIC },
  '2省钱型': { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', ...NUMERIC, energy: 20 },
  '3中间型': { pricing: '不跟降', shifts: '满编保服务', hygiene: '不停房', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', ...NUMERIC },
  '4躺平型': { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', reputation: '模板回复', ...NUMERIC, energy: 20 },
  '5激进型': { pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', ...NUMERIC, energy: 25, overbook: 5, campaign: '大促营销', ota: '全渠道上架' },
  '6逆袭型': { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', reputation: '道歉+赔偿', ...NUMERIC },
}
const RESOLVE = { '1勤奋型': 0.9, '2省钱型': 0.2, '3中间型': 0.5, '4躺平型': 0, '5激进型': 0.1, '6逆袭型': 0.5 }
const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2, district: '锦江区' }
const BRAND_SEASON = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } = await import('../src/attrs.js')

// 候选：(基准, 每档步长) —— 与 A-1 标定脚本同一批（含当前采用的那条）
const CANDS = [
  [35, 10, '旧曲线（A-1 前）'], [30, 5, ''], [28, 5, ''], [25, 5, '★当前采用'], [22, 5, ''], [20, 5, ''],
  [18, 5, ''], [30, 3, ''], [25, 3, ''], [30, 4, ''], [26, 4, ''], [24, 4, ''], [30, 0, '统一定价'], [25, 0, ''], [35, 0, ''],
]

const 源码 = readFileSync(SRC, 'utf8')
if (!源码.includes(原式)) { console.error('✗ 找不到当前租金表达式（引擎已改？）请同步本脚本：' + 原式); process.exit(2) }

const 跑一遍 = async (base, step) => {
  writeFileSync(TMP, 源码.replace(原式, `=> ${base} + (Number.isFinite(档) ? 档 : 兜底) * ${step}`))
  const { settle } = await import(TMP.href + '?v=' + base + '_' + step)
  // ① 死亡选址（52 组合 × 12 周 勤奋策略）
  let dead = 0, n = 0
  for (const [city, list] of Object.entries(districts)) {
    for (const d of list) {
      for (const brand of BRANDS) {
        let prev = null, total = 0
        for (let w = 1; w <= 12; w++) {
          const r = settle({ site: { ...d.attrs, district: d.name }, brand, decisions: DILIGENT, week: w, prevGoodRate: prev })
          prev = r.finalGoodRate; total += r.profit
        }
        n++; if (total < -20000) dead++
      }
    }
  }
  // ② 六组 × 12 周（净利率 + 排序）
  const 组 = []
  for (const [name, dec] of Object.entries(STRATEGIES)) {
    let attrs = { ...ATTR_INIT }, pg = null, cap = null, pn = 0, rs = 0, rev = 0, net = 0
    for (let w = 1; w <= 12; w++) {
      let a = attrs
      for (const [id, ans] of Object.entries(dec)) a = applyDecisionToAttrs(a, id, ans)
      const r = settle({ site: SITE, brand: BRAND_SEASON, decisions: dec, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
      rev += r.revenue; net += r.netProfit
      const neg = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
      rs = Math.ceil(neg * RESOLVE[name]); pn = Math.max(0, pn + neg - rs)
      attrs = normalizeAttrs(r.attrsAfter); pg = r.finalGoodRate; cap = r.capital
    }
    组.push({ name, 净利率: rev > 0 ? net / rev : 0, 营收: rev, 净利: net })
  }
  const 排序 = [...组].sort((a, b) => b.净利率 - a.净利率).map(g => g.name[0]).join('>')
  return { dead, n, 组, 排序, 档3: base + 3 * step, 域: `${base}+档×${step}` }
}

console.log('▶ §21.4-② 租金曲线候选 × 后果全景（只罗列，不选值）\n')
console.log('| 曲线（单房日租） | 档3 值 | 死亡选址 | 六组净利率排序 | 六组净利率 |')
console.log('|---|---|---|---|---|')
const 结果 = []
for (const [base, step, 注] of CANDS) {
  const r = await 跑一遍(base, step)
  结果.push({ base, step, 注, ...r })
  const 率 = r.组.map(g => `${g.name[0]}${(g.净利率 * 100).toFixed(1)}%`).join(' ')
  console.log(`| ${r.域}${注 ? ' ' + 注 : ''} | ${r.档3} | **${r.dead}/${r.n} = ${(r.dead / r.n * 100).toFixed(1)}%** | ${r.排序} | ${率} |`)
}
rmSync(TMP, { force: true })

console.log('\n★ 说明：')
console.log('  · 本表**只列后果**，不含任何"建议选哪条" —— 拍板权在用户（D49-e：为达标调参 = 凑数）')
console.log('  · 现状 = ' + (结果.find(x => x.注.includes('当前采用'))?.域 || '?') + '，其死亡选址 ' +
  (() => { const c = 结果.find(x => x.注.includes('当前采用')); return `${c.dead}/${c.n} = ${(c.dead / c.n * 100).toFixed(1)}%` })())
console.log('  · 引擎源码未改动（租金式仅临时替换进 settle-old-calibtmp.mjs，已删除）')
