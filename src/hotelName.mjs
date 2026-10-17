// V114-P1 · 酒店名（纯标识 · **不进结算** · 取名后不可改）
//
// ── 规则（V114 §1）──────────────────────────────────────────────────
//   · 2–12 字；不能全空白、不能含空格/控制字符
//   · **同班不得重名**（唯一性由前端校验：拿本班已有 game_states.state.hotelName 比对）
//   · 取名是**一次承诺动作**：一旦落库，界面不给编辑入口（重置随存档一起清）
//
// ── 边界 ─────────────────────────────────────────────────────────────
//   · 只做校验与比对（纯函数）；落库由 App 存档负责（state.hotelName）
//   · 不参与任何数值：不 import settlement/decisions/attrs

export const 名字最短 = 2
export const 名字最长 = 12

/** 校验名字本身 */
export function 校验酒店名(name) {
  const t = String(name == null ? '' : name).trim()
  if (!t) return { ok: false, 原因: '请先给酒店取名（空名不能进入经营）' }
  if (t.length < 名字最短) return { ok: false, 原因: `至少 ${名字最短} 个字` }
  if (t.length > 名字最长) return { ok: false, 原因: `最多 ${名字最长} 个字` }
  if (/[\s\u0000-\u001f]/.test(t)) return { ok: false, 原因: '不能含空格或控制字符' }
  return { ok: true, 值: t }
}

/**
 * 同班查重
 * @param {string} name
 * @param {Array<{name:string, 组?:string|number}>} 已有 本班已用过的名字（来自 game_states.state.hotelName）
 * @returns {{重名:boolean, 组?:string|number|null}}
 */
export function 查重(name, 已有 = []) {
  const t = (校验酒店名(name).值) || ''
  if (!t) return { 重名: false }
  const hit = (已有 || []).find(x => String((x && x.name) || '').trim() === t)
  return hit ? { 重名: true, 组: hit.组 == null ? null : hit.组 } : { 重名: false }
}

/** 从 game_states 行里提取"本班已有名字"（group_name/group_key 用于提示"已被第 X 组使用"） */
export function 已有名字(rows = []) {
  return (rows || [])
    .map(g => ({ name: g && g.state && g.state.hotelName, 组: (g && (g.group_name || g.group_key)) || null }))
    .filter(x => !!String(x.name || '').trim())
}

/** 三处显示用的统一文案：`第N组 · 酒店名 · 成员`（缺哪项就不写哪项，不编） */
export function 组显示({ groupNo = null, hotelName = '', 成员 = [] } = {}) {
  const 段 = []
  if (groupNo != null && String(groupNo) !== '') 段.push(`第${groupNo}组`)
  if (String(hotelName || '').trim()) 段.push(String(hotelName).trim())
  const 名 = (成员 || []).filter(Boolean)
  if (名.length) 段.push(名.join('、'))
  return 段.join(' · ')
}
