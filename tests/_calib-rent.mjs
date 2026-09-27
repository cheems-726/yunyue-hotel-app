// A-1 租金曲线【标定复算】（可复跑 —— 让批次报告里的标定表不是"只留结论数字"）
//
// 做法：把引擎源码（src/settlement.js）里的租金表达式临时替换成候选式，落到一个临时模块
//   （命名 settle-old-calibtmp.mjs ⇒ 被所有扫描器按 `settle-old*` 前缀排除；跑完即删），
//   然后在【同一份引擎、同一套 52 组合 × 12 周勤奋策略】下数"死亡选址"比例。
//   ★ 只换租金表达式一处，其余（部门成本/口碑/衰减/随机流）全部逐字节相同 ⇒ 差异只能归因于租金曲线。
//
// 运行：node tests/_calib-rent.mjs
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

// 候选：(基准, 每档步长) —— 单房日租 = 基准 + 档×步长
const CANDS = [
  [35, 10, '旧曲线（A-1 前）'], [30, 5, ''], [28, 5, ''], [25, 5, '★ A-1 采用'], [22, 5, ''], [20, 5, ''],
  [18, 5, ''], [30, 3, ''], [25, 3, ''], [30, 4, ''], [26, 4, ''], [24, 4, ''], [30, 0, '统一定价'], [25, 0, ''], [35, 0, ''],
]

const 源码 = readFileSync(SRC, 'utf8')
if (!源码.includes(原式)) {
  console.error('✗ 找不到当前租金表达式（引擎已改？）—— 请同步本脚本的原式常量：' + 原式)
  process.exit(2)
}

const 跑一遍 = async (base, step) => {
  writeFileSync(TMP, 源码.replace(原式, `=> ${base} + (Number.isFinite(档) ? 档 : 兜底) * ${step}`))
  const { settle } = await import(TMP.href + '?v=' + base + '_' + step)   // 加查询串避开模块缓存
  const rows = []
  for (const [city, list] of Object.entries(districts)) {
    for (const d of list) {
      for (const brand of BRANDS) {
        let prev = null, total = 0
        for (let w = 1; w <= 12; w++) {
          const r = settle({ site: d.attrs, brand, decisions: DILIGENT, week: w, prevGoodRate: prev })
          prev = r.finalGoodRate
          total += r.profit
        }
        rows.push(total)
      }
    }
  }
  return rows.filter(p => p < -20000).length
}

console.log('▶ A-1 租金曲线标定复算（52 组合 × 12 周 · 勤奋策略 · 判据"12 周累计 < −2 万 = 重亏"）')
console.log('  单房日租 = 基准 + 档×步长（档1-5：选址"租金"属性）')
console.log('  基准/步长 | 档1..档5 元 | 重亏组合 | 占比')
try {
  for (const [base, step, note] of CANDS) {
    const dead = await 跑一遍(base, step)
    const pct = (dead / 52 * 100).toFixed(1)
    const 档 = [1, 2, 3, 4, 5].map(k => base + k * step).join('/')
    const 达标 = dead / 52 >= 0.20 && dead / 52 <= 0.30 ? '  ✅ 落 20–30%' : ''
    console.log(`  ${String(base).padStart(2)}+档×${String(step).padEnd(2)} | ${档.padEnd(15)} | ${String(dead).padStart(2)}/52  | ${pct.padStart(4)}%${达标}  ${note}`)
  }
} finally {
  rmSync(TMP, { force: true })
  console.log('\n（临时模块已删除；扫描器一律按 settle-old* 前缀排除它）')
}
