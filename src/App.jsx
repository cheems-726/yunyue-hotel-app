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
import { supabase, emailFor, fetchProfile, fetchGameState, fetchClassWeek } from './supabaseClient.js'

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
function Business({ onOpen, location, brand, property, onDecision, doneDecisions, onSettle, report, week, history }) {
  const modules = ['部门运营', '会员推广', '门店经营']
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
        <div className="sub">{brand ? `${brand.name} · ${location?.district}` : ''} · 已决策 {doneCount}/18</div>
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
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 12, padding: '12px 0', fontSize: 14 }} onClick={onSettle}>
          🔄 本周结算（查看经营结果）
        </button>
      </div>

      {/* 18项能力点，按模块分组 */}
      {modules.map(mod => (
        <div key={mod}>
          <div className="section-title">
            <span className="left">{mod}</span>
            <span className="hint">{decisions.filter(d => d.module === mod).length} 项决策</span>
          </div>
          <div className="task-list">
            {decisions.filter(d => d.module === mod).map(d => {
              const isDone = doneDecisions[d.id] !== undefined
              return (
                <div className="task-card" key={d.id} onClick={() => onDecision(d)}>
                  <div className={`task-icon ${bgMap[mod]}`}>{d.icon}</div>
                  <div className="task-body">
                    <div className="name">{d.name} {isDone && '✓'}</div>
                    <div className="desc">{d.desc.slice(0, 25)}…</div>
                  </div>
                    <span className={`task-badge ${isDone ? 'badge-done' : 'badge-new'}`}>{isDone ? '已决策·可改' : '去决策'}</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ===== 报表页 =====
function Report({ report, week, history }) {
  // 智能诊断：基于真实经营指标
  const diagnoses = []
  if (report) {
    if (report.occupancy < 55) diagnoses.push({ icon: '⚠', text: `出租率仅 ${report.occupancy}%，偏低。考虑降价促销或提升口碑拉客流。` })
    if (report.occupancy >= 75) diagnoses.push({ icon: '⚠', text: `出租率 ${report.occupancy}% 较高，注意满负荷服务质量和差评风险。` })
    if (report.profit < 0) diagnoses.push({ icon: '⚠', text: `本周亏损 ${Math.abs(report.profit)} 元，检查人力/营销成本是否过高。` })
    if (report.negativeCount > 0) diagnoses.push({ icon: '💬', text: `本周 ${report.negativeCount} 条差评待处理，及时回复可减半负面影响。` })
    if (report.demandStrength < 0.8) diagnoses.push({ icon: '📉', text: `客源强度偏低（${report.demandStrength}），竞品分流明显。` })
    if (diagnoses.length === 0) diagnoses.push({ icon: '✅', text: '本周经营稳健，各项指标健康，继续保持！' })
  }

  return (
    <div className="content">
      <div className="header">
        <div className="row1"><span className="hotel-name">报表</span></div>
        <div className="sub">{report ? `第 ${report.week} 周结算` : `第 ${week} 周 · 累计`}</div>
      </div>

      {report ? (
        <>
          {/* 真实 KPI */}
          <div style={{display:'flex',gap:8,margin:'0 20px 14px'}}>
            <div className="card" style={{flex:1,margin:0,padding:'12px 8px',textAlign:'center'}}>
              <div style={{fontSize:11,color:'#9CA3AF',marginBottom:6}}>出租率</div>
              <div style={{fontSize:16,fontWeight:700}}>{report.occupancy}<span style={{fontSize:10,color:'#6B7280',fontWeight:400}}>%</span></div>
            </div>
            <div className="card" style={{flex:1,margin:0,padding:'12px 8px',textAlign:'center'}}>
              <div style={{fontSize:11,color:'#9CA3AF',marginBottom:6}}>ADR</div>
              <div style={{fontSize:16,fontWeight:700}}>{report.price}<span style={{fontSize:10,color:'#6B7280',fontWeight:400}}>元</span></div>
            </div>
            <div className="card" style={{flex:1,margin:0,padding:'12px 8px',textAlign:'center'}}>
              <div style={{fontSize:11,color:'#9CA3AF',marginBottom:6}}>RevPAR</div>
              <div style={{fontSize:16,fontWeight:700}}>{Math.round(report.revenue / report.rooms)}<span style={{fontSize:10,color:'#6B7280',fontWeight:400}}>元</span></div>
            </div>
          </div>
          <div style={{display:'flex',gap:8,margin:'0 20px 14px'}}>
            <div className="card" style={{flex:1,margin:0,padding:'12px 8px',textAlign:'center'}}>
              <div style={{fontSize:11,color:'#9CA3AF',marginBottom:6}}>利润</div>
              <div style={{fontSize:16,fontWeight:700,color:report.profit>=0?'#16A34A':'#DC2626'}}>{report.profit>=0?'+':''}{report.profit}<span style={{fontSize:10,color:'#6B7280',fontWeight:400}}>元</span></div>
            </div>
            <div className="card" style={{flex:1,margin:0,padding:'12px 8px',textAlign:'center'}}>
              <div style={{fontSize:11,color:'#9CA3AF',marginBottom:6}}>口碑分</div>
              <div style={{fontSize:16,fontWeight:700}}>{(report.finalGoodRate/20).toFixed(1)}<span style={{fontSize:10,color:'#6B7280',fontWeight:400}}>/5</span></div>
            </div>
            <div className="card" style={{flex:1,margin:0,padding:'12px 8px',textAlign:'center'}}>
              <div style={{fontSize:11,color:'#9CA3AF',marginBottom:6}}>差评</div>
              <div style={{fontSize:16,fontWeight:700}}>{report.negativeCount}<span style={{fontSize:10,color:'#6B7280',fontWeight:400}}>条</span></div>
            </div>
          </div>

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
        <div className="card-title">📈 各周营收趋势</div>
        {history.length > 0 ? (
          <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',height:120,padding:'8px 4px 0',gap:8}}>
            {history.map((h, i) => {
              const maxRev = Math.max(...history.map(x => x.revenue), 1)
              const hh = Math.round((h.revenue / maxRev) * 100)
              return (
                <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6,height:'100%',justifyContent:'flex-end'}} key={i}>
                  <div style={{width:22,borderRadius:'6px 6px 0 0',background: i===history.length-1 ? '#D97706' : '#FBBF77', height: hh + '%'}}></div>
                  <span style={{fontSize:10,color:'#9CA3AF'}}>第{h.week}周</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '30px 0' }}>
            暂无历史数据
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
function Profile({ onOpen, user, location, brand, property, onLogout, doneDecisions, week }) {
  const menus = [
    { icon: '🏨', bg: 'amber', name: '我的酒店信息' },
    { icon: '📋', bg: 'blue', name: '经营操作记录' },
    { icon: '🏆', bg: 'green', name: '积分与评分明细' },
    { icon: '👥', bg: 'blue', name: '小组成员' },
  ]
  const orgDesc = user?.role === 'teacher'
    ? '教师'
    : `${property?.name || '云悦酒店'} · ${brand?.name || ''} · 组长 · 第 3 组${location ? ' · ' + location.district : ''}`

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
        <div style={{width:56,height:56,borderRadius:'50%',background:'#FFF4E0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>😊</div>
        <div>
          <div style={{fontSize:18,fontWeight:700}}>{user?.name || '陈小明'}</div>
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
        {menus.filter(m => m.name !== '我的酒店信息').map(m => (
          <div key={m.name} onClick={() => onOpen(m.name, m.icon)} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 20px',borderBottom:'1px solid #F9FAFB',cursor:'pointer'}}>
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
  const [pendingReviewCount, setPendingReviewCount] = useState(0) // 未处理差评数（红点）
  const [time, setTime] = useState('')
  const [restoring, setRestoring] = useState(true) // 正在恢复云端会话

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
        saveGameState(user.uid, cloudState).catch(() => {})
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

  const tabs = [
    { key: 'business', icon: '🏠', label: '经营' },
    { key: 'report', icon: '📊', label: '报表' },
    { key: 'reputation', icon: '⭐', label: '口碑', badge: true },
    { key: 'profile', icon: '👤', label: '我的' },
  ]

  function open(title, icon) {
    setOpenPage({ title, icon })
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
        const cloudSaved = await fetchGameState(userInfo.uid)
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
    if (user?.cloud) { try { await supabase.auth.signOut() } catch (e) {} }
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
    // 读取口碑页未处理差评数，影响本周结算的好评率
    let pendingNegatives = 0
    let reviews = []
    try {
      reviews = JSON.parse(localStorage.getItem('hotel-sim-reviews') || '[]')
      pendingNegatives = reviews.filter(r => r.status === 'pending' || r.status === 'ignored').length
    } catch (e) {}
    // 好评率跨周延续：用上一周的好评率做基准
    const prevGoodRate = history.length ? history[history.length - 1].finalGoodRate : null
    const result = settle({ site, brand, decisions: doneDecisions, week, pendingNegatives, prevGoodRate })
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
        <WeeklyReport result={report} onClose={handleNextWeek} />
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
          onBack={() => setCurrentDecision(null)}
          onDone={(id, answer) => {
            setDoneDecisions({ ...doneDecisions, [id]: answer })
            setCurrentDecision(null)
          }}
        />
      </div>
    )
  }

  let mainPage
  if (openPage) {
    mainPage = <PlaceholderPage title={openPage.title} icon={openPage.icon} onBack={close} />
  } else {
    const pages = {
      business: <Business onOpen={open} location={location} brand={brand} property={property} onDecision={setCurrentDecision} doneDecisions={doneDecisions} onSettle={handleSettle} report={report} week={week} history={history} />,
      report: <Report report={report} week={week} history={history} />,
      reputation: <Reputation report={report} history={history} />,
      profile: <Profile onOpen={open} user={user} location={location} brand={brand} property={property} onLogout={handleLogout} doneDecisions={doneDecisions} week={week} />,
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
      <div className="tabbar">
        {tabs.map(t => (
          <button className={`tab ${tab === t.key && !openPage ? 'active' : ''}`} key={t.key} onClick={() => { setTab(t.key); close() }}>
            <div className="tab-icon">{t.icon}</div>
            <div className="tab-label">{t.label}</div>
            {t.key === 'reputation' && pendingReviewCount > 0 && <div className="badge-dot"></div>}
          </button>
        ))}
      </div>
    </div>
  )
}
