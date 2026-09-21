import React, { useState, useEffect } from 'react'
import SiteSelection from './SiteSelection.jsx'
import BrandSelection from './BrandSelection.jsx'
import Claim from './Claim.jsx'
import Establishment from './Establishment.jsx'
import DecisionPanel from './DecisionPanel.jsx'
import Reputation from './Reputation.jsx'
import TeacherDashboard from './TeacherDashboard.jsx'
import WeeklyReport from './WeeklyReport.jsx'
import FinalResult from './FinalResult.jsx'
import HotelStatus from './HotelStatus.jsx'
import Welcome from './Welcome.jsx'
import { settle } from './settlement.js'
import { decisions, OWNER_LABELS } from './decisions.js'
import { supabase, emailFor, fetchProfile, fetchGameState, fetchClassWeek, fetchGroupMembers, fetchGroupStates, updateOwnName, saveGameState, saveGameStateNow, groupKeyOf, fetchMyNotes, saveDecisionLog } from './supabaseClient.js'
import { getTitle } from './hotelTitle.js'
import { EVENT_INFO } from './settlement.js'
import { TITLES } from './hotelTitle.js'
import { ATTR_INIT, normalizeAttrs, applyDecisionToAttrs, formatAttrDelta, qualityOf } from './attrs.js'
import { APP_VERSION } from './version.js'

