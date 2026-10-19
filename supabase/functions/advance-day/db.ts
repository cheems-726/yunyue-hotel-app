// advance-day 的数据库适配层（Wave 1 · W1-1）
// ★ 本文件【只做 IO】：读 class_state / game_states，写 game_states / server_tick_log。
//   不含任何业务计算（结算在 ./engine/ 里）。所有 SQL 都用 service_role 直连。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * classDay 的唯一权威 = 服务端时间（B2 §三 的在线分支）。
 *   classDay = (今天 − 开学日) + 1 + 老师偏移
 * 客户端【不参与判定】（这正是 D7 要的"服务端说了算"）。
 */
export function classDayNow(cls) {
  if (!cls || !cls.start_date) return 0
  const start = new Date(cls.start_date + 'T00:00:00Z')
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')
  const days = Math.floor((today - start) / 86400000) + 1
  return Math.max(1, days + (Number(cls.teacher_offset_days) || 0))
}

export async function readClassState(supa) {
  // ★ §32-U8-补：一并读注入通道（injected_events）。列不存在（迁移未应用）⇒ 回退读既有三列，不拦推进。
  const { data, error } = await supa.from('class_state').select('current_week, start_date, teacher_offset_days, injected_events').eq('id', 1).maybeSingle()
  if (!error) return data
  const { data: d2, error: e2 } = await supa.from('class_state').select('current_week, start_date, teacher_offset_days').eq('id', 1).maybeSingle()
  if (e2) throw new Error('读 class_state 失败：' + e2.message)
  return d2
}

/** 读全班各组存档（组档优先于个人档，与前端 groupKeyOf 口径一致） */
export async function readGroups(supa) {
  const { data, error } = await supa.from('game_states').select('user_id, group_key, state, week, finished')
  if (error) throw new Error('读 game_states 失败：' + error.message)
  const byGroup = new Map()
  for (const row of data || []) {
    if (row.group_key) { if (!byGroup.has(row.group_key)) byGroup.set(row.group_key, row) }
    else byGroup.set('solo:' + row.user_id, row)
  }
  return [...byGroup.values()]
}

/** 只写结果字段，不碰归属（组档不携带 user_id —— 与前端 saveGameState 同一纪律） */
export async function writeGroupState(supa, group, save) {
  const base = { state: save, week: save.week || 1, finished: !!save.finished, updated_at: new Date().toISOString() }
  if (group.group_key) {
    const { error } = await supa.from('game_states').update(base).eq('group_key', group.group_key)
    if (error) throw new Error('写组档失败：' + error.message)
  } else {
    const { error } = await supa.from('game_states').update(base).eq('user_id', group.user_id)
    if (error) throw new Error('写个人档失败：' + error.message)
  }
}

/** 记 tick（审计流水；key 带分钟戳，撞键 = 同一分钟重复调用 ⇒ warn + 计数，不再静默） */
export async function writeTickLog(supa, { tick_key, class_day, group_key, result, ok, dry }) {
  if (dry) return { inserted: false, duplicate: false }
  const { error } = await supa.from('server_tick_log').insert({ tick_key, class_day, group_key, result, ok })
  if (!error) return { inserted: true, duplicate: false }
  if (error.code === '23505') {
    // ★ V126-#4：旧实现把撞键当"幂等命中"静默跳过 ⇒ 8 次真推进、6 组真写档，日志一条没有。
    //   现在撞键必须留痕（console.warn）并由调用方计数返回，审计才能发现"日志与写档脱钩"。
    console.warn(`[advance-day] tick log 撞键（重复调用）：tick_key=${tick_key} group=${group_key} class_day=${class_day} result=${JSON.stringify(result)}`)
    return { inserted: false, duplicate: true }
  }
  throw new Error('写 server_tick_log 失败：' + error.message)
}
