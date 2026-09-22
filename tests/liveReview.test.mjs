// 实时评价联动 · 验收测试（用户指定的 5 条验收，缺一不可）
//
// 运行：node tests/liveReview.test.mjs
//
// 覆盖：
//   □ 一节课(45min)的条数区间（按 22.7 次掷骰/游戏日 → 45min ≈ 21 次）
//   □ 下午课时段（非退房）也能出评价（乙的价值：×1/5）
//   □ 上限：游戏日 3 / 游戏周 10 / 真实日 20（刷新不归零 = 计数由外部持久化传入）
//   □ 卡片守恒与逐周数值一致 → 见 tests/shadow-reviews.mjs（本文件不重复）

import { guestsRng } from '../src/guests.js'
import { rollLiveReview, LIVE_CHECKOUT_K, LIVE_OTHER_K } from '../src/liveReview.js'
import { CAP_DAY, CAP_WEEK, CAP_REAL_DAY, REVIEW_BASE_RATE, REVIEW_K, dailyReviewProb } from '../src/reviewRate.js'
import { ATTR_INIT } from '../src/attrs.js'

let pass = 0, fail = 0
function ok(cond, name) { if (cond) { pass++; console.log('  ✓ ' + name) } else { fail++; console.log('  ✗ ' + name) } }
function head(t) { console.log('\n== ' + t + ' ==') }

// 一节课 = 45 真实分钟；1 游戏分钟 = 2 真实秒 → 22.5 游戏分钟/真实分钟 → 22.7 次掷骰/游戏日
const ROLLS_PER_CLASS = 21        // 45 分钟一节课的掷骰次数（退房 19 + 其他 2，按 reviewRate.js 注释口径）
const WEEK = 3
const base = {
  week: WEEK, rooms: 70, occupancy: 0.6, price: 230, brandLevel: '中档',
  decisions: {}, list: [], now: 1, today: '2026-09-21',
}

// ── 模拟一节课：给定属性与时段构成，返回本节课产生的评价条数 ──
function simulateClass(attrs, { checkoutRatio = 9 / 10, seed = 1, rollCount = ROLLS_PER_CLASS } = {}) {
  const rnd = guestsRng(seed)
  let dayCount = 0, weekCount = 0
  const list = []
  let n = 0
  const checkouts = Math.round(rollCount * checkoutRatio)
  for (let i = 0; i < rollCount; i++) {
    const isCheckout = i < checkouts
    const res = rollLiveReview({
      ...base, attrs, isCheckout, clockTag: '10:30', room: 312,
      dayCount, weekCount, realDayCount: 0, list, rnd,
    })
    if (res.hit) { list.push(res.entry); dayCount++; weekCount++; n++ }
  }
  return { n, list, dayCount, weekCount }
}

// ── 1. 一节课的条数区间（中性态几乎不出 / 极端态打到上限）──
head('1. 一节课(45min)能出几条')
{
  const neutral = simulateClass(ATTR_INIT, { seed: 11 })
  ok(neutral.n <= 1, `中性属性（60/70/65）一节课 ≤1 条（实际 ${neutral.n}）`)

  const great = simulateClass({ quality: 95, reputation: 95, morale: 95 }, { seed: 11 })
  ok(great.n >= 1 && great.n <= CAP_DAY, `状态极好一节课落在 1~${CAP_DAY} 条（实际 ${great.n}）`)
  ok(great.dayCount <= CAP_DAY, `游戏日上限生效：当日累计 ${great.dayCount} ≤ ${CAP_DAY}`)

  const badAttrs = { quality: 20, reputation: 25, morale: 25 }
  const bad = simulateClass(badAttrs, { seed: 11 })
  let badClasses = 0, badTotal = 0
  for (let s = 1; s <= 100; s++) { const r = simulateClass(badAttrs, { seed: s }); if (r.n > 0) badClasses++; badTotal += r.n }
  ok(badClasses > 50, `状态极差时 100 节课里 ${badClasses} 节出差评（差评是常态而非偶然）`)
  ok(bad.list.every(e => e.status === 'pending' && e.stars <= 3), '极差状态产出的全是待处理差评')
  console.log(`     参考：中性 ${neutral.n} 条 / 极好 ${great.n} 条（打到日上限）/ 极差均 ${(badTotal / 100).toFixed(2)} 条`)
  // ⚠️ 结构性质（如实记录，不在本批改动）：中性属性 s=0.65 > 0.5 中心 → 实时侧只出好评；
  //    差评需 s<0.5（约比中性低 15 点品质/声誉），差评主要由结算侧负因子承担
  const pNeutral = dailyReviewProb({ ...base, attrs: ATTR_INIT })
  ok(pNeutral.pBad === 0 && pNeutral.pGood > 0, `中性属性：实时侧只出好评（pGood=${(pNeutral.pGood * 100).toFixed(2)}% / pBad=0）`)
}