// ===== 登录页（真实 Supabase 认证 + 离线演示模式） =====
function LoginPage({ onLogin }) {
  const [step, setStep] = useState('choose') // choose | form | demo
  const [role, setRole] = useState('') // student | teacher
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function chooseRole(r) {
    setRole(r)
    setStep('form')
    setError('')
  }

  // 学号/工号规则：学生纯数字，教师 T+数字
  function validateAccount(id) {
    if (role === 'student' && !/^\d{4,12}$/.test(id)) return '学号应为 4-12 位数字'
    if (role === 'teacher' && !/^[tT]\d{1,6}$/.test(id)) return '教师工号应为 T+数字（如 T001）'
    return ''
  }

  async function handleLogin() {
    if (!account || !password) { setError('请输入账号和密码'); return }
    const vErr = validateAccount(account)
    if (vErr) { setError(vErr); return }
    setBusy(true)
    setError('')
    try {
      const email = emailFor(account)
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
      if (authErr) {
        if (authErr.message.includes('Invalid login')) {
          setError('账号或密码错误。还没注册过？点「注册并登录」')
        } else {
          setError('登录失败：' + authErr.message + '（检查网络/梯子）')
        }
        return
      }
      await completeLogin(data.user, account)
    } catch (e) {
      setError('网络异常：' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  async function handleSignup() {
    if (!account || !password) { setError('请输入账号和密码'); return }
    const vErr = validateAccount(account)
    if (vErr) { setError(vErr); return }
    if (password.length < 6) { setError('密码至少 6 位'); return }
    setBusy(true)
    setError('')
    try {
      const email = emailFor(account)
      const { data, error: authErr } = await supabase.auth.signUp({ email, password })
      if (authErr) { setError('注册失败：' + authErr.message); return }
      if (!data.session) { setError('注册成功但未返回会话，请再点登录'); return }
      await completeLogin(data.user, account)
    } catch (e) {
      setError('网络异常：' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  // 登录/注册成功：拉档案确定角色，回调进主界面
  async function completeLogin(authUser, inputId) {
    let profile = await fetchProfile(authUser.id)
    // 触发器可能尚未写入（毫秒级延迟），重试一次
    if (!profile) {
      await new Promise(r => setTimeout(r, 800))
      profile = await fetchProfile(authUser.id)
    }
    const realRole = profile?.role === 'teacher' ? 'teacher' : 'student'
    if (realRole !== role) {
      setError(realRole === 'teacher'
        ? '提示：该账号是教师账号，请返回选择「我是老师」'
        : '提示：该账号是学生账号，请返回选择「我是学生」')
      await supabase.auth.signOut()
      return
    }
    onLogin({
      role: realRole,
      id: inputId,
      name: profile?.display_name || inputId,
      uid: authUser.id,
      email: authUser.email,
      cloud: true,
      groupNo: profile?.group_no || null,
      className: profile?.class_name || null,
      groupRole: profile?.role_in_group && !['student', 'teacher'].includes(profile.role_in_group) ? profile.role_in_group : null,
    })
  }

  // ===== 离线演示模式 =====
  function handleDemoLogin() {
    onLogin({ role, id: role === 'student' ? '20240101' : 'T001', name: role === 'student' ? '陈小明' : '王老师', cloud: false })
  }

  if (step === 'choose') {
    return (
      <div className="content" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ width: 80, height: 80, borderRadius: 24, background: '#FFF4E0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, margin: '0 auto 16px' }}>🏨</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>云悦酒店</div>
          <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 6 }}>连锁酒店经营模拟系统</div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>请选择你的身份</div>
        <button className="btn btn-primary" style={{ padding: '16px 0', fontSize: 16, marginBottom: 12 }} onClick={() => chooseRole('student')}>👨‍🎓 我是学生</button>
        <button className="btn btn-ghost" style={{ padding: '16px 0', fontSize: 16 }} onClick={() => chooseRole('teacher')}>👩‍🏫 我是老师</button>
      </div>
    )
  }

  if (step === 'demo') {
    return (
      <div className="content" style={{ display: 'flex', flexDirection: 'column', padding: '40px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>离线演示模式</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>不连服务器，数据只存在本机（{role === 'student' ? '学生 陈小明' : '教师 王老师'}）</div>
        </div>
        <button className="btn-confirm" onClick={handleDemoLogin}>进入演示 →</button>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <span style={{ fontSize: 12, color: '#9CA3AF', cursor: 'pointer' }} onClick={() => setStep('form')}>‹ 返回登录</span>
        </div>
      </div>
    )
  }

  return (
    <div className="content" style={{ display: 'flex', flexDirection: 'column', padding: '40px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{role === 'student' ? '学生登录' : '教师登录'}</div>
        <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>
          {role === 'student' ? '首次使用请先注册（学号即账号）' : '首次使用请先注册（工号即账号，如 T001）'}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 6 }}>{role === 'student' ? '学号' : '工号'}</div>
        <input
          value={account}
          onChange={e => setAccount(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          placeholder={role === 'student' ? '如 20240101' : '如 T001'}
          style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 15, outline: 'none', fontFamily: 'inherit' }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 6 }}>密码</div>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          placeholder="至少 6 位"
          style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 15, outline: 'none', fontFamily: 'inherit' }}
        />
      </div>

      {error && <div style={{ color: '#EF4444', fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>{error}</div>}

      <button className="btn-confirm" disabled={busy} onClick={handleLogin}>{busy ? '登录中…' : '登录'}</button>
      <button className="btn btn-ghost" style={{ marginTop: 10, padding: '12px 0' }} disabled={busy} onClick={handleSignup}>
        {busy ? '请稍候…' : '注册并登录（首次使用）'}
      </button>

      <div style={{ textAlign: 'center', marginTop: 14, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: '#9CA3AF', cursor: 'pointer' }} onClick={() => setStep('choose')}>‹ 返回选择身份</span>
        <span style={{ fontSize: 12, color: '#9CA3AF', cursor: 'pointer' }} onClick={() => setStep('demo')}>无网络？离线演示 ›</span>
      </div>
    </div>
  )
}

// ===== 占位页 =====
function PlaceholderPage({ title, icon, onBack }) {
  return (
    <div className="content" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="header">
        <div className="row1">
          <span className="hotel-name" style={{ cursor: 'pointer' }} onClick={onBack}>‹ 返回</span>
        </div>
      </div>
      <div className="placeholder-page" style={{ flex: 1 }}>
        <div className="placeholder-icon">{icon}</div>
        <div className="placeholder-title">{title}</div>
        <div className="placeholder-desc">该功能正在建设中，敬请期待</div>
      </div>
    </div>
  )
}

// ===== 经营页（首页） =====
const KEY_DECISIONS = ['pricing', 'shifts', 'reputation'] // 每日关键：调价/排班/口碑
function Business({ user, toast, onOpen, location, brand, property, onDecision, doneDecisions, onSettle, report, week, history, pendingReviewCount, onGoTab, onGoRecords, attrs, attrFlash }) {
  const modules = ['部门运营', '会员推广', '门店经营']
  const [settling, setSettling] = useState(false)
  const [expandedDesc, setExpandedDesc] = useState({})
  const [showTop, setShowTop] = useState(false)
  const contentRef = React.useRef(null)
  React.useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const fn = () => setShowTop(el.scrollTop > 300)
    el.addEventListener('scroll', fn, { passive: true })
    return () => el.removeEventListener('scroll', fn)
  }, [])
  const [filter, setFilter] = useState('all') // all | undone | done | key
  const [showBreakdown, setShowBreakdown] = useState(false) // 资金卡支出构成折叠
  // 满18庆祝：会话内首次集齐时弹一次（reload 不重复骚扰）
  const celebratedRef = React.useRef(Object.keys(doneDecisions || {}).length >= 18)
  React.useEffect(() => {
    const n = Object.keys(doneDecisions || {}).length
    if (n === 18 && !celebratedRef.current) {
      celebratedRef.current = true
      toast && toast('🎉 全部 18 项决策已完成，可以结算了！')
    }
  }, [doneDecisions])
  const [renameOpen, setRenameOpen] = useState(false) // 真实姓名修改弹窗（替代window.prompt移动端bug）
  const [renameVal, setRenameVal] = useState(user?.name || '')
  const bgMap = { '部门运营': 'amber', '会员推广': 'blue', '门店经营': 'green' }
  const doneCount = Object.keys(doneDecisions).length
  const occ = report ? report.occupancy : (history.length ? history[history.length - 1].occupancy : null)
  const rev = report ? (report.revenue / 10000).toFixed(2) : (history.length ? (history[history.length - 1].revenue / 10000).toFixed(2) : null)
  const neg = report ? report.negativeCount : (history.length ? history[history.length - 1].negativeCount : null)
  return (
    <div className="content" ref={contentRef}>
      <div className="header">
        <div className="row1">
          <span className="hotel-name">{property ? property.name : '云悦酒店'}</span>
          <span className="day-tag">📅 第 {week} 周</span>
        </div>
        <div className="sub">{brand ? `${brand.name} · ${location?.district}` : ''} · 已决策 {doneCount}/18 · {(() => {
          const last = history.length ? history[history.length - 1] : null
          const lv = brand?.level || ''
          const q = qualityOf(attrs)
          const t = getTitle(last ? last.occupancy : 0, last ? last.finalGoodRate : 85, q)
          return `${t.icon} ${t.title}`
        })()}</div>
      </div>

      {/* 酒店状态面板（RPG属性） */}
      <HotelStatus report={report} brand={brand} property={property} week={week} history={history} attrs={attrs} attrFlash={attrFlash} decisions={doneDecisions} />

      {/* 本周决策进度 */}
      <div style={{ padding: '0 20px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF', marginBottom: 5 }}>
          <span>本周决策进度</span>
          <span style={{ color: doneCount === 18 ? '#16A34A' : '#A96407', fontWeight: 600 }}>{doneCount} / 18</span>
        </div>
        <div style={{ height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: (doneCount / 18 * 100) + '%', background: doneCount === 18 ? '#16A34A' : '#E8940F', borderRadius: 3, transition: 'width 0.4s cubic-bezier(0.22,1,0.36,1)' }}></div>
        </div>
      </div>

      <div className="card">
        <div className="card-title"><span style={{width:8,height:8,borderRadius:'50%',background:'#E8940F'}}></span>{report ? `第${report.week}周结算结果` : (history.length ? `第${history[history.length-1].week}周结算结果` : '本周经营中')}</div>
        {occ !== null ? (
          <div className="settle-grid">
            <div className="metric">
              <div className="label">出租率</div>
              <div className="value">{occ}<span className="unit">%</span></div>
            </div>
            <div className="metric">
              <div className="label">营收</div>
              <div className="value">{rev}<span className="unit">万</span></div>
            </div>
            <div className="metric">
              <div className="label">差评</div>
              <div className="value">{neg}<span className="unit">条</span></div>
              {neg > 0 && <div className="delta down" style={{color:'#A96407'}}>⚠ 需处理</div>}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '16px 0' }}>
            完成决策后点击结算，查看本周经营结果
          </div>
        )}
        {pendingReviewCount > 0 && (
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8, color: '#EF4444', borderColor: '#FECACA' }}
            onClick={() => onGoTab('reputation')}>
            💬 去口碑页处理 {pendingReviewCount} 条差评（处理率占分 15%）→
          </button>
        )}
        {report && report.events && report.events.length > 0 && (
          <div style={{ margin: '10px 0 0', padding: '7px 12px', background: '#F9FAFB', borderRadius: 8, fontSize: 11, color: '#6B7280' }}>
            ⚡ 上周事件 {report.events.length} 起：{report.events.map((e, i) => (
              <span key={i} style={{ color: e.type === 'crisis' ? '#DC2626' : e.type === 'good' ? '#10B981' : 'inherit', fontWeight: e.type === 'crisis' ? 700 : 400 }}>
                {e.icon}{e.name}{i < report.events.length - 1 ? '、' : ''}
              </span>
            ))}
          </div>
        )}
        {!report && doneCount < 18 && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#A96407', textAlign: 'center' }}>
            ⚠ 还有 {18 - doneCount} 项未决策，未做的按"维持现状"生效
          </div>
        )}
        {(() => {
          const last = history.length ? history[history.length - 1] : null
          if (!last) return null
          const lv = brand?.level || ''
          const q = qualityOf(attrs)
          const tNow = getTitle(last.occupancy, last.finalGoodRate, q)
          const prevH = history.length > 1 ? history[history.length - 2] : null
          const tPrev = prevH ? getTitle(prevH.occupancy, prevH.finalGoodRate, q) : null
          const promoted = tPrev && tNow.title !== tPrev.title && tNow.composite > tPrev.composite
          const demoted = tPrev && tNow.title !== tPrev.title && tNow.composite < tPrev.composite
          return (
            <div style={{ marginTop: 10, padding: '7px 12px', background: promoted ? '#ECFDF5' : demoted ? '#FEF0EF' : '#FFF4E0', borderRadius: 8, fontSize: 12, fontWeight: 600, color: promoted ? '#065F46' : demoted ? '#991B1B' : '#A96407', textAlign: 'center' }}>
              {promoted ? `🎉 恭喜晋升：${tPrev.title} → ${tNow.title}` : demoted ? `⚠ 降级：${tPrev.title} → ${tNow.title}，下周稳住` : `${tNow.icon} 当前称号：${tNow.title}`}
              <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, marginTop: 5, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: tNow.progress + '%', background: '#E8940F', borderRadius: 2 }} />
              </div>
              {tNow.next && <div style={{ fontSize: 10, fontWeight: 400, color: '#9CA3AF', marginTop: 3 }}>距「{tNow.next}」还差综合 {tNow.nextAt - tNow.composite} 分</div>}
            </div>
          )
        })()}
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 12, padding: '12px 0', fontSize: 14, opacity: settling ? 0.5 : 1, ...(Object.keys(doneDecisions).length === 18 && !settling ? { animation: 'pulseBorder 1.5s ease-in-out infinite', border: '2px solid #E8940F' } : {}) }} disabled={settling}
          onClick={() => { setSettling(true); setTimeout(() => { setSettling(false); onSettle() }, 350) }}>
          {settling ? '⏳ 结算中…' : Object.keys(doneDecisions).length === 18 ? '🎉 18项决策已完成，立即结算！' : '🔄 本周结算（查看经营结果）'}
        </button>
        {history.length > 0 && (
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 6, fontSize: 12 }}
            onClick={() => onGoRecords()}>
            📋 查看往期决策复盘（{history.length} 周）
          </button>
        )}
      </div>

          {/* 今日关键未完成提醒 */}
      {(() => {
        const undoneKeys = KEY_DECISIONS.filter(id => doneDecisions[id] === undefined)
        if (undoneKeys.length === 0 || report) return null
        const names = undoneKeys.map(id => decisions.find(d => d.id === id)?.name).filter(Boolean)
        return (
          <div style={{ margin: '0 20px 12px', padding: '9px 14px', background: '#FEF0EF', border: '1px solid #FECACA', borderRadius: 10, fontSize: 12, color: '#991B1B', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flexShrink: 0 }}>🔔</span>
            <span>今日关键未完成：<b>{names.join('、')}</b>——这些直接影响本周结算</span>
          </div>
        )
      })()}

      {/* 决策筛选 */}
      <div className="city-row" style={{ marginTop: 2 }}>
        {[['all', '全部'], ['undone', '待决策'], ['done', '已决策'], ['key', '每日关键']].map(([k, label]) => (
          <button key={k} className={`city-tab ${filter === k ? 'active' : ''}`} style={{ padding: '8px 0', fontSize: 12 }} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>

      {/* 资金状态 + 主力客群显示条 */}
      {(() => {
        const cap = 500000 - history.reduce((a, h) => a + (h.totalExpenses || 0), 0) + history.reduce((a, h) => a + (h.profit || 0), 0)
        const expenses = report?.totalExpenses || 0
        const isLow = cap < 100000
        const isCritical = cap < 50000
        return (
          <div className="card" title="点击查看实时流水明细"
            onClick={() => { contentRef.current && contentRef.current.scrollTo({ top: 0, behavior: 'smooth' }) }}
            style={{ background: isCritical ? '#FEF0EF' : isLow ? '#FFF4E0' : '#F0FDF4', borderColor: isCritical ? '#FECACA' : isLow ? '#FDE68A' : '#BBF7D0', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: isCritical ? '#DC2626' : isLow ? '#A96407' : '#16A34A' }}>
                {isCritical ? '🚨 破产预警' : isLow ? '⚠ 资金偏低' : '💰 资金状况'}
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, color: isCritical ? '#DC2626' : isLow ? '#A96407' : '#16A34A' }}>
                {(cap / 10000).toFixed(1)} 万
              </span>
            </div>
            {expenses > 0 && (
              <div style={{ fontSize: 11, color: '#6B7280' }}>
                上周支出 {expenses.toLocaleString()} 元 · 本周利润 {report ? (report.profit >= 0 ? '+' : '') + report.profit.toLocaleString() : '—'} 元 · 点击看实时流水 ↩
              </div>
            )}
            {(() => {
              // 上周支出构成折叠明细（引擎 weeklyExpenses 分项，降序占比条）
              const lastH = history.length ? history[history.length - 1] : null
              const bd = lastH && lastH.weeklyExpenses ? Object.entries(lastH.weeklyExpenses).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]) : []
              if (!bd.length || !lastH.totalExpenses) return null
              return (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 11, cursor: 'pointer', color: '#6B7280', userSelect: 'none' }} onClick={() => setShowBreakdown(!showBreakdown)}>
                    {showBreakdown ? '▾' : '▸'} 上周支出构成（共 {lastH.totalExpenses.toLocaleString()} 元，点看明细）
                  </div>
                  {showBreakdown && (() => {
                    // 较上周增减对比（成本管控教学）：上周分项数据来自 history 倒数第二条
                    const prevH = history.length >= 2 ? history[history.length - 2] : null
                    const prevExp = prevH && prevH.weeklyExpenses ? prevH.weeklyExpenses : null
                    return bd.map(([k, v]) => {
                      const prevV = prevExp ? (prevExp[k] || 0) : null
                      const diffPct = prevV != null && prevV > 0 ? Math.round((v - prevV) / prevV * 100) : null
                      const dColor = diffPct == null ? '#9CA3AF' : diffPct > 0 ? '#DC2626' : diffPct < 0 ? '#16A34A' : '#9CA3AF'
                      return (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#374151', padding: '2px 0' }}>
                          <span style={{ width: 50, flexShrink: 0, color: '#6B7280' }}>{k}</span>
                          <div style={{ flex: 1, height: 5, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: Math.round(v / (lastH.totalExpenses || 1) * 100) + '%', background: '#F59E0B', borderRadius: 3 }} />
                          </div>
                          <span style={{ width: 62, textAlign: 'right', flexShrink: 0, fontWeight: 600 }}>{v.toLocaleString()}元</span>
                          <span style={{ width: 44, textAlign: 'right', flexShrink: 0, fontWeight: 700, color: dColor }}>
                            {diffPct == null || diffPct === 0 ? '—' : (diffPct > 0 ? '↑' + diffPct + '%' : '↓' + Math.abs(diffPct) + '%')}
                          </span>
                        </div>
                      )
                    })
                  })()}
                </div>
              )
            })()}
            {isCritical && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4, fontWeight: 600 }}>⚠ 资金断裂将触发破产，期末扣分！立即控成本、增收</div>}
          </div>
        )
      })()}
      {/* 主力客群提示 */}
      {location?.district && (
        <div style={{ margin: '0 20px 8px', padding: '6px 12px', background: '#EFF6FF', borderRadius: 8, fontSize: 11, color: '#1E40AF', display: 'flex', alignItems: 'center', gap: 6 }}>
          👥 决策时注意匹配 {location.district} 的主力客群偏好
        </div>
      )}

      {/* 18项能力点，按模块分组（未决策的排前面） */}
          {modules.map(mod => (
            <div key={mod}>
              <div className="section-title">
                <span className="left">{mod}</span>
                <span className="hint" style={{ transition: 'all 0.3s ease' }}>
                  {(() => {
                    const modDecisions = decisions.filter(d => d.module === mod)
                    const done = modDecisions.filter(d => doneDecisions[d.id] !== undefined).length
                    const total = modDecisions.length
                    return done === total ? `✅ ${done}/${total} 全完成` : `${done}/${total} 已决策`
                  })()}
                </span>
              </div>
              <div className="task-list">
                {decisions.filter(d => d.module === mod)
                  .filter(d => filter === 'all' ? true : filter === 'key' ? KEY_DECISIONS.includes(d.id) : filter === 'undone' ? doneDecisions[d.id] === undefined : doneDecisions[d.id] !== undefined)
                  .map(d => ({ d, isDone: doneDecisions[d.id] !== undefined }))
                  .sort((a, b) => (a.isDone === b.isDone ? 0 : a.isDone ? 1 : -1))
                  .sort((a, b) => (b.d.owner === user?.groupRole ? 1 : 0) - (a.d.owner === user?.groupRole ? 1 : 0)) // 我的职责置顶
                  .map(({ d, isDone }) => {
                  const lastChoice = history.length && history[history.length - 1].decisions ? history[history.length - 1].decisions[d.id] : undefined
                  return (
                  <div className="task-card" key={d.id} onClick={() => onDecision(d)}
                    style={!isDone && decisions.filter(x => doneDecisions[x.id] === undefined)[0]?.id === d.id ? { border: '2px solid #E8940F', animation: 'pulseBorder 1.5s ease-in-out infinite' } : {}}
                    title={isDone ? `当前答案：${fmtDecision(doneDecisions[d.id])}（点击修改）` : undefined}>
                    <div className="task-card-icon-wrap" style={{ position: 'relative', flexShrink: 0 }}>
                      <div className={`task-icon ${bgMap[mod]}`}>{d.icon}</div>
                      {(!isDone && KEY_DECISIONS.includes(d.id) || (d.id === 'reputation' && pendingReviewCount > 0)) && (
                        <span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', background: '#EF4444', border: '2px solid #fff' }} />
                      )}
                    </div>
                    <div className="task-body" onClick={e => { e.stopPropagation(); setExpandedDesc(x => ({ ...x, [d.id]: !x[d.id] })) }}>
                      <div className="name">
                        <span style={{ fontSize: 10, color: '#D1D5DB', fontWeight: 400, marginRight: 4 }}>{decisions.indexOf(d) + 1}.</span>
                        {d.name} {isDone && '✓'}{!isDone && KEY_DECISIONS.includes(d.id) && <span style={{ fontSize: 10, color: '#EF4444', fontWeight: 600, marginLeft: 6 }}>每日关键</span>}{d.owner && OWNER_LABELS[d.owner] && (d.owner === user?.groupRole
  ? <span title="这是你的职责决策" style={{ fontSize: 9, color: '#fff', background: '#1D4ED8', borderRadius: 4, padding: '1px 5px', marginLeft: 5, fontWeight: 700 }}>👤 我的职责</span>
  : <span title="建议负责职业" style={{ fontSize: 9, color: '#1E40AF', background: '#EFF6FF', borderRadius: 4, padding: '1px 5px', marginLeft: 5 }}>{OWNER_LABELS[d.owner].icon} {OWNER_LABELS[d.owner].label}</span>)}
                      </div>
                      <div className="desc" style={expandedDesc[d.id] ? { whiteSpace: 'normal', fontSize: 11, lineHeight: 1.6, color: '#6B7280', padding: '3px 0 2px' } : { whiteSpace: 'nowrap' }}>
                        {isDone
                          ? (expandedDesc[d.id]
                              ? `当前答案：${fmtDecision(doneDecisions[d.id])}`
                              : `当前：${String(fmtDecision(doneDecisions[d.id])).slice(0, 20)}…`)
                          : (expandedDesc[d.id] ? d.desc : d.desc.slice(0, 25) + (d.desc.length > 25 ? '…' : ''))}
                        <span style={{ color: '#E8940F', marginLeft: 4 }}>{expandedDesc[d.id] ? '收起' : (isDone ? '展开答案' : (d.desc.length > 25 ? '全文' : ''))}</span>
                      </div>
                      {!isDone && lastChoice != null && (
                        <div style={{ fontSize: 10, color: '#9CA3AF', padding: '1px 0 2px' }}>上周：{String(fmtDecision(lastChoice)).slice(0, 18)}{String(fmtDecision(lastChoice)).length > 18 ? '…' : ''}</div>
                      )}
                    </div>
                    <span className={`task-badge ${isDone ? 'badge-done' : 'badge-new'}`}>{isDone ? '已决策·可改' : '去决策'}</span>
                  </div>
                  )
                })}
              </div>
            </div>
          ))}
      {/* 真实姓名修改弹窗 */}
      {renameOpen && (
        <div onClick={() => setRenameOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 32px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 22, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>✏️ 修改真实姓名</div>
            <input
              value={renameVal}
              onChange={e => setRenameVal(e.target.value)}
              placeholder="输入真实姓名（教师端将显示）"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setRenameOpen(false)}>取消</button>
              <button className="btn-confirm" style={{ flex: 2, opacity: renameVal.trim() ? 1 : 0.5 }} disabled={!renameVal.trim()}
                onClick={() => { const n = renameVal.trim(); if (n && n !== user?.name) onRename(n); setRenameOpen(false) }}>保存</button>
            </div>
          </div>
        </div>
      )}
      {/* 回到顶部悬浮按钮（Business 内部，状态同作用域） */}
      {showTop && (
        <button
          onClick={() => { if (contentRef.current) contentRef.current.scrollTo({ top: 0, behavior: 'smooth' }) }}
          style={{ position: 'fixed', bottom: 'calc(86px + env(safe-area-inset-bottom))', right: 16, width: 36, height: 36, borderRadius: '50%', background: '#fff', border: '1px solid #E5E7EB', boxShadow: 'var(--shadow-md)', cursor: 'pointer', zIndex: 60, fontSize: 14, color: '#6B7280' }}
        >↑</button>
      )}
    </div>
  )
}

