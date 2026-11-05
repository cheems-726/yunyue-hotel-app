import { createClient } from '@supabase/supabase-js'
import { 定位 } from './classStateLocator.mjs'   // ★ V157 阶段2：多班行定位（class_code · 单源）
import { SEMESTER_STATES } from './classAdmin.mjs'   // ★ V165：学期状态集合单源（含 paused）
import { 超时信号 } from './syncQueue.mjs'   // ★ V170§2：8 秒请求超时

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
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data
}

// 同组队友：班级+组号都相同的其他学生（教师已在分组页设置）
export async function fetchGroupMembers(className, groupNo) {
  let q = supabase
    .from('profiles')
    .select('*')
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
// 组档模型：一组一行（group_key），队友页共享同一份组快照；未分组回退按个人档 user_id 查
export async function fetchGroupStates(groupKey, uids = []) {
  if (groupKey) {
    const { data, error } = await supabase
      .from('game_states')
      .select('*')
      .eq('group_key', groupKey)
      .maybeSingle()
    if (error) throw error
    if (!data || !uids.length) return []
    return uids.map(uid => ({ user_id: uid, state: data.state, week: data.week, finished: data.finished, updated_at: data.updated_at }))
  }
  if (!uids.length) return []
  const { data, error } = await supabase
    .from('game_states')
    .select('*')
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
      .select('*')
      .eq('group_key', groupKey)
      .maybeSingle()
    if (g) return g.state
  }
  const { data, error } = await supabase
    .from('game_states')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data.state
}

// V125-#8/#11：酒店名单独写 —— 命名是"一次承诺动作"，必须当场写进云端并回读确认。
//   为什么不能只靠 800ms 防抖保存：旧实现 cloudState 载荷里没有 hotelName，防抖保存反而把
//   云端已有的 hotelName 覆盖掉（组 2/3 实证：补命名后 jsonb 键消失）。
//   ⇒ 先读当前档再合并（不丢其它字段）→ 写 → 调用方用 fetchGameState 回读比对。
export async function saveHotelName(userId, name, groupKey = null) {
  const 名 = String(name || '').trim()
  if (!名) return false
  const cur = (await fetchGameState(userId, groupKey)) || {}
  // 云档可能还不存在（刚认领物业）：saveGameState 会插入建档，不覆盖任何已有字段
  return saveGameState(userId, { ...cur, hotelName: 名 }, groupKey)
}

// 保存：有组键则写组档（一组一档），否则写个人档
// 组档走「先更新后插入」两步式，更新时不携带 user_id —— 保持原属主，避免"最后写入者变成行属主"
export async function saveGameState(userId, state, groupKey = null) {
  const base = {
    state,
    week: state.week || 1,
    finished: !!state.finished,
    updated_at: new Date().toISOString(),
  }
  if (groupKey) {
    const { data, error } = await supabase.from('game_states')
      .update(base).eq('group_key', groupKey).select('*')
    if (!error && data && data.length) return true
    // 组档还不存在：插入建档（属主 = 首个写入者）
    const { error: insErr } = await supabase.from('game_states')
      .insert({ ...base, group_key: groupKey, user_id: userId })
    if (!insErr) return true
    // 并发兜底：队友可能刚建好档，回退为更新
    const { error: upErr } = await supabase.from('game_states')
      .update(base).eq('group_key', groupKey)
    return !upErr
  }
  const { error } = await supabase.from('game_states')
    .upsert({ ...base, group_key: null, user_id: userId })
  return !error
}

// 离开页面兜底保存（visibilitychange/pagehide 触发）：fetch keepalive 直调 REST 并手动带
// apikey + Authorization 鉴权头 —— sendBeacon 带不了鉴权头会被 RLS 拒绝，故不用。
// 只做更新（PATCH），不携带归属字段；行尚不存在时静默放弃，常规防抖路径会补上。
export function saveGameStateNow(userId, state, groupKey = null) {
  // ★ V170§2：8 秒超时信号（弱网不无限挂起 · 一次自动重试在调用方）
  try {
    const m = SUPABASE_URL.match(/https:\/\/([^.]+)\./)
    const raw = m && localStorage.getItem(`sb-${m[1]}-auth-token`)
    const session = raw && JSON.parse(raw)
    const token = session?.access_token || session?.currentSession?.access_token
    if (!token) return Promise.resolve(false)
    const filter = groupKey
      ? `group_key=eq.${encodeURIComponent(groupKey)}`
      : `user_id=eq.${encodeURIComponent(userId)}`
    return fetch(`${SUPABASE_URL}/rest/v1/game_states?${filter}`, {
      method: 'PATCH',
      keepalive: true,
      signal: 超时信号(8000),
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        state,
        week: state.week || 1,
        finished: !!state.finished,
        updated_at: new Date().toISOString(),
      }),
    }).then(r => r.ok).catch(() => false)
  } catch (e) {
    return Promise.resolve(false)
  }
}



