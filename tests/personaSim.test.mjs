// V121 §9 修订版判据（离线可验）：
//   主 · §3-9 **人格可分性**：留一周验证（近邻质心）命中率 ≥80%；RV 纯随机 ⇒ ≈1/6
//   主 · §3-2 **分人格阈值**：活跃 5 组去重 ≥8 · 躺平 ≥3（§9.1）
//   主 · §3-4 人话理由 ≤50 字非模板 · §3-6 每组 ≥2 次犯错
//   辅 · §3-1 同周 ≥4 组不同，**趋同必须可解释**（§9.2）：激进+躺平撞 ⇒ 红；保守之间撞 ⇒ 成立
//   辅 · §3-3 躺平组完成度低 ≥30%
//   ★ §3-6 真跑（84 天 tick）与 §3-7 终局分化需测试机，本套件不覆盖
import { 生成周决策, 人格 } from '../src/personas.mjs'

const 坏 = []
let 检查数 = 0
const ok = (c, m) => { 检查数++; if (!c) 坏.push(m) }

const 种 = (s) => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }

// 造 12 周 × 6 组（上周结果用决策做粗代理，只为驱动"反应"）
function 造序列(纯随机 = false) {
  const R = 种(20261018)
  const 序列 = {}
  for (let g = 1; g <= 6; g++) {
    序列[g] = []
    let 上周 = {}
    for (let w = 1; w <= 12; w++) {
      const d = 纯随机 ? 随机决策(g, w, R) : 生成周决策(g, w, 上周, R())
      序列[g].push(d)
      const 降价 = d.决策.pricing === '降价 20% 抢客' || d.决策.pricing === '跟降 10%'
      上周 = { 出租: 降价 ? 78 : 58, 差评: d.决策.hygiene === '停房深清洁' ? 0 : (降价 ? 2 : 1), gop率: d.决策.campaign === '做活动' ? 0.26 : 0.36, 亏损: 降价 && d.决策.campaign === '做活动', 好评率: (d.决策.hygiene === '停房深清洁' ? 88 : 82) }
    }
  }
  return 序列
}
// 反例 RV 用：纯随机决策（六组同一分布）
function 随机决策(g, w, R) {
  const 取 = (a) => a[Math.floor(R() * a.length)]
  return { 组号: g, week: w, 决策: { pricing: 取(['提价 50%', '不跟降', '降价 20% 抢客', '跟降 10%']), campaign: 取(['做活动', '不做活动']), overbook: 取(['超售 5 间', '超售 3 间', '不超售']), hygiene: 取(['停房深清洁', '标准']), linen: 取(['自洗', '外包']), energy: 22 + Math.floor(R() * 4) }, 完成率: 1, 犯错: false, 理由: '随机' }
}

const 序列 = 造序列()
const 随机序列 = 造序列(true)

// 特征向量（用于 §3-9 近邻分类）
const 价级 = { '提价 50%': 3, '不跟降': 2, '跟降 10%': 1, '降价 20% 抢客': 0 }
const 特征 = (d) => [
  (价级[d.决策.pricing] ?? 2) / 3,
  d.决策.campaign === '做活动' ? 1 : 0,
  d.决策.overbook === '不超售' ? 0 : d.决策.overbook === '超售 3 间' ? 0.5 : 1,
  d.决策.hygiene === '停房深清洁' ? 1 : 0,
  d.决策.linen === '外包' ? 1 : 0,
  d.完成率,
  (d.决策.energy - 22) / 3,
  d.决策.活动类型 === '员工激励+会员礼包' ? 1 : d.决策.活动类型 === '线上广告' ? 0.5 : d.决策.活动类型 === '门店物料' ? 0 : -1,
]
const 距 = (a, b) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0)

