import { 台账行FromCloud } from './processLedgerRows.mjs'   // ★ V117-④：教师端台账行（云端数据）
import { 班级平均口碑 } from './teacherMetrics.mjs'   // ★ V127-#2：班级平均口径（评分已是 5 分制，不得再 /20）
import { 今日缺做 } from './dailyQuestTeacher.mjs'   // ★ V128-#3 批3：今天谁没做委托（不排名）
import { 思维行, 排序思维行 } from './thinkingBoard.mjs'   // ★ V131 §1-E：思维看板（按偏差讲评，不排名）
import ProcessLedger from './ProcessLedger.jsx'   // ★ V117-④⑤：台账块 + CSV
import { 台账CSV } from './processScore.mjs'
import { 提示 } from './notice.mjs'   // ★ V115 §3-⑤：页内提示替代 alert
import { 只取有效组, 只取有效流水 } from './rosterIntegrity.mjs'   // ★ V114-P2：组↔账号一一对应（未分组不进统计）
import TeacherDiagnosis from './TeacherDiagnosis.jsx'   // ★ V113-2.6：诊断组合（不做排名）
import React, { useState, useEffect, useRef } from 'react'
// ★ V97：统一导航栈（返回=弹栈 · 教师端接 popstate）
import { 创建导航栈, 造返回处理器 } from './navStack.mjs'
import Icon from './Icon.jsx'
import { decisions, OWNER_LABELS } from './decisions.js'
import { supabase, saveGameStateNow, advanceClassOffset } from './supabaseClient.js' // §32-U1 R3：老师裁量写回学生存档（override）· V131：推进教学日
import { 推进目标, 本周第几天 } from './advanceWeek.mjs'   // ★ V131 §2：不跳周
import { hotCrisisActive } from './hotReview.mjs' // R3：危机期是否仍生效（与引擎同一判定）
import { missingWeeks, missingLabel } from './missingWeeks.mjs'
import { getTitle } from './hotelTitle.js'
import { EVENT_INFO } from './settlement.js'
import { fetchAllGameStates, fetchAllProfiles, fetchClassDay, updateProfileByTeacher, fetchClassWeek, setClassWeek, subscribeGameStates, saveTeacherNote, fetchTeacherNotes, deleteTeacherNote, fetchDecisionLogs, subscribeDecisionLogs, fetchClassState, setClassInjections, setClassSupervisorAuth, createClass, fetchAllClasses, signUpStudent, saveDecisionLog } from './supabaseClient.js'   // ★ V165：+createClass/fetchAllClasses/signUpStudent/saveDecisionLog/supabase（supabase 已在 §32-U1 行导入 · setSemesterStatus 已在 V157 行导入）
import { restoreFromCloud } from './stateMigration.mjs'
import { progressLag } from './serverTick.mjs'
import { guideResetAll } from './GuideTip.jsx'   // V66 · 重置本机引导标记   // W1-5（T3.7）：服务端 classDay vs 该组进度
import { 按人聚合 } from './operatorLog.mjs'     // §22.3-C4：按人查（数据面单源）
import { 扫描错误操作, parseBrandBase } from './errorOps.mjs'
import { 六组一句话 } from './teacherSixLines.mjs'   // ★ V144 §2
import { 班级并排, 学期切片 as 学期切片12 } from './semesterResult.mjs'   // ★ V152 §1：学期成果并排（不排名）· V153：前12周切片
import { 班级并排表 } from './SemesterResult.jsx'   // ★ V152 §1：共用渲染
import { setClassContinue } from './supabaseClient.js'   // ★ V152 §2：续营开关（RLS 限教师）
import { setSemesterStatus, resetClassGameStates } from './supabaseClient.js'   // ★ V157 阶段1：学期状态机 + 新学期重置（只清当前班）
import { fetchSemesterCloseout, saveSemesterCloseout, fetchSemesterCloseoutsAll, sha256Hex } from './supabaseClient.js'   // ★ V163：收口状态服务端持久层
import { normalizeSteps, runOneTouch, STEPS as 收口步序, STEP_LABELS as 收口步名, 收口报告, 校验冷备 } from './oneTouchCloseout.mjs'   // ★ V163：四步纯层（失败停步/幂等/断点续跑）
import { 复盘报告, 教学建议, 未决策阈值 } from './semesterReview.mjs'
import { 解析花名册, 预览分组, 口令清单, 校验班级名, STUDENT_STATE_COPY, SEMESTER_STATES, 回退审计键 } from './classAdmin.mjs'   // ★ V165：开箱全流程纯层
import { 课堂告警, 课堂节奏, 规则表 as 预警规则表 } from './classAlerts.mjs'   // ★ V171：课堂预警纯层（只读 · 阈值集中）   // ★ V164：学期教学复盘纯层（只读 · 零网络 · 规则驱动）
import { 成绩单CSV as 生成CSV文本 } from './reportCard.mjs'   // ★ V157：结课快照 CSV（快照 = JSON+CSV 双件）
import ClassroomScreen, { ClassroomCompare, 下载学期报告, 导出成绩单CSV as 下载成绩单CSV2 } from './ClassroomPack.jsx'   // ★ V154 批3：投屏视图/班级对比/学期报告
import { 组装课堂行 } from './classroomPack.mjs'   // ★ V154 批3：纯层
import { 成绩单, 成绩单行, 成绩单CSV, 归档快照, 归档CSV, 与scoreOf零差 } from './reportCard.mjs'   // ★ V153 + V154批3（成绩单 批量入口）
import ReportCardPrint, { 下载CSV as 下载成绩单CSV } from './ReportCardPrint.jsx'   // ★ V153 §1：打印页
// （V154 批3：归档快照/归档CSV 自 reportCard 复用，不重复 import）
import { 周经营净利 } from './weeklyProfit.mjs'   // ★ V145：经营净利口径
import { dayToWeekDay } from './weeklyAuto.mjs'   // ★ V171：权威日 → 周内第几天 // V39 · 错误操作高亮（乱定价/乱招人/乱选址 · 规则单源 · 判据随行）
import { normalizeAttrs, qualityOf } from './attrs.js'
import { 班徽标, 选默认班, 班进度 } from './classCalendar.mjs'   // ★ V177§3/T3：按班徽标 + 默认班级 + 班进度
import { 代价文案 } from './decisionRisk.mjs' // §32-U8-补 §1：代价文案单源（老师端弹窗与学生面板同源 · 不自拼）
// ★ §32-U8-补 §2①：老师事件注入面板 —— 事件库/构建/校验 单源（本面板不自拼任何事件文案）
// ★ §33-V8：事件库 35 条 + 自定义事件构建 + 受控效力维度 + 按日程校验（全部单源）
import { 注入事件库, 构建注入事件, 构建自定义事件, 校验注入合法性, 校验按日触发, 效力维度 } from './teacherEvents.mjs'
// ★ §32-U8-补 §2④：AI 领班全班默认授权页 —— 授权形状与规则单源（aiSupervisor）
import { 默认授权, 领班规则 } from './aiSupervisor.mjs'
import { groupKeyOf } from './supabaseClient.js'
// ★ V140 §1：原 React.lazy 会产 import()（Chromium<63 解析失败）⇒ 改静态导入（兼容优先）
import TeacherReport from './TeacherReport.jsx' // §32-U2：一键图文经营报告（只读汇总 · 打印/另存 PDF）
import SemesterTasks from './SemesterTasks.jsx' // §33-V80：12 周任务书（打印版 · 全班发）

import { GOP_SHORT, GOP_DEF, NET_LABEL, NET_DEF, sumGop, sumNet, netOf, scoreOf, prevScore, totalRevenue, avgOccupancy, avgGoodRate } from './metricDefs.mjs'

// 教师后台：全班经营总览 + 排名 + 分组管理（接 Supabase 真实数据，云端不可用时回退演示数据）
const demoGroups = [
  { id: 1, name: '第1组', hotel: '云悦酒店', city: '成都·锦江区', occ: 72, revenue: 15.2, profit: 6.8, rating: 4.5, score: 92 },
  { id: 2, name: '第2组', hotel: '汉庭·春熙路', city: '成都·武侯区', occ: 68, revenue: 12.4, profit: 4.9, rating: 4.2, score: 85 },
  { id: 3, name: '第3组', hotel: '全季·天府广场', city: '成都·青羊区', occ: 65, revenue: 13.1, profit: 5.2, rating: 4.3, score: 87 },
  { id: 4, name: '第4组', hotel: '桔子·绵阳', city: '绵阳·涪城区', occ: 58, revenue: 9.6, profit: 3.1, rating: 4.0, score: 74 },
  { id: 5, name: '第5组', hotel: '汉庭·德阳', city: '德阳·旌阳区', occ: 55, revenue: 8.2, profit: 2.4, rating: 3.8, score: 68 },
]

