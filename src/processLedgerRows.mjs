// V117-④ · 教师端台账行（从**云端数据**拼 · 不读学生本机）
//   · 归因：decision_log 里「归因-W<n>」的作答 + 该组 history 的 prev/cur 算真值（命中再加 1）
//   · 承诺书：评分函数还在 SiteSelection 组件内部 ⇒ 传 null（显「—」，不编）
//   · 理由：只存学生本机 ⇒ 传 null（显「—」，补传另案）
import { 过程分台账 } from './processScore.mjs'
import { 真值 } from './attribution.mjs'

export function 台账行FromCloud({ 组 = '', 酒店名 = '', history = [], 归因日志 = [] } = {}) {
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
  return { 组, 酒店名, 台账: 过程分台账({ 承诺书: null, 归因, 理由: null }) }
}
