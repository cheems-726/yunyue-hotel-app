import React, { useState, useEffect, useMemo } from 'react'
import { getTitle } from './hotelTitle.js'
import { parseRooms } from './settlement.js'
import { normalizeAttrs, ATTR_LABELS, applyDecisionToAttrs } from './attrs.js'
import { rollLiveReview } from './liveReview.js'
import { guestsRng } from './guests.js'
import { teachingDayKey, teachingDayOfMonth } from './teachingClock.mjs'
import { decisions as DEC_CATALOG } from './decisions.js'
import { sumNet } from './metricDefs.mjs'

// 酒店状态面板：RPG 属性面板 + 模拟日历 + 按真实作息驱动的实时运营动态 + 房型结构
// 真实规则：退房 12:00 前 / 入住 14:00 后；运营事件按"游戏内时间片"（15/30/60分钟）推进
const OPENING = { month: 3, day: 1 }
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function simDate(week) {
  const base = new Date(new Date().getFullYear(), OPENING.month - 1, OPENING.day)
  const today = new Date()
  const offset = (week - 1) * 7 + today.getDay()
  const d = new Date(base.getTime() + offset * 86400000)
  return { text: `${d.getMonth() + 1}月${d.getDate()}日`, weekday: WEEKDAYS[today.getDay()] }
}

