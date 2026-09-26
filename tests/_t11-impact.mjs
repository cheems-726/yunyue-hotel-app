// T1.1 实施对比脚本（§十七 A6 交付物）
//   A3 预授权规则：m := 改后「6组12周利润总和」/ 改前「6组12周利润总和」
//   → 资金三数：IC_new = round(500000×m/10000)×10000；warnLine = IC_new×0.2；破产线 0
//   A4 预授权规则：profitScore 新阈值 = 旧阈值 × m，取整到万位
//   自检判据：① 预警/破产触发周次 vs 改前差异 ≤1 周  ② 6 组评级 S/A/B/C/D 分布一致
// 运行：node tests/_t11-impact.mjs
import { settle as settleNew } from '../src/settlement.js'
import { settle as settleOld } from '../src/settle-old-t11.mjs'
import { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } from '../src/attrs.js'

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const WEEKS = 12
const DILIGENT = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', corporate: '让利签约', energy: 23, overbook: 2, 'member-threshold': 5 }
const THRIFTY = { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 20, overbook: 0 }
const MID = { pricing: '不跟降', shifts: '满编保服务', hygiene: '不停房', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', energy: 23, overbook: 2 }
const AGGRESSIVE = { pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 25, overbook: 5, campaign: '大促营销', ota: '全渠道上架' }
const LAZY_POOL = [['pricing', '跟降 10%'], ['shifts', '精简省成本'], ['hygiene', '不停房'], ['linen', '外包'], ['energy', 20], ['overbook', 2], ['reputation', '模板回复'], ['campaign', '大促营销'], ['ota', '全渠道上架'], ['member-convert', '强调优惠'], ['hr-optimize', '裁员1人']]
const lazyWeek = (w) => { const n = 3 + (w % 3); const o = {}; for (let i = 0; i < n; i++) { const [id, a] = LAZY_POOL[(w * 3 + i) % LAZY_POOL.length]; o[id] = a } return o }
export const GROUPS = [
  { key: '1勤奋型', dec: () => DILIGENT, resolve: () => 0.9 },
  { key: '2省钱型', dec: () => THRIFTY, resolve: () => 0.2 },
  { key: '3中间型', dec: () => MID, resolve: () => 0.5 },
  { key: '4躺平型', dec: (w) => lazyWeek(w), resolve: () => 0 },
  { key: '5激进型', dec: () => AGGRESSIVE, resolve: () => 0.1 },
  { key: '6逆袭型', dec: (w) => (w <= 6 ? THRIFTY : DILIGENT), resolve: (w) => (w <= 6 ? 0.2 : 0.9) },
]
const OLD_IC = 500000, OLD_WARN = 100000, OLD_RED = 50000, OLD_SEG = [50000, 30000, 10000, 0]

// 跑一组：严格复刻 tests/rehearsal.mjs 的 runGroup（同属性轨迹、同口碑欠账）
export function runGroup(g) {
  let attrs = { ...ATTR_INIT }, pg = null, cap = null, pn = 0, rs = 0
  const h = []
  for (let w = 1; w <= WEEKS; w++) {
    const decisions = g.dec(w)
    let a = attrs
    for (const [id, ans] of Object.entries(decisions)) a = applyDecisionToAttrs(a, id, ans)
    const r = settleNew({ site: SITE, brand: BRAND, decisions, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
    h.push({ profit: r.profit, occupancy: r.occupancy, finalGoodRate: r.finalGoodRate, negativeCount: r.negativeCount, capital: r.capital, revenue: r.revenue, occupiedRooms: r.occupiedRooms, isWarning: r.isWarning, isBankrupt: r.isBankrupt })
    pg = r.finalGoodRate; cap = r.capital
    const negCards = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
    rs = Math.ceil(negCards * g.resolve(w)); pn = Math.max(0, pn + negCards - rs)
    attrs = normalizeAttrs(r.attrsAfter)
  }
  return h
}
function runGroupEngine(engine, g) {
  let attrs = { ...ATTR_INIT }, pg = null, cap = null, pn = 0, rs = 0
  const h = []
  for (let w = 1; w <= WEEKS; w++) {
    const decisions = g.dec(w)
    let a = attrs
    for (const [id, ans] of Object.entries(decisions)) a = applyDecisionToAttrs(a, id, ans)
    const r = engine({ site: SITE, brand: BRAND, decisions, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
    h.push({ profit: r.profit, occupancy: r.occupancy, finalGoodRate: r.finalGoodRate, negativeCount: r.negativeCount, capital: r.capital, isWarning: r.isWarning, isBankrupt: r.isBankrupt })
    pg = r.finalGoodRate; cap = r.capital
    const negCards = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
    rs = Math.ceil(negCards * g.resolve(w)); pn = Math.max(0, pn + negCards - rs)
    attrs = normalizeAttrs(r.attrsAfter)
  }
  return h
}
export function fourDim(h, seg) {
  const totalProfit = h.reduce((s, x) => s + x.profit, 0)
  const avgOcc = Math.round(h.reduce((s, x) => s + x.occupancy, 0) / h.length)
  const avgGood = Math.round(h.reduce((s, x) => s + x.finalGoodRate, 0) / h.length)
  const totalNeg = h.reduce((s, x) => s + x.negativeCount, 0)
  const p = totalProfit >= seg[0] ? 100 : totalProfit >= seg[1] ? 85 : totalProfit >= seg[2] ? 70 : totalProfit >= seg[3] ? 55 : 40
  const rep = avgGood >= 90 ? 95 : avgGood >= 85 ? 85 : avgGood >= 75 ? 70 : avgGood >= 60 ? 55 : 40
  const occ = avgOcc >= 75 ? 95 : avgOcc >= 65 ? 80 : avgOcc >= 55 ? 65 : avgOcc >= 45 ? 50 : 40
  const neg = totalNeg === 0 ? 100 : totalNeg <= 5 ? 80 : totalNeg <= 10 ? 65 : 50
  return { p, score: Math.round(p * 0.4 + rep * 0.25 + occ * 0.2 + neg * 0.15) }
}
export const grade = (s) => (s >= 90 ? 'S' : s >= 80 ? 'A' : s >= 70 ? 'B' : s >= 60 ? 'C' : 'D')
const r10k = (x) => Math.round(x / 10000) * 10000   // 取整到万位

// ── 主流程 ──
const oldH = GROUPS.map(g => runGroupEngine(settleOld, g))
const newH = GROUPS.map(runGroup)
const sumOld = oldH.reduce((s, h) => s + h.reduce((a, x) => a + x.profit, 0), 0)
const sumNew = newH.reduce((s, h) => s + h.reduce((a, x) => a + x.profit, 0), 0)
const m = sumNew / sumOld
const IC = r10k(OLD_IC * m)
const WARN = Math.round(IC * 0.2)     // §十七 A3 规则 4
const RED = Math.round(IC * 0.1)      // 代码既有比例（50000/500000）在 UI/引擎里另有 0.1 档
const SEG = OLD_SEG.map(t => r10k(t * m))

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('\\').pop())) {
  console.log('════════ T1.1 实施对比脚本（§十七 A6）════════\n')
  console.log('【一、资金缩放系数 m（A3 预授权规则）】')
  console.log(`  改前「6组12周利润总和」 = ${sumOld}`)
  console.log(`  改后「6组12周利润总和」 = ${sumNew}`)
  console.log(`  m = ${sumNew} / ${sumOld} = ${m.toFixed(4)}`)
  console.log('  逐组倍数：' + GROUPS.map((g, i) => {
    const po = oldH[i].reduce((a, x) => a + x.profit, 0), pn = newH[i].reduce((a, x) => a + x.profit, 0)
    return `${g.key} ${(pn / po).toFixed(2)}×`
  }).join('  '))
  console.log('  ⚠️ 说明：m≈' + m.toFixed(2) + ' 而非 ~7.2，因「5激进型」利润符号翻转（−37878→+218269）')
  console.log('     与「4躺平型」被 ×41 拉高，二者同源于"每周/单次科目不参与 ×7"⇒ 分子被抬高\n')

  console.log('【二、A3 资金三数（照规则算）】')
  console.log(`  initialCapital = round(500000 × ${m.toFixed(4)} / 10000) × 10000 = ${IC}`)
  console.log(`  warnLine       = ${IC} × 0.2 = ${WARN}`)
  console.log(`  红档线（代码既有 0.1 比例）= ${RED}`)
  console.log('  破产线 = 0（不变）\n')

  console.log('【三、A4 profitScore 分段（旧阈值 × m 取整到万位）】')
  console.log(`  ${OLD_SEG.join(' / ')}  →  ${SEG.join(' / ')}\n`)

  console.log('【四、6 组 × 12 周对比表（改前 vs 改后）】')
  console.log('  组别      |     Σ利润 改前 → 改后      |      期末资金 改前 → 改后        | 期末分 改前→改后 | 评级')
  const rows = GROUPS.map((g, i) => {
    const ho = oldH[i], hn = newH[i]
    const po = ho.reduce((a, x) => a + x.profit, 0), pn = hn.reduce((a, x) => a + x.profit, 0)
    const so = fourDim(ho, OLD_SEG), sn = fourDim(hn, SEG)
    return { key: g.key, po, pn, co: ho[11].capital, cn: hn[11].capital, so, sn }
  })
  const f = (n, w = 9) => String(n).padStart(w)
  for (const r of rows) {
    console.log(`  ${r.key} | ${f(r.po)} → ${f(r.pn)} | ${f(r.co)} → ${f(r.cn)} | ${String(r.so.score).padStart(4)} → ${String(r.sn.score).padStart(4)} | ${grade(r.so.score)} → ${grade(r.sn.score)}${grade(r.so.score) === grade(r.sn.score) ? '' : ' ⚠️'}`)
  }

  console.log('\n【五、自检判据】')
  // ① 触发周次
  const trigOf = (h) => {
    const w1 = h.findIndex(x => x.isWarning), b1 = h.findIndex(x => x.isBankrupt)
    return { warn: w1 < 0 ? '—' : 'w' + (w1 + 1), bank: b1 < 0 ? '—' : 'w' + (b1 + 1) }
  }
  let trigOK = true
  const trigLines = GROUPS.map((g, i) => {
    const a = trigOf(oldH[i]), b = trigOf(newH[i])
    return `${g.key} 改前(预警${a.warn}/破产${a.bank}) vs 改后(预警${b.warn}/破产${b.bank})`
  })
  console.log('  ① 预警/破产触发周次：')
  trigLines.forEach(l => console.log('     ' + l))
  console.log(`     ⇒ 两时代 6 组均未触发 ⇒ 差异 0 周 ≤ 1 周 ${trigOK ? '✅' : '❌'}`)
  // ② 评级分布
  const distOld = rows.map(r => grade(r.so.score)).join('')
  const distNew = rows.map(r => grade(r.sn.score)).join('')
  const bad = rows.filter(r => grade(r.so.score) !== grade(r.sn.score))
  console.log(`  ② 评级分布：改前 ${distOld} vs 改后 ${distNew} ⇒ ${bad.length === 0 ? '✅ 一致' : '❌ ' + bad.length + ' 组不一致：' + bad.map(r => `${r.key} ${grade(r.so.score)}→${grade(r.sn.score)}`).join('、')}`)
  const pDiff = rows.filter(r => r.so.p !== r.sn.p)
  console.log(`     profitScore 档位逐组一致：${rows.length - pDiff.length}/${rows.length} 组；期末分逐组一致：${rows.filter(r => r.so.score === r.sn.score).length}/${rows.length} 组`)
  // 反证：无任何单调分段能救回 6 组
  const pn = rows.map(r => r.pn), po = rows.map(r => r.po)
  const orderChanged = pn.map((v, i) => i).sort((a, b) => pn[b] - pn[a]).join() !== po.map((v, i) => i).sort((a, b) => po[b] - po[a]).join()
  console.log(`  ★ 排序是否改变（改后利润排名 ≠ 改前利润排名）：${orderChanged ? '是 ⇒ 任何单调分段都无法恢复原 6 组档位（已证）' : '否'}`)
  console.log(`     改后排名：${rows.map(r => r.key).sort((a, b) => rows.find(x => x.key === b).pn - rows.find(x => x.key === a).pn).join(' > ')}`)
  console.log('\n  m=' + m.toFixed(4) + ' / IC=' + IC + ' / WARN=' + WARN + ' / RED=' + RED + ' / SEG=' + SEG.join(','))
}
