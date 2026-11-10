// V177§3 · 班级教学日历（纯函数 · 教师端按班显示用）
//
// 口径与 scripts/host/tick.mjs 的 classDayNow 一致（服务端权威口径的客户端镜像）：
//   classDay = 今天 − start_date + 1 + teacher_offset_days（最小 1；未设 start_date ⇒ 0）
// ★ 只算"这个班到第几天"，不做任何学期状态判定（闸在引擎：semesterGate.mjs）。
import { dayToWeekDay } from './weeklyAuto.mjs'

/**
 * @param {{start_date?: string, teacher_offset_days?: number}} cls class_state 行
 * @param {Date|string} [today] 便于测试注入（缺省取当前时间）
 * @returns {number} 教学日；未开学 ⇒ 0
 */
export function 班教学日(cls, today = new Date()) {
  if (!cls || !cls.start_date) return 0
  const start = new Date(cls.start_date + 'T00:00:00Z')
  if (Number.isNaN(start.getTime())) return 0
  const t = new Date(new Date(today).toISOString().slice(0, 10) + 'T00:00:00Z')
  const days = Math.floor((t - start) / 86400000) + 1
  return Math.max(1, days + (Number(cls.teacher_offset_days) || 0))
}

/** 班进度：{ classDay, week, dayIndex }（未开学全 0） */
export function 班进度(cls, today) {
  const classDay = 班教学日(cls, today)
  if (!classDay) return { classDay: 0, week: 0, dayIndex: 0 }
  const { week, dayIndex } = dayToWeekDay(classDay)
  return { classDay, week, dayIndex }
}

/** 徽标文案（一班一行）：`第 N 周 · D/7 天`；未开学 ⇒ 「未开学」 */
export function 班徽标(cls, today) {
  const p = 班进度(cls, today)
  return p.classDay ? `第 ${p.week} 周 · 第 ${p.dayIndex}/7 天` : '未开学'
}

/**
 * T3（2026-11-09）· 教师端默认班级选择（纯函数 · 可单测）
 * 优先级：上次选择（'all' = 显式全部）→ 我的班（仅当 running）→ 全库唯一 running 班 → 我的班 → 全部
 * 为什么看状态：教师 profile.class_name 可能指向已归档的老班，直接按"我的班"会默认落到归档班。
 * @param {Array<{class_code:string, semester_status?:string}>} list
 * @param {string} 我的班 profile.class_name
 * @param {string|null} 存过 localStorage 里的上次选择（'' / 'all' / class_code）
 */
export function 选默认班(list, 我的班, 存过) {
  if (存过 === 'all') return ''
  if (存过) return 存过
  const 班 = Array.isArray(list) ? list : []
  const 我的 = 班.find(c => c.class_code === 我的班)
  const 在跑 = 班.filter(c => (c.semester_status || 'running') === 'running')
  if (我的 && (我的.semester_status || 'running') === 'running') return 我的.class_code
  if (在跑.length === 1) return 在跑[0].class_code
  return 我的 ? 我的.class_code : ''
}

// ── D367-班级隔离（2026-11-10）· 纯函数（守门 tests/classIsolation.test.mjs）──────
// 背景：多班并存时，教师端把"全部班"的存档混在一起算 ⇒ 2401 的 12 周状态/决策数串到 2402。
// 口径：凡是"按班"的统计，先过滤到本班，再做聚合 —— 过滤函数只此一份。

/** 行按班过滤：rows 需带 user_id（game_states）或 uid（groups）；filterClass 空 ⇒ 全部 */
export function 过滤本班(rows, classByUid = {}, filterClass = '') {
  const arr = Array.isArray(rows) ? rows : []
  if (!filterClass) return arr.slice()
  return arr.filter(r => classByUid[(r && (r.user_id || r.uid))] === filterClass)
}

/** 最大学期周（只看传入行；"学期是否已满 12 周"的唯一判据） */
export function 最大学期周(rows) {
  const arr = Array.isArray(rows) ? rows : []
  return Math.max(0, ...arr.map(gs => Math.max(0, ...(((gs && gs.state && gs.state.history) || []).map(h => Number(h && h.week) || 0)))))
}

/** 已完成决策项数（组内按 id 去重：entries 已是 Object.entries ⇒ 每项只算 1） */
export function 决策项合计(liveList) {
  return (Array.isArray(liveList) ? liveList : []).reduce((a, g) => a + ((g && g.entries) ? g.entries.length : 0), 0)
}

/** 学期满信号：状态 running 且本班最大周 ≥ 12 ⇒ 显示结课提示（其余状态走另一条横幅） */
export function 学期已满信号(rows) {
  return 最大学期周(rows) >= 12
}
