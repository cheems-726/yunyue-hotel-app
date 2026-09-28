// E2 · 自动周报（二期 · 粒度丙前置）—— 纯核心，两端共用（D8：同一份源码跑）
//
// ── 目标 ────────────────────────────────────────────────────────
//   「7 个游戏日满 → 自动出周报」，学生不再需要点「本周结算」；
//   且**自动成报 === 手动结算旧路径**（同一状态同决策 ⇒ 逐字节）。
//
// ── 怎么保证"逐字节相同"（不是靠断言硬凑）────────────────────────
//   本模块只做【判定与数据整形】，**不做结算**：
//     · 判定：classDay → 第几天/第几周（唯一权威口径，与 serverTick 同源）
//     · 整形：把"引擎输出 + 本周变更记录"拼成周报对象
//   结算是同一条路径：客户端两条入口（自动/手动）都调 App 里那个 doSettle；
//   服务端走 serverTick.advanceGroupOneDay（内部同样调 settle）。
//   ⇒ "自动 === 手动"由【单一入口】保证，而不是靠两处实现碰巧一致。
//
// ── 边界（本模块明确不做）───────────────────────────────────────
//   ❌ 不读时钟、不读 DOM、不写盘（纯函数）—— 时间由调用方以 classDay 传入（T9）
//   ❌ 不改结算公式、不改随机流（T1）
//   ❌ 不判定归属（那是 E3 的 T11；本模块只"记录提交日 + 标生效日"）

// ★ 一游戏周 = 7 游戏日：定义只在 dayEngine（引擎侧）；本模块 import + re-export，
//   不另立一份 —— 否则 barrel 的「导出名零冲突」检查会红（engineBarrel 实测抓到过）。
import { DAYS_PER_WEEK } from './dayEngine.js'
export { DAYS_PER_WEEK }

// 游戏日 → { week, dayIndex }（★ 与 serverTick 同一口径；serverTick 从此处 re-export，避免两份）
export function dayToWeekDay(classDay) {
  const d = Math.max(1, Math.round(Number(classDay) || 1))
  return { week: Math.ceil(d / DAYS_PER_WEEK), dayIndex: ((d - 1) % DAYS_PER_WEEK) + 1 }
}

// 幂等键：classDay + 组键（同一组同一天只自动成报一次）
export function autoSettleKey(classDay, groupKey) {
  return `auto|d${Number(classDay) || 0}|${groupKey || 'solo'}`
}

// 旧档兼容：没有 classDay 时，用"本地教学日历日序号"起算（不 NaN、不白屏）
//   · 传入 teachingDayNoOf（教学日历日整数序号）与 openingDayNo（开学那天的序号）
//   · 开学前/无值 ⇒ 至少 1（第 1 天），绝不返回 0/NaN
export function classDayFromLocal(firstDayNo, todayNo) {
  const a = Number(firstDayNo), b = Number(todayNo)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1
  return Math.max(1, Math.round(b - a) + 1)
}

/**
 * 是否"该自动成报了"。判定条件（三条同时满足）：
 *   ① 本周游戏日已满（dayIndex === 7 ⇒ 第 7 天结束）
 *   ② 本周还没有周报（history 里没有该 week；且没有"已自动成报"的键）
 *   ③ 有可结算的经营状态（已开业：有品牌；否则不触发 —— 筹建期没有周报）
 * @returns {{due:boolean, week:number, dayIndex:number, key:string, reason:string}}
 */
export function shouldAutoSettle(state, classDay, opts = {}) {
  const s = state && typeof state === 'object' ? state : {}
  const { week, dayIndex } = dayToWeekDay(classDay)
  const key = autoSettleKey(classDay, s.__groupKey || opts.groupKey)
  const history = Array.isArray(s.history) ? s.history : []
  const hasReport = history.some(h => Number(h && h.week) === week)
  const settledKeys = Array.isArray(s.__autoSettled) ? s.__autoSettled : []
  const base = { week, dayIndex, key }
  if (opts.enabled === false) return { ...base, due: false, reason: '未启用自动周报' }
  if (dayIndex !== DAYS_PER_WEEK) return { ...base, due: false, reason: `本周第 ${dayIndex}/${DAYS_PER_WEEK} 天` }
  if (hasReport) return { ...base, due: false, reason: '本周周报已在存档里（幂等）' }
  if (settledKeys.includes(key)) return { ...base, due: false, reason: '本周已自动成报过（幂等键命中）' }
  if (!s.brand) return { ...base, due: false, reason: '尚未开业（筹建期不产周报）' }
  return { ...base, due: true, reason: '7 个游戏日已满' }
}

