import React, { useState, useEffect, useMemo } from 'react'
import { getTitle } from './hotelTitle.js'

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

// 按游戏内时刻生成一条运营动态：{ clock, text, amt }（amt=资金流水，0 为服务性事件）
function genEvent(gameMin, phase, price) {
  const roll = Math.random()
  const clockTag = fmtGameClock(gameMin)
  const room = 100 + Math.floor(Math.random() * 5) * 100 + Math.floor(Math.random() * 8) + 1
  const roomFee = () => Math.round(price * (0.85 + Math.random() * 0.3))
  const pick = arr => arr[Math.floor(Math.random() * arr.length)]
  const h = Math.floor(((gameMin % 1440) + 1440) % 1440 / 60)
  if (phase.checkout > 0 && roll < 0.42) {
    return { clock: clockTag, text: `🧳 ${room}房退房结账（12:00 前退房）`, amt: roomFee() }
  }
  if (phase.checkout > 0 && roll < 0.58) {
    return { clock: clockTag, text: `🧹 客房部抢清 ${2 + Math.floor(Math.random() * 6)} 间退房客房`, amt: 0 }
  }
  if (phase.checkin > 0 && roll < 0.42) {
    return { clock: clockTag, text: `🛎️ ${room}房办理入住（14:00 后）· ${pick(['商务出差', '家庭出游', '旅行散客', '会议客人'])}客人`, amt: roomFee() }
  }
  if (phase.checkin > 0 && roll < 0.55) {
    return { clock: clockTag, text: `🛄 提前到店客人的行李已寄存前台`, amt: 0 }
  }
  if (h >= 23 || h < 6) {
    if (roll < 0.3) return { clock: clockTag, text: `🌙 夜班保安巡场完毕，楼层安静`, amt: 0 }
    if (roll < 0.55) return { clock: clockTag, text: `🔦 夜班前台接待 1 位深夜到店客人`, amt: Math.round(price * 0.9) }
    if (roll < 0.75) return { clock: clockTag, text: `🔧 值班工程师完成锅炉房夜间巡检`, amt: 0 }
    return { clock: clockTag, text: `🌃 出租率保持稳定，夜班一切正常`, amt: 0 }
  }
  if (roll < 0.3) return { clock: clockTag, text: `🧹 客房部完成 ${2 + Math.floor(Math.random() * 6)} 间客房清扫`, amt: 0 }
  if (roll < 0.38) return { clock: clockTag, text: `🔧 ${room}房空调维修，更换零件`, amt: -(80 + Math.floor(Math.random() * 220)) }
  if (roll < 0.46) return { clock: clockTag, text: `💬 前台收到客人口头表扬 · 服务亲切`, amt: 0 }
  if (roll < 0.53) return { clock: clockTag, text: `💳 为 ${room}房客人退还押金`, amt: -100 }
  if (roll < 0.6) return { clock: clockTag, text: `⭐ 前台转化 1 名会员 · 赠送欢迎水果`, amt: -15 }
  if (roll < 0.67) return { clock: clockTag, text: `📞 商务客人来电咨询长租协议价`, amt: 0 }
  if (roll < 0.73) return { clock: clockTag, text: `🛒 客房部补充易耗品（洗漱用品/瓶装水）`, amt: -(60 + Math.floor(Math.random() * 120)) }
  if (roll < 0.79) return { clock: clockTag, text: `🍬 大堂便利角售出零食饮料`, amt: 15 + Math.floor(Math.random() * 60) }
  if (roll < 0.85) return { clock: clockTag, text: `😤 处理客诉，赠送果盘致歉`, amt: -(50 + Math.floor(Math.random() * 100)) }
  if (roll < 0.91) return { clock: clockTag, text: `🍳 餐厅备餐（明日早餐 6:30-10:00）`, amt: 0 }
  return { clock: clockTag, text: `🚕 前台协助退房客人叫车搬运行李`, amt: 0 }
}

// 实时运营流：游戏内时钟连续流动（现实2秒=游戏1分钟），
// 事件按概率随机触发；流水/统计持久化到 localStorage（按日期+周为键），刷新不回退
// 退房后进入待清扫队列，到期自动生成清扫事件并扣耗材成本
const EVENT_PROB = { checkout: 0.04, checkin: 0.03, misc: 0.012, night: 0.006 }
const CLEAN_FEE = 25