// 教师端：读全班游戏状态（RLS 允许教师读全部）
export async function fetchAllGameStates() {
  const { data, error } = await supabase
    .from('game_states')
    .select('*')   // ★ R114-1：必须取 group_key（V114 的组↔账号过滤依赖它）
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}

// 教师端：读全部档案（拿显示名/组号/班级）
export async function fetchAllProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
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
export async function fetchClassWeek(classCode) {
  const cc = 定位(classCode)
  let { data } = await supabase.from('class_state').select('*').eq('class_code', cc).maybeSingle()
  if (!data) data = await supabase.from('class_state').select('*').eq('id', 1).maybeSingle().then(r => r.data)
  if (!data) return 0
  return data.current_week || 0
}

// ★ §32-U8-补 §2①④：全班课堂通道（老师写 / 全班读）——「老师注入事件」+「AI 领班全班默认授权」
//   · 为什么不是写进学生自己的 game_states：学生端每次保存是【整包 PATCH state】
//     ⇒ 老师写进学生 state 的字段会被学生下一次保存**静默覆盖**（crisis override 同款隐患）。
//     class_state 是老师专属写通道（RLS: is_teacher 才可 update）+ 全班可读 ⇒ 天然无覆盖、天然全班同步。
//   · 迁移未应用（新列不存在）⇒ 回退只读 current_week，通道字段返回空（不阻塞；用「通道就绪」如实标，不谎报）。
//   · 需执行 supabase-migration-u8-class-events.sql（幂等）。
export async function fetchClassState(classCode) {
  const { data, error } = await supabase
    .from('class_state')
    .select('*')
    .eq('class_code', 定位(classCode))
    .maybeSingle()
  if (!error && data) {
    return {
      current_week: data.current_week || 0,
      injected_events: Array.isArray(data.injected_events) ? data.injected_events : [],
      supervisor_auth: (data.supervisor_auth && typeof data.supervisor_auth === 'object') ? data.supervisor_auth : null,
      // ★ V152 §2：续营开关（班级级 · 默认关）。迁移未应用 ⇒ undefined ⇒ false（如实回退，不谎报开）
      续营开关: data.continue_enabled === true,
      // ★ V157 阶段1：学期状态机（draft/running/finished/archived）。迁移未应用 ⇒ undefined ⇒ 'running'（等价改动前行为）
      学期状态: ['draft', 'running', 'finished', 'archived'].includes(data.semester_status) ? data.semester_status : 'running',
      // ★ V185：本班开课日/教师偏移（客户端算本班 classDay 用；class_day_now RPC 是全局口径，多班时会串）
      start_date: data.start_date || null,
      teacher_offset_days: Number(data.teacher_offset_days) || 0,
      通道就绪: true,
    }
  }
  const { data: d2 } = await supabase
    .from('class_state')
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  return { current_week: (d2 && d2.current_week) || 0, injected_events: [], supervisor_auth: null, 续营开关: false, 学期状态: 'running', 通道就绪: false }
}

// ★ V152 §2：老师开/关「续营 12 周」（班级级 · class_state.continue_enabled · RLS 限教师）
//   迁移未应用 ⇒ update 报错 ⇒ 返回 false（调用方 toast 提示，不静默假成功）
// ★ V157 阶段1：学期状态机（教师写 semester_status；RLS 限教师 · 迁移未应用 ⇒ false）
export async function setSemesterStatus(status, classCode) {
  if (!SEMESTER_STATES.includes(status)) return false
  const cc = 定位(classCode)
  const { data } = await supabase.from('class_state').select('*').eq('class_code', cc).maybeSingle()
  const eq = data && data.class_code ? { class_code: data.class_code } : { id: 1 }
  const { error } = await supabase
    .from('class_state')
    .update({ semester_status: status, updated_at: new Date().toISOString() })
    .eq(Object.keys(eq)[0], Object.values(eq)[0])
  return !error
}