function fmtGameClock(mins) {
  const m = ((mins % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

// 运营时段（真实酒店作息）：事件权重 + 在店人数曲线 + 时段标签
function phaseOf(h) {
  if (h < 6) return { name: '深夜值守', window: '00:00-06:00', checkout: 0, checkin: 0, curve: 0.95, speed: 12000 }
  if (h < 12) return { name: '退房高峰', window: '06:00-12:00', checkout: 1, checkin: 0, curve: 0.95 - (h - 6) * 0.06, speed: 5000 }
  if (h < 14) return { name: '清洁筹备', window: '12:00-14:00', checkout: 0.3, checkin: 0, curve: 0.6, speed: 6000 }
  if (h < 20) return { name: '入住时段', window: '14:00-20:00', checkout: 0.1, checkin: 1, curve: 0.6 + (h - 14) * 0.06, speed: 4500 }
  if (h < 23) return { name: '夜间平稳', window: '20:00-23:00', checkout: 0, checkin: 0.3, curve: 1, speed: 7000 }
  return { name: '深夜值守', window: '23:00-00:00', checkout: 0, checkin: 0, curve: 0.97, speed: 10000 }
}

// 房型结构（按总房数比例切分；套房价格溢价最高——匹配其更大面积与成本）
function roomTypes(total, basePrice) {
  const big = Math.round(total * 0.5)
  const twin = Math.round(total * 0.35)
  const suite = total - big - twin
  return [
    { name: '大床房', total: big, price: Math.round(basePrice * 0.9), occRate: 0.9 },
    { name: '标准双床', total: twin, price: Math.round(basePrice * 1.0), occRate: 0.75 },
    { name: '套房', total: suite, price: Math.round(basePrice * 1.8), occRate: 0.5 },
  ]
}

// 实时运营流：游戏内时钟连续流动（现实2秒=游戏1分钟），
// 事件按概率随机触发；流水/统计持久化到 localStorage（按日期+周为键），刷新不回退
// 退房后进入待清扫队列，到期自动生成清扫事件并扣耗材成本
// misc 杂项（维修/补货/客诉致歉…）频率已减半：它不参与退房/入住掷骰机会，减半不影响 reviewRate 的 K=150 标定，
// 只把底噪压下去，让 🎯 真实决策条目在流水里更突出（checkout/checkin/night 一律不动）
const EVENT_PROB = { checkout: 0.04, checkin: 0.03, misc: 0.006, night: 0.006 }
const CLEAN_FEE = 25

function LiveFeed({ occupiedRooms, price, week, rooms, brandLevel, attrs, decisions, onStats, dayFlows, dayIndex }) {
  const [feed, setFeed] = useState([])
  const [flows, setFlows] = useState([]) // 结构化流水明细
  const [detailOpen, setDetailOpen] = useState(false) // 明细展开
  const flowsRef = React.useRef([]) // 流水明细唯一数据源：渲染与持久化都读它（与 flows 同步）
  // ★★ §26.3（P0b · 用户 2026-09-29 第二次投诉「面板是第二本账 · 数据之间没有联动」）：
  //    今日流水**唯一来源 = 引擎日快照**（`settle().dailySnapshots[今天]`；由 App 用【与 doSettle 同一套入参】
  //    跑预览结算得到）—— 面板**不再自记金额**。Σ7天 === 周值 由引擎恒等式保证（`semesterRun12` 已钉）。
  //    取不到快照（预览失败/旧档）⇒ 显示「—」并明示"待结算"，**不许退化成编造数字**（那正是本次翻车原因）。
  const 日快照 = Array.isArray(dayFlows) && dayFlows.length === 7 ? dayFlows : null
  const 今天 = 日快照 && Number.isInteger(dayIndex) && dayIndex >= 0 && dayIndex < 7 ? 日快照[dayIndex] : null
  const 今日流水 = 今天 ? { 入账: Math.round(今天.revenue || 0), 支出: Math.round(今天.cost || 0) } : null
  const 本周累计 = 日快照 ? 日快照.slice(0, (Number.isInteger(dayIndex) ? dayIndex : 0) + 1)
    .reduce((a, d) => ({ 入账: a.入账 + Math.round(d.revenue || 0), 支出: a.支出 + Math.round(d.cost || 0) }), { 入账: 0, 支出: 0 }) : null
  // 实时评价上下文：走 ref 读取 —— 属性/决策变化不重启 LiveFeed 定时器（重启会打断流水节奏）
  const rvCtxRef = React.useRef({ attrs: {}, brandLevel: '', decisions: {} })
  rvCtxRef.current = { attrs: attrs || {}, brandLevel: brandLevel || '', decisions: decisions || {} }
  // 实时评价独立随机源：固定种子，绝不消耗结算 rand()、也不去动 Math.random 的事件流
  const rvRandRef = React.useRef(null)
  if (!rvRandRef.current) rvRandRef.current = guestsRng(0x5A17A2)
  // 真实决策写进同一条流水：由定时器副作用把 push/persist 暴露到这里供决策副作用调用
  const feedApiRef = React.useRef(null)
  const [stats, setStats] = useState({ checkout: 0, checkin: 0, income: 0, expense: 0, guests: Math.round(occupiedRooms * 2 - 3) })
  const statsRef = React.useRef(stats)
  statsRef.current = stats

  useEffect(() => {
    const p = price || 230
    // T2.3/E1：统一走教学日历时钟（教学日 08:00 换日）—— 不再直接读设备墙钟的 UTC 日期
    const dateKey = teachingDayKey()
    const storeKey = `hotel-live-${dateKey}-w${week || 1}`
    // 恢复（刷新不回退）；无存档则按当前时刻回放估算
    let st
    try {
      const raw = localStorage.getItem(storeKey)
      st = raw ? JSON.parse(raw) : null
    } catch (e) { st = null }
    if (!st || typeof st.income !== 'number') {
      const nowH = new Date().getHours()
      const n = new Date()
      // ★ §26.3（P0b）：无存档时**不再按当前小时编造收支**（原 inc/exp 估算已删）——
      //   金额一律来自引擎日快照（见 props dayFlows）；这里只初始化计数类状态。
      st = {
        income: 0, expense: 0, checkout: 0, checkin: 0,
        guests: Math.max(4, Math.round(occupiedRooms * 2 - 3)),
        gameMin: nowH * 60 + n.getMinutes(), pendingClean: [], feed: [],
      }
    }
    if (!Array.isArray(st.pendingClean)) st.pendingClean = []
    if (!Array.isArray(st.feed)) st.feed = []
    if (!Array.isArray(st.flows)) st.flows = []
    setStats({ checkout: st.checkout, checkin: st.checkin, income: st.income, expense: st.expense, guests: st.guests })
    setFeed(st.feed)
    flowsRef.current = st.flows // 恢复流水明细（ref 为唯一数据源，重启后不回退）
    let gameMin = st.gameMin || new Date().getHours() * 60 + new Date().getMinutes()
    let pendingClean = st.pendingClean
    // 实时评价计数（口径②·刷新不归零）：游戏日计数随 LiveFeed 存档走，当周计数用独立键
    let rvDayNo = st.rvDayNo || ''
    let rvDayCount = Number(st.rvDayCount) || 0
    const rvWeekKey = `hotel-review-week-w${week || 1}`
    let rvWeekCount = 0
    try { rvWeekCount = Number(localStorage.getItem(rvWeekKey)) || 0 } catch (e) {}
    const rvToday = teachingDayKey()   // T2.3/E1：与 dateKey 同源，避免各自读墙钟后脱钩

    const persist = () => {
      const s = statsRef.current
      try { localStorage.setItem(storeKey, JSON.stringify({ income: s.income, expense: s.expense, checkout: s.checkout, checkin: s.checkin, guests: s.guests, gameMin, pendingClean, feed: feedRef.current, flows: flowsRef.current, rvDayNo, rvDayCount })) } catch (e) {}
    }
    const feedRef = { current: st.feed }
    const pushFeed = (text, amt) => {
      const line = (amt ? (amt > 0 ? ` +${amt}元` : ` ${amt}元`) : '')
      const entry = `${text}${line}`
      feedRef.current = [entry, ...feedRef.current].slice(0, 4)
      setFeed(feedRef.current)
      // 结构化流水：有金额的事件进入明细列表（供展开查看）
      if (amt) {
        flowsRef.current = [{ text: entry, amt }, ...flowsRef.current].slice(0, 20)
        setFlows(flowsRef.current)
      }
    }
    const apply = (patch) => {
      setStats(s => {
        const next = { ...s, ...patch }
        statsRef.current = next
        if (onStats) onStats({ checkout: next.checkout, checkin: next.checkin, guests: next.guests, income: next.income, expense: next.expense })
        return next
      })
    }

    // ── 实时评价：客人退房 / 住店期间留下评价（评价系统-完整规格 §4.2 实时扩展）──
    // 口径：退房时段正常概率（主要来源）｜其他时段 ×1/5（"住店期间随手写"）
    // 概率模型见 reviewRate.js；本函数只掷骰 + 落库。
    // 🔴 2026-09-22 更正（原注释写"不改动任何经营数值"，是错的）：
    //   实时差评卡会进入口碑页；而 doSettle 的 pendingNegatives 只统计**结算生成的卡片**（id w<周>-*），
    //   实时卡不计入欠账 ⇒ 实时层对下周年限的数值影响为**零**，但"实时评价会不会被看到/处理"仍影响观感。
    //   这样既保住教学语义（结算差评欠着会发酵），又守住公平性红线（不同在线时长、同决策 → 同结果）。
    const RV_KEY = 'hotel-sim-reviews'   // 与口碑页共用存储（复用现有待处理队列）
    const readRvList = () => {
      try { const l = JSON.parse(localStorage.getItem(RV_KEY) || '[]'); return Array.isArray(l) ? l : [] } catch (e) { return [] }
    }
    const writeRvList = (l) => { try { localStorage.setItem(RV_KEY, JSON.stringify(l)) } catch (e) {} }

    function tryLiveReview(isCheckout, clockTag, room) {
      try {   // 实时评价是锦上添花：任何异常都不许打断经营流水
        if (document.hidden) return
        const dayNo = String(Math.floor(gameMin / 1440))
        if (dayNo !== rvDayNo) { rvDayNo = dayNo; rvDayCount = 0 }   // 跨游戏日 → 当日计数归零
        const list = readRvList()
        const ctx = rvCtxRef.current
        const res = rollLiveReview({   // 掷骰与造条在纯核心里（src/liveReview.js）
          isCheckout, week, clockTag, room, price,
          rooms, occupancy: rooms > 0 ? (occupiedRooms / rooms) * 100 : 60,   // 🔴 口径修正：guests.js 期望 0-100（原先传 0-1 → "满负荷服务跟不上"类原因永远命不中）
          brandLevel: ctx.brandLevel, attrs: ctx.attrs, decisions: ctx.decisions,
          dayCount: rvDayCount, weekCount: rvWeekCount,
          realDayCount: list.filter(r => r.live && r.liveDate === rvToday).length,
          list, rnd: rvRandRef.current, now: Date.now(), today: rvToday,
        })
        if (!res.hit) return
        writeRvList([...list, res.entry])
        rvDayCount += 1
        rvWeekCount += 1
        try { localStorage.setItem(rvWeekKey, String(rvWeekCount)) } catch (e) {}
        pushFeed(res.feedText, 0)
      } catch (e) {}
    }

    feedApiRef.current = { push: pushFeed, persist }   // 供「真实决策→流水」副作用复用同一存档

    let timer
    const loop = () => {
      // 页面不可见时暂停推进（省电）：保持定时器节奏，但跳过时钟推进/状态更新/写盘
      if (document.hidden) { timer = setTimeout(loop, 2000); return }
      gameMin += 1
      const hm = ((gameMin % 1440) + 1440) % 1440
      const h = Math.floor(hm / 60)
      const clockTag = `${String(h).padStart(2, '0')}:${String(hm % 60).padStart(2, '0')}`
      const ph = phaseOf(h)
      const s = statsRef.current
      const room = 100 + Math.floor(Math.random() * 5) * 100 + Math.floor(Math.random() * 8) + 1
      const roll = Math.random()

      // 到期的清扫任务：退房后 15-35 游戏分钟完成
      // ★ §26.3（P0b）：清扫耗材成本**不再由面板自记**（引擎周成本已含部门成本）⇒ 此处只报事件，不动任何金额
      const due = pendingClean.filter(x => x.due <= gameMin)
      if (due.length) {
        pendingClean = pendingClean.filter(x => x.due > gameMin)
        due.forEach(x => {
          pushFeed(`🧹 [${clockTag}] ${x.room}房退房清扫完成`, 0)
        })
      }

      if (ph.checkout > 0 && roll < EVENT_PROB.checkout && s.checkout + s.checkin < Math.round(occupiedRooms * 0.8)) {
        // ★ §26.3（P0b）：房费金额**不再由面板随机造**（原 `price × (0.85 + Math.random()*0.3)`）——
        //   今日/本周流水一律取引擎日快照（同源）；这里只推进"已退房"计数与文案。
        pendingClean.push({ room, due: gameMin + 15 + Math.floor(Math.random() * 20) })
        apply({ checkout: s.checkout + 1, guests: Math.max(4, s.guests - 2) })
        pushFeed(`🧳 [${clockTag}] ${room}房客人退房结账（12:00 前退房）`, 0)
        tryLiveReview(true, clockTag, room)   // 退房时段：正常概率（实时评价主要来源）
      } else if (ph.checkin > 0 && roll < EVENT_PROB.checkin && s.checkin < Math.round(occupiedRooms * 0.6)) {
        const g = ['商务出差', '家庭出游', '旅行散客', '会议客人'][Math.floor(Math.random() * 4)]
        apply({ checkin: s.checkin + 1, guests: s.guests + 2 })
        pushFeed(`🛎️ [${clockTag}] ${room}房办理入住（14:00 后）· ${g}客人`, 0)
        tryLiveReview(false, clockTag, room)   // 其他时段 ×1/5：住店期间随手写
      } else if (roll < EVENT_PROB.misc && h >= 8 && h < 22) {
        // ★ §26.3（P0b）：事件文案保留（教学趣味），但**金额一律为 0** —— 文案不许再自造金额
        const evs = [
          { t: `🔧 ${room}房空调维修，更换零件` },
          { t: `🛒 客房部补充易耗品（洗漱用品/瓶装水）` },
          { t: `🍬 大堂便利角售出零食饮料` },
          { t: `😤 处理客诉，赠送果盘致歉` },
          { t: `⭐ 前台转化 1 名会员 · 赠送欢迎水果` },
          { t: `💳 为 ${room}房客人退还押金` },
        ]
        const ev = evs[Math.floor(Math.random() * evs.length)]
        pushFeed(`🕐 [${clockTag}] ${ev.t}`, 0)
        tryLiveReview(false, clockTag, room)   // 其他时段 ×1/5：住店期间随手写
      } else if ((h >= 23 || h < 6) && roll < EVENT_PROB.night) {
        const evs = [
          { t: `🌙 夜班保安巡场完毕，楼层安静` },
          { t: `🔦 夜班前台接待 1 位深夜到店客人` },
        ]
        const ev = evs[Math.floor(Math.random() * evs.length)]
        pushFeed(`🌙 [${clockTag}] ${ev.t}`, 0)
        tryLiveReview(false, clockTag, room)   // 深夜时段 ×1/5
      }
      persist()
      timer = setTimeout(loop, 2000)
    }
    timer = setTimeout(loop, 1500)
    return () => clearTimeout(timer)
  }, [occupiedRooms, price, week])

  // 真实决策进入流水（老师要的是"通过流动的数据观察决策"）：
  // 🎯 前缀 + 属性增量，和随机运营事件共用同一条流与同一份持久化；没有决策时原样不动
  // ⚠️ "已入流水的决策 id"必须持久化：决策面板是全屏替换，经营页（含本组件）会卸载重挂，
  //    组件内 ref 基线每次挂载都会被清空 → 要么漏推、要么把历史决策当新决策重播（实测踩过）
  useEffect(() => {
    const ids = Object.keys(decisions || {})
    const seenKey = `hotel-dec-feed-w${week || 1}`
    let seen = null
    try { const raw = localStorage.getItem(seenKey); seen = raw ? JSON.parse(raw) : null } catch (e) { seen = null }
    if (!Array.isArray(seen)) {   // 首次：以现状为基线（不重播历史决策），只写基线
      try { localStorage.setItem(seenKey, JSON.stringify(ids)) } catch (e) {}
      return
    }
    const added = ids.filter(id => !seen.includes(id))
    if (!added.length) return
    const api = feedApiRef.current
    if (!api) return
    const now = new Date()
    const tag = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const attrsNow = rvCtxRef.current.attrs
    const fmtAns = (a) => Array.isArray(a) ? a.join('、') : (a === undefined || a === null ? '' : String(a))
    // 倒序插入：多条同时到达时，最新的排在最上面
    added.slice().reverse().forEach(id => {
      const meta = DEC_CATALOG.find(x => x.id === id)
      const name = meta ? `${meta.icon} ${meta.name}` : id
      const next = applyDecisionToAttrs(attrsNow, id, decisions[id])
      const parts = []
      for (const k of ['quality', 'reputation', 'morale']) {
        const d = (next[k] || 0) - (attrsNow[k] || 0)
        if (d !== 0) parts.push(`${ATTR_LABELS[k]} ${d > 0 ? '+' : ''}${d}`)
      }
      api.push(`🎯 [${tag}] 完成「${name}」→ ${fmtAns(decisions[id])}${parts.length ? ' · ' + parts.join('，') : ''}`, 0)
    })
    api.persist()
    try { localStorage.setItem(seenKey, JSON.stringify(ids)) } catch (e) {}
  }, [decisions])

  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #FBE3B3' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div onClick={() => setDetailOpen(o => !o)} style={{ background: '#F0FDF4', borderRadius: 8, padding: '6px 0', textAlign: 'center', cursor: 'pointer' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 今日流水 ? '#16A34A' : '#9CA3AF' }}>{今日流水 ? '+' + 今日流水.入账.toLocaleString() : '—'}</div>
          <div style={{ fontSize: 9, color: '#9CA3AF' }}>今日入账</div>
        </div>
        <div onClick={() => setDetailOpen(o => !o)} style={{ background: '#FEF2F2', borderRadius: 8, padding: '6px 0', textAlign: 'center', cursor: 'pointer' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 今日流水 ? '#DC2626' : '#9CA3AF' }}>{今日流水 ? '-' + 今日流水.支出.toLocaleString() : '—'}</div>
          <div style={{ fontSize: 9, color: '#9CA3AF' }}>今日支出</div>
        </div>
        <div onClick={() => setDetailOpen(o => !o)} style={{ background: '#EFF6FF', borderRadius: 8, padding: '6px 0', textAlign: 'center', cursor: 'pointer' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: !今日流水 ? '#9CA3AF' : (今日流水.入账 - 今日流水.支出 >= 0 ? '#1D4ED8' : '#DC2626') }}>{!今日流水 ? '—' : ((今日流水.入账 - 今日流水.支出 >= 0 ? '+' : '') + (今日流水.入账 - 今日流水.支出).toLocaleString())}</div>
          <div style={{ fontSize: 9, color: '#9CA3AF' }}>今日净流入</div>
        </div>
      </div>
      {detailOpen && (
        <div style={{ marginBottom: 8, padding: '6px 8px', background: '#F8FAFC', borderRadius: 8, maxHeight: 150, overflowY: 'auto' }}>
          {flowsRef.current.length === 0 && <div style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center', padding: '4px 0' }}>暂无流水记录，经营事件发生后这里会滚动记录</div>}
          {flowsRef.current.map((f, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 10, padding: '3px 0', borderBottom: i < flowsRef.current.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
              <span style={{ color: '#374151', lineHeight: 1.4, flex: 1 }}>{f.text}</span>
              <span style={{ fontWeight: 700, color: f.amt > 0 ? '#16A34A' : '#DC2626', flexShrink: 0 }}>{f.amt > 0 ? '+' : ''}{f.amt}元</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#A96407' }}>📡 实时运营动态</span>
        <span style={{ fontSize: 9, color: '#9CA3AF' }}>按概率随机发生 · 退房12点前 · 入住14点后</span>
      </div>
      {feed.map((f, i) => (
        <div key={f + i} style={{ fontSize: 10, color: i === 0 ? '#374151' : '#9CA3AF', padding: '3px 0', lineHeight: 1.5, opacity: 1 - i * 0.18 }}>
          {f}
        </div>
      ))}
      <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 6, textAlign: 'center' }}>
        {日快照
          ? `今日流水取自引擎日快照（本周第 ${(Number.isInteger(dayIndex) ? dayIndex : 0) + 1}/7 天）· 本周累计 入账 +${本周累计.入账.toLocaleString()} / 支出 -${本周累计.支出.toLocaleString()} · 第 7 天 === 周报周值`
          : '今日流水待本周结算后显示（引擎日快照未就绪）'}
      </div>
    </div>
  )
}

export default function HotelStatus({ report, brand, property, week, history, attrs, attrFlash, decisions, dayFlows, dayIndex }) {
  const occupancy = report ? report.occupancy : (history.length ? history[history.length - 1].occupancy : 0)
  const goodRate = report ? report.finalGoodRate : (history.length ? history[history.length - 1].finalGoodRate : 85)
  // 🔴 E1（二期 · 唯一账本）：累计利润改走 metricDefs.sumNet —— 原自算 `Σ h.profit` 与
  //   FinalResult/TeacherDashboard 的 sumNet 是【两套】口径（旧档缺 netProfit 字段时数值会不同，
  //   同一屏上的"累计利润"可能各说各话）。数值语义零变化（新档 netProfit === profit）。
  const profit = sumNet(history).value
  // RPG 属性池（品质/声誉/士气）：唯一数据源 = state.attrs
  // 旧档无 attrs / 脏数据一律经 normalizeAttrs 兜底（初值 60/70/65），绝不 NaN
  const A = useMemo(() => normalizeAttrs(attrs), [attrs?.quality, attrs?.reputation, attrs?.morale])
  const quality = A.quality // 称号综合分沿用「出租率35%+好评率35%+品质30%」口径，品质改由属性池驱动

  // 模拟日历 + 时钟驱动的入住情况
  // A3：房量唯一权威 = 引擎 parseRooms(brand.standard)（与结算同源）。原先结算前用 property.rooms
  //  （72-95 的"建筑面积"话术）、结算后用引擎值 → 「共 X 间」跳变。物业匹配记为二期教学点。
  const rooms = report?.rooms || parseRooms(brand?.standard) || 70
  const occRooms = report?.occupiedRooms || (history.length ? history[history.length - 1].occupiedRooms : 0) || Math.round(rooms * occupancy / 100)
  const price = report?.price || 230
  // T2.3/E1：种子同步教学日历（原读 getDate() 是设备本地日，08:00 前会与教学日错位）
  const seed = week * 7 + teachingDayOfMonth()

  // 房型结构（大床50% / 双床35% / 套房15%，套房溢价最高）
  const types = useMemo(() => roomTypes(rooms, price), [rooms, price])
  // A1：把真实在店间数 occRooms 按房型总间数比例分摊（最大余数法 ⇒ Σ 各房型在店 === occRooms 严格守恒）
  const occByType = useMemo(() => {
    const totals = types.map(t => t.total)
    const sumT = totals.reduce((a, b) => a + b, 0) || 1
    const raw = totals.map(t => (occRooms * t) / sumT)
    const out = raw.map(v => Math.floor(v))
    let rest = occRooms - out.reduce((a, b) => a + b, 0)
    const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => (b[0] - a[0]) || (a[1] - b[1]))
    for (let k = 0; k < rest; k++) out[order[k % order.length][1]] += 1
    return out
  }, [types, occRooms])

  // 时钟驱动状态：在店人数沿时段曲线浮动
  const [clock, setClock] = useState(new Date())
  const [liveGuests, setLiveGuests] = useState(null)
  const [walkinCount, setWalkinCount] = useState(0)
  const [liveStats, setLiveStats] = useState(null) // LiveFeed 上报的实时统计（退房/入住/在店）
  const [preOpen, setPreOpen] = useState(false) // 明日预抵构成展开
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 30000)
    return () => clearInterval(t)
  }, [])
  const phase = phaseOf(clock.getHours())
  const dayProgress = clock.getHours() + clock.getMinutes() / 60

  const fullGuests = occRooms * 2 - 3
  const targetGuests = Math.max(2, Math.round(fullGuests * phase.curve))
  useEffect(() => {
    setLiveGuests(targetGuests)
    const timer = setInterval(() => {
      setLiveGuests(g => {
        const next = g + (Math.random() < 0.5 ? -1 : 1)
        return Math.max(targetGuests - 3, Math.min(targetGuests + 3, next))
      })
    }, 6000)
    return () => clearInterval(timer)
  }, [targetGuests])

  const checkoutDone = phase.name === '退房高峰'
    ? Math.round(occRooms * 0.4 * ((dayProgress - 6) / 6))
    : dayProgress >= 12 ? Math.round(occRooms * 0.4) : 0
  const checkinDone = dayProgress >= 14
    ? Math.round(occRooms * 0.35 * Math.min((dayProgress - 14) / 6, 1)) + walkinCount
    : 0

  // RPG 三属性（物/名/人）：替代原先"口碑分/满意度"这类好评率派生值
  const attrRows = [
    { key: 'quality', icon: '💎', label: ATTR_LABELS.quality, hint: '硬件·卫生', value: A.quality },
    { key: 'reputation', icon: '⭐', label: ATTR_LABELS.reputation, hint: '口碑·形象', value: A.reputation },
    { key: 'morale', icon: '😊', label: ATTR_LABELS.morale, hint: '团队·状态', value: A.morale },
  ]
  // 经营指标（真实统计值，非派生）：与属性池分开展示，避免"派生值冒充属性"
  const bizRows = [
    { icon: '💯', label: '好评率', value: goodRate, display: goodRate + '%' },
    { icon: '🏠', label: '出租率', value: occupancy, display: occupancy + '%' },
  ]

  // 实时反馈（规格 §8「数字跳动 + 飘字」）：增量由 App 在确认决策时权威下发
  // ⚠️ 不能用"本组件 ref 前后对比"实现——决策面板是全屏替换分支，打开时本组件卸载、
  //    关闭后重新挂载，本地 ref 永远只看到新值（实测踩坑：实例 ID 从 pd0p 变 xe26）。
  const flash = attrFlash && attrFlash.nonce ? attrFlash : null

  const hasData = report || history.length > 0
  const title = getTitle(occupancy, goodRate, quality)
  const dateInfo = useMemo(() => simDate(week), [week])

  const roomsCell = [
    { l: '今日已退房', v: (liveStats ? liveStats.checkout : checkoutDone) + ' 间', c: '#D97706', sub: phase.name === '退房高峰' ? '高峰进行中' : '12:00 前退房' },
    { l: '今日已入住', v: liveStats ? liveStats.checkin + ' 间' : (dayProgress >= 14 ? checkinDone + ' 间' : '未开始'), c: '#16A34A', sub: '14:00 开办入住' },
    // 🔴 §26.2 P0a（2026-09-29 · 用户投诉「60 间店里显示在店客房 75 间」）：
    //    原来这一格取的是 **人数**（liveStats.guests / liveGuests）而单位写「间」⇒ 屏幕上出现
    //    「在店客房 75 间」> 总房量 60 间（一眼即知不可能）。现在【间与人分列】：
    //    · 「在店客房」= **occRooms 口径**（与 settlement.occupiedRooms 同源 · **不许另算**）
    //    · 「在店客人」= guests（**人** · 显式标「估算」）
    //    ★ 守门：dataDict V5 已改成语义判据（「客房/房间/房量」标签的行里不得出现 guests 系标识符）——
    //      所以"人"这一格的标签必须**不含**房间类词，否则会被自己的判据抓到。
    { l: '在店客房', v: occRooms + ' 间', c: '#1D4ED8', live: true, sub: `出租率 ${occupancy}%` },
    { l: '在店客人', v: (liveStats ? liveStats.guests : (liveGuests ?? targetGuests)) + ' 人', c: '#7C3AED', live: true, sub: '按时段曲线估算' },
    { l: '明日预抵', v: Math.max(0, Math.round(occRooms * 0.3 + (seed % 6))) + ' 间', c: '#6B7280' },
  ]

  // 属性池渲染块：结算前后共用（属性是做决策当场变化的真实状态，不该等结算才解锁）
  const attrPanel = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#A96407' }}>🎭 酒店属性</span>
        <span style={{ fontSize: 9, color: '#9CA3AF' }}>做决策立即变化 · 每周自然衰减</span>
      </div>
      {attrRows.map(a => (
        <div key={a.key} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: '#6B7280' }}>{a.icon} {a.label}<span style={{ fontSize: 9, color: '#D1D5DB', marginLeft: 5 }}>{a.hint}</span></span>
            <span style={{ position: 'relative', fontSize: 12, fontWeight: 700, color: barColor(a.value) }}>
              {/* 飘字：属性变化时出现（+5 / -3），1.5s 自动消失 */}
              {flash && flash[a.key] != null && (
                <span
                  className="float-num"
                  key={`${a.key}-${flash[a.key]}-${flash.nonce}`}
                  style={{ '--delay': '0s', position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: -14, fontSize: 12, fontWeight: 800, color: flash[a.key] > 0 ? '#16A34A' : '#DC2626', background: '#fff', border: '1px solid ' + (flash[a.key] > 0 ? '#BBF7D0' : '#FECACA'), borderRadius: 999, padding: '1px 8px', boxShadow: '0 2px 6px rgba(16,24,40,0.10)', pointerEvents: 'none', whiteSpace: 'nowrap' }}
                >
                  {ATTR_LABELS[a.key]} {flash[a.key] > 0 ? '+' : ''}{flash[a.key]}
                </span>
              )}
              {a.value}
            </span>
          </div>
          <div style={{ height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: a.value + '%', background: barColor(a.value), borderRadius: 3, transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)' }}></div>
          </div>
        </div>
      ))}
    </>
  )

  if (!hasData) {
    return (
      <div className="card" style={{ background: '#FFF9F0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card-title" style={{ marginBottom: 0 }}>
            <span style={{ fontSize: 18 }}>🏨</span> 酒店状态
          </div>
          <span style={{ fontSize: 11, color: '#A96407', fontWeight: 600 }}>{brand?.name} · {property?.name}</span>
        </div>
        <div style={{ marginTop: 10, padding: '8px 12px', background: '#FFF4E0', borderRadius: 10, fontSize: 12, fontWeight: 700, color: '#A96407', textAlign: 'center' }}>
          📅 今天是 {dateInfo.text}（{dateInfo.weekday}）· 第 {week} 周经营中 · 当前时段：{phase.name}
        </div>
        {attrPanel}
        <LiveFeed occupiedRooms={6} price={230} week={week} />
        <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '10px 0 4px', lineHeight: 1.8 }}>
          经营指标（好评率 / 出租率）将在首次周结算后解锁<br />
          三个属性从做第一个决策起就实时变化
        </div>
      </div>
    )
  }

  // 属性条配色（规格 §8）：≥80 绿 / 50-79 琥珀 / <50 红
  function barColor(v) {
    if (v >= 80) return '#16A34A'
    if (v >= 50) return '#E8940F'
    return '#DC2626'
  }

  return (
    <div className="card" style={{ background: '#FFF9F0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>
          <span style={{ fontSize: 18 }}>🏨</span> 酒店状态
        </div>
        <span style={{ fontSize: 11, color: '#A96407', fontWeight: 600 }}>
          累计利润 {profit >= 0 ? '+' : ''}{(profit / 10000).toFixed(2)}万
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFF4E0', borderRadius: 10, padding: '7px 12px', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#A96407' }}>📅 今天是 {dateInfo.text}（{dateInfo.weekday}）</span>
        <span style={{ fontSize: 10, color: '#9CA3AF' }}>第 {week} 周 · 开业第 {(week - 1) * 7 + new Date().getDay() + 1} 天</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '6px 12px', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#065F46' }}>⏰ 当前运营时段：{phase.name}（{phase.window}）</span>
        <span style={{ fontSize: 9, color: '#9CA3AF' }}>退房12点前 · 入住14点后</span>
      </div>

      {/* RPG称号条 */}
      <div style={{ background: 'linear-gradient(90deg,#FFF4E0,#FFFFFF)', border: '1px solid #FBE3B3', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#A96407' }}>{title.icon} {title.title}</span>
          <span style={{ fontSize: 10, color: '#9CA3AF' }}>综合 {title.composite}</span>
        </div>
        <div style={{ height: 5, background: '#F3F4F6', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: title.progress + '%', background: '#E8940F', borderRadius: 3, transition: 'width 0.5s' }}></div>
        </div>
        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
          {title.next ? `再提升经营指标即可晋升「${title.next}」` : '已是最高称号'}
        </div>
      </div>

      {/* 今日入住情况 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {roomsCell.map(s => (
          <div key={s.l} onClick={s.click ? () => setPreOpen(o => !o) : undefined} style={{ background: '#fff', borderRadius: 10, padding: '8px 10px', cursor: s.click ? 'pointer' : 'default' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: s.c }}>{s.v}{s.live && <span style={{ fontSize: 9, color: '#10B981', marginLeft: 4 }}>● 实时</span>}</div>
            <div style={{ fontSize: 10, color: '#9CA3AF' }}>{s.l} · {s.click && preOpen ? '点击收起' : s.sub}{s.click && !preOpen ? '（点击看构成）' : ''}</div>
          </div>
        ))}
      </div>
      {/* 明日预抵构成（按客群与房型拆分） */}
      {preOpen && (() => {
        const total = Math.max(0, Math.round(occRooms * 0.3 + (seed % 6)))
        const biz = Math.round(total * 0.5), tour = Math.round(total * 0.3), fam = total - biz - tour
        const big = Math.round(total * 0.5), twin = Math.round(total * 0.35), suite = total - big - twin
        return (
          <div style={{ marginBottom: 12, padding: '8px 10px', background: '#F8FAFC', borderRadius: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#1E40AF', marginBottom: 4 }}>📋 预抵客人构成（按客群）</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, background: '#EFF6FF', color: '#1E40AF', borderRadius: 5, padding: '2px 8px' }}>商务 {biz} 间</span>
              <span style={{ fontSize: 10, background: '#ECFDF5', color: '#065F46', borderRadius: 5, padding: '2px 8px' }}>旅游 {tour} 间</span>
              <span style={{ fontSize: 10, background: '#FFF4E0', color: '#A96407', borderRadius: 5, padding: '2px 8px' }}>家庭 {fam} 间</span>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#1E40AF', marginBottom: 4 }}>🛏️ 按房型</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, background: '#F9FAFB', color: '#374151', borderRadius: 5, padding: '2px 8px' }}>大床 {big} 间</span>
              <span style={{ fontSize: 10, background: '#F9FAFB', color: '#374151', borderRadius: 5, padding: '2px 8px' }}>双床 {twin} 间</span>
              <span style={{ fontSize: 10, background: '#F9FAFB', color: '#374151', borderRadius: 5, padding: '2px 8px' }}>套房 {suite} 间</span>
            </div>
            <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 5 }}>💡 建议按预抵构成提前排房：团队连排、商务高楼层、家庭相邻间</div>
          </div>
        )
      })()}

      {/* RPG 属性池：品质 / 声誉 / 士气（做决策当场变化并飘字） */}
      {attrPanel}

      {/* 经营指标（真实统计值，非派生）：好评率 / 出租率 */}
      <div style={{ display: 'flex', gap: 8, marginTop: 2, marginBottom: 4 }}>
        {bizRows.map(b => (
          <div key={b.label} style={{ flex: 1, background: '#fff', borderRadius: 10, padding: '7px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{b.display}</div>
            <div style={{ fontSize: 9, color: '#9CA3AF' }}>{b.icon} {b.label}</div>
          </div>
        ))}
      </div>

      {/* 房型结构（档次越高价格越高，匹配成本） */}
      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#A96407', marginBottom: 6 }}>🛏️ 房型结构（共 {rooms} 间）</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {types.map((tp, idx) => (
            <div key={tp.name} style={{ background: '#fff', borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{tp.name}</div>
              <div style={{ fontSize: 11, color: '#A96407', fontWeight: 700 }}>{tp.price}元/晚</div>
              <div style={{ fontSize: 9, color: '#9CA3AF' }}>{tp.total} 间 · 在店 {occByType[idx]}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>套房面积大、成本高，定价也最高——档次与价格匹配</div>
      </div>

      {/* ★ §26.3：dayFlows = App 以【与 doSettle 同一套入参】跑出的预览结算的 dailySnapshots（7 天）
          ⇒ 面板"今日流水"与周报/结算**同源**。dayIndex 由 App 传 1-based（教学日序号推导），此处转 0-based。 */}
      <LiveFeed occupiedRooms={occRooms} price={price} week={week} rooms={rooms} brandLevel={brand?.level} attrs={A} decisions={decisions} onStats={setLiveStats} dayFlows={dayFlows} dayIndex={(Number(dayIndex) || 1) - 1} />

      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 8, textAlign: 'center' }}>
        {brand?.name} · {property?.name} · 共 {rooms} 间房 · 第 {week} 周
      </div>
    </div>
  )
}
