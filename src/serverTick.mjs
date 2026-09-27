// 服务端逐日推进（Wave 1 · W1-1）—— 纯逻辑，**复用同一份引擎**（D8）
//
// ── 定位 ────────────────────────────────────────────────────────
// D7 要的是"不打开客户端，服务端自己推进 1 天"。本文件是那段逻辑的【纯函数核心】：
//   · Edge Function 只做"读库 → 调这里的函数 → 写回结果"（不写任何业务逻辑）
//   · Node 测试直接 import 本文件做等效验证（W1-3）
//   · 计算【全部】经 src/engine/index.js —— 与浏览器端同一份源码，不重写（D8 硬约束）
//
// ── 与"周引擎"的关系（诚实说明）──────────────────────────────────
// 本引擎按【周】结算，日数据是周值的确定性分摊（Phase D/C2）。
// 因此"推进 1 天"= 定位该天所属的周；该周已算过就直接取它的日快照，没算过就先结算该周。
// ⇒ 服务端推进到第 D 天时，其【日快照 == 浏览器端同一周结算出的日快照】（逐字节，见 W1-3 断言）。
//   （二期把 splitExact 换成逐日独立计算后，本函数签名不变、内部改从"取分片"变"直接算"）
//
// ── 幂等（W1-2）─────────────────────────────────────────────────
// 幂等键 tickKey(classDay, groupKey)。同一天重复触发：若该周已在 history 里，直接返回既有结果、
// 不再结算（advanced=false）⇒ 结果逐字节相同。
import { settle, DAYS_PER_WEEK, buildDailyReport } from './engine/index.js'
import { dayToWeekDay } from './weeklyAuto.mjs'   // E2：周↔天换算唯一来源（本文件不再自己算）
export { DAYS_PER_WEEK }   // W1-5：进度口径需要它（周↔天换算），属 tick 的公开面
// W1-4：哈希链抽到独立模块（单一实现，避免 serverTick 与防作弊模块各写一份）
import { fnv1a, entryIdOf, chainHash } from './decisionLogIntegrity.mjs'
export { fnv1a, entryIdOf, chainHash }   // 兼容既有调用方（serverTick.test 直接从本文件取）

export const TICK_VERSION = 1

// ── FNV-1a / entryId / chainHash 见 ./decisionLogIntegrity.mjs（本文件上方已 import 并再导出）
//    原先这里有一份重复实现，W1-4 抽走后删除 —— 单一实现是防作弊的前提（两份实现会各自漂移）

// ── 越界校验（W1-4 ②：服务端范围检查）────────────────────────────
// 决策项的合法取值表（从 decisions.js 的 options 生成，见 tests 断言其与源码同源）
export const NUMERIC_BOUNDS = {
  energy: [18, 28],          // 空调温度
  overbook: [0, 8],          // 超额预订间数
  'member-threshold': [1, 10],
}

/**
 * 校验一批决策是否越界。
 * @returns {{ ok: boolean, violations: Array<{id:string, value:any, why:string}> }}
 */
export function validateDecisions(decisions, allowed = null) {
  const d = decisions && typeof decisions === 'object' ? decisions : {}
  const v = []
  for (const [id, val] of Object.entries(d)) {
    if (id.startsWith('__')) continue
    // ① 数值项区间
    if (NUMERIC_BOUNDS[id]) {
      const [lo, hi] = NUMERIC_BOUNDS[id]
      const n = Number(val)
      if (!Number.isFinite(n) || n < lo || n > hi) v.push({ id, value: val, why: `数值越界：应在 [${lo}, ${hi}]` })
      continue
    }
    // ② 选项项必须在允许集合内（allowed 由调用方给出；缺省只做类型检查）
    if (allowed && Array.isArray(allowed[id]) && allowed[id].length) {
      const okv = Array.isArray(val) ? val.every(x => allowed[id].includes(x)) : allowed[id].includes(val)
      if (!okv) v.push({ id, value: val, why: '取值不在允许选项内' })
    } else if (val !== null && val !== undefined && typeof val !== 'string' && !Array.isArray(val) && typeof val !== 'object') {
      v.push({ id, value: val, why: '取值类型异常' })
    }
  }
  return { ok: v.length === 0, violations: v }
}

