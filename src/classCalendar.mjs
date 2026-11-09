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
