// V128-#3 批2 · 每日委托记录（本机持久化 + 计数 · 纯函数可测）
//
// 落点：localStorage `hotel-sim-daily-quests` = { week, 记录: [{ 天, 类, 选项, 时刻 }] }
//   ★ 记录随存档上传（weekInputs.每日委托）⇒ 教师端可读；**引擎不读**（第一版零变化红线）。
// 计数口径：按天计 —— 应完成 = 本周已过天数；完成 = 至少完成 1 个委托的天数。
//   （一天最多 2 个委托，但"完成率"按天算，避免事件日被当成 2 倍机会）
export const 记录键 = 'hotel-sim-daily-quests'

let 存储 = (typeof localStorage !== 'undefined' ? localStorage : null)
export function 设置存储(s) { 存储 = s || null }

function 读() {
  try {
    const raw = 存储 && 存储.getItem(记录键)
    const v = raw ? JSON.parse(raw) : null
    return v && typeof v === 'object' && Array.isArray(v.记录) ? v : null
  // 静默理由：坏档/无存储 ⇒ 当作没有记录（不影响经营与结算）
  } catch (e) { return null }
}
function 写(v) {
  // 静默理由：本机写盘失败 ⇒ 记录丢失但不阻塞界面（云端 weekInputs 仍会带当前记录）
  try { if (存储) 存储.setItem(记录键, JSON.stringify(v)); return true } catch (e) { return false }
}

/** 某一周的委托记录（周号不符 ⇒ []） */
export function 读委托记录(week) {
  const v = 读()
  if (!v || Number(v.week) !== Number(week)) return []
  return v.记录.filter(r => r && Number.isFinite(Number(r.天)) && r.类)
}

/**
 * 追加一条完成记录（同一天同一类只记第一次 —— 防重复提交刷完成率）
 * @returns {Array} 追加后的该周记录
 */
export function 追加委托记录(week, entry) {
  const 当前 = 读委托记录(week)
  const e = {
    天: Math.max(1, Math.min(7, Math.round(Number(entry && entry.天) || 1))),
    类: String((entry && entry.类) || ''),
    选项: String((entry && entry.选项) || ''),
    时刻: String((entry && entry.时刻) || new Date().toISOString()),
  }
  if (!e.类) return 当前
  if (当前.some(r => r.天 === e.天 && r.类 === e.类)) return 当前
  const 新 = [...当前, e]
  写({ week: Number(week), 记录: 新 })
  return 新
}

/** 完成天数（按天去重） */
export function 完成天数(记录) {
  const s = new Set((Array.isArray(记录) ? 记录 : []).map(r => Number(r && r.天)).filter(n => Number.isFinite(n) && n >= 1))
  return s.size
}

/** 完成率（用于台账第四列）：应完成 = 本周已过天数（1..7） */
export function 委托完成率(记录, 本周天数) {
  const 应 = Math.max(0, Math.min(7, Math.round(Number(本周天数) || 0)))
  const 完成 = Math.min(完成天数(记录), 应)
  return { 完成, 应完成: 应, 文案: 应 > 0 ? `${完成}/${应}` : null }
}

/** 清空（换号/重开） */
export function 清空委托记录() {
  // 静默理由：清本机记录失败不影响换号流程（内存态已清）
  try { if (存储) 存储.removeItem(记录键) } catch (e) {}
}