function LiveFeed({ occupiedRooms, price, week, onStats }) {
  const [feed, setFeed] = useState([])
  const [stats, setStats] = useState({ checkout: 0, checkin: 0, income: 0, expense: 0, guests: Math.round(occupiedRooms * 2 - 3) })
  const statsRef = React.useRef(stats)
  statsRef.current = stats

  useEffect(() => {
    const p = price || 230
    const dateKey = new Date().toISOString().slice(0, 10)
    const storeKey = `hotel-live-${dateKey}-w${week || 1}`
    // 恢复（刷新不回退）；无存档则按当前时刻回放估算
    let st
    try {
      const raw = localStorage.getItem(storeKey)
      st = raw ? JSON.parse(raw) : null
    } catch (e) { st = null }
    if (!st || typeof st.income !== 'number') {
      const nowH = new Date().getHours()
      let inc = 0, exp = 0
      if (nowH >= 6) { inc = Math.round(occupiedRooms * p * 0.5); exp = 120 }
      if (nowH >= 14) inc += Math.round(occupiedRooms * p * 0.35)
      if (nowH >= 20) { inc += Math.round(occupiedRooms * p * 0.1); exp += 200 }
      const n = new Date()
      st = {
        income: inc, expense: exp, checkout: 0, checkin: 0,
        guests: Math.max(4, Math.round(occupiedRooms * 2 - 3)),
        gameMin: nowH * 60 + n.getMinutes(), pendingClean: [], feed: [],
      }
    }
    if (!Array.isArray(st.pendingClean)) st.pendingClean = []
    if (!Array.isArray(st.feed)) st.feed = []
    setStats({ checkout: st.checkout, checkin: st.checkin, income: st.income, expense: st.expense, guests: st.guests })
    setFeed(st.feed)
    let gameMin = st.gameMin || new Date().getHours() * 60 + new Date().getMinutes()
    let pendingClean = st.pendingClean

    const persist = () => {
      const s = statsRef.current
      try { localStorage.setItem(storeKey, JSON.stringify({ income: s.income, expense: s.expense, checkout: s.checkout, checkin: s.checkin, guests: s.guests, gameMin, pendingClean, feed: feedRef.current })) } catch (e) {}
    }
    const feedRef = { current: st.feed }
    const pushFeed = (text, amt) => {
      const line = (amt ? (amt > 0 ? ` +${amt}元` : ` ${amt}元`) : '')
      const entry = `${text}${line}`
      feedRef.current = [entry, ...feedRef.current].slice(0, 4)
      setFeed(feedRef.current)
    }
    const apply = (patch) => {
      setStats(s => {
        const next = { ...s, ...patch }
        statsRef.current = next
        if (onStats) onStats({ checkout: next.checkout, checkin: next.checkin, guests: next.guests, income: next.income, expense: next.expense })
        return next
      })
    }

    let timer
    const loop = () => {
      gameMin += 1
      const hm = ((gameMin % 1440) + 1440) % 1440
      const h = Math.floor(hm / 60)
      const clockTag = `${String(h).padStart(2, '0')}:${String(hm % 60).padStart(2, '0')}`
      const ph = phaseOf(h)
      const s = statsRef.current
      const room = 100 + Math.floor(Math.random() * 5) * 100 + Math.floor(Math.random() * 8) + 1
      const roll = Math.random()

      // 到期的清扫任务：退房后 15-35 游戏分钟完成，扣耗材成本
      const due = pendingClean.filter(x => x.due <= gameMin)
      if (due.length) {
        pendingClean = pendingClean.filter(x => x.due > gameMin)
        due.forEach(x => {
          apply({ expense: statsRef.current.expense + CLEAN_FEE })
          pushFeed(`🧹 [${clockTag}] ${x.room}房退房清扫完成，耗材成本 ${CLEAN_FEE} 元`, -CLEAN_FEE)
        })
      }

      if (ph.checkout > 0 && roll < EVENT_PROB.checkout && s.checkout + s.checkin < Math.round(occupiedRooms * 0.8)) {
        const fee = Math.round(p * (0.85 + Math.random() * 0.3))
        pendingClean.push({ room, due: gameMin + 15 + Math.floor(Math.random() * 20) })
        apply({ checkout: s.checkout + 1, guests: Math.max(4, s.guests - 2), income: s.income + fee })
        pushFeed(`🧳 [${clockTag}] ${room}房客人退房结账（12:00 前退房），收款 ${fee} 元`, fee)
      } else if (ph.checkin > 0 && roll < EVENT_PROB.checkin && s.checkin < Math.round(occupiedRooms * 0.6)) {
        const fee = Math.round(p * (0.85 + Math.random() * 0.3))
        const g = ['商务出差', '家庭出游', '旅行散客', '会议客人'][Math.floor(Math.random() * 4)]
        apply({ checkin: s.checkin + 1, guests: s.guests + 2, income: s.income + fee })
        pushFeed(`🛎️ [${clockTag}] ${room}房办理入住（14:00 后）· ${g}客人，收房费 ${fee} 元`, fee)
      } else if (roll < EVENT_PROB.misc && h >= 8 && h < 22) {
        const evs = [
          { t: `🔧 ${room}房空调维修，更换零件`, amt: -(80 + Math.floor(Math.random() * 220)) },
          { t: `🛒 客房部补充易耗品（洗漱用品/瓶装水）`, amt: -(60 + Math.floor(Math.random() * 120)) },
          { t: `🍬 大堂便利角售出零食饮料`, amt: 15 + Math.floor(Math.random() * 60) },
          { t: `😤 处理客诉，赠送果盘致歉`, amt: -(50 + Math.floor(Math.random() * 100)) },
          { t: `⭐ 前台转化 1 名会员 · 赠送欢迎水果`, amt: -15 },
          { t: `💳 为 ${room}房客人退还押金`, amt: -100 },
        ]
        const ev = evs[Math.floor(Math.random() * evs.length)]
        if (ev.amt > 0) apply({ income: statsRef.current.income + ev.amt })
        else if (ev.amt < 0) apply({ expense: statsRef.current.expense - ev.amt })
        pushFeed(`🕐 [${clockTag}] ${ev.t}`, ev.amt)
      } else if ((h >= 23 || h < 6) && roll < EVENT_PROB.night) {
        const evs = [
          { t: `🌙 夜班保安巡场完毕，楼层安静`, amt: 0 },
          { t: `🔦 夜班前台接待 1 位深夜到店客人`, amt: Math.round(p * 0.9) },
        ]
        const ev = evs[Math.floor(Math.random() * evs.length)]
        if (ev.amt > 0) apply({ income: statsRef.current.income + ev.amt })
        pushFeed(`🌙 [${clockTag}] ${ev.t}`, ev.amt)
      }
      persist()
      timer = setTimeout(loop, 2000)
    }
    timer = setTimeout(loop, 1500)
    return () => clearTimeout(timer)
  }, [occupiedRooms, price, week])

  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #FBE3B3' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '6px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#16A34A' }}>+{stats.income.toLocaleString()}</div>
          <div style={{ fontSize: 9, color: '#9CA3AF' }}>今日入账</div>
        </div>
        <div style={{ background: '#FEF2F2', borderRadius: 8, padding: '6px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626' }}>-{stats.expense.toLocaleString()}</div>
          <div style={{ fontSize: 9, color: '#9CA3AF' }}>今日支出</div>
        </div>
        <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '6px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: stats.income - stats.expense >= 0 ? '#1D4ED8' : '#DC2626' }}>{stats.income - stats.expense >= 0 ? '+' : ''}{(stats.income - stats.expense).toLocaleString()}</div>
          <div style={{ fontSize: 9, color: '#9CA3AF' }}>今日净流入</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#A96407' }}>📡 实时运营动态</span>
        <span style={{ fontSize: 9, color: '#9CA3AF' }}>按概率随机发生 · 退房12点前 · 入住14点后</span>
      </div>
      {feed.map((f, i) => (
        <div key={f + i} style={{ fontSize: 10, color: i === 0 ? '#374151' : '#9CA3AF', padding: '3px 0', lineHeight: 1.5, opacity: 1 - i * 0.18 }}>
          {f}
        </div>
      ))}
      <div style={{ fontSize: 9, color: '#D1D5DB', marginTop: 6, textAlign: 'center' }}>今日流水为模拟估算，实际收支以每周结算为准</div>
    </div>
  )
}

