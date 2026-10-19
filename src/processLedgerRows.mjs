// V117-④ · 教师端台账行（从**云端数据**拼 · 不读学生本机）
//   · 归因：decision_log 里「归因-W<n>」的作答 + 该组 history 的 prev/cur 算真值（命中再加 1）
//   · 承诺书：★ V128-#1 已接单源 选址过程分()（云端 state.选址承诺书 随存档上传）
//   · 理由：★ V128-#1 云端 state.取舍理由（合格键数组，随存档上传；教师端不再读学生本机）
import { 过程分台账, 选址过程分 } from './processScore.mjs'
import { 真值 } from './attribution.mjs'

export function 台账行FromCloud({ 组 = '', 酒店名 = '', history = [], 归因日志 = [], 选址承诺书 = null, 理由 = [], 每日委托 = [], 本周天数 = 0 } = {}) {
  const 周s = Array.isArray(history) ? history : []
  const 归因 = []
  for (const lg of (归因日志 || [])) {
    const m = /归因-W(\d+)/.exec(String(lg && lg.decision_id))
    if (!m) continue
    const w = Number(m[1])
    const cur = 周s.find(h => h && Number(h.week) === w)
    const prev = 周s.find(h => h && Number(h.week) === w - 1)
    const t = (prev && cur) ? 真值(prev, cur) : null
    const 命中 = !!(t && String(lg.answer || '') === t)
    归因.push({ 填了: true, 过程分: 命中 ? 2 : 1 })
  }
  // 缺数据一律传 null（台账显示「—」），不许编 0
  const 承诺书 = 选址承诺书 && typeof 选址承诺书 === 'object' ? 选址过程分(选址承诺书).过程分 : null
  const 理由键 = Array.isArray(理由) ? 理由.filter(Boolean) : null
  // ★ V128-#3 批2：每日委托第四列（按天计 · 只展示不并入合计）
  const 完成 = new Set((Array.isArray(每日委托) ? 每日委托 : []).map(r => Number(r && r.天)).filter(n => Number.isFinite(n) && n >= 1)).size
  const 委托 = { 完成, 应完成: Math.max(0, Math.min(7, Math.round(Number(本周天数) || 0))) }
  return { 组, 酒店名, 台账: 过程分台账({ 承诺书, 归因, 理由: 理由键, 委托 }) }
}
