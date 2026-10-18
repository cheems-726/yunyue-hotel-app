// V121 判据（离线可验部分）：六性格决策序列——① 同一周 ≥4 组不同 ② 12 周去重 ≥8 ③ 躺平组完成度低 ≥30%
//   ④ 人话理由（≤50 字 · 非模板）⑤ 差评/亏损后下周必有变化（数据驱动最明显 · 躺平几乎不变）⑥ 每组每学期 ≥2 次犯错
//   ★ §3-6（84 天 tick 失败 0 / 12 条）与 §3-7（终局分化）需测试机真跑，本套件不覆盖
import { 生成周决策, 人格 } from '../src/personas.mjs'

const 坏 = []
let 检查数 = 0
const ok = (c, m) => { 检查数++; if (!c) 坏.push(m) }

// 固定种子（可复现）：mulberry32
const 种 = (s) => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
const R = 种(20261018)

// 造 12 周 × 6 组（上周结果用上一周的决策做"粗结果"代理：降价⇒出租高、差评高；停房深清洁⇒差评少）
const 序列 = {}
for (let g = 1; g <= 6; g++) {
  序列[g] = []
  let 上周 = {}
  for (let w = 1; w <= 12; w++) {
    const d = 生成周决策(g, w, 上周, R())
    序列[g].push(d)
    // 粗结果代理（只为驱动"反应"）
    const 降价 = d.决策.pricing === '降价 20% 抢客' || d.决策.pricing === '跟降 10%'
    上周 = {
      出租: 降价 ? 78 : 58,
      差评: d.决策.hygiene === '停房深清洁' ? 0 : (降价 ? 2 : 1),
      gop率: d.决策.campaign === '做活动' ? 0.26 : 0.36,
      亏损: 降价 && d.决策.campaign === '做活动',
    }
  }
}

// ① 同一周 ≥4 组在三项上不同
let 最少不同 = 99
for (let w = 1; w <= 12; w++) {
  const 三项 = 序列[1][w - 1] ? [...Array(6)].map((_, i) => {
    const d = 序列[i + 1][w - 1]
    return [d.决策.pricing, d.决策.campaign, d.决策.overbook].join('|')
  }) : []
  const 不同 = new Set(三项).size
  最少不同 = Math.min(最少不同, 不同)
}
ok(最少不同 >= 4, `同一周至少 4 组在三项上不同（实测最少 ${最少不同} 组）`)

// ② 12 周去重组合 ≥8
for (let g = 1; g <= 6; g++) {
  const 去重 = new Set(序列[g].map(d => JSON.stringify(d.决策))).size
  ok(去重 >= 8, `第${g}组 12 周决策去重应 ≥8（实得 ${去重}）—— 否则又变成同一套`)
}

// ③ 躺平组完成度显著低（≥30% 差距）
{
  const 平 = 序列[6].reduce((a, d) => a + d.完成率, 0) / 12
  const 他 = [1, 2, 3, 4, 5].map(g => 序列[g].reduce((a, d) => a + d.完成率, 0) / 12)
  const 均他 = 他.reduce((a, b) => a + b, 0) / 他.length
  ok(均他 - 平 >= 0.3, `躺平组完成度应低 ≥30%（躺平 ${(平 * 100).toFixed(0)}% vs 其他均 ${(均他 * 100).toFixed(0)}%）`)
}

// ④ 人话理由：≤50 字 · 非模板 · 不含"按策略执行"
{
  let n = 0
  for (let g = 1; g <= 6; g++) for (const d of 序列[g]) {
    n++
    ok(d.理由.length > 0 && d.理由.length <= 50, `第${g}组W${d.week} 理由长度应在 1–50（实得 ${d.理由.length}）`)
    ok(!/按策略执行|执行策略|按计划/.test(d.理由), `第${g}组W${d.week} 理由出现机器话：${d.理由}`)
  }
  ok(n === 72, `应有 72 条理由（6 组 × 12 周），实得 ${n}`)
}

// ⑤ 反应：数据驱动组在"上周差评≥2"后必变；躺平组几乎不变
{
  const 变 = (g) => {
    let 次 = 0
    for (let w = 2; w <= 12; w++) {
      const 前 = 序列[g][w - 2], 后 = 序列[g][w - 1]
      const 上 = 生成周决策(g, w, { 差评: 2, 出租: 60, gop率: 0.35 }, 0.05)   // 极端：随机低 ⇒ 只有强反应人格会变
      if (JSON.stringify(上.决策) !== JSON.stringify(前.决策)) 次++
      void 后
    }
    return 次
  }
  const 数据 = 变(5), 躺平 = 变(6)
  ok(数据 > 躺平, `数据驱动组的反应次数应多于躺平组（数据 ${数据} vs 躺平 ${躺平}）`)
  ok(数据 >= 6, `数据驱动组在差评≥2 时多数周应变化（实得 ${数据}/11）`)
}

// ⑥ 每组每学期 ≥2 次犯错（人格使然的不利选择）
for (let g = 1; g <= 6; g++) {
  const 错 = 序列[g].filter(d => d.犯错).length
  ok(错 >= 2, `第${g}组犯错次数应 ≥2（实得 ${错}）—— 人格要有弱点，不许全周最优`)
}

// ⑦ 人格标签齐全
ok(Object.keys(人格).length === 6, '六个人格必须齐全')

console.log('══ V121 六性格决策序列 ══')
console.log(`  72 条决策（6 组 × 12 周）· 同一周最少不同组数 ${最少不同}`)
for (let g = 1; g <= 6; g++) {
  const 去重 = new Set(序列[g].map(d => JSON.stringify(d.决策))).size
  const 错 = 序列[g].filter(d => d.犯错).length
  console.log(`  第${g}组 ${人格[g].名}：去重 ${去重}/12 · 犯错 ${错} · 完成率 ${(序列[g][0].完成率 * 100).toFixed(0)}%`)
}
for (const b of 坏.slice(0, 8)) console.log('  ✗ ' + b)
console.log(`结果: ${检查数 - 坏.length} 通过 / ${坏.length} 失败`)
process.exit(坏.length === 0 ? 0 : 1)
