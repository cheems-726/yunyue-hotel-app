import React, { useState, useEffect, useMemo } from 'react'
import Icon from './Icon.jsx'
import SiteSelection from './SiteSelection.jsx'
import { migrateSave, withScaleVersion, restoreFromCloud, SCALE } from './stateMigration.mjs'
import BrandSelection from './BrandSelection.jsx'
import Claim from './Claim.jsx'
import Establishment from './Establishment.jsx'
import DecisionPanel from './DecisionPanel.jsx'

import TeacherDashboard from './TeacherDashboard.jsx'
import WeeklyReport from './WeeklyReport.jsx'
// ★ §33-V4-E①（2026-10-01）：Bundle 拆分 —— FinalResult/Reputation 出现在流程后段，React.lazy 切独立 chunk
//   ★ 只懒【后段页面】（首屏 Welcome/登录/经营主链不动 —— 拆首屏反而多一次请求）· fallback 用同风格提示。
import { lazy as lazyPage, Suspense as SuspenseR } from 'react'
const FinalResult = lazyPage(() => import('./FinalResult.jsx'))
const Reputation = lazyPage(() => import('./Reputation.jsx'))
import HotelStatus from './HotelStatus.jsx'
import Welcome from './Welcome.jsx'
import { settle } from './settlement.js'
import { decisions, OWNER_LABELS } from './decisions.js'
import { supabase, emailFor, fetchProfile, fetchGameState, fetchClassWeek, fetchClassState, fetchClassDay, fetchGroupMembers, fetchGroupStates, updateOwnName, saveGameState, saveGameStateNow, groupKeyOf, fetchMyNotes, saveDecisionLog } from './supabaseClient.js'
import { getTitle } from './hotelTitle.js'
import { EVENT_INFO } from './settlement.js'
import { TITLES } from './hotelTitle.js'
import { ATTR_INIT, normalizeAttrs, applyDecisionToAttrs, formatAttrDelta, qualityOf } from './attrs.js'
// 🔴 E1（二期 · 唯一账本）：聚合量与四维评分一律走 metricDefs 单源
//   （本文件原有三处自算：组员概况 Σocc/Σprofit、积分明细页的【第三套评分副本】）
import { scoreOf, sumNet, avgOccupancy } from './metricDefs.mjs'
// 🔴 E3（N-3）：三档节奏（实时/周期/一次性）在界面上必须可辨 —— 档位口径来自 decisionCadence（单源）
import { 档 as CAD, 档位 as cadenceOf, 档语 as CAD_LANG } from './decisionCadence.mjs'
// §16.2-B7：周内输入（欠账/整改/实时评价/危机）单源 —— 与服务端补算共用同一派生函数
import { settleInputsFrom } from './weekInputs.mjs'
import { 记录一条 } from './operatorLog.mjs'                       // §22.3-C3：操作者记录单源
import { settleWeekSegmented } from './weekSegments.mjs'          // §19.1 单元1·B4：引擎级分段
import { decisionsByDayFrom } from './weeklyAuto.mjs'             // §19.1：变更记录 → 按天生效的决策
// §16.2-B5：投资项档位 → 品质联动（系数单源在该模块）
import { 投资测算 } from './establishmentInvest.mjs'
// 🔴 E2（N-2）：自动周报 —— 周↔天换算/幂等键/变更记录 全走 weeklyAuto（与 serverTick 同一份口径）
import { dayToWeekDay, shouldAutoSettle, diffDecisions, changeLogLines, classDayFromLocal, revenueSegments } from './weeklyAuto.mjs'
import { teachingDayNo } from './teachingClock.mjs'
import { APP_VERSION } from './version.js'
// ★ §32-U8-补 §2②：老师注入事件的「30 秒应对」选项 —— 单源（界面不解析字符串、不自拼选项）
import { 应对选项Of, 应对可执行Of } from './teacherEvents.mjs'
// ★ §32-U8-补 §2④：AI 领班 —— 授权式代管（一期=记录与复盘；数值执行二期）。
//   注意：settle（引擎）不引用本模块（一期边界有守门断言）—— 记录在 App 层生成后挂到 result。
import { 生效授权, 领班决策, 代管率 } from './aiSupervisor.mjs'

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
          <div style={{ width: 80, height: 80, borderRadius: 24, background: 'var(--warn-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, margin: '0 auto 16px' }}><Icon name="prop.hotel" size={44} /></div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>云悦酒店</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>连锁酒店经营模拟系统</div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>请选择你的身份</div>
        <button className="btn btn-primary" style={{ flex: '0 0 auto', padding: '16px 0', fontSize: 16, marginBottom: 12 }} onClick={() => chooseRole('student')}>我是学生</button>
        <button className="btn btn-ghost" style={{ flex: '0 0 auto', padding: '16px 0', fontSize: 16 }} onClick={() => chooseRole('teacher')}>我是老师</button>
      </div>
    )
  }

  if (step === 'demo') {
    return (
      <div className="content" style={{ display: 'flex', flexDirection: 'column', padding: '40px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>离线演示模式</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>不连服务器，数据只存在本机（{role === 'student' ? '学生 陈小明' : '教师 王老师'}）</div>
        </div>
        <button className="btn-confirm" onClick={handleDemoLogin}>进入演示 →</button>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setStep('form')}>‹ 返回登录</span>
        </div>
      </div>
    )
  }

  return (
    <div className="content" style={{ display: 'flex', flexDirection: 'column', padding: '40px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{role === 'student' ? '学生登录' : '教师登录'}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {role === 'student' ? '首次使用请先注册（学号即账号）' : '首次使用请先注册（工号即账号，如 T001）'}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 6 }}>{role === 'student' ? '学号' : '工号'}</div>
        <input
          value={account}
          onChange={e => setAccount(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          placeholder={role === 'student' ? '如 20240101' : '如 T001'}
          style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 15, outline: 'none', fontFamily: 'inherit' }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 6 }}>密码</div>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          placeholder="至少 6 位"
          style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 15, outline: 'none', fontFamily: 'inherit' }}
        />
      </div>

      {error && <div style={{ color: 'var(--bad)', fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>{error}</div>}

      <button className="btn-confirm" disabled={busy} onClick={handleLogin}>{busy ? '登录中…' : '登录'}</button>
      <button className="btn btn-ghost" style={{ marginTop: 10, padding: '12px 0' }} disabled={busy} onClick={handleSignup}>
        {busy ? '请稍候…' : '注册并登录（首次使用）'}
      </button>

      <div style={{ textAlign: 'center', marginTop: 14, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setStep('choose')}>‹ 返回选择身份</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setStep('demo')}>无网络？离线演示 ›</span>
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
        <div className="placeholder-icon"><Icon name={icon} size={38} /></div>
        <div className="placeholder-title">{title}</div>
        <div className="placeholder-desc">该功能正在建设中，敬请期待</div>
      </div>
    </div>
  )
}

// ===== 经营页（首页） =====
const KEY_DECISIONS = ['pricing', 'shifts', 'reputation'] // 每日关键：调价/排班/口碑
// ★ §32-U8-补：两个本地设置的唯一读取点（单一来源 = localStorage：界面写、结算读；不在 React state 里存副本）
function 读事件应对() {
  try { return JSON.parse(localStorage.getItem('hotel-sim-event-response') || 'null') } catch (e) { return null }
}
function 读领班覆盖() {
  try { const v = JSON.parse(localStorage.getItem('hotel-sim-supervisor-auth') || 'null'); return (v && typeof v === 'object') ? v : null } catch (e) { return null }
}

// ★ §32-U8-补 §2②：老师注入事件卡（经营页 · 本周生效）—— 30 秒应对（复用既有危机应对 UI 范式）
//   · 选项来自 teacherEvents.应对选项Of（单源）；E8 的 label 与引擎比较值逐字一致（'立即整改'）
//   · 选择写 localStorage `hotel-sim-event-response`（当周选、当周用；派生于 weekInputs.settleInputsFrom）
//   · 30 秒超时自动按【最后一个选项】（= 最差侧）记录 —— 与危机卡"超时按不理会"同语义
function InjectedEventsCard({ 事件s, week }) {
  const [回答, set回答] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem('hotel-sim-event-response') || 'null'); return (v && Number(v.week) === Number(week) && v.事件id) ? { [v.事件id]: v.choice } : {} } catch (e) { return {} }
  })
  const [左, set左] = useState({})   // 剩余秒数（按事件id）
  useEffect(() => {
    const t = setInterval(() => {
      set左(prev => {
        const next = {}
        for (const e of 事件s) {
          const 选项 = 应对选项Of(e.来源事件)
          const 已答 = 回答[e.来源事件]
          if (已答 || !选项.length) continue
          const cur = prev[e.来源事件] == null ? 30 : prev[e.来源事件]
          next[e.来源事件] = Math.max(0, cur - 1)
        }
        return next
      })
    }, 1000)
    return () => clearInterval(t)
  }, [事件s, 回答])
  // 超时自动记录（最差侧）
  useEffect(() => {
    for (const e of 事件s) {
      const 选项 = 应对选项Of(e.来源事件)
      if (!选项.length) continue
      if (!回答[e.来源事件] && 左[e.来源事件] === 0) 选(e.来源事件, 选项[选项.length - 1].label, true)
    }
  }, [左, 事件s, 回答])
  function 选(事件id, label, 超时) {
    set回答(prev => ({ ...prev, [事件id]: label }))
    try { localStorage.setItem('hotel-sim-event-response', JSON.stringify({ week: Number(week), 事件id, choice: label, 超时: !!超时 })) } catch (e) {}
  }
  if (!事件s.length) return null
  return (
    <div style={{ padding: '0 20px 12px' }}>
      {事件s.map(e => {
        const 选项 = 应对选项Of(e.来源事件)
        const 已答 = 回答[e.来源事件]
        const 可执行 = 应对可执行Of(e.来源事件)
        return (
          <div key={e.id || e.来源事件} style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 8, background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warn)' }}>
                <Icon name={e.icon || 'log.ops'} size={14} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {String(e.name || '').replace(/^[\u{1F4CC}]?\s*老师注入 · /u, '老师注入 · ')}
                <span style={{ fontSize: 10, background: 'var(--primary)', color: '#fff', borderRadius: 5, padding: '1px 6px', marginLeft: 6 }}>老师注入{e.injectedBy ? ` · ${e.injectedBy}` : ''}</span>
              </div>
              {!已答 && <span style={{ fontSize: 18, fontWeight: 700, color: (左[e.来源事件] ?? 30) <= 10 ? 'var(--bad)' : 'var(--warn)' }}>{左[e.来源事件] ?? 30}s</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, marginTop: 3 }}>{e.text}</div>
            {!已答 ? (
              <div style={{ marginTop: 8 }}>
                {选项.map(o => (
                  <div key={o.label} onClick={() => 选(e.来源事件, o.label)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#fff', borderRadius: 8, marginBottom: 5, cursor: 'pointer', border: '1px solid var(--fill)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{o.label}</span>
                    {o.effect && <span style={{ fontSize: 10, color: 'var(--warn)' }}>{o.effect}</span>}
                  </div>
                ))}
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  ⏱ {左[e.来源事件] ?? 30}s 内不选将按最差选项记录
                  {可执行 ? ' · 本事件应对【即刻生效】（进入本周结算）' : ' · 你随后的经营决策决定实际结果（应对留痕进周报复盘）'}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--good)', fontWeight: 600, marginTop: 6 }}>你的应对：{已答}——结果将在本周结算体现</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Business({ user, toast, onOpen, location, brand, property, onDecision, doneDecisions, onSettle, report, week, history, pendingReviewCount, onGoTab, onGoRecords, attrs, attrFlash, capital, onGoReport, classDayIndex, dayFlows, daySource, 本周注入 = [] }) {
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
      toast && toast('全部 18 项决策已完成，可以结算了')
    }
  }, [doneDecisions])
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
          <span className="day-tag"><Icon name="date.week" size={13} /> 第 {week} 周</span>
        </div>
        <div className="sub">{brand ? `${brand.name} · ${location?.district}` : ''} · 已决策 {doneCount}/18 · {(() => {
          const last = history.length ? history[history.length - 1] : null
          const lv = brand?.level || ''
          const q = qualityOf(attrs)
          const t = getTitle(last ? last.occupancy : 0, last ? last.finalGoodRate : 85, q)
          return t.title
        })()}</div>
      </div>

      {/* 酒店状态面板（RPG属性）
          ★ §26.3（P0b）：dayFlows = 本周【预览结算】的引擎日快照（7 天）· dayIndex = 本周第几天
          ⇒ 面板"今日流水/本周累计"与周报/结算同源（Σ7天 === 周值 由引擎恒等式保证），面板不再自记金额。
          ★ 本组件（Business）自己**不**算预览 —— 由主组件算好传下来（weekPreview 在主组件作用域）。 */}
      <HotelStatus report={report} brand={brand} property={property} week={week} history={history} attrs={attrs} attrFlash={attrFlash} decisions={doneDecisions}
        dayFlows={dayFlows} dayIndex={classDayIndex} daySource={daySource} />

      {/* ★ §32-U8-补 §2②：老师注入事件（本周生效）—— 30 秒应对卡（条件渲染：无注入 ⇒ 不渲染零变化） */}
      {!report && 本周注入.length > 0 && <InjectedEventsCard 事件s={本周注入} week={week} />}

      {/* 本周决策进度 */}
      <div style={{ padding: '0 20px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>
          <span>本周决策进度</span>
          <span style={{ color: doneCount === 18 ? 'var(--good)' : 'var(--warn)', fontWeight: 600 }}>{doneCount} / 18</span>
        </div>
        <div style={{ height: 6, background: 'var(--fill)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: (doneCount / 18 * 100) + '%', background: doneCount === 18 ? 'var(--good)' : 'var(--primary)', borderRadius: 3, transition: 'width 0.4s cubic-bezier(0.22,1,0.36,1)' }}></div>
        </div>
      </div>

      <div className="card">
        <div className="card-title"><span style={{width:8,height:8,borderRadius:'50%',background:'var(--primary)'}}></span>{report ? `第${report.week}周结算结果` : (history.length ? `第${history[history.length-1].week}周结算结果` : '本周经营中')}</div>
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
              {neg > 0 && <div className="delta down" style={{color:'var(--warn)'}}>需处理</div>}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
            {/* 🔴 E2：手动结算已退场 ⇒ 文案不得再让学生去点一个不存在的按钮 */}
            本周经营中：到第 7 个游戏日<b>自动出周报</b>（不看也在跑）
          </div>
        )}
        {pendingReviewCount > 0 && (
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8, color: 'var(--bad)', borderColor: 'var(--bad-border)' }}
            onClick={() => onGoTab('reputation')}>
            去口碑页处理 {pendingReviewCount} 条差评（处理率占分 15%）→
          </button>
        )}
        {report && report.events && report.events.length > 0 && (
          <div style={{ margin: '10px 0 0', padding: '7px 12px', background: 'var(--bg)', borderRadius: 8, fontSize: 11, color: 'var(--text-sub)' }}>
            上周事件 {report.events.length} 起：{report.events.map((e, i) => (
              <span key={i} style={{ color: e.type === 'crisis' ? 'var(--bad)' : e.type === 'good' ? 'var(--good)' : 'inherit', fontWeight: e.type === 'crisis' ? 700 : 400 }}>
                <Icon name={e.icon} size={12} style="{ display: 'inline-block', verticalAlign: '-2px' }" />{e.name}{i < report.events.length - 1 ? '、' : ''}
              </span>
            ))}
          </div>
        )}
        {!report && doneCount < 18 && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--warn)', textAlign: 'center' }}>
            还有 {18 - doneCount} 项未决策，未做的按"维持现状"生效
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
            <div style={{ marginTop: 10, padding: '7px 12px', background: promoted ? 'var(--good-bg)' : demoted ? 'var(--bad-bg)' : 'var(--warn-bg)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: promoted ? 'var(--good)' : demoted ? 'var(--bad)' : 'var(--warn)', textAlign: 'center' }}>
              {promoted ? `恭喜晋升：${tPrev.title} → ${tNow.title}` : demoted ? `降级：${tPrev.title} → ${tNow.title}，下周稳住` : `当前称号：${tNow.title}`}
              <div style={{ height: 4, background: 'var(--fill)', borderRadius: 2, marginTop: 5, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: tNow.progress + '%', background: 'var(--primary)', borderRadius: 2 }} />
              </div>
              {tNow.next && <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)', marginTop: 3 }}>距「{tNow.next}」还差综合 {tNow.nextAt - tNow.composite} 分</div>}
            </div>
          )
        })()}
        {/* 🔴 E2：手动「本周结算」按钮已退场 —— 周报由"7 个游戏日满"自动产生（不看也在跑）。
            保留的只有【只读】入口「查看本周周报」；无死按钮（没成报时显示进度状态，不给按钮）。 */}
        {report ? (
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 12, padding: '12px 0', fontSize: 14 }}
            onClick={() => onGoReport()}>
            查看本周周报（第 {report.week} 周）
          </button>
        ) : (
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--bg)', border: '1px dashed var(--border)', fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.7 }}>
            ⏳ 本周经营中 · 第 <b>{classDayIndex ?? 1}/7</b> 天
            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              到第 7 天<b>自动出周报</b>（不用点结算）· 已决策 {Object.keys(doneDecisions).length}/18
            </div>
          </div>
        )}
        {history.length > 0 && (
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 6, fontSize: 12 }}
            onClick={() => onGoRecords()}>
            查看往期决策复盘（{history.length} 周）
          </button>
        )}
      </div>

          {/* 今日关键未完成提醒 */}
      {(() => {
        const undoneKeys = KEY_DECISIONS.filter(id => doneDecisions[id] === undefined)
        if (undoneKeys.length === 0 || report) return null
        const names = undoneKeys.map(id => decisions.find(d => d.id === id)?.name).filter(Boolean)
        return (
          <div style={{ margin: '0 20px 12px', padding: '9px 14px', background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', borderRadius: 10, fontSize: 12, color: 'var(--bad)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flexShrink: 0, display: 'flex' }}><Icon name="status.warn" size={14} /></span>
            <span>今日关键未完成：<b>{names.join('、')}</b>——这些直接影响本周经营结果</span>
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
        // 资金唯一权威 = state.capital（由 settle 返回写回）。
        // 🔴 原式 500000 − ΣtotalExpenses + Σprofit 属双重扣成本：profit 已扣除 totalCost（含 weeklyExpenses），
        //    再减一次 totalExpenses → 学生看到的资金被系统性低估（实测第1周差 6,981 = 当周 totalExpenses）
        const cap = capital
        const expenses = report?.totalExpenses || 0
        // 🔴 T1.1：随资金口径按 m 缩放（可变黄 = IC×0.2；变红 = IC×0.1）
        // 🔴 W2-2：随资金口径再次按 m 缩放（IC 502万 → 149万）
        // 🔴 W2 收尾：阈值改引 SCALE.变黄线/变红线（单源）—— 原先是硬编码数字，
        //    W2-2 改 IC 时这里的注释改了、数字差点漏改（同类漏改已在 BrandSelection/WeeklyReport 抓到 2 处）
        const isLow = cap < SCALE.变黄线
        const isCritical = cap < SCALE.变红线
        return (
          <div className="card" title="点击查看实时流水明细"
            onClick={() => { contentRef.current && contentRef.current.scrollTo({ top: 0, behavior: 'smooth' }) }}
            style={{ background: isCritical ? 'var(--bad-bg)' : isLow ? 'var(--warn-bg)' : 'var(--good-bg)', borderColor: isCritical ? 'var(--bad-border)' : isLow ? 'var(--warn-border)' : 'var(--good-border)', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: isCritical ? 'var(--bad)' : isLow ? 'var(--warn)' : 'var(--good)' }}>
                {isCritical ? '破产预警' : isLow ? '资金偏低' : '资金状况'}
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, color: isCritical ? 'var(--bad)' : isLow ? 'var(--warn)' : 'var(--good)' }}>
                {(cap / 10000).toFixed(1)} 万
              </span>
            </div>
            {expenses > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>
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
                  <div style={{ fontSize: 11, cursor: 'pointer', color: 'var(--text-sub)', userSelect: 'none' }} onClick={() => setShowBreakdown(!showBreakdown)}>
                    {showBreakdown ? '▾' : '▸'} 上周支出构成（共 {lastH.totalExpenses.toLocaleString()} 元，点看明细）
                  </div>
                  {showBreakdown && (() => {
                    // 较上周增减对比（成本管控教学）：上周分项数据来自 history 倒数第二条
                    const prevH = history.length >= 2 ? history[history.length - 2] : null
                    const prevExp = prevH && prevH.weeklyExpenses ? prevH.weeklyExpenses : null
                    return bd.map(([k, v]) => {
                      const prevV = prevExp ? (prevExp[k] || 0) : null
                      const diffPct = prevV != null && prevV > 0 ? Math.round((v - prevV) / prevV * 100) : null
                      const dColor = diffPct == null ? 'var(--text-muted)' : diffPct > 0 ? 'var(--bad)' : diffPct < 0 ? 'var(--good)' : 'var(--text-muted)'
                      return (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text)', padding: '2px 0' }}>
                          <span style={{ width: 50, flexShrink: 0, color: 'var(--text-sub)' }}>{k}</span>
                          <div style={{ flex: 1, height: 5, background: 'var(--fill)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: Math.round(v / (lastH.totalExpenses || 1) * 100) + '%', background: 'var(--warn)', borderRadius: 3 }} />
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
            {isCritical && <div style={{ fontSize: 11, color: 'var(--bad)', marginTop: 4, fontWeight: 600 }}>资金断裂将触发破产，期末扣分！立即控成本、增收</div>}
          </div>
        )
      })()}
      {/* 主力客群提示 */}
      {location?.district && (
        <div style={{ margin: '0 20px 8px', padding: '6px 12px', background: 'var(--primary-bg)', borderRadius: 8, fontSize: 11, color: 'var(--info)', display: 'flex', alignItems: 'center', gap: 6 }}>
          决策时注意匹配 {location.district} 的主力客群偏好
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
                    return done === total ? `${done}/${total} 全完成` : `${done}/${total} 已决策`
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
                    style={!isDone && decisions.filter(x => doneDecisions[x.id] === undefined)[0]?.id === d.id ? { border: '2px solid var(--primary)', animation: 'pulseBorder 1.5s ease-in-out infinite' } : {}}
                    title={isDone ? `当前答案：${fmtDecision(doneDecisions[d.id])}（点击修改）` : undefined}>
                    <div className="task-card-icon-wrap" style={{ position: 'relative', flexShrink: 0 }}>
                      <div className={`task-icon ${bgMap[mod]}`}><Icon name={d.icon} size={22} /></div>
                      {(!isDone && KEY_DECISIONS.includes(d.id) || (d.id === 'reputation' && pendingReviewCount > 0)) && (
                        <span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', background: 'var(--bad)', border: '2px solid #fff' }} />
                      )}
                    </div>
                    <div className="task-body" onClick={e => { e.stopPropagation(); setExpandedDesc(x => ({ ...x, [d.id]: !x[d.id] })) }}>
                      <div className="name">
                        <span style={{ fontSize: 10, color: 'var(--border-strong)', fontWeight: 400, marginRight: 4 }}>{decisions.indexOf(d) + 1}.</span>
                        {d.name} {isDone && '✓'}{!isDone && KEY_DECISIONS.includes(d.id) && <span style={{ fontSize: 10, color: 'var(--bad)', fontWeight: 600, marginLeft: 6 }}>每日关键</span>}
                        {(() => { const k = cadenceOf(d.id); if (!k) return null; const c = CAD_LANG[k]
                          const style = k === CAD.实时 ? { background: 'var(--good-bg)', color: 'var(--good)', border: '1px solid var(--good-border)' }
                            : k === CAD.周期 ? { background: 'var(--primary-bg)', color: 'var(--info)', border: '1px solid var(--primary-border)' }
                              : { background: 'var(--bad-bg)', color: 'var(--bad)', border: '1px solid var(--bad-border)' }
                          return <span title={c.说明} style={{ fontSize: 9, borderRadius: 4, padding: '1px 5px', marginLeft: 5, fontWeight: 600, ...style }}>{c.名}</span> })()}{d.owner && OWNER_LABELS[d.owner] && (d.owner === user?.groupRole
  ? <span title="这是你的职责决策" style={{ fontSize: 9, color: '#fff', background: 'var(--primary)', borderRadius: 4, padding: '1px 5px', marginLeft: 5, fontWeight: 700 }}>我的职责</span>
  : <span title="建议负责职业" style={{ fontSize: 9, color: 'var(--info)', background: 'var(--primary-bg)', borderRadius: 4, padding: '1px 5px', marginLeft: 5 }}><Icon name={OWNER_LABELS[d.owner].icon} size={11} style={{ display: 'inline-block', verticalAlign: '-1px' }} /> {OWNER_LABELS[d.owner].label}</span>)}
                      </div>
                      <div className="desc" style={expandedDesc[d.id] ? { whiteSpace: 'normal', fontSize: 11, lineHeight: 1.6, color: 'var(--text-sub)', padding: '3px 0 2px' } : { whiteSpace: 'nowrap' }}>
                        {isDone
                          ? (expandedDesc[d.id]
                              ? `当前答案：${fmtDecision(doneDecisions[d.id])}`
                              : `当前：${String(fmtDecision(doneDecisions[d.id])).slice(0, 20)}…`)
                          : (expandedDesc[d.id] ? d.desc : d.desc.slice(0, 25) + (d.desc.length > 25 ? '…' : ''))}
                        <span style={{ color: 'var(--primary)', marginLeft: 4 }}>{expandedDesc[d.id] ? '收起' : (isDone ? '展开答案' : (d.desc.length > 25 ? '全文' : ''))}</span>
                      </div>
                      {!isDone && lastChoice != null && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '1px 0 2px' }}>上周：{String(fmtDecision(lastChoice)).slice(0, 18)}{String(fmtDecision(lastChoice)).length > 18 ? '…' : ''}</div>
                      )}
                    </div>
                    <span className={`task-badge ${isDone ? 'badge-done' : 'badge-new'}`}>{isDone ? '已决策·可改' : '去决策'}</span>
                  </div>
                  )
                })}
              </div>
            </div>
          ))}
      {/* 回到顶部悬浮按钮（Business 内部，状态同作用域） */}
      {showTop && (
        <button
          onClick={() => { if (contentRef.current) contentRef.current.scrollTo({ top: 0, behavior: 'smooth' }) }}
          style={{ position: 'fixed', bottom: 'calc(86px + env(safe-area-inset-bottom))', right: 16, width: 36, height: 36, borderRadius: '50%', background: '#fff', border: '1px solid var(--border)', cursor: 'pointer', zIndex: 60, fontSize: 14, color: 'var(--text-sub)' }}
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
      <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="var(--fill)" strokeWidth="1" />
      {Array.from({ length: TOTAL }, (_, i) => (
        <line key={'g' + i} x1={xs(i)} y1={PT} x2={xs(i)} y2={H - PB} stroke="var(--fill)" strokeWidth="1" />
      ))}
      <polyline points={line(occ)} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" />
      <polyline points={line(prof)} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" />
      {occ.map((p, i) => <circle key={'o' + i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="var(--primary)" strokeWidth="2" />)}
      {prof.map((p, i) => <circle key={'p' + i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="var(--primary)" strokeWidth="2" />)}
      {Array.from({ length: TOTAL }, (_, i) => (
        <text key={'w' + i} x={xs(i)} y={H - 6} fontSize="8" fill={i < n ? 'var(--text-muted)' : 'var(--border-strong)'} textAnchor="middle">{i + 1}</text>
      ))}
      <text x={PL} y={9} fontSize="9" fill="var(--primary)">■ 出租率%</text>
      <text x={PL + 62} y={9} fontSize="9" fill="var(--primary)">■ 利润(万)</text>
      {n < TOTAL && <text x={W - PR} y={9} fontSize="9" fill="var(--border-strong)" textAnchor="end">还剩 {TOTAL - n} 周</text>}
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
        <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="var(--fill)" strokeWidth="1" />
        <line x1={PL} y1={zeroY} x2={W - PR} y2={zeroY} stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="4 3" />
        <text x={W - PR} y={zeroY - 4} fontSize="8" fill="var(--text-muted)" textAnchor="end">盈亏平衡线 0</text>
        <polyline points={cum.map((v, i) => `${xs(i)},${ys(v)}`).join(' ')} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" />
        {cum.map((v, i) => (
          <circle key={'c' + i} cx={xs(i)} cy={ys(v)} r="3" fill="#fff" stroke="var(--primary)" strokeWidth="2" />
        ))}
        {breakeven && (
          <>
            <circle cx={xs(beIdx)} cy={ys(cum[beIdx])} r="4.5" fill="var(--good)" stroke="#fff" strokeWidth="1.5" />
            <text x={xs(beIdx)} y={ys(cum[beIdx]) - 9} fontSize="9" fontWeight="700" fill="var(--good)" textAnchor={labelAnchor(beIdx)}>第{history[beIdx].week}周回本</text>
          </>
        )}
        {history.map((h, i) => (
          <text key={'w' + i} x={xs(i)} y={H - 6} fontSize="9" fill="var(--text-muted)" textAnchor="middle">{h.week}周</text>
        ))}
        <text x={PL} y={9} fontSize="9" fill="var(--primary)">■ 累计利润</text>
      </svg>
      <div style={{ fontSize: 11, fontWeight: 600, textAlign: 'center', marginTop: 4, color: breakeven ? 'var(--good)' : acc >= 0 ? 'var(--good)' : 'var(--bad)' }}>
        {breakeven ? `第 ${history[beIdx].week} 周实现累计盈利，当前累计 ${acc.toLocaleString()} 元`
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
    <span style={{ fontSize: 9, fontWeight: 700, color: good ? 'var(--good)' : 'var(--bad)', marginLeft: 3 }}>
      {up ? '↑' : '↓'}{Math.abs(diff)}{unit}
    </span>
  )
}
function Report({ report, week, history }) {
  // 智能诊断：基于真实经营指标
  const diagnoses = []
  if (report) {
    if (report.occupancy < 55) diagnoses.push({ icon: 'status.warn', text: `出租率 ${report.occupancy}%，距健康线 55% 还差 ${55 - report.occupancy} 个百分点。手段：调价让利拉客 / 加大OTA与活动投放 / 修口碑（见效慢但持久）。` })
    if (report.occupancy >= 75) diagnoses.push({ icon: 'status.warn', text: `出租率 ${report.occupancy}% 处于满负荷区，注意服务品质——本周已有 ${report.negativeCount} 条差评，满房期更要盯排班和卫生。` })
    if (report.profit < 0) diagnoses.push({ icon: 'status.warn', text: `本周亏损 ${Math.abs(report.profit)} 元（单房均亏 ${Math.round(Math.abs(report.profit) / report.rooms)} 元）。成本大头：固定 ${Math.round(report.rooms * 65)} 元档 + 人力浮动，先砍营销费再谈提价。` })
    if (report.negativeCount > 0) diagnoses.push({ icon: 'nav.review', text: `本周 ${report.negativeCount} 条差评：及时回复可减半负面影响（口碑少掉一半），拖到下周会触发「差评发酵」危机。` })
    if (report.demandStrength < 0.8) diagnoses.push({ icon: 'money.spend', text: `客源强度 ${report.demandStrength}（全班本周同值，市场大盘无法改变）——能改变的是应对：口碑与会员是逆风期的压舱石。` })
    if (diagnoses.length === 0) diagnoses.push({ icon: 'status.done', text: `本周经营稳健：出租率 ${report.occupancy}%、好评率 ${report.finalGoodRate}%、利润 ${report.profit >= 0 ? '+' : ''}${report.profit} 元。继续保持节奏！` })
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
            // 🔴 T1.4/B1·B2 术语口径（周营收 ⇒ 都要 ÷7 才是"每天"）：
            //   ADR     = 实收房价 = 周客房收入 ÷ 售出间夜 = revenue ÷ (occupiedRooms × 7)
            //   RevPAR  = 周营收 ÷ (房量 × 7) = ADR × 出租率
            //   ⚠️ ADR 不再用 report.price —— 那是【定价】，非实收（缺口表 B2）
            const adr = report.occupiedRooms > 0 ? Math.round(report.revenue / (report.occupiedRooms * 7)) : 0
            const rev = report.rooms > 0 ? Math.round(report.revenue / (report.rooms * 7)) : 0
            const prevAdr = prev && prev.occupiedRooms > 0 ? Math.round(prev.revenue / (prev.occupiedRooms * 7)) : null
            const prevRev = prev && prev.rooms > 0 ? Math.round(prev.revenue / (prev.rooms * 7)) : null
            return (<>
          <div style={{display:'flex',gap:8,margin:'0 20px 14px'}}>
            <div className="card" style={{flex:1,margin:0,padding:'12px 8px',textAlign:'center'}}>
              <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:6}}>出租率</div>
              <div style={{fontSize:16,fontWeight:700}}>{report.occupancy}<span style={{fontSize:10,color:'var(--text-sub)',fontWeight:400}}>%</span><KpiDelta cur={report.occupancy} prev={prev?.occupancy ?? null} unit="pt" /></div>
            </div>
            <div className="card" style={{flex:1,margin:0,padding:'12px 8px',textAlign:'center'}}>
              <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:6}}>ADR<span style={{fontWeight:400,color:'var(--border-strong)'}}>（实收）</span></div>
              <div style={{fontSize:16,fontWeight:700}}>{adr}<span style={{fontSize:10,color:'var(--text-sub)',fontWeight:400}}>元/间·天</span><KpiDelta cur={adr} prev={prevAdr} unit="元" /></div>
            </div>
            <div className="card" style={{flex:1,margin:0,padding:'12px 8px',textAlign:'center'}}>
              <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:6}}>RevPAR</div>
              <div style={{fontSize:16,fontWeight:700}}>{rev}<span style={{fontSize:10,color:'var(--text-sub)',fontWeight:400}}>元/间·天</span><KpiDelta cur={rev} prev={prevRev} unit="元" /></div>
            </div>
          </div>
          <div style={{display:'flex',gap:8,margin:'0 20px 14px'}}>
            <div className="card" style={{flex:1,margin:0,padding:'12px 8px',textAlign:'center'}}>
              <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:6}}>利润</div>
              <div style={{fontSize:16,fontWeight:700,color:report.profit>=0?'var(--good)':'var(--bad)'}}>{report.profit>=0?'+':''}{report.profit}<span style={{fontSize:10,color:'var(--text-sub)',fontWeight:400}}>元</span><KpiDelta cur={report.profit} prev={prev?.profit ?? null} unit="元" /></div>
            </div>
            <div className="card" style={{flex:1,margin:0,padding:'12px 8px',textAlign:'center'}}>
              <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:6}}>口碑分</div>
              <div style={{fontSize:16,fontWeight:700}}>{(report.finalGoodRate/20).toFixed(1)}<span style={{fontSize:10,color:'var(--text-sub)',fontWeight:400}}>/5</span><KpiDelta cur={report.finalGoodRate} prev={prev?.finalGoodRate ?? null} unit="pt" /></div>
            </div>
            <div className="card" style={{flex:1,margin:0,padding:'12px 8px',textAlign:'center'}}>
              <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:6}}>差评</div>
              <div style={{fontSize:16,fontWeight:700}}>{report.negativeCount}<span style={{fontSize:10,color:'var(--text-sub)',fontWeight:400}}>条</span><KpiDelta cur={report.negativeCount} prev={prev?.negativeCount ?? null} unit="条" goodUp={false} /></div>
            </div>
          </div>
            </>)
          })()}

          {/* 智能诊断 */}
          <div className="card" style={{ background: 'var(--primary-bg)', borderColor: 'var(--primary-border)' }}>
            <div className="card-title">智能诊断</div>
            {diagnoses.map((d, i) => (
              <div key={i} style={{ fontSize: 13, color: 'var(--info)', lineHeight: 1.7, padding: '4px 0' }}><Icon name={d.icon} size={14} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {d.text}</div>
            ))}
          </div>
        </>
      ) : (
        <div className="card">
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
            暂无经营数据<br />完成第一次结算后查看报表
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">出租率与利润趋势</div>
        {history.length > 1 ? (
          <TrendChart history={history} />
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0' }}>
            结算满 2 周后解锁趋势图
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">累计利润 · 盈亏平衡</div>
        {history.length > 0 ? (
          <BreakEvenChart history={history} />
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>完成结算后查看累计利润走势</div>
        )}
      </div>

      <div className="card">
        <div className="card-title">历史周报</div>
        {history.length > 0 ? (
          history.slice().reverse().map((h, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--fill)' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>第 {h.week} 周</span>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-sub)' }}>
                <span>出租率 {h.occupancy}%</span>
                <span>利润 <span style={{ color: h.profit >= 0 ? 'var(--good)' : 'var(--bad)' }}>{h.profit}</span></span>
              </div>
            </div>
          ))
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>暂无历史记录</div>
        )}
      </div>
    </div>
  )
}