// 决策项 → 可读名（★ 只做显示映射，不引入 UI 依赖；未登记项回退为 id 本身）
// 🔴 §13.1 返修（2026-09-28 · 决策端抽查抓到）：本表与 decisions.js 的 18 个 id【三处不一致】——
//   (a) 缺 quality-check（客房质检）(b) 写错 crisis ← 应为 emergency (c) 多余 franchise（非决策项）
//   ★ 根因 =「表在但没盖全，且无守门」（BL-11/13/15 同族）⇒ 修数据只治当前，**元断言才能防再生**：
//     tests/labelCoverage.test.mjs 钉三条——①覆盖全部 18 项 ②不得含非决策项 ③与 decisions.name 语义一致
export const CHANGE_LABELS = {
  pricing: '动态调价', overbook: '超额预订', shifts: '前台排班', energy: '能耗管控', linen: '布草管理',
  hygiene: '卫生计划', 'member-convert': '会员转化', 'member-threshold': '会员门槛', campaign: '活动策划',
  ota: 'OTA优化', 'revenue-mgmt': '收益管理', 'report-diagnosis': '月度报表诊断', corporate: '协议客户',
  reputation: '口碑管理', 'quality-check': '客房质检', emergency: '应急预案', renovation: '改造投资',
  'hr-optimize': '人力优化',
}

/**
 * 本周变更记录：对比"上一版决策"与"这一版决策"，产出【第几天改了什么】。
 * ★ 归属日（T11）：提交日 D 的改动 **次日生效** ⇒ effectiveDay = D + 1（E3 消费该字段；E2 只如实展示）
 * @param {object} prev 之前那版决策（缺省 {}）
 * @param {object} next 现在这版决策
 * @param {{day:number}} ctx day = 提交时的游戏日（第几天，1-based）
 */
export function diffDecisions(prev, next, ctx = {}) {
  const a = prev && typeof prev === 'object' ? prev : {}
  const b = next && typeof next === 'object' ? next : {}
  const day = Number(ctx.day)
  const 提交日 = Number.isFinite(day) && day > 0 ? Math.round(day) : null
  const out = []
  for (const key of Object.keys(b)) {
    if (key.startsWith('__')) continue
    const before = a[key]
    const after = b[key]
    if (before === undefined || before === after) continue   // 只记"改动"，不记首次填写
    out.push({
      key, label: CHANGE_LABELS[key] || key,
      from: before, to: after,
      提交日, 生效日: 提交日 != null ? 提交日 + 1 : null,
    })
  }
  return out
}

// ★ §19.1（单元 1·B4）：变更记录 → **按天生效的决策集**（引擎消费"生效日"的唯一入口）
//
//   口径（与 diffDecisions 的 T11 一致）：某条变更的 `生效日 = D+1` ⇒ **第 D+1 天起**用它的 `to` 值；
//   第 1..D 天仍用 `from`（即"改动之前的那一版"）。
//
//   @param {object} p
//     · base    本周【改动前】的决策集（= 现在的决策集把每条变更的 key 回退到 from）
//     · changes 变更记录（diffDecisions 的输出）
//     · week    周号（保留给调用方标注；本函数不参与计算）
//   @returns {Array} 长度 7 的决策集数组（第 d 天生效的决策）
//
//   ★ 为什么不在本函数里"从当前决策集反推 base"：那会猜（current 里可能同时有上周遗留的改动）。
//     调用方手里有真实的两版决策 ⇒ **由调用方给 base**，本函数只负责"按生效日应用"。
export function decisionsByDayFrom({ base, changes, week } = {}) {
  void week
  const 起点 = (base && typeof base === 'object') ? { ...base } : {}
  const rows = (Array.isArray(changes) ? changes : []).filter(r => r && r.key && r.生效日 != null)
  const out = []
  for (let d = 1; d <= 7; d++) {
    const 当天 = { ...起点 }
    for (const r of rows) {
      const e = Math.round(Number(r.生效日))
      if (!Number.isFinite(e)) continue
      if (e <= d) 当天[r.key] = r.to      // 生效日 ≤ d ⇒ 该天已按新值；生效日 > 7 ⇒ 本周内不发生
    }
    out.push(当天)
  }
  return out
}

// 变更记录 → 一行行可读文案（周报直接渲染；两端共用同一份措辞）
export function changeLogLines(rows) {
  const arr = Array.isArray(rows) ? rows : []
  return arr.map(r => {
    const 日 = r.生效日 != null ? `第 ${r.生效日} 天生效` : '下次生效'
    return `${r.label}：${fmt(r.from)} → ${fmt(r.to)}（第 ${r.提交日 ?? '?'} 天提交 · ${日}）`
  })
}
const fmt = (v) => (v === null || v === undefined ? '—' : typeof v === 'number' ? String(v) : String(v))

/**
 * 把"引擎输出"整形成周报对象（★ 不重算任何数值）。
 * @param {object} engineResult settle() 的返回（本周权威结果）
 * @param {{week:number, changes?:Array, classDay?:number}} meta
 */
export function shapeWeeklyReport(engineResult, meta = {}) {
  const r = engineResult && typeof engineResult === 'object' ? engineResult : {}
  const rows = Array.isArray(meta.changes) ? meta.changes : []
  return {
    ...r,
    __auto: true,                                  // 标记：本条由自动周报生成（审计用）
    week: Number.isFinite(r.week) ? r.week : meta.week,
    changeLog: rows,                               // 结构化（断言用）
    changeLogLines: changeLogLines(rows),          // 展示文案（两端同措辞）
  }
}