// ── 2. 下午课时段也能出评价（非退房 ×1/5，乙的价值）──
head('2. 下午课时段（非退房）也能出评价')
{
  ok(LIVE_OTHER_K === 0.2 && LIVE_CHECKOUT_K === 1, '时段系数：退房 1.0 / 其他 0.2（×1/5）')
  const attrs = { quality: 95, reputation: 95, morale: 95 }
  let hitClasses = 0
  const N = 200
  for (let s = 1; s <= N; s++) if (simulateClass(attrs, { checkoutRatio: 0, seed: s }).n > 0) hitClasses++
  ok(hitClasses > 0, `${N} 节纯非退房时段的课里有 ${hitClasses} 节能出评价（>0）`)
  console.log(`     非退房时段出评率 ≈ ${(hitClasses / N * 100).toFixed(1)}%（×1/5 衰减后仍可见）`)

  // 晚间短时段（10 分钟 ≈ 4~5 次掷骰）也不能完全沉默
  let shortHit = 0
  for (let s = 1; s <= 200; s++) if (simulateClass(attrs, { checkoutRatio: 0, seed: s, rollCount: 5 }).n > 0) shortHit++
  ok(shortHit > 0, `10 分钟短时段 200 次模拟里有 ${shortHit} 次出评价（乙：短时段也能出）`)
}

// ── 3. 三层上限（计数由外部持久化传入 → 刷新不归零等价于"计数照常生效"）──
head('3. 上限硬保护')
{
  const great = { quality: 95, reputation: 95, morale: 95 }
  const rnd = guestsRng(5)
  const pDay = dailyReviewProb({ ...base, attrs: great, todayCount: CAP_DAY, weekCount: 0 })
  ok(pDay.capped && pDay.pGood === 0, `游戏日已 ${CAP_DAY} 条 → 概率归零（capped）`)
  const rDay = rollLiveReview({ ...base, attrs: great, isCheckout: true, dayCount: CAP_DAY, weekCount: 0, rnd })
  ok(rDay.hit === false && rDay.reason === 'game-day-cap', '纯核心：游戏日触顶 → 不命中（reason=game-day-cap）')
  const rWeek = rollLiveReview({ ...base, attrs: great, isCheckout: true, dayCount: 0, weekCount: CAP_WEEK, rnd })
  ok(rWeek.hit === false && rWeek.reason === 'game-week-cap', `游戏周触顶（${CAP_WEEK}）→ 不命中`)
  const rReal = rollLiveReview({ ...base, attrs: great, isCheckout: true, dayCount: 0, weekCount: 0, realDayCount: CAP_REAL_DAY, rnd })
  ok(rReal.hit === false && rReal.reason === 'real-day-cap', `真实日触顶（${CAP_REAL_DAY}）→ 不命中`)
  ok(CAP_REAL_DAY > CAP_DAY * 3, `真实日上限 ${CAP_REAL_DAY} 比游戏日 ${CAP_DAY} 松（正常时段不可能被它拦住）`)
  // 跨游戏日归零的等价性：dayCount 由调用方按"游戏日号"重置 → 传 0 即恢复出评
  let any = false
  const r2 = guestsRng(9)
  for (let i = 0; i < 200 && !any; i++) {
    const r = rollLiveReview({ ...base, attrs: great, isCheckout: true, dayCount: 0, weekCount: 4, rnd: r2 })
    if (r.hit) any = true
  }
  ok(any, '新的一天（dayCount 归零、weekCount 继承）→ 恢复出评')
}

