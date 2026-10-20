// V131 §2 · 老师端推进时间（不跳周）
//
// 口径（卡 §2）：
//   ① 「推进到本周结束」：把 class_day 推到本周第 7 天（不跨周）
//   ② 「进入下一周」：只在第 7 天可用，+1 天 ⇒ 下一周第 1 天
//   ★ 不许跳周：不允许从第 3 天直接 +7 到下一周第 3 天（history 会断档）
//
// 注：真正写库在 supabaseClient.advanceClassOffset（class_state.teacher_offset_days · RLS 限教师）。
import { dayToWeekDay } from './weeklyAuto.mjs'

export function 本周第几天(classDay) {
  const d = Math.max(1, Math.round(Number(classDay) || 1))
  return dayToWeekDay(d).dayIndex
}

/**
 * @param {number} classDay 当前服务端教学日
 * @param {'本周结束'|'下一周'} 模式
 * @returns {{可执行:boolean, 目标:number, 增量:number, 原因:string}}
 */
export function 推进目标(classDay, 模式) {
  const d = Math.max(1, Math.round(Number(classDay) || 1))
  const day = 本周第几天(d)
  if (模式 === '本周结束') {
    if (day >= 7) return { 可执行: false, 目标: d, 增量: 0, 原因: '已经是本周第 7 天（无需再推）' }
    return { 可执行: true, 目标: d + (7 - day), 增量: 7 - day, 原因: '' }
  }
  if (模式 === '下一周') {
    if (day !== 7) return { 可执行: false, 目标: d, 增量: 0, 原因: '先把本周推进到第 7 天（不允许跳周）' }
    return { 可执行: true, 目标: d + 1, 增量: 1, 原因: '' }
  }
  return { 可执行: false, 目标: d, 增量: 0, 原因: '未知推进模式' }
}

/** 推进后的周次（用于断言"周次连续"） */
export function 推进后周次(classDay, 模式) {
  const t = 推进目标(classDay, 模式)
  return { 从: dayToWeekDay(classDay).week, 到: dayToWeekDay(t.目标).week, ...t }
}