// ── 🔴 D52-a（2026-09-28）：周中调价的【显示级分段】—— 必须显式标"估算" ─────────────
//   依据：D52-a 代拍「显示级分段 + 显式标"估算"」；引擎级（逐日独立计算）列后续批次。
//   ★ 教学诚实是硬要求：不标"估算"就等于让学生以为是引擎精算。
//   口径（全部由引擎已有字段推导，不新造数据源）：
//     · 引擎按【整周一套决策】结算 ⇒ 周值是"改前价跑满周"的结果；
//     · 拿"上周同配置整周价"当对照（同周数不同周 ⇒ 用日均与占用近似）；
//     · 分段展示 = 展示层重排，**绝不回写引擎数值**（周报 revenue/profit 保持引擎原值 —— 零变化）。
//
//   @param {object} engineResult  本周引擎输出（revenue/price/occupiedRooms/rooms…）
//   @param {Array}  changes       本周变更记录（diffDecisions 的输出，含 提交日/生效日/key）
//   @param {object} prevWeek      上一周引擎输出（取同价日均可比口径；可 null）
//   @returns {Array|null} 分段行（每行带 估算:true）；无变更或推导不出 ⇒ null（周报不显示该卡）
export function revenueSegments(engineResult, changes, prevWeek) {
  const r = engineResult && typeof engineResult === 'object' ? engineResult : {}
  const rows = Array.isArray(changes) ? changes : []
  const 调价 = rows.find(c => c.key === 'pricing' && c.生效日 != null)
  if (!调价) return null

  // ═══ ★ §19.1（单元 1·B4）：引擎给了【真分段】就优先用它，并**撤掉"估算"标注** ═══
  //   背景：本函数原为 D52-a 的**显示级估算**（必须标"估算"）。B4 落地后引擎会返回
  //   `segments[]`（逐段用该段决策真跑、Σ分段 === 周报收入）⇒ 那是**实算**，不再标"估算"。
  //   ★ 旧档/无改动的周没有 `segments` ⇒ 走下面的老估算路径（保持向后兼容，标注照旧）。
  const 引擎段 = Array.isArray(r.segments) ? r.segments : null
  if (引擎段 && 引擎段.length >= 2 && Number.isFinite(r.revenue)) {
    const Σ = 引擎段.reduce((a, s) => a + (Number(s.revenue) || 0), 0)
    if (Σ === Math.round(Number(r.revenue))) {          // 守恒校验：不重不漏才敢当"实算"展示
      return {
        估算: false,                                     // ★ 不再是估算
        实算: true,
        分段版本: r.分段版本 ?? null,
        说明: `引擎【按天实算】：${引擎段.length} 段 × 该段生效的决策，Σ分段 = 周报收入 ${r.revenue.toLocaleString()} 元（不重不漏）`,
        rows: 引擎段.map(s => ({
          段: `第 ${s.from}–${s.to} 天（${s.from === 1 ? '改前' : '改后'}）`,
          天数: s.天, 金额: s.revenue, 利润: s.profit,
        })),
        标题: `本周营收分段（引擎实算）：均价 ${r.price} 元（第 ${调价.生效日} 天调整为 ${调价.to}）`,
      }
    }
  }

  const rooms = Number(r.rooms) || 0
  const occ = Number(r.occupiedRooms) || 0
  if (!(rooms > 0) || !(occ >= 0) || !Number.isFinite(r.revenue) || !Number.isFinite(r.price)) return null
  const 天 = 7
  const 生效 = Math.min(7, Math.max(1, Math.round(调价.生效日)))          // 第 N 天起按新价（1..7）
  const 前 = 生效 - 1                                                    // 改前天数
  const 后 = 天 - 前 + 0                                                  // 改后天数（含生效日当天）
  // 日均可比口径：本周实收均价 r.price 是【整周加权】；用上周日均营收拆"价的贡献"会引入第二处假设
  //   ⇒ 更诚实的做法：只按【天数 × 当前均价的线性近似】分段，并**全行标"估算"**，注明"以引擎整周实收为准"。
  const 日均 = (r.revenue / 天)                                          // 引擎整周实收 ÷ 7
  const 前Est = Math.round(日均 * 前)
  const 后Est = Math.max(0, r.revenue - 前Est)
  return {
    估算: true,
    说明: `引擎按整周实收 ${r.revenue.toLocaleString()} 元为准；以下分段是按"第 ${调价.生效日} 天起改价"的【显示级估算】，不是逐日精算`,
    rows: [
      { 段: `第 1–${前} 天（改前）`, 天数: 前, 金额估算: 前Est },
      { 段: `第 ${生效}–7 天（${调价.to}）`, 天数: 后, 金额估算: 后Est },
    ],
    标题: `本周营收分段（估算）：均价 ${r.price} 元（第 ${调价.生效日} 天调整为 ${调价.to}）`,
  }
}
