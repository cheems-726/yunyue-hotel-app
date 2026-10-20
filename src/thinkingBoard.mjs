// V131 §1-E · 教师端思维看板（纯派生 · 不排名、不计分）
//
// 每组一行：本周押注（押/实际/得分/偏差）· 3 条关键理由原文 · 三问复盘摘要
// 排序：按"押注偏差"从大到小（先讲错得最多的组）——这是**讲评顺序**，不是排名。
import { 本周关键决策 } from './keyReasons.mjs'

/** 从组存档派生一行（缺数据如实置 null，不编） */
export function 思维行({ 组 = '', state = {}, week = 1 } = {}) {
  const s = state && typeof state === 'object' ? state : {}
  const 押 = s.本周押注 && Number(s.本周押注.week) === Number(week) ? s.本周押注 : null
  const 已结 = (Array.isArray(s.押注历史) ? s.押注历史 : []).find(x => x && Number(x.week) === Number(week)) || null
  const 实际出租率 = 已结 && Number.isFinite(Number(已结.实际出租率)) ? Number(已结.实际出租率) : null
  const 偏差 = 已结 && Number.isFinite(Number(已结.误差)) ? Number(已结.误差) : (押 ? null : -1)
  const ids = 本周关键决策([])
  const 理由s = ids.map(id => {
    const r = s.决策理由 && s.决策理由[id]
    return { id, 文本: (r && Number(r.week) === Number(week) && String(r.文本 || '').trim()) ? String(r.文本).trim() : '' }
  })
  const 复盘 = (Array.isArray(s.复盘) ? s.复盘 : []).find(x => x && Number(x.week) === Number(week)) || null
  return {
    组,
    押注: 押 ? { 出租率: 押.出租率, 净利方向: 押.净利方向, 迟押: !!押.迟押 } : null,
    实际出租率,
    实际方向: 已结 ? 已结.实际方向 : null,
    得分: 已结 && Number.isFinite(Number(已结.总分)) ? Number(已结.总分) : null,
    偏差,
    理由s,
    理由条数: 理由s.filter(x => x.文本).length,
    复盘: 复盘 ? 复盘.三问 : null,
  }
}

/** 讲评顺序：偏差大的在前；未押注的排最后（偏差 = -1） */
export function 排序思维行(rows) {
  return [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const x = a && Number.isFinite(Number(a.偏差)) ? Number(a.偏差) : -1
    const y = b && Number.isFinite(Number(b.偏差)) ? Number(b.偏差) : -1
    if (y !== x) return y - x
    return String((a && a.组) || '').localeCompare(String((b && b.组) || ''))
  })
}
