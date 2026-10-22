// V141 §1 · 经营利润（GOP）口径的唯一派生：
//   · 主展示只看 GOP（经营赚的），不把一次性开办费混进"本周赚了多少"
//   · 每周策略 → 归因只引用既有「决策代价表」（decisionRisk）与 history.decisions，不现编
import { sumGop, sumNet, gopOf, wan1 } from './metricDefs.mjs'
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

const 同值 = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** 本周 vs 上周改过的决策（只取既有 decisions 字段；没有变化 ⇒ 空数组） */
export function 变化项(h, prev) {
  const a = (h && h.decisions) || {}
  const b = (prev && prev.decisions) || {}
  const ids = [...new Set([...Object.keys(a), ...Object.keys(b)])]
  return ids.filter(id => !同值(a[id], b[id])).map(id => {
    const 旧 = b[id] != null ? (选项键(id, b[id]) || String(b[id])) : '未做'
    const 新 = a[id] != null ? (选项键(id, a[id]) || String(a[id])) : '未做'
    const 代价 = a[id] != null ? (选项代价(id, a[id])?.代价 || '无登记代价') : ''
    return { id, name: 名称.get(id) || id, 旧, 新, 代价 }
  })
}

/** 一句话归因：首周列初始策略；之后只解释【变化】；没变就明说未调整 */
export function 周归因(h, prev = null) {
  if (!prev) {
    const s = 周策略(h, 3)
    if (!s.length) return '首周无决策记录（按维持现状执行）'
    return '首周：' + s.map(x => `${x.name}（${x.选项}）：${x.代价 || '无登记代价'}`).join('；')
  }
  const 变 = 变化项(h, prev)
  if (!变.length) return '本周未调整决策，利润变化来自外部（出租率/事件/淡旺季）'
  return 变.map(x => `${x.name}：${x.旧} → ${x.新}${x.代价 ? `（${x.代价}）` : ''}`).join('；')
}

/** 单周经营净利 = 净利润 + 一次性开业费用 − 保证金退还（去掉一次性，保留租金/装修/加盟费） */
export function 周经营净利(h) {
  const 净 = h && Number.isFinite(Number(h.netProfit)) ? Number(h.netProfit) : (h && Number(h.profit)) || 0
  const ot = (h && h.oneTimeFees) || {}
  return 净 + (Number(ot.开业费用) || 0) - (Number(ot.保证金退还) || 0)
}

/** 12 周经营口径（全部来自 history 既有字段；三行对账的单源） */
export function 经营口径(history) {
  const hs = history || []
  const 营收 = hs.reduce((a, h) => a + (Number(h && h.revenue) || 0), 0)
  const gop = sumGop(hs).value
  const 净 = sumNet(hs).value
  let 开业 = 0, 退还 = 0, 保证金 = 0
  for (const h of hs) {
    const ot = (h && h.oneTimeFees) || {}
    开业 += Number(ot.开业费用) || 0
    退还 += Number(ot.保证金退还) || 0
    保证金 += Number(ot.保证金) || 0
  }
  const 经营净利 = 净 + 开业 - 退还
  const 成本 = gop - 经营净利
  const 租金 = hs.reduce((a, h) => a + (Number(h && h.rentCost) || 0), 0)
  const 加盟费 = hs.reduce((a, h) => a + (Number(h && h.franchiseFees && h.franchiseFees.合计) || 0), 0)
  const 其他 = 成本 - 租金 - 加盟费
  return { 周数: hs.length, 营收, gop, 净, 开业, 退还, 保证金, 经营净利, 成本, 租金, 加盟费, 其他, 一次性净额: 退还 - 开业 }
}

/** 两页共用文案（同一套数、同一段话；主指标 = 经营净利） */
export function 经营口径文案(history, capital) {
  const c = 经营口径(history)
  const sign = (v) => (v >= 0 ? '+' : '−') + wan1(Math.abs(v))
  const 初始 = Number.isFinite(capital) ? capital - c.净 : null
  return {
    c,
    主: `${c.周数} 周经营净利 ${sign(c.经营净利)}`,
    副: `营收 ${wan1(c.营收)} · GOP ${sign(c.gop)}（未扣租金） · 租金 −${wan1(c.租金)} · 加盟费 −${wan1(c.加盟费)} · 装修/其他 −${wan1(c.其他)}`,
    一次性: c.开业 > 0
      ? `一次性开业 ${wan1(c.开业)}（含保证金 ${wan1(c.保证金)}，${c.退还 > 0 ? '第 12 周已退还' : '期末未退'}）${初始 != null ? `⇒ 账面 ${wan1(初始)} → ${wan1(capital)}` : ''}`
      : '一次性开业 待补（缺来源数据）',
    一句话: `这 ${c.周数} 周经营上是${c.经营净利 >= 0 ? '赚的' : '亏的'}；账面变化 ${sign(c.净)} = 经营 ${sign(c.经营净利)} + 一次性净额 ${sign(c.一次性净额)}`,
  }
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
