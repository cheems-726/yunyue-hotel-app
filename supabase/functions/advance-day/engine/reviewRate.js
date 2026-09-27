// 三因子动态评价率（纯函数）
//
// 用途：实时运营面板（LiveFeed）里"客人退房后留下评价"的概率模型 ——
//       让评价频率随【品牌档次 × 在店客流 × 满意度】自然变化，而不是固定概率。
//
// ── 配套 ────────────────────────────────────────────────────────
// 测试：tests/reviewRate.test.mjs（三因子/三层上限/掷骰频率）
// 调用方：liveReview.js（rollLiveReview 内部用它算概率）；常量 CAP_* 由调用方按"已产生条数"判断
// 规格：评价系统-完整规格.md §4（触发机制）的实时扩展，数值口径经用户确认。
//
// ── 硬约束 ────────────────────────────────────────────────────
// 1. 纯函数：无副作用、不 import settlement、不碰 DOM/localStorage
// 2. 【绝不调用全局 rand()】—— 掷骰由调用方用自己的独立随机源（rollReview(pGood, pBad, rnd)）
// 3. 与结算严格分离：本文件只算"概率"，不产生任何结算数值
//
// ── 数值设计说明（为何长这样）────────────────────────────────
// · 满意度偏离中性 0.5 越远，评价意愿越强（两个尾巴都活跃）：
//   pGood ∝ max(0, s-0.5)²、pBad ∝ max(0, 0.5-s)² —— 满意/不满都容易开口，中间态沉默
// · 单条概率量级 ~0.1%~6%（见 tests/reviewRate.test.mjs 对比表），
//   配合调用方的硬上限（当日 3 / 当周 10）保证"低而不失控"

import { tierOf } from './attrs.js'   // 档位判断口径复用 attrs.js（中高/精选 先于 高档）

// ── 常量区（调参入口）─────────────────────────────────────────
export const REVIEW_BASE_RATE = 0.010   // 单房日评价率基准
export const REVIEW_K = 150             // 放大常量（调参入口；依据见下）
// K 的取值依据（按 LiveFeed 实速换算：1 游戏分钟 = 2 真实秒 → 1 游戏日 = 48 真实分钟）：
//   · 每游戏日有效掷骰机会 ≈ 22.7 次（退房 19 + 入住/夜间 ×1/5 共 3.7）
//   · 45 分钟一节课 = 0.94 游戏日 ≈ 21 次掷骰
//   · K=150 时：中性态 ≈0.55 条/节课（常态几乎不出，符合"评价要低"）
//                状态很好/很差 ≈2.8 条/节课（由游戏日上限 3 兜住节奏）
//   调大 K → 更快打到上限；调小 → 更罕见。
export const CAP_DAY = 3                // 硬保护：单【游戏日】最多 3 条
export const CAP_WEEK = 10              // 硬保护：单【游戏周】最多 10 条
export const CAP_REAL_DAY = 20          // 硬保护：单【真实日】最多 20 条（防"页面挂一整天"把游戏日上限绕开）
                                        // 由调用方按"今日已产生的实时评价条数"判断；本文件保持纯函数，不碰存储
export const CROWD_REF = 60             // 客流基准（在店 60 间 = 1.0）
export const P_MAX = 0.5                // 单次掷骰概率上限（安全阀）

// 品牌档次系数（经济 0.8 / 中档 1.0 / 中高 1.2 / 高档 1.4 / 奢华 1.6）
// 高中低档客人的评价意愿不同：越高档越习惯写点评
const TIER_FACTOR = { economy: 0.8, mid: 1.0, upperMid: 1.2, upscale: 1.4, luxury: 1.6 }
export function tierFactor(brandLevel) {
  return TIER_FACTOR[tierOf(brandLevel)] ?? 1.0
}

// 满意度 s ∈ [0,1]：属性加权（品质40% + 声誉40% + 士气20%）+ 本周决策小幅修正
export function satisfactionOf(attrs = {}, decisions = {}) {
  const n = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d)
  const q = n(attrs.quality, 60), r = n(attrs.reputation, 70), m = n(attrs.morale, 65)
  let s = (q * 0.4 + r * 0.4 + m * 0.2) / 100
  const d = decisions || {}
  if (d.shifts === '满编保服务') s += 0.03
  if (d.shifts === '精简省成本') s -= 0.04
  if (d['hr-optimize'] === '裁员1人') s -= 0.05
  if (d['hr-optimize'] === '全员培训') s += 0.03
  if (d.hygiene === '停房深清洁') s += 0.02
  if (d.hygiene === '不停房') s -= 0.02
  if (d.reputation === '道歉+赔偿') s += 0.03
  if (d.reputation === '模板回复') s -= 0.04
  const e = Number(d.energy)
  if (Number.isFinite(e) && (e <= 21 || e >= 25)) s -= 0.03
  return Math.max(0, Math.min(1, s))
}

// 单次退房事件的评价概率
// 返回 { pGood, pBad, s, crowd, tier, capped }；capped=true 表示已触顶（概率归零）
export function dailyReviewProb({
  rooms = 70, occupancy = 0.6, brandLevel = '', attrs = {}, decisions = {},
  todayCount = 0, weekCount = 0,
} = {}) {
  // occupancy 兼容 0-1 与 0-100 两种传法
  const occ = Number(occupancy) > 1 ? Number(occupancy) / 100 : Number(occupancy)
  const occSafe = Number.isFinite(occ) ? Math.max(0, Math.min(1, occ)) : 0.6
  const roomsSafe = Number.isFinite(Number(rooms)) && Number(rooms) > 0 ? Number(rooms) : 70
  const inHouse = Math.round(roomsSafe * occSafe)
  const crowd = inHouse / CROWD_REF
  const tier = tierFactor(brandLevel)
  const s = satisfactionOf(attrs, decisions)

  // 硬保护：触顶即归零（由调用方传当日/当周已生成条数）
  if (todayCount >= CAP_DAY || weekCount >= CAP_WEEK) {
    return { pGood: 0, pBad: 0, s, crowd, tier, inHouse, capped: true }
  }

  const gd = Math.max(0, s - 0.5)     // 满意侧偏离
  const bd = Math.max(0, 0.5 - s)     // 不满侧偏离
  const common = REVIEW_BASE_RATE * tier * crowd * REVIEW_K
  let pGood = common * gd * gd
  let pBad = common * bd * bd
  pGood = Math.max(0, Math.min(P_MAX, pGood))
  pBad = Math.max(0, Math.min(P_MAX, pBad))
  return { pGood, pBad, s, crowd, tier, inHouse, capped: false }
}

// 掷骰：用调用方传入的独立随机源（绝不使用全局 rand）
// 返回 'good' | 'bad' | null
export function rollReview(pGood, pBad, rnd) {
  const r = typeof rnd === 'function' ? rnd() : Math.random()   // 兜底仅用于非关键路径；调用方应始终传入
  if (r < (pGood || 0)) return 'good'
  if (r < (pGood || 0) + (pBad || 0)) return 'bad'
  return null
}

// 便于调用方估算"今天大概会有几条评价"（用于自测与调参，不参与业务）
export function expectedPerDay(prob, checkoutsPerDay = 45) {
  return +(((prob.pGood + prob.pBad) * checkoutsPerDay).toFixed(3))
}
