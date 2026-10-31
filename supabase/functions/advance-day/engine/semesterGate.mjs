// V160 · 学期闸（纯函数 · 两端共用：src/serverTick.mjs 与 supabase/functions/advance-day/engine 同一份）
//
// 判据（卡 §1）：semester_status === 'running' 且 week <= TOTAL_WEEKS 才允许推进。
// 否则：不写 history、不推进、返回 blockedBy:'semester'。
// 注意：advanceGroupOneDay 里的 history.find(week) 幂等闸在这道闸**之后**——已算过的周不管闸不闸都不重算。

import { TOTAL_WEEKS } from './semester.mjs'

/**
 * 学期闸判定
 * @param {{semester_status?: string, classDay?: number}} classState class_state 行（或其字段）
 * @param {number} week 本次要推进的周（dayToWeekDay(classDay).week）
 * @returns {{allowed: boolean, blockedBy?: 'semester', reason?: string}}
 */
export function 学期闸(classState, week) {
  const s = classState && typeof classState === 'object' ? classState : {}
  const status = s.semester_status || 'running'
  const w = Number(week) || 0
  if (status !== 'running') {
    const 说明 = { draft: '学期未开课', finished: '学期已结课', archived: '学期已归档' }
    return { allowed: false, blockedBy: 'semester', reason: 说明[status] || `状态 ${status}（非 running）` }
  }
  if (w > TOTAL_WEEKS) {
    return { allowed: false, blockedBy: 'semester', reason: `学期已满 ${TOTAL_WEEKS} 周（当前第 ${w} 周）——请结课归档` }
  }
  return { allowed: true }
}
