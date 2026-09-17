import React, { useState, useEffect, useMemo } from 'react'
import { getTitle } from './hotelTitle.js'

// 酒店状态面板：RPG 属性面板 + 模拟日历 + 实时运营动态（展示层随机，不动引擎数据）
// 模拟日历：第1周周一 = 3月1日（春季学期开局），每周7天推进；周内"今天"对应现实星期几
const OPENING = { month: 3, day: 1 }
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function simDate(week) {
  const base = new Date(new Date().getFullYear(), OPENING.month - 1, OPENING.day)
  const today = new Date()
  const offset = (week - 1) * 7 + today.getDay()
  const d = new Date(base.getTime() + offset * 86400000)
  return { text: `${d.getMonth() + 1}月${d.getDate()}日`, weekday: WEEKDAYS[today.getDay()], date: d }
}

function fmtTime() {
  const n = new Date()
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
}

// 运营动态流：每几秒随机生成一条前台/客房/工程动态（纯展示随机）
function LiveFeed({ occupiedRooms, guestMix }) {
  const [feed, setFeed] = useState([])
  useEffect(() => {
    const rooms = Math.max(occupiedRooms, 8)
    const gen = () => {
      const room = 100 + Math.floor(Math.random() * 5) * 100 + Math.floor(Math.random() * 8) + 1
      const roll = Math.random()
      if (roll < 0.22) return `🕐 ${fmtTime()} · ${room}房客人退房，客房部已进场清扫`
      if (roll < 0.42) {
        const g = guestMix[Math.floor(Math.random() * guestMix.length)]
        return `🛎️ ${fmtTime()} · ${room}房办理入住 · ${g}客人`
      }
      if (roll < 0.56) return `🧹 ${fmtTime()} · 客房部完成 ${2 + Math.floor(Math.random() * 6)} 间客房清扫`
      if (roll < 0.66) return `🔧 ${fmtTime()} · 工程部完成 ${room}房设备巡检`
      if (roll < 0.74) return `💬 ${fmtTime()} · 前台收到客人口头表扬 · 服务亲切`
      if (roll < 0.82) return `💳 ${fmtTime()} · 前台为 ${room}房客人办理押金退还`
      if (roll < 0.9) return `⭐ ${fmtTime()} · 前台转化 1 名会员 · 赠送欢迎水果`
      return `📞 ${fmtTime()} · 商务客人来电咨询长租协议价`
    }
    setFeed([gen(), gen(), gen()])
    const timer = setInterval(() => {
      setFeed(f => [gen(), ...f].slice(0, 4))
    }, 4000)
    return () => clearInterval(timer)
  }, [occupiedRooms])

  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #FBE3B3' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#A96407', marginBottom: 6 }}>📡 实时运营动态</div>
      {feed.map((f, i) => (
        <div key={f + i} style={{ fontSize: 10, color: i === 0 ? '#374151' : '#9CA3AF', padding: '3px 0', lineHeight: 1.5, opacity: 1 - i * 0.18 }}>
          {f}
        </div>
      ))}
    </div>
  )
}

