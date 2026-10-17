// V113-2.5 · 每周归因题（**不卡关** · 计过程分 · 教师端可读）
//
// ── 为什么是"RevPAR 变了，主要来自 OCC 还是 ADR" ────────────────────
//   RevPAR = ADR × OCC 是 decisions.js 里已经写进教学点的那句话；归因题只是**把这句话变成一次判断**。
//   真值用【上周 vs 本周】的分解：ΔRevPAR ≈ ΔOCC×ADR前 + OCC前×ΔADR + 交叉项
//   ⇒ 比较两个主项的绝对值，大的那个就是"主要来源"；差不到 10% ⇒ "都不主要"。
//
// ── 计分（过程分，不是结果分）──────────────────────────────────────
//   填了 = 基础过程分 1；判断与真值一致 = 再 +1（"命中"）。
//   ★ 红线（V113 §3-红线）：**不许让预测/归因不计分** —— 所以"填了"本身就有分，不是只对答案给分。
//
// ── 边界 ───────────────────────────────────────────────────────────
//   · **不卡关**：不填也能进下一周（V113 §1④：卡关会卡死课堂）
//   · 本机为唯一真相源；云端镜像走 `saveDecisionLog`（有会话才发，无会话不发 —— 与 R109-2 同纪律）
//   · 教师端：镜像的 decision_id = `归因-W<week>`，answer = OCC/ADR/都不主要 ⇒ `fetchDecisionLogs` 可读

const KEY = 'hotel-sim-attribution'
let 存储 = (typeof localStorage !== 'undefined' ? localStorage : null)
export function 设置存储(s) { 存储 = s || null }

const 读 = () => { try { const r = 存储 && 存储.getItem(KEY); return r ? JSON.parse(r) : {} } catch (e) { return {} } }
const 写 = (v) => { try { if (存储) 存储.setItem(KEY, JSON.stringify(v)); return true } catch (e) { return false } }

export const 归因选项 = [
  { k: 'OCC', 名: '主要来自出租率变化（多卖/少卖了房）' },
  { k: 'ADR', 名: '主要来自房价变化（卖贵了/卖便宜了）' },
  { k: '都不主要', 名: '两者都不主要（更像成本/事件/市场大盘的影响）' },
]

export function 读归因(week) { return 读()[String(week)] || null }

export function 写归因(week, 选择) {
  const all = 读()
  const ok = 归因选项.some(x => x.k === 选择)
  if (!ok) return null
  all[String(week)] = { 选择, at: new Date().toISOString() }
  写(all)
  return all[String(week)]
}

/** 真值：按 ΔRevPAR 的分解判断主要来源 */
export function 真值(prev, cur) {
  if (!prev || !cur) return null
  const occ0 = Number(prev.occupancy) / 100, occ1 = Number(cur.occupancy) / 100
  const adr0 = Number(prev.price), adr1 = Number(cur.price)
  if (![occ0, occ1, adr0, adr1].every(Number.isFinite)) return null
  const 甲 = Math.abs((occ1 - occ0) * adr0)   // 出租率变化贡献
  const 乙 = Math.abs(occ0 * (adr1 - adr0))   // 房价变化贡献
  const 大 = Math.max(甲, 乙), 小 = Math.min(甲, 乙)
  // ★ 先看【绝对变化量】：RevPAR 几乎没动（<5 元 或 <2%）⇒ 谈主要来自哪边没意义
  const rp0 = occ0 * adr0, rp1 = occ1 * adr1
  if (rp0 > 0 && (Math.abs(rp1 - rp0) < 5 || Math.abs(rp1 - rp0) / rp0 < 0.02)) return '都不主要'
  if (大 < 1) return '都不主要'
  if (小 / 大 >= 0.9) return '都不主要'        // 几乎对半 ⇒ 说"都不主要"不冤
  return 甲 > 乙 ? 'OCC' : 'ADR'
}

/**
 * 判分（过程分）
 * @returns {{填了:boolean, 选择:string|null, 真值:string|null, 命中:boolean, 过程分:number}}
 */
export function 判分(week, prev, cur) {
  const a = 读归因(week)
  const t = 真值(prev, cur)
  const 填了 = !!(a && a.选择)
  const 命中 = !!(填了 && t && a.选择 === t)
  return { 填了, 选择: a ? a.选择 : null, 真值: t, 命中, 过程分: 填了 ? (命中 ? 2 : 1) : 0 }
}

/** 全部周的归因过程分合计 */
export function 过程分合计(history) {
  const arr = Array.isArray(history) ? history : []
  let 合 = 0
  for (let i = 1; i < arr.length; i++) {
    const r = 判分(arr[i] && arr[i].week, arr[i - 1], arr[i])
    合 += r.过程分
  }
  return 合
}

/** 教师端：某周所有组的归因（键 = groupKey 或 userId 由调用方注入） */
export function 汇总未填(rows = [], week) {
  const 已 = new Set((rows || []).filter(r => String(r.decision_id || '') === `归因-W${week}`).map(r => String(r.group_key || r.user_id || '')))
  return { 已填: [...已], 周: week }
}

export function 清空归因() { 写({}) }