// ===== 我的页 =====
function Profile({ onOpen, user, location, brand, property, onLogout, doneDecisions, week, history, report, onRename, attrs }) {
  // B2/B3 修复：改名弹窗的 state 与 JSX 必须和入口（下方 ✏️）在同一组件。
  // 原实现弹窗在 Business、入口在 Profile → 两边都 ReferenceError（真机表现"点了没反应"）
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameVal, setRenameVal] = useState(user?.name || '')
  const menus = [
    { icon: 'log.ops', bg: 'blue', name: '经营操作记录', key: 'records' },
    { icon: 'achv.title', bg: 'green', name: '积分与评分明细', key: 'scores' },
    { icon: 'nav.group', bg: 'blue', name: '小组成员', key: 'members' },
    { icon: 'teach.point', bg: 'amber', name: '玩法说明', key: 'help' },
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
      setBackupMsg('备份文件已下载，建议发到微信/邮箱保存')
    } catch (e) {
      setBackupMsg('导出失败：' + e.message)
    }
  }
  function importBackup(file) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        if (data.app !== 'yunyue-hotel') { setBackupMsg('不是云悦酒店的备份文件'); return }
        if (data.state) localStorage.setItem(STORAGE_KEY, data.state)
        if (data.reviews) localStorage.setItem('hotel-sim-reviews', data.reviews)
        setBackupMsg('恢复成功，正在刷新…')
        setTimeout(() => window.location.reload(), 800)
      } catch (e) {
        setBackupMsg('备份文件损坏：' + e.message)
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
          return { '标杆酒店': 'var(--warn-border)', '人气名店': 'var(--primary-bg)', '精品酒店': 'var(--primary-border)', '舒适旅店': 'var(--good-bg)' }[name] || 'var(--warn-bg)'
        })(),display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,transition:'background 0.5s'}}><Icon name="guest" size={28} /></div>
      {/* 真实姓名修改弹窗（B2/B3：state 与弹窗都在本组件，与入口 ✏️ 同处） */}
      {renameOpen && (
        <div onClick={() => setRenameOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 32px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 22, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>修改真实姓名</div>
            <input
              value={renameVal}
              onChange={e => setRenameVal(e.target.value)}
              placeholder="输入真实姓名（教师端将显示）"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setRenameOpen(false)}>取消</button>
              <button className="btn-confirm" style={{ flex: 2, opacity: renameVal.trim() ? 1 : 0.5 }} disabled={!renameVal.trim()}
                onClick={() => { const n = renameVal.trim(); if (n && n !== user?.name) onRename(n); setRenameOpen(false) }}>保存</button>
            </div>
          </div>
        </div>
      )}
        <div style={{ minWidth: 0 }}>
          <div
            style={{fontSize:18,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}
            title="点击修改真实姓名"
            onClick={() => setRenameOpen(true)}
          >
            {user?.name || '未命名'} <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>改名</span>
          </div>
          <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{orgDesc}</div>
        </div>
      </div>

      <div className="card" style={{background:'var(--warn-bg)',borderColor:'var(--warn-border)',padding:14}}>
        {(() => {
          const last = history.length ? history[history.length - 1] : null
          const lv = brand?.level || ''
          const q = qualityOf(attrs)
          const ti = getTitle(last ? last.occupancy : 0, last ? last.finalGoodRate : 85, q)
          return (<>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--warn)', fontWeight: 700 }}><Icon name={ti.icon} size={15} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> 我的酒店称号</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>排名以教师端为准</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--warn)' }}>{ti.title}</div>
            </div>
            <div style={{ height: 6, background: 'var(--warn-border)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: ti.progress + '%', background: 'var(--primary)', borderRadius: 3, transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
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
        const changeTag = { up: { t: '晋升', c: 'var(--good)', bg: 'var(--good-bg)' }, down: { t: '降级', c: 'var(--bad)', bg: 'var(--bad-bg)' }, start: { t: '起步', c: 'var(--warn)', bg: 'var(--warn-bg)' }, same: { t: '保持', c: 'var(--text-sub)', bg: 'var(--fill)' } }
        return (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">称号历程</div>
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
                  <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="var(--fill)" strokeWidth="1" />
                  <polyline points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={rising ? 'var(--good)' : 'var(--bad)'} strokeWidth="2" strokeLinejoin="round" />
                  {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#fff" stroke={rising ? 'var(--good)' : 'var(--bad)'} strokeWidth="1.5" />)}
                  <text x={PL} y={7} fontSize="8" fill="var(--text-muted)">综合分 {vals[0]} → {vals[n - 1]}</text>
                </svg>
              )
            })()}
            {[...rows].reverse().map(r => {
              const tag = changeTag[r.change]
              return (
                <div key={r.week} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--fill)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 44, flexShrink: 0 }}>第{r.week}周</span>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}><Icon name={r.icon} size={14} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {r.title}</span>
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
        <div className="card-title" style={{ marginBottom: 10 }}>我的酒店档案</div>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>酒店称号</span>
            <span style={{ fontWeight: 600, color: 'var(--warn)' }}>{(() => {
              const occ = report ? report.occupancy : (history.length ? history[history.length - 1].occupancy : 0)
              const gr = report ? report.finalGoodRate : (history.length ? history[history.length - 1].finalGoodRate : 85)
              const lv = brand?.level || ''
              const q = qualityOf(attrs)
              const t = getTitle(occ, gr, q)
              return t.title
            })()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>酒店</span>
            <span style={{ fontWeight: 600 }}>{property?.name || '未认领'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>品牌</span>
            <span style={{ fontWeight: 600 }}>{brand?.name || '未选择'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>所在地</span>
            <span style={{ fontWeight: 600 }}>{location ? `${location.city}·${location.district}` : '未选址'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>经营进度</span>
            <span style={{ fontWeight: 600 }}>第 {week} / 12 周</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>经营天数</span>
            <span style={{ fontWeight: 600 }}>{history.length * 7} 天</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>开业日期</span>
            <span style={{ fontWeight: 600 }}>3 月 1 日（第 1 周周一）</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>物业类型</span>
            <span style={{ fontWeight: 600 }}>{property?.type || '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>品牌档次</span>
            <span style={{ fontWeight: 600 }}>{brand?.level || '—'}</span>
          </div>
        </div>
      </div>

      {/* 本周决策记录 */}
      <div className="card">
        <div className="card-title">第 {week} 周决策记录</div>
        {Object.keys(doneDecisions).length > 0 ? (
          decisions.filter(d => doneDecisions[d.id] !== undefined).map(d => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--bg)' }}>
              <span style={{ fontSize: 13 }}><Icon name={d.icon} size={13} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {d.name}</span>
              <span style={{ fontSize: 12, color: 'var(--good)', fontWeight: 600 }}>✓ 已决策</span>
            </div>
          ))
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
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
          <div className="card" style={{ background: 'var(--warn-bg)' }}>
            <div className="card-title">老师评语</div>
            {notes.map((n, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: i < notes.length - 1 ? '1px solid var(--warn-border)' : 'none' }}>
                {n.note && <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{n.note}</div>}
                {n.score != null && <div style={{ fontSize: 12, color: 'var(--warn)', fontWeight: 700, marginTop: 4 }}>评分：{n.score} / 100</div>}
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{n.week > 0 ? `第${n.week}周批注 · ` : ''}{new Date(n.updated_at).toLocaleDateString('zh-CN')}</div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* 本地备份 */}
      <div className="card">
        <div className="card-title">数据备份</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
          进度已自动存云端+本机。导出备份文件可防误删账号/清浏览器数据，双保险。
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={exportBackup}>导出备份</button>
          <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
            导入恢复
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={e => e.target.files[0] && importBackup(e.target.files[0])} />
          </label>
        </div>
        {backupMsg && <div style={{ fontSize: 11, color: 'var(--warn)', marginTop: 8 }}>{backupMsg}</div>}
      </div>

      <div className="card" style={{padding:'4px 0'}}>
        {menus.map(m => (
          <div key={m.name} onClick={() => onOpen(m.name, m.icon, m.key)}
            style={{display:'flex',alignItems:'center',gap:12,padding:'12px 6px',borderBottom:'1px solid var(--bg)',cursor:'pointer',transition:'transform 0.12s'}}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateX(2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = ''}>
            <div style={{width:42,height:42,borderRadius:14,background:m.bg==='amber'?'var(--warn-bg)':m.bg==='blue'?'var(--primary-bg)':'var(--good-bg)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:19}}><Icon name={m.icon} size={19} /></div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:600}}>{m.name}</div>
              <div style={{fontSize:10,color:'var(--text-muted)',marginTop:1}}>{{records:'逐周决策复盘与批注时间线',scores:'四维评分与积分构成',members:'队友概况与职责分工',help:'玩法说明与常见问题'}[m.key] || ''}</div>
            </div>
            <div style={{color:'var(--border-strong)'}}>›</div>
          </div>
        ))}
        <div onClick={onLogout} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 6px',cursor:'pointer',transition:'transform 0.12s'}}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateX(2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = ''}>
          <div style={{width:42,height:42,borderRadius:14,background:'var(--bad-bg)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:19}}><Icon name="event.resign" size={19} /></div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:600,color:'var(--bad)'}}>退出登录</div>
            <div style={{fontSize:10,color:'var(--text-muted)',marginTop:1}}>进度已自动保存，换设备登录不丢失</div>
          </div>
          <div style={{color:'var(--border-strong)'}}>›</div>
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--border-strong)', paddingBottom: 8 }}>云悦酒店 v{APP_VERSION}</div>
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
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '32px 20px', lineHeight: 1.8 }}>
          还没有结算记录<br />完成第一周结算后，这里会记录你的每个决策评价
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
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                出租率 {h.occupancy}% · 利润 {h.profit >= 0 ? '+' : ''}{h.profit}元 · 差评 {h.negativeCount}条
              </span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{isOpen ? '▲ 收起' : '▼ 展开'}</span>
          </div>
          {isOpen && (<>
          {entries.length > 0 && (
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
              {entries.map(([id, val]) => {
                const d = decisions.find(x => x.id === id)
                return (
                  <div key={id} style={{ fontSize: 11, color: 'var(--text)', padding: '2px 0' }}>
                    · {d ? d.name : id}：<b>{fmtDecision(val)}</b>
                  </div>
                )
              })}
            </div>
          )}
          {(h.insights && h.insights.length > 0) ? h.insights.map((ins, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: i < h.insights.length - 1 ? '1px solid var(--fill)' : 'none' }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}><Icon name={ins.good ? 'status.done' : 'status.warn'} size={14} style={{ display: 'inline-block', verticalAlign: '-2px' }} /></span>
              <span style={{ fontSize: 12, color: ins.good ? 'var(--good)' : 'var(--bad)', lineHeight: 1.6 }}>{ins.text}</span>
            </div>
          )) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>该周无关键决策复盘</div>
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
    { icon: 'campaign', title: '游戏目标', body: '从选址到开业经营一家酒店 12 周。最终按四维加权评分：利润 40% + 口碑 25% + 出租率 20% + 差评处理 15%，S 到 D 六个等级。' },
    { icon: 'date.week', title: '每周节奏', body: '每周做 18 项决策（做完自动沉底，可点击修改）→ 【第 7 个游戏日自动出周报】（不用点结算）→ 去口碑页处理差评 → 进入下一周。决策不足 9 项会被扣口碑（不作为也是决策）。' },
    { icon: 'status.crisis', title: '事件系统', body: '共 22 种事件（含 4 类危机/资金预警），全是你的经营状态招来的：差评拖欠会发酵、高出租率+少人手会挨投诉、口碑好会来网红探店。危机事件（橙框）要在 30 秒内选应对方案，超时按最差处理。' },
    { icon: 'achv.title', title: '酒店称号', body: '普通旅社 → 舒适旅店 → 精品酒店 → 人气名店 → 标杆酒店。出租率、好评率、品质分加权决定，每周结算后可能晋升或降级。' },
    { icon: 'achv.badge', title: '怎么涨分', body: '利润：控成本+提房价找平衡；口碑：及时回复差评、定期深清洁；出租率：55%-75% 是健康区；差评：总数越少分越高。全部逻辑与最终成绩完全一致。' },
    { icon: 'log.ops', title: '18项决策速查', body: '点击下方展开查看全部决策清单，课堂讨论时可以快速定位。' },
    { icon: 'note.caliber', title: '数据安全', body: '进度自动存云端+本机。「我的」页可导出备份文件；换设备登录同一学号自动恢复。重开经营需二次确认且会覆盖云端，慎重。' },
    { icon: 'nav.live', title: '实时运营面板', body: '经营页「酒店状态」卡会随真实时间流动：每天早上退房高峰（12:00 前退房）、下午 2 点起办入住，在店人数、今日流水跟着涨落，还有前台/客房/工程部的实时动态滚动。数值是模拟演算，实际收支以每周结算为准。口碑页顶部还有「口碑构成拆解」卡——处理率、好评率、满意度三指标怎么互相影响，一张图看懂。' },
    { icon: 'nav.group', title: '组队共管', body: '老师把几位同学设为同班级+同组号后，你们将共同经营同一家酒店：任何人登录看到的都是同一份进度，决策互相接续。「小组成员」页可查看队友的酒店概况和称号。职业设定：进入「小组成员」页，每位成员点击自己的职业卡片即可选定（店长统筹 / 大堂经理服务客诉 / 财务资金报表 / 运营专员定价活动 / 人事排班招聘），选完立即生效——经营页里你职责范围内的决策会置顶并标「我的职责」。差评处理建议分工：大堂经理主笔回复话术（回复靠诚意得分，敷衍的回复等于没回），店长把关补偿尺度（补偿成本计入周结算），每周结算后全组一起过一遍口碑页——差评欠 2 条以上会触发「差评发酵」危机，别攒着。另外，教师评语供复盘参考，不计入评分；最终成绩由老师结合评语自行评判——评语会显示在你的「我的」页评语卡里，按周写的那条是老师对你当周经营的针对性点评，值得细读。' },
    { icon: 'teach.point', title: '常见操作指引', body: `改名：我的页 → 点名字旁 → 输入新名字。导出备份：我的页 → 数据备份 → 导出。查看排名：教师端或帮老师查。查看历史：我的页 → 经营操作记录。\n\n当前 App 版本 v${APP_VERSION}（${APP_VERSION_CODE}）——若与老师通知的版本号不一致，说明你用的还是旧版：网页版刷新即可，安卓 App 请找管理员要新版安装包。` },
  ]
  const faqs = [
    { q: '网页打不开怎么办？', a: '优先用安卓App；正式版会更换为国内直连域名，以老师通知的网址为准。' },
    { q: '之前做的进度还在吗？', a: '在。进度自动存云端，用同一学号登录自动恢复；也可在「我的」页导出备份文件双重保险。' },
    { q: '周报怎么还没出？', a: '周报按【游戏日】自动产生：本周 7 个游戏日跑满就出（不用点任何按钮）。若老师设置了全班统一周，你超前的进度会等老师推进 —— 被拦的是「进入下一周」，不是周报本身。' },
    { q: '为什么全班同一周的市场结果一样？', a: '结算用固定随机种子：同一周全班的市场波动、事件概率完全相同。这是刻意的公平设计——比的是「同样的市场条件下，谁的决策更好」，而不是谁的运气好。你唯一能控制的是决策。' },
    { q: '组队之后差评谁来处理？', a: '回复入口全组都能用，建议分工：大堂经理主笔回复（回复按诚意得分，敷衍的回复客人会更生气且差评继续挂着）；要不要补偿、补多少由店长拍板（补偿成本计入周结算）；其他成员负责在结算后一起复盘差评来源。差评超过 2 条不处理会发酵成危机。' },
    { q: '好评也要回复吗？', a: '要。真诚的感谢（+欢迎再来/小惊喜）会让好评客人变成回头客，甚至带来「朋友推荐而来」的新好评——口碑就是这么滚起来的。只回一个「好的」，客人的热情就被泼了冷水。' },
    { q: '职业可以换吗？', a: '可以。在「小组成员」页重新点选职业卡片即立即生效，经营页的职责置顶会跟着变。但建议固定一段时间再换——每种职业的决策要点不同，熟悉职责才有分工意义。换职业不影响已完成的决策和经营数据。' },
    { q: '超售设置多少合适？', a: '超额预订是双刃剑：超售 1-2 间，能对冲客人临时取消，满房率↑；超售 3 间以上，到店无房的概率大增——每超 1 间约 8% 概率触发赔偿+差评。经验法则：参照历史 no-show 率（通常 3-5%），宁少勿多。旅游旺季可以适度激进，商务客为主的店要保守——商务客对「到店无房」几乎零容忍。' },
    { q: '带职业徽章的决策和普通决策有什么区别？', a: '本质上没有任何区别——18 项决策全组都能做。徽章只是分工建议：带「我的职责」蓝标的是与你的职业匹配的决策（如财务看报表诊断、运营看动态调价），系统会帮你置顶；带灰色「建议负责」的是队友职业对应的决策。全做完当然最好，但时间紧时先保自己的职责项。' },
    { q: '实时运营面板的数据是真的吗？', a: '面板里的日期、入住退房、今日流水都是随真实时间模拟演算的——帮助你理解酒店一天怎么运转。但它们只是「当日估算」，真正计入成绩的资金和经营数据以每周结算为准。看趋势学运营，算成绩等结算。' },
    { q: '实时评价是什么？为什么突然冒出评价？', a: '客人会随时写下自己的体验：退房高峰（上午 12:00 前）最容易出评价，住店期间偶尔也会随手写一条。评价会同时出现在两个地方——口碑页的卡片，和经营页「实时运营」流里的那一行。它出现的频率不高，而且你的酒店状态越极端（特别好或特别差）越容易出：满意和不满的客人更愿意开口，中间状态大多沉默。注意：实时评价只是「当日实时」的反馈，真正计入成绩的是每周结算。' },
    { q: '为什么我好评多、差评少？', a: '这是刻意的设计：当你的综合满意度在中性以上（品质/声誉/士气都不错）时，实时评价几乎只会是好话——做得好不该被骂。差评主要来自两条路：①状态真的差（满意度跌破中性，通常是品质/声誉被衰减或决策拖低之后）；②每周结算时按你的决策口径算出来的差评（这部分才是主体），比如不停房深清洁、低价采购、精简排班都会实打实地招差评。所以「实时好评多」不代表周报里没有差评。' },
    { q: '口碑页的卡片数，和周报里的评价数字对得上吗？', a: '对得上，这是刻意保证的一致：周报「本周 X 条评价、Y 条差评」就是本周评价卡片的总数——实时已经出现的那些先占位，结算时只补「差额」部分，不会重复生成。唯一会上浮的情况是触发「口碑爆发」（好评率≥80% 时的追加好评），卡片会比周报数字多 1-2 张。差评则永远不封顶：周报说几条差评，口碑页就有几张差评卡。' },
    { q: '评价里的客人身份、「关联经营」是什么？', a: '每条评价都有一位自洽的客人：姓氏+称呼（先生/女士，头像与称呼一致）、客群（商务出差/家庭出游/旅行散客/会议客人）、房型、住几晚——让评价读起来像真的。卡片上的「关联经营」默认是折叠的：客人不会告诉你他为什么不满，这一点保持真实；但当你想复盘时点开它，就能看到这条评价源于本组的哪项决策、当时选的是什么（例如「来源：本组『 前台排班』选择了 精简省成本」）。它是把「客人抱怨」翻译成「经营因果」的开关。' },
    { q: '决策没做完就结算会怎样？', a: '未做的决策按「维持现状」默认结算——不作为也是一种决策。但注意三点：①完成度不足 9 项会直接扣口碑；②「每日关键」决策（动态调价/前台排班/口碑管理）对当周结果影响最大，跳过它们等于主动放弃利润；③每周都有新情况，上周的对策这周可能就不管用了。建议：把带红点的关键决策做完再结算。' },
    { q: '差评回复怎么写才更有诚意？', a: '换位思考是关键：先真诚道歉接住客人情绪，再给出具体的解决措施（改什么、怎么改、什么时候改好），必要时提供合理补偿，并留下跟进渠道让客人放心。反过来，推卸责任、只用模板套话、光道歉不给方案，客人只会更生气——差评也解决不了。' },
    { q: '决策面板里的"近3周轨迹"怎么理解？', a: '轨迹列出了你这项决策近几周的选择，以及每周的实际结果（出租率/利润）。用法：对比不同选择的产出——如果连续两周同样的打法结果都不好，说明市场在变，该换思路了；如果换了之后结果明显变好，就坚持新打法。轨迹+趋势块一起看，复盘效率最高。' },
    { q: '老师的批注和打分怎么算？', a: '老师在你的下钻详情里按周写批注并打分（0-100），教师评语供复盘参考，不计入评分；最终成绩由老师结合评语自行评判。批注会显示在「我的」页评语卡，按周写的那条是对你当周经营的针对性点评。想拿高分：决策做完做透、差评及时处理、经营思路在决策里体现出来。' },
    { q: '重新开始经营，老师的批注还在吗？', a: '在。重新开始只清空你的经营进度（决策/周报/资金），老师的批注存在云端不受影响，新学期还能看到历史批注做参考。但如果换了组，新组员的进度会从第 1 周重新开始。' },
    { q: '怎么看我们组的决策趋势？', a: '三个入口：①经营页打开任意决策，面板里有「该决策近3周轨迹」；②「我的」页称号历程有综合分走势和每周决策记录；③教师端的实时决策大屏和周次快照可以看到全班的对比。复盘时先看轨迹再定打法。' },
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
          <div className="card-title"><Icon name={s.icon} size={15} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {s.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.9 }}>{s.body}</div>
        </div>
      ))}

      <div className="card">
        <div className="card-title">资金管理指南</div>
        <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.9 }}>
          <div><b>资金在哪看：</b>经营页顶部「资金状况」卡。开局系统给你一笔<b>运营启动资金</b>（约 {SCALE.IC_NEW / 10000} 万），每周结算后自动增减。<b>它是经营周转用的钱，不等于"开一家酒店的总投资"</b>——筹建投入见「报价单」。</div>
          <div><b>每周扣什么：</b>租金（按选址租金档，30–50 元/间·天）+ 部门成本（人力 / 客房 / 能耗 / 维修等，约合营收 45%）+ 营销投放（OTA 佣金：直营投放抽 11%，平台合作模式全营收抽 15%）+ 超售赔偿 + 事件罚款（消防 1500 元、设备维修 800 元等）。</div>
          <div><b>两条预警线：</b>低于 <b style={{ color: 'var(--warn)' }}>约 {SCALE.变黄线 / 10000} 万</b> 变黄「资金偏低」；低于 <b style={{ color: 'var(--bad)' }}>约 {SCALE.变红线 / 10000} 万</b> 变红「破产预警」。</div>
          <div><b>破产后果：</b>资金断裂（扣到负）触发破产，<b>期末成绩直接扣分</b>——宁少赚别乱花。</div>
          <div><b>控成本三板斧：</b>①排班按出租率浮动（旺季满编、淡季精简）②营销看投产比，别为投放而投放 ③差评及时处理，欠多了发酵成危机损失更大。</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">事件速览（22种，都是经营状态招来的）</div>
        {EVENT_INFO.map(e => (
          <div key={e.name} style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '5px 0', borderBottom: '1px solid var(--bg)' }}>
            <span style={{ fontSize: 13, flexShrink: 0 }}><Icon name={e.icon} size={14} /></span>
            <span style={{ fontSize: 12, fontWeight: 600, color: e.type === 'good' ? 'var(--good)' : e.type === 'crisis' ? 'var(--bad)' : 'var(--bad)', flexShrink: 0 }}>{e.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.trigger}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">称号一览（5级）</div>
        {TITLES.map((ti, i) => (
          <div key={ti.name} style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '5px 0', borderBottom: '1px solid var(--bg)' }}>
            <span style={{ fontSize: 13 }}><Icon name={ti.icon} size={15} /></span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warn)', flexShrink: 0 }}>{ti.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>综合 ≥ {ti.min}</span>
          </div>
        ))}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>综合分 = 出租率×35% + 好评率×35% + 品质分×30%（品质分由品牌档次决定）</div>
      </div>

      <div className="card" style={{ background: 'var(--primary-bg)', borderColor: 'var(--primary-border)' }}>
        <div className="card-title">常见问题</div>
        {faqs.map(f => (
          <div key={f.q} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--info)' }}>Q：{f.q}</div>
            <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7, marginTop: 2 }}>A：{f.a}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-title">18项决策速查</div>
        {[
          ...decisions.slice(0, 7).map(d => ({ mod: '部门运营', ...d })),
          ...decisions.slice(7, 12).map(d => ({ mod: '会员推广', ...d })),
          ...decisions.slice(12).map(d => ({ mod: '门店经营', ...d })),
        ].map((d, i) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--bg)' }}>
            <span style={{ fontSize: 11, color: 'var(--border-strong)', flexShrink: 0 }}>{i + 1}.</span>
            <span style={{ fontSize: 12, fontWeight: 600, flexShrink: 0 }}><Icon name={d.icon} size={13} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {d.name}</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{d.module}</span>
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
              // 🔴 E1：组员概况的平均出租率/累计利润也走单源（原自算 Σ，与主视图两套口径）
              occ: avgOccupancy(h),
              profit: sumNet(h).value,
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
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '32px 20px', lineHeight: 1.8 }}>
          老师还没给你分配组号和班级<br />
          分配后这里会自动显示你的组员
        </div>
      )}

      {hasGroup && members === null && (
        <div className="card">
          {[0, 1].map(i => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--fill)' }}>
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
          <div className="card-title">我的职位</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>选择你在团队中的角色（影响课堂分工，全员均可做决策）</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
              { role: 'manager', icon: 'role.manager', label: '店长/总经理', desc: '全局统筹' },
              { role: 'lobby', icon: 'role.service', label: '大堂经理', desc: '服务/客诉/调度' },
              { role: 'finance', icon: 'role.finance', label: '财务', desc: '资金/报表' },
              { role: 'ops', icon: 'role.ops', label: '运营专员', desc: '定价/OTA/活动' },
              { role: 'hr', icon: 'role.hr', label: '人事专员', desc: '招聘/排班' },
            ].map(r => (
              <button key={r.role}
                onClick={() => { import('./supabaseClient.js').then(m => m.setGroupRole(user.uid, r.role)); setMyRole(r.role) }}
                style={{
                  flex: '1 1 30%', minWidth: 90, padding: '10px 8px', borderRadius: 10,
                  border: myRole === r.role ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: myRole === r.role ? 'var(--warn-bg)' : '#fff',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                }}>
                <div style={{ fontSize: 20, display: 'flex' }}><Icon name={r.icon} size={20} /></div>
                <div style={{ fontSize: 11, fontWeight: 700, color: myRole === r.role ? 'var(--warn)' : 'var(--text)' }}>{r.label}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{r.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {hasGroup && members !== null && (
        <div className="card">
          <div className="card-title">我的组员（{members.length + 1} 人）</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--fill)' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--warn-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}><Icon name="guest" size={18} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{user.name} <span style={{ fontSize: 11, color: 'var(--warn)', fontWeight: 600 }}>（我）</span></div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>学号 {user.id}</div>
            </div>
          </div>
          {members.map(m => {
            const st = memberStates[m.user_id]
            return (
              <div key={m.user_id} style={{ padding: '10px 0', borderBottom: '1px solid var(--fill)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}><Icon name="guest" size={18} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {m.display_name}
                      {st && st.title && <span style={{ fontSize: 10, color: 'var(--warn)', background: 'var(--warn-bg)', borderRadius: 5, padding: '1px 6px', marginLeft: 6 }}>{st.titleIcon} {st.title}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
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
                        style={{ fontSize: 10, fontWeight: 700, color: full ? 'var(--good)' : 'var(--warn)', background: full ? 'var(--good-bg)' : 'var(--warn-bg)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', display: 'inline-block' }}
                        title={full ? '职责决策全部完成' : '点击查看未完成的职责决策'}
                      >
                        <Icon name={full ? 'status.done' : 'date.week'} size={13} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {OWNER_LABELS[role] && <Icon name={OWNER_LABELS[role].icon} size={13} style={{ display: 'inline-block', verticalAlign: '-2px' }} />}{OWNER_LABELS[role]?.label || role}职责决策 {doneCnt}/{duty.length} 完成{!full ? ' · 点击查看' : ''}
                      </span>
                      {dutyOpenUid === m.user_id && undone.length > 0 && (
                        <div style={{ marginTop: 4, padding: '6px 10px', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: 8 }}>
                          {undone.map(d => (
                            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                              <span style={{ fontSize: 11, color: 'var(--bad)', flex: 1, lineHeight: 1.5 }}>
                                · {d && <Icon name={d.icon} size={12} style={{ display: 'inline-block', verticalAlign: '-2px' }} />} {d?.name}——还没做，提醒 TA 去经营页完成
                              </span>
                              {onGoDecision && (
                                <button onClick={e => { e.stopPropagation(); onGoDecision(d.id) }}
                                  style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'var(--primary)', border: 'none', borderRadius: 5, padding: '3px 9px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
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
                  <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-sub)', marginTop: 6, paddingLeft: 52 }}>
                    <span>平均出租率 <b style={{ color: 'var(--text)' }}>{st.occ}%</b></span>
                    <span>累计利润 <b style={{ color: st.profit >= 0 ? 'var(--good)' : 'var(--bad)' }}>{st.profit >= 0 ? '+' : ''}{(st.profit / 10000).toFixed(2)}万</b></span>
                  </div>
                )}
              </div>
            )
          })}
          {members.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0', lineHeight: 1.8 }}>
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
  // 🔴 E1（二期 · 唯一账本）：改调 metricDefs.scoreOf —— 本处原先是【第三套副本】（FinalResult/TeacherDashboard 之外），
  //   而且它的差评维度【漏了处理率分支】（只有条数）⇒ 同一份 history 在「积分明细页」与「成绩单」上
  //   差评得分可能不同（学生可见的口径不一致）。现在三处同源。
  const cum = scoreOf(history)
  const dims = [
    { label: '利润', weight: 0.4, score: cum.profitScore },
    { label: '口碑', weight: 0.25, score: cum.reputationScore },
    { label: '出租率', weight: 0.2, score: cum.occupancyScore },
    { label: '差评处理', weight: 0.15, score: cum.negativeScore },
  ]
  const grade = cum.grade.slice(0, 1)
  return (
    <div className="content">
      <div className="header">
        <div className="row1">
          <span className="hotel-name" style={{ cursor: 'pointer' }} onClick={onBack}>‹ 返回</span>
        </div>
        <div className="sub">四维评分与 FinalResult 完全同口径</div>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: 20 }}>
        <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--primary)' }}>{cum.finalScore}</div>
        <div style={{ fontSize: 12, color: 'var(--warn)', fontWeight: 600 }}>预测等级 {grade} · 按目前已结算的 {history.length} 周计算</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{history.length < 12 ? '经营继续，此分数会随周数实时变化' : '12周已结算完毕'}</div>
      </div>

      <div className="card">
        <div className="card-title">当前累计四维得分</div>
        {dims.map(d => (
          <div key={d.label} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{d.label} <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>权重{Math.round(d.weight * 100)}%</span></span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{d.score}分</span>
            </div>
            <div style={{ height: 7, background: 'var(--fill)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: d.score + '%', background: d.score >= 80 ? 'var(--good)' : d.score >= 60 ? 'var(--primary)' : 'var(--bad)', borderRadius: 4 }}></div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">勋章墙</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { icon: 'money.profit', name: '首次盈利', got: history.some(h => h.profit > 0) },
            { icon: 'prop.hotel', name: '出租率破80', got: history.some(h => h.occupancy >= 80) },
            { icon: 'nav.review', name: '口碑4.5+', got: history.some(h => h.finalGoodRate >= 90) },
            { icon: 'status.done', name: '零差评周', got: history.some(h => h.negativeCount === 0 && h.reviewCount > 0) },
            (() => {
              let owed = null
              try {
                const revs = JSON.parse(localStorage.getItem('hotel-sim-reviews') || '[]')
                owed = revs.filter(r => r.status === 'pending' || r.status === 'ignored').length
              } catch (e) {}
              return { icon: 'ops.cleaning', name: '零欠差评', got: owed !== null && owed === 0 }
            })(),
            { icon: 'achv.title', name: '跻身A级', got: cum.finalScore >= 80 },
            { icon: 'achv.badge', name: '完赛', got: history.length >= 12 },
          ].map(b => (
            <div key={b.name} style={{ textAlign: 'center', padding: '10px 4px', background: b.got ? 'var(--warn-bg)' : 'var(--bg)', borderRadius: 10, border: b.got ? '1px solid var(--warn-border)' : '1px solid var(--fill)' }}>
              <div style={{ filter: b.got ? 'none' : 'grayscale(1)', opacity: b.got ? 1 : 0.35, display: 'flex' }}><Icon name={b.icon} size={22} /></div>
              <div style={{ fontSize: 10, fontWeight: 600, color: b.got ? 'var(--warn)' : 'var(--text-muted)', marginTop: 2 }}>{b.name}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>点亮全部勋章 = 把每一项经营都做到位</div>
      </div>

      <div className="card">
        <div className="card-title">
          逐周累计走势
          <button className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 11 }}
            onClick={() => {
              const text = `云悦酒店·累计成绩（${history.length}周）
综合评分 ${cum.finalScore}（${grade}）
出租率 ${cum.occupancyScore}分 | 口碑 ${cum.reputationScore}分 | 利润 ${cum.profitScore}分 | 差评处理 ${cum.negativeScore}分
——来自云悦酒店经营模拟`
              navigator.clipboard.writeText(text).then(() => setScoreCopied(true)).catch(() => setScoreCopied(false))
            }}>复制</button>
        </div>
        {scoreCopied && <div style={{ fontSize: 11, color: 'var(--good)', marginBottom: 8 }}>已复制累计成绩</div>}
        {history.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>还没结算过，先去经营页完成第一周</div>}
        {history.map((_, i) => {
          const upto = history.slice(0, i + 1)
          const s = scoreOf(upto)
          return (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--fill)' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>第 {upto.length} 周结算后</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 120, margin: '0 12px' }}>
                <div style={{ flex: 1, height: 6, background: 'var(--fill)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: s.finalScore + '%', background: 'var(--primary)', borderRadius: 3 }}></div>
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>{s.finalScore}分</span>
            </div>
          )
        })}
      </div>

      <div className="card" style={{ background: 'var(--primary-bg)', borderColor: 'var(--primary-border)' }}>
        <div className="card-title">怎么涨分</div>
        <div style={{ fontSize: 12, color: 'var(--info)', lineHeight: 1.8 }}>
          利润（40%）：收入减成本的差额，累计≥50万=满分、≥30万=85 分档<br />
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
const STORAGE_BAK_KEY = 'hotel-sim-state.bak-v1'   // 口径迁移前的原始存档（只写一次，永不覆盖）

// 🔴 批次 B1（D25）：读档时做【口径迁移】—— 旧档金额是旧量级，不迁移会出现"一周混口径"
//    （旧 capital 50 万量级 + 新 profit 10 倍量级 ⇒ 资金曲线跳变、破产教学失真）
//    · 幂等：迁移后 scaleVersion=2，再读直接跳过（migrateSave 内部判断）
//    · .bak：只在【首次】迁移前落一次原始存档，供回滚；绝不覆盖
//    · 不删档：只换量级，不动任何字段与条目
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    const r = migrateSave(parsed)
    if (r.migrated && r.save) {
      try {
        if (!localStorage.getItem(STORAGE_BAK_KEY)) localStorage.setItem(STORAGE_BAK_KEY, raw)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(r.save))
      } catch (e) { /* 写盘失败也不阻断：内存里已返回迁移结果 */ }
      try { console.log('[存档迁移]', r.reason, '· 缩放 history', r.scaledHistory, '条') } catch (e) {}
      return r.save
    }
    return parsed
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
        <div style={{ fontSize: 44, display: 'flex', justifyContent: 'center' }}><Icon name="status.critical" size={44} /></div>
        <div style={{ fontSize: 17, fontWeight: 700, marginTop: 12 }}>页面出了点问题</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, wordBreak: 'break-all', lineHeight: 1.6 }}>{msg}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>你的经营进度已自动保存，不受影响</div>
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
  // 手机侧滑返回 / 安卓返回键的统一处理（**纯网页方案，iOS Safari 与安卓浏览器都走这条**）
  // 规则（用户 2026-09-22 定·选项2）：
  //   · 子页(openPage) → 关闭它
  //   · 非经营 tab    → 切回经营
  //   · **决策面板(currentDecision) 不注册为历史层**：面板打开时返回键/边缘手势【什么都不做】
  //     理由：边缘手势两端通治，且教学场景里"误滑退出决策页"比"返回键关不掉"更烦人；面板自带「‹ 返回」
  // 三条保障不变：① 子页仍可被返回关闭 ② 非经营 tab 仍回经营 ③ 永不退出站点（每次处理完立刻再 pushState）
  const navRef = React.useRef({})
  navRef.current = {
    openPage, currentDecision, tab,
    close: () => { setOpenPage(null); setCurrentDecision(null) },
    closePage: () => setOpenPage(null),
    setTab,
  }
  // P1-补：左边缘 24px 触摸拦截层 —— 仅在【弹层/决策面板打开时】启用，避免挡住正常左侧交互。
  // 目的：把"左边缘右滑"在应用内消化掉，不让它被系统/浏览器解释成返回。
  // ⚠️ 真机预期（如实记录）：Android 的【系统】返回手势由 OS 在网页之前处理，网页通常拦不住；
  //    本层至少能挡住浏览器级的边缘滑动/横滚，并让"面板打开时左边缘拖动"不产生副作用。
  //    必须用原生 addEventListener({passive:false})：React 的合成 touch 监听是被动的，preventDefault 无效。
  const edgeGuardRef = React.useRef(null)
  const anyLayerOpen = !!(openPage || currentDecision)
  React.useEffect(() => {
    const el = edgeGuardRef.current
    if (!el || !anyLayerOpen) return
    const stop = (e) => { e.preventDefault(); e.stopPropagation() }
    const opts = { passive: false }
    el.addEventListener('touchstart', stop, opts)
    el.addEventListener('touchmove', stop, opts)
    el.addEventListener('touchend', stop, opts)
    return () => {
      el.removeEventListener('touchstart', stop)
      el.removeEventListener('touchmove', stop)
      el.removeEventListener('touchend', stop)
    }
  }, [anyLayerOpen])

  React.useEffect(() => {
    try { window.history.pushState({ app: 1 }, '') } catch (e) {}
    const onPop = () => {
      const nav = navRef.current
      try {
        if (nav.openPage) nav.closePage()                                  // 选项2：只看子页，不看决策面板
        else if (nav.tab !== 'business') nav.setTab('business')
      } catch (e) {}
      try { window.history.pushState({ app: 1 }, '') } catch (e) {}
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const [doneDecisions, setDoneDecisions] = useState(saved.doneDecisions || {}) // 已完成的决策
  // §22.3-C3：操作者记录（每条含 操作者/职位/决策/时间）—— 供教师端按人查（C4）与职位归属（C2）
  const [operatorLogs, setOperatorLogs] = useState(Array.isArray(saved.operatorLogs) ? saved.operatorLogs : [])
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
      if (!ok) { toast('改名失败，请重试'); return }
    }
    setUser(prev => ({ ...prev, name }))
    toast(`已改名为「${name}」，教师端同步更新`)
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
  // 资金唯一权威（settle 返回后写回）。
  // 🔴 批次 B1（D25）：换算口径【统一收敛到 src/stateMigration.mjs】—— loadState() 已把旧档迁到新量级，
  //    故这里不再重复 ×m（原先 App 侧内联的"502万 + Σ利润×m"已删除，避免两处口径打架）。
  //    兜底：极旧的档若连 capital 都没有（迁移也会给出），仍回退到新起始资金。
  const [capital, setCapital] = useState(
    typeof saved.capital === 'number' ? saved.capital : SCALE.IC_NEW
  )
  // 经营模式：认领页选择（direct 自主直营 / ota 平台合作）。旧档缺省 direct —— 与当前引擎默认一致，老班成绩零变化
  const [bizMode, setBizMode] = useState(saved.bizMode === 'ota' ? 'ota' : 'direct')
  const [restoring, setRestoring] = useState(true) // 正在恢复云端会话
  const [classWeek, setClassWeek] = useState(0) // 老师设定的全班统一周（0=不限）
  // 🔴 E2：自动周报相关状态（全部进存档）
  //   openDayNo    = 首次进入经营时的【教学日历日序号】—— 用来把本地日期换算成 classDay（T9：客户端只做本地等效显示，不判定归属）
  //   decisionChanges = 本周决策改动流水（第几天改了什么）⇒ 周报「本周变更记录」
  //   autoSettled  = 已自动成报的幂等键（同一天/同一周不重复成报）
  const [openDayNo, setOpenDayNo] = useState(Number.isFinite(saved.openDayNo) ? saved.openDayNo : null)
  const [decisionChanges, setDecisionChanges] = useState(Array.isArray(saved.decisionChanges) ? saved.decisionChanges : [])
  const [autoSettled, setAutoSettled] = useState(Array.isArray(saved.__autoSettled) ? saved.__autoSettled : [])
  // ★ §32-U1 R2/R3：上热门舆情危机状态（随存档走 · 引擎结算回传 hotReviewCrisis ⇒ 下周作为 hotState 输入；
  //   R3 老师裁量写 override：null=默认照罚 / '维持处罚' / '降级为期末扣分'）
  const [hotCrisis, setHotCrisis] = useState(saved.hotReviewCrisis || null)
  // ★ §32-U4c-R6 原则③：上周决策的【延迟后果】（条件挂载：无 ⇒ null ⇒ 不落存档键 ⇒ 零变化水位线不破）
  const [pendingPenalty, setPendingPenalty] = useState(saved.pendingPenalty || null)
  // 🔴 E2：周报出现后是否展开（允许「稍后再看」⇒ 学生可以先接着做决策，不被周报页锁住）
  const [reportOpen, setReportOpen] = useState(true)

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
  // 🔴 批次 B1 修复：必须带 scaleVersion —— 否则写出去的档【没有版本标记】，
  //   下次读档会被 migrateSave 当成旧档【再迁移一次】（实测：5,020,000 → 约 5,044 万，涨 10 倍）。
  //   这个缺陷是本批自己引入的，被批末全门禁的 verify-capital 抓到（结算后资金 50,507,418）。
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(withScaleVersion({ user, location, brand, property, established, estChoices, doneDecisions, operatorLogs, report, week, history, finished, welcomed, attrs, capital, bizMode, openDayNo, decisionChanges, __autoSettled: autoSettled, hotReviewCrisis: hotCrisis, ...(pendingPenalty ? { pendingPenalty } : {}) })))
    } catch (e) {}
  }, [user, location, brand, property, established, doneDecisions, report, week, history, finished, welcomed, attrs, capital, bizMode, hotCrisis, pendingPenalty])

  // 属性飘字自动清除（2s，与飘字动画 1.4s 匹配）
  useEffect(() => {
    if (!attrFlash) return
    const t = setTimeout(() => setAttrFlash(null), 2000)
    return () => clearTimeout(t)
  }, [attrFlash])

  // 云端同步：真实登录时防抖 800ms 上传经营状态（教师端可见）；失败 3s 后自动重试 1 次，仍失败则提示
  // 🔴 批次 B1.5：云端上传 payload 也必须盖版本戳（原先直接漏掉了 scaleVersion）
  // 🔴 §16.2-B7（2026-09-28）：payload 还要带【本周周内输入】——
  //   服务端补算只有存档、看不到 localStorage（评价流水 / 危机选择都不在存档里），
  //   原来这 5 个输入一个都传不上去 ⇒ 含实时评价的周"补算 === 在线"不成立。
  //   这里连同周号一起上传；服务端只在 week 匹配时采用（见 src/weekInputs.mjs 的 weekInputsOf）。
  const cloudState = withScaleVersion({ location, brand, property, established, estChoices, doneDecisions, operatorLogs, report, week, history, finished, welcomed, attrs, capital, bizMode, openDayNo, decisionChanges, __autoSettled: autoSettled, hotReviewCrisis: hotCrisis, ...(pendingPenalty ? { pendingPenalty } : {}), weekInputs: (() => {
    try {
      const rv = JSON.parse(localStorage.getItem('hotel-sim-reviews') || '[]')
      const cr = JSON.parse(localStorage.getItem('hotel-sim-crisis-response') || 'null')
      return settleInputsFrom({ reviews: rv, week, crisis: cr, eventResponse: 读事件应对() })   // ★ §32-U8-补：注入应对随存档上传（服务端补算同源）
    } catch (e) { return null }
  })(), weekBase: (() => {
    // ★ §21.1-A-1（D61）：本周【改动前】的决策集，随存档上传。
    //   背景：`weeklyAuto.decisionsByDayFrom` 的契约是"**由调用方给 base**（反推会猜）"，
    //   但两端当时**都在反推**（把 decisionChanges 的 from 回退）⇒ 函数与调用方自相矛盾，
    //   且服务端可能拿到不完整的变更记录 ⇒ 两端 decisionsByDay 可能不同 ⇒ "补算 === 在线"破（与 B7 同类）。
    //   现在：**客户端给出 base（它拥有权威变更记录）并上传**；服务端直接读（并把反推留作交叉核对）。
    try {
      const b = { ...(doneDecisions || {}) }
      ;(Array.isArray(decisionChanges) ? decisionChanges : []).forEach(c => { if (c && c.key && c.from !== undefined) b[c.key] = c.from })
      return { 版本: 1, week: Number(week) || 1, decisions: b }
    } catch (e) { return null }
  })() })
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
    { key: 'business', icon: 'nav.business', label: '经营' },
    { key: 'report', icon: 'nav.report', label: '报表' },
    { key: 'reputation', icon: 'nav.review', label: '口碑', badge: true },
    { key: 'profile', icon: 'nav.me', label: '我的' },
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
        const cloudRaw = await fetchGameState(userInfo.uid, groupKeyOf(userInfo.className, userInfo.groupNo))
        // 🔴 批次 B1.5（读取侧）：云端档必须过 restoreFromCloud ——
        //   它负责（a）旧云档按 D25 迁移（b）已是 v2 则原样返回（幂等）。
        //   背景：B1 只补了本机路径，抽查发现【云端三处全漏】——旧云档恢复后会与本机新档混口径。
        const { state: cloudSaved, migrated: cloudMigrated } = restoreFromCloud(cloudRaw)
        if (cloudMigrated) {
          // 🔴 批次 B1.5（回写侧）：迁移后【立刻】把 v2 落本机，避免"恢复后又被再迁一次"的窗口；
          //   随后云端上传 effect 会带着同一个 v2 标记回写云端（两处都不留旧档）
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(withScaleVersion(cloudSaved))) } catch (e) {}
          try { console.log('[云端存档迁移]', '已按 D25 迁到新量级并回写本机 v2') } catch (e) {}
        }
        if (cloudSaved) {
          setLocation(cloudSaved.location || null)
          setBrand(cloudSaved.brand || null)
          setProperty(cloudSaved.property || null)
          setEstablished(!!cloudSaved.established)
          setEstChoices(cloudSaved.estChoices || null)
          setDoneDecisions(cloudSaved.doneDecisions || {})
          if (typeof cloudSaved.capital === 'number') setCapital(cloudSaved.capital)
          if (cloudSaved.bizMode) setBizMode(cloudSaved.bizMode === 'ota' ? 'ota' : 'direct')
        setOperatorLogs(Array.isArray(cloudSaved.operatorLogs) ? cloudSaved.operatorLogs : [])
          setReport(cloudSaved.report || null)
          setWeek(cloudSaved.week || 1)
          setHistory(cloudSaved.history || [])
          setFinished(!!cloudSaved.finished)
          setWelcomed(!!cloudSaved.welcomed)
          setAttrs(normalizeAttrs(cloudSaved.attrs)) // 旧云档无 attrs → 回退初值
          // 欢迎回来提示（老档才提示）
          if (cloudSaved.location) toast(`欢迎回来，第 ${cloudSaved.week || 1} 周经营中`)
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
    // ★ §32-U8-补 §2①：结算前【拉一次最新注入通道】—— 学生"结算用的注入"必须是最新的
    //   （否则老师刚注入、学生立刻结算 ⇒ 用 React 状态里的旧列表 ⇒ 事件被漏）。拉到 ⇒ 回写状态 + 作为本次结算入参。
    if (user?.cloud) {
      const 用最新 = (cs) => {
        const inj = Array.isArray(cs?.injected_events) ? cs.injected_events : null
        if (cs) { setClassInj(Array.isArray(cs.injected_events) ? cs.injected_events : []); setClassSupAuth(cs.supervisor_auth || null) }
        fetchClassWeek().then(classWeek => {
          if (classWeek > 0 && week > classWeek) {
            window.alert(`⏱️ 老师已把全班进度控制在第 ${classWeek} 周，第 ${week} 周还没开课。等老师推进后再来结算。`)
          } else {
            doSettle({}, inj ? { injectedEvents: inj, supervisorAuth: cs.supervisor_auth || null } : null)
          }
        }).catch(() => doSettle({}, inj ? { injectedEvents: inj, supervisorAuth: cs.supervisor_auth || null } : null))
      }
      fetchClassState().then(用最新).catch(() => 用最新(null))
    } else {
      doSettle()
    }
  }
  // ★★ §32-U8-补 §2①③：全班课堂通道（老师注入事件 + 领班全班默认授权）—— 只在云登录时拉取
  //   · 与「只影响未来」的关系：注入按 week 挂（结算时 week 匹配才生效）⇒ 这里的刷新只决定"学生何时看见"，
  //     不改变任何已结算数字（引擎侧 week 匹配是硬闸）。
  //   · 刷新点：① 挂载/登录恢复 ② visibility → visible（学生切回 App 时拿到老师刚注入的事件）
  //     （结算前另有一次性刷新，见 handleSettle —— 保证"结算用的注入"是最新的）
  //   · 离线演示（user.cloud=false）⇒ 不拉、不渲染、零变化。
  const [classInj, setClassInj] = useState([])
  const [classSupAuth, setClassSupAuth] = useState(null)
  useEffect(() => {
    if (!user?.cloud) return
    let 活 = true
    const 拉 = () => fetchClassState().then(cs => {
      if (!活) return
      setClassInj(Array.isArray(cs.injected_events) ? cs.injected_events : [])
      setClassSupAuth(cs.supervisor_auth || null)
    }).catch(() => {})
    拉()
    const onVis = () => { if (!document.hidden) 拉() }
    document.addEventListener('visibilitychange', onVis)
    return () => { 活 = false; document.removeEventListener('visibilitychange', onVis) }
  }, [user?.cloud])
  const 本组键 = groupKeyOf(user?.className, user?.groupNo)
  // 本周生效的注入（week 匹配 + 目标匹配：targets=null ⇒ 全班；否则要含本组键）
  const 本周注入 = (Array.isArray(classInj) ? classInj : []).filter(e => e && Number(e.week) === Number(week) && (!Array.isArray(e.targets) || e.targets.includes(本组键)))
  // 🔴 E2：本地等效 classDay（T9：服务端 classDay 才是唯一权威；本地只用【教学日历日序号】做等效显示与触发）
  //   旧档无 openDayNo ⇒ 用"已结算周数"反推（history.length*7），保证不跳变、不 NaN
  //   ★ §32-U8-补：整块上移到 weekPreview 之前（补算判定与周预览都要用 权威日 —— 防 TDZ）
  const classDayLocal = (() => {
    const today = teachingDayNo()
    const first = Number.isFinite(openDayNo) ? openDayNo : (today - (Array.isArray(history) ? history.length : 0) * 7)
    return classDayFromLocal(first, today)
  })()
  // ★★ §26.7（P0e②③ · 2026-09-29 · 用户第四次投诉「哪怕手机不打开数据也在跑？时间日期也是错的」）：
  //   T9 明文写着「**服务端 classDay 才是唯一权威；本地只做等效显示**」，但客户端从头到尾**没取过**它
  //   ⇒ 权威缺席 ⇒ 全班看到的日子由各自手机决定（老师推的周与学生看到的天必然错位）。
  //   现在：① 取服务端值（`class_day_now`）；② 取到 ⇒ **一律用服务端值**；
  //   ③ 取不到（`<= 0` = RPC 不可用/未部署）⇒ 用本地推算，但**必须显式标「离线 · 本地推算」**
  //      （**不许静默退化** —— 静默退化正是"日期随机"的根因）。
  const [serverClassDay, setServerClassDay] = useState(null)
  useEffect(() => {
    let 活 = true
    fetchClassDay().then(d => { if (活 && Number(d) > 0) setServerClassDay(Number(d)) }).catch(() => {})
    return () => { 活 = false }
  }, [])
  const 权威日 = Number.isFinite(serverClassDay) && serverClassDay > 0 ? serverClassDay : classDayLocal
  const 日来源 = Number.isFinite(serverClassDay) && serverClassDay > 0 ? 'server' : 'local'
  // ★ §32-U8-补 §2③：补算判定（离线默认最差标注的闸）—— 被结算周 < 当前教学周 ⇒ 该周是"补算"
  const 补算 = (() => { try { return Number(week) < Number(dayToWeekDay(权威日).week) } catch (e) { return false } })()
  // ★★ §26.3（P0b · 2026-09-29 · 用户投诉「面板是第二本账 · 数据之间没有联动」）：
  //   面板"今日流水/本周累计"必须与周报/结算**同源** ⇒ 这里按【与 doSettle 完全相同的入参派生】跑一次
  //   **预览结算**（**无副作用**：不写 localStorage、不推 history、不写回 capital、不清危机应答）。
  //   面板读它的 `dailySnapshots[本周第几天]`；Σ7天 === 周值 由引擎恒等式保证（`semesterRun12` 已钉 210 条）。
  //   ★ 与 doSettle 的一致性由「同一套派生函数」保证：settleInputsFrom / decisionsByDayFrom / settleWeekSegmented
  //     （不是复制公式）—— 若哪天 doSettle 换了入参派生点，本处必须同步，否则会退化成"两套口径"。
  const weekPreview = useMemo(() => {
    try {
      if (!established || !brand) return null
      const site = { ...(location?.attrs || { 客流: 3 }), district: location?.district }
      let reviews = []
      try { reviews = JSON.parse(localStorage.getItem('hotel-sim-reviews') || '[]') } catch (e) { reviews = [] }
      let crisis = null
      try { crisis = JSON.parse(localStorage.getItem('hotel-sim-crisis-response') || 'null') } catch (e) { crisis = null }
      const 输入 = settleInputsFrom({ reviews, week, crisis, eventResponse: 读事件应对(), decisions: doneDecisions })   // ★ §27.3-②a：把 emergency 处置一并传入（唯一派生点）
      const 变更前决策 = (() => { const b = { ...doneDecisions }; (Array.isArray(decisionChanges) ? decisionChanges : []).forEach(c => { if (c && c.key && c.from !== undefined) b[c.key] = c.from }); return b })()
      const decisionsByDay = decisionsByDayFrom({ base: 变更前决策, changes: decisionChanges, week })
      const prevGoodRate = history.length ? history[history.length - 1].finalGoodRate : null
      return settleWeekSegmented({
        site, brand, decisions: doneDecisions, decisionsByDay, week,
        pendingNegatives: 输入.pendingNegatives, resolvedCount: 输入.resolvedCount,
        liveNegCount: 输入.liveNegCount, livePosCount: 输入.livePosCount, crisisResponse: 输入.crisisResponse,
        // ★ §32-U8-补：注入事件 + 应对 + 补算 —— 与 doSettle【同一批入参】（面板与结算同源，§26.3 纪律）
        injectedEvents: 本周注入, eventResponses: 输入.注入应对, 补算,
        prevGoodRate, attrs, prevCapital: capital, bizMode, hotState: hotCrisis, penaltyState: pendingPenalty,
      })
    } catch (e) { return null }   // 预览失败 ⇒ 面板显示"待结算"，绝不自造数字
  }, [established, brand, location?.district, location?.attrs, doneDecisions, decisionChanges, week, attrs, capital, bizMode, history.length, classInj, 补算])

  // 🔴 E2：自动/手动【同一条路径】—— 自动成报就是调用本函数（参数只多一个 meta），
  //   所以「自动成报 === 手动结算」是结构保证，不是靠两处实现碰巧一致。
  // ★ §32-U8-补 §2①：meta2 = 结算前刚拉到的新鲜通道数据（{ injectedEvents, supervisorAuth }）
  //   —— 只在 handleSettle 的一次性刷新路径传；缺省 ⇒ 用 React 状态（自动成报路径）。
  function doSettle(meta = {}, meta2 = null) {
    // 本周生效注入（优先用刚拉到的新鲜值 —— 避免"老师注入后学生立刻结算"漏事件的窗口）
    const 注入源 = (meta2 && Array.isArray(meta2.injectedEvents)) ? meta2.injectedEvents : classInj
    const 本周注入用 = (Array.isArray(注入源) ? 注入源 : []).filter(e => e && Number(e.week) === Number(week) && (!Array.isArray(e.targets) || e.targets.includes(本组键)))
    const 领班全班默认用 = (meta2 && 'supervisorAuth' in meta2) ? (meta2.supervisorAuth || null) : classSupAuth
    // 🔴 选址数据任务（2026-09-27 · 重大修复）：原写法只传 `location.attrs` ⇒ 引擎拿不到 district，
    //   于是 `COMPETITORS[site.district]` 与 `CUSTOMER_PERSONAS[site.district]` 永远命中空键 ——
    //   **竞品机制（周报「周边竞品动态」卡 + 竞品压力压出租率）与客群匹配从未生效**（121 家竞品数据白接）。
    //   现在把 district 一起传进引擎（引擎侧已做入口归一化，服务端同一形状）。
    const site = { ...(location?.attrs || { 客流: 3 }), district: location?.district }
    // 口碑页数据读一次，供本函数全程使用。
    // 🔴 历史 bug：原先 reviews 声明在下方第一个 try 内部，而"结算卡片入库"那段在另一个 try 里引用它
    //    → ReferenceError 被自己的 catch(e){} 吞掉 → **结算生成的评价卡片从未写进口碑页**（潜伏已久，
    //    2026-09-22 因 bizMode 激活后出现真差评、断言才暴露）。作用域提到函数顶层，杜绝复发。
    let reviews = []
    try { reviews = JSON.parse(localStorage.getItem('hotel-sim-reviews') || '[]') } catch (e) { reviews = [] }
    // 危机应对：上周选、本周结算时用
    let crisis = null
    try { crisis = JSON.parse(localStorage.getItem('hotel-sim-crisis-response') || 'null') } catch (e) { crisis = null }
    // ★ §16.2-B7：周内输入改为走【单一派生点】src/weekInputs.mjs ——
    //   原来这 5 个量的口径写在本函数里，服务端补算却一个都拿不到 ⇒ 含实时评价的周两边对不上。
    //   现在客户端与服务端共用同一个函数（口径单源），且这份派生结果会随存档上传（见 cloudState.weekInputs）。
    const 输入 = settleInputsFrom({ reviews, week, crisis, eventResponse: 读事件应对(), decisions: doneDecisions })   // ★ §27.3-②a：把 emergency 处置一并传入（唯一派生点）
    const { pendingNegatives, resolvedCount, liveNegCount, livePosCount, crisisResponse } = 输入
    const prevGoodRate = history.length ? history[history.length - 1].finalGoodRate : null
    // ★★ §33-V3（2026-10-02 · AI 领班二期）：代管动作**真正生效** —— 领班产出 = 一组「代管决策」，
    //   结算时**并入本周决策集**。三铁律（卡内 §1①/§2）：
    //   ① **学生决策 > 领班**：代管只填【学生没做】的项（学生做了就轮不到领班 —— 优先级写死 + 守门断言）。
    //      落地形态：`代管决策 = { overbook: 0, energy: 23 }` 里凡 doneDecisions 已有的键 ⇒ 剔除。
    //   ② **确定性**：领班快照 = 【上周结算结果】派生（history[末位] · 与在线/补算同源 · 不看随机不看设备）。
    //   ③ **默认全关**：生效授权无 overbook/energy ⇒ 代管决策为空 ⇒ decisions 原样 ⇒ 逐字节水位线。
    //   ★ 范围（卡内 §1③④）：只落地 **R3（超售清零 → overbook:0）** 与 **R6（能耗回归 → energy:23）**——
    //     这两条只需 decisions 快照（B3 §六「零账本改动」档）；**R1/R2 不做**（需竞对价每日序列，现无该数据模型，
    //     不许用周级快照冒充日级）——R1/R2 的 when 在快照缺 竞对均价 时天然不触发，另外显式置 null 双保险。
    //   ★ 不双扣四层（×V4/V6/R4/R6 · 卡内 §1③）见 aiSupervisor.mjs 头部「§33-V3 不双扣边界表」+ 报告 §三。
    const 上周结果 = history.length ? history[history.length - 1] : null
    let 领班代管决策 = {}
    let 领班记录 = null
    try {
      const 领班授权 = 生效授权({ 全班默认: 领班全班默认用, 学生覆盖: 读领班覆盖() })
      const 领班快照源 = 上周结果 ? {
        出租率: Number(上周结果.occupancy) || 0,
        当前价: (Number(上周结果.occupiedRooms) > 0 && Number.isFinite(Number(上周结果.revenue))) ? Math.round(Number(上周结果.revenue) / (Number(上周结果.occupiedRooms) * 7)) : null,
        竞对均价: null, 竞对降价幅度: 0, 竞对溢价: null,   // ★ R1/R2 需竞对价序列 ⇒ 二期不做 ⇒ 置 null ⇒ 规则不触发（不冒充日级）
        本周超售赔偿次数: (Number(上周结果.overbookCompensation) > 0 && Number(上周结果.price) > 0) ? Math.round(Number(上周结果.overbookCompensation) / Math.round(Number(上周结果.price))) : 0,
        卫生不合格: (doneDecisions || {}).hygiene === '不停房',
        // ★ §33-V3：R6 能耗回归 —— 室温 = 学生当前决策（缺省视为 23 舒适区 ⇒ 不触发）
        室温: (doneDecisions || {}).energy != null ? Number((doneDecisions || {}).energy) : 23,
      } : null
      if (领班快照源) {
        const rec = 领班决策({ state: 领班快照源, authorizations: 领班授权 })
        // 学生优先：只保留【学生没做】的项
        const 学生没做的 = {}
        for (const a of rec.actions) {
          const 落点 = a.item === 'overbook' ? 'overbook' : a.item === 'energy' ? 'energy' : null
          if (落点 && (doneDecisions || {})[落点] === undefined) 学生没做的[落点] = a.to
        }
        领班代管决策 = 学生没做的
        const 学生决策数 = Object.keys(doneDecisions || {}).length
        领班记录 = {
          ...rec,
          代管决策: { ...学生没做的 },
          代管率: 代管率(rec.actions.length, 学生决策数),
          授权快照: 领班授权,
          二期说明: '二期：R3/R6 代管动作真生效（并入决策集 · 学生决策优先）；R1/R2 需竞对价每日序列 ⇒ 明确不做',
        }
      }
    } catch (e) {}   // 领班层任何异常不拦结算（回到无领班行为）
    // 代管决策并入：只填空位（学生优先的落地 · Object.assign 语义天然"已有键不覆盖"）
    const 本周生效决策 = (Object.keys(领班代管决策 || {}).length > 0) ? { ...领班代管决策, ...doneDecisions } : doneDecisions
    // B5：补传 prevCapital（否则资金每周从 50 万重算、"资金链断裂/预警"永不触发）
    //     + bizMode（否则认领页选的"平台合作"在引擎侧永远走不到，帮助页承诺的 15% 佣金与流量加成失效）
    // ★ §19.1（单元 1·B4）：走【分段结算】—— 把本周变更记录变成按天生效的决策喂进引擎。
    //   周内无改动 ⇒ 段数=1 ⇒ settleWeekSegmented 内部原样走既有路径（逐字节水位线）。
    const 变更前决策 = (() => { const b = { ...doneDecisions }; (Array.isArray(decisionChanges) ? decisionChanges : []).forEach(c => { if (c && c.key && c.from !== undefined) b[c.key] = c.from }); return b })()
    const decisionsByDay = decisionsByDayFrom({ base: 变更前决策, changes: decisionChanges, week })
    // ★★ §31.9-A1-补①（2026-09-30 · D86）：结算调用的【超档兜底】—— A1 让引擎对超档组合 **throw**，
    //   而 A1 之前的**旧超档存档**（手机上可能残留的测试档）走到结算才第一次撞上校验 ⇒ 若不接住
    //   就是该组白屏/卡死。★ **不许静默吞掉**（BL-10）：给可读提示 + 一键回品牌页（唯一出路 = 换品牌）。
    //   catch 里只处理【等级限制】类错误（re /等级限制/），其它异常照常抛出（不掩盖真 bug）。
    let result
    try {
      // ★ §33-V3：decisions 用【本周生效决策】（学生决策 + 领班代管填空位）—— 未授权 ⇒ 代管空 ⇒ === doneDecisions
      result = settleWeekSegmented({ site, brand, decisions: 本周生效决策, decisionsByDay, week, pendingNegatives, prevGoodRate, crisisResponse, resolvedCount, attrs, liveNegCount, livePosCount, prevCapital: capital, bizMode, hotState: hotCrisis, penaltyState: pendingPenalty, injectedEvents: 本周注入用, eventResponses: 输入.注入应对, 补算 })
    } catch (e) {
      if (!/等级限制/.test(String(e && e.message))) throw e
      const 区 = location?.district ?? '本区域'
      const 上限 = /上限为第 (\d+) 档/.exec(String(e.message))?.[1] ?? 'N'
      const 消息 = `「${brand?.name ?? '所选品牌'}」超出「${区}」可开档次（上限第 ${上限} 档），无法结算。\n这是旧存档与新版规则冲突 —— 请返回重选符合档位的品牌（低消费区开高端酒店必亏）。`
      toast(消息)
      if (window.confirm(消息 + '\n\n【确定】现在返回品牌选择页（必需步骤）')) {
        setBrand(null); setTab('brand')
      }
      return   // 不结算 = 本周维持原状；学生已拿到明确出路
    }
    try { localStorage.removeItem('hotel-sim-crisis-response') } catch (e) {}
    // ★ §32-U8-补 §2②：本周的注入应对已进结算 ⇒ 清掉（只清本周的；别的周/未使用的不动）
    try { const r = 读事件应对(); if (r && Number(r.week) === Number(week)) localStorage.removeItem('hotel-sim-event-response') } catch (e) {}
    // 结算差评回流口碑页（保留已处理的旧评价，追加本周新评价）
    try {
      const kept = reviews.filter(r => r.week == null && !String(r.id).startsWith('w'))
      localStorage.setItem('hotel-sim-reviews', JSON.stringify([...kept, ...result.generatedReviews]))
    } catch (e) {}
    if (crisisResponse) result.crisisChoice = crisisResponse // 危机应对选择存档（学期复盘用）
    // R0 最后一公里：把引擎返回的属性（含每周自然衰减）写回 state
    // 没有这行，衰减与属性→经营只存在于引擎内部，玩家不可见、下周也用不上
    if (result.attrsAfter) setAttrs(result.attrsAfter)
    if (result.hotReviewCrisis) setHotCrisis(result.hotReviewCrisis)   // ★ R2：危机期随结果存档（下周 hotState）
    setPendingPenalty(result.pendingPenalty || null)   // ★ R6：本周决策的延迟后果 ⇒ 下周生效（无 ⇒ 清空）
    if (typeof result.capital === 'number') setCapital(result.capital)   // 资金唯一权威：引擎返回即权威
    // A4（2026-09-22）：把当周"差评处理口径"快照进周报对象（随 history 持久化/云端同步）。
    //   🔴 前置坑：口碑页 kept 过滤只留当周卡 ⇒ 期末拿不到全学期处理率，必须逐周快照。
    //   只数结算生成的卡片（id 以 w<周>- 开头），与 pendingNegatives 同一规则（确定性）。
    result.handleStats = { pending: pendingNegatives, resolved: resolvedCount }
    // 🔴 E2：周报附「本周变更记录」（第几天改了什么 + 生效日 = 提交日+1，T11）
    if (Array.isArray(decisionChanges) && decisionChanges.length) {
      result.changeLog = decisionChanges.map(c => ({ ...c, week }))
      result.changeLogLines = changeLogLines(result.changeLog)
      // 🔴 D52-a：周中调价 ⇒ 显示级分段（**必须标"估算"**；引擎周值不动 —— 零变化）
      const seg = revenueSegments(result, result.changeLog, history[history.length - 1] || null)
      if (seg) result.revenueSegments = seg
    }
    if (meta.auto) {
      // 自动成报：记幂等键（同一天/同一周不重复成报）
      result.__auto = true
      if (meta.key) setAutoSettled(prev => (prev.includes(meta.key) ? prev : [...prev, meta.key]))
    }
    // ★ §32-U8-补 §2④ + §33-V3：AI 领班（**二期 = 代管动作真生效** —— 见上方 V3 注释块）
    //   · 本周实际生效的代管 = 领班记录.代管决策（结算前已并入 本周生效决策）⇒ 这里只补【记录与留痕】
    //   · 结果快照（领班状态快照(result)）继续挂 supervisorRecord —— 供【下周】领班决策用（随 history 持久化）
    //   · 引擎边界不变：settle【不引用】aiSupervisor（thirdPhase 守门）—— 代管并发生在 App 层
    try {
      if (领班记录) {
        result.supervisorRecord = { ...领班记录, 结果快照: 领班状态快照(result) }
        // operatorLog 留痕：**只记真正生效的代管动作**（领班记录.代管决策 · 学生优先过滤后）
        const 落点规则 = { overbook: 'R3', energy: 'R6' }
        const 新日志 = []
        for (const [项, to] of Object.entries(领班记录.代管决策 || {})) {
          const 规则 = 落点规则[项] || ''
          const 条 = 记录一条({ decisionId: 项, answer: to, operatorName: 'AI 领班', week, classDay: 权威日, profitImpact: null })
          const 依据 = (领班记录.actions || []).find(a => a.item === 项)
          if (条) 新日志.push({ ...条, 依据规则: 依据 ? 依据.ruleId : 规则, 领班reason: 依据 ? 依据.reason : '', 生效周: week })
        }
        for (const r of (领班记录.reports || [])) {
          const d = r.ruleId === 'R7' ? 'hygiene' : null
          const 条 = d ? 记录一条({ decisionId: d, answer: null, operatorName: 'AI 领班', week, classDay: 权威日, profitImpact: null }) : null
          if (条) 新日志.push({ ...条, 依据规则: r.ruleId, 领班reason: r.reason })
        }
        if (新日志.length) setOperatorLogs(prev => [...prev, ...新日志])
      } else {
        // 未授权/无快照 ⇒ 也挂一个"本周领班未动作"记录（学生复盘卡能看到状态 · 条件字段）
        result.supervisorRecord = { actions: [], reports: [], 代管决策: {}, 代管率: 代管率(0, Object.keys(doneDecisions || {}).length), 本周未动作: true }
      }
    } catch (e) {}   // 领班记录失败不拦结算（绝不因记录层把结算弄崩）
    setReport(result)
  }
  // ★ §32-U8-补 §2④：领班决策的【状态快照】—— 从本周结算结果派生（不新算一套账）。
  //   本期字段 → aiSupervisor 的 state 形状；缺字段 ⇒ 对应规则不触发（宁可不建议，不许编数）。
  function 领班状态快照(r) {
    if (!r || typeof r !== 'object') return null
    const comps = Array.isArray(r.competitors) ? r.competitors : []
    const 均价s = comps.map(c => Number(c && c.price)).filter(n => Number.isFinite(n) && n > 0)
    const 竞对均价 = 均价s.length ? Math.round(均价s.reduce((a, b) => a + b, 0) / 均价s.length) : null
    const 降价 = comps.filter(c => c && (c.action === '降价' || c.action === '促销') && Number(c.basePrice) > 0 && Number(c.price) > 0)
    const 竞对降价幅度 = 降价.length ? Math.max(...降价.map(c => Math.round((Number(c.basePrice) - Number(c.price)) / Number(c.basePrice) * 100))) : 0
    // 实收均价 = 周客房收入 ÷ 售出间夜（与周报「平均房价（实收）」同口径 · WeeklyReport 同式）
    const 实收均价 = (Number(r.occupiedRooms) > 0 && Number.isFinite(Number(r.revenue))) ? Math.round(Number(r.revenue) / (Number(r.occupiedRooms) * 7)) : null
    const 竞对溢价 = (实收均价 && 竞对均价) ? Math.round((实收均价 - 竞对均价) / 竞对均价 * 100) : null
    // 超售赔偿次数 = 赔偿额 ÷ round(定价) —— 与引擎同一乘积关系（overbookCompensation = walkIn × round(price)）的精确反算
    const 次数 = (Number(r.overbookCompensation) > 0 && Number(r.price) > 0) ? Math.round(Number(r.overbookCompensation) / Math.round(Number(r.price))) : 0
    return {
      出租率: Number(r.occupancy) || 0,
      当前价: 实收均价,
      竞对均价, 竞对降价幅度,
      竞对溢价: Number.isFinite(竞对溢价) ? 竞对溢价 : null,
      本周超售赔偿次数: 次数,
      卫生不合格: (doneDecisions || {}).hygiene === '不停房',
      // 学生价格下限：一期未建模 ⇒ 不传（aiSupervisor 内回退为 当前价×0.85；传 null 会被 Number(null)=0 误读，已修）
    }
  }
  // ★ §32-U8-补：classDayLocal / serverClassDay / 权威日 —— 已上移到 weekPreview 之前
  //   （理由：注入事件的「补算」判定与周预览都要用 权威日 ⇒ 必须先声明，避免 TDZ）
  const autoInfo = !established || !brand || finished
    ? { due: false, reason: '未进入经营' }
    : shouldAutoSettle({ brand, history, __autoSettled: autoSettled, __groupKey: groupKeyOf(user?.className, user?.groupNo) }, 权威日, { groupKey: groupKeyOf(user?.className, user?.groupNo) })

  // 🔴 E2：决策改动 → 本周流水（第几天改了什么）。只记【改动】，不记首次填写（首次填写不算"改"）
  const prevDecisionsRef = React.useRef(null)
  React.useEffect(() => {
    if (!established || !brand) return
    const day = dayToWeekDay(权威日).dayIndex
    const prev = prevDecisionsRef.current
    if (prev == null) { prevDecisionsRef.current = doneDecisions; return }
    const rows = diffDecisions(prev, doneDecisions, { day })
    prevDecisionsRef.current = doneDecisions
    if (rows.length) setDecisionChanges(list => [...list, ...rows])
  }, [doneDecisions, established, brand, 权威日])

  // 🔴 E2 自动成报：7 个游戏日满 ⇒ 自动出周报（学生不用点任何按钮）
  React.useEffect(() => {
    if (!autoInfo.due) return
    if (report) return
    doSettle({ auto: true, key: autoInfo.key })
  }, [autoInfo.due, autoInfo.key, report])

  // 首次进入经营页时记下"开学教学日序号"（自动周报的本地基准；只写一次）
  React.useEffect(() => {
    if (established && brand && !Number.isFinite(openDayNo)) setOpenDayNo(teachingDayNo())
  }, [established, brand, openDayNo])

  // 结算确认后：进入下一周，清空决策，保存历史
  function handleNextWeek() {
    const newHistory = [...history, report]
    setHistory(newHistory)
    setDecisionChanges([])          // E2：本周流水已进周报 ⇒ 清空，下周重新记
    prevDecisionsRef.current = {}   // 新一周：首次填写不算"改动"
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
    if (result.property) setProperty(result.property)          // 完成认领（第二步）
    if (result.mode) setBizMode(result.mode === 'ota' ? 'ota' : 'direct')  // 认领第一步选的经营模式（此前被丢弃 → B5 根因）
    setEstablished(false)
  }
  function handleEstablished(choices) {
    const c = choices || { invest: null, supplier: null, opening: [], investTiers: {} }
    // 筹建期"物资采购"是一次性选择（非周决策）：品质养成从这里起步，只应用一次
    // 用 estChoices 是否已有渠道做幂等保护（重进筹建流程不会重复加分）
    setAttrs(prev => (estChoices?.supplier ? prev : applyDecisionToAttrs(prev, 'est-supplier', c.supplier)))
    // 🔴 §16.2-B5（2026-09-28）：投资项档位 → 品质联动（一次性，与 est-supplier 同样的幂等保护）。
    //   品质分由 `投资测算()` 现算（系数单源在 establishmentInvest.mjs）⇒ 本处只传数值。
    //   ★ 投资规模（总投资）不进资金流：那是**投资侧**展示口径（与 capex 同族，D53-c 未接 E1 账本），
    //     本批不做"扣钱"（B2/B3 才是动钱的项）。
    if (!estChoices?.investTiers) {
      const 品质分 = 投资测算({ brand, 选择: c.investTiers }).品质分
      if (品质分) setAttrs(prev => applyDecisionToAttrs(prev, 'est-invest', 品质分))
    }
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
          <span className="icons" />
        </div>
        {restoring ? (
          <div className="content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{ fontSize: 44 }}><Icon name="prop.hotel" size={44} /></div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>正在恢复登录状态…</div>
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
      <div className="app" data-role="teacher">
        <div className="statusbar">
          <span className="time">{time || '09:41'}</span>
          <span className="icons" />
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
          <span className="icons" />
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
          <span className="icons" />
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
          <span className="icons" />
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
          <span className="icons" />
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
          <span className="icons" />
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
          <span className="icons" />
        </div>
        <SuspenseR fallback={<div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>加载中…</div>}><FinalResult history={history} user={user} brand={brand} attrs={attrs} onRestart={() => { setFinished(false); setWeek(1); setHistory([]); setDoneDecisions({}); setAttrs({ ...ATTR_INIT }); try { localStorage.removeItem('hotel-sim-reviews') } catch (e) {} }} /></SuspenseR>
      </div>
    )
  }

  // 如果有周报，显示周报
  if (report && reportOpen) {
    return (
      <div className="app">
        <div className="statusbar">
          <span className="time">{time || '09:41'}</span>
          <span className="icons" />
        </div>
        <WeeklyReport result={report} onClose={handleNextWeek} onLater={() => setReportOpen(false)} history={history} brand={brand} attrs={attrs} />
      </div>
    )
  }

  // 如果正在做决策，显示决策面板
  if (currentDecision) {
    return (
      <div className="app">
        <div className="statusbar">
          <span className="time">{time || '09:41'}</span>
          <span className="icons" />
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
            // ★ §22.3-C3：操作者记录落存档（每条含 操作者/职位/决策/时间）——
            //   教师端"按人查"（C4）与职位归属（C2）都从这里聚合（operatorLog 单源）。
            //   旧档/未登录 ⇒ operatorId 缺省 ⇒ 如实标"未记录"（operatorLog 内置兜底，不崩）。
            setOperatorLogs(prev => {
              const rec = 记录一条({
                decisionId: id, answer,
                operatorId: user?.uid || null, operatorName: user?.name || null,
                week, classDay: (typeof 权威日 === 'number' || typeof 权威日 === 'object') ? (权威日?.valueOf?.() ?? null) : (权威日 ?? null),
                profitImpact: null,
              })
              return rec ? [...(prev || []), rec] : (prev || [])
            })
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
      business: <Business user={user} toast={toast} onOpen={open} location={location} brand={brand} property={property} onDecision={setCurrentDecision} doneDecisions={doneDecisions} onSettle={handleSettle} report={report} week={week} history={history} pendingReviewCount={pendingReviewCount} attrs={attrs} attrFlash={attrFlash} capital={capital} onGoReport={() => setReportOpen(true)} classDayIndex={dayToWeekDay(权威日).dayIndex} dayFlows={weekPreview?.dailySnapshots} daySource={日来源} 本周注入={本周注入} onGoTab={(t2) => { setTab(t2); close() }} onGoRecords={() => { setOpenPage({ title: '经营操作记录', icon: 'log.ops', key: 'records' }) }} />,
      report: <Report report={report} week={week} history={history} />,
      reputation: <SuspenseR fallback={<div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>加载中…</div>}><Reputation report={report} history={history} week={week} attrs={attrs} decisions={doneDecisions} groupRole={user?.groupRole || null} /></SuspenseR>,   // ★ §32-U4-R4：带上职务
      profile: <Profile onOpen={open} user={user} location={location} brand={brand} property={property} onLogout={handleLogout} doneDecisions={doneDecisions} week={week} history={history} report={report} onRename={handleRename} attrs={attrs} />,
    }
    mainPage = pages[tab]
  }

  return (
    <div className="app">
      <div className="statusbar">
        <span className="time">{time || '09:41'}</span>
        <span className="icons" />
      </div>
      <AppErrorBoundary onReset={() => { setOpenPage(null); setCurrentDecision(null); setTab('business') }}>
        {/* 切页动画包装层：必须是可收缩的 flex 容器，否则会被内容撑高、把 .tabbar 顶出视口（9-19 回归） */}
        <div key={(tab || '') + '|' + (openPage ? openPage.key : '')} style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', animation: 'pageIn 0.25s cubic-bezier(0.22,1,0.36,1)' }}>{mainPage}</div>
      </AppErrorBoundary>
      {/* 断网横幅 */}
      {offline && (
        <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top) + 52px)', left: '50%', transform: 'translateX(-50%)', zIndex: 250, background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)', fontSize: 11, fontWeight: 600, padding: '6px 14px', borderRadius: 999, whiteSpace: 'nowrap' }}>
          网络异常，进度已保存在本机
        </div>
      )}
      {/* 轻提示栈（顶部滑入） */}
      <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top) + 10px)', left: '50%', transform: 'translateX(-50%)', zIndex: 300, width: 'max-content', maxWidth: '88%' }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background: 'rgba(17,24,39,0.92)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '9px 16px', borderRadius: 999, marginBottom: 6, animation: 'pageIn 0.25s cubic-bezier(0.22,1,0.36,1)', textAlign: 'center' }}>
            {t.msg}
          </div>
        ))}
      </div>
      {/* P1-补：左边缘手势拦截层（仅弹层/决策面板打开时渲染） */}
      {anyLayerOpen && <div ref={edgeGuardRef} className="edge-guard" aria-hidden="true" />}

      <div className="tabbar">
        {tabs.map(t => (
          <button className={`tab ${tab === t.key && !openPage ? 'active' : ''}`} key={t.key} onClick={() => { setTab(t.key); close() }}>
            <div className="tab-icon"><Icon name={t.icon} size={20} /></div>
            <div className="tab-label">{t.label}</div>
            {t.key === 'reputation' && pendingReviewCount > 0 && <div className="badge-num">{pendingReviewCount}</div>}
          </button>
        ))}
      </div>
      {/* 全班进度提示：老师锁周且学生超前时显示 */}
      {classWeek > 0 && !report && !finished && week > classWeek && (
        <div onClick={() => setTab('business')} style={{ position: 'fixed', bottom: 'calc(86px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', color: 'var(--warn)', fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 999, whiteSpace: 'nowrap', zIndex: 50, maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          ⏱ 老师已推进全班到第 {classWeek} 周，你在第 {week} 周——决策可先做，结算等开课
        </div>
      )}
    </div>
  )
}
