// V141 §1 · 经营利润（GOP）口径的唯一派生：
//   · 主展示只看 GOP（经营赚的），不把一次性开办费混进"本周赚了多少"
//   · 每周策略 → 归因只引用既有「决策代价表」（decisionRisk）与 history.decisions，不现编
import { sumGop, gopOf } from './metricDefs.mjs'
import { decisions as 决策目录 } from './decisions.js'
import { 选项键, 选项代价 } from './decisionRisk.mjs'

const 名称 = new Map((决策目录 || []).map(d => [d.id, d.name]))
// 代价最大的优先项（与教学重点一致；实际仍按当周是否做了决策筛选）
const 优先 = ['pricing', 'overbook', 'shifts', 'ota', 'campaign', 'renovation', 'hygiene', 'quality-check', 'energy', 'member-convert']

export function 累计GOP(history) { return sumGop(history || []).value }
export function 本周GOP(history) { const h = (history || []).slice(-1)[0]; return h ? gopOf(h) : null }
export function 上周GOP(history) { const h = (history || []).slice(-2)[0]; return h ? gopOf(h) : null }

/** 每周策略（最多 3 条）：只取当周真实做过的决策，归因文本来自代价表 */
export function 周策略(h, n = 3) {
  const ds = (h && h.decisions) || {}
  const rows = Object.keys(ds)
    .filter(id => ds[id] !== null && ds[id] !== undefined)
    .map(id => {
      const e = 选项代价(id, ds[id])
      const k = 选项键(id, ds[id])
      return {
        id,
        name: 名称.get(id) || id,
        选项: k || (typeof ds[id] === 'object' ? '已填写' : String(ds[id])),
        代价: (e && e.代价) || '',
      }
    })
  const order = (id) => { const i = 优先.indexOf(id); return i < 0 ? 99 : i }
  return rows.sort((a, b) => order(a.id) - order(b.id)).slice(0, n)
}

/** 一句话归因（只拼代价表原文；没有决策就如实说没有） */
export function 周归因(h) {
  const s = 周策略(h, 3)
  if (!s.length) return '本周无决策记录（按维持现状执行）'
  return s.map(x => `${x.name}（${x.选项}）：${x.代价 || '无登记代价'}`).join('；')
}

/** 最近 4 周平均 GOP（回本外推只许用最近 4 周，不许整段平均） */
export function 最近四周均值(history) {
  const xs = (history || []).slice(-4).map(gopOf).filter(Number.isFinite)
  if (!xs.length) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/** 一次性投入（从周报 oneTimeFees 汇总；没有就 null，不出数） */
export function 一次性投入(history) {
  let sum = 0, seen = false
  for (const h of (history || [])) {
    const v = h && h.oneTimeFees && Number(h.oneTimeFees.合计)
    if (Number.isFinite(v)) { sum += v; seen = true }
  }
  return seen ? sum : null
}

/** 回本参考（GOP 口径 · 估算）：已回收/进度/约第 N 周 */
export function 回本参考(history) {
  const 投入 = 一次性投入(history)
  const 累计 = 累计GOP(history)
  if (投入 == null || 投入 <= 0) return { 待补: true, 投入: null, 累计, 已回收: null, 进度: null, 约第N周: null }
  const 已回收 = Math.max(0, 累计)
  const 进度 = Math.max(0, Math.min(1, 已回收 / 投入))
  const 均值 = 最近四周均值(history)
  let 约第N周 = null
  if (已回收 >= 投入) 约第N周 = (history || []).length
  else if (均值 != null && 均值 > 0) 约第N周 = (history || []).length + Math.ceil((投入 - 已回收) / 均值)
  return { 待补: false, 投入, 累计, 已回收, 进度, 约第N周, 均值 }
}
