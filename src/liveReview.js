// 实时评价 · 纯核心（掷骰 → 造条）
//
// 用途：LiveFeed（经营页实时流水）里"客人退房/住店期间留下评价"的掷骰与造条逻辑，
//       从组件里抽出来做成纯函数，便于单测覆盖（组件只负责读写存储 + 插入流水）。
//
// ── 配套 ────────────────────────────────────────────────────────
// 测试：tests/liveReview.test.mjs（一节课条数区间/时段系数/三层上限/卡片字段）
// 上游：reviewRate.js（概率）+ guests.js（身份与文本）；调用方：HotelStatus.jsx 的 LiveFeed
// 规格：评价系统-完整规格.md §4.2（实时扩展）+ 用户确认的口径①②④⑤
//
// ── 硬约束 ────────────────────────────────────────────────────
// 1. 纯函数：不碰 DOM / localStorage / 全局 rand()，随机数走调用方传入的 rnd
// 2. 不产生任何结算数值（出租率/利润/好评率都不受影响）——只造"评价卡片"
// 3. 两层上限各司其职：
//    · 游戏日 3 / 游戏周 10 —— reviewRate.dailyReviewProb 内部判（触顶 → 概率 0）
//    · 真实日 20          —— 本文件判（防"页面挂一整天"把游戏日上限绕过去）

import { dailyReviewProb, rollReview, CAP_REAL_DAY } from './reviewRate.js'
import { makeReview, reviewSeverityOf } from './guests.js'

export const LIVE_CHECKOUT_K = 1        // 退房时段：正常概率（实时评价主要来源）
export const LIVE_OTHER_K = 0.2         // 其他时段 ×1/5（语义："住店期间随手写"）

// 掷骰 + 造条。命中返回 { hit:true, kind, stars, review, entry, feedText }，否则 { hit:false, reason }
export function rollLiveReview({
  isCheckout = false, week = 1, clockTag = '00:00', room = 0,
  rooms = 70, occupancy = 0.6, price = 230,
  brandLevel = '', attrs = {}, decisions = {},
  dayCount = 0, weekCount = 0, realDayCount = 0, list = [],
  rnd, now = 0, today = '',
} = {}) {
  const rr = typeof rnd === 'function' ? rnd : (() => 1)   // 兜底永不命中：关键路径必须由调用方传独立流
  // 真实日硬保护
  if (realDayCount >= CAP_REAL_DAY) return { hit: false, reason: 'real-day-cap' }
  const p = dailyReviewProb({
    rooms, occupancy, brandLevel, attrs, decisions, todayCount: dayCount, weekCount,
  })
  if (p.capped) return { hit: false, reason: dayCount ? 'game-day-cap' : 'game-week-cap', p }
  const k = isCheckout ? LIVE_CHECKOUT_K : LIVE_OTHER_K
  const kind = rollReview(p.pGood * k, p.pBad * k, rr)
  if (!kind) return { hit: false, reason: 'miss', p }

  // 星级口径与结算一致：好评 5 星；差评由经营状态定（不再随机）——实时路径无"当周差评占比/欠账"口径，取属性侧
  const stars = kind === 'good'
    ? 5
    : reviewSeverityOf({ quality: attrs.quality, morale: attrs.morale, negRatio: 0, pending: 0 })
  const recent = (list || []).map(r => r.text).slice(-10)   // 去重范围：口碑页现有最近 10 条
  const review = makeReview({
    decisions, state: { attrs, occupancy, price }, week, stars, rnd: rr, recent,
  })
  const text = `「${review.text}」`
  const entry = {
    id: `live-${now}`, live: true, liveDate: today, liveWeek: week,
    avatar: review.guest.avatar, bg: kind === 'good' ? 'green' : 'blue',
    name: review.guest.card, date: `入住${review.guest.nights}天 · ${clockTag}`,
    stars, text, status: kind === 'good' ? 'good' : 'pending',
    guest: review.guest, cause: review.cause, roomType: review.roomType,
    nights: review.nights, relatedDecision: review.relatedDecision,
    source: 'live', room, isCheckout,
  }
  const brief = review.text.length > 16 ? review.text.slice(0, 16) + '…' : review.text
  const feedText = `💬 [${clockTag}] ${room}房客人留下评价 ${'⭐'.repeat(stars)}「${brief}」`
  return { hit: true, kind, stars, review, entry, feedText, p }
}