// ── 业务数值合理性校验（W1-1「校验：数值合理性」）─────────────────
export function validateStateBounds(state) {
  const s = state || {}
  const v = []
  const last = Array.isArray(s.history) && s.history.length ? s.history[s.history.length - 1] : null
  if (last) {
    if (!(last.occupancy >= 0 && last.occupancy <= 100)) v.push(`occupancy 越界：${last.occupancy}`)
    if (Number.isFinite(last.finalGoodRate) && !(last.finalGoodRate >= 0 && last.finalGoodRate <= 100)) v.push(`好评率越界：${last.finalGoodRate}`)
    if (!Number.isFinite(last.profit)) v.push(`profit 非有限：${last.profit}`)
  }
  if (!Number.isFinite(s.capital)) v.push(`capital 非有限：${s.capital}`)
  for (const k of ['quality', 'reputation', 'morale']) {
    const val = s.attrs && s.attrs[k]
    if (val !== undefined && !(val >= 0 && val <= 100)) v.push(`属性 ${k} 越界：${val}`)
  }
  return { ok: v.length === 0, violations: v }
}

// ── 取某一天的快照 ──────────────────────────────────────────────
// ⚠️ simulateDay 的返回形状是 { ...slices, dailySnapshot: { dayIndex, ..., price }, triggeredEvents }
//    即 dayIndex 在【嵌套的 dailySnapshot】里，不在顶层 —— 直接读 d.dayIndex 会取不到。
// ★ 这里【复用客户端的同一个构造器】buildDailyReport（它内部会归一化 dayIndex 与字段），
//   从而保证"服务端取出的这一天"与"浏览器端周报里显示的这一天"按构造就同形，
//   不需要各自维护一套映射（W1-3 的逐字节断言因此是"验证管道没改数"，而不是"验两套实现碰巧相同"）。
export function daySnapshotOf(weekResult, dayIndex) {
  const rows = buildDailyReport(weekResult)
  return rows.find(r => Number(r.dayIndex) === Number(dayIndex)) || null
}

// ── 幂等键 ──────────────────────────────────────────────────────
export function tickKey(classDay, groupKey) {
  return `d${Number(classDay) || 0}|${groupKey || 'solo'}`
}

// 游戏日 → { week, dayIndex }
// 🔴 E2（N-2 夜跑）：实现搬到 src/weeklyAuto.mjs（客户端自动周报与服务端逐日推进【同一份口径】），
//   本处只 re-export —— 否则"客户端第几天"与"服务端第几天"迟早各写一份（BL-7 同族）。
export { dayToWeekDay } from './weeklyAuto.mjs'

/**
 * ★ 服务端推进该组的 1 天（核心）。纯函数：不改入参、不写库。
 *
 * @param {object} save   该组存档（形状同 localStorage 的 hotel-sim-state）
 * @param {number} classDay 服务端 classDay（唯一权威，客户端不参与判定）
 * @param {object} opts   { decisions?: 最后已知决策（缺省用 save.doneDecisions） }
 * @returns {{
 *   tickKey: string, classDay: number, week: number, dayIndex: number,
 *   advanced: boolean,          // true=本次真的结算了新的一周；false=该周已算过（幂等命中）
 *   snapshot: object|null,      // 该天的日快照
 *   save: object,               // 推进后的存档（新对象）
 *   violations: string[],       // 数值合理性违规（空=通过）
 *   engineVersion: number
 * }}
 */
