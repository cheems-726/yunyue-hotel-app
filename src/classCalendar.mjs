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
