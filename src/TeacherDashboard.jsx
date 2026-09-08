import React, { useState, useEffect } from 'react'
import { decisions } from './decisions.js'
import { fetchAllGameStates, fetchAllProfiles, updateProfileByTeacher } from './supabaseClient.js'

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
  return {
    uid: gs.user_id,
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

export default function TeacherDashboard({ user, onLogout }) {
  const [view, setView] = useState('overview') // overview | ranking | groups | teaching
  const [groups, setGroups] = useState(null) // null=加载中 []=云端无数据
  const [cloudOk, setCloudOk] = useState(true)
  const [profiles, setProfiles] = useState([]) // 全部学生档案（分组管理用）

  const loadAll = async () => {
    try {
      const [states, profiles] = await Promise.all([fetchAllGameStates(), fetchAllProfiles()])
      const pMap = Object.fromEntries(profiles.map(p => [p.user_id, p]))
      const list = states.map(gs => summarize(gs, pMap[gs.user_id]))
      list.sort((a, b) => b.score - a.score || b.historyCount - a.historyCount)
      setGroups(list)
      setProfiles(profiles.filter(p => p.role === 'student'))
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
    return () => { cancelled = true }
  }, [])

  // 教师改组号/班级（本地即时更新 + 云端写入）
  async function saveProfile(p, fields) {
    setProfiles(prev => prev.map(x => x.user_id === p.user_id ? { ...x, ...fields } : x))
    await updateProfileByTeacher(p.user_id, fields)
  }

  // 按分数排序
  const ranked = [...(groups || [])].sort((a, b) => b.score - a.score)

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
        <div className="card" style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: 40 }}>
          正在从云端拉取全班经营数据…
        </div>
      )}

      {/* 总览 */}
      {view === 'overview' && groups !== null && (
        <div>
          <div className="card" style={{ background: '#FFF4E0', borderColor: '#FBE3B3' }}>
            <div style={{ fontSize: 13, color: '#A96407', fontWeight: 600, marginBottom: 12 }}>全班经营总览</div>
            {groups.length === 0 && <div style={{ fontSize: 12, color: '#9CA3AF', padding: '12px 0' }}>还没有学生开档。学生注册并开始经营后，这里会实时显示各组数据。</div>}
            {groups.map(g => (
              <div key={g.uid} style={{ padding: '12px', background: '#fff', borderRadius: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{g.hotel}</span>
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>{g.name} · {g.city}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#6B7280', flexWrap: 'wrap' }}>
                  <span>进度 <b style={{color:'#111827'}}>{g.finished ? '已结业' : `第${g.week || 1}周`}</b></span>
                  <span>出租率 <b style={{color:'#111827'}}>{g.occ}%</b></span>
                  <span>营收 <b style={{color:'#111827'}}>{g.revenue}万</b></span>
                  <span>利润 <b style={{color:'#10B981'}}>{g.profit}万</b></span>
                  <span>口碑 <b style={{color:'#E8940F'}}>{g.rating || '—'}</b></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 排名 */}
      {view === 'ranking' && groups !== null && (
        <div>
          <div className="card" style={{ background: '#FFF4E0', borderColor: '#FBE3B3' }}>
            <div style={{ fontSize: 13, color: '#A96407', fontWeight: 600, marginBottom: 12 }}>积分排行榜（利润40/口碑25/出租率20/差评处理15）</div>
            {ranked.length === 0 && <div style={{ fontSize: 12, color: '#9CA3AF', padding: '12px 0' }}>暂无数据</div>}
            {ranked.map((g, i) => (
              <div key={g.uid} style={{ padding: '12px', background: '#fff', borderRadius: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? '#FBE3B3' : '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: i === 0 ? '#A96407' : '#6B7280', flexShrink: 0 }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{g.hotel} <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>{g.name} · {g.finished ? '已结业' : `第${g.week || 1}周`}</span></div>
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
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{p.display_name || p.user_id.slice(0, 8)}</span>
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