export function advanceGroupOneDay(save, classDay, opts = {}) {
  const src = save && typeof save === 'object' ? save : {}
  const key = tickKey(classDay, src.__groupKey || opts.groupKey)
  const { week, dayIndex } = dayToWeekDay(classDay)
  const history = Array.isArray(src.history) ? src.history : []

  const already = history.find(h => Number(h && h.week) === week)
  if (already) {
    // 幂等命中：该周已算过 ⇒ 直接取分片，不再结算（结果必然逐字节相同）
    return {
      tickKey: key, classDay: Number(classDay), week, dayIndex,
      advanced: false,
      snapshot: daySnapshotOf(already, dayIndex),
      save: src, violations: [], engineVersion: TICK_VERSION,
    }
  }

  // 需要结算新的一周：用"最后决策延续"（学生没交新决策时沿用上一次）
  const decisions = opts.decisions || src.lastDecisions || src.doneDecisions || {}
  const bounds = validateDecisions(decisions)
  const prev = history.length ? history[history.length - 1] : null
  const result = settle({
    site: src.location,
    brand: src.brand,
    decisions,
    week,
    attrs: src.attrs,
    prevGoodRate: prev ? prev.finalGoodRate : null,
    prevCapital: Number.isFinite(src.capital) ? src.capital : null,
    bizMode: src.bizMode === 'ota' ? 'ota' : 'direct',
  })

  const nextSave = { ...src, week, capital: result.capital, attrs: result.attrsAfter, history: [...history, result] }
  const stateBounds = validateStateBounds(nextSave)
  return {
    tickKey: key, classDay: Number(classDay), week, dayIndex,
    advanced: true,
    snapshot: daySnapshotOf(result, dayIndex),
    save: nextSave,
    violations: [...(bounds.ok ? [] : bounds.violations.map(x => `${x.id}: ${x.why}`)), ...stateBounds.violations],
    engineVersion: TICK_VERSION,
  }
}

/**
 * ★ W1-5（T3.7）老师端"进度落后"提示的纯逻辑。
 *   口径：服务端 classDay（唯一权威） vs 该组 lastComputedDay（该组算到第几天）。
 *   "落后" = 服务端已经推进到第 N 天，而这组还停在第 M 天（M < N）。
 *
 * @param {{ classDay:number, lastComputedDay:number, lastDecisionAt?:string|number|Date }} p
 * @returns {{ lagDays:number, lagWeeks:number, level:'ok'|'watch'|'behind', label:string, sinceLabel:string|null }}
 */
export function progressLag({ classDay, lastComputedDay, lastDecisionAt = null } = {}) {
  const cd = Math.max(0, Math.round(Number(classDay) || 0))
  const ld = Math.max(0, Math.round(Number(lastComputedDay) || 0))
  const lagDays = Math.max(0, cd - ld)
  const lagWeeks = Math.floor(lagDays / DAYS_PER_WEEK)
  // 档位：0 天=正常；1-2 天=留意；≥3 天=落后（W1-5 验收就是构造"3 天没提交决策"）
  const level = lagDays === 0 ? 'ok' : lagDays <= 2 ? 'watch' : 'behind'

  let label = '进度正常'
  if (lagDays > 0) {
    const w = lagWeeks > 0 ? `${lagWeeks} 周` : ''
    const d = lagWeeks > 0 ? `零 ${lagDays % DAYS_PER_WEEK} 天` : `${lagDays} 天`
    label = `进度落后 ${w}${d}`.replace('零 0 天', '').trim()
    if (lagDays < DAYS_PER_WEEK) label = `进度落后 ${lagDays} 天`
  }

  let sinceLabel = null
  if (lastDecisionAt) {
    const t = lastDecisionAt instanceof Date ? lastDecisionAt : new Date(lastDecisionAt)
    if (!Number.isNaN(t.getTime())) {
      const mins = Math.max(0, Math.round((Date.now() - t.getTime()) / 60000))
      sinceLabel = mins < 60 ? `${mins} 分钟前提交决策`
        : mins < 1440 ? `${Math.round(mins / 60)} 小时前提交决策`
          : `${Math.round(mins / 1440)} 天前提交决策`
    }
  }
  return { lagDays, lagWeeks, level, label, sinceLabel }
}

/**
 * 推进一组多天（直到 classDay）。幂等：重复调用同一天不重复结算。
 * 供"离线几天后补算"与测试使用。
 */
export function advanceGroupToDay(save, classDay, opts = {}) {
  let cur = save
  const days = []
  const lastDone = Number(cur && cur.__lastComputedDay) || 0
  for (let d = lastDone + 1; d <= Number(classDay); d++) {
    const r = advanceGroupOneDay(cur, d, opts)
    cur = { ...r.save, __lastComputedDay: d }
    days.push({ classDay: d, advanced: r.advanced, snapshot: r.snapshot })
  }
  return { save: cur, days }
}
