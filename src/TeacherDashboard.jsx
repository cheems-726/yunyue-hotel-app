import React, { useState, useEffect } from 'react'
import { decisions } from './decisions.js'
import { getTitle } from './hotelTitle.js'
import { EVENT_INFO } from './settlement.js'
import { fetchAllGameStates, fetchAllProfiles, updateProfileByTeacher, fetchClassWeek, setClassWeek, subscribeGameStates } from './supabaseClient.js'

// 教师后台：全班经营总览 + 排名 + 分组管理（接 Supabase 真实数据，云端不可用时回退演示数据）
const demoGroups = [
  { id: 1, name: '第1组', hotel: '云悦酒店', city: '成都·锦江区', occ: 72, revenue: 15.2, profit: 6.8, rating: 4.5, score: 92 },
  { id: 2, name: '第2组', hotel: '汉庭·春熙路', city: '成都·武侯区', occ: 68, revenue: 12.4, profit: 4.9, rating: 4.2, score: 85 },
  { id: 3, name: '第3组', hotel: '全季·天府广场', city: '成都·青羊区', occ: 65, revenue: 13.1, profit: 5.2, rating: 4.3, score: 87 },
  { id: 4, name: '第4组', hotel: '桔子·绵阳', city: '绵阳·涪城区', occ: 58, revenue: 9.6, profit: 3.1, rating: 4.0, score: 74 },
  { id: 5, name: '第5组', hotel: '汉庭·德阳', city: '德阳·旌阳区', occ: 55, revenue: 8.2, profit: 2.4, rating: 3.8, score: 68 },
]

// 从游戏状态 JSON 汇总出一组的经营摘要 + 四维评分（与学生端 FinalResult 同口径）
function summarize(gs, profile) {
  const s = gs?.state || {}
  const history = s.history || []
  const totalProfit = history.reduce((a, h) => a + (h.profit || 0), 0)
  const avgOcc = history.length ? Math.round(history.reduce((a, h) => a + h.occupancy, 0) / history.length) : 0
  const avgGood = history.length ? Math.round(history.reduce((a, h) => a + h.finalGoodRate, 0) / history.length) : 0
  const totalNeg = history.reduce((a, h) => a + (h.negativeCount || 0), 0)
  const totalRev = history.reduce((a, h) => a + (h.revenue || 0), 0)
  const profitScore = totalProfit >= 50000 ? 100 : totalProfit >= 30000 ? 85 : totalProfit >= 10000 ? 70 : totalProfit >= 0 ? 55 : 40
  const repScore = avgGood >= 90 ? 95 : avgGood >= 85 ? 85 : avgGood >= 75 ? 70 : avgGood >= 60 ? 55 : 40
  const occScore = avgOcc >= 75 ? 95 : avgOcc >= 65 ? 80 : avgOcc >= 55 ? 65 : avgOcc >= 45 ? 50 : 40
  const negScore = totalNeg === 0 ? 100 : totalNeg <= 5 ? 80 : totalNeg <= 10 ? 65 : 50
  const score = history.length ? Math.round(profitScore * 0.4 + repScore * 0.25 + occScore * 0.2 + negScore * 0.15) : 0
  const titleInfo = getTitle(avgOcc, avgGood, s.brand?.level || '')
  return {
    uid: gs.user_id,
    titleIcon: titleInfo.icon,
    title: titleInfo.title,
    name: profile?.group_no
      ? `${profile.class_name ? profile.class_name + ' · ' : ''}第${profile.group_no}组`
      : (profile?.display_name || gs.user_id.slice(0, 8)),
    hotel: s.brand?.name && s.property?.name ? `${s.brand.name}·${s.property.name}` : (s.brand?.name || '未开业'),
    city: s.location ? `${s.location.city}·${s.location.district}` : '未选址',
    occ: avgOcc, revenue: +(totalRev / 10000).toFixed(1), profit: +(totalProfit / 10000).toFixed(1),
    rating: avgGood ? +(avgGood / 20).toFixed(1) : 0,
    score, week: gs.week || s.week || 0, finished: gs.finished,
    historyCount: history.length,
    updated: gs.updated_at,
  }
}