export default function HotelStatus({ report, brand, property, week, history }) {
  // 从结算结果和品牌推导当前属性
  const occupancy = report ? report.occupancy : (history.length ? history[history.length - 1].occupancy : 0)
  const goodRate = report ? report.finalGoodRate : (history.length ? history[history.length - 1].finalGoodRate : 85)
  const reputationScore = (goodRate / 20).toFixed(1) // 好评率 → 5分制
  const profit = history.reduce((s, h) => s + h.profit, 0)

  // 满意度（简化：由好评率推导）
  const satisfaction = Math.min(100, Math.round(goodRate * 1.1))

  // 品质分（由品牌档次推导）
  const brandLevel = brand?.level || ''
  const quality = brandLevel.includes('经济') ? 60 : brandLevel.includes('中档') ? 75 : brandLevel.includes('高档') ? 90 : brandLevel.includes('奢华') ? 95 : 70

  // 模拟日历 + 今日入住情况（基准由数据决定，实时跳动由 interval 驱动）
  const rooms = report?.rooms || (property?.rooms && Number(property.rooms.match(/(\d+)/)?.[1])) || 70
  const occRooms = report?.occupiedRooms || (history.length ? history[history.length - 1].occupiedRooms : 0) || Math.round(rooms * occupancy / 100)
  const seed = week * 7 + (new Date().getDate())
  const checkinToday = Math.max(1, Math.round(occRooms * 0.45 + (seed % 5) - 2))
  const checkoutToday = Math.max(1, Math.round(occRooms * 0.38 + (seed % 4) - 1))
  const [liveGuests, setLiveGuests] = useState(occRooms * 2 - 3)
  const [walkIn, setWalkIn] = useState(0)
  useEffect(() => {
    setLiveGuests(occRooms * 2 - 3)
    const timer = setInterval(() => {
      // 实时波动：有客人 walk-in 也有客人提前离开，围绕基准浮动
      setLiveGuests(g => {
        const base = occRooms * 2 - 3
        const next = g + (Math.random() < 0.5 ? -1 : 1) + (Math.random() < 0.12 ? 1 : 0)
        return Math.max(base - 4, Math.min(base + 5, next))
      })
      if (Math.random() < 0.25) setWalkIn(w => w + 1)
    }, 4000)
    return () => clearInterval(timer)
  }, [occRooms])
  const tomorrowPre = Math.max(0, Math.round(occRooms * 0.3 + (seed % 6)))

  const attrs = [
    { icon: '⭐', label: '口碑分', value: reputationScore, max: 5, display: reputationScore + ' / 5' },
    { icon: '💯', label: '好评率', value: goodRate, max: 100, display: goodRate + '%' },
    { icon: '😊', label: '满意度', value: satisfaction, max: 100, display: satisfaction + '%' },
    { icon: '🏠', label: '出租率', value: occupancy, max: 100, display: occupancy + '%' },
    { icon: '💎', label: '品质分', value: quality, max: 100, display: quality + '' },
  ]

  // RPG称号：综合属性确定性计算
  const hasData = report || history.length > 0
  const title = getTitle(occupancy, goodRate, quality)
  const dateInfo = useMemo(() => simDate(week), [week])
  const guestMix = ['商务出差', '家庭出游', '旅行散客', '会议客人']

  // 未首次结算：显示筹备状态 + 日期 + 筹备动态
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
          📅 今天是 {dateInfo.text}（{dateInfo.weekday}）· 第 {week} 周经营中
        </div>
        <LiveFeed occupiedRooms={6} guestMix={['筹备培训', '开业筹备']} />
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

      {/* 模拟日历条 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFF4E0', borderRadius: 10, padding: '7px 12px', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#A96407' }}>📅 今天是 {dateInfo.text}（{dateInfo.weekday}）</span>
        <span style={{ fontSize: 10, color: '#9CA3AF' }}>第 {week} 周 · 开业以来第 {(week - 1) * 7 + new Date().getDay() + 1} 天</span>
      </div>

      {/* RPG称号条：当前称号 + 升级进度 */}
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

      {/* 今日入住情况（数字随营业实时轻微波动） */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[
          { l: '今日入住', v: checkinToday + ' 间', c: '#16A34A' },
          { l: '今日退房', v: checkoutToday + ' 间', c: '#D97706' },
          { l: '在店客人', v: liveGuests + ' 人', c: '#1D4ED8', live: true },
          { l: '明日预抵', v: tomorrowPre + ' 间', c: '#6B7280' },
        ].map(s => (
          <div key={s.l} style={{ background: '#fff', borderRadius: 10, padding: '8px 10px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: s.c }}>{s.v}{s.live && <span style={{ fontSize: 9, color: '#10B981', marginLeft: 4 }}>● 实时</span>}</div>
            <div style={{ fontSize: 10, color: '#9CA3AF' }}>{s.l}</div>
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

      <LiveFeed occupiedRooms={occRooms} guestMix={guestMix} />

      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 8, textAlign: 'center' }}>
        {brand?.name} · {property?.name} · 共 {rooms} 间房 · 第 {week} 周
      </div>
    </div>
  )
}