export default function HotelStatus({ report, brand, property, week, history }) {
  const occupancy = report ? report.occupancy : (history.length ? history[history.length - 1].occupancy : 0)
  const goodRate = report ? report.finalGoodRate : (history.length ? history[history.length - 1].finalGoodRate : 85)
  const reputationScore = (goodRate / 20).toFixed(1)
  const profit = history.reduce((s, h) => s + h.profit, 0)
  const satisfaction = Math.min(100, Math.round(goodRate * 1.1))
  const brandLevel = brand?.level || ''
  const quality = brandLevel.includes('经济') ? 60 : brandLevel.includes('中档') ? 75 : brandLevel.includes('高档') ? 90 : brandLevel.includes('奢华') ? 95 : 70

  // 模拟日历 + 时钟驱动的入住情况
  const rooms = report?.rooms || (property?.rooms && Number(property.rooms.match(/(\d+)/)?.[1])) || 70
  const occRooms = report?.occupiedRooms || (history.length ? history[history.length - 1].occupiedRooms : 0) || Math.round(rooms * occupancy / 100)
  const price = report?.price || 230
  const seed = week * 7 + (new Date().getDate())

  // 房型结构（大床50% / 双床35% / 套房15%，套房溢价最高）
  const types = useMemo(() => roomTypes(rooms, price), [rooms, price])

  // 时钟驱动状态：在店人数沿时段曲线浮动
  const [clock, setClock] = useState(new Date())
  const [liveGuests, setLiveGuests] = useState(null)
  const [walkinCount, setWalkinCount] = useState(0)
  const [liveStats, setLiveStats] = useState(null) // LiveFeed 上报的实时统计（退房/入住/在店）
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

  const attrs = [
    { icon: '⭐', label: '口碑分', value: reputationScore, max: 5, display: reputationScore + ' / 5' },
    { icon: '💯', label: '好评率', value: goodRate, max: 100, display: goodRate + '%' },
    { icon: '😊', label: '满意度', value: satisfaction, max: 100, display: satisfaction + '%' },
    { icon: '🏠', label: '出租率', value: occupancy, max: 100, display: occupancy + '%' },
    { icon: '💎', label: '品质分', value: quality, max: 100, display: quality + '' },
  ]

  const hasData = report || history.length > 0
  const title = getTitle(occupancy, goodRate, quality)
  const dateInfo = useMemo(() => simDate(week), [week])

  const roomsCell = [
    { l: '今日已退房', v: (liveStats ? liveStats.checkout : checkoutDone) + ' 间', c: '#D97706', sub: phase.name === '退房高峰' ? '高峰进行中' : '12:00 前退房' },
    { l: '今日已入住', v: liveStats ? liveStats.checkin + ' 间' : (dayProgress >= 14 ? checkinDone + ' 间' : '未开始'), c: '#16A34A', sub: '14:00 开办入住' },
    { l: '在店客人', v: (liveStats ? liveStats.guests : (liveGuests ?? targetGuests)) + ' 人', c: '#1D4ED8', live: true },
    { l: '明日预抵', v: Math.max(0, Math.round(occRooms * 0.3 + (seed % 6))) + ' 间', c: '#6B7280' },
  ]

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
        <LiveFeed occupiedRooms={6} price={230} week={week} />
        <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '10px 0 4px', lineHeight: 1.8 }}>
          属性面板将在首次周结算后解锁<br />
          届时可实时查看：口碑分 / 好评率 / 满意度 / 出租率 / 品质分
        </div>
      </div>
    )
  }

  function barColor(v) {
    if (v >= 80) return '#16A34A'
    if (v >= 60) return '#E8940F'
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
          <div key={s.l} style={{ background: '#fff', borderRadius: 10, padding: '8px 10px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: s.c }}>{s.v}{s.live && <span style={{ fontSize: 9, color: '#10B981', marginLeft: 4 }}>● 实时</span>}</div>
            <div style={{ fontSize: 10, color: '#9CA3AF' }}>{s.l} · {s.sub}</div>
          </div>
        ))}
      </div>

      {attrs.map(a => (
        <div key={a.label} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: '#6B7280' }}>{a.icon} {a.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: barColor(a.value / a.max * 100) }}>{a.display}</span>
          </div>
          <div style={{ height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: (a.value / a.max * 100) + '%', background: barColor(a.value / a.max * 100), borderRadius: 3, transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)' }}></div>
          </div>
        </div>
      ))}

      {/* 房型结构（档次越高价格越高，匹配成本） */}
      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#A96407', marginBottom: 6 }}>🛏️ 房型结构（共 {rooms} 间）</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {types.map(tp => (
            <div key={tp.name} style={{ background: '#fff', borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{tp.name}</div>
              <div style={{ fontSize: 11, color: '#A96407', fontWeight: 700 }}>{tp.price}元/晚</div>
              <div style={{ fontSize: 9, color: '#9CA3AF' }}>{tp.total} 间 · 在店 {Math.round(tp.total * tp.occRate)}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>套房面积大、成本高，定价也最高——档次与价格匹配</div>
      </div>

      <LiveFeed occupiedRooms={occRooms} price={price} week={week} onStats={setLiveStats} />

      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 8, textAlign: 'center' }}>
        {brand?.name} · {property?.name} · 共 {rooms} 间房 · 第 {week} 周
      </div>
    </div>
  )
}
