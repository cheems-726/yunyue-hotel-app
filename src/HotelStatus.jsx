import React, { useState, useEffect, useMemo } from 'react'
import { getTitle } from './hotelTitle.js'

// 酒店状态面板：RPG 属性面板 + 模拟日历 + 按真实作息驱动的实时运营动态
// 真实规则：退房 12:00 前 / 入住 14:00 后；事件类型和在店人数都跟随现实时钟
const OPENING = { month: 3, day: 1 }
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function simDate(week) {
  const base = new Date(new Date().getFullYear(), OPENING.month - 1, OPENING.day)
  const today = new Date()
  const offset = (week - 1) * 7 + today.getDay()
  const d = new Date(base.getTime() + offset * 86400000)
  return { text: `${d.getMonth() + 1}月${d.getDate()}日`, weekday: WEEKDAYS[today.getDay()] }
}

function fmtTime() {
  const n = new Date()
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
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

// 按时段生成一条运营动态：{ text, amt }（amt=资金流水，0 为服务性事件不进流水）
function genEvent(phase, rooms, price) {
  const room = 100 + Math.floor(Math.random() * 5) * 100 + Math.floor(Math.random() * 8) + 1
  const roll = Math.random()
  const h = new Date().getHours()
  const roomFee = () => Math.round(price * (0.85 + Math.random() * 0.3))
  if (phase.checkout > 0 && roll < 0.42) {
    return { text: `🧳 ${fmtTime()} · ${room}房退房结账（12:00 前退房）`, amt: roomFee() }
  }
  if (phase.checkout > 0 && roll < 0.58) {
    return { text: `🧹 ${fmtTime()} · 客房部抢清 ${2 + Math.floor(Math.random() * 6)} 间退房客房`, amt: 0 }
  }
  if (phase.checkin > 0 && roll < 0.42) {
    const mix = ['商务出差', '家庭出游', '旅行散客', '会议客人']
    return { text: `🛎️ ${fmtTime()} · ${room}房办理入住（14:00 后）· ${mix[Math.floor(Math.random() * mix.length)]}客人`, amt: roomFee() }
  }
  if (phase.checkin > 0 && roll < 0.55) {
    return { text: `🛄 ${fmtTime()} · 提前到店客人的行李已寄存前台`, amt: 0 }
  }
  if (h >= 23 || h < 6) {
    if (roll < 0.3) return { text: `🌙 ${fmtTime()} · 夜班保安巡场完毕，楼层安静`, amt: 0 }
    if (roll < 0.55) return { text: `🔦 ${fmtTime()} · 夜班前台接待 1 位深夜到店客人`, amt: Math.round(price * 0.9) }
    if (roll < 0.75) return { text: `🔧 ${fmtTime()} · 值班工程师完成锅炉房夜间巡检`, amt: 0 }
    return { text: `🌃 ${fmtTime()} · 出租率保持稳定，夜班一切正常`, amt: 0 }
  }
  if (roll < 0.3) return { text: `🧹 ${fmtTime()} · 客房部完成 ${2 + Math.floor(Math.random() * 6)} 间客房清扫`, amt: 0 }
  if (roll < 0.38) return { text: `🔧 ${fmtTime()} · ${room}房空调维修，更换零件`, amt: -(80 + Math.floor(Math.random() * 220)) }
  if (roll < 0.46) return { text: `💬 ${fmtTime()} · 前台收到客人口头表扬 · 服务亲切`, amt: 0 }
  if (roll < 0.53) return { text: `💳 ${fmtTime()} · 为 ${room}房客人退还押金`, amt: -100 }
  if (roll < 0.6) return { text: `⭐ ${fmtTime()} · 前台转化 1 名会员 · 赠送欢迎水果`, amt: -15 }
  if (roll < 0.67) return { text: `📞 ${fmtTime()} · 商务客人来电咨询长租协议价`, amt: 0 }
  if (roll < 0.73) return { text: `🛒 ${fmtTime()} · 客房部补充易耗品（洗漱用品/瓶装水）`, amt: -(60 + Math.floor(Math.random() * 120)) }
  if (roll < 0.79) return { text: `🍬 ${fmtTime()} · 大堂便利角售出零食饮料`, amt: 15 + Math.floor(Math.random() * 60) }
  if (roll < 0.85) return { text: `😤 ${fmtTime()} · 处理客诉，赠送果盘致歉`, amt: -(50 + Math.floor(Math.random() * 100)) }
  if (roll < 0.91) return { text: `🍳 ${fmtTime()} · 餐厅备餐（明日早餐 6:30-10:00）`, amt: 0 }
  return { text: `🚕 ${fmtTime()} · 前台协助退房客人叫车搬运行李`, amt: 0 }
}

// 实时动态流 + 今日资金流水（同源联动；按当前时段事件池生成，深夜自动降频）
function LiveFeed({ occupiedRooms, price }) {
  const [feed, setFeed] = useState([])
  const [flow, setFlow] = useState({ income: 0, expense: 0 })
  useEffect(() => {
    const rooms = Math.max(occupiedRooms, 8)
    const p = price || 230
    // 回放今天已发生的量级估算（按作息：白天退房入账为主，14点后入住入账）
    const nowH = new Date().getHours()
    let inc = 0, exp = 0
    // 口径：日房费收入 ≈ 在店间数 × 房价（与引擎出租率口径一致）
    if (nowH >= 6) { inc += occupiedRooms * p * 0.5; exp += 120 + (occupiedRooms % 7) * 30 }
    if (nowH >= 14) { inc += occupiedRooms * p * 0.35 }
    if (nowH >= 20) { inc += occupiedRooms * p * 0.1; exp += 200 }
    setFlow({ income: Math.round(inc), expense: Math.round(exp) })
    const push = () => {
      const ev = genEvent(phaseOf(new Date().getHours()), rooms, p)
      setFeed(f => [ev.text, ...f].slice(0, 4))
      if (ev.amt > 0) setFlow(fl => ({ ...fl, income: fl.income + ev.amt }))
      else if (ev.amt < 0) setFlow(fl => ({ ...fl, expense: fl.expense - ev.amt }))
    }
    push(); push()
    let timer
    const loop = () => {
      push()
      timer = setTimeout(loop, phaseOf(new Date().getHours()).speed)
    }
    timer = setTimeout(loop, 4000)
    return () => clearTimeout(timer)
  }, [occupiedRooms, price])

  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #FBE3B3' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '6px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#16A34A' }}>+{flow.income.toLocaleString()}</div>
          <div style={{ fontSize: 9, color: '#9CA3AF' }}>今日入账</div>
        </div>
        <div style={{ background: '#FEF2F2', borderRadius: 8, padding: '6px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626' }}>-{flow.expense.toLocaleString()}</div>
          <div style={{ fontSize: 9, color: '#9CA3AF' }}>今日支出</div>
        </div>
        <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '6px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: flow.income - flow.expense >= 0 ? '#1D4ED8' : '#DC2626' }}>{flow.income - flow.expense >= 0 ? '+' : ''}{(flow.income - flow.expense).toLocaleString()}</div>
          <div style={{ fontSize: 9, color: '#9CA3AF' }}>今日净流入</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#A96407' }}>📡 实时运营动态</span>
        <span style={{ fontSize: 9, color: '#9CA3AF' }}>按真实时间发生 · 退房12点前 · 入住14点后</span>
      </div>
      {feed.map((f, i) => (
        <div key={f + i} style={{ fontSize: 10, color: i === 0 ? '#374151' : '#9CA3AF', padding: '3px 0', lineHeight: 1.5, opacity: 1 - i * 0.18 }}>
          {f}
        </div>
      ))}
      <div style={{ fontSize: 9, color: '#D1D5DB', marginTop: 6, textAlign: 'center' }}>今日流水为抽样估算，实际收支以每周结算为准</div>
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
  const seed = week * 7 + (new Date().getDate())

  // 时钟驱动状态：在店人数沿时段曲线浮动；今日已退房/已入住按现实时刻累计
  const [clock, setClock] = useState(new Date())
  const [liveGuests, setLiveGuests] = useState(null)
  const [walkinCount, setWalkinCount] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 30000)
    return () => clearInterval(t)
  }, [])
  const phase = phaseOf(clock.getHours())
  const dayProgress = clock.getHours() + clock.getMinutes() / 60

  // 基准在店人数（晚满、早空的日曲线 × 满租在店）
  const fullGuests = occRooms * 2 - 3
  const targetGuests = Math.max(2, Math.round(fullGuests * phase.curve))
  useEffect(() => {
    // 目标变化（时段切换）时直接贴合，之后 4 秒一次微波动
    setLiveGuests(targetGuests)
    const timer = setInterval(() => {
      setLiveGuests(g => {
        const next = g + (Math.random() < 0.5 ? -1 : 1)
        return Math.max(targetGuests - 3, Math.min(targetGuests + 3, next))
      })
    }, 4000)
    return () => clearInterval(timer)
  }, [targetGuests])

  // 已退房/已入住按时刻推算（真实规则）：退房 6-12 点线性发生，入住 14-22 点线性发生
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
    { l: '今日已退房', v: checkoutDone + ' 间', c: '#D97706', sub: phase.name === '退房高峰' ? '高峰进行中' : '12:00 前退房' },
    { l: '今日已入住', v: dayProgress >= 14 ? checkinDone + ' 间' : '未开始', c: '#16A34A', sub: dayProgress >= 14 ? '14:00 后办理' : '14:00 开办入住' },
    { l: '在店客人', v: (liveGuests ?? targetGuests) + ' 人', c: '#1D4ED8', live: true },
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
        <LiveFeed occupiedRooms={6} price={230} />
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

      {/* 模拟日历 + 运营时段 */}
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

      {/* 今日入住情况（按时钟语义变化） */}
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

      <LiveFeed occupiedRooms={occRooms} price={report?.price || 230} />

      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 8, textAlign: 'center' }}>
        {brand?.name} · {property?.name} · 共 {rooms} 间房 · 第 {week} 周
      </div>
    </div>
  )
}