// ── 4. 造条质量：身份自洽 / 字段齐全 / 绑定决策 ──
head('4. 评价卡片质量')
{
  const decisions = { shifts: '精简省成本', hygiene: '不停房' }
  const rnd = guestsRng(2026)
  let got = null
  for (let i = 0; i < 4000 && !got; i++) {
    const r = rollLiveReview({ ...base, attrs: { quality: 35, reputation: 45, morale: 50 }, decisions, isCheckout: true, clockTag: '10:30', room: 312, rnd })
    if (r.hit) got = r
  }
  ok(!!got, '极差状态 + 精简排班/不停房 → 掷出评价')
  if (got) {
    const g = got.review.guest, e = got.entry
    ok(g.avatar === (g.gender === 'male' ? '🧑' : '👩'), `头像与性别自洽（${g.name} → ${g.avatar}）`)
    ok(/先生|女士/.test(g.name) && g.name.includes(g.surname), `称呼自洽（${g.name}）`)
    ok(!!e.roomType && e.nights >= 1 && !!e.date, `房型/天数/时间齐全（${e.roomType} · ${e.date}）`)
    ok(e.status === 'pending' && e.stars <= 3, `差评进待处理队列（${e.stars} 星 / ${e.status}）`)
    ok(['front_slow', 'hygiene'].includes(e.cause), `原因绑定决策（cause=${e.cause} ← ${e.relatedDecision || '-'}）`)
    ok(e.live === true && e.liveWeek === WEEK && e.liveDate === base.today, '带 live 标记（供结算差额与真实日计数使用）')
    ok(/^💬 \[\d\d:\d\d\] 312房客人留下评价 ⭐+「/.test(got.feedText), `流水文案符合约定：${got.feedText.slice(0, 34)}…`)
    ok(e.text === `「${got.review.text}」`, '卡片正文与流水摘要同源')
  }
  // 好评侧
  let good = null
  const rnd2 = guestsRng(77)
  for (let i = 0; i < 4000 && !good; i++) {
    const r = rollLiveReview({ ...base, attrs: { quality: 95, reputation: 95, morale: 95 }, decisions: { shifts: '满编保服务' }, isCheckout: true, rnd: rnd2 })
    if (r.hit && r.kind === 'good') good = r
  }
  ok(!!good && good.entry.status === 'good' && good.entry.stars === 5, '好评 → status=good / 5 星（直接进已处理区）')
  ok(!!good && String(good.entry.cause).startsWith('praise_'), `好评原因走 praise_*（cause=${good && good.entry.cause}）`)
}

// ── 5. 与结算侧联动：live 条数 = 结算的"已产生"输入（守恒前置）──
head('5. 与结算差额联动')
{
  const attrs = { quality: 95, reputation: 95, morale: 95 }
  const cls = simulateClass(attrs, { seed: 33 })
  const neg = cls.list.filter(e => e.stars <= 3).length
  const pos = cls.list.filter(e => e.stars >= 4).length
  ok(cls.n > 0 && neg + pos === cls.n, `实时条数可按星级拆分（差 ${neg} + 好 ${pos} = ${cls.n}）← App 传给 settle 的 liveNeg/livePos`)
  // 交叉校验：App 用 stars 判 liveNeg/livePos，而卡片 status 也必须同口径（否则两处会自相矛盾）
  ok(cls.list.every(e => (Number(e.stars) <= 3) === (e.status === 'pending')),
    '星级与状态口径一致（≤3 星 ⇔ pending / ≥4 星 ⇔ good）')
  ok(cls.list.every(e => Number.isFinite(Number(e.stars))), '每条都有可解析的星级（App 用 Number(r.stars) 统计，不依赖 status）')
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
console.log(`口径：REVIEW_BASE_RATE=${REVIEW_BASE_RATE} K=${REVIEW_K} 上限 日${CAP_DAY}/周${CAP_WEEK}/真实日${CAP_REAL_DAY}`)
process.exit(fail ? 1 : 0)
