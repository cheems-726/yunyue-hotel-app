// §19.1（单元 1·B4）· 周内分段定价 —— E3「引擎级分段」的落地
//
// ── 为什么需要本模块 ──────────────────────────────────────────────
//   `settle()` 按【整周一套决策】结算；周中改价（第 4 天调价）目前只有【显示级估算】
//   （`weeklyAuto.revenueSegments`，必须标"估算"）。本模块把"按天生效的决策"喂进引擎，
//   使**分段收入由引擎实算**，从而撤掉"估算"标注。
//
// ── ★★ 唯一红线（违反即水位线必破）────────────────────────────────
//   **不许写"每天独立算再相加"**：
//   现有拆天用 `splitExact` 做【整数分摊 + 余数补偿】（余数按小数余量排序、平局按索引）。
//   若每天各自取整再相加，余数补偿的归属与 `splitExact` 不同 ⇒ 某些天差 ±1 ⇒
//   长跑 / 选址矩阵 / 全部锚点一起漂。⇒ 本模块的合并**必须复用同一套 `splitExact`**。
//
// ── 设计（§18 报告 §3.3 定稿 · §19.1 确认）────────────────────────
//   1. 把 7 天按"决策集相同"聚成**连续段**
//   2. **1 段（周内无改动）⇒ 完全走既有路径** ⇒ 逐字节水位线由构造保证（不经过任何新代码）
//   3. ≥2 段 ⇒ 逐段用该段决策跑周模型（段间链式传递 属性/口碑/资金）→ 按 `dayWeights` 取份额
//      → 用**同一套 splitExact** 把每段金额精确摊到它的那些天 ⇒ Σ分段 === 周值（不重不漏）
//
// ── 随机流（T1 安全）──────────────────────────────────────────────
//   `settle()` 内部 `rand = seededRandom(week * 100 + 7)` —— **按周播种、每次调用自包含**
//   ⇒ 段内多次调用不共享状态、不改随机流位置；`dayEngine` 另用 `guestsRng` 独立流。
//   ⇒ 本模块不引入任何新的随机源。
//
// ── 「内核」说明（勘察结论，写下来免得下一个人再拆一遍）──────────────
//   §19.1 要求"把 settle() 拆出可复用内核：能用任意决策集跑一遍周模型"。
//   ★ **实测结论：这个内核已经存在** —— `settle({...})` 本身就接收 `decisions` 并按周计算，
//     且逐次调用确定（三次同输入逐字节相同）。⇒ **不需要重构那 400+ 行函数**（重构风险远大于收益）。
//     本模块只做"怎么分段 + 怎么合并"，不碰 settle 内部。
import { settle } from './settlement.js'
import { dayWeights, DAYS_PER_WEEK } from './dayEngine.js'

export const 分段版本 = 1

// 决策集相等（键序无关；只比可序列化的业务键）
//   ★ §21.1-A-1：本函数【导出】供 serverTick 的 base 交叉核对复用（口径单源，不许各写一份）
export function 同决策集(a, b) {
  const 规整 = (o) => {
    const src = (o && typeof o === 'object') ? o : {}
    return Object.keys(src).sort().map(k => k + '=' + JSON.stringify(src[k])).join('|')
  }
  return 规整(a) === 规整(b)
}

/** 把 7 天决策聚成连续段（缺省天用 baseDecisions 兜底） */
export function segmentsOf(decisionsByDay, baseDecisions = {}) {
  const days = []
  for (let i = 0; i < DAYS_PER_WEEK; i++) days.push(decisionsByDay?.[i] ?? baseDecisions)
  const segs = []
  for (let i = 0; i < DAYS_PER_WEEK; i++) {
    const last = segs[segs.length - 1]
    if (last && 同决策集(last.decisions, days[i])) last.to = i + 1
    else segs.push({ from: i + 1, to: i + 1, decisions: days[i] })
  }
  return segs
}

/** 每段份额 = 段内 `dayWeights(seed=week)` 权重和 ÷ 总权重（与拆天同一套权重） */
export function sharesOf(segs, week) {
  const w = dayWeights(week)
  const total = w.reduce((a, b) => a + b, 0) || 1
  return segs.map(s => {
    let sum = 0
    for (let d = s.from; d <= s.to; d++) sum += w[d - 1]
    return sum / total
  })
}

// 与 dayEngine.NUM_KEYS 对齐（日快照的 7 个数值键）
const 快照键 = ['revenue', 'cost', 'checkins', 'checkouts', 'occupied', 'reviews', 'cashDelta']
// 周值里要与"日快照"逐项对齐的业务键（Σ7天 === 周值）
const 周值映射 = {
  revenue: 'revenue', cost: 'totalCost', occupied: 'occupiedRooms',
  reviews: 'reviewCount', cashDelta: 'profit',
}