// ★ V157 阶段1：新学期重置 —— 只清【当前班】game_states 行（整包置空档 · 不删行不碰其他班）。
//   红线：归档文件与 bak/ 一律不动（重置不删任何归档）。
//   ⚠ 全局教学日 teacher_offset_days 不在此清（多班共用，属阶段2 范围）。
export async function resetClassGameStates(classCode) {
  const CODE = 定位(classCode)
  // 读出本班全部组（profiles 有归属 + game_states group_key 前缀匹配）
  const { data: states, error: e1 } = await supabase.from('game_states').select('*').order('updated_at', { ascending: false })   // ★ V157：整行取（selectColumns 禁手写列清单）
  if (e1) return { ok: false, error: e1.message }
  const 本班 = (states || []).filter(g => String(g.group_key || '').startsWith(CODE + '|'))
  for (const g of 本班) {
    const 空档 = { week: 1, finished: false, history: [], state: { week: 1, finished: false, history: [], capital: null }, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('game_states').update(空档).eq('group_key', g.group_key)
    if (error) return { ok: false, error: error.message }
  }
  return { ok: true, count: 本班.length }
}

// ★ V158 阶段1：建班 —— class_state 新增一行（semester_status='draft'）。class_code 重复 ⇒ 报错（不覆盖）。
export async function createClass(classCode) {
  const { data: dup } = await supabase.from('class_state').select('*').eq('class_code', classCode).maybeSingle()
  if (dup) return { ok: false, error: `班级「${classCode}」已存在（不可重复建班）` }
  const { error } = await supabase
    .from('class_state')
    .insert({ class_code: classCode, semester_status: 'draft', current_week: 0, teacher_offset_days: 0, injected_events: [], updated_at: new Date().toISOString() })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ★ V158 阶段1：列出全部班级（班级切换器数据源）
export async function fetchAllClasses() {
  const { data, error } = await supabase.from('class_state').select('*').order('class_code')
  if (error) return []
  // ★ V167§3⑥：彩排班（class_code 以「彩排」开头）从班级列表隐藏（数据保留 · 不进成绩单/对比）
  return (data || []).filter(d => d.class_code && !/^彩排/.test(d.class_code))
}

// ★ V158 阶段1：学生注册（signUp + 写 profiles）。已存在学号 ⇒ 返回 {exists:true} 不覆盖密码/进度
export async function signUpStudent(学号, 姓名, classCode, groupNo) {
  const email = 学号 + '@yunyue.study'
  const password = String(学号).slice(-6).padStart(6, '0')   // 默认口令 = 学号后 6 位
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) {
    // 已注册 ⇒ 幂等跳过（不覆盖密码/进度）
    if (/already|registered|User already/i.test(error.message)) return { exists: true }
    return { ok: false, error: error.message }
  }
  if (!data.user) return { ok: false, error: '注册返回无用户' }
  const { error: pe } = await supabase.from('profiles').upsert({
    user_id: data.user.id, role: 'student', class_name: classCode, group_no: groupNo,
    display_name: 姓名 || ('学生' + 学号.slice(-4)), student_no: String(学号),   // ★ V165：student_no 落库（导入预览查重的单源键）
  }, { onConflict: 'user_id' })
  if (pe) return { ok: false, error: pe.message }
  return { ok: true, uid: data.user.id }
}

export async function setClassContinue(on, classCode) {
  const cc = 定位(classCode)
  const { data } = await supabase.from('class_state').select('*').eq('class_code', cc).maybeSingle()
  const eq = data && data.class_code ? { class_code: data.class_code } : { id: 1 }
  const { error } = await supabase
    .from('class_state')
    .update({ continue_enabled: on === true, updated_at: new Date().toISOString() })
    .eq(Object.keys(eq)[0], Object.values(eq)[0])
  return !error
}

// ★ V131 §2：老师推进教学日 —— 只写 class_state.teacher_offset_days（RLS 限教师；学生 JWT 应 403/42501）
//   增量由调用方按"不跳周"规则算好（见 src/advanceWeek.mjs），本函数只做读-加-写。
export async function advanceClassOffset(delta, classCode) {
  const 增 = Number(delta)
  if (!Number.isFinite(增) || 增 === 0) return { ok: false, error: '增量无效' }
  const cc = 定位(classCode)
  let { data, error } = await supabase.from('class_state').select('*').eq('class_code', cc).maybeSingle()
  if (!data) { const r = await supabase.from('class_state').select('*').eq('id', 1).maybeSingle(); data = r.data; error = r.error }
  if (error) return { ok: false, error: error.message, code: error.code }
  const cur = Number(data && data.teacher_offset_days) || 0
  const next = Math.max(0, cur + Math.round(增))
  const eq = data.class_code ? { class_code: data.class_code } : { id: 1 }
  const { error: e2 } = await supabase.from('class_state').update({ teacher_offset_days: next }).eq(Object.keys(eq)[0], Object.values(eq)[0])
  if (e2) return { ok: false, error: e2.message, code: e2.code }
  return { ok: true, offset: next }
}

// 老师：覆盖写【注入事件表】（调用方负责 append 后传全量 —— 服务端不做读改写）
export async function setClassInjections(events, classCode) {
  const cc = 定位(classCode)
  const { data } = await supabase.from('class_state').select('*').eq('class_code', cc).maybeSingle()
  const eq = data && data.class_code ? { class_code: data.class_code } : { id: 1 }
  const { error } = await supabase
    .from('class_state')
    .update({ injected_events: Array.isArray(events) ? events : [], updated_at: new Date().toISOString() })
    .eq(Object.keys(eq)[0], Object.values(eq)[0])
  return !error
}

// 老师：写【AI 领班全班默认授权】（null = 默认全关；形状 { price_adj:{ok}, overbook:{ok}, ... }）
export async function setClassSupervisorAuth(auth, classCode) {
  const cc = 定位(classCode)
  const { data } = await supabase.from('class_state').select('*').eq('class_code', cc).maybeSingle()
  const eq = data && data.class_code ? { class_code: data.class_code } : { id: 1 }
  const { error } = await supabase
    .from('class_state')
    .update({ supervisor_auth: auth && typeof auth === 'object' ? auth : null, updated_at: new Date().toISOString() })
    .eq(Object.keys(eq)[0], Object.values(eq)[0])
  return !error
}

// 🔴 W1-5（T3.7）：classDay 的唯一权威在服务端（class_day_now()，见 migrations/20260927_server_tick.sql）。
//   函数不存在（迁移未应用）时返回 0，由调用方走降级路径 —— 不抛异常、不阻塞教师端。
export async function fetchClassDay() {
  try {
    const { data, error } = await supabase.rpc('class_day_now')
    if (error) return 0
    return Number(data) || 0
  } catch (e) { return 0 }
}

export async function setClassWeek(week, classCode) {
  // ★ V157 阶段2：按班锁周
  const cc = 定位(classCode)
  const { data } = await supabase.from('class_state').select('*').eq('class_code', cc).maybeSingle()
  const eq = data && data.class_code ? { class_code: data.class_code } : { id: 1 }
  const { error } = await supabase
    .from('class_state')
    .update({ current_week: week, updated_at: new Date().toISOString() })
    .eq(Object.keys(eq)[0], Object.values(eq)[0])
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

// 教师批注：保存/读取
export async function saveTeacherNote(teacherUid, studentUid, week, note, score, noteId) {
  if (noteId) {
    // 编辑模式：按原批注 id 更新
    const { error } = await supabase.from('teacher_notes').update({
      note, score, updated_at: new Date().toISOString(),
    }).eq('id', noteId)
    return !error
  }
  const { error } = await supabase.from('teacher_notes').upsert({
    teacher_uid: teacherUid, student_uid: studentUid, week,
    note, score, updated_at: new Date().toISOString(),
  })
  return !error
}

export async function fetchTeacherNotes() {
  const { data, error } = await supabase.from('teacher_notes').select('*').order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}

// 教师删除单条批注（时间线上误存/过时批注清理）
export async function deleteTeacherNote(noteId) {
  const { error } = await supabase.from('teacher_notes').delete().eq('id', noteId)
  return !error
}

// 学生读自己的批注
export async function fetchMyNotes(studentUid) {
  const { data, error } = await supabase.from('teacher_notes').select('*').eq('student_uid', studentUid)
  if (error) throw error
  return data || []
}

// 设置组内职位
export async function setGroupRole(uid, role) {
  const { error } = await supabase.from('profiles').update({ role_in_group: role }).eq('user_id', uid)
  return !error
}

// ── 决策流水 decision_log（N5）────────────────────────────────────────
// 表结构（2026-09-21 已建）：id / user_id / group_key / week / decision_id / answer / feedback / created_at
// 追加型日志：学生只有 insert/select 自己的策略，无 update/delete（fail-closed）
// 风格对齐本文件既有约定：写入返回布尔、失败不抛；读取失败返回空数组

// 学生确认一项决策时写入一行（feedback = 属性真实变化文案，如「品质 +5（60→65）」）
// answer 支持字符串或结构化答案（数组/对象会被序列化成可读文本）
// ★ R109-2：离线（无登录会话）时**不发请求**。
//   匿名插入会被 RLS 拒（实测 401 · code 42501 "new row violates row-level security policy
//   for table decision_log"）⇒ 既在控制台留下 401（浏览器套件把它当失败），
//   又让上层只能谎报"网络问题"。返回结构化结果，由调用方**如实**提示。
async function 有会话() {
  try {
    const { data } = await supabase.auth.getSession()
    return !!(data && data.session && data.session.access_token)
  } catch (e) { return false }
}

export async function saveDecisionLog({ userId, groupKey = null, week = 1, decisionId, answer, feedback }) {
  try {
    if (!(await 有会话())) return { ok: false, 离线: true }
    const ans = typeof answer === 'string'
      ? answer
      : Array.isArray(answer)
        ? answer.slice(0, 5).join('＞')
        : (answer && typeof answer === 'object')
          ? Object.entries(answer).map(([k, v]) => `${k}:${v}`).join('、')
          : String(answer ?? '')
    const { error } = await supabase.from('decision_log').insert({
      user_id: userId,
      group_key: groupKey,
      week,
      decision_id: decisionId,
      answer: ans,
      feedback: feedback || '—', // 不允许空反馈（无属性变化时由调用方传决策描述）
    })
    return error ? { ok: false, 原因: error.message } : { ok: true }
  } catch (e) {
    return { ok: false, 原因: String((e && e.message) || e) }
  }
}

// 教师端：读最近 N 条（created_at 倒序）
export async function fetchDecisionLogs(limit = 50) {
  try {
    const { data, error } = await supabase
      .from('decision_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data || []
  } catch (e) {
    return []
  }
}

// 教师端：实时订阅新增记录（新记录通过 onChange 回调交给调用方置顶）
export function subscribeDecisionLogs(onChange) {
  const channel = supabase
    .channel('decision-log-watch')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'decision_log' }, payload => {
      if (payload && payload.new) onChange(payload.new)
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// ★ V163 · 一键收口/冷备状态卡 —— semester_closeouts 服务端持久层（迁移 v163）
//   每班一行（class_code 唯一）· steps=四步进度 · files=产物清单（size/sha256/小件内联 content）
export async function fetchSemesterCloseout(classCode) {
  const cc = 定位(classCode)
  const { data, error } = await supabase
    .from('semester_closeouts').select('*').eq('class_code', cc).maybeSingle()
  if (error) return { row: null, error: error.message }
  return { row: data || null, error: null }
}

export async function saveSemesterCloseout({ classCode, label, steps, files, semesterStatus, createdBy }) {
  const cc = 定位(classCode)
  const 载荷 = {
    class_code: cc, label: label || null, steps: steps || {}, files: files || {},
    semester_status: semesterStatus || null, created_by: createdBy || null,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('semester_closeouts').upsert(载荷, { onConflict: 'class_code' })
  return !error
}

export async function fetchSemesterCloseoutsAll() {
  const { data, error } = await supabase
    .from('semester_closeouts').select('*').order('updated_at', { ascending: false }).limit(50)
  if (error) return { rows: [], error: error.message }
  return { rows: data || [], error: null }
}

// sha256（客户端实算 · 供 files 清单与【校验】按钮 · 与 src/oneTouchCloseout.mjs 校验同一算法）
export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('')
}
