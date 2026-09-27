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
export const CHANGE_LABELS = {
  pricing: '房价', overbook: '超售数', shifts: '排班', energy: '能耗温度', linen: '布草',
  hygiene: '卫生', 'member-convert': '会员策略', 'member-threshold': '会员门槛', campaign: '营销活动',
  ota: 'OTA 合作', 'revenue-mgmt': '收益管理', 'report-diagnosis': '报表诊断', corporate: '企业客户',
  reputation: '口碑应对', crisis: '应急处理', renovation: '投资改造', 'hr-optimize': '裁员招聘',
  franchise: '品牌加盟',
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