// 精确整数分摊（与 dayEngine.splitExact 同一算法的本地副本 —— 口径一致，但**不 import**：
//   dayEngine 的 splitExact 已标"临时实现·二期替换"，直接依赖它会把本模块绑在待删代码上）
function 整数分摊(total, weights) {
  const t = Math.round(Number(total) || 0)
  const ws = (weights && weights.length) ? weights : [1]
  const sumW = ws.reduce((a, b) => a + b, 0) || 1
  const raw = ws.map(w => (t * w) / sumW)
  const out = raw.map(v => Math.floor(v))
  let rest = t - out.reduce((a, b) => a + b, 0)
  const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => (b[0] - a[0]) || (a[1] - b[1]))
  for (let k = 0; k < rest; k++) out[order[k % order.length][1]] += 1
  return out
}

/**
 * 分段结算（本模块唯一入口）
 * @param {object} 输入 = settle 的全部入参 + `decisionsByDay`（长度 7 的决策集数组，可缺省）
 * @returns settle 同形状结果；≥2 段时额外带 `segments`（可回算）与 `分段版本`
 */
export function settleWeekSegmented(输入 = {}) {
  const { decisionsByDay, decisions, ...rest } = 输入
  let segs = segmentsOf(decisionsByDay, decisions || {})
  // ★★ §33-V8（2026-10-03 · 按日程触发）：注入事件可带【生效日】（周内第 D 天 · 2–7）。
  //   有这种事件时：① 在其生效日追加分段边界（哪怕本周没有决策改动）② 各段只带【对该段有效】的事件
  //   （无生效日 = 整周有效；生效日 <= 段末 ⇒ 该段有效 —— 前 3 天不带、第 4 天起带 = "按日程"）。
  //   ★ 零变化水位线：无事件或全部事件无生效日 ⇒ 不加分段 ⇒ 走既有路径（逐字节不变）。
  const 全部事件 = Array.isArray(rest.injectedEvents) ? rest.injectedEvents : []
  const 事件日s = [...new Set(全部事件.map(e => Number(e && e.生效日)).filter(d => Number.isFinite(d) && d >= 2 && d <= 7))].sort((a, b) => a - b)
  if (事件日s.length > 0) {
    const 边界 = new Set(segs.map(sg => sg.from))
    for (const d of 事件日s) 边界.add(d)
    const 周一 = Math.min(...segs.map(sg => sg.from)), 周日 = Math.max(...segs.map(sg => sg.to))
    const 新边界 = [...边界].sort((a, b) => a - b)
    if (新边界[0] !== 周一) 新边界.unshift(周一)
    segs = []
    for (let i = 0; i < 新边界.length; i++) {
      const from = 新边界[i]
      const to = (i + 1 < 新边界.length) ? 新边界[i + 1] - 1 : 周日
      if (from > to) continue
      segs.push({ from, to, decisions: decisions || {} })   // 无决策改动 ⇒ 各段同一决策集
    }
  }
  // 各段有效事件：无生效日 = 整周；生效日 <= 段末 ⇒ 该段生效（生效日在段后的事件对该段不可见）
  const 段事件 = (s) => 全部事件.filter(e => !Number.isFinite(Number(e && e.生效日)) || Number(e.生效日) <= s.to)

  // ★★ 水位线：周内无改动 ⇒ 完全走既有路径 —— **原样返回 settle 的结果，一个键都不加**
  //   为什么连 `segments` 都不加：这样"逐字节相等"可以被**最严格地证明**
  //   （`JSON.stringify(分段) === JSON.stringify(老路径)`），而不是"业务字段相等、多了几个键"。
  if (segs.length === 1 && 事件日s.length === 0) {
    return settle({ ...rest, decisions: segs[0].decisions })   // ★ 零变化水位线：无按日事件且无决策改动 ⇒ 原样（逐字节）
  }
  // 单段但有按日事件（或事件追加了分段）⇒ 落到下方多段路径（各段按 生效日 过滤事件）

  // ≥2 段：逐段定价
  // ★★ 关键（本批实测踩到并改正）：**各段必须用【同一入口状态】定价，不许链式传状态**。
  //   原因：`settle()` 是【周级】模型 —— 它每次都会推进一周的属性衰减 / 口碑累积 / 负评欠账。
  //   若段间链式（段2 用段1 的 attrsAfter/capital），一周就经历了**多次周级演化** ⇒ 分段周值被系统性压低
  //   （实测：链式 77318，而两种全周值分别是 102340 / 129472 —— 明显不在两者之间，是错的）。
  //   ⇒ 正确形态：各段都从【周初状态】定价（= 该决策跑一整周会得到多少），再按天数份额混合；
  //     而**周末状态只前进一次**（取末段用周初状态算出的 attrsAfter —— 末段决策正是周末仍生效的决策）。
  //   ★ 这与 §19.1 的红线同源：都不许"把一周的演化做多遍"。
  const week = Number(rest.week) || 1
  const w = dayWeights(week)
  const 入口状态 = { attrs: rest.attrs, prevGoodRate: rest.prevGoodRate, prevCapital: rest.prevCapital }
  const 段 = []
  for (const s of segs) {
    const r = settle({ ...rest, injectedEvents: 段事件(s), decisions: s.decisions, ...入口状态 })   // ★ §33-V8：各段只带对该段有效的事件
    段.push({ s, r, 天: s.to - s.from + 1 })
  }
  const shares = sharesOf(segs, week)

  // ── 金额合并：各段"段值 × 份额" → 总和取整 → 用同一套整数分摊把总和精确分回各段 ──
  //   ⇒ Σ分段 === 周值（不重不漏）★ 红线要求的正是"用同一套口径"
  const 周值 = {}
  const 分段值 = []
  for (const k of ['revenue', 'totalCost', 'profit', 'gop', 'netProfit', 'deptCost', 'rentCost', 'marketingCost', 'otaCommission', 'variableCost', 'fixedCost', 'overbookCompensation', 'renovationCost', 'eventFine']) {
    const raw = 段.map((x, i) => (Number(x.r[k]) || 0) * shares[i])
    const 总 = Math.round(raw.reduce((a, b) => a + b, 0))
    周值[k] = 总
    分段值.push({ k, 段: 整数分摊(总, raw) })
  }
  const 取 = (k) => 分段值.find(x => x.k === k).段

  // ── 日快照：每段的总值按该段内的 dayWeights 精确摊到它的那些天 ──
  //   ⇒ Σ7天 === 周值（逐项）且**每天反映它所在段**（不是平均摊）
  const dailySnapshots = []
  for (let i = 0; i < 段.length; i++) {
    const s = 段[i].s
    const 段内权重 = w.slice(s.from - 1, s.to)
    const 段明细 = {}
    for (const k of 快照键) {
      const 周键 = 周值映射[k]
      段明细[k] = 整数分摊(周值[周键], 段.map((x, j) => (Number(x.r[周键]) || 0) * shares[j]))[i]
    }
    const 天值 = {}
    for (const k of 快照键) 天值[k] = 整数分摊(段明细[k], 段内权重)
    for (let d = s.from; d <= s.to; d++) {
      dailySnapshots.push({
        dayIndex: d, revenue: 天值.revenue[d - s.from], cost: 天值.cost[d - s.from],
        checkins: 天值.checkins[d - s.from], checkouts: 天值.checkouts[d - s.from],
        occupied: 天值.occupied[d - s.from], reviews: 天值.reviews[d - s.from],
        cashDelta: 天值.cashDelta[d - s.from],
        price: Number(段[i].r.dailySnapshots?.[0]?.price) || null,
      })
    }
  }
  dailySnapshots.sort((a, b) => a.dayIndex - b.dayIndex)

  // ── 率值：按【段内天数】加权平均（率不能相加）──
  const 天数和 = 段.reduce((a, x) => a + x.天, 0) || DAYS_PER_WEEK
  const 加权率 = (k) => Math.round(段.reduce((a, x) => a + (Number(x.r[k]) || 0) * x.天, 0) / 天数和)
  const 末段 = 段[段.length - 1].r
  const 首段 = 段[0].r
  const 周利润 = 周值.profit
  const prevCapital = Number.isFinite(rest.prevCapital) ? rest.prevCapital : 首段.capital - 首段.profit

  const segments = 段.map((x, i) => ({
    from: x.s.from, to: x.s.to, 天: x.天, decisions: x.s.decisions,
    revenue: 取('revenue')[i], cost: 取('totalCost')[i], profit: 取('profit')[i],
    份额: shares[i],
  }))

  return {
    ...末段,                                    // 非货币字段（insights/events 等）以末段为底
    revenue: 周值.revenue,
    totalCost: 周值.totalCost,
    profit: 周利润,
    gop: 周值.gop,
    netProfit: 周值.netProfit,
    deptCost: 周值.deptCost,
    rentCost: 周值.rentCost,
    occupiedRooms: 段.reduce((a, x) => a + (Number(x.r.occupiedRooms) || 0), 0),
    reviewCount: 段.reduce((a, x) => a + (Number(x.r.reviewCount) || 0), 0),
    negativeCount: 段.reduce((a, x) => a + (Number(x.r.negativeCount) || 0), 0),
    occupancy: 加权率('occupancy'),
    finalGoodRate: 加权率('finalGoodRate'),
    capital: Math.round(prevCapital + 周利润),   // 守恒：资金变化 === 合并后的利润
    attrsAfter: 末段.attrsAfter,                  // 期末属性 = 末段算出的属性
    dailySnapshots,
    generatedReviews: 段.flatMap((x, i) => (x.r.generatedReviews || []).map((rv, j) => ({ ...rv, id: `w${week}-s${i}-${j}` }))),
    events: 段.flatMap(x => x.r.events || []),
    insights: 段.flatMap(x => x.r.insights || []),
    weeklyExpenses: { ...末段.weeklyExpenses, ...Object.fromEntries(分段值.filter(x => ['deptCost', 'rentCost', 'otaCommission'].includes(x.k)).map(x => [x.k, 周值[x.k]])) },
    分段版本,
    segments,
  }
}