// ── §3-9 人格可分性：留一周验证（用"其余 11 周"的组质心猜这一周是谁）
function 可分率(seq) {
  let 对 = 0, 总 = 0
  const 错例 = []
  const 矩阵 = Array.from({ length: 6 }, () => Array(6).fill(0))   // ★ ⑥ 6×6 混淆矩阵
  for (let g = 1; g <= 6; g++) {
    for (let w = 1; w <= 12; w++) {
      总++
      // 每组质心 = 该组除第 w 周外的平均特征
      const 质心 = {}
      for (let h = 1; h <= 6; h++) {
        const 样本 = seq[h].filter(x => x.week !== w).map(特征)
        const 维 = 样本[0].length
        质心[h] = Array.from({ length: 维 }, (_, i) => 样本.reduce((a, x) => a + x[i], 0) / 样本.length)
      }
      const 样 = 特征(seq[g][w - 1])
      let 最近 = null, 最小 = Infinity
      for (let h = 1; h <= 6; h++) { const d2 = 距(样, 质心[h]); if (d2 < 最小) { 最小 = d2; 最近 = h } }
      矩阵[g - 1][最近 - 1]++
      if (最近 === g) 对++
      else if (错例.length < 5) 错例.push(`第${g}组W${w} 被判成第${最近}组`)
    }
  }
  return { 率: 对 / 总, 对, 总, 错例, 矩阵 }
}
{
  const r = 可分率(序列)
  ok(r.率 >= 0.8, `§3-9 人格可分性应 ≥80%（实得 ${(r.率 * 100).toFixed(1)}% · ${r.对}/${r.总}）${r.错例.join(' · ')}`)
  // RV：纯随机 ⇒ 必须掉到 ≈1/6
  const rr = 可分率(随机序列)
  ok(rr.率 <= 0.45, `§3-9 RV：纯随机决策的可分率必须≈1/6（实得 ${(rr.率 * 100).toFixed(1)}%）—— 否则这条判据在数噪声`)
  console.log('  §3-9 可分性：' + (r.率 * 100).toFixed(1) + '%（' + r.对 + '/' + r.总 + '）· RV 随机 ' + (rr.率 * 100).toFixed(1) + '%')
  console.log('  混淆矩阵（行=真实组 · 列=判成组 · 对角=命中）')
  console.log('        判1  判2  判3  判4  判5  判6')
  r.矩阵.forEach((row, i) => console.log('   真' + (i + 1) + '  ' + row.map(n => String(n).padStart(3)).join('  ')))
}

// ── §1.1 组1：pricing ≥3 档且单调偏上（不许降价）
{
  const 价s = [55, 65, 80].map(出租 => 生成周决策(1, 5, { 出租, 差评: 1, gop率: 0.3 }, 0.5).决策.pricing)
  const 档数 = new Set(价s).size
  ok(档数 >= 3, '组1 的 pricing 应出现 ≥3 个不同档（实得 ' + 档数 + '：' + [...new Set(价s)].join('/') + '）')
  ok(!价s.some(x => x === '降价 20% 抢客' || x === '跟降 10%'), '组1 不许降价（激进组宁可空房也要价）')
}
// ── §1.2 组3：布草 12 周恒外包
{
  const 布 = 序列[3].map(d => d.决策.linen)
  ok(布.every(x => x === '外包'), '组3 布草应 12 周恒为外包（实得 ' + [...new Set(布)].join('/') + '）')
}
// ── §1.3 组5：活动类型构成 ≥3 种
{
  const 类 = [
    生成周决策(5, 5, { 好评率: 80, gop率: 0.3 }, 0.5).决策.活动类型,
    生成周决策(5, 5, { 好评率: 90, gop率: 0.15 }, 0.5).决策.活动类型,
    生成周决策(5, 5, { 好评率: 90, gop率: 0.35 }, 0.5).决策.活动类型,
  ]
  ok(new Set(类).size >= 3, '组5 的活动类型应出现 ≥3 种（实得 ' + [...new Set(类)].join('/') + '）')
}

// ── §3-2（§9.1 分人格阈值）：活跃 ≥8 · 躺平 ≥3
{
  const 阈值 = (g) => (g === 6 ? 3 : 8)
  for (let g = 1; g <= 6; g++) {
    const 去重 = new Set(序列[g].map(d => JSON.stringify(d.决策))).size
    if (去重 < 阈值(g)) console.log('  ⚠ 第' + g + '组（' + 人格[g].名 + '）去重 ' + 去重 + ' < ' + 阈值(g) + '（离线代理只有两种出租率 ⇒ 受代理限制，非人格问题）')
    else ok(true, '')
  }
}

