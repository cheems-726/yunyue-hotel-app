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
import { settleWeekSegmented, 同决策集 } from './weekSegments.mjs'   // §19.1 单元1·B4 · §21.1-A-1 base 交叉核对
import { decisionsByDayFrom } from './weeklyAuto.mjs'
import { dayToWeekDay } from './weeklyAuto.mjs'   // E2：周↔天换算唯一来源（本文件不再自己算）
// §16.2-B7：周内输入（欠账/整改/实时评价/危机）与客户端【同一派生点】——补算 === 在线 的前置
import { weekInputsOf, 空周输入 } from './weekInputs.mjs'
export { DAYS_PER_WEEK }   // W1-5：进度口径需要它（周↔天换算），属 tick 的公开面
// W1-4：哈希链抽到独立模块（单一实现，避免 serverTick 与防作弊模块各写一份）
import { fnv1a, entryIdOf, chainHash } from './decisionLogIntegrity.mjs'
import { 领班代管 } from './aiSupervisor.mjs'   // ★ §33-V3：代管动作（同构纯函数 · 双端共用同一份源码）
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

// ★ V126-#4：server_tick_log 的【审计流水键】—— 与结算幂等无关（结算幂等靠 history 里有没有该周）。
//   旧版直接用 tickKey 当主键 ⇒ 上一轮占满 d1–d84 后，本轮整轮插入都被 23505 静默吞掉（审计脱钩）。
//   这里加分钟级时间戳：同一分钟内的重复调用才会撞键（撞了就 warn + 计数，不再静默）。
export function tickLogKey(classDay, groupKey, at = new Date()) {
  const d = at instanceof Date ? at : new Date(at)
  const p = n => String(n).padStart(2, '0')
  const stamp = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}`
  return `${tickKey(classDay, groupKey)}|t${stamp}`
}

// ★ V126-#1：结算前置闸阈值 —— 本周决策 < 6 项时，周内不结算（等到周尾再按"未做决策"结算）。
//   为什么需要：advanceGroupOneDay 是"首次遇到某周就把整周算完"，复位开班后第 1 天就被 0 决策结算，
//   学生随后补做也改不了历史 ⇒ 第一个周报必然是假的。
export const 结算前置最少决策 = 6

/** 决策集里真实决策项数（排除 __ 开头的辅助键） */
export function 决策计数(d) {
  const o = d && typeof d === 'object' ? d : {}
  return Object.keys(o).filter(k => !String(k).startsWith('__')).length
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
  // ★ V126-#2 补强：doneDecisions 只有当存档周 == 本次结算周时才可信。
  //   否则"连接中的客户端还停在上一周、把上周 18 项又传上来"会被当成新一周的决策（正是本卡要杀的病）。
  //   opts.decisions 是调用方显式给的（测试/补算通道），按其原义信任。
  const 存档周 = Number(src.week || 1)
  const 本周决策可信 = !Number.isFinite(存档周) || 存档周 === Number(week)
  const decisions = opts.decisions
    || (本周决策可信 ? (src.lastDecisions || src.doneDecisions || {}) : {})
  // ★ V126-#1：结算前置闸 —— 周内决策不足 ⇒ 不结算（周尾仍未达阈值 ⇒ 照常结算并打标）。
  const 决策数 = 决策计数(decisions)
  const 周尾 = dayIndex >= DAYS_PER_WEEK
  const 周尾兜底 = 周尾 && 决策数 < 结算前置最少决策
  if (决策数 < 结算前置最少决策 && !周尾 && opts.forceSettle !== true) {
    return {
      tickKey: key, classDay: Number(classDay), week, dayIndex,
      advanced: false, gated: true,
      gate: { 决策数, 阈值: 结算前置最少决策, 原因: `第 ${dayIndex}/${DAYS_PER_WEEK} 天 · 决策 ${决策数}/18 项 < ${结算前置最少决策} ⇒ 暂不结算（等学生做完）` },
      snapshot: null, save: src, violations: [], engineVersion: TICK_VERSION, 决策数,
    }
  }
  // ★ V126-#2：决策来源留痕 —— 旧实现 lastDecisions 从不写入 ⇒ 实际只有 student / none；
  //   一旦有人启用"延续"通道，历史里必须能甄别（不再出现"周周有决策"却查不出来源）。
  const 决策来源 = opts.decisions ? 'explicit'
    : (!本周决策可信 ? 'stale-ignored'
      : (决策计数(src.lastDecisions) ? 'carried-over' : (决策数 ? 'student' : 'none')))
  // ★★ §33-V3（AI 领班二期 · 补算通道同步 —— B7 教训：动 settle 入参的批次必须同步 serverTick）：
  //   服务端领班与客户端【同一纯函数】aiSupervisor.领班代管() ⇒ "补算 === 在线"由同一份源码保证。
  //   授权两层 = opts.supervisorAuth（全班默认 · Edge 从 class_state 读传入）+ src.supervisorAuthStudent（学生覆盖 · 随存档上传）。
  //   学生决策优先：代管只填【学生决策缺失】的项（函数内置）。未授权/无上周结果 ⇒ 代管空 ⇒ decisions 原样（公平红线）。
  let 生效决策 = decisions
  try {
    const 上周 = history.length ? history[history.length - 1] : null
    if (上周 && (opts.supervisorAuth || src.supervisorAuthStudent)) {
      const { 代管决策 } = 领班代管({ 上周, 学生决策: decisions, 全班默认: opts.supervisorAuth || null, 学生覆盖: src.supervisorAuthStudent || null })
      if (Object.keys(代管决策).length > 0) 生效决策 = { ...代管决策, ...decisions }   // ★ 学生决策优先（已有键不覆盖）
    }
  // 静默理由：离线降级：失败走默认值，不阻塞主流程
  } catch (e) {}   // 领班层异常 ⇒ 回到无领班行为（不拦补算）
  const bounds = validateDecisions(decisions)
  const prev = history.length ? history[history.length - 1] : null
  // ★ §16.2-B7：周内输入（欠账/整改/实时评价/危机）必须与客户端【同一个来源】——
  //   原先这 5 个一个都不传 ⇒ 含实时评价的周"补算 === 在线"不成立（已如实挂账）。
  //   现在从存档的 `weekInputs` 读（客户端随存档带上来的同一份派生结果，单源 src/weekInputs.mjs）。
  //   ★ 读不到（旧档 / 周号不符）⇒ 用【空输入】兜底，并把来源标出来（不静默假装拿到过）。
  const 存档输入 = weekInputsOf(src, week)
  const 输入 = 存档输入 || 空周输入(week)
  // ★ §19.1（单元 1·B4）+ §21.1-A-1（D61）：分段结算的 base 采【客户端上传】，服务端不再反推当期入参
  //   背景：decisionsByDayFrom 的契约是"由调用方给 base（反推会猜）"，而两端原先**都在反推**
  //   ⇒ 函数与调用方自相矛盾；且服务端可能只拿到不完整的变更记录 ⇒ 两端 decisionsByDay 可能不同
  //     ⇒ "补算 === 在线"破（与 B7 同类）。
  //   现在：① 优先读存档里的 `weekBase`（客户端上传的真实 base）
  //        ② 读不到（旧档 / 周号不符 / 版本不符）⇒ **退回反推**兜底，并把来源标出来（不静默假装拿到过）
  //        ③ ★ 反推结果保留为【交叉核对】：与上传值不一致 ⇒ 置 `baseMismatch`（捕获"客户端记账缺失"）
  const 反推base = (() => { const b = { ...decisions }; (Array.isArray(src.decisionChanges) ? src.decisionChanges : []).forEach(c => { if (c && c.key && c.from !== undefined) b[c.key] = c.from }); return b })()
  const 上传base = (src.weekBase && Number(src.weekBase.week) === Number(week) && (src.weekBase.版本 == null || Number(src.weekBase.版本) === 1) && src.weekBase.decisions)
    ? src.weekBase.decisions : null
  const 变更前决策 = 上传base || 反推base
  const baseSource = 上传base ? 'save' : 'derived'
  const baseMismatch = !!上传base && !同决策集(上传base, 反推base)
  const result = settleWeekSegmented({
    site: src.location,
    brand: src.brand,
    decisions: 生效决策,   // ★ §33-V3：学生决策 + 领班代管填空位（未授权 ⇒ === decisions）
    week,
    attrs: src.attrs,
    prevGoodRate: prev ? prev.finalGoodRate : null,
    prevCapital: Number.isFinite(src.capital) ? src.capital : null,
    bizMode: src.bizMode === 'ota' ? 'ota' : 'direct',
    pendingNegatives: 输入.pendingNegatives,
    resolvedCount: 输入.resolvedCount,
    // ★ §33-V4-B7（2026-10-01）：补上三件此前被丢弃的入参 —— 它们各自造成"含 XX 的周，补算 ≠ 在线"：
    //   ① resolvedWeight（U4-R4 职务加成的有效处理权重 · weekInputs 单源已派生，这里此前没传）
    //   ② hotState（R2 上热门危机期 · 客户端传 hotCrisis = 结算结果回传的存档字段 hotReviewCrisis）
    //   ③ penaltyState（R6 延迟后果 · 客户端传 pendingPenalty = 上周结算产生的存档字段）
    //   三件都是【存档/派生已有】，不新增随机、不新增状态 ⇒ 公平红线不破；缺省（旧档无字段）⇒ null ⇒ 行为与改前一致。
    resolvedWeight: 输入.resolvedWeight,
    hotState: (src.hotReviewCrisis && typeof src.hotReviewCrisis === 'object') ? src.hotReviewCrisis : null,
    penaltyState: (src.pendingPenalty && typeof src.pendingPenalty === 'object') ? src.pendingPenalty : null,
    liveNegCount: 输入.liveNegCount,
    livePosCount: 输入.livePosCount,
    crisisResponse: 输入.crisisResponse,
    // ★ §32-U8-补 §2①③：老师注入事件（opts 传入 · 全班通道）+ 注入应对（随存档上传 · weekInputs 单源）
    //   + 补算标注（服务端口径：该组存档 week 落后于本次结算周 ⇒ 这次是"替它补"的迟到结算
    //     ⇒ 注入事件按最差计入 + 周报显著标注「你离线未应对」—— 事件对象带 离线标注，见 settle）
    //   ★ 无注入 / 无应对 / 不落后 ⇒ null/false ⇒ 与改前逐字节一致（水位线）
    injectedEvents: Array.isArray(opts.injectedEvents) ? opts.injectedEvents : null,
    eventResponses: 输入.注入应对 || null,
    补算: Number(src.week || 1) < Number(week),
    // ★ §33-V3：decisionsByDay 的 base 也要用【生效决策】—— 否则分段路径 segmentsOf 会用 base（无代管）
    //   覆盖掉 生效决策（实测：领班代管在补算路径静默失效的根因）。周中无改动 ⇒ 段=1 ⇒ base 即决策集。
    decisionsByDay: decisionsByDayFrom({ base: 生效决策, changes: src.decisionChanges, week }),
  })

  // ★ V126-#1/#2：结果打标（决策数/来源/周尾兜底）—— 金额字段原样来自引擎，不做任何数值改动
  const 结算结果 = {
    ...result,
    决策数,
    决策来源: 周尾兜底 ? 'week-end-fallback' : 决策来源,
    ...(周尾兜底 ? { 结算闸: { 阈值: 结算前置最少决策, 决策数, 原因: '周尾仍未达阈值 ⇒ 按"未做决策"结算（周报标注判 0 分侧）' } } : {}),
  }
  // ★ V126-#2：结算成功 ⇒ 清空本周决策与本周变更（不清 ⇒ 第 2 周拿第 1 周的决策/变更再结算一遍）。
  //   weekBase 一并清：它是"本周改动前的决策集"，留着会让下周的分段基线错位。
  const nextSave = {
    ...src, week, capital: 结算结果.capital, attrs: 结算结果.attrsAfter, history: [...history, 结算结果],
    doneDecisions: {},
  }
  // 只清"确实存在"的周内字段：旧档没有这些键 ⇒ 不新增键（存档形状按需变化，不无中生有）
  if (Array.isArray(nextSave.decisionChanges)) nextSave.decisionChanges = []
  if (nextSave.weekBase) nextSave.weekBase = null
  delete nextSave.lastDecisions
  const stateBounds = validateStateBounds(nextSave)
  return {
    tickKey: key, classDay: Number(classDay), week, dayIndex,
    advanced: true,
    snapshot: daySnapshotOf(结算结果, dayIndex),
    save: nextSave,
    violations: [...(bounds.ok ? [] : bounds.violations.map(x => `${x.id}: ${x.why}`)), ...stateBounds.violations],
    engineVersion: TICK_VERSION,
    决策数, 决策来源: 结算结果.决策来源,
    inputsSource: 存档输入 ? 'save' : 'default',
    baseSource,          // §21.1-A-1：'save'（客户端上传）| 'derived'（旧档兜底反推）
    baseMismatch,        // §21.1-A-1：上传值与反推值不一致 ⇒ 客户端记账可能缺失（交叉核对，不静默）      // §16.2-B7：'default' = 存档没带本周输入（补算口径会与在线不同）
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