// ===== 报表页 =====
// 双折线趋势图（SVG 手绘：出租率琥珀线 + 利润蓝线，零依赖）
function TrendChart({ history }) {
  const W = 320, H = 130, PL = 26, PR = 12, PT = 12, PB = 20
  const TOTAL = 12
  const n = history.length
  const xs = i => PL + i * (W - PL - PR) / (TOTAL - 1)
  const pts = arr => {
    const vals = arr.map(o => o.v)
    const min = Math.min(...vals), max = Math.max(...vals)
    const span = (max - min) || 1
    return arr.map(o => ({ x: xs(o.slot), y: H - PB - ((o.v - min) / span) * (H - PT - PB), v: o.v }))
  }
  const occ = pts(history.map(h => ({ v: h.occupancy, slot: Math.min(h.week || 1, TOTAL) - 1 })))
  const prof = pts(history.map(h => ({ v: +(h.profit / 10000).toFixed(2), slot: Math.min(h.week || 1, TOTAL) - 1 })))
  const line = p => p.map(q => `${q.x},${q.y}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="#F3F4F6" strokeWidth="1" />
      {Array.from({ length: TOTAL }, (_, i) => (
        <line key={'g' + i} x1={xs(i)} y1={PT} x2={xs(i)} y2={H - PB} stroke="#F3F4F6" strokeWidth="1" />
      ))}
      <polyline points={line(occ)} fill="none" stroke="#E8940F" strokeWidth="2" strokeLinejoin="round" />
      <polyline points={line(prof)} fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinejoin="round" />
      {occ.map((p, i) => <circle key={'o' + i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="#E8940F" strokeWidth="2" />)}
      {prof.map((p, i) => <circle key={'p' + i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="#3B82F6" strokeWidth="2" />)}
      {Array.from({ length: TOTAL }, (_, i) => (
        <text key={'w' + i} x={xs(i)} y={H - 6} fontSize="8" fill={i < n ? '#9CA3AF' : '#D1D5DB'} textAnchor="middle">{i + 1}</text>
      ))}
      <text x={PL} y={9} fontSize="9" fill="#E8940F">■ 出租率%</text>
      <text x={PL + 62} y={9} fontSize="9" fill="#3B82F6">■ 利润(万)</text>
      {n < TOTAL && <text x={W - PR} y={9} fontSize="9" fill="#D1D5DB" textAnchor="end">还剩 {TOTAL - n} 周</text>}
    </svg>
  )
}

// 累计利润盈亏平衡图：累计折线 + 0轴虚线 + 回本点高亮（教学：多久开始赚钱）
function BreakEvenChart({ history }) {
  const W = 320, H = 150, PL = 30, PR = 12, PT = 14, PB = 20
  const n = history.length
  const cum = []
  let acc = 0
  history.forEach(h => { acc += h.profit || 0; cum.push(acc) })
  const lo = Math.min(0, ...cum), hi = Math.max(0, ...cum)
  const span = (hi - lo) || 1
  const xs = i => PL + i * (W - PL - PR) / Math.max(n - 1, 1)
  const ys = v => H - PB - ((v - lo) / span) * (H - PT - PB)
  const zeroY = ys(0)
  const beIdx = cum.findIndex(v => v >= 0)
  const breakeven = beIdx > 0 // 之前为负、之后转正才算"回本"
  const labelAnchor = i => xs(i) < 55 ? 'start' : xs(i) > W - 55 ? 'end' : 'middle'
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="#F3F4F6" strokeWidth="1" />
        <line x1={PL} y1={zeroY} x2={W - PR} y2={zeroY} stroke="#9CA3AF" strokeWidth="1" strokeDasharray="4 3" />
        <text x={W - PR} y={zeroY - 4} fontSize="8" fill="#9CA3AF" textAnchor="end">盈亏平衡线 0</text>
        <polyline points={cum.map((v, i) => `${xs(i)},${ys(v)}`).join(' ')} fill="none" stroke="#E8940F" strokeWidth="2" strokeLinejoin="round" />
        {cum.map((v, i) => (
          <circle key={'c' + i} cx={xs(i)} cy={ys(v)} r="3" fill="#fff" stroke="#E8940F" strokeWidth="2" />
        ))}
        {breakeven && (
          <>
            <circle cx={xs(beIdx)} cy={ys(cum[beIdx])} r="4.5" fill="#10B981" stroke="#fff" strokeWidth="1.5" />
            <text x={xs(beIdx)} y={ys(cum[beIdx]) - 9} fontSize="9" fontWeight="700" fill="#059669" textAnchor={labelAnchor(beIdx)}>第{history[beIdx].week}周回本</text>
          </>
        )}
        {history.map((h, i) => (
          <text key={'w' + i} x={xs(i)} y={H - 6} fontSize="9" fill="#9CA3AF" textAnchor="middle">{h.week}周</text>
        ))}
        <text x={PL} y={9} fontSize="9" fill="#E8940F">■ 累计利润</text>
      </svg>
      <div style={{ fontSize: 11, fontWeight: 600, textAlign: 'center', marginTop: 4, color: breakeven ? '#059669' : acc >= 0 ? '#16A34A' : '#DC2626' }}>
        {breakeven ? `🎉 第 ${history[beIdx].week} 周实现累计盈利，当前累计 ${acc.toLocaleString()} 元`
          : acc >= 0 ? `持续盈利中，当前累计 ${acc.toLocaleString()} 元`
          : `⏳ 尚未回本，当前累计 ${acc.toLocaleString()} 元`}
      </div>
    </>
  )
}

// ===== 报表页 =====
// KPI 环比小箭头（本周 vs 上周）
function KpiDelta({ cur, prev, goodUp = true, unit = '' }) {
  if (prev == null) return null
  const diff = +(cur - prev).toFixed(1)
  if (diff === 0) return null
  const up = diff > 0
  const good = goodUp ? up : !up
  return (
    <span style={{ fontSize: 9, fontWeight: 700, color: good ? '#10B981' : '#EF4444', marginLeft: 3 }}>
      {up ? '↑' : '↓'}{Math.abs(diff)}{unit}
    </span>
  )
}
function Report({ report, week, history }) {
  // 智能诊断：基于真实经营指标
  const diagnoses = []
  if (report) {
    if (report.occupancy < 55) diagnoses.push({ icon: '⚠', text: `出租率 ${report.occupancy}%，距健康线 55% 还差 ${55 - report.occupancy} 个百分点。手段：调价让利拉客 / 加大OTA与活动投放 / 修口碑（见效慢但持久）。` })
    if (report.occupancy >= 75) diagnoses.push({ icon: '⚠', text: `出租率 ${report.occupancy}% 处于满负荷区，注意服务品质——本周已有 ${report.negativeCount} 条差评，满房期更要盯排班和卫生。` })
    if (report.profit < 0) diagnoses.push({ icon: '⚠', text: `本周亏损 ${Math.abs(report.profit)} 元（单房均亏 ${Math.round(Math.abs(report.profit) / report.rooms)} 元）。成本大头：固定 ${Math.round(report.rooms * 65)} 元档 + 人力浮动，先砍营销费再谈提价。` })
    if (report.negativeCount > 0) diagnoses.push({ icon: '💬', text: `本周 ${report.negativeCount} 条差评：及时回复可减半负面影响（口碑少掉一半），拖到下周会触发「差评发酵」危机。` })
    if (report.demandStrength < 0.8) diagnoses.push({ icon: '📉', text: `客源强度 ${report.demandStrength}（全班本周同值，市场大盘无法改变）——能改变的是应对：口碑与会员是逆风期的压舱石。` })
    if (diagnoses.length === 0) diagnoses.push({ icon: '✅', text: `本周经营稳健：出租率 ${report.occupancy}%、好评率 ${report.finalGoodRate}%、利润 ${report.profit >= 0 ? '+' : ''}${report.profit} 元。继续保持节奏！` })
  }

  return (
    <div className="content">
      <div className="header">
        <div className="row1"><span className="hotel-name">报表</span></div>
        <div className="sub">{report ? `第 ${report.week} 周结算` : `第 ${week} 周 · 累计`}</div>
      </div>

      {report ? (
        <>
          {/* 真实 KPI（带上周环比箭头） */}
          {(() => {
            const prev = history.length ? history[history.length - 1] : null
            const rev = Math.round(report.revenue / report.rooms)
            const prevRev = prev ? Math.round(prev.revenue / prev.rooms) : null
            return (<>
          <div style={{display:'flex',gap:8,margin:'0 20px 14px'}}>
            <div className="card" style={{flex:1,margin:0,padding:'12px 8px',textAlign:'center'}}>
              <div style={{fontSize:11,color:'#9CA3AF',marginBottom:6}}>出租率</div>
              <div style={{fontSize:16,fontWeight:700}}>{report.occupancy}<span style={{fontSize:10,color:'#6B7280',fontWeight:400}}>%</span><KpiDelta cur={report.occupancy} prev={prev?.occupancy ?? null} unit="pt" /></div>
            </div>
            <div className="card" style={{flex:1,margin:0,padding:'12px 8px',textAlign:'center'}}>
              <div style={{fontSize:11,color:'#9CA3AF',marginBottom:6}}>ADR</div>
              <div style={{fontSize:16,fontWeight:700}}>{report.price}<span style={{fontSize:10,color:'#6B7280',fontWeight:400}}>元</span><KpiDelta cur={report.price} prev={prev?.price ?? null} unit="元" /></div>
            </div>
            <div className="card" style={{flex:1,margin:0,padding:'12px 8px',textAlign:'center'}}>
              <div style={{fontSize:11,color:'#9CA3AF',marginBottom:6}}>RevPAR</div>
              <div style={{fontSize:16,fontWeight:700}}>{rev}<span style={{fontSize:10,color:'#6B7280',fontWeight:400}}>元</span><KpiDelta cur={rev} prev={prevRev} unit="元" /></div>
            </div>
          </div>
          <div style={{display:'flex',gap:8,margin:'0 20px 14px'}}>
            <div className="card" style={{flex:1,margin:0,padding:'12px 8px',textAlign:'center'}}>
              <div style={{fontSize:11,color:'#9CA3AF',marginBottom:6}}>利润</div>
              <div style={{fontSize:16,fontWeight:700,color:report.profit>=0?'#16A34A':'#DC2626'}}>{report.profit>=0?'+':''}{report.profit}<span style={{fontSize:10,color:'#6B7280',fontWeight:400}}>元</span><KpiDelta cur={report.profit} prev={prev?.profit ?? null} unit="元" /></div>
            </div>
            <div className="card" style={{flex:1,margin:0,padding:'12px 8px',textAlign:'center'}}>
              <div style={{fontSize:11,color:'#9CA3AF',marginBottom:6}}>口碑分</div>
              <div style={{fontSize:16,fontWeight:700}}>{(report.finalGoodRate/20).toFixed(1)}<span style={{fontSize:10,color:'#6B7280',fontWeight:400}}>/5</span><KpiDelta cur={report.finalGoodRate} prev={prev?.finalGoodRate ?? null} unit="pt" /></div>
            </div>
            <div className="card" style={{flex:1,margin:0,padding:'12px 8px',textAlign:'center'}}>
              <div style={{fontSize:11,color:'#9CA3AF',marginBottom:6}}>差评</div>
              <div style={{fontSize:16,fontWeight:700}}>{report.negativeCount}<span style={{fontSize:10,color:'#6B7280',fontWeight:400}}>条</span><KpiDelta cur={report.negativeCount} prev={prev?.negativeCount ?? null} unit="条" goodUp={false} /></div>
            </div>
          </div>
            </>)
          })()}

          {/* 智能诊断 */}
          <div className="card" style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}>
            <div className="card-title">🔍 智能诊断</div>
            {diagnoses.map((d, i) => (
              <div key={i} style={{ fontSize: 13, color: '#1E40AF', lineHeight: 1.7, padding: '4px 0' }}>{d.icon} {d.text}</div>
            ))}
          </div>
        </>
      ) : (
        <div className="card">
          <div style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '40px 0' }}>
            暂无经营数据<br />完成第一次结算后查看报表
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">📈 出租率与利润趋势</div>
        {history.length > 1 ? (
          <TrendChart history={history} />
        ) : (
          <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '30px 0' }}>
            结算满 2 周后解锁趋势图
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">💰 累计利润 · 盈亏平衡</div>
        {history.length > 0 ? (
          <BreakEvenChart history={history} />
        ) : (
          <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '20px 0' }}>完成结算后查看累计利润走势</div>
        )}
      </div>

      <div className="card">
        <div className="card-title">📋 历史周报</div>
        {history.length > 0 ? (
          history.slice().reverse().map((h, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>第 {h.week} 周</span>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#6B7280' }}>
                <span>出租率 {h.occupancy}%</span>
                <span>利润 <span style={{ color: h.profit >= 0 ? '#16A34A' : '#DC2626' }}>{h.profit}</span></span>
              </div>
            </div>
          ))
        ) : (
          <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '20px 0' }}>暂无历史记录</div>
        )}
      </div>
    </div>
  )
}

// ===== 我的页 =====
function Profile({ onOpen, user, location, brand, property, onLogout, doneDecisions, week, history, report, onRename, attrs }) {
  const menus = [
    { icon: '📋', bg: 'blue', name: '经营操作记录', key: 'records' },
    { icon: '🏆', bg: 'green', name: '积分与评分明细', key: 'scores' },
    { icon: '👥', bg: 'blue', name: '小组成员', key: 'members' },
    { icon: '❓', bg: 'amber', name: '玩法说明', key: 'help' },
  ]
  const orgDesc = user?.role === 'teacher'
    ? '教师'
    : `${property?.name || '云悦酒店'} · ${brand?.name || ''}${user?.className ? ` · ${user.className}` : ''}${user?.groupNo ? ` · 第 ${user.groupNo} 组` : ' · 未分组'}${location ? ` · ${location.district}` : ''}`

  // ===== 本地备份：导出 / 导入 =====
  const [backupMsg, setBackupMsg] = useState('')
  function exportBackup() {
    try {
      const data = {
        app: 'yunyue-hotel',
        version: 1,
        exportedAt: new Date().toISOString(),
        state: localStorage.getItem(STORAGE_KEY),
        reviews: localStorage.getItem('hotel-sim-reviews'),
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `云悦酒店备份-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
      setBackupMsg('✅ 备份文件已下载，建议发到微信/邮箱保存')
    } catch (e) {
      setBackupMsg('❌ 导出失败：' + e.message)
    }
  }
  function importBackup(file) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        if (data.app !== 'yunyue-hotel') { setBackupMsg('❌ 不是云悦酒店的备份文件'); return }
        if (data.state) localStorage.setItem(STORAGE_KEY, data.state)
        if (data.reviews) localStorage.setItem('hotel-sim-reviews', data.reviews)
        setBackupMsg('✅ 恢复成功，正在刷新…')
        setTimeout(() => window.location.reload(), 800)
      } catch (e) {
        setBackupMsg('❌ 备份文件损坏：' + e.message)
      }
    }
    reader.readAsText(file)
  }
  return (
    <div className="content">
      <div className="header">
        <div className="row1"><span className="hotel-name">我的</span></div>
      </div>

      <div style={{display:'flex',alignItems:'center',gap:14,margin:'0 20px 16px'}}>
        <div style={{width:56,height:56,borderRadius:'50%',background:(() => {
          const last = history.length ? history[history.length - 1] : null
          const lv = brand?.level || ''
          const q = qualityOf(attrs)
          const name = getTitle(last ? last.occupancy : 0, last ? last.finalGoodRate : 85, q).title
          return { '标杆酒店': '#FDE68A', '人气名店': '#EDE9FE', '精品酒店': '#DBEAFE', '舒适旅店': '#D1FAE5' }[name] || '#FFF4E0'
        })(),display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,transition:'background 0.5s'}}>😊</div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{fontSize:18,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}
            title="点击修改真实姓名"
            onClick={() => setRenameOpen(true)}
          >
            {user?.name || '未命名'} <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 400 }}>✏️改名</span>
          </div>
          <div style={{fontSize:12,color:'#9CA3AF',marginTop:2}}>{orgDesc}</div>
        </div>
      </div>

      <div className="card" style={{background:'#FFF4E0',borderColor:'#FBE3B3',padding:14}}>
        {(() => {
          const last = history.length ? history[history.length - 1] : null
          const lv = brand?.level || ''
          const q = qualityOf(attrs)
          const ti = getTitle(last ? last.occupancy : 0, last ? last.finalGoodRate : 85, q)
          return (<>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, color: '#A96407', fontWeight: 700 }}>{ti.icon} 我的酒店称号</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>排名以教师端为准</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#D97706' }}>{ti.title}</div>
            </div>
            <div style={{ height: 6, background: '#FBE3B3', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: ti.progress + '%', background: '#E8940F', borderRadius: 3, transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4, textAlign: 'right' }}>
              {ti.next ? `距「${ti.next}」还差综合 ${ti.nextAt - ti.composite} 分` : '已达最高称号'}
            </div>
          </>)
        })()}
      </div>

      {/* 称号历程时间线：按周回放晋升/降级，强化"决策→成长"因果 */}
      {history.length > 0 && (() => {
        const lv = brand?.level || ''
        const q = qualityOf(attrs)
        const rows = history.map((h, i) => {
          const now = getTitle(h.occupancy, h.finalGoodRate, q)
          const prev = i > 0 ? getTitle(history[i - 1].occupancy, history[i - 1].finalGoodRate, q) : null
          const change = !prev ? 'start' : now.title !== prev.title ? (now.composite > prev.composite ? 'up' : 'down') : 'same'
          return { week: h.week || i + 1, ...now, change, delta: prev ? now.composite - prev.composite : null }
        })
        const changeTag = { up: { t: '晋升', c: '#065F46', bg: '#ECFDF5' }, down: { t: '降级', c: '#991B1B', bg: '#FEF0EF' }, start: { t: '起步', c: '#A96407', bg: '#FFF4E0' }, same: { t: '保持', c: '#6B7280', bg: '#F3F4F6' } }
        return (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">📜 称号历程</div>
            {(() => {
              // 综合分走势迷你折线（复用结算数字配色）
              const W = 320, H = 46, PL = 10, PR = 10, PT = 8, PB = 8
              const n = rows.length
              const xs = i => PL + i * (W - PL - PR) / Math.max(n - 1, 1)
              const vals = rows.map(r => r.composite)
              const lo = Math.min(...vals) - 2, hi = Math.max(...vals) + 2
              const span = (hi - lo) || 1
              const pts = rows.map((r, i) => ({ x: xs(i), y: H - PB - ((r.composite - lo) / span) * (H - PT - PB) }))
              const rising = vals[n - 1] >= vals[0]
              return (
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', marginBottom: 4 }}>
                  <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="#F3F4F6" strokeWidth="1" />
                  <polyline points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={rising ? '#10B981' : '#EF4444'} strokeWidth="2" strokeLinejoin="round" />
                  {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#fff" stroke={rising ? '#10B981' : '#EF4444'} strokeWidth="1.5" />)}
                  <text x={PL} y={7} fontSize="8" fill="#9CA3AF">综合分 {vals[0]} → {vals[n - 1]}</text>
                </svg>
              )
            })()}
            {[...rows].reverse().map(r => {
              const tag = changeTag[r.change]
              return (
                <div key={r.week} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF', width: 44, flexShrink: 0 }}>第{r.week}周</span>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{r.icon} {r.title}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: tag.c, background: tag.bg, borderRadius: 6, padding: '2px 8px' }}>
                    {tag.t}{r.delta != null && r.change !== 'same' ? `（${r.delta > 0 ? '+' : ''}${r.delta}分）` : ''}
                  </span>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* 我的酒店信息 */}
      <div className="card" style={{ marginTop: 12, paddingTop: 16 }}>
        <div className="card-title" style={{ marginBottom: 10 }}>🏨 我的酒店档案</div>
        <div style={{ fontSize: 13, color: '#374151', lineHeight: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#9CA3AF' }}>酒店称号</span>
            <span style={{ fontWeight: 600, color: '#A96407' }}>{(() => {
              const occ = report ? report.occupancy : (history.length ? history[history.length - 1].occupancy : 0)
              const gr = report ? report.finalGoodRate : (history.length ? history[history.length - 1].finalGoodRate : 85)
              const lv = brand?.level || ''
              const q = qualityOf(attrs)
              const t = getTitle(occ, gr, q)
              return `${t.icon} ${t.title}`
            })()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#9CA3AF' }}>酒店</span>
            <span style={{ fontWeight: 600 }}>{property?.name || '未认领'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#9CA3AF' }}>品牌</span>
            <span style={{ fontWeight: 600 }}>{brand?.name || '未选择'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#9CA3AF' }}>所在地</span>
            <span style={{ fontWeight: 600 }}>{location ? `${location.city}·${location.district}` : '未选址'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#9CA3AF' }}>经营进度</span>
            <span style={{ fontWeight: 600 }}>第 {week} / 12 周</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#9CA3AF' }}>经营天数</span>
            <span style={{ fontWeight: 600 }}>{history.length * 7} 天</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#9CA3AF' }}>开业日期</span>
            <span style={{ fontWeight: 600 }}>3 月 1 日（第 1 周周一）</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#9CA3AF' }}>物业类型</span>
            <span style={{ fontWeight: 600 }}>{property?.type || '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#9CA3AF' }}>品牌档次</span>
            <span style={{ fontWeight: 600 }}>{brand?.level || '—'}</span>
          </div>
        </div>
      </div>

      {/* 本周决策记录 */}
      <div className="card">
        <div className="card-title">📋 第 {week} 周决策记录</div>
        {Object.keys(doneDecisions).length > 0 ? (
          decisions.filter(d => doneDecisions[d.id] !== undefined).map(d => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F9FAFB' }}>
              <span style={{ fontSize: 13 }}>{d.icon} {d.name}</span>
              <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 600 }}>✓ 已决策</span>
            </div>
          ))
        ) : (
          <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '16px 0' }}>
            本周还未做决策，去「经营」页开始吧
          </div>
        )}
      </div>

      {/* 教师批注 */}
      {(() => {
        const [notes, setNotes] = React.useState(null)
        React.useEffect(() => {
          if (user?.cloud && user?.uid) {
            fetchMyNotes(user.uid).then(n => setNotes(n)).catch(() => setNotes([]))
          } else { setNotes([]) }
        }, [user?.uid])
        if (notes === null) return null
        if (notes.length === 0) return null
        return (
          <div className="card" style={{ background: '#FFF4E0' }}>
            <div className="card-title">📝 老师评语</div>
            {notes.map((n, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: i < notes.length - 1 ? '1px solid #FBE3B3' : 'none' }}>
                {n.note && <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{n.note}</div>}
                {n.score != null && <div style={{ fontSize: 12, color: '#A96407', fontWeight: 700, marginTop: 4 }}>评分：{n.score} / 100</div>}
                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{n.week > 0 ? `第${n.week}周批注 · ` : ''}{new Date(n.updated_at).toLocaleDateString('zh-CN')}</div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* 本地备份 */}
      <div className="card">
        <div className="card-title">💾 数据备份</div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10, lineHeight: 1.6 }}>
          进度已自动存云端+本机。导出备份文件可防误删账号/清浏览器数据，双保险。
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={exportBackup}>⬇️ 导出备份</button>
          <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
            ⬆️ 导入恢复
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={e => e.target.files[0] && importBackup(e.target.files[0])} />
          </label>
        </div>
        {backupMsg && <div style={{ fontSize: 11, color: '#A96407', marginTop: 8 }}>{backupMsg}</div>}
      </div>

      <div className="card" style={{padding:'4px 0'}}>
        {menus.map(m => (
          <div key={m.name} onClick={() => onOpen(m.name, m.icon, m.key)}
            style={{display:'flex',alignItems:'center',gap:12,padding:'12px 6px',borderBottom:'1px solid #F9FAFB',cursor:'pointer',transition:'transform 0.12s'}}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateX(2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = ''}>
            <div style={{width:42,height:42,borderRadius:14,background:m.bg==='amber'?'#FFF4E0':m.bg==='blue'?'#EFF6FF':'#ECFDF5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:19}}>{m.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:600}}>{m.name}</div>
              <div style={{fontSize:10,color:'#9CA3AF',marginTop:1}}>{{records:'逐周决策复盘与批注时间线',scores:'四维评分与积分构成',members:'队友概况与职责分工',help:'玩法说明与常见问题'}[m.key] || ''}</div>
            </div>
            <div style={{color:'#D1D5DB'}}>›</div>
          </div>
        ))}
        <div onClick={onLogout} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 6px',cursor:'pointer',transition:'transform 0.12s'}}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateX(2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = ''}>
          <div style={{width:42,height:42,borderRadius:14,background:'#FEF2F2',display:'flex',alignItems:'center',justifyContent:'center',fontSize:19}}>🚪</div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:600,color:'#EF4444'}}>退出登录</div>
            <div style={{fontSize:10,color:'#9CA3AF',marginTop:1}}>进度已自动保存，换设备登录不丢失</div>
          </div>
          <div style={{color:'#D1D5DB'}}>›</div>
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 10, color: '#D1D5DB', paddingBottom: 8 }}>云悦酒店 v{APP_VERSION}</div>
    </div>
  )
}

// ===== 经营操作记录页（逐周决策复盘回看） =====
function fmtDecision(v) {
  if (v == null) return '—'
  if (Array.isArray(v)) return v.slice(0, 5).join('＞')
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${k}:${val}`).join('、')
  return String(v)
}
function OperationRecords({ history, onBack }) {
  const weeks = history.slice().reverse()
  // 折叠：默认只展开最近一周，点标题切换
  const [openWeek, setOpenWeek] = useState(weeks.length ? weeks[0].week : null)
  return (
    <div className="content">
      <div className="header">
        <div className="row1">
          <span className="hotel-name" style={{ cursor: 'pointer' }} onClick={onBack}>‹ 返回</span>
        </div>
        <div className="sub">每周决策与系统复盘记录</div>
      </div>

      {weeks.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: '32px 20px', lineHeight: 1.8 }}>
          📋 还没有结算记录<br />完成第一周结算后，这里会记录你的每个决策评价
        </div>
      )}

      {/* 周次快捷选择：点任意周直达该周决策快照 */}
      {weeks.length > 0 && (
        <div className="city-row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 2 }}>
          {history.map(h => (
            <button key={h.week} className={`city-tab ${openWeek === h.week ? 'active' : ''}`} style={{ padding: '8px 12px', fontSize: 12 }}
              onClick={() => setOpenWeek(openWeek === h.week ? null : h.week)}>
              第{h.week}周
            </button>
          ))}
        </div>
      )}

      {weeks.map(h => {
        const dec = h.decisions || {}
        const entries = Object.entries(dec)
        const isOpen = openWeek === h.week
        return (
        <div className="card" key={h.week} style={{ padding: isOpen ? 18 : 14 }}>
          <div className="card-title" style={{ cursor: 'pointer', marginBottom: isOpen ? 8 : 0 }} onClick={() => setOpenWeek(isOpen ? null : h.week)}>
            <span style={{ flex: 1 }}>
              第 {h.week} 周
              <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400, marginLeft: 8 }}>
                出租率 {h.occupancy}% · 利润 {h.profit >= 0 ? '+' : ''}{h.profit}元 · 差评 {h.negativeCount}条
              </span>
            </span>
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>{isOpen ? '▲ 收起' : '▼ 展开'}</span>
          </div>
          {isOpen && (<>
          {entries.length > 0 && (
            <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
              {entries.map(([id, val]) => {
                const d = decisions.find(x => x.id === id)
                return (
                  <div key={id} style={{ fontSize: 11, color: '#374151', padding: '2px 0' }}>
                    · {d ? `${d.icon} ${d.name}` : id}：<b>{fmtDecision(val)}</b>
                  </div>
                )
              })}
            </div>
          )}
          {(h.insights && h.insights.length > 0) ? h.insights.map((ins, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: i < h.insights.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{ins.good ? '✅' : '⚠️'}</span>
              <span style={{ fontSize: 12, color: ins.good ? '#065F46' : '#991B1B', lineHeight: 1.6 }}>{ins.text}</span>
            </div>
          )) : (
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>该周无关键决策复盘</div>
          )}
          </>)}
        </div>
        )
      })}
    </div>
  )
}

// ===== 玩法说明页（学生自助答疑） =====
function HelpPage({ onBack }) {
  const sections = [
    { icon: '🎯', title: '游戏目标', body: '从选址到开业经营一家酒店 12 周。最终按四维加权评分：利润 40% + 口碑 25% + 出租率 20% + 差评处理 15%，S 到 D 六个等级。' },
    { icon: '📅', title: '每周节奏', body: '每周做 18 项决策（做完自动沉底，可点击修改）→ 点「本周结算」看结果 → 去口碑页处理差评 → 进入下一周。决策不足 9 项会被扣口碑（不作为也是决策）。' },
    { icon: '⚡', title: '事件系统', body: '共 22 种事件（含 4 类危机/资金预警），全是你的经营状态招来的：差评拖欠会发酵、高出租率+少人手会挨投诉、口碑好会来网红探店。危机事件（橙框）要在 30 秒内选应对方案，超时按最差处理。' },
    { icon: '🏆', title: '酒店称号', body: '普通旅社 → 舒适旅店 → 精品酒店 → 人气名店 → 标杆酒店。出租率、好评率、品质分加权决定，每周结算后可能晋升或降级。' },
    { icon: '⭐', title: '怎么涨分', body: '利润：控成本+提房价找平衡；口碑：及时回复差评、定期深清洁；出租率：55%-75% 是健康区；差评：总数越少分越高。全部逻辑与最终成绩完全一致。' },
    { icon: '📋', title: '18项决策速查', body: '点击下方展开查看全部决策清单，课堂讨论时可以快速定位。' },
    { icon: '💾', title: '数据安全', body: '进度自动存云端+本机。「我的」页可导出备份文件；换设备登录同一学号自动恢复。重开经营需二次确认且会覆盖云端，慎重。' },
    { icon: '📺', title: '实时运营面板', body: '经营页「酒店状态」卡会随真实时间流动：每天早上退房高峰（12:00 前退房）、下午 2 点起办入住，在店人数、今日流水跟着涨落，还有前台/客房/工程部的实时动态滚动。数值是模拟演算，实际收支以每周结算为准。口碑页顶部还有「口碑构成拆解」卡——处理率、好评率、满意度三指标怎么互相影响，一张图看懂。' },
    { icon: '👥', title: '组队共管', body: '老师把几位同学设为同班级+同组号后，你们将共同经营同一家酒店：任何人登录看到的都是同一份进度，决策互相接续。「小组成员」页可查看队友的酒店概况和称号。职业设定：进入「小组成员」页，每位成员点击自己的职业卡片即可选定（👔店长统筹 / 🛎️大堂经理服务客诉 / 💰财务资金报表 / 📈运营专员定价活动 / 👥人事排班招聘），选完立即生效——经营页里你职责范围内的决策会置顶并标「我的职责」。差评处理建议分工：🛎️大堂经理主笔回复话术（回复靠诚意得分，敷衍的回复等于没回），👔店长把关补偿尺度（补偿成本计入周结算），每周结算后全组一起过一遍口碑页——差评欠 2 条以上会触发「差评发酵」危机，别攒着。另外，老师的批注和打分计入期末总评 10%，会显示在你的「我的」页评语卡里——按周写的那条是老师对你当周经营的针对性点评，值得细读。' },
    { icon: '📝', title: '常见操作指引', body: '改名：我的页 → 点名字旁✏️ → 输入新名字。导出备份：我的页 → 数据备份 → 导出。查看排名：教师端或帮老师查。查看历史：我的页 → 经营操作记录。' },
  ]
  const faqs = [
    { q: '网页打不开怎么办？', a: '优先用安卓App；正式版会更换为国内直连域名，以老师通知的网址为准。' },
    { q: '之前做的进度还在吗？', a: '在。进度自动存云端，用同一学号登录自动恢复；也可在「我的」页导出备份文件双重保险。' },
    { q: '本周结算按钮是灰的/被拦了？', a: '老师设置了全班统一周，你的进度已超前——等老师推进后即可结算。' },
    { q: '为什么全班同一周的市场结果一样？', a: '结算用固定随机种子：同一周全班的市场波动、事件概率完全相同。这是刻意的公平设计——比的是「同样的市场条件下，谁的决策更好」，而不是谁的运气好。你唯一能控制的是决策。' },
    { q: '组队之后差评谁来处理？', a: '回复入口全组都能用，建议分工：大堂经理主笔回复（回复按诚意得分，敷衍的回复客人会更生气且差评继续挂着）；要不要补偿、补多少由店长拍板（补偿成本计入周结算）；其他成员负责在结算后一起复盘差评来源。差评超过 2 条不处理会发酵成危机。' },
    { q: '好评也要回复吗？', a: '要。真诚的感谢（+欢迎再来/小惊喜）会让好评客人变成回头客，甚至带来「朋友推荐而来」的新好评——口碑就是这么滚起来的。只回一个「好的」，客人的热情就被泼了冷水。' },
    { q: '职业可以换吗？', a: '可以。在「小组成员」页重新点选职业卡片即立即生效，经营页的职责置顶会跟着变。但建议固定一段时间再换——每种职业的决策要点不同，熟悉职责才有分工意义。换职业不影响已完成的决策和经营数据。' },
    { q: '超售设置多少合适？', a: '超额预订是双刃剑：超售 1-2 间，能对冲客人临时取消，满房率↑；超售 3 间以上，到店无房的概率大增——每超 1 间约 8% 概率触发赔偿+差评。经验法则：参照历史 no-show 率（通常 3-5%），宁少勿多。旅游旺季可以适度激进，商务客为主的店要保守——商务客对「到店无房」几乎零容忍。' },
    { q: '带职业徽章的决策和普通决策有什么区别？', a: '本质上没有任何区别——18 项决策全组都能做。徽章只是分工建议：带「我的职责」蓝标的是与你的职业匹配的决策（如财务看报表诊断、运营看动态调价），系统会帮你置顶；带灰色「建议负责」的是队友职业对应的决策。全做完当然最好，但时间紧时先保自己的职责项。' },
    { q: '实时运营面板的数据是真的吗？', a: '面板里的日期、入住退房、今日流水都是随真实时间模拟演算的——帮助你理解酒店一天怎么运转。但它们只是「当日估算」，真正计入成绩的资金和经营数据以每周结算为准。看趋势学运营，算成绩等结算。' },
    { q: '实时评价是什么？为什么突然冒出评价？', a: '客人会随时写下自己的体验：退房高峰（上午 12:00 前）最容易出评价，住店期间偶尔也会随手写一条。评价会同时出现在两个地方——口碑页的卡片，和经营页「实时运营」流里带 💬 的那一行。它出现的频率不高，而且你的酒店状态越极端（特别好或特别差）越容易出：满意和不满的客人更愿意开口，中间状态大多沉默。注意：实时评价只是「当日实时」的反馈，真正计入成绩的是每周结算。' },
    { q: '为什么我好评多、差评少？', a: '这是刻意的设计：当你的综合满意度在中性以上（品质/声誉/士气都不错）时，实时评价几乎只会是好话——做得好不该被骂。差评主要来自两条路：①状态真的差（满意度跌破中性，通常是品质/声誉被衰减或决策拖低之后）；②每周结算时按你的决策口径算出来的差评（这部分才是主体），比如不停房深清洁、低价采购、精简排班都会实打实地招差评。所以「实时好评多」不代表周报里没有差评。' },
    { q: '口碑页的卡片数，和周报里的评价数字对得上吗？', a: '对得上，这是刻意保证的一致：周报「本周 X 条评价、Y 条差评」就是本周评价卡片的总数——实时已经出现的那些先占位，结算时只补「差额」部分，不会重复生成。唯一会上浮的情况是触发「口碑爆发」（好评率≥80% 时的追加好评），卡片会比周报数字多 1-2 张。差评则永远不封顶：周报说几条差评，口碑页就有几张差评卡。' },
    { q: '评价里的客人身份、「🔍 关联经营」是什么？', a: '每条评价都有一位自洽的客人：姓氏+称呼（🧑先生 / 👩女士，头像与称呼一致）、客群（商务出差/家庭出游/旅行散客/会议客人）、房型、住几晚——让评价读起来像真的。卡片上的「🔍 关联经营」默认是折叠的：客人不会告诉你他为什么不满，这一点保持真实；但当你想复盘时点开它，就能看到这条评价源于本组的哪项决策、当时选的是什么（例如「来源：本组『🛏️ 前台排班』选择了 精简省成本」）。它是把「客人抱怨」翻译成「经营因果」的开关。' },
    { q: '决策没做完就结算会怎样？', a: '未做的决策按「维持现状」默认结算——不作为也是一种决策。但注意三点：①完成度不足 9 项会直接扣口碑；②「每日关键」决策（动态调价/前台排班/口碑管理）对当周结果影响最大，跳过它们等于主动放弃利润；③每周都有新情况，上周的对策这周可能就不管用了。建议：把带红点的关键决策做完再结算。' },
    { q: '差评回复怎么写才更有诚意？', a: '换位思考是关键：先真诚道歉接住客人情绪，再给出具体的解决措施（改什么、怎么改、什么时候改好），必要时提供合理补偿，并留下跟进渠道让客人放心。反过来，推卸责任、只用模板套话、光道歉不给方案，客人只会更生气——差评也解决不了。' },
    { q: '决策面板里的"近3周轨迹"怎么理解？', a: '轨迹列出了你这项决策近几周的选择，以及每周的实际结果（出租率/利润）。用法：对比不同选择的产出——如果连续两周同样的打法结果都不好，说明市场在变，该换思路了；如果换了之后结果明显变好，就坚持新打法。轨迹+趋势块一起看，复盘效率最高。' },
    { q: '老师的批注和打分怎么算？', a: '老师在你的下钻详情里按周写批注并打分（0-100），计入期末总评 10%——是你经营过程分的组成部分，不只看最后结果。批注会显示在「我的」页评语卡，按周写的那条是对你当周经营的针对性点评。想拿高分：决策做完做透、差评及时处理、经营思路在决策里体现出来。' },
    { q: '重新开始经营，老师的批注还在吗？', a: '在。重新开始只清空你的经营进度（决策/周报/资金），老师的批注存在云端不受影响，新学期还能看到历史批注做参考。但如果换了组，新组员的进度会从第 1 周重新开始。' },
    { q: '怎么看我们组的决策趋势？', a: '三个入口：①经营页打开任意决策，面板里有「📈 该决策近3周轨迹」；②「我的」页称号历程有综合分走势和每周决策记录；③教师端的实时决策大屏和周次快照可以看到全班的对比。复盘时先看轨迹再定打法。' },
    { q: '实时流水的数据会一直累积吗？', a: '不会。今日流水按天重置——每天从零开始记录当天的入账和支出。换到新的一周也会重新计数。想看累计的经营数据请看资金卡的累计利润和报表页的趋势图，那里才是记入成绩的数据。' },
    { q: '差评回复有字数限制吗？', a: '没有硬性限制，想写多长都可以。但记住：客人看的是诚意和方案，不是字数——堆砌漂亮话但没有具体措施，还不如几句实在话。回复框右下角有快捷话术可以参考，也可以自由发挥。' },
    { q: '怎么提高综合评分？', a: '四维权重从高到低逐个抓：①利润40%——控成本、合理定价；②口碑25%——差评及时处理、定期深清洁；③出租率20%——调价找平衡点（55%-75%是健康区）；④差评处理15%——回复或整改都算处理。优先做权重高的短板，提分效率最高。' },
    { q: '往期的决策和复盘去哪看？', a: '两个入口：「我的」页 → 经营操作记录（逐周决策+系统评语+批注时间线）；经营页底部「查看往期决策复盘」可按周次快跳。都是只读回放，不怕误改。' },
    { q: '差评处理率是怎么算的？', a: '处理率 = 已解决 ÷ (待回复 + 已解决 + 忽略)。注意两点：点了「不处理」的差评也算没处理；只有回复或整改到位才算「已解决」。处理率占最终评分 15% 权重。' },
  ]
  return (
    <div className="content">
      <div className="header">
        <div className="row1">
          <span className="hotel-name" style={{ cursor: 'pointer' }} onClick={onBack}>‹ 返回</span>
        </div>
        <div className="sub">遇到问题先看这里</div>
      </div>
      {sections.map(s => (
        <div className="card" key={s.title}>
          <div className="card-title">{s.icon} {s.title}</div>
          <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.9 }}>{s.body}</div>
        </div>
      ))}

      <div className="card">
        <div className="card-title">💰 资金管理指南</div>
        <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.9 }}>
          <div><b>资金在哪看：</b>经营页顶部「资金状况」卡，初始 50 万，每周结算后自动增减。</div>
          <div><b>每周扣什么：</b>固定成本（约 65 元/间）+ 人员工资（按入住量与排班 20-30 元/间）+ 物料水电 + 营销投放（OTA 佣金：直营投放抽 11%，平台合作模式全营收抽 15%）+ 超售赔偿 + 事件罚款（消防 1500 元、设备维修 800 元等）。</div>
          <div><b>两条预警线：</b>低于 <b style={{ color: '#A96407' }}>10 万</b> 变黄「⚠ 资金偏低」；低于 <b style={{ color: '#DC2626' }}>5 万</b> 变红「🚨 破产预警」。</div>
          <div><b>破产后果：</b>资金断裂（扣到负）触发破产，<b>期末成绩直接扣分</b>——宁少赚别乱花。</div>
          <div><b>控成本三板斧：</b>①排班按出租率浮动（旺季满编、淡季精简）②营销看投产比，别为投放而投放 ③差评及时处理，欠多了发酵成危机损失更大。</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">⚡ 事件速览（22种，都是经营状态招来的）</div>
        {EVENT_INFO.map(e => (
          <div key={e.name} style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '5px 0', borderBottom: '1px solid #F9FAFB' }}>
            <span style={{ fontSize: 13, flexShrink: 0 }}>{e.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: e.type === 'good' ? '#065F46' : e.type === 'crisis' ? '#DC2626' : '#991B1B', flexShrink: 0 }}>{e.name}</span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{e.trigger}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">🏆 称号一览（5级）</div>
        {TITLES.map((ti, i) => (
          <div key={ti.name} style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '5px 0', borderBottom: '1px solid #F9FAFB' }}>
            <span style={{ fontSize: 13 }}>{ti.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#A96407', flexShrink: 0 }}>{ti.name}</span>
            <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto' }}>综合 ≥ {ti.min}</span>
          </div>
        ))}
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>综合分 = 出租率×35% + 好评率×35% + 品质分×30%（品质分由品牌档次决定）</div>
      </div>

      <div className="card" style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}>
        <div className="card-title">💬 常见问题</div>
        {faqs.map(f => (
          <div key={f.q} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1E40AF' }}>Q：{f.q}</div>
            <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.7, marginTop: 2 }}>A：{f.a}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-title">📋 18项决策速查</div>
        {[
          ...decisions.slice(0, 7).map(d => ({ mod: '部门运营', ...d })),
          ...decisions.slice(7, 12).map(d => ({ mod: '会员推广', ...d })),
          ...decisions.slice(12).map(d => ({ mod: '门店经营', ...d })),
        ].map((d, i) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '4px 0', borderBottom: '1px solid #F9FAFB' }}>
            <span style={{ fontSize: 11, color: '#D1D5DB', flexShrink: 0 }}>{i + 1}.</span>
            <span style={{ fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{d.icon} {d.name}</span>
            <span style={{ fontSize: 10, color: '#9CA3AF' }}>{d.module}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ===== 小组成员页（云端同班同组队友名单） =====
function GroupMembersPage({ user, onBack, onGoDecision }) {
  const [members, setMembers] = useState(null)
  const [myRole, setMyRole] = useState(null)
  const [memberStates, setMemberStates] = useState({}) // uid → 经营概况
  const [dutyOpenUid, setDutyOpenUid] = useState(null) // 展开未完成职责清单的成员
  const hasGroup = !!(user?.groupNo && user?.className)
  useEffect(() => {
    if (!hasGroup) return
    let cancelled = false
    fetchGroupMembers(user.className, user.groupNo).then(async list => {
      if (cancelled) return
      const others = list.filter(m => m.user_id !== user.uid)
      setMembers(others)
      // 拉组员经营概况（RLS 限同班同组只读；组档模型按组键查，一组一份共享快照）
      try {
        const states = await fetchGroupStates(groupKeyOf(user.className, user.groupNo), others.map(m => m.user_id))
        if (!cancelled) {
          const map = {}
          states.forEach(gs => {
            const h = (gs.state && gs.state.history) || []
            map[gs.user_id] = {
              hotel: gs.state?.brand?.name && gs.state?.property?.name ? `${gs.state.brand.name}·${gs.state.property.name}` : (gs.state?.brand?.name || '未开业'),
              week: gs.week || 1,
              finished: gs.finished,
              doneDecisions: gs.state?.doneDecisions || {},
              occ: h.length ? Math.round(h.reduce((a, x) => a + x.occupancy, 0) / h.length) : 0,
              profit: h.reduce((a, x) => a + (x.profit || 0), 0),
            }
          })
          setMemberStates(map)
        }
      } catch (e) {}
    }).catch(() => { if (!cancelled) setMembers([]) })
    return () => { cancelled = true }
  }, [hasGroup])
  return (
    <div className="content">
      <div className="header">
        <div className="row1">
          <span className="hotel-name" style={{ cursor: 'pointer' }} onClick={onBack}>‹ 返回</span>
        </div>
        <div className="sub">{hasGroup ? `${user.className} · 第 ${user.groupNo} 组` : '还未分组'}</div>
      </div>

      {!hasGroup && (
        <div className="card" style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: '32px 20px', lineHeight: 1.8 }}>
          👥 老师还没给你分配组号和班级<br />
          分配后这里会自动显示你的组员
        </div>
      )}

      {hasGroup && members === null && (
        <div className="card">
          {[0, 1].map(i => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
              <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 12, width: '40%', marginBottom: 6 }} />
                <div className="skeleton" style={{ height: 10, width: '70%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 职位选择 */}
      {hasGroup && (
        <div className="card">
          <div className="card-title">👔 我的职位</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>选择你在团队中的角色（影响课堂分工，全员均可做决策）</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
              { role: 'manager', icon: '👔', label: '店长/总经理', desc: '全局统筹' },
              { role: 'lobby', icon: '🛎️', label: '大堂经理', desc: '服务/客诉/调度' },
              { role: 'finance', icon: '💰', label: '财务', desc: '资金/报表' },
              { role: 'ops', icon: '📈', label: '运营专员', desc: '定价/OTA/活动' },
              { role: 'hr', icon: '👥', label: '人事专员', desc: '招聘/排班' },
            ].map(r => (
              <button key={r.role}
                onClick={() => { import('./supabaseClient.js').then(m => m.setGroupRole(user.uid, r.role)); setMyRole(r.role) }}
                style={{
                  flex: '1 1 30%', minWidth: 90, padding: '10px 8px', borderRadius: 10,
                  border: myRole === r.role ? '2px solid #E8940F' : '1px solid #E5E7EB',
                  background: myRole === r.role ? '#FFF4E0' : '#fff',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                }}>
                <div style={{ fontSize: 20 }}>{r.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: myRole === r.role ? '#A96407' : '#374151' }}>{r.label}</div>
                <div style={{ fontSize: 9, color: '#9CA3AF' }}>{r.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {hasGroup && members !== null && (
        <div className="card">
          <div className="card-title">👥 我的组员（{members.length + 1} 人）</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#FFF4E0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>😊</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{user.name} <span style={{ fontSize: 11, color: '#A96407', fontWeight: 600 }}>（我）</span></div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>学号 {user.id}</div>
            </div>
          </div>
          {members.map(m => {
            const st = memberStates[m.user_id]
            return (
              <div key={m.user_id} style={{ padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🧑</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {m.display_name}
                      {st && st.title && <span style={{ fontSize: 10, color: '#A96407', background: '#FFF4E0', borderRadius: 5, padding: '1px 6px', marginLeft: 6 }}>{st.titleIcon} {st.title}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                      {st ? `${st.finished ? '已结业' : `第${st.week}周`} · ${st.hotel}` : '查看经营概况…'}
                    </div>
                  </div>
                </div>
                {(() => {
                  // 职业职责完成度：该成员职业对应的决策项，在组档中的完成情况（互相提醒）
                  const role = m.role_in_group && !['student', 'teacher'].includes(m.role_in_group) ? m.role_in_group : null
                  const duty = role ? decisions.filter(d => d.owner === role) : []
                  const doneList = st?.doneDecisions || {}
                  const doneCnt = duty.filter(d => doneList[d.id] !== undefined).length
                  if (!role || !duty.length || !st) return null
                  const full = doneCnt >= duty.length
                  const undone = duty.filter(d => doneList[d.id] === undefined)
                  return (
                    <div style={{ marginTop: 6, paddingLeft: 52 }}>
                      <span
                        onClick={() => setDutyOpenUid(dutyOpenUid === m.user_id ? null : m.user_id)}
                        style={{ fontSize: 10, fontWeight: 700, color: full ? '#065F46' : '#A96407', background: full ? '#ECFDF5' : '#FFF4E0', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', display: 'inline-block' }}
                        title={full ? '职责决策全部完成' : '点击查看未完成的职责决策'}
                      >
                        {full ? '✅' : '⏳'} {OWNER_LABELS[role]?.icon || ''} {OWNER_LABELS[role]?.label || role}职责决策 {doneCnt}/{duty.length} 完成{!full ? ' · 点击查看' : ''}
                      </span>
                      {dutyOpenUid === m.user_id && undone.length > 0 && (
                        <div style={{ marginTop: 4, padding: '6px 10px', background: '#FFF9F0', border: '1px solid #FBE3B3', borderRadius: 8 }}>
                          {undone.map(d => (
                            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                              <span style={{ fontSize: 11, color: '#991B1B', flex: 1, lineHeight: 1.5 }}>
                                · {d.icon} {d.name}——还没做，提醒 TA 去经营页完成
                              </span>
                              {onGoDecision && (
                                <button onClick={e => { e.stopPropagation(); onGoDecision(d.id) }}
                                  style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: '#1D4ED8', border: 'none', borderRadius: 5, padding: '3px 9px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                                  去完成 ›
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}
                {st && st.occ > 0 && (
                  <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#6B7280', marginTop: 6, paddingLeft: 52 }}>
                    <span>平均出租率 <b style={{ color: '#111827' }}>{st.occ}%</b></span>
                    <span>累计利润 <b style={{ color: st.profit >= 0 ? '#10B981' : '#EF4444' }}>{st.profit >= 0 ? '+' : ''}{(st.profit / 10000).toFixed(2)}万</b></span>
                  </div>
                )}
              </div>
            )
          })}
          {members.length === 0 && (
            <div style={{ fontSize: 12, color: '#9CA3AF', padding: '8px 0', lineHeight: 1.8 }}>
              组里目前只有你一个人。<br />老师把其他同学的班级组号设成一样的，他们就会出现在这里。
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ===== 积分与评分明细页（四维逐周得分 + 加权总分实时预测） =====
function ScoreDetail({ history, onBack }) {
  const [scoreCopied, setScoreCopied] = useState(false)
  // 与 FinalResult 同口径的四维打分
  const scoreOf = (arr) => {
    const totalProfit = arr.reduce((s, h) => s + h.profit, 0)
    const avgOcc = arr.length ? Math.round(arr.reduce((s, h) => s + h.occupancy, 0) / arr.length) : 0
    const avgGood = arr.length ? Math.round(arr.reduce((s, h) => s + h.finalGoodRate, 0) / arr.length) : 0
    const totalNeg = arr.reduce((s, h) => s + h.negativeCount, 0)
    const pS = totalProfit >= 50000 ? 100 : totalProfit >= 30000 ? 85 : totalProfit >= 10000 ? 70 : totalProfit >= 0 ? 55 : 40
    const rS = avgGood >= 90 ? 95 : avgGood >= 85 ? 85 : avgGood >= 75 ? 70 : avgGood >= 60 ? 55 : 40
    const oS = avgOcc >= 75 ? 95 : avgOcc >= 65 ? 80 : avgOcc >= 55 ? 65 : avgOcc >= 45 ? 50 : 40
    const nS = totalNeg === 0 ? 100 : totalNeg <= 5 ? 80 : totalNeg <= 10 ? 65 : 50
    return { pS, rS, oS, nS, total: Math.round(pS * 0.4 + rS * 0.25 + oS * 0.2 + nS * 0.15) }
  }
  const cum = scoreOf(history)
  const dims = [
    { label: '利润', weight: 0.4, score: cum.pS },
    { label: '口碑', weight: 0.25, score: cum.rS },
    { label: '出租率', weight: 0.2, score: cum.oS },
    { label: '差评处理', weight: 0.15, score: cum.nS },
  ]
  const grade = cum.total >= 90 ? 'S' : cum.total >= 80 ? 'A' : cum.total >= 70 ? 'B' : cum.total >= 60 ? 'C' : 'D'
  return (
    <div className="content">
      <div className="header">
        <div className="row1">
          <span className="hotel-name" style={{ cursor: 'pointer' }} onClick={onBack}>‹ 返回</span>
        </div>
        <div className="sub">四维评分与 FinalResult 完全同口径</div>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: 20 }}>
        <div style={{ fontSize: 40, fontWeight: 700, color: '#E8940F' }}>{cum.total}</div>
        <div style={{ fontSize: 12, color: '#A96407', fontWeight: 600 }}>预测等级 {grade} · 按目前已结算的 {history.length} 周计算</div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{history.length < 12 ? '经营继续，此分数会随周数实时变化' : '12周已结算完毕'}</div>
      </div>

      <div className="card">
        <div className="card-title">当前累计四维得分</div>
        {dims.map(d => (
          <div key={d.label} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{d.label} <span style={{ fontSize: 10, color: '#9CA3AF' }}>权重{Math.round(d.weight * 100)}%</span></span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#E8940F' }}>{d.score}分</span>
            </div>
            <div style={{ height: 7, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: d.score + '%', background: d.score >= 80 ? '#16A34A' : d.score >= 60 ? '#E8940F' : '#DC2626', borderRadius: 4 }}></div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">🏅 勋章墙</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { icon: '💰', name: '首次盈利', got: history.some(h => h.profit > 0) },
            { icon: '🚀', name: '出租率破80', got: history.some(h => h.occupancy >= 80) },
            { icon: '⭐', name: '口碑4.5+', got: history.some(h => h.finalGoodRate >= 90) },
            { icon: '🛡️', name: '零差评周', got: history.some(h => h.negativeCount === 0 && h.reviewCount > 0) },
            (() => {
              let owed = null
              try {
                const revs = JSON.parse(localStorage.getItem('hotel-sim-reviews') || '[]')
                owed = revs.filter(r => r.status === 'pending' || r.status === 'ignored').length
              } catch (e) {}
              return { icon: '🧹', name: '零欠差评', got: owed !== null && owed === 0 }
            })(),
            { icon: '🏆', name: '跻身A级', got: cum.total >= 80 },
            { icon: '🎓', name: '完赛', got: history.length >= 12 },
          ].map(b => (
            <div key={b.name} style={{ textAlign: 'center', padding: '10px 4px', background: b.got ? '#FFF4E0' : '#F9FAFB', borderRadius: 10, border: b.got ? '1px solid #FBE3B3' : '1px solid #F3F4F6' }}>
              <div style={{ fontSize: 22, filter: b.got ? 'none' : 'grayscale(1)', opacity: b.got ? 1 : 0.35 }}>{b.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: b.got ? '#A96407' : '#9CA3AF', marginTop: 2 }}>{b.name}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 6, textAlign: 'center' }}>点亮全部勋章 = 把每一项经营都做到位</div>
      </div>

      <div className="card">
        <div className="card-title">
          逐周累计走势
          <button className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 11 }}
            onClick={() => {
              const text = `🏆 云悦酒店·累计成绩（${history.length}周）
综合评分 ${cum.total}（${grade.split(' ')[0]}）
出租率 ${cum.oS}分 | 口碑 ${cum.rS}分 | 利润 ${cum.pS}分 | 差评处理 ${cum.nS}分
——来自云悦酒店经营模拟`
              navigator.clipboard.writeText(text).then(() => setScoreCopied(true)).catch(() => setScoreCopied(false))
            }}>📋 复制</button>
        </div>
        {scoreCopied && <div style={{ fontSize: 11, color: '#16A34A', marginBottom: 8 }}>✅ 已复制累计成绩</div>}
        {history.length === 0 && <div style={{ fontSize: 12, color: '#9CA3AF', padding: '12px 0' }}>还没结算过，先去经营页完成第一周</div>}
        {history.map((_, i) => {
          const upto = history.slice(0, i + 1)
          const s = scoreOf(upto)
          return (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>第 {upto.length} 周结算后</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 120, margin: '0 12px' }}>
                <div style={{ flex: 1, height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: s.total + '%', background: '#E8940F', borderRadius: 3 }}></div>
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#E8940F' }}>{s.total}分</span>
            </div>
          )
        })}
      </div>

      <div className="card" style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}>
        <div className="card-title">📖 怎么涨分</div>
        <div style={{ fontSize: 12, color: '#1E40AF', lineHeight: 1.8 }}>
          利润（40%）：收入减成本的差额，累计≥3万到85分档<br />
          口碑（25%）：差评及时回复、卫生质检是关键<br />
          出租率（20%）：调价和营销平衡，55%-75%是舒适区<br />
          差评处理（15%）：差评总数越少分越高
        </div>
      </div>
    </div>
  )
}

// ===== App 框架（登录 + 选址 + 底部导航 + 真实时间 + 占位页路由） =====
const STORAGE_KEY = 'hotel-sim-state'

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (e) {
    return {}
  }
}

// ===== 全局错误兜底：任何子组件崩溃显示友好错误页（防白屏），可一键重置界面 =====
class AppErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err) { try { console.error('[AppError]', err) } catch (e) {} }
  render() {
    if (!this.state.err) return this.props.children
    const msg = String((this.state.err && this.state.err.message) || this.state.err)
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 44 }}>😵</div>
        <div style={{ fontSize: 17, fontWeight: 700, marginTop: 12 }}>页面出了点问题</div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8, wordBreak: 'break-all', lineHeight: 1.6 }}>{msg}</div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>你的经营进度已自动保存，不受影响</div>
        <button className="btn-confirm" style={{ marginTop: 24, width: '100%' }} onClick={() => { this.props.onReset && this.props.onReset(); this.setState({ err: null }) }}>
          重置界面，回到经营页
        </button>
        <button className="btn btn-ghost" style={{ marginTop: 10, width: '100%' }} onClick={() => { try { localStorage.removeItem('hotel-sim-ui') } catch (e) {} location.reload() }}>
          刷新页面
        </button>
      </div>
    )
  }
}

export default function App() {
  const saved = loadState()
  const [user, setUser] = useState(saved.user || null) // null = 未登录
  const [location, setLocation] = useState(saved.location || null) // 选址结果 { city, district }
  const [brand, setBrand] = useState(saved.brand || null) // 选中的品牌
  const [property, setProperty] = useState(saved.property || null) // 认领的物业
  const [established, setEstablished] = useState(saved.established || false) // 是否完成筹建
  const [estChoices, setEstChoices] = useState(saved.estChoices || null) // 筹建决策（投资情景/采购渠道/开业优先级）
  const [tab, setTab] = useState('business')
  const [openPage, setOpenPage] = useState(null) // { title, icon }
  const [currentDecision, setCurrentDecision] = useState(null) // 当前决策
  // 手机侧滑返回：关一层界面（子页/决策面板→回经营tab），永不直接退出站点
  const navRef = React.useRef({})
  navRef.current = { openPage, currentDecision, tab, close: () => { setOpenPage(null); setCurrentDecision(null) }, setTab }
  React.useEffect(() => {
    try { window.history.pushState({ app: 1 }, '') } catch (e) {}
    const onPop = () => {
      const nav = navRef.current
      try {
        if (nav.openPage || nav.currentDecision) nav.close()
        else if (nav.tab !== 'business') nav.setTab('business')
      } catch (e) {}
      try { window.history.pushState({ app: 1 }, '') } catch (e) {}
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const [doneDecisions, setDoneDecisions] = useState(saved.doneDecisions || {}) // 已完成的决策
  // RPG 属性池（品质/声誉/士气）：旧档无 attrs 时用 normalizeAttrs 兜底，保证不 NaN 不报错
  const [attrs, setAttrs] = useState(() => normalizeAttrs(saved.attrs))
  // 属性变化飘字（规格 §8）：App 权威下发增量，供经营页属性条飘「品质 +5」
  // 说明：决策面板是全屏替换分支，确认时经营页会卸载→重挂载，组件内做 diff 拿不到增量
  const [attrFlash, setAttrFlash] = useState(null)
  const [report, setReport] = useState(saved.report || null) // 周报结果
  const [week, setWeek] = useState(saved.week || 1) // 当前经营周
  const [history, setHistory] = useState(saved.history || []) // 历史周报
  const [finished, setFinished] = useState(saved.finished || false) // 是否完成12周经营
  const [welcomed, setWelcomed] = useState(saved.welcomed || false) // 是否看过欢迎页
  const [toasts, setToasts] = useState([]) // 轻提示栈
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false)

  // 学生改真名：更新云端 profiles + 本地 user
  async function handleRename(newName) {
    const name = (newName || '').trim()
    if (!name || !user || name === user.name) return
    if (user.cloud && user.uid) {
      const ok = await updateOwnName(user.uid, name)
      if (!ok) { toast('❌ 改名失败，请重试'); return }
    }
    setUser(prev => ({ ...prev, name }))
    toast(`✅ 已改名为「${name}」，教师端同步更新`)
  }

  // 断网监听：顶部横幅提醒（本地存档不丢）
  useEffect(() => {
    const off = () => setOffline(true)
    const on = () => setOffline(false)
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    return () => { window.removeEventListener('offline', off); window.removeEventListener('online', on) }
  }, [])

  // 轻提示：顶部滑入，2秒自动消失
  function toast(msg) {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, msg }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2000)
  }
  const [pendingReviewCount, setPendingReviewCount] = useState(0) // 未处理差评数（红点）
  const [time, setTime] = useState('')
  const [capital, setCapital] = useState(500000) // 初始资金50万
  const [restoring, setRestoring] = useState(true) // 正在恢复云端会话
  const [classWeek, setClassWeek] = useState(0) // 老师设定的全班统一周（0=不限）

  // 启动时恢复 Supabase 会话（真实登录过的用户不用重新输密码）
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const session = data?.session
        if (!session || cancelled) return
        const profile = await fetchProfile(session.user.id)
        if (cancelled) return
        if (profile) {
          const id = session.user.email.split('@')[0]
          setUser({
            role: profile.role === 'teacher' ? 'teacher' : 'student',
            id,
            name: profile.display_name || id,
            uid: session.user.id,
            email: session.user.email,
            cloud: true,
            groupNo: profile.group_no || null,
            className: profile.class_name || null,
          })
        }
      } catch (e) {} finally {
        if (!cancelled) setRestoring(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // 状态持久化：本机 localStorage 即时保存
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, location, brand, property, established, estChoices, doneDecisions, report, week, history, finished, welcomed, attrs }))
    } catch (e) {}
  }, [user, location, brand, property, established, doneDecisions, report, week, history, finished, welcomed, attrs])

  // 属性飘字自动清除（2s，与飘字动画 1.4s 匹配）
  useEffect(() => {
    if (!attrFlash) return
    const t = setTimeout(() => setAttrFlash(null), 2000)
    return () => clearTimeout(t)
  }, [attrFlash])

  // 云端同步：真实登录时防抖 800ms 上传经营状态（教师端可见）；失败 3s 后自动重试 1 次，仍失败则提示
  const cloudState = { location, brand, property, established, estChoices, doneDecisions, report, week, history, finished, welcomed, attrs }
  useEffect(() => {
    if (!user?.cloud || !user?.uid || restoring) return
    const gk = groupKeyOf(user.className, user.groupNo)
    let retries = 0, pending = true, retryT = null
    const doSave = async () => {
      try {
        const ok = await saveGameState(user.uid, cloudState, gk)
        if (ok) return
        if (retries < 1) { retries++; retryT = setTimeout(doSave, 3000); return }
        toast('云端同步失败，进度已保存在本机，请检查网络')
      } catch (e) {
        if (retries < 1) { retries++; retryT = setTimeout(doSave, 3000); return }
        toast('云端同步失败，进度已保存在本机，请检查网络')
      }
    }
    const t = setTimeout(() => { pending = false; doSave() }, 800)
    // 离开页面前强制保存：切后台/刷新/关闭时立即冲刷未上传的改动
    const flushSave = () => {
      if (!pending) return
      pending = false
      clearTimeout(t)
      saveGameStateNow(user.uid, cloudState, gk).catch(() => {})
    }
    const onVis = () => { if (document.hidden) flushSave() }
    const onHide = () => flushSave()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onHide)
    return () => {
      clearTimeout(t)
      clearTimeout(retryT)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onHide)
    }
  }, [user?.uid, JSON.stringify(cloudState), restoring])

  // 真实时间
  useEffect(() => {
    function update() {
      const d = new Date()
      const h = String(d.getHours()).padStart(2, '0')
      const m = String(d.getMinutes()).padStart(2, '0')
      setTime(`${h}:${m}`)
    }
    update()
    const id = setInterval(update, 30000)
    return () => clearInterval(id)
  }, [])

  // 读取未处理差评数（口碑红点）
  useEffect(() => {
    try {
      const reviews = JSON.parse(localStorage.getItem('hotel-sim-reviews') || '[]')
      setPendingReviewCount(reviews.filter(r => r.status === 'pending').length)
    } catch (e) {}
  }, [tab]) // tab 切换时刷新

  // 云端用户：拉取老师设定的全班统一周
  useEffect(() => {
    if (!user?.cloud) return
    fetchClassWeek().then(setClassWeek).catch(() => {})
  }, [user?.uid, tab])

  const tabs = [
    { key: 'business', icon: '🏠', label: '经营' },
    { key: 'report', icon: '📊', label: '报表' },
    { key: 'reputation', icon: '⭐', label: '口碑', badge: true },
    { key: 'profile', icon: '👤', label: '我的' },
  ]

  function open(title, icon, key) {
    setOpenPage({ title, icon, key })
  }
  function close() {
    setOpenPage(null)
  }
  async function handleLogin(userInfo) {
    setUser(userInfo)
    setTab('business')
    setOpenPage(null)
    // 真实登录：从云端恢复经营进度（本机进度让位于云端最新）
    if (userInfo.cloud && userInfo.uid) {
      try {
        const cloudSaved = await fetchGameState(userInfo.uid, groupKeyOf(userInfo.className, userInfo.groupNo))
        if (cloudSaved) {
          setLocation(cloudSaved.location || null)
          setBrand(cloudSaved.brand || null)
          setProperty(cloudSaved.property || null)
          setEstablished(!!cloudSaved.established)
          setEstChoices(cloudSaved.estChoices || null)
          setDoneDecisions(cloudSaved.doneDecisions || {})
          setReport(cloudSaved.report || null)
          setWeek(cloudSaved.week || 1)
          setHistory(cloudSaved.history || [])
          setFinished(!!cloudSaved.finished)
          setWelcomed(!!cloudSaved.welcomed)
          setAttrs(normalizeAttrs(cloudSaved.attrs)) // 旧云档无 attrs → 回退初值
          // 欢迎回来提示（老档才提示）
          if (cloudSaved.location) toast(`👋 欢迎回来，第 ${cloudSaved.week || 1} 周经营中`)
        } else if (user && user.id !== userInfo.id) {
          // 换账号登录且云端无档：清掉上一账号的本机残留
          resetProgress()
        }
      } catch (e) {} // 云端失败时用本机存档，不阻塞
    }
  }
  function resetProgress() {
    setLocation(null); setBrand(null); setProperty(null); setEstablished(false)
    setDoneDecisions({}); setWelcomed(false); setFinished(false)
    setWeek(1); setHistory([]); setReport(null)
    setAttrs({ ...ATTR_INIT }) // 换号/重开：属性回到初值
    try { localStorage.removeItem('hotel-sim-reviews') } catch (e) {}
  }
  async function handleLogout() {
    if (user?.cloud) {
      const go = window.confirm('确定退出登录吗？\n进度已存云端，换设备登录不丢失。')
      if (!go) return
      try { await supabase.auth.signOut() } catch (e) {}
    }
    setUser(null)
    resetProgress()
    setTab('business')
    setOpenPage(null)
    try { localStorage.removeItem(STORAGE_KEY) } catch (e) {}
  }
  function handleSettle() {
    const doneCount = Object.keys(doneDecisions).length
    if (doneCount === 0) {
      const go = window.confirm('本周还没有做任何决策（0/18），未决策将按默认情况结算。确定直接结算吗？')
      if (!go) return
    }
    // 全班周同步：老师限制了当前周时，学生不能结算超出
    if (user?.cloud) {
      fetchClassWeek().then(classWeek => {
        if (classWeek > 0 && week > classWeek) {
          window.alert(`⏱️ 老师已把全班进度控制在第 ${classWeek} 周，第 ${week} 周还没开课。等老师推进后再来结算。`)
        } else {
          doSettle()
        }
      }).catch(() => doSettle()) // 云端异常不拦结算
    } else {
      doSettle()
    }
  }
  function doSettle() {
    const site = location?.attrs || { 客流: 3 }
    // 读取口碑页差评状态：未处理数压口碑，已整改数给奖励
    let pendingNegatives = 0
    let resolvedCount = 0
    let liveNegCount = 0
    let livePosCount = 0
    try {
      const reviews = JSON.parse(localStorage.getItem('hotel-sim-reviews') || '[]')
      pendingNegatives = reviews.filter(r => r.status === 'pending' || r.status === 'ignored').length
      resolvedCount = reviews.filter(r => r.status === 'resolved').length
      // 本周实时流水里已经产生过的评价（live 标记）——结算只补差额，
      // 否则会出现"实时已出 2 条、结算又整批出 4 条"的重复与数字对不上
      const weekLive = reviews.filter(r => r.live === true && Number(r.liveWeek) === week)
      liveNegCount = weekLive.filter(r => Number(r.stars) <= 3).length
      livePosCount = weekLive.filter(r => Number(r.stars) >= 4).length
    } catch (e) {}
    // 好评率跨周延续：用上一周的好评率做基准；上周危机应对选择影响本周
    let crisisResponse = null
    try {
      const saved = JSON.parse(localStorage.getItem('hotel-sim-crisis-response') || 'null')
      if (saved && saved.week === week - 1) crisisResponse = saved.choice
    } catch (e) {}
    const prevGoodRate = history.length ? history[history.length - 1].finalGoodRate : null
    const result = settle({ site, brand, decisions: doneDecisions, week, pendingNegatives, prevGoodRate, crisisResponse, resolvedCount, attrs, liveNegCount, livePosCount })
    try { localStorage.removeItem('hotel-sim-crisis-response') } catch (e) {}
    // 结算差评回流口碑页（保留已处理的旧评价，追加本周新评价）
    try {
      const kept = reviews.filter(r => r.week == null && !String(r.id).startsWith('w'))
      localStorage.setItem('hotel-sim-reviews', JSON.stringify([...kept, ...result.generatedReviews]))
    } catch (e) {}
    if (crisisResponse) result.crisisChoice = crisisResponse // 危机应对选择存档（学期复盘用）
    // R0 最后一公里：把引擎返回的属性（含每周自然衰减）写回 state
    // 没有这行，衰减与属性→经营只存在于引擎内部，玩家不可见、下周也用不上
    if (result.attrsAfter) setAttrs(result.attrsAfter)
    setReport(result)
  }
  // 结算确认后：进入下一周，清空决策，保存历史
  function handleNextWeek() {
    const newHistory = [...history, report]
    setHistory(newHistory)
    if (week >= 12) {
      // 12周经营结束，出最终成绩
      setFinished(true)
      setReport(null)
    } else {
      setReport(null)
      setWeek(week + 1)
      setDoneDecisions({}) // 新一周重新做决策
    }
  }
  function handleSiteConfirm(result) {
    setLocation(result)
    setBrand(null)
    setProperty(null)
    setEstablished(false)
    setTab('business')
  }
  function handleBrandConfirm(b) {
    setBrand(b)
    setProperty(null)
    setEstablished(false)
  }
  function handleClaimComplete(result) {
    setProperty(result.property)
    setEstablished(false)
  }
  function handleEstablished(choices) {
    const c = choices || { invest: null, supplier: null, opening: [] }
    // 筹建期"物资采购"是一次性选择（非周决策）：品质养成从这里起步，只应用一次
    // 用 estChoices 是否已有渠道做幂等保护（重进筹建流程不会重复加分）
    setAttrs(prev => (estChoices?.supplier ? prev : applyDecisionToAttrs(prev, 'est-supplier', c.supplier)))
    setEstChoices(c)
    setEstablished(true)
    setTab('business')
  }

  // 未登录 → 登录页（先等会话恢复检查完，避免已登录用户闪登录页）
  if (!user) {
    return (
      <div className="app">
        <div className="statusbar">
          <span className="time">{time || '09:41'}</span>
          <span className="icons">📶 🔋</span>
        </div>
        {restoring ? (
          <div className="content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{ fontSize: 44 }}>🏨</div>
            <div style={{ fontSize: 13, color: '#9CA3AF' }}>正在恢复登录状态…</div>
          </div>
        ) : (
          <LoginPage onLogin={handleLogin} />
        )}
      </div>
    )
  }

  // 老师登录 → 直接进教师后台（不走选址/品牌/认领/筹建）
  if (user.role === 'teacher') {
    return (
      <div className="app">
        <div className="statusbar">
          <span className="time">{time || '09:41'}</span>
          <span className="icons">📶 🔋</span>
        </div>
        <TeacherDashboard user={user} onLogout={handleLogout}  onGoDecision={(id) => { setOpenPage(null); setTab("business"); const d = decisions.find(x => x.id === id); if (d) setCurrentDecision(d) }} />
      </div>
    )
  }

  // 学生首次登录（未选址且未看过欢迎页）→ 欢迎页
  if (!location && !welcomed) {
    return (
      <div className="app">
        <div className="statusbar">
          <span className="time">{time || '09:41'}</span>
          <span className="icons">📶 🔋</span>
        </div>
        <Welcome user={user} onStart={() => setWelcomed(true)} />
      </div>
    )
  }

  // 已登录（学生）但未选址 → 选址页
  if (!location) {
    return (
      <div className="app">
        <div className="statusbar">
          <span className="time">{time || '09:41'}</span>
          <span className="icons">📶 🔋</span>
        </div>
        <SiteSelection onConfirm={handleSiteConfirm} />
      </div>
    )
  }

  // 已登录 + 已选址 + 未选品牌 → 选品牌页
  if (!brand) {
    return (
      <div className="app">
        <div className="statusbar">
          <span className="time">{time || '09:41'}</span>
          <span className="icons">📶 🔋</span>
        </div>
        <BrandSelection location={location} onConfirm={handleBrandConfirm} />
      </div>
    )
  }

  // 已登录 + 已选址 + 已选品牌 + 未认领 → 认领酒店页
  if (!property) {
    return (
      <div className="app">
        <div className="statusbar">
          <span className="time">{time || '09:41'}</span>
          <span className="icons">📶 🔋</span>
        </div>
        <Claim brand={brand} location={location} onComplete={handleClaimComplete} />
      </div>
    )
  }

  // 已登录 + 已选址 + 已选品牌 + 已认领 + 未筹建 → 筹建页
  if (!established) {
    return (
      <div className="app">
        <div className="statusbar">
          <span className="time">{time || '09:41'}</span>
          <span className="icons">📶 🔋</span>
        </div>
        <Establishment brand={brand} property={property} onComplete={handleEstablished} />
      </div>
    )
  }

  // 已登录 + 已选址 + 已筹建 → 主界面
  // 如果完成12周经营，显示最终成绩
  if (finished) {
    return (
      <div className="app">
        <div className="statusbar">
          <span className="time">{time || '09:41'}</span>
          <span className="icons">📶 🔋</span>
        </div>
        <FinalResult history={history} user={user} brand={brand} attrs={attrs} onRestart={() => { setFinished(false); setWeek(1); setHistory([]); setDoneDecisions({}); setAttrs({ ...ATTR_INIT }); try { localStorage.removeItem('hotel-sim-reviews') } catch (e) {} }} />
      </div>
    )
  }

  // 如果有周报，显示周报
  if (report) {
    return (
      <div className="app">
        <div className="statusbar">
          <span className="time">{time || '09:41'}</span>
          <span className="icons">📶 🔋</span>
        </div>
        <WeeklyReport result={report} onClose={handleNextWeek} history={history} brand={brand} attrs={attrs} />
      </div>
    )
  }

  // 如果正在做决策，显示决策面板
  if (currentDecision) {
    return (
      <div className="app">
        <div className="statusbar">
          <span className="time">{time || '09:41'}</span>
          <span className="icons">📶 🔋</span>
        </div>
        <DecisionPanel
          key={currentDecision.id}
          decision={currentDecision}
          initial={doneDecisions[currentDecision.id]}
          lastReport={history.length ? history[history.length - 1] : null}
          history={history}
          onBack={() => setCurrentDecision(null)}
          onDone={(id, answer) => {
            // 属性池：先撤销旧答案的增量（学生改答案时不重复累加），再应用新答案
            const prevAnswer = doneDecisions[id]
            const before = normalizeAttrs(attrs)
            const reverted = prevAnswer === undefined ? before : applyDecisionToAttrs(before, id, prevAnswer, -1)
            const after = applyDecisionToAttrs(reverted, id, answer)
            setAttrs(after)
            // 真实属性变化反馈（规格 §8）：如「品质 +5（60→65）」；无变化则为空串
            const deltaText = formatAttrDelta(before, after)
            const flashDelta = {}
            for (const k of ['quality', 'reputation', 'morale']) {
              const diff = after[k] - before[k]
              if (diff !== 0) flashDelta[k] = diff
            }
            setAttrFlash(Object.keys(flashDelta).length ? { ...flashDelta, nonce: Date.now() } : null)
            // 决策流水（N6）：平行写入 decision_log —— 仅云端账号；失败静默，绝不打断既有保存流程
            if (user?.cloud && user?.uid) {
              const dm = decisions.find(d => d.id === id)
              const fb = deltaText
                || (dm && typeof dm.result === 'string' ? dm.result : '')   // 无属性变化 → 决策原有描述
                || (dm && (dm.desc || dm.tip))                              // 兜底：描述/教学提示
                || `${dm ? dm.name : id} 已提交`                             // 最终兜底，绝不为空
              saveDecisionLog({
                userId: user.uid,
                groupKey: groupKeyOf(user.className, user.groupNo),
                week,
                decisionId: id,
                answer,
                feedback: fb,
              }).catch(() => {})   // 双保险：函数内部已 catch，这里再兜一层
            }
            setDoneDecisions({ ...doneDecisions, [id]: answer })
            setCurrentDecision(null)
            const dName = decisions.find(d => d.id === id)?.name || '决策'
            // 与上周选择对比（换思路提醒）：上周选择来自最近一周的决策快照
            const normVal = v => {
              if (v == null) return null
              if (Array.isArray(v)) return JSON.stringify(v)
              if (typeof v === 'object') return JSON.stringify(Object.keys(v).sort().map(k => [k, v[k]]))
              return JSON.stringify(v)
            }
            const lastChoice = history.length ? (history[history.length - 1].decisions || {})[id] : undefined
            const tail = deltaText ? ` · ${deltaText}` : '' // 无属性变化时保留原有描述，不出空反馈
            if (lastChoice === undefined) {
              toast(`✓ ${dName} 已保存${tail}`)
            } else if (normVal(lastChoice) === normVal(answer)) {
              toast(`✓ ${dName} 已保存 · 与上周一致，维持打法${tail}`)
            } else {
              toast(`↺ ${dName} 已保存 · 与上周不同，换了思路${tail}`)
            }
          }}
        />
      </div>
    )
  }

  let mainPage
  if (openPage) {
    mainPage = openPage.key === 'scores'
      ? <ScoreDetail history={history} onBack={close} />
      : openPage.key === 'members'
        ? <GroupMembersPage user={user} onBack={close} onGoDecision={(id) => { setOpenPage(null); setTab('business'); setCurrentDecision(decisions.find(d => d.id === id) || null) }} />
        : openPage.key === 'records'
          ? <OperationRecords history={history} onBack={close} />
          : openPage.key === 'help'
            ? <HelpPage onBack={close} />
            : <PlaceholderPage title={openPage.title} icon={openPage.icon} onBack={close} />
  } else {
    const pages = {
      business: <Business user={user} toast={toast} onOpen={open} location={location} brand={brand} property={property} onDecision={setCurrentDecision} doneDecisions={doneDecisions} onSettle={handleSettle} report={report} week={week} history={history} pendingReviewCount={pendingReviewCount} attrs={attrs} attrFlash={attrFlash} onGoTab={(t2) => { setTab(t2); close() }} onGoRecords={() => { setOpenPage({ title: '经营操作记录', icon: '📋', key: 'records' }) }} />,
      report: <Report report={report} week={week} history={history} />,
      reputation: <Reputation report={report} history={history} week={week} attrs={attrs} decisions={doneDecisions} />,
      profile: <Profile onOpen={open} user={user} location={location} brand={brand} property={property} onLogout={handleLogout} doneDecisions={doneDecisions} week={week} history={history} report={report} onRename={handleRename} attrs={attrs} />,
    }
    mainPage = pages[tab]
  }

  return (
    <div className="app">
      <div className="statusbar">
        <span className="time">{time || '09:41'}</span>
        <span className="icons">📶 🔋</span>
      </div>
      <AppErrorBoundary onReset={() => { setOpenPage(null); setCurrentDecision(null); setTab('business') }}>
        {/* 切页动画包装层：必须是可收缩的 flex 容器，否则会被内容撑高、把 .tabbar 顶出视口（9-19 回归） */}
        <div key={(tab || '') + '|' + (openPage ? openPage.key : '')} style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', animation: 'pageIn 0.25s cubic-bezier(0.22,1,0.36,1)' }}>{mainPage}</div>
      </AppErrorBoundary>
      {/* 断网横幅 */}
      {offline && (
        <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top) + 52px)', left: '50%', transform: 'translateX(-50%)', zIndex: 250, background: '#FEF0EF', border: '1px solid #FECACA', color: '#991B1B', fontSize: 11, fontWeight: 600, padding: '6px 14px', borderRadius: 999, whiteSpace: 'nowrap' }}>
          ⚠ 网络异常，进度已保存在本机
        </div>
      )}
      {/* 轻提示栈（顶部滑入） */}
      <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top) + 10px)', left: '50%', transform: 'translateX(-50%)', zIndex: 300, width: 'max-content', maxWidth: '88%' }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background: 'rgba(17,24,39,0.92)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '9px 16px', borderRadius: 999, marginBottom: 6, boxShadow: 'var(--shadow-lg)', animation: 'pageIn 0.25s cubic-bezier(0.22,1,0.36,1)', textAlign: 'center' }}>
            {t.msg}
          </div>
        ))}
      </div>
      <div className="tabbar">
        {tabs.map(t => (
          <button className={`tab ${tab === t.key && !openPage ? 'active' : ''}`} key={t.key} onClick={() => { setTab(t.key); close() }}>
            <div className="tab-icon">{t.icon}</div>
            <div className="tab-label">{t.label}</div>
            {t.key === 'reputation' && pendingReviewCount > 0 && <div className="badge-num">{pendingReviewCount}</div>}
          </button>
        ))}
      </div>
      {/* 全班进度提示：老师锁周且学生超前时显示 */}
      {classWeek > 0 && !report && !finished && week > classWeek && (
        <div onClick={() => setTab('business')} style={{ position: 'fixed', bottom: 'calc(86px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', background: '#FFF4E0', border: '1px solid #FBE3B3', color: '#A96407', fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 999, whiteSpace: 'nowrap', boxShadow: 'var(--shadow-md)', zIndex: 50, maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          ⏱ 老师已推进全班到第 {classWeek} 周，你在第 {week} 周——决策可先做，结算等开课
        </div>
      )}
    </div>
  )
}