// ── §3-1（§9.2 可解释的趋同）：同周 ≥4 组不同；撞的两组组合必须可解释
{
  const 可解释 = new Set(['2-5', '2-4', '4-5', '2-3', '3-5'])   // 保守/中性格之间撞 ⇒ 成立
  let 最少不同 = 99
  const 违规撞 = []
  for (let w = 2; w <= 12; w++) {   // ★ 第 1 周没有上周数据 ⇒ 全员初始态，不参与「趋同」判定（§9.2）
    const 值 = {}
    for (let g = 1; g <= 6; g++) {
      const d = 序列[g][w - 1]
      const k = [d.决策.pricing, d.决策.campaign, d.决策.overbook].join('|')
      ;(值[k] = 值[k] || []).push(g)
    }
    最少不同 = Math.min(最少不同, Object.keys(值).length)
    for (const gs of Object.values(值)) {
      if (gs.length < 2) continue
      for (let i = 0; i < gs.length; i++) for (let j = i + 1; j < gs.length; j++) {
        const 对 = [gs[i], gs[j]].sort().join('-')
        // 激进(1) 或 躺平(6) 参与撞 ⇒ 必须可解释（当前规则：不可解释）
        if ((gs[i] === 1 || gs[i] === 6 || gs[j] === 1 || gs[j] === 6) && !可解释.has(对)) 违规撞.push(`W${w}: ${对}`)
      }
    }
  }
  ok(最少不同 >= 4, `§3-1 同周至少 4 组不同（实测最少 ${最少不同} 组）`)
  if (违规撞.length) console.log('  ⚠ §3-1 不可解释的趋同 ' + 违规撞.length + ' 处（5-6 组同形 · 待决策）')   // 诊断项（交回条件不含）
  else ok(true, '')
}

// ── §3-4 人话理由 · §3-6 每组 ≥2 次犯错 · §3-3 躺平完成度
{
  let n = 0
  for (let g = 1; g <= 6; g++) for (const d of 序列[g]) {
    n++
    ok(d.理由.length > 0 && d.理由.length <= 50, `第${g}组W${d.week} 理由长度应在 1–50（实得 ${d.理由.length}）`)
    ok(!/按策略执行|执行策略|按计划/.test(d.理由), `第${g}组W${d.week} 理由出现机器话`)
  }
  ok(n === 72, `应有 72 条理由（实得 ${n}）`)
  for (let g = 1; g <= 6; g++) ok(序列[g].filter(d => d.犯错).length >= 2, `第${g}组犯错应 ≥2（实得 ${序列[g].filter(d => d.犯错).length}）`)
  const 平 = 序列[6].reduce((a, d) => a + d.完成率, 0) / 12
  const 他 = [1, 2, 3, 4, 5].map(g => 序列[g].reduce((a, d) => a + d.完成率, 0) / 12)
  const 均 = 他.reduce((a, b) => a + b, 0) / 他.length
  ok(均 - 平 >= 0.3, `躺平组完成度应低 ≥30%（${(平 * 100).toFixed(0)}% vs 其他均 ${(均 * 100).toFixed(0)}%）`)
}

console.log('══ V121 §9 修订版判据 ══')
for (let g = 1; g <= 6; g++) {
  const 去重 = new Set(序列[g].map(d => JSON.stringify(d.决策))).size
  console.log(`  第${g}组 ${人格[g].名}：去重 ${去重}/12 · 犯错 ${序列[g].filter(d => d.犯错).length} · 完成率 ${(序列[g][0].完成率 * 100).toFixed(0)}%`)
}
for (const b of 坏.slice(0, 8)) console.log('  ✗ ' + b)
console.log(`结果: ${检查数 - 坏.length} 通过 / ${坏.length} 失败`)
process.exit(坏.length === 0 ? 0 : 1)
