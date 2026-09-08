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

// 拉取当前用户档案（角色/显示名）
export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, display_name, group_no')
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data
}

// 拉取我的游戏状态
export async function fetchGameState(userId) {
  const { data, error } = await supabase
    .from('game_states')
    .select('state')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data.state
}

// 保存我的游戏状态（upsert）
export async function saveGameState(userId, state) {
  const payload = {
    user_id: userId,
    state,
    week: state.week || 1,
    finished: !!state.finished,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('game_states').upsert(payload)
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
    .select('user_id, role, display_name, group_no, class_name')
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
