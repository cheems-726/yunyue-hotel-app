import { createClient } from '@supabase/supabase-js'

// 云悦酒店教学系统 · Supabase 云端配置（2026-09-08）
// 项目：yunyue-hotel（东京区） 组织：云悦酒店教学
export const SUPABASE_URL = 'https://jgytwxaeeezmdbxfsyvs.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_bIXR5wi0l43WcRUsa0di0Q_2nVhdsU8'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// 学号/工号 → 登录邮箱（约定：20240101 → 20240101@yunyue.study；T001 → t001@yunyue.study）
// 教师判定触发器按 ^[tT]\d*@ 区分，工号统一转小写后仍以 t 开头，兼容
export function emailFor(id) {
  return `${String(id).trim().toLowerCase()}@yunyue.study`
}

// 拉取当前用户档案（角色/显示名/组号/班级）
export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, display_name, group_no, class_name')
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data
}

// 同组队友：班级+组号都相同的其他学生（教师已在分组页设置）
export async function fetchGroupMembers(className, groupNo) {
  let q = supabase
    .from('profiles')
    .select('user_id, display_name, group_no, class_name')
    .eq('role', 'student')
  if (className) q = q.eq('class_name', className)
  if (groupNo) q = q.eq('group_no', groupNo)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

// 学生改自己的显示名（真名）
export async function updateOwnName(userId, name) {
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: name })
    .eq('user_id', userId)
  return !error
}

// 同组队友的经营概况（只读，RLS 限同班同组）
export async function fetchGroupStates(uids) {
  if (!uids.length) return []
  const { data, error } = await supabase
    .from('game_states')
    .select('user_id, state, week, finished, updated_at')
    .in('user_id', uids)
  if (error) throw error
  return data || []
}

// 组键：班级|组号（未分组返回 null = 个人档模式）
export function groupKeyOf(className, groupNo) {
  return className && groupNo ? `${className}|${groupNo}` : null
}

// 拉取我的游戏状态（组队共管：优先组档，回退个人档）
export async function fetchGameState(userId, groupKey = null) {
  if (groupKey) {
    const { data: g } = await supabase
      .from('game_states')
      .select('state, user_id')
      .eq('group_key', groupKey)
      .maybeSingle()
    if (g) return g.state
  }
  const { data, error } = await supabase
    .from('game_states')
    .select('state')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data.state
}

// 保存：有组键则写组档（一组一档），否则写个人档
export async function saveGameState(userId, state, groupKey = null) {
  const payload = {
    user_id: userId,
    group_key: groupKey,
    state,
    week: state.week || 1,
    finished: !!state.finished,
    updated_at: new Date().toISOString(),
  }
  const { error } = groupKey
    ? await supabase.from('game_states').upsert(payload, { onConflict: 'group_key' })
    : await supabase.from('game_states').upsert(payload)
  return !error
}



// 教师端：读全班游戏状态（RLS 允许教师读全部）
export async function fetchAllGameStates() {
  const { data, error } = await supabase
    .from('game_states')
    .select('user_id, group_name, state, week, finished, updated_at')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}

// 教师端：读全部档案（拿显示名/组号/班级）
export async function fetchAllProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, role, display_name, group_no, class_name, student_no')
  if (error) throw error
  return data || []
}

// 教师端：更新学生档案（组号/班级）
export async function updateProfileByTeacher(userId, fields) {
  const { error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('user_id', userId)
  return !error
}

// 全班教学周同步（0 = 不限制，各组自选节奏；>0 = 全班统一当前周）
export async function fetchClassWeek() {
  const { data, error } = await supabase
    .from('class_state')
    .select('current_week')
    .eq('id', 1)
    .maybeSingle()
  if (error || !data) return 0
  return data.current_week || 0
}

export async function setClassWeek(week) {
  const { error } = await supabase
    .from('class_state')
    .update({ current_week: week, updated_at: new Date().toISOString() })
    .eq('id', 1)
  return !error
}

// 教师端实时订阅：全班任一存档变化时回调（用于自动刷新看板）
export function subscribeGameStates(onChange) {
  const channel = supabase
    .channel('game-states-watch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_states' }, () => onChange())
    .subscribe()
  return () => supabase.removeChannel(channel)
}
