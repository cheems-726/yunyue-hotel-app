// V114-P2 · 名册一致性（组 ↔ 账号 ↔ 存档 一一对应）
//
// ── 三条不变式（V114 §2②）────────────────────────────────────────────
//   ① 每个 `role='student' 且 group_no 已分配` 的账号 **必须有** game_states 行，组键 = `班级|组号`
//   ② 每个 game_states 的组键 **必须能反查到 ≥1 名学生**
//   ③ **不得存在** `group_key` 为空/null 的 game_states 行（野行 —— 审计端删过 5 条，这里锁死不再回来）
//
// ── 边界 ─────────────────────────────────────────────────────────────
//   · 纯函数：输入 = profiles 行 + game_states 行（教师端本来就会拉这两份）
//   · **不删任何账号**：脏号只报出来（V114 §2③ 要用户点头才处置）
//   · 未分组账号（group_no = null）**不算违规**，只是不进统计（过滤由调用方做）

export const 组键 = (p) => `${(p && p.class_name) || ''}|${(p && p.group_no) ?? ''}`

/**
 * @param {{profiles?:Array, gameStates?:Array}} p
 * @returns {{违规:Array<{k:string, 学生?:string, 组键?:string|null, 期望?:string}>, 统计:object, 通过:boolean}}
 */
export function 校验名册({ profiles = [], gameStates = [] } = {}) {
  const 违规 = []
  const 学生 = (profiles || []).filter(p => p && p.role === 'student')
  const 有组 = 学生.filter(p => p.group_no != null && String(p.group_no) !== '')
  const 无组 = 学生.filter(p => !(p.group_no != null && String(p.group_no) !== ''))
  const 学生键 = new Set(有组.map(组键))
  const 行键 = new Set((gameStates || []).filter(g => g && g.group_key).map(g => String(g.group_key)))

  for (const p of 有组) {
    if (!行键.has(组键(p))) 违规.push({ k: '学生有组无数据', 学生: p.student_no || p.user_id || '—', 期望: 组键(p) })
  }
  for (const g of (gameStates || [])) {
    const key = g && g.group_key
    if (!key) { 违规.push({ k: '野行（group_key 为空）', 组键: key == null ? null : String(key) }); continue }
    if (!学生键.has(String(key))) 违规.push({ k: '组无学生', 组键: String(key) })
  }
  return {
    违规,
    统计: {
      学生数: 学生.length,
      有组学生: 有组.length,
      未分组学生: 无组.length,
      存档组: 行键.size,
      有数据且有组的交集: [...学生键].filter(k => 行键.has(k)).length,
    },
    通过: 违规.length === 0,
  }
}

/** 只保留"组↔账号齐全"的存档行（教师端统计/流水/领班一律用它） */
export function 只取有效组({ profiles = [], gameStates = [] } = {}) {
  // ★ R114-1：state 行缺 group_key 时（旧行/列未取）⇒ 用该 user 的 profile 推出 班级|组号 兜底，
  //   否则教师端会因为它'看起来是野行'而把整班判成 0 组（部署后实测就是这个症状）。
  const 键s = new Set((profiles || []).filter(p => p && p.role === 'student' && p.group_no != null && String(p.group_no) !== '').map(组键))
  const byUid = Object.fromEntries((profiles || []).map(p => [p.user_id, p]))
  return (gameStates || []).filter(g => {
    if (!g) return false
    const p = byUid[g.user_id]
    const 推 = (p && p.role === 'student' && p.group_no != null && String(p.group_no) !== '') ? 组键(p) : null
    const key = String(g.group_key || 推 || '')
    return !!key && 键s.has(key)
  })
}

/** 决策流水过滤：只留 group_key 非空且能反查到有效组的行 */
export function 只取有效流水(logs = [], 有效键s = new Set()) {
  return (logs || []).filter(l => l && l.group_key && 有效键s.has(String(l.group_key)))
}
