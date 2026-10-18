import { 汇总未填 } from './attribution.mjs'   // ★ V115-② B-11：归因「谁填了」的单源
// V113-2.6 · 教师端"诊断组合"（**不做排名** · 只给可执行的判断）
//
// ── 为什么不做排名 ─────────────────────────────────────────────────
//   Hanus & Fox (2015)：带排行榜的班，内在动机/满意度/期末成绩都更低。⇒ 这里只输出**诊断**，
//   不输出名次、不按分数排序（输出顺序 = 组号，与表现无关）。
//
// ── 三条诊断（来自 V113 §3-2.6 · 都是"组合矛盾"，不是单指标高低）──────────
//   ① RevPAR 不低，但 GOP 率偏低  ⇒ 卖得出、赚得薄（价格/成本结构问题）
//   ② 出租率高，但 ADR 低        ⇒ 靠低价换满房（RevPAR 可能并不高）
//   ③ 成本结构异常（某科目占比显著高于同班中位）⇒ 指出科目名与倍数
//
// ── 输入 ───────────────────────────────────────────────────────────
//   groups = [{ 名, 行 }]，行 = 该组最新一周的结算结果（history 末行）。
//   只读该行已有字段；缺成本明细 ⇒ ③ 跳过（不猜）。

const 中位 = (arr) => {
  const a = arr.filter(Number.isFinite).slice().sort((x, y) => x - y)
  if (!a.length) return null
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}

export function 诊断组合(groups = []) {
  const 组s = (Array.isArray(groups) ? groups : []).map(g => {
    const r = (g && g.行) || {}
    const revenue = Number(r.revenue)
    const rooms = Number(r.rooms)
    const occ = Number(r.occupiedRooms)
    const vrp = (revenue > 0 && rooms > 0) ? revenue / rooms / 7 : null
    const adr = (occ > 0) ? revenue / (occ * 7) : null
    const occRate = (rooms > 0 && occ >= 0) ? occ / rooms : null
    const gopRate = Number(r.gop) / revenue
    return { 名: (g && g.名) || '', 行: r, vrp, adr, occRate, gopRate: Number.isFinite(gopRate) ? gopRate : null }
  })
  const 中vrp = 中位(组s.map(x => x.vrp))
  const 中adr = 中位(组s.map(x => x.adr))
  const 科目占比 = (x) => {
    const w = x.行 && x.行.weeklyExpenses
    if (!w || typeof w !== 'object') return null
    const 一 = (Number(w['开业一次性费用']) || 0) + (Number(w['保证金退还']) || 0)
    const 经营 = Number(x.行.totalCost) - 一
    if (!(经营 > 0)) return null
    const out = {}
    for (const [k, v] of Object.entries(w)) {
      const n = Number(v)
      if (Number.isFinite(n) && n > 0 && k !== '开业一次性费用' && k !== '保证金退还') out[k] = n / 经营
    }
    return out
  }
  const 占s = 组s.map(科目占比)
  const 中占 = {}
  const 科目集 = new Set(占s.filter(Boolean).flatMap(o => Object.keys(o)))
  for (const k of 科目集) 中占[k] = 中位(占s.map(o => (o ? o[k] : null)))

  return 组s.map((x, i) => {
    const 诊断 = []
    // ★ 用 Number.isFinite 做有限性守卫（nullGuardPattern：被守卫值流入算术必须证明有限）
    if (Number.isFinite(x.vrp) && Number.isFinite(中vrp) && x.vrp >= 中vrp * 1.1 && Number.isFinite(x.gopRate) && x.gopRate < 0.25) {
      诊断.push({ k: 'revpar-高-gop-低', 文本: `RevPAR ${Math.round(x.vrp)} 不低，但 GOP 率只有 ${(x.gopRate * 100).toFixed(1)}% —— 卖得出、赚得薄：先看营销/OTA 佣金与人力` })
    }
    if (Number.isFinite(x.occRate) && x.occRate >= 0.75 && Number.isFinite(x.adr) && Number.isFinite(中adr) && x.adr <= 中adr * 0.85) {
      诊断.push({ k: 'occ-高-adr-低', 文本: `出租率 ${(x.occRate * 100).toFixed(0)}% 但 ADR ${Math.round(x.adr)} 低于同班中位 —— 靠低价换满房，RevPAR 未必划算` })
    }
    if (占s[i]) {
      for (const [k, v] of Object.entries(占s[i])) {
        const m = 中占[k]
        if (Number.isFinite(m) && m > 0 && v > m * 1.5) {
          诊断.push({ k: '成本异常:' + k, 文本: `成本结构：${k} 占经营成本 ${(v * 100).toFixed(1)}%，是同班中位（${(m * 100).toFixed(1)}%）的 ${(v / m).toFixed(1)} 倍` })
        }
      }
    }
    return { 名: x.名, 诊断 }
  })   // ★ 特意**不排序**（输出顺序 = 输入顺序 = 组号）—— 不做排名
}

/** 教师端标红：本周归因未填的组（decision_id = 归因-W<week>），输入 = fetchDecisionLogs 的行 */
export function 归因未填的组(groups = [], logs = [], week) {
  // ★ V115-② B-11：统一到 attribution.汇总未填（同一份「谁填了」的口径，少一套实现）
  const { 已填 } = 汇总未填(logs, week)
  const 已 = new Set(已填)
  return (groups || []).map(g => ({ 名: g.名, groupKey: g.groupKey || g.名, 已填: 已.has(String(g.groupKey || g.名)) })).filter(x => !x.已填)
}