// 周决策答案转可读文本
function fmtAnswer(v) {
  if (v == null) return '—'
  if (Array.isArray(v)) return v.slice(0, 5).join('＞')
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${k}:${val}`).join('、')
  return String(v)
}

// 组详情下钻：展开看该组逐周经营明细+当周决策内容（课堂复盘用）
function GroupDetail({ uid, rawStates, name }) {
  const gs = rawStates.find(x => x.user_id === uid)
  if (!gs) return <div style={{ padding: '10px 12px', background: '#F9FAFB', fontSize: 12, color: '#9CA3AF' }}>该组暂无经营存档</div>
  const s = gs.state || {}
  const hist = s.history || []
  const weekDecisions = s.doneDecisions ? Object.keys(s.doneDecisions).length : 0
  return (
    <div style={{ padding: 12, background: '#F9FAFB', borderRadius: '0 0 10px 10px', marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>
        {s.brand?.name || '—'}品牌 · 云端更新 {new Date(gs.updated_at).toLocaleString('zh-CN')}
      </div>
      {/* 称号进度 */}
      {(() => {
        const hist = s.history || []
        if (!hist.length) return null
        const avgOcc = Math.round(hist.reduce((a, h) => a + h.occupancy, 0) / hist.length)
        const avgGood = Math.round(hist.reduce((a, h) => a + h.finalGoodRate, 0) / hist.length)
        const lv = s.brand?.level || ''
        const q = lv.includes('经济') ? 60 : lv.includes('中高档') || lv.includes('精选') ? 85 : lv.includes('高档') ? 90 : lv.includes('奢华') ? 95 : lv.includes('中档') ? 75 : 70
        const ti = getTitle(avgOcc, avgGood, q)
        return (
          <div style={{ fontSize: 11, color: '#A96407', marginBottom: 8 }}>
            {ti.icon} 称号：{ti.title}（综合 {ti.composite}）{ti.next ? ` · 距「${ti.next}」还差综合 ${ti.nextAt - ti.composite} 分` : ' · 已是最高称号'}
          </div>
        )
      })()}
      {/* 本周 18 项决策完成度 */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7280', marginBottom: 3 }}>
          <span>本周决策完成度</span>
          <span style={{ fontWeight: 600, color: weekDecisions === 18 ? '#16A34A' : '#A96407' }}>{weekDecisions} / 18</span>
        </div>
        <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: (weekDecisions / 18 * 100) + '%', background: weekDecisions === 18 ? '#16A34A' : '#E8940F', borderRadius: 3 }} />
        </div>
      </div>
      {hist.length === 0 && <div style={{ fontSize: 12, color: '#9CA3AF' }}>还没有结算过，看不到逐周数据</div>}
      {hist.map(h => {
        const dec = h.decisions || {}
        const entries = Object.entries(dec)
        return (
          <div key={h.week} style={{ marginBottom: 10, background: '#fff', borderRadius: 8, padding: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              第{h.week}周 <span style={{ fontWeight: 400, color: '#6B7280' }}>出租率 {h.occupancy}% · 利润 {h.profit >= 0 ? '+' : ''}{h.profit}元 · 差评 {h.negativeCount}条 · 好评率 {h.finalGoodRate}%</span>
            </div>
            {entries.length === 0 ? (
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>决策明细未记录（旧版本结算的一周）</div>
            ) : entries.map(([id, val]) => {
              const d = decisions.find(x => x.id === id)
              return (
                <div key={id} style={{ fontSize: 11, color: '#374151', padding: '2px 0' }}>
                  · {d ? `${d.icon} ${d.name}` : id}：<b>{fmtAnswer(val)}</b>
                </div>
              )
            })}
          </div>
        )
      })}
      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>{name} · 逐周数据可用于课堂复盘讨论</div>
    </div>
  )
}

export default function TeacherDashboard({ user, onLogout }) {
  const [view, setView] = useState('overview') // overview | ranking | groups | teaching
  const [groups, setGroups] = useState(null) // null=加载中 []=云端无数据
  const [cloudOk, setCloudOk] = useState(true)
  const [profiles, setProfiles] = useState([]) // 全部学生档案（分组管理用）
  const [rawStates, setRawStates] = useState([]) // 原始云端存档（导出周报用）
  const [expandedUid, setExpandedUid] = useState(null) // 总览页展开查看明细的组
  const [classByUid, setClassByUid] = useState({}) // uid → class_name 映射
  const [filterClass, setFilterClass] = useState('') // 班级筛选（'' = 全部）
  const [classWeek, setClassWeekState] = useState(0) // 全班统一教学周（0=不限）
  const [weekInput, setWeekInput] = useState('')
  const [weekSaved, setWeekSaved] = useState(false)

  const loadAll = async () => {
    try {
      const [states, profiles] = await Promise.all([fetchAllGameStates(), fetchAllProfiles()])
      const pMap = Object.fromEntries(profiles.map(p => [p.user_id, p]))
      const list = states.map(gs => summarize(gs, pMap[gs.user_id]))
      list.sort((a, b) => b.score - a.score || b.historyCount - a.historyCount)
      setGroups(list)
      setProfiles(profiles.filter(p => p.role === 'student'))
      setRawStates(states)
      setClassByUid(Object.fromEntries(profiles.map(p => [p.user_id, p.class_name || ''])))
      fetchClassWeek().then(w => { setClassWeekState(w); setWeekInput(String(w)) }).catch(() => {})
      setCloudOk(true)
    } catch (e) {
      setGroups(demoGroups); setCloudOk(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!cancelled) await loadAll()
    })()
    // Realtime：学生结算/存档变化时自动刷新看板（无需手动刷新）
    const unsub = subscribeGameStates(() => { if (!cancelled) loadAll() })
    return () => { cancelled = true; unsub() }
  }, [])

  // 教师改组号/班级（本地即时更新 + 云端写入）
  async function saveProfile(p, fields) {
    setProfiles(prev => prev.map(x => x.user_id === p.user_id ? { ...x, ...fields } : x))
    await updateProfileByTeacher(p.user_id, fields)
  }

  // 教师设置全班统一周
  async function saveClassWeek() {
    const w = Math.max(0, Math.min(12, Number(weekInput) || 0))
    if (await setClassWeek(w)) {
      setClassWeekState(w)
      setWeekInput(String(w))
      setWeekSaved(true)
      setTimeout(() => setWeekSaved(false), 2000)
    }
  }

  // 导出全班周报 CSV（汇总 + 每周明细，带 BOM 防 Excel 中文乱码；跟随当前班级筛选）
  function exportWeeklyCSV() {
    const pMap = Object.fromEntries(profiles.map(p => [p.user_id, p]))
    const visible = filterClass
      ? groups.filter(g => classByUid[g.uid] === filterClass)
      : groups
    const visibleUids = new Set(visible.map(g => g.uid))
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = []
    lines.push(filterClass ? `【${filterClass} 汇总】` : '【全班汇总】')
    lines.push('班级,组名,酒店,城市,周次,状态,称号,出租率%,营收(万),利润(万),口碑(5分),综合评分')
    for (const g of visible) {
      const p = pMap[g.uid] || {}
      lines.push([
        p.class_name || '', g.name, esc(g.hotel), g.city, g.week || 1,
        g.finished ? '已结业' : '经营中', esc(g.title || ''), g.occ, g.revenue, g.profit, g.rating, g.score,
      ].join(','))
    }
    lines.push('')
    lines.push('【每周明细】')
    lines.push('班级,组名,周次,出租率%,房价(元),营收(元),成本(元),利润(元),评价数,差评数,好评率%')
    for (const gs of rawStates.filter(x => visibleUids.has(x.user_id))) {
      const p = pMap[gs.user_id] || {}
      const gname = p.group_no ? `${p.class_name ? p.class_name + '·' : ''}第${p.group_no}组` : (p.display_name || gs.user_id.slice(0, 8))
      const hist = (gs.state && gs.state.history) || []
      for (const h of hist) {
        lines.push([
          p.class_name || '', gname, h.week, h.occupancy, h.price, h.revenue, h.totalCost, h.profit,
          h.reviewCount ?? '', h.negativeCount ?? '', h.finalGoodRate ?? '',
        ].join(','))
      }
    }
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `云悦酒店-全班周报-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // 按分数排序
  const ranked = [...(groups || [])].sort((a, b) => b.score - a.score)
  // 班级筛选（多班教学时只看某个班）
  const classList = Array.from(new Set(Object.values(classByUid).filter(Boolean)))
  const visibleGroups = filterClass
    ? (groups || []).filter(g => classByUid[g.uid] === filterClass)
    : (groups || [])
  const visibleRanked = [...visibleGroups].sort((a, b) => b.score - a.score)

  function scoreBar(score) {
    if (score >= 90) return '#10B981'
    if (score >= 80) return '#E8940F'
    if (score >= 70) return '#FBBF77'
    return '#EF4444'
  }

  return (
    <div className="content">
      <div className="header">
        <div className="row1"><span className="hotel-name">教师后台</span></div>
        <div className="sub">
          {user?.name} · {groups === null ? '正在加载全班数据…' : cloudOk ? `云端数据 · ${groups.length} 组已开档` : '云端不可用，显示演示数据'}
        </div>
      </div>

      {/* 功能切换 */}
      <div className="city-row">
        {[
          { key: 'overview', label: '📊 总览' },
          { key: 'ranking', label: '🏆 排名' },
          { key: 'groups', label: '👥 分组' },
          { key: 'teaching', label: '📖 教学' },
        ].map(v => (
          <button key={v.key} className={`city-tab ${view === v.key ? 'active' : ''}`} onClick={() => setView(v.key)}>
            {v.label}
          </button>
        ))}
      </div>

      {groups === null && (
        <div className="card">
          {[0, 1, 2].map(i => (
            <div key={i} style={{ padding: 12, background: '#F9FAFB', borderRadius: 10, marginBottom: 8 }}>
              <div className="skeleton" style={{ height: 14, width: '55%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 11, width: '85%' }} />
            </div>
          ))}
          <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>正在从云端拉取全班经营数据…</div>
        </div>
      )}

      {/* 总览 */}
      {view === 'overview' && groups !== null && (
        <div>
          {/* 教学进度控制：全班统一周 */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>⏱️ 教学进度控制（全班统一周）</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#6B7280', flexShrink: 0 }}>当前设定</span>
              <input
                type="number"
                min="0"
                max="12"
                value={weekInput}
                onChange={e => setWeekInput(e.target.value)}
                style={{ width: 64, padding: '8px 10px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit' }}
              />
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>周（0 = 不限制，各组自选节奏）</span>
              <button onClick={saveClassWeek} style={{ border: 'none', background: '#E8940F', color: '#fff', fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                保存
              </button>
            </div>
            <div style={{ fontSize: 11, color: weekSaved ? '#16A34A' : '#9CA3AF', marginTop: 6, lineHeight: 1.6 }}>
              {weekSaved ? '✅ 已保存，全班即时生效' : classWeek > 0 ? `学生只能结算到第 ${classWeek} 周——保证全班同一周看到同一个市场和事件（公平）` : '未限制：各组按自己节奏推进'}
            </div>
          </div>

          {/* 班级筛选（多班时出现） */}
          {classList.length > 1 && (
            <div className="city-row" style={{ marginBottom: 12 }}>
              <button className={`city-tab ${filterClass === '' ? 'active' : ''}`} onClick={() => setFilterClass('')}>全部班级</button>
              {classList.map(c => (
                <button key={c} className={`city-tab ${filterClass === c ? 'active' : ''}`} onClick={() => setFilterClass(c)}>{c}</button>
              ))}
            </div>
          )}

          <div className="card" style={{ background: '#FFF4E0', borderColor: '#FBE3B3' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: '#A96407', fontWeight: 600 }}>全班经营总览{filterClass ? ` · ${filterClass}` : ''}</div>
              {groups.length > 0 && (
                <button onClick={exportWeeklyCSV} style={{ border: 'none', background: '#E8940F', color: '#fff', fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
                  📥 导出全班周报 CSV
                </button>
              )}
            </div>
            {/* 班级整体统计条 */}
            {visibleGroups.length > 0 && (() => {
              const withData = visibleGroups.filter(g => g.historyCount > 0)
              const avg = (fn) => withData.length ? Math.round(withData.reduce((a, g) => a + fn(g), 0) / withData.length) : 0
              const avgOcc = avg(g => g.occ)
              const avgRating = avg(g => g.rating)
              const lossCount = withData.filter(g => g.profit < 0).length
              return (
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {[
                    { l: '平均出租率', v: avgOcc + '%' },
                    { l: '平均口碑', v: avgRating ? (avgRating / 20).toFixed(1) : '—' },
                    { l: '亏损组', v: lossCount + '组' },
                  ].map(s => (
                    <div key={s.l} style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '8px 0', textAlign: 'center' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#A96407' }}>{s.v}</div>
                      <div style={{ fontSize: 10, color: '#9CA3AF' }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              )
            })()}
            {visibleGroups.length === 0 && <div style={{ fontSize: 12, color: '#9CA3AF', padding: '12px 0' }}>还没有学生开档。学生注册并开始经营后，这里会实时显示各组数据。</div>}
            {visibleGroups.map(g => {
              const expanded = expandedUid === g.uid
              return (
              <div key={g.uid}>
                <div
                  onClick={() => setExpandedUid(expanded ? null : g.uid)}
                  style={{ padding: '12px', background: '#fff', borderRadius: 10, marginBottom: expanded ? 0 : 8, cursor: 'pointer', borderBottomLeftRadius: expanded ? 0 : 10, borderBottomRightRadius: expanded ? 0 : 10 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{g.hotel} {g.title && <span style={{ fontSize: 11, color: '#A96407', background: '#FFF4E0', borderRadius: 6, padding: '2px 6px', marginLeft: 4 }}>{g.titleIcon} {g.title}</span>}</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{g.name} · {g.city} {expanded ? '▲' : '▼'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#6B7280', flexWrap: 'wrap' }}>
                    <span>进度 <b style={{color:'#111827'}}>{g.finished ? '已结业' : `第${g.week || 1}周`}</b></span>
                    <span>出租率 <b style={{color:'#111827'}}>{g.occ}%</b></span>
                    <span>营收 <b style={{color:'#111827'}}>{g.revenue}万</b></span>
                    <span>利润 <b style={{color:'#10B981'}}>{g.profit}万</b></span>
                    <span>口碑 <b style={{color:'#E8940F'}}>{g.rating || '—'}</b></span>
                  </div>
                </div>
                {expanded && <GroupDetail uid={g.uid} rawStates={rawStates} name={g.name} />}
              </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 排名 */}
      {view === 'ranking' && groups !== null && (
        <div>
          <div className="card" style={{ background: '#FFF4E0', borderColor: '#FBE3B3' }}>
            <div style={{ fontSize: 13, color: '#A96407', fontWeight: 600, marginBottom: 12 }}>积分排行榜（利润40/口碑25/出租率20/差评处理15）</div>
            {visibleRanked.length === 0 && <div style={{ fontSize: 12, color: '#9CA3AF', padding: '12px 0' }}>暂无数据</div>}
            {visibleRanked.map((g, i) => (
              <div key={g.uid} style={{ padding: '12px', background: '#fff', borderRadius: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? '#FBE3B3' : i === 1 ? '#E5E7EB' : i === 2 ? '#FDE8D0' : '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                  {['🥇', '🥈', '🥉'][i] ?? (i + 1)}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{g.hotel} <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>{g.name} · {g.finished ? '已结业' : `第${g.week || 1}周`}</span> {g.title && <span style={{ fontSize: 11, color: '#A96407' }}>{g.titleIcon} {g.title}</span>}</div>
                  <div style={{ height: 6, background: '#F3F4F6', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: g.score + '%', background: scoreBar(g.score), borderRadius: 3 }}></div>
                  </div>
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: scoreBar(g.score) }}>{g.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 分组管理 */}
      {view === 'groups' && groups !== null && (
        <div>
          <div className="card">
            <div style={{ fontSize: 13, color: '#A96407', fontWeight: 600, marginBottom: 4 }}>👥 分组与班级管理</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>
              已注册学生 {profiles.length} 人 · 直接输入组号和班级即可保存（云端的进度数据不受影响）
            </div>
            {profiles.some(p => !p.group_no) && (
              <div style={{ fontSize: 12, color: '#991B1B', background: '#FEF0EF', borderRadius: 8, padding: '8px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span>⚠ 有 {profiles.filter(p => !p.group_no).length} 名学生还没分配组号</span>
                <button
                  onClick={async () => {
                    if (!window.confirm('按注册顺序每 6 人一组自动填充未分组学生的组号？')) return
                    const ungrouped = profiles.filter(p => !p.group_no)
                    for (let i = 0; i < ungrouped.length; i++) {
                      await saveProfile(ungrouped[i], { group_no: Math.floor(i / 6) + 1 })
                    }
                  }}
                  style={{ border: 'none', background: '#E8940F', color: '#fff', fontSize: 11, fontWeight: 600, padding: '6px 10px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                >
                  🤖 一键分组（每6人）
                </button>
              </div>
            )}
            {profiles.length === 0 && (
              <div style={{ fontSize: 12, color: '#9CA3AF', padding: '12px 0' }}>
                还没有学生注册。学生用学号注册后会自动出现在这里。
              </div>
            )}
            {profiles.map(p => {
              // 关联该学生的经营进度
              const g = groups.find(x => x.uid === p.user_id)
              return (
                <div key={p.user_id} style={{ padding: 12, background: '#F9FAFB', borderRadius: 10, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>
                      {p.display_name || p.user_id.slice(0, 8)}
                      {p.student_no && p.student_no !== p.display_name && <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400, marginLeft: 6 }}>（学号 {p.student_no}）</span>}
                    </span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                      {g ? `${g.hotel} · ${g.finished ? '已结业' : `第${g.week || 1}周`}` : '未开始经营'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label style={{ fontSize: 12, color: '#6B7280', flexShrink: 0 }}>组号</label>
                    <input
                      type="number"
                      min="1"
                      value={p.group_no || ''}
                      placeholder="如 1"
                      onChange={e => saveProfile(p, { group_no: e.target.value ? Number(e.target.value) : null })}
                      style={{ width: 60, padding: '8px 10px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit' }}
                    />
                    <label style={{ fontSize: 12, color: '#6B7280', flexShrink: 0 }}>班级</label>
                    <input
                      value={p.class_name || ''}
                      placeholder="如 酒管2401"
                      onChange={e => saveProfile(p, { class_name: e.target.value })}
                      style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit' }}
                    />
                  </div>
                </div>
              )
            })}
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
              💡 设置组号后，排名和总览会显示「第N组」；班级用于多班教学区分。修改即时生效。
            </div>
          </div>
        </div>
      )}

      {/* 教学参考 */}
      {view === 'teaching' && (
        <div>
          <div className="card">
            <div className="card-title">🧮 四维评分规则（与学生端最终成绩同口径）</div>
            {[
              { label: '利润', weight: 40, rule: '累计利润 ≥5万=100分 / ≥3万=85 / ≥1万=70 / ≥0=55 / 亏损=40' },
              { label: '口碑', weight: 25, rule: '平均好评率 ≥90%=95分 / ≥85%=85 / ≥75%=70 / ≥60%=55 / <60%=40' },
              { label: '出租率', weight: 20, rule: '平均出租率 ≥75%=95分 / ≥65%=80 / ≥55%=65 / ≥45%=50 / <45%=40' },
              { label: '差评处理', weight: 15, rule: '0条差评=100分 / ≤5条=80 / ≤10条=65 / >10条=50' },
            ].map(d => (
              <div key={d.label} style={{ padding: '8px 10px', background: '#F9FAFB', borderRadius: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{d.label} <span style={{ color: '#E8940F' }}>权重{d.weight}%</span></div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{d.rule}</div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>加权总分 = 各维度得分 × 权重之和；S≥90 / A≥80 / B≥70 / C≥60 / D&lt;60</div>
          </div>
          <div className="card">
            <div className="card-title">⚡ 事件一览（12种，条件触发非纯随机）</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>
              讲事件课时对照：每个事件的触发条件都是学生的某个经营状态——"事件是你们自己招来的"
            </div>
            {EVENT_INFO.map(e => (
              <div key={e.name} style={{ padding: '8px 10px', background: e.type === 'good' ? '#EAF9F0' : e.type === 'crisis' ? '#FFF4E0' : '#FEF0EF', borderRadius: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: e.type === 'good' ? '#065F46' : e.type === 'crisis' ? '#A96407' : '#991B1B' }}>
                  {e.icon} {e.name}{e.type === 'crisis' && ' · 危机'}
                </div>
                <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>触发条件：{e.trigger}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ background: '#FFF4E0', borderColor: '#FBE3B3' }}>
            <div style={{ fontSize: 13, color: '#A96407', fontWeight: 600, marginBottom: 8 }}>📖 教学参考 · 18项决策最佳实践</div>
            <div style={{ fontSize: 11, color: '#A96407', marginBottom: 12 }}>
              老师讲解时可对照：每个决策的行业惯例和教学要点
            </div>
          </div>
          {decisions.map((d, i) => (
            <div key={d.id} className="card" style={{ marginBottom: 10, padding: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                {i + 1}. {d.icon} {d.name}
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>{d.desc}</div>
              <div style={{ fontSize: 12, color: '#A96407', lineHeight: 1.6, background: '#FFF4E0', borderRadius: 8, padding: 10 }}>
                💡 {d.tip || '权衡利弊后选择。'}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '8px 20px 24px' }}>
        <button className="btn btn-ghost" style={{ width: '100%', padding: '14px 0', color: '#EF4444' }} onClick={onLogout}>退出登录</button>
      </div>
    </div>
  )
}
