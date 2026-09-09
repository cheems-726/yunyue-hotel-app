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
import { decisions } from './decisions.js'
import { supabase, emailFor, fetchProfile, fetchGameState, fetchGroupStates, updateOwnName, saveGameState, groupKeyOf } from './supabaseClient.js'
import { getTitle } from './hotelTitle.js'
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
function Business({ onOpen, location, brand, property, onDecision, doneDecisions, onSettle, report, week, history, pendingReviewCount }) {
  const modules = ['部门运营', '会员推广', '门店经营']
  const [settling, setSettling] = useState(false)
  const [expandedDesc, setExpandedDesc] = useState({})
  const [filter, setFilter] = useState('all') // all | undone | done | key
  const bgMap = { '部门运营': 'amber', '会员推广': 'blue', '门店经营': 'green' }
  const doneCount = Object.keys(doneDecisions).length
  const occ = report ? report.occupancy : (history.length ? history[history.length - 1].occupancy : null)
  const rev = report ? (report.revenue / 10000).toFixed(2) : (history.length ? (history[history.length - 1].revenue / 10000).toFixed(2) : null)
  const neg = report ? report.negativeCount : (history.length ? history[history.length - 1].negativeCount : null)
  return (
    <div className="content">
      <div className="header">
        <div className="row1">
          <span className="hotel-name">{property ? property.name : '云悦酒店'}</span>
          <span className="day-tag">📅 第 {week} 周</span>
        </div>
        <div className="sub">{brand ? `${brand.name} · ${location?.district}` : ''} · 已决策 {doneCount}/18 · {(() => {
          const last = history.length ? history[history.length - 1] : null
          const lv = brand?.level || ''
          const q = lv.includes('经济') ? 60 : lv.includes('中高档') || lv.includes('精选') ? 85 : lv.includes('高档') ? 90 : lv.includes('奢华') ? 95 : lv.includes('中档') ? 75 : 70
          const t = getTitle(last ? last.occupancy : 0, last ? last.finalGoodRate : 85, q)
          return `${t.icon} ${t.title}`
        })()}</div>
      </div>

      {/* 酒店状态面板（RPG属性） */}
      <HotelStatus report={report} brand={brand} property={property} week={week} history={history} />

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
          const q = lv.includes('经济') ? 60 : lv.includes('中高档') || lv.includes('精选') ? 85 : lv.includes('高档') ? 90 : lv.includes('奢华') ? 95 : lv.includes('中档') ? 75 : 70
          const tNow = getTitle(last.occupancy, last.finalGoodRate, q)
          const prevH = history.length > 1 ? history[history.length - 2] : null
          const tPrev = prevH ? getTitle(prevH.occupancy, prevH.finalGoodRate, q) : null
          const promoted = tPrev && tNow.title !== tPrev.title && tNow.composite > tPrev.composite
          const demoted = tPrev && tNow.title !== tPrev.title && tNow.composite < tPrev.composite
          return (
            <div style={{ marginTop: 10, padding: '7px 12px', background: promoted ? '#ECFDF5' : demoted ? '#FEF0EF' : '#FFF4E0', borderRadius: 8, fontSize: 12, fontWeight: 600, color: promoted ? '#065F46' : demoted ? '#991B1B' : '#A96407', textAlign: 'center' }}>
              {promoted ? `🎉 恭喜晋升：${tPrev.title} → ${tNow.title}` : demoted ? `⚠ 降级：${tPrev.title} → ${tNow.title}，下周稳住` : `${tNow.icon} 当前称号：${tNow.title}`}
            </div>
          )
        })()}
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 12, padding: '12px 0', fontSize: 14, opacity: settling ? 0.5 : 1 }} disabled={settling}
          onClick={() => { setSettling(true); setTimeout(() => { setSettling(false); onSettle() }, 350) }}>
          {settling ? '⏳ 结算中…' : '🔄 本周结算（查看经营结果）'}
        </button>
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

      {/* 18项能力点，按模块分组（未决策的排前面） */}
          {modules.map(mod => (
            <div key={mod}>
              <div className="section-title">
                <span className="left">{mod}</span>
                <span className="hint">{decisions.filter(d => d.module === mod).length} 项决策</span>
              </div>
              <div className="task-list">
                {decisions.filter(d => d.module === mod)
                  .filter(d => filter === 'all' ? true : filter === 'key' ? KEY_DECISIONS.includes(d.id) : filter === 'undone' ? doneDecisions[d.id] === undefined : doneDecisions[d.id] !== undefined)
                  .map(d => ({ d, isDone: doneDecisions[d.id] !== undefined }))
                  .sort((a, b) => (a.isDone === b.isDone ? 0 : a.isDone ? 1 : -1))
                  .map(({ d, isDone }) => (
                  <div className="task-card" key={d.id} onClick={() => onDecision(d)}
                    title={isDone ? `当前答案：${fmtDecision(doneDecisions[d.id])}（点击修改）` : undefined}>
                    <div className="task-card-icon-wrap" style={{ position: 'relative', flexShrink: 0 }}>
                      <div className={`task-icon ${bgMap[mod]}`}>{d.icon}</div>
                      {(!isDone && KEY_DECISIONS.includes(d.id) || (d.id === 'reputation' && pendingReviewCount > 0)) && (
                        <span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', background: '#EF4444', border: '2px solid #fff' }} />
                      )}
                    </div>
                    <div className="task-body" onClick={e => { e.stopPropagation(); setExpandedDesc(x => ({ ...x, [d.id]: !x[d.id] })) }}>
                      <div className="name">{d.name} {isDone && '✓'}{!isDone && KEY_DECISIONS.includes(d.id) && <span style={{ fontSize: 10, color: '#EF4444', fontWeight: 600, marginLeft: 6 }}>每日关键</span>}</div>
                      <div className="desc" style={{ whiteSpace: expandedDesc[d.id] ? 'normal' : 'nowrap' }}>
                        {isDone
                          ? (expandedDesc[d.id]
                              ? `当前答案：${fmtDecision(doneDecisions[d.id])}`
                              : `当前：${String(fmtDecision(doneDecisions[d.id])).slice(0, 20)}…`)
                          : (expandedDesc[d.id] ? d.desc : d.desc.slice(0, 25) + (d.desc.length > 25 ? '…' : ''))}
                        <span style={{ color: '#E8940F', marginLeft: 4 }}>{expandedDesc[d.id] ? '收起' : (isDone ? '展开答案' : (d.desc.length > 25 ? '全文' : ''))}</span>
                      </div>
                    </div>
                    <span className={`task-badge ${isDone ? 'badge-done' : 'badge-new'}`}>{isDone ? '已决策·可改' : '去决策'}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
    </div>
  )
}

// ===== 报表页 =====
// 双折线趋势图（SVG 手绘：出租率琥珀线 + 利润蓝线，零依赖）
function TrendChart({ history }) {
  const W = 320, H = 130, PL = 26, PR = 12, PT = 12, PB = 20
  const n = history.length
  const xs = i => PL + i * (W - PL - PR) / Math.max(n - 1, 1)
  const mk = (arr) => {
    const min = Math.min(...arr), max = Math.max(...arr)
    const span = (max - min) || 1
    return arr.map((v, i) => ({ x: xs(i), y: H - PB - ((v - min) / span) * (H - PT - PB), v }))
  }
  const occ = mk(history.map(h => h.occupancy))
  const prof = mk(history.map(h => +(h.profit / 10000).toFixed(2)))
  const line = pts => pts.map(p => `${p.x},${p.y}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="#F3F4F6" strokeWidth="1" />
      {occ.map((p, i) => <line key={'g' + i} x1={p.x} y1={p.y} x2={p.x} y2={H - PB} stroke="#F3F4F6" strokeWidth="1" />)}
      <polyline points={line(occ)} fill="none" stroke="#E8940F" strokeWidth="2" strokeLinejoin="round" />
      <polyline points={line(prof)} fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinejoin="round" />
      {occ.map((p, i) => <circle key={'o' + i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="#E8940F" strokeWidth="2" />)}
      {prof.map((p, i) => <circle key={'p' + i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="#3B82F6" strokeWidth="2" />)}
      {history.map((h, i) => (
        <text key={'w' + i} x={xs(i)} y={H - 6} fontSize="9" fill="#9CA3AF" textAnchor="middle">{h.week}周</text>
      ))}
      <text x={PL} y={9} fontSize="9" fill="#E8940F">■ 出租率%</text>
      <text x={PL + 62} y={9} fontSize="9" fill="#3B82F6">■ 利润(万)</text>
    </svg>
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
function Profile({ onOpen, user, location, brand, property, onLogout, doneDecisions, week, history, report, onRename }) {
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
          const q = lv.includes('经济') ? 60 : lv.includes('中高档') || lv.includes('精选') ? 85 : lv.includes('高档') ? 90 : lv.includes('奢华') ? 95 : lv.includes('中档') ? 75 : 70
          const name = getTitle(last ? last.occupancy : 0, last ? last.finalGoodRate : 85, q).title
          return { '标杆酒店': '#FDE68A', '人气名店': '#EDE9FE', '精品酒店': '#DBEAFE', '舒适旅店': '#D1FAE5' }[name] || '#FFF4E0'
        })(),display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,transition:'background 0.5s'}}>😊</div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{fontSize:18,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}
            title="点击修改真实姓名"
            onClick={() => { const n = window.prompt('输入真实姓名（教师端将显示）', user?.name || ''); if (n && n.trim() && n.trim() !== user?.name) onRename(n.trim()) }}
          >
            {user?.name || '未命名'} <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 400 }}>✏️改名</span>
          </div>
          <div style={{fontSize:12,color:'#9CA3AF',marginTop:2}}>{orgDesc}</div>
        </div>
      </div>

      <div className="card" style={{background:'#FFF4E0',borderColor:'#FBE3B3',display:'flex',alignItems:'center',justifyContent:'space-between',padding:16}}>
        <div>
          <div style={{fontSize:13,color:'#A96407'}}>我的酒店当前排名</div>
          <div style={{fontSize:12,color:'#9CA3AF'}}>全班共 5 组</div>
        </div>
        <div style={{fontSize:34,fontWeight:700,color:'#D97706'}}>第 2 名</div>
      </div>

      {/* 我的酒店信息 */}
      <div className="card">
        <div className="card-title">🏨 我的酒店档案</div>
        <div style={{ fontSize: 13, color: '#374151', lineHeight: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#9CA3AF' }}>酒店称号</span>
            <span style={{ fontWeight: 600, color: '#A96407' }}>{(() => {
              const occ = report ? report.occupancy : (history.length ? history[history.length - 1].occupancy : 0)
              const gr = report ? report.finalGoodRate : (history.length ? history[history.length - 1].finalGoodRate : 85)
              const lv = brand?.level || ''
              const q = lv.includes('经济') ? 60 : lv.includes('中高档') || lv.includes('精选') ? 85 : lv.includes('高档') ? 90 : lv.includes('奢华') ? 95 : lv.includes('中档') ? 75 : 70
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
          <div key={m.name} onClick={() => onOpen(m.name, m.icon, m.key)} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 20px',borderBottom:'1px solid #F9FAFB',cursor:'pointer'}}>
            <div style={{width:40,height:40,borderRadius:'50%',background:m.bg==='amber'?'#FFF4E0':m.bg==='blue'?'#EFF6FF':'#ECFDF5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{m.icon}</div>
            <div style={{flex:1,fontSize:14,fontWeight:500}}>{m.name}</div>
            <div style={{color:'#D1D5DB'}}>›</div>
          </div>
        ))}
        <div onClick={onLogout} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 20px',cursor:'pointer'}}>
          <div style={{width:40,height:40,borderRadius:'50%',background:'#FFF4E0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>⚙️</div>
          <div style={{flex:1,fontSize:14,fontWeight:500,color:'#EF4444'}}>退出登录</div>
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
    { icon: '⚡', title: '事件系统', body: '共 15 种事件，全是你的经营状态招来的：差评拖欠会发酵、高出租率+少人手会挨投诉、口碑好会来网红探店。危机事件（橙框）要在 30 秒内选应对方案，超时按最差处理。' },
    { icon: '🏆', title: '酒店称号', body: '普通旅社 → 舒适旅店 → 精品酒店 → 人气名店 → 标杆酒店。出租率、好评率、品质分加权决定，每周结算后可能晋升或降级。' },
    { icon: '⭐', title: '怎么涨分', body: '利润：控成本+提房价找平衡；口碑：及时回复差评、定期深清洁；出租率：55%-75% 是健康区；差评：总数越少分越高。全部逻辑与最终成绩完全一致。' },
    { icon: '💾', title: '数据安全', body: '进度自动存云端+本机。「我的」页可导出备份文件；换设备登录同一学号自动恢复。重开经营需二次确认且会覆盖云端，慎重。' },
  ]
  const faqs = [
    { q: '网页打不开怎么办？', a: '优先用安卓App；正式版会更换为国内直连域名，以老师通知的网址为准。' },
    { q: '之前做的进度还在吗？', a: '在。进度自动存云端，用同一学号登录自动恢复；也可在「我的」页导出备份文件双重保险。' },
    { q: '本周结算按钮是灰的/被拦了？', a: '老师设置了全班统一周，你的进度已超前——等老师推进后即可结算。' },
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
      <div className="card" style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}>
        <div className="card-title">💬 常见问题</div>
        {faqs.map(f => (
          <div key={f.q} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1E40AF' }}>Q：{f.q}</div>
            <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.7, marginTop: 2 }}>A：{f.a}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ===== 小组成员页（云端同班同组队友名单） =====
function GroupMembersPage({ user, onBack }) {
  const [members, setMembers] = useState(null)
  const [memberStates, setMemberStates] = useState({}) // uid → 经营概况
  const hasGroup = !!(user?.groupNo && user?.className)
  useEffect(() => {
    if (!hasGroup) return
    let cancelled = false
    fetchGroupMembers(user.className, user.groupNo).then(async list => {
      if (cancelled) return
      const others = list.filter(m => m.user_id !== user.uid)
      setMembers(others)
      // 拉组员经营概况（RLS 限同班同组只读）
      try {
        const states = await fetchGroupStates(others.map(m => m.user_id))
        if (!cancelled) {
          const map = {}
          states.forEach(gs => {
            const h = (gs.state && gs.state.history) || []
            map[gs.user_id] = {
              hotel: gs.state?.brand?.name && gs.state?.property?.name ? `${gs.state.brand.name}·${gs.state.property.name}` : (gs.state?.brand?.name || '未开业'),
              week: gs.week || 1,
              finished: gs.finished,
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
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{m.display_name}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                      {st ? `${st.finished ? '已结业' : `第${st.week}周`} · ${st.hotel}` : '查看经营概况…'}
                    </div>
                  </div>
                </div>
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
        <div className="card-title">逐周累计走势</div>
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

export default function App() {
  const saved = loadState()
  const [user, setUser] = useState(saved.user || null) // null = 未登录
  const [location, setLocation] = useState(saved.location || null) // 选址结果 { city, district }
  const [brand, setBrand] = useState(saved.brand || null) // 选中的品牌
  const [property, setProperty] = useState(saved.property || null) // 认领的物业
  const [established, setEstablished] = useState(saved.established || false) // 是否完成筹建
  const [tab, setTab] = useState('business')
  const [openPage, setOpenPage] = useState(null) // { title, icon }
  const [currentDecision, setCurrentDecision] = useState(null) // 当前决策
  const [doneDecisions, setDoneDecisions] = useState(saved.doneDecisions || {}) // 已完成的决策
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, location, brand, property, established, doneDecisions, report, week, history, finished, welcomed }))
    } catch (e) {}
  }, [user, location, brand, property, established, doneDecisions, report, week, history, finished, welcomed])

  // 云端同步：真实登录时防抖 1.5s 上传经营状态（教师端可见）
  const cloudState = { location, brand, property, established, doneDecisions, report, week, history, finished, welcomed }
  useEffect(() => {
    if (!user?.cloud || !user?.uid || restoring) return
    const t = setTimeout(() => {
      import('./supabaseClient.js').then(({ saveGameState }) =>
        saveGameState(user.uid, cloudState, groupKeyOf(user.className, user.groupNo)).catch(() => {})
      )
    }, 1500)
    return () => clearTimeout(t)
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
          setDoneDecisions(cloudSaved.doneDecisions || {})
          setReport(cloudSaved.report || null)
          setWeek(cloudSaved.week || 1)
          setHistory(cloudSaved.history || [])
          setFinished(!!cloudSaved.finished)
          setWelcomed(!!cloudSaved.welcomed)
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
    try {
      const reviews = JSON.parse(localStorage.getItem('hotel-sim-reviews') || '[]')
      pendingNegatives = reviews.filter(r => r.status === 'pending' || r.status === 'ignored').length
      resolvedCount = reviews.filter(r => r.status === 'resolved').length
    } catch (e) {}
    // 好评率跨周延续：用上一周的好评率做基准；上周危机应对选择影响本周
    let crisisResponse = null
    try {
      const saved = JSON.parse(localStorage.getItem('hotel-sim-crisis-response') || 'null')
      if (saved && saved.week === week - 1) crisisResponse = saved.choice
    } catch (e) {}
    const prevGoodRate = history.length ? history[history.length - 1].finalGoodRate : null
    const result = settle({ site, brand, decisions: doneDecisions, week, pendingNegatives, prevGoodRate, crisisResponse, resolvedCount })
    try { localStorage.removeItem('hotel-sim-crisis-response') } catch (e) {}
    // 结算差评回流口碑页（保留已处理的旧评价，追加本周新评价）
    try {
      const kept = reviews.filter(r => r.week == null && !String(r.id).startsWith('w'))
      localStorage.setItem('hotel-sim-reviews', JSON.stringify([...kept, ...result.generatedReviews]))
    } catch (e) {}
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
  function handleEstablished() {
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
        <TeacherDashboard user={user} onLogout={handleLogout} />
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
        <BrandSelection onConfirm={handleBrandConfirm} />
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
        <FinalResult history={history} onRestart={() => { setFinished(false); setWeek(1); setHistory([]); setDoneDecisions({}); try { localStorage.removeItem('hotel-sim-reviews') } catch (e) {} }} />
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
        <WeeklyReport result={report} onClose={handleNextWeek} history={history} brand={brand} />
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
          onBack={() => setCurrentDecision(null)}
          onDone={(id, answer) => {
            setDoneDecisions({ ...doneDecisions, [id]: answer })
            setCurrentDecision(null)
            toast(`✓ ${decisions.find(d => d.id === id)?.name || '决策'} 已保存`)
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
        ? <GroupMembersPage user={user} onBack={close} />
        : openPage.key === 'records'
          ? <OperationRecords history={history} onBack={close} />
          : openPage.key === 'help'
            ? <HelpPage onBack={close} />
            : <PlaceholderPage title={openPage.title} icon={openPage.icon} onBack={close} />
  } else {
    const pages = {
      business: <Business onOpen={open} location={location} brand={brand} property={property} onDecision={setCurrentDecision} doneDecisions={doneDecisions} onSettle={handleSettle} report={report} week={week} history={history} pendingReviewCount={pendingReviewCount} />,
      report: <Report report={report} week={week} history={history} />,
      reputation: <Reputation report={report} history={history} />,
      profile: <Profile onOpen={open} user={user} location={location} brand={brand} property={property} onLogout={handleLogout} doneDecisions={doneDecisions} week={week} history={history} report={report} onRename={handleRename} />,
    }
    mainPage = pages[tab]
  }

  return (
    <div className="app">
      <div className="statusbar">
        <span className="time">{time || '09:41'}</span>
        <span className="icons">📶 🔋</span>
      </div>
      {mainPage}
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
            {t.key === 'reputation' && pendingReviewCount > 0 && <div className="badge-dot"></div>}
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
