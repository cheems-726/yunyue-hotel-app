// 教学日历时钟（T2.3 / Phase E1）—— 学生端【显示与存档键】的唯一时间源
//
// ── 为什么需要它 ────────────────────────────────────────────────
// 收编前：存档键（LiveFeed 的 hotel-live-<dateKey>-w<周>）、实时评价日计数（rvToday）、
//         房型面板种子（seed）各自直接读设备墙钟 `new Date().toISOString().slice(0,10)`。
// 问题：① 那是【UTC 零点】为界，不是教学日界线；在 UTC+8 恰好等于"本地 08:00 换日"，
//         属巧合 —— 换成别的时区（老师出国演示 / 机器设为 UTC）就与教学日历日错位。
//       ② 三处各读一次墙钟，跨零点/挂机久了会彼此脱钩（流水时间戳用的是 gameMin）。
// 现在：三处共用本模块，**以教学日界线（默认 08:00）换日**，并显式用【本地时区】。
//
// ── 边界（Phase E1 明确不做的事）────────────────────────────────
//   ★ 本模块仍是【设备时钟】驱动 —— 不做服务端 classDay 自动档（那是二期，见 B2 §三）。
//     所以它挡不住"改设备日期"（B2 已定性：这三处只影响展示条数，不影响结算数值 ⇒ 危害低）。
//   ★ 对外数值零变化：结算引擎不读本模块（日均/周值仍由 settle + dayEngine 决定）。
//
// ── 教学日界线 ──────────────────────────────────────────────────
//   教学时段为 08:00–23:00（见帮助页「教学周」说明）。因此：
//     · 当天 08:00 之后 → 算作当天
//     · 当天 08:00 之前 → 算作【前一天】（学生清晨打开时看到的还是昨天那一课）
//   这正是"早 8 点前 / 晚 23 点后 dateKey 与教学日历日一致"这条边界断言的含义。

export const TEACHING_DAY_START_HOUR = 8

// 把墙钟时刻归到它所处的【教学日】（本地时区）
function shiftToTeachingDay(now) {
  const t = now instanceof Date ? now : new Date(now)
  return new Date(t.getTime() - TEACHING_DAY_START_HOUR * 3600 * 1000)
}
const pad2 = (n) => String(n).padStart(2, '0')

// 教学日历日键 'YYYY-MM-DD'（同一教学日内恒定；用于存档键 / 日计数键）
export function teachingDayKey(now = new Date()) {
  const d = shiftToTeachingDay(now)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// 教学日历日序号（同日同值、跨教学日 +1；用于需要整数的场景，如抽样种子）
export function teachingDayNo(now = new Date()) {
  const d = shiftToTeachingDay(now)
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000)
}

// 教学日内的"日"（1-31）—— 替代直接读 getDate()，保证与教学日界线一致
export function teachingDayOfMonth(now = new Date()) {
  return shiftToTeachingDay(now).getDate()
}

// 当前是否在教学时段内（08:00–23:00）——仅供展示文案用（不参与任何判定）
export function inTeachingHours(now = new Date()) {
  const h = (now instanceof Date ? now : new Date(now)).getHours()
  return h >= TEACHING_DAY_START_HOUR && h < 23
}