// 从游戏状态 JSON 汇总出一组的经营摘要 + 四维评分（与学生端 FinalResult 同口径）
function summarize(gs, profile, classDay = 0) {
  const s = gs?.state || {}
  const history = s.history || []
  // 🔴 E1（二期 · 唯一账本）：全部聚合量与四维评分改走 metricDefs 单源 ——
  //   此前教师端/学生端各写一份【相同阶梯】，且"上周分数"还漏了处理率分支（本周有、上周无 ⇒ 假跳变）。
  //   scoreOf 与学生端 FinalResult 完全同源；prevScore 用同一套规则算"去掉最后一周"的分数。
  const S = scoreOf(history)
  // ★ V67：无结算周（history 空）⇒ score/scorePrev 置 null —— scoreOf([]) 会返回 0 分，
  //   未通电时全班显示"0 分"会被误读成"学生做得差"；真相是"还没结算"。渲染层对 null 显示「未结算」。
  const 无结算 = !Array.isArray(history) || history.length === 0
  const totalProfit = S.totalProfit
  const avgOcc = S.avgOccupancy
  const avgGood = S.avgGoodRate
  const totalNeg = S.totalNegative
  const profitScore = S.profitScore
  const repScore = S.reputationScore
  const occScore = S.occupancyScore
  const negScore = S.negativeScore
  const score = S.finalScore
  const totalRev = totalRevenue(history)
  const 一次性 = (history || []).reduce((a, h) => a + (Number(h && h.oneTimeFees && h.oneTimeFees.合计) || 0), 0)
  const 经营净利和 = (history || []).reduce((a, h) => a + 周经营净利(h), 0)
  // 🔴 W2-3（W10 正名）：教师端与学生端同口径 —— 净利润（评分基准，= 既有 profit）+ GOP（经营毛利，不含租金）
  //   旧档周无 gop 字段 ⇒ sumGop 只累加有字段的周，并回报覆盖度（教师端要能判断"这组 GOP 是否完整"）
  const gopTotal = sumGop(history)
  // 🔴 T1.1（§十七 A4）：分段 = 旧阈值 × m，与 FinalResult.jsx 同口径（否则学生端/教师端分数不一致）
  // 🔴 W2-2：分段按新利润量级重标定（m=0.2970）；★ D20 判据② 4/6 组一致，差异已记录未硬凑
  // 🔴 E1：上面这段阶梯已【整体搬进 metricDefs.scoreOf】（本文件与 FinalResult 各写一份 → 改一处必漏另一处）
  // 🔴 W1-5（T3.7）：进度落后提示 —— 服务端 classDay（唯一权威） vs 该组算到第几天。
  //   lastComputedDay 的口径：该组 history 覆盖的游戏天数（每周 7 天）；旧档无该字段时用 history.length×7 推。
  const lastComputedDay = Number(s.__lastComputedDay) || (history.length * 7)
  const lag = classDay > 0 ? progressLag({ classDay, lastComputedDay, lastDecisionAt: s.__lastDecisionAt || null }) : null
  // 上周分数（去掉最后一周的历史再算一次）→ 用于排名行显示周环比
  // 🔴 E1：改走 metricDefs.prevScore（同一套规则）—— 原内联式**漏了处理率分支**，
  //   于是"本周按处理率算、上周按条数算" ⇒ 周环比可能凭空跳变（正是那行注释自己担心的假跳变）
  const scorePrev = prevScore(history)
  // 品质分改读属性池（与学生端同口径：normalizeAttrs 兜底旧档无 attrs → 初值 60，绝不 NaN）
  // 保险丝：极端脏数据下回退 70，避免 getTitle 崩溃（历史教训：undefined 会让称号计算炸）
  const attrsQ = normalizeAttrs(gs?.state?.attrs).quality
  const q2 = Number.isFinite(attrsQ) ? attrsQ : 70
  const titleInfo = getTitle(avgOcc, avgGood, q2)
  return {
    uid: gs.user_id,
    titleIcon: titleInfo.icon,
    title: titleInfo.title,
    // ★ V114-P1：教师端统一显示「第N组 · 酒店名」—— 名称对得上，数据才敢当参考
    hotelName: s.hotelName || '',
    groupKey: gs.group_key || '',
    name: profile?.group_no
      ? `${profile.class_name ? profile.class_name + ' · ' : ''}第${profile.group_no}组 · ${s.hotelName || '（未命名）'}`
      : (profile?.display_name || gs.user_id.slice(0, 8)),
    hotel: s.brand?.name && s.property?.name ? `${s.brand.name}·${s.property.name}` : (s.brand?.name || '未开业'),
    city: s.location ? `${s.location.city}·${s.location.district}` : '未选址',
    occ: avgOcc, revenue: +(totalRev / 10000).toFixed(1), profit: +(totalProfit / 10000).toFixed(1),
    gop: +(gopTotal.value / 10000).toFixed(1), gopComplete: gopTotal.complete, oneTime: +(一次性 / 10000).toFixed(1), netOp: +(经营净利和 / 10000).toFixed(1),
    rating: avgGood ? +(avgGood / 20).toFixed(1) : 0,
    score: 无结算 ? null : score, scorePrev: 无结算 ? null : scorePrev, week: gs.week || s.week || 0, finished: gs.finished,
    historyCount: history.length,
    lag,   // W1-5：{ lagDays, lagWeeks, level, label, sinceLabel } 或 null
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

// 策略画像：从逐周决策快照累计三路信号，自动标注策略风格（课堂对比讨论用）
export function strategyOf(history) {
  let price = 0, cost = 0, service = 0, weeks = 0
  ;(history || []).forEach(h => {
    const d = h.decisions || {}
    if (!Object.keys(d).length) return
    weeks++
    if (d.pricing === '降价 20% 抢客') price += 2
    else if (d.pricing === '跟降 10%') price += 1
    if (d.shifts === '精简省成本') cost += 1
    if (d.linen === '外包') cost += 1
    if (d.hygiene === '不停房') cost += 1
    if (d.shifts === '满编保服务') service += 1
    if (d.hygiene === '停房深清洁') service += 1
    if (d.reputation === '道歉+赔偿') service += 1
    if (d['member-convert'] === '强调品质') service += 1
    if (d.corporate === '让利签约') service += 0.5
  })
  if (weeks < 2) return null // 信号不足不下结论
  if (price >= 3) return { tag: '激进降价型', icon: 'status.crisis', color: 'var(--bad)', bg: 'var(--bad-bg)' }
  if (cost >= 3 && cost > service) return { tag: '成本控制型', icon: 'money.spend', color: 'var(--warn)', bg: 'var(--warn-bg)' }
  if (service >= 3 && service > cost) return { tag: '稳健服务型', icon: 'role.service', color: 'var(--primary)', bg: 'var(--primary-bg)' }
  return { tag: '均衡型', icon: 'note.caliber', color: 'var(--text-sub)', bg: 'var(--fill)' }
}

// 策略标签（信号不足不渲染）
function StrategyTag({ rawStates, uid }) {
  const gs = (rawStates || []).find(x => x.user_id === uid)
  const st = strategyOf(gs?.state?.history || [])
  if (!st) return null
  return (
    <span style={{ fontSize: 9, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 5, padding: '2px 6px', marginLeft: 5, verticalAlign: '1px' }}>
      <Icon name={st.icon} size={13} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {st.tag}
    </span>
  )
}

// 组详情下钻：展开看该组逐周经营明细+当周决策内容（课堂复盘用）
function GroupDetail({ uid, rawStates, name, allNotes = [], onDeleteNote, onSaved, profiles = [], onGoDecision }) {
  const [editNote, setEditNote] = useState(null) // 正在编辑的批注
  const gs = rawStates.find(x => x.user_id === uid)
  if (!gs) return <div style={{ padding: '10px 12px', background: 'var(--bg)', fontSize: 12, color: 'var(--text-muted)' }}>该组暂无经营存档</div>
  const s = gs.state || {}
  const hist = s.history || []
  const weekDecisions = s.doneDecisions ? Object.keys(s.doneDecisions).length : 0
  // ★ §32-U1 R3：上热门危机【待复核】条目（引擎 hotReviewCrisis 随存档上来；老师可 维持/降级 · 默认不干预=照罚）
  const crisis = s.hotReviewCrisis
  const crisisLive = crisis && hotCrisisActive({ hotReviewCrisis: crisis }, s.week || 1)
  const 裁量 = async (决定) => {
    if (!crisis) return
    const 新 = { ...crisis, override: 决定, overrideBy: name, overrideAt: new Date().toISOString() }
    saveGameStateNow(gs.user_id, { ...s, hotReviewCrisis: 新 }, undefined)   // 写回该组存档（R3 留痕在 override 字段）
  }
  return (
    <div style={{ padding: 12, background: 'var(--bg)', borderRadius: '0 0 10px 10px', marginBottom: 8 }}>
      {crisisLive && (
        <div style={{ padding: '8px 10px', background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', borderRadius: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--bad)' }}>舆情危机期【待复核】（第 {crisis.startWeek} 周触发 · 还剩 {Math.max(0, crisis.startWeek + crisis.weeks - (s.week || 1))} 周）</div>
          <div style={{ fontSize: 10, color: 'var(--text-sub)', marginTop: 2 }}>原因：{crisis.source} · 后果：出租率 −30% · 差评概率 ×2（默认 = 照罚）</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button onClick={() => 裁量('维持处罚')} style={{ fontSize: 10, fontWeight: 700, border: 'none', borderRadius: 6, padding: '5px 10px', background: 'var(--border)', color: 'var(--text)', cursor: 'pointer' }}>维持处罚</button>
            <button onClick={() => 裁量('降级为期末扣分')} style={{ fontSize: 10, fontWeight: 700, border: 'none', borderRadius: 6, padding: '5px 10px', background: 'var(--warn-border)', color: 'var(--warn)', cursor: 'pointer' }}>降级为期末扣分（当场解除持续期）</button>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', alignSelf: 'center' }}>不点 = 默认照罚{crisis.override ? ` · 已裁量：${crisis.override}（${crisis.overrideBy || '?'} · ${String(crisis.overrideAt || '').slice(0, 16)}）` : ''}</span>
          </div>
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 8 }}>
        {s.brand?.name || '—'}品牌 · 云端更新 {new Date(gs.updated_at).toLocaleString('zh-CN')}
      </div>
      {/* 称号进度 */}
      {(() => {
        const hist = s.history || []
        if (!hist.length) return null
        // 🔴 E1：称号进度也用单源平均（原自算两行 Σ÷length；与学生端 HotelStatus 的称号口径必须同源）
        const avgOcc = avgOccupancy(hist)
        const avgGood = avgGoodRate(hist)
        const q = qualityOf(s)
        const ti = getTitle(avgOcc, avgGood, q)
        // 称号轨迹：仅在称号变化的周记录节点（课堂复盘看成长路径）
        let prevTitle = null
        const nodes = []
        hist.forEach(h => {
          const t = getTitle(h.occupancy, h.finalGoodRate, q).title
          if (t !== prevTitle) { nodes.push(`第${h.week}周 ${t}`); prevTitle = t }
        })
        return (
          <div style={{ fontSize: 11, color: 'var(--warn)', marginBottom: 8 }}>
            <Icon name={ti.icon} size={13} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> 称号：{ti.title}（综合 {ti.composite}）{ti.next ? ` · 距「${ti.next}」还差综合 ${ti.nextAt - ti.composite} 分` : ' · 已是最高称号'}
            {nodes.length > 1 && <div style={{ color: 'var(--text-sub)', marginTop: 3 }}>轨迹：{nodes.join(' → ')}</div>}
          </div>
        )
      })()}
      {/* 职责决策完成明细：按组内学生职业展开，未完成的标红提醒 */}
      {(() => {
        const s0 = s
        const done = s0.doneDecisions || {}
        const members = profiles.filter(p => p.class_name === (profiles.find(x => x.user_id === uid) || {}).class_name && p.group_no === (profiles.find(x => x.user_id === uid) || {}).group_no)
        const roles = new Set(members.map(p => p.role_in_group).filter(r => r && !['student', 'teacher'].includes(r)))
        const duty = decisions.filter(d => roles.has(d.owner))
        if (!duty.length) return null
        return (
          <div style={{ marginBottom: 10, padding: '8px 10px', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warn)', marginBottom: 4 }}>职责决策完成明细（组内职业对应项）</div>
            {duty.map(d => {
              const isDone = done[d.id] !== undefined
              // 负责人：组内职业匹配该决策 owner 的学生
              const owner = members.find(p => p.role_in_group === d.owner)
              const ownerName = owner ? (owner.display_name || '未命名') : null
              return (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, padding: '2px 0', color: isDone ? 'var(--good)' : 'var(--bad)', lineHeight: 1.5 }}>
                  <span style={{ flex: 1 }}>
 {isDone ? '' : ''}<Icon name={d.icon} size={12} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {d.name}{ownerName && !isDone && ` —— 负责人：${ownerName}，尚未完成`}
                  </span>
                  {!isDone && onGoDecision && (
                    <button title="跳回经营页打开该决策" onClick={e => { e.stopPropagation(); onGoDecision(d.id) }}
                      style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'var(--primary)', border: 'none', borderRadius: 5, padding: '3px 9px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                      去完成 ›
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}
 {/* §22.3-C4（2026-09-29）：老师可查【每人操作】—— 聚合存档里的 operatorLogs（C3 产生）：
          按人分组（谁 · 几条 · 碰了哪些决策 · 职位分布 · 净利影响），旧档无记录 ⇒ 如实显示"无操作记录"。
          数据面单源 = src/operatorLog.mjs 的 按人聚合()（与 C2 按职位聚合同一模块）。 */}
      {(() => {
        const logs = Array.isArray(s.operatorLogs) ? s.operatorLogs : []
        if (!logs.length) return null
        // ★ §23.3-①【错误操作高亮】：净利为负的周 ⇒ 该周的操作记录标红色"亏损周"标签。
        //   数据驱动（历史周真实净利），不做"对错"主观评判；供课堂复盘快速定位亏损周的决策。
        const 亏损周 = new Set(hist.filter(h => Number.isFinite(h.netProfit ?? h.profit) && (h.netProfit ?? h.profit) < 0).map(h => h.week))
        const 人 = 按人聚合(logs)
        return (
          <div style={{ marginBottom: 10, padding: '8px 10px', background: 'var(--primary-bg)', border: '1px solid var(--primary-border)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--info)', marginBottom: 4 }}>每人操作记录（{logs.length} 条 · 按人聚合）</div>
            {人.map(p => (
              <div key={p.operatorId} style={{ fontSize: 11, padding: '3px 0', borderBottom: '1px dashed var(--primary-border)', lineHeight: 1.7 }}>
                <b>{p.operatorName || p.operatorId}</b>
                <span style={{ color: 'var(--text-sub)' }}>（{p.operatorId === '未记录' ? '旧档未记录' : p.operatorId}）</span>
                {' · '}操作 <b>{p.条数}</b> 条 · 周 {p.周.map(w => 亏损周.has(w)
                  ? <span key={w} title="该周净利为负（亏损）" style={{ color: 'var(--bad)', fontWeight: 700 }}>第{w}周</span>
                  : <span key={w}>第{w}周</span>)}
                {' · '}决策：{[...new Set(logs.filter(x => (x.operatorId || '未记录') === p.operatorId).map(x => x.决策名))].join('、')}
                {p.净利影响 !== 0 && (
                  <span style={{ color: p.净利影响 > 0 ? 'var(--good)' : 'var(--bad)' }}> · 净利影响 {p.净利影响 > 0 ? '+' : ''}{p.净利影响.toLocaleString()} 元</span>
                )}
                <span style={{ color: 'var(--text-muted)' }}> · 职位：{Object.entries(p.职位).map(([k, v]) => `${k}×${v}`).join(' / ')}</span>
              </div>
            ))}
            <div style={{ fontSize: 10, color: 'var(--text-sub)', marginTop: 4 }}>
              旧档/未登录的操作会标"未记录"（系统不编人名）；"净利影响"按决策记录当时点估算，仅供参考。
            </div>
          </div>
        )
      })()}
      {/* V39（模块六-5）【错误操作高亮】：乱定价/乱招人/乱选址 三类行为维标记（与亏损周的结果维互补）。
          规则单源 = src/errorOps.mjs（判据+依据随行）· 与「亏损周」同用 --bad 配色（批4 风格统一）。 */}
      {(() => {
        const 房价档 = s.location?.attrs?.房价
        const flags = 扫描错误操作(hist, { 房价档, brandBasePrice: parseBrandBase(s.brand?.price) })
        if (!flags.length) return null
        return (
          <div style={{ marginBottom: 10, padding: '8px 10px', background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bad)', marginBottom: 4 }}>错误操作标记（{flags.length} 条 · 规则判据 · 非主观评判）</div>
            {flags.map((f, i) => (
              <div key={i} style={{ fontSize: 11, padding: '3px 0', lineHeight: 1.7 }} title={f.依据}>
                <span style={{ fontWeight: 700, color: 'var(--bad)' }}>第{f.week}周 · {f.类别}</span>
                {' · '}{f.标签}
                <div style={{ fontSize: 10, color: 'var(--text-sub)', marginTop: 1 }}>依据：{f.依据}</div>
              </div>
            ))}
          </div>
        )
      })()}
      {/* 本周 18 项决策完成度 */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-sub)', marginBottom: 3 }}>
          <span>本周决策完成度</span>
          <span style={{ fontWeight: 600, color: weekDecisions === 18 ? 'var(--good)' : 'var(--warn)' }}>{weekDecisions} / 18</span>
        </div>
        <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: (weekDecisions / 18 * 100) + '%', background: weekDecisions === 18 ? 'var(--good)' : 'var(--primary)', borderRadius: 3 }} />
        </div>
      </div>
      {hist.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>还没有结算过，看不到逐周数据</div>}
      {hist.map(h => {
        const dec = h.decisions || {}
        const entries = Object.entries(dec)
        const netW = netOf(h)   // W2-3：净利润权威字段（netProfit；旧档回退 profit）
        return (
          <div key={h.week} style={{ marginBottom: 10, background: 'var(--card)', borderRadius: 8, padding: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              第{h.week}周 <span style={{ fontWeight: 400, color: 'var(--text-sub)' }}>出租率 {h.occupancy}% · 净利润 {netW === null ? '—' : `${netW >= 0 ? '+' : ''}${netW}元`}{Number.isFinite(h.gop) ? ` · GOP ${h.gop}元` : ''} · 差评 {h.negativeCount}条 · 好评率 {h.finalGoodRate}%</span>
            </div>
            {h.events && h.events.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 4 }}>
 {h.events.map(e => e.name).join('、')}
              </div>
            )}
            {entries.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>决策明细未记录（旧版本结算的一周）</div>
            ) : entries.map(([id, val]) => {
              const d = decisions.find(x => x.id === id)
              // 高风险决策判定
              const risky = []
              if (id === 'pricing' && val === '降价 20% 抢客') risky.push('利润-20%')
              if (id === 'shifts' && val === '精简省成本') risky.push('差评+1')
              if (id === 'overbook' && typeof val === 'number' && val > 3) risky.push('超售风险高')
              if (id === 'hygiene' && val !== '停房深清洁') risky.push('卫生风险')
              if (id === 'energy' && typeof val === 'number' && (val <= 21 || val >= 25)) risky.push('舒适度差')
              if (id === 'reputation' && val === '模板回复') risky.push('态度扣分')
              return (
                <div key={id} style={{ fontSize: 11, padding: '2px 0', color: risky.length ? 'var(--bad)' : 'var(--text)' }}>
                  · {d ? d.name : id}：<b>{fmtAnswer(val)}</b>
                  {risky.length > 0 && <span style={{ fontSize: 10, color: 'var(--bad)', marginLeft: 4 }}>{risky.join(' ')}</span>}
                </div>
              )
            })}
          </div>
        )
      })}
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{name} · 逐周数据可用于课堂复盘讨论</div>

      {/* 历史批注时间线（多条按时间排列） */}
      {(() => {
        const mine = allNotes.filter(n => n.student_uid === uid)
        if (!mine.length) return null
        return (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warn)', marginBottom: 6 }}>批注时间线（{mine.length} 条）</div>
            {mine.map(n => (
              <div key={n.id || n.updated_at} style={{ padding: '7px 10px', background: 'var(--warn-bg)', borderRadius: 8, marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--warn)' }}>{n.week > 0 ? `第${n.week}周批注` : '总评'}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{new Date(n.updated_at).toLocaleString('zh-CN')}</span>
                    <button title="编辑这条批注" onClick={e => { e.stopPropagation(); setEditNote(n) }}
 style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)', padding: '0 2px', fontFamily: 'inherit' }}></button>
                    <button title="删除这条批注" onClick={e => { e.stopPropagation(); if (window.confirm('确定删除这条批注吗？')) onDeleteNote(n.id) }}
 style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--border-strong)', padding: '0 2px', fontFamily: 'inherit' }}></button>
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.6 }}>{n.note}</div>
                {n.score != null && <div style={{ fontSize: 10, color: 'var(--warn)', fontWeight: 700, marginTop: 3 }}>评分 {n.score}/100</div>}
              </div>
            ))}
          </div>
        )
      })()}

      {/* 教师批注+打分 */}
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        <TeacherNoteForm uid={uid} name={name} week={(rawStates.find(x => x.user_id === uid)?.state?.week) || 0} onSaved={onSaved} editNote={editNote} onEditCancel={() => setEditNote(null)} />
      </div>
    </div>
  )
}

// 教师批注表单组件
function TeacherNoteForm({ uid, name, week = 0, onSaved, editNote, onEditCancel }) {
  const [note, setNote] = React.useState('')
  const [score, setScore] = React.useState('')
  const [saved, setSaved] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  // 编辑模式：editNote 变化时把原批注内容同步进表单
  React.useEffect(() => {
    if (editNote) {
      setNote(editNote.note || '')
      setScore(editNote.score != null ? String(editNote.score) : '')
    }
  }, [editNote])

  async function save() {
    if (!note.trim() && !score) return
    setSaving(true)
    // 获取教师uid
    const session = await supabase.auth.getSession()
    const teacherUid = session.data?.session?.user?.id
    if (!teacherUid) return
    const ok = await saveTeacherNote(teacherUid, uid, week, note.trim(), score ? Number(score) : null, editNote ? editNote.id : null)
    setSaving(false)
    if (ok) {
      setSaved(true); setTimeout(() => setSaved(false), 2000)
      setNote(''); setScore('')
      onEditCancel && onEditCancel()
      onSaved && onSaved()
    }
  }

  // 快捷批注：一键填充评语+分数（教师可再手改）
  const quickNotes = [
    { label: '优秀', score: 95, text: '经营策略清晰，决策完成度高，口碑与利润双优，保持节奏。' },
    { label: '良好', score: 85, text: '整体经营稳健，定价与成本控制合理，差评处理再及时一些会更好。' },
    { label: '需改进', score: 70, text: '决策完成度不足，差评积压影响口碑——建议每周优先处理差评再优化定价。' },
    { label: '预警', score: 50, text: '资金/口碑存在明显风险，注意控成本、提完成度，及时复盘调整策略。' },
  ]
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warn)' }}>{editNote ? '正在编辑批注（保存后覆盖原批注）' : '教师批注 & 打分（不计入评分，供复盘参考）'}</span>
        {editNote && (
          <button onClick={() => { setEditNote(null); setNote(''); setScore('') }}
            style={{ border: 'none', background: 'none', fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>取消编辑</button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        {quickNotes.map(q => (
          <button key={q.label}
            onClick={() => { setNote(q.text); setScore(String(q.score)) }}
            style={{ border: '1px solid var(--warn-border)', background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit' }}
          >{q.label} {q.score}</button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder={'给 ' + name + ' 写评语...（如：定价策略合理，但差评处理偏慢）'}
        style={{ width: '100%', minHeight: 56, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
      />
      {note.replace(/\s/g, '').length > 200 && (
        <div style={{ fontSize: 10, color: 'var(--warn)', background: 'var(--warn-bg)', borderRadius: 6, padding: '4px 8px', marginTop: 4 }}>
          当前 {note.replace(/\s/g, '').length} 字——建议精简到 200 字内，聚焦最有价值的反馈
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
        <input
          type="number" min="0" max="100"
          value={score}
          onChange={e => setScore(e.target.value)}
          placeholder="0-100"
          style={{ width: 64, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit' }}
        />
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>分</span>
        <button
          onClick={save}
          disabled={saving || (!note.trim() && !score)}
          style={{ marginLeft: 'auto', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}
 >{saving ? '保存中...' : saved ? ' 已保存' : '保存批注'}</button>
      </div>
    </div>
  )
}

// ★ §32-U8-补 §2①：老师事件注入面板（一期 · 周粒度）
//   · 通道：class_state.injected_events（老师专属写 / 全班读 —— 学生端整包保存不会覆盖它）
//   · 公平红线 (a)：注入前对每个目标组调 校验注入合法性({注入周, 已结算周})，不合法**当场拦**（不等结算才发现）
//   · ★ §33-V8：支持「整周」或「指定第 D 天起」（生效日分段 · weekSegments 按天生效通道）；不承诺分钟级精度
function InjectionPanel({ rawStates, profiles, user, classDay = 0, classWeek = 0 }) {   // ★ V123-#1：classDay 必须传进来（line 716 用它算事件状态）
  const [库, set库] = useState(null)          // null=拉取中；[]=空
  const [通道就绪, set通道就绪] = useState(null)
  const [事件id, set事件id] = useState('E1')
  const [周, set周] = useState('')
  const [范围, set范围] = useState('all')      // all | groups
  const [选中, set选中] = useState({})         // groupKey -> true
  const [提示, set提示] = useState(null)       // {type:'ok'|'err', text}
  const [忙, set忙] = useState(false)
  // ★ §33-V8：类别筛/搜 + 按日触发 + 自定义编辑器状态
  const [类别筛, set类别筛] = useState('全部')
  const [搜索, set搜索] = useState('')
  const [生效日输入, set生效日输入] = useState('')   // 空 = 整周；1–7 = 第 D 天起
  const [编辑器开, set编辑器开] = useState(false)
  const [自定义表, set自定义表] = useState({ 图标: 'note.caliber', 标题: '', 正文: '', 类别: '钱', 教学点: '', 备注: '', 效力: [] })
  useEffect(() => {
    let 活 = true
    fetchClassState().then(cs => { if (!活) return; set库(Array.isArray(cs.injected_events) ? cs.injected_events : []); set通道就绪(!!cs.通道就绪) })
      .catch(() => { if (活) { set库([]); set通道就绪(false) } })
    return () => { 活 = false }
  }, [])
  // 组列表（从 profiles 聚合：group_key ↔ 成员 uid）
  const 组s = (() => {
    const m = new Map()
    for (const p of (profiles || [])) {
      if (!p || !p.group_no) continue
      const key = groupKeyOf(p.class_name, p.group_no)
      if (!m.has(key)) m.set(key, { key, label: `${p.class_name ? p.class_name + ' · ' : ''}第${p.group_no}组`, uids: [] })
      m.get(key).uids.push(p.user_id)
    }
    return [...m.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh'))
  })()
  // 每组进度：已结算周 = 该组各成员（存档 week − 1）的最大值（组档共享；取最靠前 = 最保守）
  const 进度Of = (key) => {
    const uids = key ? ((组s.find(g => g.key === key) || {}).uids || []) : (组s.flatMap(g => g.uids))
    let 最靠前已结算周 = -1, 有档 = 0
    for (const uid of uids) {
      const s = (rawStates.find(x => x.user_id === uid) || {}).state
      if (!s || !s.brand) continue
      有档++
      const done = Math.max(0, (Number(s.week) || 1) - 1)
      if (done > 最靠前已结算周) 最靠前已结算周 = done
    }
    return { 有档, 最靠前已结算周, 可注入周: 最靠前已结算周 + 1 }
  }
  const 全班进度 = 进度Of(null)
  const 建议周 = Math.max(1, 全班进度.可注入周)
  const 目标组s = 范围 === 'all' ? 组s.map(g => g.key) : Object.keys(选中).filter(k => 选中[k])
  const 周n = Number(周)
  const 逐组校验 = 目标组s.map(k => {
    const g = 组s.find(x => x.key === k) || { key: k, label: k }
    const p = 进度Of(k)
    const v = 校验注入合法性({ 注入周: 周n, 已结算周: p.最靠前已结算周 >= 0 ? p.最靠前已结算周 : null })
    return { ...g, ...p, 合法: v.合法, 原因: v.原因 || '' }
  })
  const 全部合法 = 目标组s.length > 0 && 周n >= 1 && 周n <= 12 && 逐组校验.every(x => x.合法)
  const 有档人数 = 全班进度.有档
  async function 注入(自定义定义 = null) {
    set提示(null)
    // ★ §33-V8：自定义事件（编辑器提交）与内置事件共用同一注入校验/通道/存储
    const 新事件 = 自定义定义
      ? 构建自定义事件({ 定义: 自定义定义, 周: 周n, 生效日: 生效日输入 ? Number(生效日输入) : null, injectedBy: user?.name || '老师', injectedAt: new Date().toISOString() })
      : 构建注入事件({ 事件id, 周: 周n, injectedBy: user?.name || '老师', injectedAt: new Date().toISOString() })
    if (!新事件) { set提示({ type: 'err', text: 自定义定义 ? '自定义事件缺标题/正文（必填）' : '事件或周号非法（周号需 1–12）' }); return }
    // ★ 按日程校验（公平红线 a · 天粒度）：生效日不得早于当前教学进度
    const 按日检 = 校验按日触发({ 注入周: 周n, 生效日: 生效日输入 ? Number(生效日输入) : null, 当前教学周: classWeek || 建议周, 当前dayIndex: 1 })
    if (!按日检.合法) { set提示({ type: 'err', text: `按日程校验未过：${按日检.原因}` }); return }
    if (!全部合法) { set提示({ type: 'err', text: '校验未通过：见下方逐组状态（注入周必须 > 该组已结算周）' }); return }
    const targets = 范围 === 'all' ? null : 目标组s
    // 去重：同事件 + 同周 + 目标重叠 ⇒ 拦（避免同周双卡；引擎按来源事件去重，但界面也不该重复注入）
    const 重叠 = (库 || []).some(x => x && x.来源事件 === 事件id && Number(x.week) === 周n && (x.targets == null || targets == null || x.targets.some(t => targets.includes(t))))
    if (重叠) { set提示({ type: 'err', text: `第 ${周n} 周已注入过「${事件id}」（目标重叠）—— 同一事件同周不重复注入（防双卡）` }); return }
    set忙(true)
    const ok = await setClassInjections([...(库 || []), { ...新事件, targets }], filterClass || undefined)
    set忙(false)
    if (ok) {
      set库(prev => [...(prev || []), { ...新事件, targets }])
 set提示({ type: 'ok', text: ` 已注入：${新事件.name.replace(/^[\u{1F4CC}]?\s*老师注入 · /u, '')} → 第 ${周n} 周 · ${范围 === 'all' ? '全班' : 目标组s.map(k => (组s.find(g => g.key === k) || {}).label || k).join('、')}（该周结算时生效）` })
    } else {
      set提示({ type: 'err', text: '写入失败：云端不可用或迁移未应用（见下方通道状态）' })
    }
  }
  async function 撤销(条目) {
    set提示(null)
    // 只影响未来：撤销同样要过校验（该周已在任何目标组结算过 ⇒ 不许删）
    const targets = Array.isArray(条目.targets) ? 条目.targets : null
    const 组kList = targets || 组s.map(g => g.key)
    const 有已结算 = 组kList.some(k => 校验注入合法性({ 注入周: Number(条目.week), 已结算周: 进度Of(k).最靠前已结算周 >= 0 ? 进度Of(k).最靠前已结算周 : null }).合法 === false)
    if (有已结算) { set提示({ type: 'err', text: `第 ${条目.week} 周已有目标组结算过 ⇒ 不再撤销（只影响未来）` }); return }
    const 新表 = (库 || []).filter(x => !(x && x.id === 条目.id))
    set忙(true)
    const ok = await setClassInjections(新表, filterClass || undefined)
    set忙(false)
    if (ok) { set库(新表); set提示({ type: 'ok', text: `已撤销：${条目.week} 周「${(条目.name || '').replace(/^[\u{1F4CC}]?\s*老师注入 · /u, '')}」` }) }
    else set提示({ type: 'err', text: '撤销失败：云端不可用' })
  }
  const 当前事件 = 注入事件库.find(e => e.id === 事件id) || {}
  return (
    <div>
      <div className="card">
        <div className="card-title">老师事件注入（内置 35 条 + 自定义 · 支持按日程）</div>
        <div style={{ fontSize: 11, color: 'var(--text-sub)', lineHeight: 1.7, marginBottom: 8 }}>
          选事件 × 选时间 × 选对象 ⇒ 写入全班通道 ⇒ 结算时生效。<br />
 §33-V8 支持按日程：<b>整周生效 或 指定「第 D 天」起</b>（生效日分段 · 前 3 天不带第 4 天起带）。<br />
 公平三红线：①只影响未来（注入前当场校验，不合法拦住）②全班同步（同一事件同天生效，不为离线组卡住全班）③离线补算按最差 + 周报显著标注。
        </div>
        {通道就绪 === false && (
          <div style={{ fontSize: 11, color: 'var(--bad)', background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', borderRadius: 8, padding: '6px 10px', marginBottom: 8 }}>
            注入通道未就绪（只读态）：需由老师在 Supabase 控制台 SQL Editor 粘贴执行 `supabase-migration-u8-class-events.sql`（约 1 分钟，执行后本面板自动就绪）。迁移未应用前无法写入/读取注入。
          </div>
        )}
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>① 选事件（内置 {注入事件库.length} 条 · 按类别筛 / 可搜 · 与既有随机事件有去重口径）</div>
 {/* §33-V8：类别筛 + 搜索（35 条不能平铺成一面墙） */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {['全部', '钱', '属性', '口碑', '人力', '运营', '监管'].map(c => (
            <button key={c} onClick={() => set类别筛(c)}
              style={{ fontSize: 10, fontWeight: 700, border: 'none', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', background: 类别筛 === c ? 'var(--primary)' : 'var(--fill)', color: 类别筛 === c ? '#fff' : 'var(--text-sub)' }}>{c}</button>
          ))}
        </div>
        <input value={搜索} onChange={e => set搜索(e.target.value)} placeholder="搜事件名/教学点…" 
          style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, marginBottom: 6 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10, maxHeight: 260, overflowY: 'auto' }}>
          {注入事件库
            .filter(e => 类别筛 === '全部' || e.类别 === 类别筛)
            .filter(e => !搜索 || (e.name + e.教学点 + e.影响).includes(搜索))
            .map(e => (
            <div key={e.id} onClick={() => set事件id(e.id)}
              style={{ padding: '7px 9px', borderRadius: 8, cursor: 'pointer', background: 事件id === e.id ? 'var(--warn-bg)' : 'var(--bg)', border: `1.5px solid ${事件id === e.id ? 'var(--primary)' : 'var(--fill)'}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}><Icon name={e.icon} size={13} /> {e.name.replace(/（.*?）/, '')}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>{e.影响}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-sub)', background: 'var(--bg)', borderRadius: 8, padding: '6px 9px', marginBottom: 10, lineHeight: 1.6 }}>
          <Icon name={当前事件.icon || 'note.caliber'} size={13} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> <b>{当前事件.name}</b> · {当前事件.类别} · 触发方式：{当前事件.触发方式 || '手动注入'} · 持续：{当前事件.持续周 || 1} 周（注入周单周生效）<br />描述：{当前事件.描述 || '—'}<br />影响：{当前事件.影响}<br />教学点：{当前事件.教学点}<br />学生应对：{当前事件.学生应对} · 去重：{当前事件.与随机事件去重}
        </div>
 <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>② 选时间（ §33-V8 支持按日程：整周 或 指定第 D 天起）</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
          <input value={周} onChange={e => set周(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} placeholder={`如 ${建议周}`} inputMode="numeric"
            style={{ width: 72, padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>周（1–12）· 建议：第 {建议周} 周</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
          <input value={生效日输入} onChange={e => set生效日输入(e.target.value.replace(/[^0-9]/g, '').slice(0, 1))} placeholder="整周" inputMode="numeric"
            style={{ width: 72, padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>生效日（周内第 D 天 · 2–7 · 留空 = 整周生效）· 按日程触发：第 D 天起分段生效</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10 }}>公平红线：只影响未来 —— 生效日早于当前教学进度的会被校验拦住</div>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>③ 选对象</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          {[['all', '全班'], ['groups', '指定组']].map(([k, l]) => (
            <button key={k} onClick={() => set范围(k)}
              style={{ fontSize: 11, fontWeight: 700, border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', background: 范围 === k ? 'var(--primary)' : 'var(--fill)', color: 范围 === k ? '#fff' : 'var(--text-sub)' }}>{l}</button>
          ))}
        </div>
        {范围 === 'groups' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {组s.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>（暂无已分组的组 —— 先在「分组管理」建组）</span>}
            {组s.map(g => (
              <div key={g.key} onClick={() => set选中(prev => ({ ...prev, [g.key]: !prev[g.key] }))}
                style={{ fontSize: 11, fontWeight: 600, borderRadius: 8, padding: '5px 10px', cursor: 'pointer', background: 选中[g.key] ? 'var(--warn-bg)' : 'var(--bg)', border: `1.5px solid ${选中[g.key] ? 'var(--primary)' : 'var(--fill)'}` }}>
 {选中[g.key] ? ' ' : ''}{g.label}
              </div>
            ))}
          </div>
        )}
        {(周n >= 1 && 目标组s.length > 0) && (
          <div style={{ fontSize: 11, background: 'var(--bg)', borderRadius: 8, padding: '7px 10px', marginBottom: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 3 }}>注入前校验（只影响未来 · 逐组当面拦）：</div>
            {逐组校验.map(x => (
              <div key={x.key} style={{ color: x.合法 ? 'var(--good)' : 'var(--bad)' }}>
 {x.合法 ? '' : ''} {x.label}：{x.有档 ? `已结算到第 ${x.最靠前已结算周} 周` : '暂无开业存档'} {x.合法 ? `（可注入第 ${周n} 周）` : `—— ${x.原因}`}
              </div>
            ))}
            {有档人数 === 0 && <div style={{ color: 'var(--text-muted)' }}>（全班暂无开业存档：注入后各组开业到该周时照常生效）</div>}
          </div>
        )}
        <button className="btn btn-primary" disabled={忙 || !全部合法 || !通道就绪} onClick={() => 注入()} style={{ width: '100%', padding: '11px 0', opacity: (忙 || !全部合法 || !通道就绪) ? 0.5 : 1 }}>
          {忙 ? '写入中…' : 全部合法 ? `注入内置事件到第 ${周n} 周${生效日输入 ? `第 ${生效日输入} 天起` : ''}${范围 === 'all' ? '（全班）' : `（${目标组s.length} 组）`}` : '注入（先通过校验/选目标/填周号 1–12）'}
        </button>
        {提示 && (
          <div style={{ fontSize: 11, marginTop: 8, color: 提示.type === 'ok' ? 'var(--good)' : 'var(--bad)', background: 提示.type === 'ok' ? 'var(--good-bg)' : 'var(--bad-bg)', borderRadius: 8, padding: '6px 10px', lineHeight: 1.6 }}>{提示.text}</div>
        )}
 {/* §33-V8 §1①②：自定义事件编辑器（正文 + 受控效力面板 · 不许公式） */}
        <div style={{ borderTop: '1px dashed var(--border)', margin: '14px 0 10px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>自定义突发事件（老师自己写 · 走同一生效通道）</div>
          <button onClick={() => set编辑器开(!编辑器开)}
            style={{ fontSize: 10, fontWeight: 700, border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', background: 编辑器开 ? 'var(--primary)' : 'var(--fill)', color: 编辑器开 ? '#fff' : 'var(--text-sub)' }}>{编辑器开 ? '收起' : '新建'}</button>
        </div>
        {编辑器开 && (
          <div style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: 10, padding: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input value={自定义表.图标} onChange={e => set自定义表(t => ({ ...t, 图标: e.target.value.slice(0, 2) }))} placeholder="图标"
                style={{ width: 52, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, textAlign: 'center' }} />
              <input value={自定义表.标题} onChange={e => set自定义表(t => ({ ...t, 标题: e.target.value.slice(0, 24) }))} placeholder="标题（必填 · 如：周边道路施工）"
                style={{ flex: 1, padding: '6px 9px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} />
            </div>
            <textarea value={自定义表.正文} onChange={e => set自定义表(t => ({ ...t, 正文: e.target.value.slice(0, 160) }))} rows={2}
              placeholder="正文（必填 · 写给学生的话 · 与酒店经营有关 · 160 字内）"
              style={{ width: '100%', padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, marginBottom: 6, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            <input value={自定义表.教学点} onChange={e => set自定义表(t => ({ ...t, 教学点: e.target.value.slice(0, 60) }))} placeholder="教学点（你想让学生明白什么 · 复盘用）"
              style={{ width: '100%', padding: '6px 9px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, marginBottom: 6 }} />
            <input value={自定义表.备注} onChange={e => set自定义表(t => ({ ...t, 备注: e.target.value.slice(0, 60) }))} placeholder="备注（仅老师可见 · 可空）"
              style={{ width: '100%', padding: '6px 9px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, marginBottom: 8 }} />
            {/* 受控效力面板：维度白名单 × 三档 · 不许自由写数值 */}
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>效力（选 0–3 个维度 · 留空 = 纯叙事事件 · 只显示不改数字）</div>
            {效力维度.map(d => {
              const sel = 自定义表.效力.find(x => x.维度key === d.key)
              return (
                <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--fill)' }}>
                  <span style={{ fontSize: 11, flex: 1 }}>{d.名称}{d.带方向 ? '（可升/降）' : ''}</span>
                  {!sel && <button onClick={() => set自定义表(t => ({ ...t, 效力: [...t.效力, { 维度key: d.key, 方向: '升', 档位: '小' }].slice(-3) }))}
                    style={{ fontSize: 10, border: 'none', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', background: 'var(--fill)', color: 'var(--text-sub)' }}>+ 加</button>}
                  {sel && (
                    <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      {d.带方向 && ['升', '降'].map(f => (
                        <button key={f} onClick={() => set自定义表(t => ({ ...t, 效力: t.效力.map(x => x.维度key === d.key ? { ...x, 方向: f } : x) }))}
                          style={{ fontSize: 10, border: 'none', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', background: (sel.方向 || '升') === f ? 'var(--primary)' : 'var(--fill)', color: (sel.方向 || '升') === f ? '#fff' : 'var(--text-sub)' }}>{f}</button>
                      ))}
                      {['小', '中', '大'].map(g => (
                        <button key={g} onClick={() => set自定义表(t => ({ ...t, 效力: t.效力.map(x => x.维度key === d.key ? { ...x, 档位: g } : x) }))}
                          style={{ fontSize: 10, border: 'none', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', background: sel.档位 === g ? 'var(--primary)' : 'var(--fill)', color: sel.档位 === g ? '#fff' : 'var(--text-sub)' }}>{g}</button>
                      ))}
                      <button onClick={() => set自定义表(t => ({ ...t, 效力: t.效力.filter(x => x.维度key !== d.key) }))}
                        style={{ fontSize: 10, border: 'none', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', background: 'var(--bad-bg)', color: 'var(--bad)' }}>×</button>
                    </span>
                  )}
                </div>
              )
            })}
            <div style={{ fontSize: 10, color: 'var(--text-muted)', margin: '6px 0' }}>
 不许自由写数值（受控档位保证公平与可复跑）· 事件与内置库走同一生效通道（按日程触发 · 补算一致）
            </div>
            <button className="btn btn-primary" disabled={忙 || !自定义表.标题 || !自定义表.正文 || !周n || !通道就绪}
              onClick={() => { 注入({ ...自定义表 }); set编辑器开(false); set自定义表({ 图标: 'note.caliber', 标题: '', 正文: '', 类别: '钱', 教学点: '', 备注: '', 效力: [] }) }}
              style={{ width: '100%', padding: '10px 0', opacity: (忙 || !自定义表.标题 || !自定义表.正文 || !周n || !通道就绪) ? 0.5 : 1 }}>
              注入自定义事件到第 {周n || '?'} 周{生效日输入 ? `第 ${生效日输入} 天起` : ''}
            </button>
          </div>
        )}
      </div>
      <div className="card">
        <div className="card-title">已注入事件（全班通道 · 老师可查 / 学生周报可见）</div>
        {库 === null && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>加载中…</div>}
        {库 && 库.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>暂无注入记录。</div>}
        {(库 || []).slice().sort((a, b) => Number(b.week) - Number(a.week)).map(x => {
          // ★ §33-V7-0.5③：状态标签（待生效/已生效/已过期）—— 按当前教学周 vs 事件周（服务端 classDay 权威）
          const 状态 = (classDay > 0 && Number(x.week) < Math.ceil(classDay / 7)) ? { 字: '已过期', 色: 'var(--text-muted)', 底: 'var(--bg)' }
            : (classDay > 0 && Number(x.week) === Math.ceil(classDay / 7)) ? { 字: '已生效（本周）', 色: 'var(--good)', 底: 'var(--good-bg)' }
            : { 字: '待生效', 色: 'var(--warn)', 底: 'var(--warn-bg)' }
          return (
          <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700 }}><Icon name={x.icon || 'note.caliber'} size={13} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> 第 {x.week} 周{x.生效日 ? ` 第 ${x.生效日} 天起` : ''} · {(x.name || '').replace(/^[\u{1F4CC}]?\s*老师注入 · /u, '')}
                <span style={{ fontSize: 9, fontWeight: 700, color: 状态.色, background: 状态.底, borderRadius: 5, padding: '1px 6px', marginLeft: 6 }}>{状态.字}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{Array.isArray(x.targets) && x.targets.length ? `指定组：${x.targets.join('、')}` : '全班'} · 注入人 {x.injectedBy || '?'} · {String(x.injectedAt || '').slice(0, 16).replace('T', ' ')}</div>
            </div>
            <button onClick={() => 撤销(x)} disabled={忙} style={{ fontSize: 10, fontWeight: 700, border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', background: 'var(--bad-bg)', color: 'var(--bad)' }}>撤销</button>
          </div>
          )
        })}
        <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>撤销同样遵守「只影响未来」：该周一旦有目标组结算过 ⇒ 不再可撤。</div>
      </div>
    </div>
  )
}

// ★ §32-U8-补 §2④：AI 领班全班默认授权页（老师端）
//   · 写 class_state.supervisor_auth（全班统一默认 —— 学生只能在此之上收窄/放宽，B3 §一.3）
//   · 默认全关 = 全班行为一致 = 公平基准；★ §33-V3 二期 = R3/R6 代管真执行（学生决策优先 · R1/R2 不开放原因写明）
function SupervisorPanel({ rawStates, profiles }) {
  const [auth, setAuth] = useState(null)
  const [就绪, set就绪] = useState(null)
  const [保留, set保留] = useState(null)
  const [忙, set忙] = useState(false)
  useEffect(() => {
    let 活 = true
    fetchClassState().then(cs => { if (!活) return; setAuth(cs.supervisor_auth || null); set就绪(!!cs.通道就绪) })
      .catch(() => { if (活) set就绪(false) })
    return () => { 活 = false }
  }, [])
  const 开 = (k) => !!(auth && auth[k] && auth[k].ok)
  async function 切(k) {
    set保留(null)
    const 新 = { ...(auth || {}) }
    if (开(k)) delete 新[k]
    else 新[k] = { ok: true }
    set忙(true)
    const ok = await setClassSupervisorAuth(Object.keys(新).length ? 新 : null, filterClass || undefined)
    set忙(false)
    if (ok) { setAuth(Object.keys(新).length ? 新 : null); set保留(`已更新全班默认授权（${Object.keys(新).length ? Object.keys(新).join('、') : '全部关闭'}）—— 学生端下次结算生效`) }
    else set保留('写入失败：云端不可用或迁移未应用')
  }
  // 代管巡览：各组最近一周的 supervisorRecord（学生结算后产生）
  const 最近 = (profiles || []).filter(p => p.role === 'student').map(p => {
    const gs = rawStates.find(x => x.user_id === p.user_id)
    const hist = (gs && gs.state && gs.state.history) || []
    const last = hist.length ? hist[hist.length - 1] : null
    const rec = last && last.supervisorRecord
    return { name: p.display_name || p.user_id.slice(0, 6), week: last && last.week, n: rec ? (rec.actions.length + rec.reports.length) : 0, 代管率: rec && rec.代管率 != null ? rec.代管率 : null }
  }).filter(x => x.n > 0 || x.代管率 != null)
  const 规则说明 = (领班规则 || []).map(r => r.说明).filter(Boolean)
  return (
    <div>
      <div className="card">
        <div className="card-title">AI 领班 · 全班默认授权</div>
        <div style={{ fontSize: 11, color: 'var(--text-sub)', lineHeight: 1.7, marginBottom: 8 }}>
          领班 = 学生不在时的「看不见的手」：按你授权的范围代管决策，并留痕可复盘。<br />
          <b>二期：R3（超售止损）/ R6（能耗回归）的代管动作已真实生效</b>（并入学生决策集 · 学生自己做过的项领班不碰）；
          R1/R2（调价）需竞对价每日数据，二期暂不开放。<b>默认全关 = 全班行为一致 = 公平基准</b>（B3 设计）。
          学生可在周报的复盘卡里在默认之上收窄/放宽自己的。
        </div>
        {就绪 === false && (
          <div style={{ fontSize: 11, color: 'var(--bad)', background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', borderRadius: 8, padding: '6px 10px', marginBottom: 8 }}>
 通道未就绪（需执行 `supabase-migration-u8-class-events.sql`）。
          </div>
        )}
        {[['price_adj', '调价幅度（领班可在 ±10% 内调价）'], ['overbook', '超售清零止损'], ['energy', '客房温度回归 23℃']].map(([k, l]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 2px', borderBottom: '1px solid var(--fill)' }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{l}<div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>授权键：{k} · 默认：{默认授权[k] ? '开' : '关'}</div></div>
            <button onClick={() => 切(k)} disabled={忙}
              style={{ fontSize: 11, fontWeight: 700, border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', background: 开(k) ? 'var(--good)' : 'var(--fill)', color: 开(k) ? '#fff' : 'var(--text-sub)' }}>
              {开(k) ? '已授权（点按关闭）' : '未授权（点按开启）'}
            </button>
          </div>
        ))}
        {保留 && <div style={{ fontSize: 11, marginTop: 8, color: 保留.startsWith('已更新') ? 'var(--good)' : 'var(--bad)', background: 保留.startsWith('已更新') ? 'var(--good-bg)' : 'var(--bad-bg)', borderRadius: 8, padding: '6px 10px' }}>{保留}</div>}
      </div>
      <div className="card">
        <div className="card-title">规则集（一期 4 条 · 与 aiSupervisor.mjs 单源）</div>
        {规则说明.map((t, i) => (
          <div key={i} style={{ fontSize: 11, color: 'var(--text)', padding: '6px 9px', background: 'var(--bg)', borderRadius: 8, marginBottom: 5, lineHeight: 1.6 }}>{t}</div>
        ))}
        <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>代管不享受职务加成 ×1.3（那是对岗真人的激励 —— 无双重加成，有守门断言）。</div>
      </div>
      <div className="card">
        <div className="card-title">代管巡览（各组最近一周 · 结算后生成）</div>
        {最近.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>暂无代管记录（学生结算后出现；当前默认全关 ⇒ 主要是"仅报告"条目）。</div>}
        {最近.slice(0, 20).map((x, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 2px', borderBottom: '1px solid var(--fill)' }}>
            <span>{x.name}</span>
            <span style={{ color: 'var(--text-sub)' }}>第 {x.week} 周 · 条目 {x.n}{x.代管率 != null ? ` · 代管率 ${Math.round(x.代管率 * 100)}%` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ★ V171 · 课堂预警面板（§1 卡点面板 + §2 节奏卡 + §3 告警历史 · 只读 · 阈值集中 classAlerts.mjs）
function ClassAlertsPanel({ rawStates, 组名映射, dayIndex, 当前周, onGoGroup }) {
  const alerts = 课堂告警({ groups: (rawStates || []).map(gs => ({ uid: gs.user_id || gs.uid, 组名: 组名映射[gs.user_id || gs.uid], state: gs.state, updated_at: gs.updated_at })), dayIndex, 当前周 })
  const 节 = 课堂节奏({ groups: (rawStates || []).map(gs => ({ state: gs.state })), dayIndex, 当前周 })
  const [历史, set历史] = useState(() => { try { return JSON.parse(localStorage.getItem('hotel-sim-alert-log') || '[]') } catch (e) { return [] } })
  const [展开, set展开] = useState(false)
  useEffect(() => {
    // 告警历史：同 组+规则+周 只记一次（追加 ≤ 200 行 · 只写本机 · 不写业务表）
    if (!alerts.length) return
    try {
      const 旧 = JSON.parse(localStorage.getItem('hotel-sim-alert-log') || '[]')
      const 新 = [...旧]
      for (const a of alerts) {
        const 键 = a.组名 + '|' + a.id + '|' + 当前周
        if (!新.some(x => x.键 === 键)) 新.push({ 键, 组: a.组名, 规则: a.规则, 时间: new Date().toLocaleString('zh-CN', { hour12: false }) })
      }
      const 裁 = 新.slice(-200)
      localStorage.setItem('hotel-sim-alert-log', JSON.stringify(裁))
      set历史(裁)
    } catch (e) { /* 静默理由：历史留档失败不影响当次告警显示 */ }
  }, [alerts.length, 当前周])
  return (
    <div data-class-alerts className="card" style={{ margin: '0 20px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>课堂预警（第 {节.周} 周 · 第 {节.天}/{节.总天数} 天 · 已决策组 {节.已决策组数}/{节.总组数} · 距结算还需 {节.距结算还需} 组达标）</div>
        <button data-alert-log-toggle onClick={() => set展开(!展开)} style={{ minHeight: 44, border: '1px solid var(--border-strong)', background: 'var(--card)', fontSize: 12, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>告警历史</button>
      </div>
      {alerts.length === 0
        ? <div style={{ fontSize: 12, color: 'var(--good)', marginTop: 6 }}>✓ 六组状态正常</div>
        : <div style={{ marginTop: 6 }}>
            {alerts.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 0', borderTop: i ? '1px dashed var(--border)' : 'none' }}>
                <b style={{ color: 'var(--warn)' }}>{a.组名}</b>
                <span style={{ color: 'var(--bad)', fontWeight: 600 }}>{a.规则}</span>
                <details style={{ flex: 1 }}><summary style={{ cursor: 'pointer', color: 'var(--text-sub)' }}>{a.详情}</summary><div style={{ color: 'var(--text-muted)', fontSize: 11 }}>依据：{a.依据}</div></details>
                {/* ★ V179（2026-11-05 审查端）：390 视口触控目标 ≥44px（原 minHeight:30 ⇒ ui-smoke 实测红） */}
                <button onClick={() => onGoGroup && onGoGroup(a.uid)} style={{ minHeight: 44, minWidth: 44, padding: '0 10px', border: '1px solid var(--border-strong)', background: 'var(--card)', fontSize: 12, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>去看看</button>
              </div>
            ))}
          </div>}
      {展开 && (
        <div data-alert-log style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)', maxHeight: 220, overflow: 'auto' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>告警历史（本周谁被记过 · 只读 · 最多 200 行 · 只存本机不写业务表）</div>
          {历史.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>（暂无）</div>}
          {历史.slice().reverse().map((h, i) => <div key={i} style={{ fontSize: 11, padding: '2px 0' }}>{h.时间} · {h.组} · {h.规则}</div>)}
        </div>
      )}
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>阈值与规则集中在 src/classAlerts.mjs（老师可调）；本面板只读，不改学生数据。</div>
    </div>
  )
}

// ★ V165 · 班级管理面板（§1 建班向导 / §2 学生导入 / §3 开课控制 + 周次回退审计）
function ClassAdminPanel({ filterClass, setFilterClass, user, 班级学期状态, 当前周, onCreated, 备用班 }) {
  const [班列表, set班列表] = useState([])
  const [新班名, set新班名] = useState('')
  const [起始日期, set起始日期] = useState(() => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d.toISOString().slice(0, 10) })
  const [建班错, set建班错] = useState('')
  const [建班中, set建班中] = useState(false)
  const [粘贴, set粘贴] = useState('')
  const [预览, set预览] = useState(null)
  const [导入结果, set导入结果] = useState(null)
  const [导入中, set导入中] = useState(false)
  const [状态错, set状态错] = useState('')

  const 载班 = async () => { const l = await fetchAllClasses(); set班列表(l || []) }
  useEffect(() => { let 活 = true; if (活) 载班(); return () => { 活 = false } }, [])

  // §1 建班（重名查库 + 非法字符行内提示 + 防双击）
  const 建班 = async () => {
    if (建班中) return   // 防双击：提交中禁用
    const v = 校验班级名(新班名)
    if (!v.ok) { set建班错(v.error); return }
    if ((班列表 || []).some(c => c.class_code === v.名)) { set建班错(`该班级已存在（${v.名}）`); return }
    set建班中(true); set建班错('')
    const r = await createClass(v.名)
    set建班中(false)
    if (!r.ok) { set建班错(r.error || '建班失败'); return }
    set新班名(''); await 载班(); if (onCreated) onCreated()
  }

  // §2 预览（已存在学号 ⇒ 查 profiles.student_no 标"已存在"；格式错行标红；默认每 6 人一组）
  const 做预览 = async () => {
    const rows = 预览分组(解析花名册(粘贴))
    const 学号s = rows.filter(r => !r.错误).map(r => r.学号)
    let 存在 = new Set()
    if (学号s.length && filterClass) {
      const { data } = await supabase.from('profiles').select('*').eq('role', 'student').in('student_no', 学号s)
      存在 = new Set((data || []).map(d => d.student_no))
    }
    set预览(rows.map(r => r.错误 ? r : { ...r, 状态: 存在.has(r.学号) ? '已存在（跳过）' : '新建', 组号: r.组号 ?? null }))
  }
  const 确认导入 = async () => {
    if (导入中 || !预览 || !filterClass) return
    set导入中(true)
    const 结果 = []
    for (const r of 预览.filter(x => !x.错误)) {
      if (r.状态 === '已存在（跳过）') { 结果.push({ ...r, 口令: String(r.学号).slice(-6).padStart(6, '0'), 结果: '已存在 · 跳过（不覆盖密码与进度）' }); continue }
      const rr = await signUpStudent(r.学号, r.姓名, filterClass, r.组号 ?? null)
      结果.push({ ...r, 口令: String(r.学号).slice(-6).padStart(6, '0'), 结果: rr.exists ? '已存在 · 跳过（不覆盖密码与进度）' : rr.ok ? '新建成功' : `失败：${rr.error || ''}` })
    }
    set导入中(false)
    set导入结果(结果)
    await 做预览()   // 重查重（幂等验证：再导同名单 ⇒ 全部"已存在"）
  }
  const 导结果CSV = () => {
    if (!导入结果) return
    const 行 = [['学号', '姓名', '组号', '口令', '结果'], ...导入结果.map(r => [r.学号, r.姓名 || '', r.组号 ?? '', r.口令, r.结果])]
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF' + 行.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })); a.download = `导入结果-${filterClass}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href)
  }

  // §3 开课控制（paused 语义 + 结课归档走 V157/V163 既有链路）
  const 置状态 = async (s) => {
    const ok2 = await setSemesterStatus(s, filterClass || undefined)
    if (!ok2) set状态错(`置 ${s} 失败（迁移未应用或权限不足）`)
    else set状态错('')
    return ok2
  }
  // 周次只进不退：回退需二次确认 + 审计（操作人/原值/新值/时间 → decision_logs 单源键）
  const 调周 = async (新周) => {
    if (新周 > 当前周) return setClassWeek(新周, filterClass || undefined)
    if (!window.confirm(`回退周次：${当前周} → ${新周}（只进不退 · 回退将留审计记录）。确定？`)) return false
    const ok2 = await setClassWeek(新周, filterClass || undefined)
    if (ok2) await saveDecisionLog({ userId: user?.id || null, groupKey: null, week: 当前周, decisionId: 回退审计键, answer: JSON.stringify({ 操作人: user?.name || '教师', 班级: filterClass || '—', 原值: 当前周, 新值: 新周, 时间: new Date().toISOString() }), feedback: '周次回退审计' })
    return ok2
  }

  const 新建数 = (预览 || []).filter(r => r.状态 === '新建').length
  const 跳过数 = (预览 || []).filter(r => r.状态 && r.状态 !== '新建').length
  const 徽景色 = { draft: 'var(--text-muted)', running: 'var(--good)', paused: 'var(--warn)', finished: 'var(--info)', archived: 'var(--text-muted)' }
  // ★ T3：当前选中的班若不在 fetchAllClasses 列表里（如正在运行的彩排班被 V167 隐藏），把它补进标签条，
  //   否则教师点走之后再点不回来。只影响本面板的显示，不改 V167 的隐藏契约。
  const 班们 = (() => {
    const base = 班列表 || []
    if (!备用班 || !备用班.class_code) return base
    return base.some(c => c.class_code === 备用班.class_code) ? base : [...base, 备用班]
  })()
  return (
    <div data-class-admin-panel className="card" style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>班级管理（建班 / 导入 / 开课控制）</div>
      {/* 班级切换器（常显 · 教师端专属） */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        <button className={`city-tab ${filterClass === '' ? 'active' : ''}`} onClick={() => setFilterClass('')}>全部班级</button>
        {班们.map(c => <button key={c.class_code} className={`city-tab ${filterClass === c.class_code ? 'active' : ''}`} onClick={() => setFilterClass(c.class_code)}>{c.class_code}{c.semester_status ? `·${c.semester_status}` : ''}{`·第${c.current_week ?? 0}周`}</button>)}
      </div>
      {/* ★ V177§3：本班进度（一班一行 · 与服务端 tick 同一日历口径） */}
      {filterClass && (() => {
        const c = 班们.find(x => x.class_code === filterClass)
        return <div data-class-progress style={{ marginTop: 6, fontSize: 11, color: 'var(--text-sub)' }}>
          本班：<b>{filterClass}</b> · {班徽标(c)} · 学期 {c?.semester_status || '—'}
        </div>
      })()}
      {/* §1 建班向导 */}
      <div data-create-class-form style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>＋ 新建班级</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
          <input data-new-class-name value={新班名} onChange={e => { set新班名(e.target.value); set建班错('') }} placeholder="班级名（如 酒管2402）" style={{ width: 160, minHeight: 36, border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 12, padding: '0 8px', fontFamily: 'inherit' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>起始日期</span>
          <input type="date" value={起始日期} onChange={e => set起始日期(e.target.value)} style={{ minHeight: 36, border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 12, padding: '0 8px', fontFamily: 'inherit' }} />
          <button data-create-class onClick={建班} disabled={建班中} style={{ minHeight: 36, border: 'none', background: 建班中 ? 'var(--border)' : 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 600, borderRadius: 8, padding: '0 14px', cursor: 建班中 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{建班中 ? '创建中…' : '新建班级（draft）'}</button>
        </div>
        {建班错 && <div data-create-class-error style={{ color: 'var(--bad)', fontSize: 11, marginTop: 4 }}>{建班错}</div>}
      </div>
      {/* §2 学生导入（选中班才可用） */}
      <div data-import-students style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>导入学生（粘贴式 · 每行 `学号 姓名` · 默认口令 = 学号后 6 位）</div>
        {!filterClass && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>先在上面选中一个班级（不能导到"全部班级"）。</div>}
        {filterClass && <>
          <textarea data-import-text value={粘贴} onChange={e => set粘贴(e.target.value)} rows={4} placeholder={'20240201 张三\n20240202 李四\n…（每行一个学号，姓名可省）'} style={{ width: '100%', marginTop: 6, border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 12, padding: 8, fontFamily: 'inherit' }} />
          <button data-import-preview onClick={做预览} disabled={!粘贴.trim()} style={{ marginTop: 6, minHeight: 44, minWidth: 44, border: '1px solid var(--border-strong)', background: 'var(--card)', fontSize: 12, borderRadius: 8, padding: '0 12px', cursor: 'pointer', fontFamily: 'inherit' }}>生成预览</button>
          {预览 && <div data-import-preview-table style={{ marginTop: 6, maxHeight: 180, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead><tr>{['学号', '姓名', '组号', '状态'].map(h => <th key={h} style={{ borderBottom: '1px solid var(--border)', padding: '3px 6px', textAlign: 'left' }}>{h}</th>)}</tr></thead>
              <tbody>{预览.map((r, i) => (
                <tr key={i} style={{ color: r.错误 ? 'var(--bad)' : 'inherit' }}>
                  <td style={{ padding: '2px 6px' }}>{r.学号 || '—'}</td><td style={{ padding: '2px 6px' }}>{r.姓名 || '—'}</td><td style={{ padding: '2px 6px' }}>{r.组号 ?? '（自动）'}</td>
                  <td style={{ padding: '2px 6px' }}>{r.错误 ? `格式错：${r.错误}` : r.状态}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>}
          {预览 && <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
            <button data-import-confirm onClick={确认导入} disabled={导入中 || !预览.some(r => !r.错误)} style={{ minHeight: 36, border: 'none', background: 导入中 ? 'var(--border)' : 'var(--good)', color: '#fff', fontSize: 12, fontWeight: 600, borderRadius: 8, padding: '0 12px', cursor: 导入中 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{导入中 ? '导入中…' : `确认导入（新建 ${新建数} 人 · 跳过 ${跳过数} 人）`}</button>
            {导入结果 && <>
              <button data-import-copy onClick={() => { navigator.clipboard.writeText(口令清单(导入结果)).catch(() => {}) /* 静默理由：剪贴板权限被拒不影响清单已显示与 CSV 导出 */ }} style={{ minHeight: 36, border: '1px solid var(--border-strong)', background: 'var(--card)', fontSize: 11, borderRadius: 8, padding: '0 10px', cursor: 'pointer', fontFamily: 'inherit' }}>复制口令清单</button>
              <button data-import-csv onClick={导结果CSV} style={{ minHeight: 36, border: '1px solid var(--border-strong)', background: 'var(--card)', fontSize: 11, borderRadius: 8, padding: '0 10px', cursor: 'pointer', fontFamily: 'inherit' }}>导出结果 CSV</button>
            </>}
          </div>}
          {导入结果 && <div data-import-result style={{ fontSize: 11, marginTop: 4, color: 'var(--text-muted)' }}>新建 {导入结果.filter(r => r.结果 === '新建成功').length} · 跳过 {导入结果.filter(r => /跳过/.test(r.结果)).length} · 失败 {导入结果.filter(r => /失败/.test(r.结果)).length}{导入中 ? '' : '（再导同名单应全部「已存在」—— 幂等）'}</div>}
        </>}
      </div>
      {/* §3 开课控制（常驻卡 · 选中班才可用） */}
      <div data-class-lifecycle-admin style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>开课与推进控制　当前：<b style={{ color: 徽景色[班级学期状态] || 'var(--text-muted)' }}>{班级学期状态 || '—'}</b> · 第 {当前周} 周</div>
        {!filterClass && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>选中具体班级后可操作（"全部班级"只读）。</div>}
        {filterClass && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {班级学期状态 === 'draft' && <button data-state-run onClick={() => 置状态('running')} style={{ minHeight: 38, border: 'none', background: 'var(--good)', color: '#fff', fontSize: 12, fontWeight: 600, borderRadius: 8, padding: '0 12px', cursor: 'pointer', fontFamily: 'inherit' }}>开课（draft → running）</button>}
          {班级学期状态 === 'running' && <button data-state-pause onClick={() => 置状态('paused')} style={{ minHeight: 38, border: '1px solid var(--warn)', background: 'var(--card)', color: 'var(--warn)', fontSize: 12, borderRadius: 8, padding: '0 12px', cursor: 'pointer', fontFamily: 'inherit' }}>暂停（running → paused）</button>}
          {班级学期状态 === 'paused' && <button data-state-resume onClick={() => 置状态('running')} style={{ minHeight: 38, border: 'none', background: 'var(--good)', color: '#fff', fontSize: 12, borderRadius: 8, padding: '0 12px', cursor: 'pointer', fontFamily: 'inherit' }}>继续（paused → running）</button>}
          {(班级学期状态 === 'running' || 班级学期状态 === 'paused') && <button data-state-finish onClick={() => 置状态('finished')} style={{ minHeight: 38, border: '1px solid var(--border-strong)', background: 'var(--card)', fontSize: 12, borderRadius: 8, padding: '0 12px', cursor: 'pointer', fontFamily: 'inherit' }}>结课归档（→ finished · 快照走「我的 → 学期生命周期」）</button>}
          {班级学期状态 === 'finished' && <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>已结课——「归档（archived）」在「我的 → 学期生命周期 / 一键收口」。</span>}
        </div>}
        {状态错 && <div style={{ fontSize: 11, color: 'var(--bad)', marginTop: 4 }}>{状态错}</div>}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.7 }}>
          学生端文案（四态说人话）：draft「{STUDENT_STATE_COPY.draft}」· paused「{STUDENT_STATE_COPY.paused}」· finished「{STUDENT_STATE_COPY.finished}」· archived「{STUDENT_STATE_COPY.archived}」。<br />
          周次只进不退：回退需二次确认并留审计记录（操作人/原值/新值/时间 → decision_logs「{回退审计键}」）。教学进度控制卡里回退已走该闸。
        </div>
      </div>
    </div>
  )
}

// ★ V164 · 学期教学复盘覆盖层（只读 · 每次渲染现算 ⇒ 改库必跟着变 · 判据④）
//   A4 竖版一页（@media print 隐藏其余 · 字号 ≥10pt）· 归因用 <details> 展开字段来源 · 建议规则驱动零网络
function SemesterReviewOverlay({ rows, 组数据, 班级学期状态, filterClass, onClose }) {
  const [归档, set归档] = useState(null)
  const [校验果, set校验果] = useState(null)
  useEffect(() => {
    let 活 = true
    fetchSemesterCloseout(filterClass || undefined).then(async ({ row }) => {
      if (!活) return
      if (!row) { set归档({ 状态: '（无服务端归档记录）' }); return }
      const v = await 校验冷备(row.files || {}, sha256Hex)
      set归档({ 状态: row.semester_status || '—', 学期: row.label || '（未标学期）', 文件: Object.keys(row.files || {}).join('、') || '（无清单）' })
      set校验果(v)
    }).catch(() => { if (活) set归档({ 状态: '（归档记录不可读）' }) })
    return () => { 活 = false }
  }, [filterClass])
  const 报告 = 复盘报告({ rows, 组数据 })   // 每次渲染现算（不写库不缓存）
  const 建议 = 教学建议({ rows, 未决策: 报告.未决策 })
  const 导出复盘CSV = () => {
    const 行 = [['段', '组号', '指标', '数值', '来源']]
    for (const m of 报告.指标并排) for (const k of ['累计营收', '经营净利', '净利率', '平均出租率', '平均好评率', '差评处理率', '期末资金']) 行.push(['指标并排', m.组号, k, m[k] ?? '', m.来源])
    for (const e of 报告.极值) 行.push(['极值', '—', e.指标, `最好${e.最好组} / 最差${e.最差组} / 差距${e.差距}`, e.来源])
    报告.归因.forEach((a, i) => 行.push(['归因' + (i + 1), '—', a.文案, '', a.来源]))
    for (const u of 报告.未决策) 行.push(['未决策', u.组号, '未决策周数/最长连续', `${u.周数}/${u.最长连续}`, u.来源])
    for (const p of 报告.画像) 行.push(['决策画像', p.组号, '改动次数/最常改/未决策周', `${p.改动次数}/${p.最常改}/${p.未决策周数}`, p.改动口径])
    for (const b of 建议.建议) 行.push(['教学建议', '—', typeof b === 'string' ? b : `${b.规则} ${b.文本}`, typeof b === 'object' ? b.命中 : '', '规则表驱动（零网络）'])
    const csv = '\uFEFF' + 行.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `学期复盘明细-${filterClass || '全班'}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href)
  }
  const fmt元 = v => v == null ? '—' : Math.round(v).toLocaleString() + ' 元'
  const fmt率 = v => v == null ? '—' : Number(v).toFixed(1) + '%'
  const fmt率01 = v => v == null ? '—' : (v * 100).toFixed(1) + '%'
  return (
    <div data-review-overlay className="review-print" style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 300, overflow: 'auto', padding: '20px 24px', color: '#111', fontFamily: 'inherit' }}>
      <style>{`@media print { body > *:not(.review-print) { display: none !important } .review-print { position: static !important; overflow: visible !important; padding: 0 !important } .no-print { display: none !important } .review-print table { page-break-inside: avoid } }`}</style>
      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => window.print()} style={{ minHeight: 40, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 600, borderRadius: 8, padding: '0 14px', cursor: 'pointer', fontFamily: 'inherit' }}>打印（A4 竖版一页）</button>
        <button data-review-csv onClick={导出复盘CSV} style={{ minHeight: 40, border: '1px solid var(--border-strong)', background: 'var(--card)', color: 'var(--info)', fontSize: 12, borderRadius: 8, padding: '0 14px', cursor: 'pointer', fontFamily: 'inherit' }}>导出复盘明细 CSV</button>
        <button onClick={onClose} style={{ minHeight: 40, border: '1px solid var(--border-strong)', background: 'var(--card)', fontSize: 12, borderRadius: 8, padding: '0 14px', cursor: 'pointer', fontFamily: 'inherit' }}>关闭</button>
      </div>
      <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>学期教学复盘 · {filterClass || '全班'} · 学期状态 {班级学期状态 || '—'}</h2>
      <div style={{ fontSize: 10, color: '#666', marginBottom: 10 }}>只读分析 · 数字与期末成绩单同一单源（scoreOf）· 生成时点 {new Date().toLocaleString('zh-CN', { hour12: false })}</div>
      {/* ① 六组关键指标并排 */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 + 'pt' }}>
        <thead><tr>{['组号', '累计营收', '经营净利', '净利率', '平均出租率', '平均好评率', '差评处理率', '期末资金'].map(h => <th key={h} style={{ border: '1px solid #999', padding: '3px 5px', background: '#f3f4f6', textAlign: 'left', fontWeight: 700 }}>{h}</th>)}</tr></thead>
        <tbody>{报告.指标并排.map(m => (
          <tr key={m.组号}>{[m.组号, fmt元(m.累计营收), fmt元(m.经营净利), fmt率01(m.净利率), fmt率(m.平均出租率), fmt率(m.平均好评率), fmt率(m.差评处理率), fmt元(m.期末资金)].map((c, i) => <td key={i} style={{ border: '1px solid #999', padding: '3px 5px' }}>{c}</td>)}</tr>
        ))}</tbody>
      </table>
      {/* ② 极值与差距 */}
      <div style={{ fontSize: 10.5 + 'pt', marginTop: 8, lineHeight: 1.6 }}>
        <b>极值与差距：</b>{报告.极值.map(e => `${e.指标} 最好 ${e.最好组} / 最差 ${e.最差组} / 差距 ${e.差距}`).join(' · ')}
      </div>
      {/* ③ 组间差异前 3（自动归因 · details 展开字段来源） */}
      <div style={{ marginTop: 8 }}>
        <b style={{ fontSize: 10.5 + 'pt' }}>组间差异前 3（自动归因 · 数据说数据）：</b>
        {报告.归因.length === 0 && <div style={{ fontSize: 10.5 + 'pt', marginTop: 4 }}>（各组指标一致或差异不足 —— 无可归因差异）</div>}
        {报告.归因.map((a, i) => (
          <details key={i} style={{ fontSize: 10.5 + 'pt', marginTop: 3 }}>
            <summary style={{ cursor: 'pointer' }}>{i + 1}. {a.文案}</summary>
            <div style={{ color: '#555', fontSize: 9.5 + 'pt', marginTop: 2 }}>字段来源：{a.来源}</div>
          </details>
        ))}
      </div>
      {/* ④ 未决策统计 */}
      <div style={{ fontSize: 10.5 + 'pt', marginTop: 8 }}>
        <b>未决策统计（决策不足 {未决策阈值} 项的周数）：</b>
        {报告.未决策.map(u => `${u.组号} ${u.周数} 周（最长连续 ${u.最长连续}）`).join(' · ')}
        <span style={{ color: '#555' }}>　来源：history[].决策数 &lt; {未决策阈值}</span>
      </div>
      {/* ⑤ 结课状态与归档信息 */}
      <div style={{ fontSize: 10.5 + 'pt', marginTop: 8 }}>
        <b>结课与归档：</b>学期状态 {归档 ? (归档.状态 === '—' || !归档.状态 ? '—' : 归档.状态) : '…'} · 归档学期 {归档 && 归档.学期 || '—'} · 归档文件 {归档 && 归档.文件 || '—'} · 校验 {校验果 ? `${校验果.通过}/${校验果.总数} ${校验果.全过 ? '通过' : '✗ ' + 校验果.明细.filter(x => !x.ok).map(x => x.名).join('、')}` : '—'}
      </div>
      {/* ⑥ 决策画像（事实 · 不做价值判断） */}
      <div style={{ marginTop: 8 }}>
        <b style={{ fontSize: 10.5 + 'pt' }}>决策画像（事实陈述 · 不含行动建议）：</b>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {报告.画像.map(p => (
            <div key={p.组号} style={{ border: '1px solid #999', borderRadius: 6, padding: '4px 8px', fontSize: 9.5 + 'pt', lineHeight: 1.5, flex: '1 1 30%' }}>
              <b>{p.组号}</b><br />改动 {p.改动次数} 处（当周流水口径）· 最常改：{p.最常改}<br />未决策 {p.未决策周数} 周（最长连续 {p.最长连续未决策}）<br />净利 {fmt元(p.结果.经营净利)} · 出租率 {fmt率(p.结果.平均出租率)} · 好评率 {fmt率(p.结果.平均好评率)}
            </div>
          ))}
        </div>
      </div>
      {/* ⑦ 教学建议（规则驱动 · 零网络 · 每条带规则编号与命中数字） */}
      <div style={{ marginTop: 8 }}>
        <b style={{ fontSize: 10.5 + 'pt' }}>教学建议（规则表驱动 · 零网络 · 命中规则 {建议.规则数} 条）：</b>
        <ul style={{ fontSize: 10.5 + 'pt', margin: '4px 0 0', paddingLeft: 20 }}>
          {建议.建议.map((b, i) => <li key={i}>{typeof b === 'string' ? b : `${b.规则}：${b.文本}（命中：${b.命中}）`}</li>)}
        </ul>
      </div>
    </div>
  )
}

// ★ V163 · 一键收口四步向导（§1）+ 冷备状态卡（§2）+ 归档管理（§3）
//   进度/文件清单存服务端 semester_closeouts（断点续跑 · 每班一行 upsert 幂等）· 执行走纯层 runOneTouch（失败停步不许跳步）
function OneTouchCloseoutPanel({ filterClass, user, 班级学期状态, maxWeek, executors, onDone }) {
  const [steps, setSteps] = useState(null)
  const [label, setLabel] = useState(() => new Date().getFullYear() + '秋')
  const [跑中, set跑中] = useState(false)
  const [报告, set报告] = useState('')
  const [校验果, set校验果] = useState(null)
  const [行校验, set行校验] = useState({})
  const [提示, set提示] = useState('')
  const [归档行, set归档行] = useState([])
  const [展开, set展开] = useState(false)

  const 载入 = async () => {
    const { row, error } = await fetchSemesterCloseout(filterClass || undefined)
    if (error) { set提示('服务端状态不可读（迁移未应用或网络）——向导不可用'); setSteps(normalizeSteps(null)); return }
    if (row) { setSteps(normalizeSteps(row.steps)); if (row.label) setLabel(row.label) } else setSteps(normalizeSteps(null))
    const all = await fetchSemesterCloseoutsAll()
    if (!all.error) set归档行(all.rows)
  }
  useEffect(() => { let 活 = true; if (活) 载入(); return () => { 活 = false } }, [filterClass])

  const persist = async (s) => {
    const files = {}
    for (const k of ['snapshot', 'coldbackup']) for (const [名, f] of Object.entries((s[k] && s[k].files) || {})) files[名] = f
    const ok2 = await saveSemesterCloseout({
      classCode: filterClass || undefined, label, steps: s, files,
      semesterStatus: s.archive && s.archive.state === '成功' ? 'archived' : null, createdBy: user?.id || null,
    })
    if (!ok2) set提示('进度写服务端失败（迁移未应用或权限不足）——断点续跑不可用，步骤照常执行')
    return ok2
  }

  const 执行 = async (only) => {
    if (跑中 || !steps) return
    set跑中(true); set报告(''); set校验果(null); set提示('')
    const { steps: 新步 } = await runOneTouch({ steps, executors, persist, only })
    setSteps(新步)
    await 载入()
    set跑中(false)
    if (收口步序.every(k => 新步[k].state === '成功')) { set报告(收口报告(新步)); if (onDone) onDone() }
  }

  const 校验 = async () => {
    const { row } = await fetchSemesterCloseout(filterClass || undefined)
    const files = (row && row.files) || {}
    const r = await 校验冷备(files, sha256Hex)
    set校验果(r)
  }

  if (!steps) return null
  const 可用 = 班级学期状态 === 'running' && maxWeek >= 12
  const 步色 = { 待执行: 'var(--text-muted)', 执行中: 'var(--info)', 成功: 'var(--good)', 失败: 'var(--bad)' }
  return (
    <div data-closeout-panel style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--border)', textAlign: 'left' }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>一键收口（四步 · 失败停步可重试 · 断点续跑 · 幂等）</div>
      {!可用 && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>仅「running 且最大学期周 ≥ 12」可用（当前 {班级学期状态} · 第 {maxWeek} 周）。</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>学期标签</span>
        <input value={label} onChange={e => setLabel(e.target.value)} style={{ width: 90, minHeight: 32, border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 12, padding: '0 8px', fontFamily: 'inherit' }} />
        <button data-onetouch-closeout disabled={!可用 || 跑中} onClick={() => 执行(null)}
          style={{ minHeight: 44, border: 'none', background: 可用 && !跑中 ? 'var(--bad)' : 'var(--border)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '0 16px', borderRadius: 8, cursor: 可用 && !跑中 ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>{跑中 ? '执行中…' : '一键收口'}</button>
        <button onClick={() => set展开(!展开)} style={{ minHeight: 44, minWidth: 44, border: '1px solid var(--border-strong)', background: 'var(--card)', color: 'var(--text-sub)', fontSize: 12, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>{展开 ? '收起' : '单步重试'}</button>
      </div>
      {提示 && <div style={{ fontSize: 11, color: 'var(--bad)', marginTop: 4 }}>{提示}</div>}
      <div style={{ marginTop: 6 }}>
        {收口步序.map(k => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '3px 0' }}>
            <span style={{ color: 步色[(steps[k] || {}).state] || 'var(--text-muted)', fontWeight: 600, minWidth: 42 }}>{(steps[k] || {}).state}</span>
            <span style={{ color: 'var(--text-sub)' }}>{收口步名[k]}</span>
            {(steps[k] || {}).state === '失败' && <span style={{ color: 'var(--bad)', fontSize: 11 }}>{(steps[k] || {}).reason}</span>}
            {展开 && <button onClick={() => 执行(k)} disabled={跑中} style={{ marginLeft: 'auto', minHeight: 44, border: '1px solid var(--border-strong)', background: 'var(--card)', fontSize: 12, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>重试本步</button>}
            {(steps[k] || {}).note && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{(steps[k] || {}).note}</span>}
          </div>
        ))}
      </div>
      {报告 && <pre data-closeout-report style={{ fontSize: 11, background: 'var(--fill)', borderRadius: 8, padding: 10, whiteSpace: 'pre-wrap', marginTop: 6 }}>{报告}</pre>}
      {/* §2 冷备状态卡 */}
      <div data-coldbackup-card style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>冷备状态卡：<b style={{ color: steps.coldbackup.state === '成功' ? 'var(--good)' : 'var(--text-muted)' }}>{steps.coldbackup.state === '成功' ? '已冷备（应用层）· ' + (steps.coldbackup.at || '').replace('T', ' ').slice(0, 16) : '尚未冷备'}</b></div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.7 }}>
          {Object.entries({ ...(steps.snapshot.files || {}), ...(steps.coldbackup.files || {}) }).map(([名, f]) => (
            <div key={名}>{名} · {((f.size || 0) / 1024).toFixed(1)}KB · sha256 {String(f.sha256).slice(0, 8)}{f.content == null ? '（服务器脚本产物 · 用 closeout-semester.sh 校验）' : ''}</div>
          ))}
          {steps.coldbackup.state !== '成功' && <div>（执行「一键收口」第②步后这里出清单）</div>}
          <div>服务器全量冷备（pg_dump + 前端包快照）＝管理员脚本：<code>bash scripts/server/closeout-semester.sh {label}</code>（目录只增不改）</div>
        </div>
        <button data-coldbackup-verify onClick={校验} disabled={跑中} style={{ marginTop: 6, minHeight: 44, minWidth: 44, border: '1px solid var(--border-strong)', background: 'var(--card)', color: 'var(--info)', fontSize: 11, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>校验</button>
        {校验果 && <div style={{ fontSize: 11, color: 校验果.全过 ? 'var(--good)' : 'var(--bad)', marginTop: 4 }}>{校验果.通过}/{校验果.总数} 通过{校验果.全过 ? '' : ' · ' + 校验果.明细.filter(x => !x.ok).map(x => x.名 + '（' + x.why + '）').join('、')}</div>}
      </div>
      {/* §3 归档管理（服务端归档记录 · 文件名含 class_code+学期标签 · 只增不改 ⇒ 不提供删除） */}
      <div data-archive-manage style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>归档管理（服务端 · 按时间倒序 · 归档只增不改 ⇒ 无删除）</div>
        {(归档行 || []).length === 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>（暂无服务端归档记录）</div>}
        {(归档行 || []).map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, padding: '3px 0', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{r.label || '（未标学期）'}</span>
            <span style={{ color: 'var(--text-muted)' }}>{r.class_code} · {(r.updated_at || '').replace('T', ' ').slice(0, 16)}</span>
            <span style={{ color: r.semester_status === 'archived' ? 'var(--good)' : 'var(--text-muted)' }}>{r.semester_status || ''}</span>
            <button onClick={async () => { const v = await 校验冷备(r.files || {}, sha256Hex); set行校验({ ...行校验, [i]: v }) }}
              style={{ minHeight: 44, minWidth: 44, border: '1px solid var(--border-strong)', background: 'var(--card)', fontSize: 12, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>校验</button>
            {行校验[i] && <span style={{ color: 行校验[i].全过 ? 'var(--good)' : 'var(--bad)' }}>{行校验[i].通过}/{行校验[i].总数}{行校验[i].全过 ? '' : ' ✗ ' + 行校验[i].明细.filter(x => !x.ok).map(x => x.名).join('、')}</span>}
            {(r.files || {})['学期快照.json'] && (r.files['学期快照.json'].content != null) && (
              <button onClick={() => { const c = r.files['学期快照.json'].content; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([c], { type: 'application/json' })); a.download = `学期归档-${r.class_code}-${r.label || '学期'}.json`; a.click(); URL.revokeObjectURL(a.href) }}
                style={{ minHeight: 28, border: '1px solid var(--border-strong)', background: 'var(--card)', fontSize: 10, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>下载归档</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TeacherDashboard({ user, onLogout }) {
  const [view, setView] = useState('live')
  // ★ V152 §2：续营开关（班级级 · class_state.continue_enabled · 默认关）
  const [续营开关, set续营开关] = useState(false)
  const [续营态, set续营态] = useState('')   // 保存反馈
  // ★ V153：期末成绩单打印层 + 归档快照列表（本机 localStorage · 只读留档，不参与任何计算）
  const [成绩单开, set成绩单开] = useState(false)
  const [复盘开, set复盘开] = useState(false)   // ★ V164：学期教学复盘覆盖层（只读 · 每次打开现算不缓存）
  const [归档列表, set归档列表] = useState(() => { try { return JSON.parse(localStorage.getItem('hotel-sim-archives') || '[]') } catch (e) { return [] } })
  const [投屏开, set投屏开] = useState(false)   // ★ V154 批3：投屏视图全屏层
  const [班级学期状态, set班级学期状态2] = useState('running')   // ★ V157 阶段1：学期状态（同学生端同源）
  const [学期态提示, set学期态提示] = useState('')   // 结课/重置反馈
  // ★ T3（2026-11-09）：班级筛选初值 —— 上次选择 → 我的班（profile.class_name）→ 全部。
  //   旧行为默认「全部班级」⇒ t2024 打开就是 12 组（老班+彩排班），现场讲"6 组"对不上。
  //   存 'all' 表示用户显式选过"全部"（下次仍按全部，不再自动跳回本班）。
  const [filterClass, setFilterClass] = useState(() => {
    try { const s = localStorage.getItem('teacher-class'); return (!s || s === 'all') ? '' : s } catch (e) { return '' }
  })
  const 班级初值已定 = useRef(false)
  useEffect(() => {
    if (班级初值已定.current) return
    let 存过 = null
    try { 存过 = localStorage.getItem('teacher-class') } catch (e) {}   // 静默理由：localStorage 不可用 ⇒ 按首次登录处理（走我的班/唯一 running 班）
    if (filterClass || 存过 === 'all') { 班级初值已定.current = true; return }
    const mine = user?.className || ''
    // 优先级（纯函数单测见 classCalendar.选默认班）：上次选择 → 我的班（running）→ 唯一 running 班 → 我的班 → 全部
    // ★ T3：不用 fetchAllClasses（V167§3⑥ 会隐藏「彩排*」班）—— 这里单独查 class_state，
    //   只用于"教师端选择/显示"，不改 V167 的隐藏契约（成绩单/对比仍看不到彩排班）。
    supabase.from('class_state').select('class_code,semester_status,current_week,start_date,teacher_offset_days').order('class_code')
      .then(({ data }) => {
        if (班级初值已定.current) return
        setFilterClass(选默认班(data || [], mine, 存过))
        班级初值已定.current = true
      }).catch(() => {   // 静默理由：取不到班级列表就保持"全部"，不阻塞教师台
        if (mine && !班级初值已定.current) setFilterClass(mine)
        班级初值已定.current = true
      })
  }, [user?.className, filterClass])
  useEffect(() => {
    try { localStorage.setItem('teacher-class', filterClass || 'all') } catch (e) {}   // 静默理由：持久化失败只影响下次默认
  }, [filterClass])
  // ★ T3 补：选中班的进度（周/天）—— 首屏计数与课堂预警必须跟着班走，不能再用全局 classDay/classWeek
  const [所选班, set所选班] = useState(null)
  useEffect(() => {
    if (!filterClass) { set所选班(null); return }
    let 活 = true
    supabase.from('class_state').select('class_code,semester_status,current_week,start_date,teacher_offset_days').eq('class_code', filterClass).maybeSingle()
      .then(({ data }) => { if (活) set所选班(data || null) })
      .catch(() => {})   // 静默理由：取不到班行只影响进度文案，不阻塞教师台
    return () => { 活 = false }
  }, [filterClass])
  const 所选班进度 = 所选班 ? 班进度(所选班) : null
  useEffect(() => { let 活 = true; fetchClassState(filterClass || undefined).then(cs => { if (活) { set续营开关(cs.续营开关 === true); set班级学期状态2(cs.学期状态 || 'running') } }).catch(() => {}) /* 静默理由：取不到开关按默认关渲染，不阻塞教师台 */; return () => { 活 = false } }, [filterClass])   // ★ V165：随班级筛选刷新（多班各自的状态/续营开关）
  // ★ V97（用户点名「老师端返回有问题」）：统一导航栈 —— 任何进入都入栈，返回 = **弹栈回上一处**
  //   旧行为：返回按钮固定 setView('me') ⇒ 从 A 进 B 再返回回不到 A；popstate（浏览器/手势返回键）完全没接。
  const 栈 = useRef(null); if (!栈.current) 栈.current = 创建导航栈('live')
  const 跳 = (v) => { if (!v || v === view) return; 栈.current.进入(v); setView(v) }
  const 回 = () => { if (!栈.current.可以返回()) return false; setView(栈.current.返回()); return true }
  useEffect(() => {
    const 处理 = 造返回处理器(栈.current, v => setView(v))
    const onPop = () => { if (处理()) history.pushState({ 教师端: true }, '') }
    history.pushState({ 教师端: true }, '')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  // ★ V10b：>1024 三栏后台（照稿 _mockup-v10b-老师端）—— 顶栏 + 左导航 168 + 主区 + 注入右栏 250
  const [大屏, set大屏] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1025px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1025px)')
    const fn = e => set大屏(e.matches)
    mq.addEventListener ? mq.addEventListener('change', fn) : mq.addListener(fn)
    return () => { mq.removeEventListener ? mq.removeEventListener('change', fn) : mq.removeListener(fn) }
  }, []) // live实时决策 | ranking排名 | me我的 | groups分组管理 | teaching教学参考（后两者从'我的'进入）
  const [rankBy, setRankBy] = useState('score') // 排名排序维度：score/profit/occ/rating
  const [groups, setGroups] = useState(null) // null=加载中 []=云端无数据
  const [copySix, setCopySix] = useState('')
  const [cloudOk, setCloudOk] = useState(true)
  const [notedUids, setNotedUids] = useState(new Set())
  const [allNotes, setAllNotes] = useState([]) // 全部批注（GroupDetail 时间线用）
  const handleDeleteNote = async (noteId) => {
    const okk = await deleteTeacherNote(noteId)
    if (okk) { setAllNotes(ns => ns.filter(n => n.id !== noteId)); loadAll() }
  }
  const [profiles, setProfiles] = useState([]) // 全部学生档案（分组管理用）
  const [rawStates, setRawStates] = useState([]) // 原始云端存档（导出周报用）
  const [expandedUid, setExpandedUid] = useState(null) // 总览页展开查看明细的组
 const [reportUid, setReportUid] = useState(null) // §32-U2：正在看经营报告的组（null = 关）
const [tasksOpen, setTasksOpen] = useState(false) // §33-V80：12 周任务书（打印版）覆盖层
  const [classByUid, setClassByUid] = useState({}) // uid → class_name 映射
  const [classWeek, setClassWeekState] = useState(0) // 全班统一教学周（0=不限）
  // 🔴 W1-5：classDay（服务端权威）。取不到（迁移未应用/离线）时保持 0，
  //   此时进度提示降级为"按教学周推算的近似值"，并在 UI 上标明是近似。
  const [classDay, setClassDay] = useState(0)
  const [weekInput, setWeekInput] = useState('')
  const [weekSaved, setWeekSaved] = useState(false)
  const [推进中, set推进中] = useState(false)   // ★ V131 §2
  const [newChips, setNewChips] = useState({}) // uid -> Set(决策id)：最近一次刷新新增/变化的决策（高亮）
  const [chipDetail, setChipDetail] = useState(null) // 大屏chips点击的详情
  const [liveWeekFilter, setLiveWeekFilter] = useState(0) // 大屏周次筛选（0=当前周/最新，1-12=历史周快照）
  const prevDoneRef = React.useRef(null)
  useEffect(() => {
    const cur = {}
    rawStates.forEach(gs => {
      cur[gs.user_id] = Object.fromEntries(Object.entries((gs.state && gs.state.doneDecisions) || {}).map(([k, v]) => [k, JSON.stringify(v === undefined ? null : (Array.isArray(v) ? v : typeof v === 'object' ? Object.keys(v).sort().map(k2 => [k2, v[k2]]) : v))]))
    })
    const prev = prevDoneRef.current
    if (prev) {
      const marks = {}
      for (const uid in cur) {
        for (const id in cur[uid]) {
          if (prev[uid] && prev[uid][id] !== cur[uid][id]) {
            (marks[uid] = marks[uid] || new Set()).add(id)
          }
        }
      }
      setNewChips(marks)
    }
    prevDoneRef.current = cur
  }, [rawStates])

  const loadAll = async () => {
    try {
      const [rawStates, profiles] = await Promise.all([fetchAllGameStates(), fetchAllProfiles()])
      // 🔴 批次 B1.5（教师端读取侧 · 第 4 处云端路径）：教师端消费 state.history 算策略/排名/四维分
      //   ⇒ 旧量级云档必须一并迁移，否则"学生端 502 万、教师端 50 万"两套量级混排
      //   ★ 只读迁移、【不回写云端】—— 教师端没有改写学生存档的权限语义
      const states = rawStates.map(gs => {
        const r = restoreFromCloud(gs && gs.state)
        return r.migrated ? { ...gs, state: r.state } : gs
      })
      const pMap = Object.fromEntries(profiles.map(p => [p.user_id, p]))
      // ★ 修复：原先这里写了不存在的标识符 `classDayState` ⇒ 在 try/catch 内会静默吞掉
      //   ReferenceError，导致教师端【整片数据加载失败】却毫无提示（假绿同族）。
      //   现在用真实 state：优先服务端 classDay；取不到则按教学周推算并标记为近似。
      const effClassDay = classDay || (classWeek ? classWeek * 7 : 0)
      // ★ V114-P2④：**只读**「group_no 已分配 + game_states 有行」的组 —— 未分组账号一律不进统计
      const 有效 = 只取有效组({ profiles, gameStates: states })
      const list = 有效.map(gs => summarize(gs, pMap[gs.user_id], effClassDay))
      list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.historyCount - a.historyCount)
      setGroups(list)
      setProfiles(profiles.filter(p => p.role === 'student').sort((a, b) => (a.student_no || '').localeCompare(b.student_no || '') || (a.group_no || 99) - (b.group_no || 99)))
      setRawStates(有效)   // ★ V114-P2：诊断/看板只吃有效组
      // 静默理由：只读聚合，取不到保持上一屏数据
      fetchTeacherNotes().then(ns => { setNotedUids(new Set(ns.map(n => n.student_uid))); setAllNotes(ns) }).catch(() => {})
      setClassByUid(Object.fromEntries(profiles.map(p => [p.user_id, p.class_name || ''])))
      // 静默理由：只读聚合，取不到保持上一屏数据
      fetchClassWeek().then(w => { setClassWeekState(w); setWeekInput(String(w)) }).catch(() => {})
      // W1-5：一并取服务端 classDay（失败静默回 0，不影响其余加载）
      // 静默理由：只读聚合，取不到保持上一屏数据
      fetchClassDay().then(d => { if (d) setClassDay(d) }).catch(() => {})
      setCloudOk(true)
    } catch (e) {
      setGroups(demoGroups); setCloudOk(false)
    }
  }

  const [logs, setLogs] = useState([]) // 决策流水（decision_log，最新在上）
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!cancelled) await loadAll()
    })()
    // Realtime：学生结算/存档变化时自动刷新看板（无需手动刷新）
    const unsub = subscribeGameStates(() => { if (!cancelled) loadAll() })
    // 决策流水：首次拉取 + Realtime 增量置顶（纯追加，不清空）
    fetchDecisionLogs(50).then(rows => { if (!cancelled) setLogs(rows) })
    const unsubLogs = subscribeDecisionLogs(row => {
      if (!cancelled) setLogs(prev => [row, ...prev].slice(0, 50))
    })
    return () => { cancelled = true; unsub(); unsubLogs() }
  }, [])

  // 教师改组号/班级（本地即时更新 + 云端写入）
  async function saveProfile(p, fields) {
    setProfiles(prev => prev.map(x => x.user_id === p.user_id ? { ...x, ...fields } : x))
    await updateProfileByTeacher(p.user_id, fields)
  }

  // 教师设置全班统一周
  // ★ V131 §2：老师推进教学日（不跳周 · 只写 teacher_offset_days · RLS 限教师）
  async function 推进班级(模式) {
    if (推进中) return
    const t = 推进目标(classDay, 模式)
    if (!t.可执行) { 提示(t.原因); return }
    set推进中(true)
    const r = await advanceClassOffset(t.增量, filterClass || undefined)
    set推进中(false)
    if (!r.ok) {
      提示((r.code === '42501' || /permission|权限|row-level|policy/i.test(String(r.error))) ? '无权限：只有教师账号能推进（RLS）' : '推进失败：' + r.error)
      return
    }
    setClassDay(t.目标)
    提示(`已推进到第 ${t.目标} 天（本周第 ${本周第几天(t.目标)}/7 天）· 服务端 ≤1 分钟内结算`)
  }
  async function saveClassWeek() {
    const w = Math.max(0, Math.min(12, Number(weekInput) || 0))
    // ★ V165 §3：周次只进不退 —— 回退需二次确认 + 审计（操作人/原值/新值/时间 → decision_logs 单源键）
    if (w < classWeek) {
      if (!window.confirm(`回退周次：${classWeek} → ${w}（只进不退 · 回退将留审计记录）。确定？`)) return
      if (await setClassWeek(w, filterClass || undefined)) {
        await saveDecisionLog({ userId: user?.id || null, groupKey: null, week: classWeek, decisionId: 回退审计键, answer: JSON.stringify({ 操作人: user?.name || '教师', 班级: filterClass || '—', 原值: classWeek, 新值: w, 时间: new Date().toISOString() }), feedback: '周次回退审计' })
        setClassWeekState(w); setWeekInput(String(w)); setWeekSaved(true); setTimeout(() => setWeekSaved(false), 2000)
      }
      return
    }
    if (await setClassWeek(w, filterClass || undefined)) {
      setClassWeekState(w)
      setWeekInput(String(w))
      setWeekSaved(true)
      setTimeout(() => setWeekSaved(false), 2000)
    }
  }

  // ★ V153：期末成绩单行（六组 · 口径 A · 与 scoreOf 零差）+ 归档快照
  function 成绩单数据() {
    const pMap2 = Object.fromEntries(profiles.map(p => [p.user_id, p]))
    const vis = filterClass ? groups.filter(g => classByUid[g.uid] === filterClass) : groups
    const { rows, histBy组号 } = 成绩单(vis.map(g => {
      const p = pMap2[g.uid] || {}
      const gs = rawStates.find(x => x.user_id === g.uid) || {}
      return { 组号: p.group_no != null ? `${p.class_name || ''}第${p.group_no}组` : g.name, 班级: p.class_name || '', 酒店名: g.hotel || '', history: (gs.state && gs.state.history) || [] }
    }))
    return { rows, histBy组号 }
  }
  function 生成成绩单行() { return 成绩单数据().rows }
  function 归档本学期() {
    const rows = 生成成绩单行()
    const 摘要 = vis摘()
    const 快照 = 归档快照({ 班级: filterClass || (profiles[0] && profiles[0].class_name) || '', 生成人: user?.name || '教师', rows, 摘要 })
    快照.生成时间 = new Date().toLocaleString('zh-CN', { hour12: false })
    const json = JSON.stringify(快照, null, 1)
    const 日期 = new Date().toISOString().slice(0, 10)
    const blob = new Blob([json], { type: 'application/json' })
    const a2 = document.createElement('a'); a2.href = URL.createObjectURL(blob); a2.download = `学期归档-${快照.班级}-${日期}.json`; a2.click(); URL.revokeObjectURL(a2.href)
    const blob2 = new Blob(['﻿' + 归档CSV(快照)], { type: 'text/csv;charset=utf-8' })
    const a3 = document.createElement('a'); a3.href = URL.createObjectURL(blob2); a3.download = `学期归档-${快照.班级}-${日期}.csv`; a3.click(); URL.revokeObjectURL(a3.href)
    const 列表 = [{ 时间: 快照.生成时间, 生成人: 快照.生成人, 班级: 快照.班级, 条数: 快照.条数, json }, ...(归档列表 || [])].slice(0, 20)
    set归档列表(列表)
    try { localStorage.setItem('hotel-sim-archives', JSON.stringify(列表)) } catch (e) {}   // 静默理由：本机留档失败不影响下载文件
  }
  function vis摘() {
    const vis = filterClass ? groups.filter(g => classByUid[g.uid] === filterClass) : groups
    return vis.map(g => {
      const gs = rawStates.find(x => x.user_id === g.uid) || {}
      const hist = 学期切片12((gs.state && gs.state.history) || [])
      return { 组: g.name, 周数: hist.length, 经营净利: hist.reduce((a2, h) => a2 + 周经营净利(h), 0), 资金: (gs.state && gs.state.capital) ?? null }
    })
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
    lines.push('班级,组名,酒店,城市,周次,状态,称号,称号轨迹,策略标签,职责完成度,出租率%,营收(万),净利润(万),GOP(万),口碑(5分),综合评分')
    for (const g of visible) {
      const p = pMap[g.uid] || {}
      const gs = rawStates.find(x => x.user_id === g.uid) || {}
      const hist = (gs.state && gs.state.history) || []
      const q = qualityOf(gs.state)
      let prevT = null
      const nodes = []
      hist.forEach(h => {
        const t2 = getTitle(h.occupancy, h.finalGoodRate, q).title
        if (t2 !== prevT) { nodes.push(`第${h.week}周${t2}`); prevT = t2 }
      })
      const st = strategyOf(hist)
      // 职责完成度：该组学生职业集合对应决策在组档中的完成数（与 GroupDetail 口径一致）
      const grpProfiles = profiles.filter(x => x.class_name === p.class_name && x.group_no === p.group_no)
      const roles = new Set(grpProfiles.map(x => x.role_in_group).filter(r => r && !['student', 'teacher'].includes(r)))
      const dutyIds = new Set(decisions.filter(d => roles.has(d.owner)).map(d => d.id))
      const doneCnt = [...dutyIds].filter(id => ((gs.state && gs.state.doneDecisions) || {})[id] !== undefined).length
      const dutyStr = dutyIds.size ? `${doneCnt}/${dutyIds.size}` : ''
      lines.push([
        p.class_name || '', g.name, esc(g.hotel), g.city, g.week || 1,
        g.finished ? '已结业' : '经营中', esc(g.title || ''), esc(nodes.join('→')), esc(st ? st.tag : ''), esc(dutyStr), g.occ, g.revenue, g.profit, Number.isFinite(g.gop) ? g.gop : '', g.rating, g.score ?? '',
      ].join(','))
    }
    lines.push('')
    lines.push('【每周明细】')
    lines.push('班级,组名,周次,出租率%,房价(元),营收(元),成本(元),净利润(元),GOP(元),评价数,差评数,好评率%,综合分')
    for (const gs of rawStates.filter(x => visibleUids.has(x.user_id))) {
      const p = pMap[gs.user_id] || {}
      const gname = p.group_no ? `${p.class_name ? p.class_name + '·' : ''}第${p.group_no}组` : (p.display_name || gs.user_id.slice(0, 8))
      const hist = (gs.state && gs.state.history) || []
      const q = qualityOf(gs.state)
      for (const h of hist) {
        const comp = Math.round((h.occupancy || 0) * 0.35 + (h.finalGoodRate || 0) * 0.35 + q * 0.3)
        lines.push([
          p.class_name || '', gname, h.week, h.occupancy, h.price, h.revenue, h.totalCost, h.profit, Number.isFinite(h.gop) ? h.gop : '',
          h.reviewCount ?? '', h.negativeCount ?? '', h.finalGoodRate ?? '', comp,
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
  const ranked = [...(groups || [])].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  // 班级筛选（多班教学时只看某个班）
  const classList = Array.from(new Set(Object.values(classByUid).filter(Boolean)))
  const visibleGroups = filterClass
    ? (groups || []).filter(g => classByUid[g.uid] === filterClass)
    : (groups || [])
  const rankKey = { score: 'score', profit: 'profit', occ: 'occ', rating: 'rating' }[rankBy] || 'score'
  const visibleRanked = [...visibleGroups].sort((a, b) => (b[rankKey] || 0) - (a[rankKey] || 0))

  function scoreBar(score) {
    if (score >= 90) return 'var(--good)'
    if (score >= 80) return 'var(--primary)'
    if (score >= 70) return 'var(--warn-border)'
    return 'var(--bad)'
  }

  return (
    <>
    {大屏 && (
      <div className="t-top">
        <b>云悦酒店 · 教学控制台</b>
        <span>{(profiles && profiles[0] && profiles[0].class_name) || '模拟班'} · 第 {classWeek > 0 ? classWeek : 1} 周起</span>
        <span>学生 {profiles ? profiles.length : 0} 人</span>
        <span>{new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    )}
    <div className="t-body3">
    {大屏 && (
      <nav className="t-nav">
        {[
          { k: 'live', icon: 'nav.live', t: '实时决策' },
          { k: 'ranking', icon: 'nav.rank', t: '排名' },
          { k: 'overview', icon: 'nav.report', t: '班级总览' },
          { k: 'overview', icon: 'nav.group', t: '班级管理', 锚: 'class-admin' },   // ★ V167§2：班级面板入口（同页锚点滚动）
          { k: 'screen', icon: 'teach.point', t: '课堂投屏' },
          { k: 'inject', icon: 'note.caliber', t: '事件注入' },
          { k: 'supervisor', icon: 'role.manager', t: 'AI 领班' },
          { k: 'groups', icon: 'nav.group', t: '分组管理' },
          { k: 'teaching', icon: 'teach.point', t: '教学参考' },
          { k: 'me', icon: 'nav.me', t: '我的' },
        ].map(x => (
          <a key={x.t} data-open-class-admin={x.锚 ? '' : undefined} className={view === x.k ? 'on' : ''} onClick={() => { 栈.current.进入(x.k); setView(x.k); if (x.锚) setTimeout(() => { const el = document.querySelector('[data-class-admin-panel]'); if (el) el.scrollIntoView({ block: 'start' }) }, 120) }}   /* ★ V97：入栈后仍走原语句（保留 V50 不变量字面判据）· V167§2：班级管理=overview+锚点滚动 */>
            <Icon name={x.icon} size={16} />{x.t}
          </a>
        ))}
        <a onClick={onLogout} style={{ color: 'var(--bad)' }}><Icon name="event.resign" size={16} />退出登录</a>
      </nav>
    )}
    <div className="t-main">
    <div className="content" style={{ paddingBottom: 24 }}>
      <div className="header">
        <div className="row1"><span className="hotel-name">教师后台</span></div>
        <div className="sub">
 {/* T2.4/E2：缺周展示 —— 老师跳过的周显式列出； 不参与任何平均值分母（只展示，不回写 history） */}
        {missingWeeks(history).length > 0 && (
          <div style={{ margin: '8px 0 0', padding: '8px 10px', background: 'var(--fill)', border: '1px dashed var(--border-strong)', borderRadius: 8, fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.7 }}>
            {missingWeeks(history).map(w => <div key={w}>{missingLabel(w)}</div>)}
            <div style={{ color: 'var(--text-muted)' }}>（以上周次不计入平均分分母 —— 跳周不算学生失职）</div>
          </div>
        )}
          {user?.name} · {groups === null ? '正在加载全班数据…' : cloudOk ? `云端数据 · ${visibleGroups.length} 组已开档${filterClass ? `（${filterClass}）` : ''}` : '云端不可用，显示演示数据'}
          {/* V63：全班时间不推进的原因说明（绑定真实通道 classDay（class_day_now RPC · 0=不可用）· 已同步不显示） */}
          {cloudOk && !(classDay > 0) && (
            <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 8, background: 'var(--bg)', border: '1px dashed var(--warn-border)', color: 'var(--warn)', fontSize: 12, lineHeight: 1.6 }}>
              教学日程同步未就绪（服务端 class_day_now 不可用 ⇒ 开学日未设定，或服务端自动推进未部署）⇒ 全班经营时间暂不推进属正常，不是系统卡死 · 周报/成绩什么时候有：第 7 个游戏日自动出第一份周报，此后每周一份；12 周经营结束后出期末成绩——综合评分显示「未结算」= 这组还没到第一次结算，不代表学生做得差 · 下一步：在班级设置里设定开学日，或完成服务端自动推进部署；想现在就看周报演示，可让一组用离线演示推进到第 7 天
            </div>
          )}
          {!cloudOk && (
            <div style={{ position: 'fixed', top: 8, right: 8, zIndex: 9999, background: 'var(--warn-bg)', color: 'var(--warn)',
              border: '1px solid var(--warn-border)', borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 700,
              pointerEvents: 'none' }}>
              演示数据（未连云端 · 非真实经营）
            </div>
          )}
          {/* V66 · 重置本机引导（老师帮学生清掉"已关闭引导"标记 · 只影响本机浏览器） */}
          <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() => { if (!window.confirm('确定重置本机引导吗？\n\n影响：本浏览器上的学生重新进入选址/决策/认领/筹建页时会再次看到新手提示（不影响任何成绩与存档）。')) return; guideResetAll(); 提示('已重置本机引导：学生在此浏览器重新进入选址/决策/认领/筹建页，会重新看到新手提示') }}   /* ★ V98-② 危险操作二次确认 */>
              重置演示引导（本机）
            </button>
            {/* §33-V80：12 周任务书（打印版 · 课堂发全班） */}
            <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() => setTasksOpen(true)}>
              12 周任务书（打印版）
            </button>
          </div>
        </div>
      </div>

      <div key={view} style={{ animation: 'pageIn 0.25s cubic-bezier(0.22,1,0.36,1)' }}>
      {/* 视图标题（分组/教学/总览/注入/领班 从"我的"进入时显示返回） */}
      {(view === 'groups' || view === 'teaching' || view === 'overview' || view === 'inject' || view === 'supervisor') && (
        <div style={{ padding: '0 20px 8px' }}>
          <button className="btn btn-ghost" style={{ width: '100%', padding: '10px 0' }} onClick={() => 回()} disabled={!栈.current.可以返回()}>‹ 返回</button>
        </div>
      )}



      {groups === null && (
        <div className="card">
          {[0, 1, 2].map(i => (
            <div key={i} style={{ padding: 12, background: 'var(--bg)', borderRadius: 10, marginBottom: 8 }}>
              <div className="skeleton" style={{ height: 14, width: '55%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 11, width: '85%' }} />
            </div>
          ))}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>正在从云端拉取全班经营数据…</div>
        </div>
      )}

      {/* 总览 */}
      {/* 班级总览（从'我的'进入） */}
      {view === 'overview' && groups !== null && (
        <div>
          {/* ★ V144 §2：六组一句话（教师投屏/一键复制；不排名、不打分） */}
          {(() => {
            const 行 = 六组一句话(groups)
            const 文本 = 行.join('\n')
            const 复制 = async () => {
              try { await navigator.clipboard.writeText(文本); setCopySix('已复制') } catch (e) {
                try {
                  const ta = document.createElement('textarea'); ta.value = 文本; ta.style.position = 'fixed'; ta.style.opacity = '0'
                  document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); setCopySix('已复制')
                } catch (e2) { setCopySix('复制失败，请手动选中') }
              }
              setTimeout(() => setCopySix(''), 2000)
            }
            return (
              <div className="card" data-six-line="1" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>六组一句话（投屏 / 复制）</div>
                  <button data-copy-six="1" onClick={复制} style={{ border: '1px solid var(--primary-border)', background: 'var(--card)', color: 'var(--info)', fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, minHeight: 44 }}>复制六行</button>
                </div>
                {copySix && <div style={{ fontSize: 12, color: 'var(--good)', marginTop: 4 }}>{copySix}</div>}
                <div style={{ fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.9, marginTop: 6, color: 'var(--text-sub)' }}>{文本 || '暂无已结算的组'}</div>
              </div>
            )
          })()}

          {/* ★ V152 §1：学期成果（班级并排 · 不排名不打分；学期口径 = 前 12 周） */}
          {(() => {
            const 行 = 班级并排((groups || []).map(g => ({
              name: g.name, hotel: g.hotel,
              history: ((rawStates.find(x => x.user_id === g.uid) || {}).state || {}).history || [],
            })))
            return (
              <div className="card" data-semester-overview="1" style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>学期成果（并排 · 不排名 · 前 12 周口径）</div>
                <班级并排表 行={行} />
              </div>
            )
          })()}

          {/* ★ V153：期末成绩单 + 归档快照 */}
          {(() => {
            const { rows: 行, histBy组号 } = 成绩单数据()
            const 零差 = 与scoreOf零差(行, histBy组号)
            return (
              <div className="card" data-report-card="1" style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>期末成绩单（口径 A · 四维 40/25/20/15 · 过程分不进总表）</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button data-open-report-card onClick={() => set成绩单开(true)} style={{ minHeight: 44, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>打印成绩单（A4）</button>
                  <button data-export-report-card onClick={() => 下载成绩单CSV(行, `期末成绩单-${filterClass || '全班'}-${new Date().toISOString().slice(0, 10)}.csv`)} style={{ minHeight: 44, border: '1px solid var(--primary-border)', background: 'var(--card)', color: 'var(--info)', fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>下载成绩单 CSV</button>
                  <button data-semester-review onClick={() => set复盘开(true)} style={{ minHeight: 44, border: 'none', background: 'var(--info)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>生成学期复盘（A4 一页 · 只读）</button>
                  <button data-archive-semester onClick={归档本学期} style={{ minHeight: 44, border: '1px solid var(--border-strong)', background: 'var(--card)', color: 'var(--text-sub)', fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>归档本学期（冻结快照）</button>
                </div>
                {零差.length === 0
                  ? <div style={{ fontSize: 11, color: 'var(--good)', marginTop: 6 }}>✓ 成绩单与 scoreOf 逐格零差（自检通过）</div>
                  : <div style={{ fontSize: 11, color: 'var(--bad)', marginTop: 6 }}>✗ 成绩单与 scoreOf 不一致：{零差.join(' | ')}</div>}
                {/* ★ V154 批3：班级对比（不排名）+ 学期版一键报告 */}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
                  <button data-open-screen onClick={() => set投屏开(true)} style={{ minHeight: 44, border: 'none', background: 'var(--warn)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', marginRight: 8 }}>投屏视图（1920 一屏）</button>
                  <button data-export-semester-report onClick={() => 下载学期报告({ 班级: filterClass || (profiles[0] && profiles[0].class_name) || '', rows: 生成成绩单行(), 摘要: vis摘(), 生成人: user?.name || '教师' })} style={{ minHeight: 44, border: '1px solid var(--border-strong)', background: 'var(--card)', color: 'var(--text-sub)', fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', marginRight: 8 }}>学期报告（HTML · 可打印）</button>
                  <button data-export-card-csv2 onClick={() => 导出成绩单CSV2(生成成绩单行(), `期末成绩单-${filterClass || '全班'}-${new Date().toISOString().slice(0, 10)}.csv`)} style={{ minHeight: 44, border: '1px solid var(--border-strong)', background: 'var(--card)', color: 'var(--text-sub)', fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>成绩单 CSV（副本）</button>
                </div>
                {(() => {
                  const { rows: 行2, histBy组号 } = 组装课堂行({ groups, rawStates, classByUid, filterClass })
                  return <ClassroomCompare rows={行2} histBy组号={histBy组号} />
                })()}
                {(归档列表 || []).length > 0 && (
                  <div data-archive-list style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>已归档（本机留档 · 只读 · 可下载）</div>
                    {归档列表.map((a2, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 0' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{a2.时间} · {a2.班级 || '全班'} · {a2.条数} 组 · {a2.生成人}</span>
                        <button onClick={() => {
                          const blob = new Blob([a2.json], { type: 'application/json' })
                          const a3 = document.createElement('a'); a3.href = URL.createObjectURL(blob); a3.download = `学期归档-${a2.班级 || '全班'}-${a2.时间.replace(/[/: ]/g, '-')}.json`; a3.click(); URL.revokeObjectURL(a3.href)
                        }} style={{ marginLeft: 'auto', minHeight: 36, border: '1px solid var(--border-strong)', background: 'var(--card)', fontSize: 11, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>下载快照</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {/* 教学进度控制：全班统一周 */}
          <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}> 教学进度控制（全班统一周）</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-sub)', flexShrink: 0 }}>当前设定</span>
              <input
                type="number"
                min="0"
                max="12"
                value={weekInput}
                onChange={e => setWeekInput(e.target.value)}
                style={{ width: 64, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>周（0 = 不限制，各组自选节奏）</span>
              <button onClick={saveClassWeek} style={{ border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                保存
              </button>
            </div>
            <div style={{ fontSize: 11, color: weekSaved ? 'var(--good)' : 'var(--text-muted)', marginTop: 6, lineHeight: 1.6 }}>
              {weekSaved ? '已保存，全班即时生效' : classWeek > 0 ? `学生只能结算到第 ${classWeek} 周——保证全班同一周看到同一个市场和事件（公平）` : '未限制：各组按自己节奏推进'}
            </div>

            {/* ★ V131 §2：推进教学日（不跳周） */}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 6 }}>
                教学日：第 <b>{classDay > 0 ? classDay : '—'}</b> 天 · 本周第 <b>{classDay > 0 ? 本周第几天(classDay) : '—'}</b>/7 天
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled={推进中 || !(classDay > 0) || !推进目标(classDay, '本周结束').可执行} onClick={() => 推进班级('本周结束')}
                  style={{ flex: 1, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', opacity: (推进中 || !(classDay > 0) || !推进目标(classDay, '本周结束').可执行) ? 0.5 : 1 }}>
                  推进到本周结束（结算）
                </button>
                <button disabled={推进中 || !(classDay > 0) || !推进目标(classDay, '下一周').可执行} onClick={() => 推进班级('下一周')}
                  style={{ flex: 1, border: '1px solid var(--primary-border)', background: 'var(--card)', color: 'var(--info)', fontSize: 12, fontWeight: 600, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', opacity: (推进中 || !(classDay > 0) || !推进目标(classDay, '下一周').可执行) ? 0.5 : 1 }}>
                  进入下一周（第 7 天可用）
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.6 }}>
                不跳周：先把本周推到第 7 天，再进下一周（history 周次才连续）· 服务端 tick 10 分钟一次，建议改 1 分钟
              </div>
            </div>
          </div>

          {/* ★ V165 · 班级管理面板（建班/导入/开课控制 · 常驻） */}
          <ClassAdminPanel filterClass={filterClass} setFilterClass={setFilterClass} user={user} 班级学期状态={班级学期状态} 当前周={classWeek} onCreated={null} 备用班={所选班} />

          {/* 班级筛选（多班时出现） */}
          {classList.length > 1 && (
            <div className="city-row" style={{ marginBottom: 12 }}>
              <button className={`city-tab ${filterClass === '' ? 'active' : ''}`} onClick={() => setFilterClass('')}>全部班级</button>
              {classList.map(c => (
                <button key={c} className={`city-tab ${filterClass === c ? 'active' : ''}`} onClick={() => setFilterClass(c)}>{c}</button>
              ))}
            </div>
          )}

          <div className="card" style={{ background: 'var(--warn-bg)', borderColor: 'var(--warn-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--warn)', fontWeight: 600 }}>全班经营总览{filterClass ? ` · ${filterClass}` : ''}</div>
              {groups.length > 0 && (
                <button onClick={exportWeeklyCSV} style={{ border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
                  导出全班周报 CSV
                </button>
              )}
            </div>
            {/* 全班策略分布（课堂讨论：同样市场，不同打法） */}
          {(() => {
            const dist = {}
            ;(visibleGroups || []).forEach(g => {
              const gs = rawStates.find(x => x.user_id === g.uid) || {}
              const st = strategyOf((gs.state && gs.state.history) || [])
              if (!st) return
              const key = st.icon + ' ' + st.tag
              dist[key] = dist[key] || { n: 0, color: st.color, bg: st.bg }
              dist[key].n += 1
            })
            const entries = Object.entries(dist)
            if (!entries.length) return null
            return (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warn)', marginBottom: 5 }}>全班策略分布</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {entries.map(([key, v]) => (
                    <span key={key} style={{ fontSize: 11, fontWeight: 700, color: v.color, background: v.bg, borderRadius: 999, padding: '4px 12px' }}>
                      {key} × {v.n} 组
                    </span>
                  ))}
                </div>
              </div>
            )
          })()}
 {/* W1-5（T3.7）：进度落后提示 —— 服务端 classDay vs 各组算到第几天
              验收口径：构造"3 天没提交决策"的组 → 这里必须明确列出来 */}
          {(() => {
            const behind = visibleGroups.filter(g => g.lag && g.lag.level === 'behind')
            const watch = visibleGroups.filter(g => g.lag && g.lag.level === 'watch')
            if (!behind.length && !watch.length) {
              return classDay > 0 ? (
                <div style={{ margin: '0 20px 12px', fontSize: 12, color: 'var(--good)', background: 'var(--good-bg)', border: '1px solid var(--good-border)', borderRadius: 8, padding: '6px 10px' }}>
                  全班进度正常（服务端第 {classDay} 天，各组均已跟上）
                </div>
              ) : null
            }
            return (
              <div style={{ margin: '0 20px 12px', fontSize: 12, background: behind.length ? 'var(--bad-bg)' : 'var(--warn-bg)', border: `1px solid ${behind.length ? 'var(--bad-border)' : 'var(--warn-border)'}`, borderRadius: 8, padding: '8px 10px', lineHeight: 1.8 }}>
                <div style={{ fontWeight: 700, color: behind.length ? 'var(--bad)' : 'var(--warn)', marginBottom: 2 }}>
                  {behind.length ? `${behind.length} 组进度落后` : `· ${watch.length} 组需留意`}
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                    （服务端第 {classDay} 天{classDay ? '' : '· 按教学周推算'}）
                  </span>
                </div>
                {[...behind, ...watch].slice(0, 8).map(g => (
                  <div key={g.uid} style={{ color: 'var(--text)' }}>
                    · {g.name || g.uid}：<b>{g.lag.label}</b>
                    {g.lag.sinceLabel && <span style={{ color: 'var(--text-muted)' }}>（{g.lag.sinceLabel}）</span>}
                  </div>
                ))}
                {[...behind, ...watch].length > 8 && <div style={{ color: 'var(--text-muted)' }}>…另有 {[...behind, ...watch].length - 8} 组</div>}
              </div>
            )
          })()}

          {/* 班级整体统计条 */}
            {visibleGroups.length > 0 && (() => {
              const withData = visibleGroups.filter(g => g.historyCount > 0)
              const avg = (fn) => withData.length ? Math.round(withData.reduce((a, g) => a + fn(g), 0) / withData.length) : 0
              const avgOcc = avg(g => g.occ)
              const avgRating = 班级平均口碑(withData.map(g => g.rating))   // ★ V127-#2：5 分制直接求平均（不再 /20）
              const lossCount = withData.filter(g => g.profit < 0).length
              const avgEvents = withData.length ? +(withData.reduce((a, g) => {
                const gs = rawStates.find(x => x.user_id === g.uid)
                const h = (gs?.state?.history) || []
                return a + h.reduce((acc, w) => acc + ((w.events && w.events.length) || 0), 0)
              }, 0) / withData.length).toFixed(1) : 0
              return (
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {[
                    { l: '平均出租率', v: avgOcc + '%' },
                    { l: '平均口碑', v: avgRating != null ? avgRating.toFixed(1) : '—' },
                    { l: '平均事件/组', v: avgEvents },
                    { l: '亏损组', v: lossCount + '组' },
                  ].map(s => (
                    <div key={s.l} style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '8px 0', textAlign: 'center' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--warn)' }}>{s.v}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              )
            })()}
            {visibleGroups.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>还没有学生开档。学生注册并开始经营后，这里会实时显示各组数据。</div>}
            {visibleGroups.map(g => {
              const expanded = expandedUid === g.uid
              return (
              <div key={g.uid}>
                <div
                  onClick={() => setExpandedUid(expanded ? null : g.uid)}
                  style={{ padding: '12px', background: '#fff', borderRadius: 10, marginBottom: expanded ? 0 : 8, cursor: 'pointer', borderBottomLeftRadius: expanded ? 0 : 10, borderBottomRightRadius: expanded ? 0 : 10 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <span style={{ fontSize: 14, fontWeight: 700 }}>{g.hotel} {g.title && <span style={{ fontSize: 11, color: 'var(--warn)', background: 'var(--warn-bg)', borderRadius: 6, padding: '2px 6px', marginLeft: 4 }}>{g.titleIcon} {g.title}</span>}{notedUids.has(g.uid) && <span title="已批注" style={{ fontSize: 12, marginLeft: 4 }}></span>}<StrategyTag rawStates={rawStates} uid={g.uid} /></span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g.name} · {g.city}
 {/* §32-U2：一键经营报告（stopPropagation ⇒ 不触发卡片展开） */}
                      <button
                        title="一键图文经营报告（只读汇总 · 可打印/另存 PDF）"
                        onClick={e => { e.stopPropagation(); setReportUid(g.uid) }}
                        style={{ marginLeft: 8, border: '1px solid var(--warn-border)', background: 'var(--warn-bg)', color: 'var(--warn)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                      >经营报告</button>
                      {' '}{expanded ? '▲' : '▼'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--text-sub)', flexWrap: 'wrap' }}>
                    <span>进度 <b style={{color:'var(--text)'}}>{g.finished ? '已结业' : `第${g.week || 1}周`}</b></span>
                    <span>出租率 <b style={{color:'var(--text)'}}>{g.occ}%</b></span>
                    <span>营收 <b style={{color:'var(--text)'}}>{g.revenue}万</b></span>
                    <span title={NET_DEF}>{NET_LABEL} <b style={{color:'var(--good)'}}>{g.profit}万</b></span>
                    {/* W2-3：GOP 与净利润分列（演示数据/旧档无 GOP 字段时不显示，不编造） */}
                    {typeof g.gop === 'number' && (
                      <span title={GOP_DEF}>{GOP_SHORT} <b style={{color:'var(--primary)'}}>{g.gop}万</b>{!g.gopComplete && <span style={{ color: 'var(--text-muted)' }}>（部分周）</span>}</span>
                    )}
                    <span>口碑 <b style={{color:'var(--primary)'}}>{g.rating || '—'}</b></span>
                  </div>
                </div>
                {expanded && <GroupDetail uid={g.uid} rawStates={rawStates} name={g.name} allNotes={allNotes} onDeleteNote={handleDeleteNote} onSaved={loadAll} profiles={profiles} onGoDecision={(id) => { setExpandedUid(null); onGoDecision && onGoDecision(id) }} />}
              </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 实时决策大屏：学生们做过/正在做的决策，实时观察动向 */}
      {/* ★ V160：学期状态黄条 —— 满 12 周或非 running 时提示（别让人猜） */}
      {/* ★ V171 · 课堂预警面板（实时页顶部） */}
      {view === 'live' && <ClassAlertsPanel
        rawStates={(rawStates || []).filter(gs => !filterClass || classByUid[gs.user_id] === filterClass)}
        组名映射={Object.fromEntries((profiles || []).filter(p => !filterClass || p.class_name === filterClass).map(p => [p.user_id, p.group_no != null ? `${p.class_name || ''}第${p.group_no}组` : (p.display_name || p.user_id)]))}
        dayIndex={所选班进度 ? (所选班进度.dayIndex || 1) : (() => { try { return dayToWeekDay(Number(classDay) || 0).dayIndex || 1 } catch (e) { return 1 } })()}
        当前周={所选班进度 ? 所选班进度.week : classWeek}
        onGoGroup={() => { 跳('groups') }}
      />}
      {view === 'live' && 班级学期状态 === 'running' && (() => {
        // ★ V160：running 但最大学期周 >= 12 ⇒ 黄条提示结课
        const maxWeek = Math.max(0, ...(rawStates || []).map(gs => Math.max(0, ...((gs.state && gs.state.history) || []).map(h => Number(h.week) || 0))))
        return maxWeek >= 12 ? (
          <div data-semester-banner-full style={{
            margin: '0 20px 10px', padding: '10px 14px', borderRadius: 8,
            background: 'var(--warn-bg)', border: '1px solid var(--warn-border)',
            fontSize: 13, lineHeight: 1.7,
          }}>
            <Icon name="status.warn" size={13} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> 学期已满 12 周，tick 已停止推进。请到「我的 → 学期生命周期」点【结课归档】生成成绩单。
          </div>
        ) : null
      })()}
      {view === 'live' && 班级学期状态 !== 'running' && (
        <div data-semester-banner style={{
          margin: '0 20px 10px', padding: '10px 14px', borderRadius: 8,
          background: 班级学期状态 === 'finished' ? 'var(--warn-bg)' : 'var(--fill)',
          border: '1px solid var(--warn-border)', fontSize: 13, lineHeight: 1.7,
        }}>
          {班级学期状态 === 'finished' && <span><Icon name="log.ops" size={13} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> 本学期已结课（finished）—— tick 已停止推进。请到「我的 → 学期生命周期」下载成绩单并归档。</span>}
          {班级学期状态 === 'archived' && <span><Icon name="report.history" size={13} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> 本学期已归档——数据只读。新学期请点「新学期重置」。</span>}
          {班级学期状态 === 'draft' && <span><Icon name="date.week" size={13} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> 学期未开课（draft）—— 请在「教学进度控制」设定教学日或点「开课」。</span>}
        </div>
      )}
      {view === 'live' && chipDetail && (
        <div onClick={() => setChipDetail(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 32px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 22, width: '100%', animation: 'pageIn 0.2s ease-out' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}><Icon name={chipDetail.icon} size={15} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {chipDetail.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text)', padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, marginBottom: 10 }}>
              学生选择：<b>{chipDetail.answer}</b>
 {/* §32-U8-补 §1（主菜）：老师当场能指着屏幕问「你选这个的代价是什么？」—— R6 教学闭环
                文案调单源 代价文案(decisionId, answer)，与学生决策面板**逐字一致**（同源保证）；
                未登记的选项 ⇒ 返回 null ⇒ 不显示（不报错、不空行） */}
            {chipDetail.decisionId && 代价文案(chipDetail.decisionId, chipDetail.rawAnswer) && (
              <div style={{ display: 'inline-block', fontSize: 13, color: 'var(--bad)', background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', borderRadius: 7, padding: '3px 8px', marginTop: 6, lineHeight: 1.6 }}>
                {代价文案(chipDetail.decisionId, chipDetail.rawAnswer)}
              </div>
            )}
            </div>
            {chipDetail.tip && (
              <div style={{ display: 'inline-block', fontSize: 12, color: 'var(--info)', background: 'var(--primary-bg)', border: '1px solid var(--primary-border)', borderRadius: 7, padding: '3px 8px', lineHeight: 1.7 }}>
 设计考量：{chipDetail.tip}
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>课堂提示：可现场问学生"为什么这么选"</div>
            <button className="btn btn-primary" style={{ marginTop: 10, width: '100%' }} onClick={() => setChipDetail(null)}>知道了</button>
          </div>
        </div>
      )}
      {view === 'live' && groups !== null && (() => {
        const liveList = [...rawStates]
          .map(gs => {
            const p = (profiles.find(x => x.user_id === gs.user_id) || {})
            const hist = (gs.state && gs.state.history) || []
            const done = (gs.state && gs.state.doneDecisions) || {}
            // 周次筛选：1-12=历史周快照（history[].decisions），0=当前周（doneDecisions 实时）
            let entries, srcLabel
            if (liveWeekFilter > 0) {
              const snap = hist.find(h => h.week === liveWeekFilter)
              entries = Object.entries((snap && snap.decisions) || {})
              // 该周综合分（与称号口径一致）：出租率35%+好评率35%+品质30%
              const q = qualityOf(gs.state)
              const comp = snap ? Math.round((snap.occupancy || 0) * 0.35 + (snap.finalGoodRate || 0) * 0.35 + q * 0.3) : null
              srcLabel = `第${liveWeekFilter}周快照${comp != null ? ' · 综合' + comp + '分' : ''}`
            } else {
              entries = Object.entries(done)
              srcLabel = `第${gs.week || 1}周实时`
            }
            return {
              uid: gs.user_id,
              name: p.group_no ? `${p.class_name ? p.class_name + '·' : ''}第${p.group_no}组` : (p.display_name || gs.user_id.slice(0, 8)),
              hotel: (gs.state?.brand?.name || '') + (gs.state?.property?.name ? '·' + gs.state.property.name : ''),
              week: gs.week || gs.state?.week || 1,
              updated: gs.updated_at,
              entries, srcLabel,
            }
          })
          .sort((a, b) => new Date(b.updated) - new Date(a.updated))
        const totalDone = liveList.reduce((a, g) => a + g.entries.length, 0)
        const lastUpd = liveList.length ? liveList[0].updated : null
        return (
          <div>
            {/* 大屏统计条 */}
            <div className="card" style={{ background: 'var(--primary-bg)', borderColor: 'var(--primary-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--info)' }}>学生决策动向{liveWeekFilter > 0 ? `（第${liveWeekFilter}周快照）` : '（实时）'}</div>
                <span style={{ fontSize: 9, color: liveWeekFilter > 0 ? 'var(--text-muted)' : 'var(--good)', fontWeight: 700 }}>{liveWeekFilter > 0 ? '历史回放' : '● Realtime 自动刷新'}</span>
              </div>
              {/* 周次筛选chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(w => (
                  <button key={w} onClick={() => setLiveWeekFilter(w)}
                    style={{ fontSize: 10, fontWeight: liveWeekFilter === w ? 700 : 400, color: liveWeekFilter === w ? '#fff' : 'var(--text-sub)', background: liveWeekFilter === w ? 'var(--primary)' : 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {w === 0 ? '实时' : `第${w}周`}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {/* ★ V125-#7：口径必须显式 —— 这里是"已完成项数"（组内按 id 去重，改答案不重复计数），
                    不是"提交次数"。分母 = 组数 × 18 项；人均也带 /18，避免老师误读成"学生只做了一半"。 */}
                {[
                  { l: '本周已完成决策', v: `${totalDone} / ${groups.length * 18}`, t: '本周已完成决策项数（同一项改多次只算 1 项）· 结算后归零属正常（下周重新计）· 分母 = 组数 × 18 项' },
                  { l: '人均完成', v: `${groups.length ? (totalDone / groups.length).toFixed(1) : 0} / 18 项`, t: '每组最多 18 项；已完成项数 ÷ 组数' },
                  { l: '最近提交', v: lastUpd ? new Date(lastUpd).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '—', t: '最近一次云端存档时间' },
                ].map(s => (
                  <div key={s.l} title={s.t} style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '8px 0', textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>{s.v}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 6 }}>
                口径：本周已完成决策项数（同一项改答案不重复计数）· 分母 = {groups.length} 组 × 18 项 = {groups.length * 18} 项 · 与"提交次数"不是同一个数
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>结算后归零属正常（下周重新计）· 学生每保存一项决策，这里自动更新——课堂讲解时可现场点评</div>
            </div>

            {/* ★ V128-#3 批3：今天谁没做委托（只提示缺做 · 不排名 · 不计分） */}
            {(() => {
              const 组s = (groups || []).map(g => {
                const gs = (rawStates || []).find(x => x.user_id === g.uid)
                const rec = (gs && gs.state && gs.state.weekInputs && gs.state.weekInputs.每日委托) || []
                return { 组: g.name, 每日委托: rec }
              })
              const r = 今日缺做({ 组s, classDay })
              return (
                <div className="card" style={{ marginBottom: 8, borderColor: r.可判 && r.缺做.length ? 'var(--bad-border)' : 'var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: r.可判 && r.缺做.length ? 'var(--bad)' : 'var(--text)', marginBottom: 4 }}>今日委托（谁没做）</div>
                  <div style={{ fontSize: 12, color: r.可判 && r.缺做.length ? 'var(--bad)' : 'var(--text-sub)', lineHeight: 1.8 }}>
                    {!r.可判
                      ? '教学日历未同步（classDay=0）⇒ 暂不判定'
                      : r.缺做.length === 0
                        ? `今天第 ${r.天} 天 · 全班都做了 ✓`
                        : `今天第 ${r.天} 天 · 缺做 ${r.缺做.length} 组：${r.缺做.map(x => x.组).join('、')}`}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>只提示缺做，不排名、不计分 · 数据来自各组 weekInputs.每日委托</div>
                </div>
              )
            })()}

            {/* ★ V131 §1-E：思维看板（押注/理由/复盘 · 按偏差排序 · 不排名） */}
            {(() => {
              const rows = 排序思维行((groups || []).map(g => {
                const gs = (rawStates || []).find(x => x.user_id === g.uid)
                return 思维行({ 组: g.name, state: (gs && gs.state) || {}, week: Number(g.week || (gs && gs.state && gs.state.week) || 1) })
              }))
              return (
                <details style={{ marginBottom: 8 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-sub)', padding: '6px 2px' }}>
                    思维看板（押注 / 理由 / 三问复盘 · 按押注偏差排序 · 讲评顺序，不是排名）
                  </summary>
                  <div style={{ fontSize: 12, color: rows.some(r => r.押注 && r.押注.迟押) ? 'var(--warn)' : 'var(--text-muted)', padding: '4px 2px', fontWeight: 600 }}>
                    本周迟押 {rows.filter(r => r.押注 && r.押注.迟押).length}/{rows.length} 组
                  </div>
                  {rows.map(r => (
                    <details key={r.组} style={{ background: 'var(--bg)', borderRadius: 8, padding: '6px 10px', marginBottom: 6 }}>
                      <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text)', lineHeight: 1.7 }}>
                        <b>{r.组}</b>
                        {r.押注
                          ? ` · 押 ${r.押注.出租率}% / ${r.押注.净利方向}${r.押注.迟押 ? '（补押）' : ''}${r.实际出租率 != null ? ` → 实际 ${r.实际出租率}% / ${r.实际方向} · 得 ${r.得分} 分` : ' → 待结算'}`
                          : ' · 本周未押注'}
                        {r.偏差 >= 0 ? ` · 偏差 ${r.偏差} 点` : ''}
                        {` · 理由 ${r.理由条数}/3`}{r.复盘 ? ' · 已复盘' : ' · 未复盘'}
                      </summary>
                      <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.8, padding: '4px 0 2px' }}>
                        <div><b>开局取舍：</b>{r.开局.map(x => (
                          <span key={x.key} style={{ display: 'block' }}>
                            {x.标题}：{x.选 || '（未选）'}{x.选 && x.放弃.length ? ` · 放弃了：${x.放弃.join(' / ')}` : ''}{x.理由 ? ` · 理由：${x.理由}` : ''}
                          </span>
                        ))}</div>
                        <div style={{ marginTop: 4 }}><b>关键理由：</b>{r.理由s.map(x => <span key={x.id} style={{ display: 'block' }}>{x.id}：{x.文本 || '（未写）'}</span>)}</div>
                        <div style={{ marginTop: 4 }}><b>三问复盘：</b>{r.复盘 ? r.复盘.map((t, i) => <span key={i} style={{ display: 'block' }}>{i + 1}. {t}</span>) : '（未提交）'}</div>
                      </div>
                    </details>
                  ))}
                </details>
              )
            })()}

            {/* ★ V117-④⑤：过程分台账（默认收起 · 可导出 CSV） */}
            <details style={{ marginBottom: 8 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--text-sub)", padding: "6px 2px" }}>
                过程分台账（点开看；不并入四维评分）
              </summary>
              <ProcessLedger
                可导出={true}
                rows={(rawStates || []).map(gs => {
                  const p = (profiles || []).find(x => x.user_id === gs.user_id) || {}
                  const 组 = p.group_no ? "第" + p.group_no + "组" : (gs.group_key || "—")
                  const 日志 = (logs || []).filter(l => String(l.group_key || "") === String(gs.group_key || ""))
                  return 台账行FromCloud({ 组, 酒店名: (gs.state && gs.state.hotelName) || "", history: (gs.state && gs.state.history) || [], 归因日志: 日志, 选址承诺书: (gs.state && gs.state.选址承诺书) || null, 理由: (gs.state && gs.state.取舍理由) || [], 每日委托: (gs.state && gs.state.weekInputs && gs.state.weekInputs.每日委托) || [], 本周天数: Math.min(7, Math.max(0, Number(classDay) - (Number(gs.week || (gs.state && gs.state.week) || 1) - 1) * 7)), 押注历史: (gs.state && gs.state.押注历史) || [], 决策理由: (gs.state && gs.state.决策理由) || {} })
                })}
                onExport={() => {
                  try {
                    const rows = (rawStates || []).map(gs => {
                      const p = (profiles || []).find(x => x.user_id === gs.user_id) || {}
                      const 组 = p.group_no ? "第" + p.group_no + "组" : (gs.group_key || "—")
                      const 日志 = (logs || []).filter(l => String(l.group_key || "") === String(gs.group_key || ""))
                      return 台账行FromCloud({ 组, 酒店名: (gs.state && gs.state.hotelName) || "", history: (gs.state && gs.state.history) || [], 归因日志: 日志, 选址承诺书: (gs.state && gs.state.选址承诺书) || null, 理由: (gs.state && gs.state.取舍理由) || [], 每日委托: (gs.state && gs.state.weekInputs && gs.state.weekInputs.每日委托) || [], 本周天数: Math.min(7, Math.max(0, Number(classDay) - (Number(gs.week || (gs.state && gs.state.week) || 1) - 1) * 7)), 押注历史: (gs.state && gs.state.押注历史) || [], 决策理由: (gs.state && gs.state.决策理由) || {} })
                    })
                    const blob = new Blob(["\ufeff" + 台账CSV(rows)], { type: "text/csv;charset=utf-8" })
                    const a = document.createElement("a")
                    a.href = URL.createObjectURL(blob)
                    a.download = "过程分台账.csv"
                    a.click()
                    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
                  } catch (e) { 提示("导出失败：" + (e && e.message)) }
                }}
              />
            </details>

            <TeacherDiagnosis states={rawStates || []} logs={logs} week={classWeek || null} />
            {/* 决策流水（decision_log）：哪组/谁/做了什么/得到什么反馈 —— 新记录实时置顶 */}
            <div className="card t-flow" style={{ background: 'var(--warn-bg)', borderColor: 'var(--warn-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warn)' }}>决策流水</div>
                <span style={{ fontSize: 9, color: logs.length ? 'var(--good)' : 'var(--text-muted)', fontWeight: 700 }}>
                  {logs.length ? `最近 ${Math.min(logs.length, 20)} 条 · ● 实时` : '暂无记录'}
                </span>
              </div>
              {logs.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0', lineHeight: 1.7 }}>
                  学生每提交一项决策，这里会出现一行（时间 / 组 / 学生 / 决策 / 答案 / 属性反馈）
                </div>
              ) : (
                // ★ V115-② B-10：统一走 rosterIntegrity.只取有效流水（不再各处手写 filter）
                只取有效流水(logs, new Set((rawStates || []).map(g => String(g.group_key || '')).filter(Boolean))).slice(0, 20).map(lg => {
                  const p = profiles.find(x => x.user_id === lg.user_id) || {}
                  const d = decisions.find(x => x.id === lg.decision_id) || {}
                  const role = p.role_in_group && OWNER_LABELS[p.role_in_group] ? OWNER_LABELS[p.role_in_group] : null
                  const t = lg.created_at ? new Date(lg.created_at) : null
                  const hh = t ? [t.getHours(), t.getMinutes(), t.getSeconds()].map(n => String(n).padStart(2, '0')).join(':') : '—'
                  const fb = String(lg.feedback || '')
                  const fbColor = /[+＋]\d/.test(fb) ? 'var(--good)' : /[-－]\d/.test(fb) ? 'var(--bad)' : 'var(--text-sub)'
                  return (
                    <div key={lg.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--warn-bg)', fontSize: 11, lineHeight: 1.6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{hh}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary)' }}>{(() => { const k = String(lg.group_key || ''); const no = k.includes('|') ? k.split('|').pop() : k; const h = (groups || []).find(g => g.groupKey === k)?.hotelName; return (no ? '第' + no + '组' : '未分组') + (h ? ' · ' + h : '') })()}</span>
                        <span style={{ fontWeight: 600 }}>{p.display_name || '—'}</span>
                        {role && <span style={{ fontSize: 9, background: 'var(--primary-bg)', color: 'var(--info)', borderRadius: 4, padding: '1px 5px', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name={role.icon} size={10} /> {role.label}</span>}
                        <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name={d.icon} size={12} /> {d.name || lg.decision_id}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
                        <span style={{ color: 'var(--text)', flex: 1 }}>选择：{lg.answer || '—'}</span>
                        <span style={{ color: fbColor, fontWeight: 700, flexShrink: 0 }}>{fb}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* 各组决策流（最近更新的组排最上） */}
            {liveList.map(g => (
              <div className="card" key={g.uid} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{g.name} <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>{g.hotel}</span></span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: g.entries.length >= 18 ? 'var(--good)' : 'var(--primary)' }}>{g.entries.length}/18 项 · {g.srcLabel}</span>
                </div>
                {g.entries.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>该组本周还没有保存决策</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {g.entries.map(([id, val]) => {
                      const d = decisions.find(x => x.id === id)
                      const short = typeof val === 'object' ? (Array.isArray(val) ? val.slice(0, 2).join('＞') : Object.entries(val).slice(0, 2).map(([k, v]) => `${k}:${v}`).join(' ')) : String(val)
                      const isNew = newChips[g.uid] && newChips[g.uid].has(id)
                      return (
                        <span key={id} onClick={() => d && setChipDetail({ name: d.name, icon: d.icon, tip: d.tip, answer: short, decisionId: id, rawAnswer: val })}
                          style={{ fontSize: 10, cursor: 'pointer', background: isNew ? 'var(--warn-bg)' : 'var(--bg)', border: isNew ? '1px solid var(--primary)' : '1px solid var(--fill)', borderRadius: 6, padding: '3px 8px', color: isNew ? 'var(--warn)' : 'var(--text)', fontWeight: isNew ? 700 : 400, animation: isNew ? 'newChip 1.2s ease-out' : undefined }}>
                          {isNew ? '新 · ' : ''}{d ? short.slice(0, 22) : short.slice(0, 18)}
                        </span>
                      )
                    })}
                  </div>
                )}
                <div style={{ fontSize: 9, color: 'var(--border-strong)', marginTop: 6 }}>更新于 {new Date(g.updated).toLocaleString('zh-CN')}</div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* 排名 */}
      {view === 'ranking' && groups !== null && (
        <div>
          {/* 策略分布统计（课堂讨论：同样市场，不同打法） */}
          {(() => {
            const dist = {}
            ;(visibleRanked || []).forEach(g => {
              const gs = rawStates.find(x => x.user_id === g.uid) || {}
              const st = strategyOf((gs.state && gs.state.history) || [])
              if (!st) return
              const key = st.icon + ' ' + st.tag
              dist[key] = dist[key] || { n: 0, color: st.color, bg: st.bg }
              dist[key].n += 1
            })
            const entries = Object.entries(dist)
            if (!entries.length) return null
            return (
              <div className="card" style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warn)', marginBottom: 6 }}>全班策略分布（同样市场，不同打法）</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {entries.map(([key, v]) => (
                    <span key={key} style={{ fontSize: 11, fontWeight: 700, color: v.color, background: v.bg, borderRadius: 999, padding: '4px 12px' }}>
                      {key} × {v.n} 组
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 5 }}>课堂讨论点：为什么同样的市场条件下，不同打法结果不同？</div>
              </div>
            )
          })()}
          <div className="card" style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warn)', marginBottom: 6 }}>排序维度（点击切换，奖牌跟随变化）</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                { k: 'score', label: '综合评分' },
                { k: 'profit', label: '累计利润' },
                { k: 'occ', label: '平均出租率' },
                { k: 'rating', label: '口碑' },
              ].map(r => (
                <button key={r.k} onClick={() => setRankBy(r.k)}
                  style={{ fontSize: 11, fontWeight: rankBy === r.k ? 700 : 400, color: rankBy === r.k ? '#fff' : 'var(--text-sub)', background: rankBy === r.k ? 'var(--warn)' : 'var(--bg)', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="card" style={{ background: 'var(--warn-bg)', borderColor: 'var(--warn-border)' }}>
            <div style={{ fontSize: 13, color: 'var(--warn)', fontWeight: 600, marginBottom: 12 }}>积分排行榜（利润40/口碑25/出租率20/差评处理15）</div>
            {visibleRanked.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>暂无数据</div>}
            {visibleRanked.map((g, i) => (
              <div key={g.uid}>
              <div onClick={() => setExpandedUid(expandedUid === g.uid ? null : g.uid)} style={{ padding: '12px', background: '#fff', borderRadius: expandedUid === g.uid ? '10px 10px 0 0' : 10, marginBottom: expandedUid === g.uid ? 0 : 8, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.01)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = '' }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? 'var(--warn-border)' : i === 1 ? 'var(--border)' : i === 2 ? 'var(--warn-bg)' : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                  {['①', '②', '③'][i] ?? (i + 1)}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{g.hotel} <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{g.name} · {g.finished ? '已结业' : `第${g.week || 1}周`}</span> {g.title && <span style={{ fontSize: 11, color: 'var(--warn)' }}>{g.titleIcon} {g.title}</span>}<StrategyTag rawStates={rawStates} uid={g.uid} /></div>
                  <div style={{ height: 6, background: 'var(--fill)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: g.score + '%', background: scoreBar(g.score), borderRadius: 3 }}></div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>平均出租率 {g.occ}% · 口碑 {g.rating}{(() => {
                    // 职责完成度：该组学生职业集合对应的决策，在组档中的完成数
                    const gp = profiles.find(p => p.user_id === g.uid)
                    if (!gp || gp.group_no == null || !gp.class_name) return ''
                    const members = profiles.filter(p => p.class_name === gp.class_name && p.group_no === gp.group_no)
                    const roles = new Set(members.map(p => p.role_in_group).filter(r => r && !['student', 'teacher'].includes(r)))
                    const dutyIds = new Set(decisions.filter(d => roles.has(d.owner)).map(d => d.id))
                    if (!dutyIds.size) return ''
                    const gs0 = rawStates.find(x => x.user_id === g.uid) || {}
                    const done = (gs0.state && gs0.state.doneDecisions) || {}
                    const doneCnt = [...dutyIds].filter(id => done[id] !== undefined).length
                    return ` · 职责完成 ${doneCnt}/${dutyIds.size}`
                  })()}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: g.score == null ? 'var(--text-muted)' : scoreBar(g.score) }} title={g.score == null ? '该组还没有结算周：第 7 个游戏日自动出第一份周报，之后才有四维评分' : undefined}>{g.score == null ? '未结算' : g.score}</div>
 {/* §32-U2：排名行也能直接出经营报告（课堂上点排名即可讲评） */}
                  <button
                    title="一键图文经营报告（只读汇总 · 可打印/另存 PDF）"
                    onClick={e => { e.stopPropagation(); setReportUid(g.uid) }}
                    style={{ marginTop: 4, border: '1px solid var(--warn-border)', background: 'var(--warn-bg)', color: 'var(--warn)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'block' }}
                  >经营报告</button>
                  {g.scorePrev != null && g.score !== g.scorePrev && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: g.score > g.scorePrev ? 'var(--good)' : 'var(--bad)' }}>
                      {g.score > g.scorePrev ? '↑' : '↓'}{Math.abs(g.score - g.scorePrev)}
                    </div>
                  )}
                  {g.scorePrev != null && g.score === g.scorePrev && (
                    <div style={{ fontSize: 10, color: 'var(--border-strong)' }}>—</div>
                  )}
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{expandedUid === g.uid ? '▲' : '▼'}</span>
              </div>
              {expandedUid === g.uid && <GroupDetail uid={g.uid} rawStates={rawStates} name={g.name} allNotes={allNotes} onDeleteNote={handleDeleteNote} onSaved={loadAll} profiles={profiles} onGoDecision={(id) => { setExpandedUid(null); onGoDecision && onGoDecision(id) }} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 分组管理 */}
      {view === 'groups' && groups !== null && (
        <div>
          <div className="card">
            <div style={{ fontSize: 13, color: 'var(--warn)', fontWeight: 600, marginBottom: 4 }}>分组与班级管理</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
              已注册学生 {profiles.length} 人 · 直接输入组号和班级即可保存（云端的进度数据不受影响）
            </div>
            {profiles.some(p => !p.group_no) && (
              <div style={{ fontSize: 12, color: 'var(--bad)', background: 'var(--bad-bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span>有 {profiles.filter(p => !p.group_no).length} 名学生还没分配组号</span>
                <button
                  onClick={async () => {
                    if (!window.confirm('按注册顺序每 6 人一组自动填充未分组学生的组号？')) return
                    const ungrouped = profiles.filter(p => !p.group_no)
                    for (let i = 0; i < ungrouped.length; i++) {
                      await saveProfile(ungrouped[i], { group_no: Math.floor(i / 6) + 1 })
                    }
                  }}
                  style={{ border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '6px 10px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                >
                  一键分组（每6人）
                </button>
              </div>
            )}
            {profiles.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>
                还没有学生注册。学生用学号注册后会自动出现在这里。
              </div>
            )}
            {profiles.map(p => {
              // 关联该学生的经营进度
              const g = groups.find(x => x.uid === p.user_id)
              return (
                <div key={p.user_id} style={{ padding: 12, background: 'var(--bg)', borderRadius: 10, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>
                      {p.display_name || p.user_id.slice(0, 8)}
                      {p.student_no && p.student_no !== p.display_name && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>（学号 {p.student_no}）</span>}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {g ? `${g.hotel} · ${g.finished ? '已结业' : `第${g.week || 1}周`}` : '未开始经营'}
                      {g && !g.finished && <span style={{ marginLeft: 8, color: 'var(--warn)' }}>{g.week || 1}/12 周</span>}
                    </span>
                  </div>
                  {g && !g.finished && (
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: ((g.week || 1) / 12 * 100) + '%', background: 'var(--primary)', borderRadius: 2 }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label style={{ fontSize: 12, color: 'var(--text-sub)', flexShrink: 0 }}>组号</label>
                    <input
                      type="number"
                      min="1"
                      value={p.group_no || ''}
                      placeholder="如 1"
                      onChange={e => saveProfile(p, { group_no: e.target.value ? Number(e.target.value) : null })}
                      style={{ width: 60, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit' }}
                    />
                    <label style={{ fontSize: 12, color: 'var(--text-sub)', flexShrink: 0 }}>班级</label>
                    <input
                      value={p.class_name || ''}
                      placeholder="如 酒管2401"
                      onChange={e => saveProfile(p, { class_name: e.target.value })}
                      style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit' }}
                    />
                  </div>
                </div>
              )
            })}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              设置组号后，排名和总览会显示「第N组」；班级用于多班教学区分。修改即时生效。
            </div>
          </div>
        </div>
      )}

 {/* §32-U8-补 §2①：老师事件注入面板 */}
      {view === 'inject' && <InjectionPanel rawStates={rawStates} profiles={profiles} user={user} classDay={classDay} classWeek={classWeek} />}

 {/* §32-U8-补 §2④：AI 领班全班默认授权 + 代管巡览 */}
      {view === 'supervisor' && <SupervisorPanel rawStates={rawStates} profiles={profiles} />}

      {/* 教学参考 */}
      {view === 'teaching' && (
        <div>
          <div className="card">
            <div className="card-title">四维评分规则（与学生端最终成绩同口径）</div>
            {[
              // 🔴 P3-2：与学生端 FinalResult 的实际分段同口径（T1.1 后为 500000/300000/100000/0）
              //    原写「≥5万=100分」而代码早已是 50 万 ⇒ 老师照此讲、学生照此做 = 教错了
              { label: '利润', weight: 40, rule: '累计利润 ≥50万=100分 / ≥30万=85 / ≥10万=70 / ≥0=55 / 亏损=40' },
              { label: '口碑', weight: 25, rule: '平均好评率 ≥90%=95分 / ≥85%=85 / ≥75%=70 / ≥60%=55 / <60%=40' },
              { label: '出租率', weight: 20, rule: '平均出租率 ≥75%=95分 / ≥65%=80 / ≥55%=65 / ≥45%=50 / <45%=40' },
              { label: '差评处理', weight: 15, rule: '按各周处理率平均：≥90%=95 / ≥70%=85 / ≥50%=70 / ≥30%=55 / >0%=40；零差评=100' },
            ].map(d => (
              <div key={d.label} style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{d.label} <span style={{ color: 'var(--primary)' }}>权重{d.weight}%</span></div>
                <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2 }}>{d.rule}</div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>加权总分 = 各维度得分 × 权重之和；S≥90 / A≥80 / B≥70 / C≥60 / D&lt;60</div>
          </div>
          <div className="card">
            <div className="card-title">事件一览（12种，条件触发非纯随机）</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
              讲事件课时对照：每个事件的触发条件都是学生的某个经营状态——"事件是你们自己招来的"
            </div>
            {EVENT_INFO.map(e => (
              <div key={e.name} style={{ padding: '8px 10px', background: e.type === 'good' ? 'var(--good-bg)' : e.type === 'crisis' ? 'var(--warn-bg)' : 'var(--bad-bg)', borderRadius: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: e.type === 'good' ? 'var(--good)' : e.type === 'crisis' ? 'var(--warn)' : 'var(--bad)' }}>
                  <Icon name={e.icon} size={13} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {e.name}{e.type === 'crisis' && ' · 危机'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 2 }}>触发条件：{e.trigger}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ background: 'var(--warn-bg)', borderColor: 'var(--warn-border)' }}>
            <div style={{ fontSize: 13, color: 'var(--warn)', fontWeight: 600, marginBottom: 8 }}>教学参考 · 18项决策最佳实践</div>
            <div style={{ fontSize: 11, color: 'var(--warn)', marginBottom: 12 }}>
              老师讲解时可对照：每个决策的行业惯例和教学要点
            </div>
          </div>
          {decisions.map((d, i) => (
            <div key={d.id} className="card" style={{ marginBottom: 10, padding: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                {i + 1}. <Icon name={d.icon} size={13} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {d.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 6 }}>{d.desc}</div>
              <div style={{ fontSize: 12, color: 'var(--warn)', lineHeight: 1.6, background: 'var(--warn-bg)', borderRadius: 8, padding: 10 }}>
 {d.tip || '权衡利弊后选择。'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 我的视图（教师信息 + 功能入口 + 退出） */}
      {view === 'me' && (
        <div>
          <div className="card" style={{ textAlign: 'center', padding: 24 }}>
 <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--warn-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '0 auto 10px' }}>‍</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>教师账号 · {cloudOk ? '云端已连接' : '云端不可用'}</div>
            {/* ★ V152 §2：续营开关（班级级 · 默认关 · 判据：关 ⇒ 学生无入口） */}
            <div data-continue-toggle="1" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--border)', textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>续营 12 周（可选）· 班级开关：<b style={{ color: 续营开关 ? 'var(--good)' : 'var(--text-muted)' }}>{续营开关 ? '开' : '关（默认）'}</b></div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.7 }}>
                开启后：已跑满 12 周的组在「我的经营成果」页出现「继续经营第 13–24 周」入口；学期成果仍以<b>前 12 周</b>为准，不被覆盖。
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={async () => { const ok2 = await setClassContinue(true, filterClass || undefined); if (ok2) { set续营开关(true); set续营态('已开启（全班可见）') } else set续营态('保存失败（迁移未应用或权限不足）') }}
                  style={{ flex: 1, minHeight: 44, border: 'none', background: 'var(--good)', color: '#fff', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>开启续营</button>
                <button onClick={async () => { const ok2 = await setClassContinue(false, filterClass || undefined); if (ok2) { set续营开关(false); set续营态('已关闭（学生无入口）') } else set续营态('保存失败（迁移未应用或权限不足）') }}
                  style={{ flex: 1, minHeight: 44, border: '1px solid var(--border-strong)', background: 'var(--card)', color: 'var(--text-sub)', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>关闭续营</button>
              </div>
              {续营态 && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{续营态}</div>}
            </div>
            {/* ★ V157 阶段1：学期生命周期 —— 结课归档（不删数据）+ 新学期重置（archived 后可用） */}
            <div data-semester-lifecycle="1" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--border)', textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>学期生命周期：当前 = <b style={{ color: 'var(--info)' }}>{班级学期状态}</b>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>（draft 未开课 / running 上课 / finished 已结课 / archived 已归档）</span></div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button data-semester-finish onClick={async () => {
                  if (!window.confirm('结课归档：将生成快照文件（六组 history + 成绩单），并把学期置为 finished（学生端只读，不能继续结算）。不删除任何数据。继续？')) return
                  // ① 快照（值拷贝冻结 · 含六组 history + 成绩单 + 口径版本 + 时间）
                  const rows = 生成成绩单行()
                  const 快照 = 归档快照({ 班级: filterClass || (profiles[0] && profiles[0].class_name) || '', 生成人: user?.name || '教师', rows, 摘要: vis摘() })
                  快照.生成时间 = new Date().toLocaleString('zh-CN', { hour12: false })
                  快照.学期状态 = 'finished'
                  const 日期 = new Date().toISOString().slice(0, 10)
                  const blob = new Blob([JSON.stringify(快照, null, 1)], { type: 'application/json' })
                  const a2 = document.createElement('a'); a2.href = URL.createObjectURL(blob); a2.download = `学期快照-${快照.班级}-${日期}.json`; a2.click(); URL.revokeObjectURL(a2.href)
                  const blob2 = new Blob(['﻿' + 归档CSV(快照)], { type: 'text/csv;charset=utf-8' })
                  const a3 = document.createElement('a'); a3.href = URL.createObjectURL(blob2); a3.download = `学期归档-${快照.班级}-${日期}.csv`; a3.click(); URL.revokeObjectURL(a3.href)
                  // ② 置 finished（服务器侧写 semester_status；应用层不删任何数据）
                  const ok2 = await setSemesterStatus('finished', filterClass || undefined)
                  if (ok2) { set班级学期状态2('finished'); set学期态提示('已结课（finished）· 快照已下载 · 学生端只读') }
                  else set学期态提示('置状态失败（迁移未应用或权限不足）——快照文件仍有效')
                }} style={{ flex: 1, minHeight: 44, border: 'none', background: 'var(--info)', color: '#fff', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>结课归档（生成快照 + finished）</button>
                <button data-semester-archive disabled={班级学期状态 !== 'finished'} onClick={async () => {
                  if (!window.confirm('归档：本学期置为 archived（数据只读冻结，一个字节不删不改）。归档后学生端与教师端均不可再结算，新学期需点「新学期重置」。继续？')) return
                  const ok2 = await setSemesterStatus('archived', filterClass || undefined)
                  if (ok2) { set班级学期状态2('archived'); set学期态提示('已归档（archived）· 数据只读冻结 · 快照用结课时下载的文件') }
                  else set学期态提示('置归档失败（权限不足）——状态未变')
                }} style={{ flex: 1, minHeight: 44, border: 'none', background: 'var(--warn)', color: '#fff', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', opacity: 班级学期状态 === 'finished' ? 1 : 0.5 }}>归档（finished 后数据只读冻结）</button>
                <button data-semester-reset disabled={班级学期状态 !== 'archived'} onClick={async () => {
                  if (!window.confirm('新学期重置：将清空【当前班】全部组的经营进度（game_states 整包重置为空档）并回 draft；归档文件与 bak/ 一律不动。此操作不可恢复，确定？')) return
                  // 红线：绝不删数据文件；只把本班 game_states 置为空档 + 状态回 draft
                  const ok2 = await resetClassGameStates(filterClass || (profiles[0] && profiles[0].class_name) || undefined)
                  const ok3 = ok2 ? await setSemesterStatus('draft', filterClass || undefined) : false
                  if (ok3) { set班级学期状态2('draft'); set学期态提示('新学期重置完成（回 draft · 仅当前班）') }
                  else set学期态提示('重置失败（权限/迁移）——数据未动')
                }} style={{ flex: 1, minHeight: 44, border: '1px solid var(--border-strong)', background: 'var(--card)', color: 'var(--text-sub)', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', opacity: 班级学期状态 === 'archived' ? 1 : 0.5 }}>新学期重置（仅 archived 后可用）</button>
              </div>
              {学期态提示 && <div data-semester-status-msg style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{学期态提示}</div>}
            </div>
            {/* ★ V163 · 一键收口向导 + 冷备状态卡 + 归档管理（执行器闭包 = 本组件的快照/冷备/置状态实现） */}
            <OneTouchCloseoutPanel
              filterClass={filterClass} user={user} 班级学期状态={班级学期状态}
              maxWeek={(() => Math.max(0, ...(rawStates || []).map(gs => Math.max(0, ...((gs.state && gs.state.history) || []).map(h => Number(h.week) || 0)))))()}
              onDone={() => { fetchClassState(filterClass || undefined).then(cs => { set班级学期状态2(cs.学期状态 || 'running') }).catch(() => {}) /* 静默理由：刷新学期态失败不阻塞收口主流程，面板会另行报错 */ }}
              executors={{
                snapshot: async () => {
                  const rows = 生成成绩单行()
                  const 快照 = 归档快照({ 班级: filterClass || (profiles[0] && profiles[0].class_name) || '全班', 生成人: user?.name || '教师', rows, 摘要: vis摘() })
                  快照.生成时间 = new Date().toLocaleString('zh-CN', { hour12: false })
                  快照.学期状态 = 'finished'
                  const 日期 = new Date().toISOString().slice(0, 10)
                  const json文本 = JSON.stringify(快照, null, 1)
                  const csv文本 = '﻿' + 归档CSV(快照)
                  const files = {}
                  for (const [名, 内容, 类型, 后缀] of [['学期快照.json', json文本, 'application/json', 'json'], ['学期归档.csv', csv文本, 'text/csv;charset=utf-8', 'csv']]) {
                    const h = await sha256Hex(内容)
                    files[名] = { size: 内容.length, sha256: h, content: 内容 }
                    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([内容], { type: 类型 })); a.download = `学期${后缀 === 'json' ? '快照' : '归档'}-${快照.班级 || '全班'}-${日期}.${后缀}`; a.click(); URL.revokeObjectURL(a.href)
                  }
                  return { files, note: `快照已下载（${Object.keys(files).length} 件 · 服务端已留档）` }
                },
                coldbackup: async () => {
                  const cs = await fetchClassState(filterClass || undefined)
                  const dump = { 说明: 'V163 应用层 DB 逻辑备份（第②步 · 服务器全量冷备用 closeout-semester.sh）', 班级: filterClass || '全班', 导出时间: new Date().toISOString(), class_state: cs, groups: (rawStates || []).map(gs => ({ uid: gs.uid, group_name: gs.group_name, state: gs.state })) }
                  const content = JSON.stringify(dump)
                  const h = await sha256Hex(content)
                  const 名 = `db-逻辑备份-${filterClass || '全班'}.json`
                  return { files: { [名]: { size: content.length, sha256: h, content } }, note: '应用层冷备已留档（全量 pg_dump 走管理员脚本）' }
                },
                finish: async () => { const ok2 = await setSemesterStatus('finished', filterClass || undefined); if (!ok2) throw new Error('置 finished 失败（迁移未应用或权限不足）'); return {} },
                archive: async () => { const ok2 = await setSemesterStatus('archived', filterClass || undefined); if (!ok2) throw new Error('置 archived 失败（迁移未应用或权限不足）'); return {} },
              }}
            />
            {/* 本班统计摘要 */}
            {groups && groups.length > 0 && (() => {
              const withData = groups.filter(g => g.historyCount > 0)
              const avgScore = withData.length ? Math.round(withData.reduce((a, g) => a + g.score, 0) / withData.length) : 0
              const latest = groups.reduce((a, g) => (a && a.updated > g.updated ? a : g), groups[0])
              return (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {[
                    { l: '已开档组', v: groups.length, to: 'groups' },
                    { l: '全班平均分', v: avgScore, to: 'ranking' },
                    { l: '最近动向', v: latest && latest.updated ? new Date(latest.updated).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '—', to: 'live' },
                  ].map(s => (
                    <div key={s.l} onClick={() => 跳(s.to)} style={{ flex: 1, background: 'var(--warn-bg)', borderRadius: 8, padding: '7px 0', textAlign: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--warn-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--warn-bg)'}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warn)' }}>{s.v}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{s.l} ›</div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
          <div className="card">
            <div className="card-title">功能入口</div>
            {[
              { v: 'overview', icon: 'nav.report', label: '班级总览 & 教学进度控制', desc: '全班统计 / 锁周 / CSV导出' },
              { v: 'inject', icon: 'note.caliber', label: '事件注入（课堂用）', desc: '8 事件 × 周 × 全班/指定组 · 只影响未来校验' },
              { v: 'supervisor', icon: 'role.manager', label: 'AI 领班（全班默认授权）', desc: '默认全关 · 二期 R3/R6 真执行 · 代管巡览' },
              { v: 'groups', icon: 'nav.group', label: '分组管理', desc: '分组 / 班级 / 学号' },
              { v: 'teaching', icon: 'teach.point', label: '教学参考', desc: '四维评分规则 / 事件图鉴' },
            ].map(x => (
              <div key={x.v} onClick={() => 跳(x.v)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 4px', borderBottom: '1px solid var(--fill)', cursor: 'pointer' }}>
                <span style={{ fontSize: 18, display: 'flex' }}><Icon name={x.icon} size={18} /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{x.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{x.desc}</div>
                </div>
                <span style={{ color: 'var(--border-strong)' }}>›</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '8px 0 0' }}>
            <button className="btn btn-ghost" style={{ width: '100%', padding: '13px 0', color: 'var(--bad)' }} onClick={onLogout}>退出登录</button>
          </div>
        </div>
      )}

      </div>
    </div>
       </div>
    {大屏 && view !== 'inject' && <aside className="t-side"><InjectionPanel rawStates={rawStates} profiles={profiles} user={user} classDay={classDay} classWeek={classWeek} /></aside>}
    {投屏开 && <ClassroomScreen groups={groups} rawStates={rawStates} classByUid={classByUid} filterClass={filterClass} onExit={() => set投屏开(false)} />}
        {成绩单开 && <ReportCardPrint rows={生成成绩单行()} 班级={filterClass || (profiles[0] && profiles[0].class_name) || ''} onClose={() => set成绩单开(false)} 下载={() => 下载成绩单CSV(生成成绩单行(), `期末成绩单-${filterClass || '全班'}-${new Date().toISOString().slice(0, 10)}.csv`)} />}
        {复盘开 && (() => {
          const pMap3 = Object.fromEntries(profiles.map(p => [p.user_id, p]))
          const 组数据 = {}
          for (const g of (filterClass ? groups.filter(g => classByUid[g.uid] === filterClass) : groups)) {
            const gs = rawStates.find(x => x.user_id === g.uid) || {}
            const p = pMap3[g.uid] || {}
            const 组号 = p.group_no != null ? `${p.class_name || ''}第${p.group_no}组` : g.name
            组数据[组号] = { capital: gs.state && gs.state.capital, history: (gs.state && gs.state.history) || [], decisionChanges: (gs.state && gs.state.decisionChanges) || [] }
          }
          return <SemesterReviewOverlay rows={生成成绩单行()} 组数据={组数据} 班级学期状态={班级学期状态} filterClass={filterClass} onClose={() => set复盘开(false)} />
        })()}
    </div>
 {/* 底部三导航：排名 / 实时决策 / 我的（移出滚动容器，作为 .app 的兄弟常驻底部，与学生端同构） */}
    {/* ★ V97 用户要求：导航栏上方左右各一个 —— 左「‹ 返回」（弹栈回上一处）· 右「上一页 ›」（同 popstate 语义） */}
    <div style={{ display: 'flex', gap: 8, padding: '0 12px 6px' }}>
      <button className="btn btn-ghost" style={{ flex: 1, padding: '8px 0' }} disabled={!栈.current.可以返回()} onClick={() => 回()}>‹ 返回</button>
      <button className="btn btn-ghost" style={{ flex: 1, padding: '8px 0' }} disabled={!栈.current.可以返回()} onClick={() => 回()}>上一页 ›</button>
    </div>
    <div className="tabbar">
      {[
        { key: 'live', icon: 'nav.live', label: '实时决策' },
        { key: 'ranking', icon: 'nav.rank', label: '排名' },
        { key: 'me', icon: 'nav.me', label: '我的' },
      ].map(v => (
        <button key={v.key} className={`tab ${view === v.key ? 'active' : ''}`} onClick={() => 跳(v.key)}>
          <div className="tab-icon"><Icon name={v.icon} size={20} /></div>
          <div className="tab-label">{v.label}</div>
        </button>
      ))}
    </div>
 {/* §32-U2：经营报告（全屏覆盖层 · 只读汇总 · 可打印） */}
    {reportUid && (() => {
      const g = (groups || []).find(x => x.uid === reportUid)
      const gs = rawStates.find(x => x.user_id === reportUid)
      return (
        <>
          <TeacherReport
            gs={gs}
            组名={g ? g.name : ''}
            批注={allNotes.filter(n => n.student_uid === reportUid)}
            onClose={() => setReportUid(null)}
          />
        </>
      )
    })()}
    {/* §33-V80：12 周任务书（全屏覆盖层 · 只读 · 可打印） */}
    {tasksOpen && <SemesterTasks onClose={() => setTasksOpen(false)} />}
    </>
  )
}
