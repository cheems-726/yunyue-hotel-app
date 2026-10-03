import { useState, useEffect } from 'react'
import Icon from './Icon.jsx'
import { getTitle } from './hotelTitle.js'
import { missingWeeks, missingLabel } from './missingWeeks.mjs'
import { decisions as ALL_DECISIONS } from './decisions.js'
import { qualityOf } from './attrs.js'
import { buildDailyReport, reconcileWithWeek } from './dailyReport.mjs'
import { GOP_LABEL, GOP_DEF, NET_LABEL, NET_DEF, pct } from './metricDefs.mjs'
import { SCALE } from './stateMigration.mjs'   // 资金三数单源（W2 收尾：预警线不再硬编码）

const DECISION_NAMES_MAP = Object.fromEntries(ALL_DECISIONS.map(d => [d.id, d]))

// 周内组件：WeeklyReport 每次结算重新挂载，tipOpen 用模块级 useRef 不可行——放组件内

// 数字滚动动画（count-up，缓出曲线）
function useCountUp(target, dur = 800) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf
    const t0 = performance.now()
    const tick = (t) => {
      const p = Math.min((t - t0) / dur, 1)
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // 兜底：后台标签/省电模式会冻结 rAF，超时直接显示终值，防止数字停在0
    const bail = setTimeout(() => setV(target), dur + 300)
    return () => { cancelAnimationFrame(raf); clearTimeout(bail) }
  }, [target])
  return v
}

// 数字滚动显示（负数利润从0滑向负值也自然）
function CountNum({ n, wan = false }) {
  const v = useCountUp(n)
  if (wan) return <>{(v / 10000).toFixed(1)}</>
  return <>{v.toLocaleString()}</>
}

// 危机事件限时应对卡：30秒内选方案，选择存档影响下周结算（超时=自动"不理会"，危机不应对就是最差应对）
// ★ §32-U1 R2 三级视觉之 L3：上热门 = 全屏红色警示（不可跳过 · 强读 8 秒才出「我已知晓」）
function HotReviewOverlay({ event, onDone }) {
  const [hold, setHold] = useState(8)
  useEffect(() => {
    if (hold <= 0) return
    const t = setTimeout(() => setHold(hold - 1), 1000)
    return () => clearTimeout(t)
  }, [hold])
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(153,27,27,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, color: '#fff' }}>
      <div style={{ fontSize: 52, marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Icon name="status.critical" size={52} /></div>
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>差评上热门 · 全网热榜第一</div>
      <div style={{ fontSize: 13, lineHeight: 1.8, maxWidth: 420, textAlign: 'center', opacity: 0.95 }}>{event.text}</div>
      <button
        disabled={hold > 0}
        onClick={onDone}
        style={{ marginTop: 20, fontSize: 12, fontWeight: 700, background: hold > 0 ? 'rgba(255,255,255,0.15)' : '#fff', color: hold > 0 ? 'rgba(255,255,255,0.6)' : '#991B1B', border: 'none', borderRadius: 10, padding: '10px 22px', cursor: hold > 0 ? 'not-allowed' : 'pointer' }}>
        {hold > 0 ? `请认真读 ${hold} 秒…` : '我已知晓，进入应对'}
      </button>
    </div>
  )
}

function CrisisCard({ event, week }) {
  const CHOICES = [
    { label: '立即公开整改+补偿', effect: '下周口碑 +2%（最佳应对）' },
    { label: '逐条真诚回复', effect: '下周口碑 +1%（稳妥应对）' },
    { label: '不理会', effect: '下周口碑 -2%，可能再发酵（最差应对）' },
  ]
  const [timeLeft, setTimeLeft] = useState(30)
  const [choice, setChoice] = useState(null)
  // ★ §32-U1 R2 L3：上热门事件先出全屏红警示（读 8 秒）⇒ 才进既有应对卡（三级视觉的最高级）
  const [hotSeen, setHotSeen] = useState(event.name.includes('上热门') ? false : true)
  useEffect(() => {
    if (choice) return
    if (timeLeft <= 0) { pick('不理会'); return }
    const t = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft, choice])
  function pick(label) {
    if (choice) return
    setChoice(label)
    try { localStorage.setItem('hotel-sim-crisis-response', JSON.stringify({ week, choice: label })) } catch (e) {}
  }
  if (!hotSeen) return <HotReviewOverlay event={event} onDone={() => setHotSeen(true)} />
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 8, background: '#FFF4E0', border: '1px solid #FBE3B3' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#A96407' }}>
          <Icon name={event.icon} size={14} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {event.name}<span style={{ fontSize: 10, background: '#E8940F', color: '#fff', borderRadius: 5, padding: '1px 6px', marginLeft: 6 }}>危机</span>
        </div>
        {!choice && <span style={{ fontSize: 18, fontWeight: 700, color: timeLeft <= 10 ? '#EF4444' : '#A96407' }}>{timeLeft}s</span>}
      </div>
      <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, marginTop: 3 }}>{event.text}</div>
      {!choice ? (
        <div style={{ marginTop: 8 }}>
          {CHOICES.map(c => (
            <div key={c.label} onClick={() => pick(c.label)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#fff', borderRadius: 8, marginBottom: 5, cursor: 'pointer', border: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</span>
              <span style={{ fontSize: 10, color: '#A96407' }}>{c.effect}</span>
            </div>
          ))}
          <div style={{ fontSize: 10, color: '#9CA3AF' }}>⏱ {timeLeft}s 内不选将自动按"不理会"处理</div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#065F46', fontWeight: 600, marginTop: 6 }}>你的应对：{choice}——结果将在下周结算体现</div>
      )}
    </div>
  )
}

// ★ §32-U8-补 §2④：AI 领班复盘卡（学生可见）—— 授权设置（收窄/放宽）+「这周领班替你做了什么」
//   · 一期口径（B3 §六）：领班【只记录不执行】—— 卡内明示，不许含糊（"声明了没发生"是本项目老病）
//   · 两层授权：全班默认（老师端写 class_state）· 学生个人收窄/放宽（本卡开关 · localStorage）
//   · 后端读取不需要 —— 本卡只读 result.supervisorRecord（App 层结算时生成并挂到周报）
function SupervisorCard({ result }) {
  const [覆盖, set覆盖] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem('hotel-sim-supervisor-auth') || 'null'); return (v && typeof v === 'object') ? v : {} } catch (e) { return {} }
  })
  const rec = result && result.supervisorRecord
  const 生效 = (rec && rec.授权快照) || {}
  const 项 = [
    { key: 'price_adj', label: '调价幅度（领班可在 ±10% 内调价）' },
    { key: 'overbook', label: '超售清零止损' },
    { key: 'energy', label: '客房温度回归 23℃' },
  ]
  function 设置(key, v) {
    const 新 = { ...覆盖 }
    if (v === '默认') delete 新[key]; else 新[key] = { ok: v === '开' }
    set覆盖(新)
    try { localStorage.setItem('hotel-sim-supervisor-auth', JSON.stringify(新)) } catch (e) {}
  }
  const 状态字 = (key) => {
    if (覆盖[key] === undefined) return '默认'
    return (覆盖[key] && 覆盖[key].ok) ? '放宽' : '收窄'
  }
  return (
    <div className="card">
      <div className="card-title">AI 领班（本周复盘）</div>
      <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.7, marginBottom: 8 }}>
        领班 = 你不在时的"看不见的手"：按授权范围代管决策，并留痕可复盘。
        <b> 二期：R3（超售止损）/ R6（能耗回归）的代管动作【已真实生效】</b>（并入你的决策集 · 你自己做过的项领班不碰）；
        R1/R2（调价）需竞对价每日数据，二期暂不开放 · 默认全关 = 全班行为一致（公平基准）。
      </div>
      {rec && (rec.actions.length > 0 || rec.reports.length > 0) ? (
        <div style={{ marginBottom: 8 }}>
          {rec.actions.map((a, i) => {
            const 生效 = rec.代管决策 && rec.代管决策[a.item] !== undefined
            const 动作文 = a.item === 'overbook' ? `超售清零（超额预订 → 0）` : a.item === 'energy' ? `室温回归 23℃` : a.item === 'pricing' ? `建议调价至 ${a.to} 元` : a.item
            return (
            <div key={`a${i}`} style={{ padding: '8px 10px', background: '#FFF4E0', border: '1px solid #FBE3B3', borderRadius: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#A96407' }}>
                【{a.ruleId} · {生效 ? '已代管执行' : '建议（该项由你自己做了 / 未开放）'}】{动作文}
                {生效 && <span style={{ fontSize: 10, background: '#065F46', color: '#fff', borderRadius: 5, padding: '1px 6px', marginLeft: 6 }}>已生效</span>}
              </div>
              <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.7, marginTop: 2 }}>{a.reason}</div>
              {生效 && <div style={{ fontSize: 10, color: '#065F46', marginTop: 2 }}>↳ 本周结算已按代管后的决策计算（学生决策优先：你自己做过的项领班不碰）</div>}
            </div>
            )
          })}
          {rec.reports.map((r, i) => (
            <div key={`r${i}`} style={{ padding: '8px 10px', background: '#F9FAFB', border: '1px solid #F3F4F6', borderRadius: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#4B5563' }}>【{r.ruleId} · 仅报告】</div>
              <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.7, marginTop: 2 }}>{r.reason}</div>
            </div>
          ))}
          {typeof rec.代管率 === 'number' && (
            <div style={{ fontSize: 11, color: '#6B7280' }}>本周代管率：<b>{Math.round(rec.代管率 * 100)}%</b>（领班动作 ÷（领班动作 + 你的决策）· 健康区间 0–30%）</div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>本周领班没有需要动作/建议的条目（或尚未授权）。</div>
      )}
      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>我的授权设置（在全班默认之上收窄 / 放宽）</div>
      {项.map(x => (
        <div key={x.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #F3F4F6' }}>
          <span style={{ fontSize: 12, color: '#374151' }}>{x.label}<span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 6 }}>全班默认：{(生效[x.key] && 生效[x.key].ok) ? '已授权' : '未授权'}</span></span>
          <span style={{ display: 'flex', gap: 4 }}>
            {['默认', '开', '关'].map(v => (
              <button key={v} onClick={() => 设置(x.key, v)}
                style={{ fontSize: 10, fontWeight: 700, border: 'none', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', background: 状态字(x.key) === v ? '#E8940F' : '#F3F4F6', color: 状态字(x.key) === v ? '#fff' : '#6B7280' }}>
                {v === '默认' ? '跟随默认' : v === '开' ? '放宽' : '收窄'}
              </button>
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}

// 周报组件：展示结算结果（决策→结果→复盘）
export default function WeeklyReport({ result, onClose, onLater, history = [], brand = {}, attrs }) {
  const [dailyOpen, setDailyOpen] = useState(false)   // B2-2：日报折叠态（随周报重挂载，符合既有惯例）
  // 🔴 W2-3：牌位值读【净利润】权威字段（netProfit；旧档回退 profit —— 引擎恒等式保证同值）
  const netP = Number.isFinite(result.netProfit) ? result.netProfit : result.profit
  const isProfit = netP >= 0
  const [copied, setCopied] = useState(false)
  const [tipOpen, setTipOpen] = useState(null) // 决策摘要展开的 tip 行
  // 称号变化检测：结算前 vs 结算后（晋升时刻/降级警示）
  const quality = qualityOf(attrs)  // 品质统一来源（N2）
  const last = history.length ? history[history.length - 1] : null
  const before = getTitle(last ? last.occupancy : 0, last ? last.finalGoodRate : 85, quality)
  const after = getTitle(result.occupancy, result.finalGoodRate, quality)
  const promoted = !last ? null : (after.composite > before.composite && after.title !== before.title)
  const demoted = !last ? null : (after.composite < before.composite && after.title !== before.title)
  // 环比：本周 vs 上周
  const delta = (cur, prev, unit = '', goodUp = true) => {
    if (prev == null) return null
    const diff = +(cur - prev).toFixed(1)
    if (diff === 0) return null
    const up = diff > 0
    const good = goodUp ? up : !up
    return { text: `${up ? '↑' : '↓'} ${Math.abs(diff)}${unit}`, color: good ? '#10B981' : '#EF4444' }
  }
  const dOcc = delta(result.occupancy, last ? last.occupancy : null, 'pt')
  const dRev = delta(+(result.revenue / 10000).toFixed(1), last ? +(last.revenue / 10000).toFixed(1) : null, '万')
  const dProfit = delta(result.profit, last ? last.profit : null, '元')
  const chip = (d) => d ? (
    <span style={{ fontSize: 10, fontWeight: 700, color: d.color, background: d.color === '#10B981' ? '#ECFDF5' : '#FEF0EF', borderRadius: 6, padding: '2px 6px', marginLeft: 6 }}>{d.text}</span>
  ) : null
  return (
    <div className="content">
      <div className="header">
        <span className="step-tag">周结算</span>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>第 {result.week} 周经营结果</h1>
 {/* T2.4/E2：缺周展示 —— 老师跳过的周显式列出； 不参与任何平均值分母（只展示，不回写 history） */}
        {missingWeeks(history).length > 0 && (
          <div style={{ margin: '8px 0 0', padding: '8px 10px', background: '#F3F4F6', border: '1px dashed #D1D5DB', borderRadius: 8, fontSize: 12, color: '#6B7280', lineHeight: 1.7 }}>
            {missingWeeks(history).map(w => <div key={w}>{missingLabel(w)}</div>)}
            <div style={{ color: '#9CA3AF' }}>（以上周次不计入平均分分母 —— 跳周不算学生失职）</div>
          </div>
        )}
        <div className="sub">决策 → 结果 → 复盘</div>
      </div>

      {/* 称号变化横幅 */}
      {promoted && (
        <div className="card" style={{ background: 'linear-gradient(90deg,#ECFDF5,#FFFFFF)', border: '1px solid #A7F3D0', textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#065F46' }}>酒店晋升！{before.title} → {after.title}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{after.desc}</div>
        </div>
      )}
      {demoted && (
        <div className="card" style={{ background: '#FEF0EF', border: '1px solid #FECACA', textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B' }}>酒店降级：{before.title} → {after.title}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>出租率/口碑下滑拖累评级，下周稳住</div>
        </div>
      )}
      {!last && (
        <div className="card" style={{ background: 'linear-gradient(90deg,#FFF4E0,#FFFFFF)', border: '1px solid #FBE3B3', textAlign: 'center', padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#A96407' }}>首周评级：{after.title}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>提升出租率与口碑可晋升更高称号</div>
        </div>
      )}

      {/* 核心指标 */}
      <div className="card">
        <div className="card-title">本周经营数据</div>
        <div className="settle-grid">
          <div className="metric">
            <div className="label">出租率{chip(dOcc)}</div>
            <div className="value"><CountNum n={result.occupancy} /><span className="unit">%</span></div>
          </div>
          <div className="metric">
            <div className="label">营收{chip(dRev)}</div>
            <div className="value"><CountNum n={result.revenue} wan /><span className="unit">万</span></div>
          </div>
          <div className="metric">
            <div className="label" title={NET_DEF}>{NET_LABEL}{chip(dProfit)}</div>
            <div className="value" style={{color: isProfit ? '#10B981' : '#EF4444'}}>{isProfit ? '+' : ''}<CountNum n={netP} /><span className="unit">元</span></div>
          </div>
        </div>
      </div>

 {/* B2-2 日报（T3.3/T3.4）：把"本周经营数据"按天展开，7 天明细 + 与周报对账徽标
          数据源 = result.dailySnapshots（Phase D 已接，Σ7天 ≡ 周值）；D30 已定随周报持久化 */}
      {(() => {
        const rows = buildDailyReport(result)
        if (!rows.length) return null
        const rec = reconcileWithWeek(result)
        return (
          <div className="card">
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setDailyOpen(o => !o)}>
              <span>日报（按天查看）<span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}> · 点标题展开/收起</span></span>
              <span style={{ fontSize: 11, fontWeight: 400, color: rec.ok ? '#10B981' : '#DC2626' }}>
 {rec.ok ? ' 7 天合计 = 周报' : `与周报有 ${rec.diff.length} 处对不上`}
              </span>
            </div>
            {dailyOpen && (
              <div style={{ marginTop: 6 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', fontSize: 11, color: '#9CA3AF', padding: '4px 6px', borderBottom: '1px solid #F3F4F6' }}>
                  <span>天</span><span style={{ textAlign: 'right' }}>营收</span><span style={{ textAlign: 'right' }}>成本</span><span style={{ textAlign: 'right' }}>净流入</span>
                </div>
                {rows.map(d => (
                  <div key={d.dayIndex} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', fontSize: 12, padding: '5px 6px', borderBottom: '1px dashed #F3F4F6' }}>
                    <span style={{ color: '#6B7280' }}>{d.label}</span>
                    <span style={{ textAlign: 'right' }}>{d.revenue.toLocaleString()}</span>
                    <span style={{ textAlign: 'right', color: '#6B7280' }}>{d.cost.toLocaleString()}</span>
                    <span style={{ textAlign: 'right', color: d.cashDelta >= 0 ? '#10B981' : '#DC2626', fontWeight: 600 }}>{d.cashDelta >= 0 ? '+' : ''}{d.cashDelta.toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6, lineHeight: 1.6 }}>
                  天数据是【周值的确定性分摊】（整数分摊 + 余数补偿 ⇒ 7 天合计严格等于周报），
                  不是逐日独立模拟；到店/离店按周口径统计，暂未拆到天。
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* 经营明细 */}
      <div className="card">
        <div className="card-title">经营明细</div>
        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.8 }}>
          <div>房量 {result.rooms} 间 · 入住 {result.occupiedRooms} 间</div>
 {/* T1.4/B2：平均房价改【实收】= 周客房收入 ÷ 售出间夜（原显示 result.price 是定价） */}
          <div>平均房价（实收）{result.occupiedRooms > 0 ? Math.round(result.revenue / (result.occupiedRooms * 7)) : 0} 元/间·天</div>
 {/* W2-3（W10 正名）：GOP 与净利润【分开显示】——口径单源 src/metricDefs.mjs
              GOP 不含租金 ⇒ GOP > 净利润；两者之差 = 租金 + 非经常项，学生要能对上账 */}
          {typeof result.gop === 'number' && (
            <div title={GOP_DEF}>
              {GOP_LABEL} {result.gop.toLocaleString()} 元 · 率 {pct(result.gopRate)}<span style={{ color: '#9CA3AF', fontSize: 11 }}>（不含租金/加盟费/利息）</span>
            </div>
          )}
          {typeof result.netProfit === 'number' && (
            <div title={NET_DEF}>
              {NET_LABEL} {result.netProfit.toLocaleString()} 元 · 率 {pct(result.netProfitRate)}<span style={{ color: '#9CA3AF', fontSize: 11 }}>（已扣租金 · 评分基准）</span>
            </div>
          )}
          <div>成本 {result.totalCost} 元<span style={{ color: '#9CA3AF', fontSize: 11 }}>（含租金 {typeof result.rentCost === 'number' ? result.rentCost.toLocaleString() : '—'} 元）</span></div>
          <div>好评率 {result.goodRate}% → {result.finalGoodRate}%</div>
          {/* P5：资金唯一权威 = settle 返回的 capital（资金卡同源，可对账） */}
          {typeof result.capital === 'number' && <div>期末资金 {result.capital.toLocaleString()} 元</div>}
          <div>本周 {result.reviewCount} 条评价，{result.negativeCount} 条差评</div>
          {result.totalExpenses > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>本周成本构成（共 {result.totalExpenses.toLocaleString()} 元）</div>
              {(() => {
                // 🔴 口径修正（2026-09-22）：改读**引擎权威** weeklyExpenses（settlement.js 生成）
                //   原先前端按 65/30/25 元硬编码重算，与引擎公式不符、且漏掉「维修保养」；
                //   卡片头的总额本就来自引擎 ⇒ 拆解与总额必须同源，否则学生对不上账。
                const EXP_COLOR = {
                  人员工资: '#F472B6', 物料消耗: '#FBBF24', 水电能耗: '#38BDF8', 维修保养: '#A78BFA',
                  营销推广: '#60A5FA', OTA佣金: '#34D399', 超售赔偿: '#FB923C', 事件罚款: '#F87171',
                }
                const items = Object.entries(result.weeklyExpenses || {})
                  .map(([name, val]) => ({ name, val, color: EXP_COLOR[name] || '#94A3B8' }))
                  .filter(x => x.val > 0)
                return items.map(item => (
                  <div key={item.name} style={{ marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9CA3AF' }}>
                      <span>{item.name}</span>
                      <span>{item.val.toLocaleString()} 元</span>
                    </div>
                    <div style={{ height: 5, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: Math.min((item.val / result.totalCost * 100), 100) + '%', background: item.color, borderRadius: 2 }} />
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}
          {/* §14.3：加盟两费如实标注 —— 哪几项【已实收】、哪些【待补】（不许让学生以为全是真金） */}
          <div style={{ fontSize: 10, color: result.franchiseFees ? '#15803D' : '#9CA3AF', marginTop: 2 }}>
            {result.franchiseFees
              ? `含加盟两费 ${result.franchiseFees.合计.toLocaleString()} 元（${result.franchiseFees.品牌}：管理费 ${(result.franchiseFees.费率.管理费 * 100).toFixed(1)}% + CRS 有效 ${(result.franchiseFees.费率.CRS有效 * 100).toFixed(1)}%，均按营收）· 引擎已实收`
              : '加盟费率待补（该品牌未接入名单）⇒ 引擎未计费，不编造'}</div>
          {result.eventFine > 0 && <div style={{ color: '#DC2626' }}>事件罚款 {result.eventFine} 元（已计入成本）</div>}
          {result.overbookCompensation > 0 && <div style={{ color: '#DC2626' }}>超售到店无房赔偿 {result.overbookCompensation} 元</div>}
        </div>
      </div>

      {/* 市场波动可视化 */}
      <div className="card">
        <div className="card-title">市场波动</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
          本周市场客源强度系数：<b style={{ color: '#111827' }}>{result.demandStrength}</b>
        </div>
        {/* 波动条：0.5-1.5 区间 */}
        <div style={{ position: 'relative', height: 8, background: 'linear-gradient(to right, #DC2626, #FBBF77, #16A34A)', borderRadius: 4, marginBottom: 6 }}>
          <div style={{ position: 'absolute', left: ((result.demandStrength - 0.5) / 1.0 * 100) + '%', top: '-4px', width: 16, height: 16, background: '#fff', border: '3px solid #E8940F', borderRadius: '50%', transform: 'translateX(-50%)' }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9CA3AF' }}>
          <span>市场冷清</span>
          <span>正常</span>
          <span>市场火爆</span>
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8, lineHeight: 1.6 }}>
          市场波动是随机的（全班同一周相同），这是"市场不确定性"。你的决策决定的是如何应对市场。
        </div>
        {(() => {
          // 下周预测：确定性规则推导（不预支随机数），教学化趋势参考而非保证
          const forecasts = []
          const prev = (history || []).length >= 1 ? history[history.length - 1] : null
          const cur = result.demandStrength
          if (prev && prev.demandStrength != null) {
            const d = cur - prev.demandStrength
            if (d >= 0.05) forecasts.push({ icon: 'money.profit', text: `市场热度连续走高（${prev.demandStrength}→${cur}），热度期更要保服务——退潮后的复购靠口碑` })
            else if (d <= -0.05) forecasts.push({ icon: 'money.spend', text: `市场热度在回落（${prev.demandStrength}→${cur}），别因单周冷清过度砍成本，精简排班易招差评` })
          }
          const rival = (result.events || []).some(e => e.name === '竞店开业')
          if (rival) forecasts.push({ icon: 'event.competitor', text: '竞店分流通常持续 1-2 周，此刻降价前先算「房价×出租率」是不是真划算' })
          if ((result.negativeCount || 0) > 0) forecasts.push({ icon: 'status.crisis', text: `本周新增 ${result.negativeCount} 条差评，欠着不处理会触发"差评发酵"（口碑额外受损），优先去口碑页处理` })
          // 🔴 P3-1：阈值口径同步（原写 < 100000 ⇒ 资金预警几乎永不触发，违反 D20 原则一）
          // 🔴 W2 收尾修正：原硬编码 1004000（= T1.1 时代 IC 502万 × 0.2）已随 W2-2 的 IC=149万 失效
          //    ⇒ 改引 SCALE.变黄线（29.8 万），与资金卡变黄线【同源】；文案数字也从常量推导
          // 🔴 W2 收尾抓到的②类缺陷（BL-10 家族）：原行把 `if (...)` 与 `forecasts.unshift({...})`
          //    挤在同一行、且中间插了 `//` 注释 ⇒ 整句 unshift 【从未执行】，资金预警一直是死的
          //    （"页面没崩 ≠ 功能在跑"）。现拆成独立语句块；B2.5 的 NaN 归一化守卫保留在条件里。
          if (Number.isFinite(result.capital) && result.capital < SCALE.变黄线) {   // B2.5：`!= null` 拦不住 NaN，而这里要做除法
            forecasts.unshift({ icon: 'status.critical', text: `资金 ${Math.round(result.capital / 10000)} 万已接近预警线（约 ${SCALE.变黄线 / 10000} 万），下周优先控成本：排班随出租率浮动、砍低投产比投放` })
          }
          if (forecasts.length === 0) {
            if (cur < 0.95) forecasts.push({ icon: 'weather.cloudy', text: '市场偏冷的窗口适合练内功：品质投入和口碑积累，等热度回来时接得住' })
            else if (cur > 1.05) forecasts.push({ icon: 'status.crisis', text: '市场偏热，客流是白送的——此时满编保服务的边际收益最高' })
            else forecasts.push({ icon: 'note.caliber', text: '市场平稳，是检验决策稳定性的时机：维持策略一致性，观察两周再调整' })
          }
          return (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed #E5E7EB' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#A96407', marginBottom: 4 }}>下周市场预测（趋势参考）</div>
              {forecasts.slice(0, 2).map((f, i) => (
                <div key={i} style={{ fontSize: 11, color: '#374151', lineHeight: 1.6, padding: '2px 0', display: 'flex', alignItems: 'center', gap: 5 }}><Icon name={f.icon} size={13} /> {f.text}</div>
              ))}
            </div>
          )
        })()}
      </div>

 {/* §33-V6-§1①③（2026-10-02）：客群匹配反馈 —— 引擎三路加权后的每条"为什么"（文案带该客群占比）。
          此前 personaFeedback 引擎返回但界面零消费（"引擎有·界面无"家族）· 条件渲染：无反馈不渲染（水位线） */}
      {Array.isArray(result.personaFeedback) && result.personaFeedback.length > 0 && (
        <div className="card">
          <div className="card-title">客群匹配（本区客源结构 × 你的决策）</div>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6, lineHeight: 1.6 }}>
            本区客群结构：<b>{result.persona?.business != null ? `商务 ${Math.round(result.persona.business)}% · 游客 ${Math.round(result.persona.tourist)}% · 家庭 ${Math.round(result.persona.family)}%` : '见选址页'}</b>
            （加权计分 · 非主力客群也有份量）
          </div>
          {result.personaFeedback.map((f, i) => (
 <div key={i} style={{ fontSize: 11, color: f.startsWith('达成') ? '#065F46' : f.startsWith('风险') ? '#991B1B' : '#374151', padding: '4px 8px', background: f.startsWith('') ? '#EAF9F0' : f.startsWith('') ? '#FEF2F2' : '#F9FAFB', borderRadius: 6, marginBottom: 4, lineHeight: 1.6 }}>{f}</div>
          ))}
        </div>
      )}

      {/* 本周决策摘要（点击行展开该决策的设计考量） */}
      {result.decisions && Object.keys(result.decisions).filter(k => !k.startsWith('__')).length > 0 && (
        <div className="card">
          <div className="card-title">本周决策摘要（{Object.keys(result.decisions).filter(k => !k.startsWith('__')).length}/18 项）</div>
          {Object.entries(result.decisions).filter(([k]) => !k.startsWith('__')).map(([id, val]) => {
            const d = DECISION_NAMES_MAP[id]
            const expanded = tipOpen === id
            return (
              <div key={id} style={{ borderBottom: '1px solid #F9FAFB' }}>
                <div
                  onClick={() => d && d.tip && setTipOpen(expanded ? null : id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', fontSize: 11, cursor: d && d.tip ? 'pointer' : 'default' }}
                >
 <span style={{ color: '#6B7280', flexShrink: 0 }}>{d ? d.name : id}{d && d.tip && <span style={{ fontSize: 9, color: '#D1D5DB', marginLeft: 4 }}>{expanded ? '▲' : ''}</span>}</span>
                  <span style={{ fontWeight: 600, color: '#374151', textAlign: 'right', marginLeft: 8 }}>
                    {typeof val === 'object' ? (Array.isArray(val) ? val.slice(0, 3).join('＞') : Object.entries(val).map(([k, v]) => `${k}:${v}`).join('、')) : String(val)}
                  </span>
                </div>
                {expanded && d && d.tip && (
                  <div style={{ fontSize: 10, color: '#1E40AF', background: '#EFF6FF', borderRadius: 6, padding: '5px 8px', marginBottom: 5, lineHeight: 1.6 }}>
                    设计考量：{d.tip}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

 {/* §32-U3 世界层：本周外部环境（天气/淡旺季/OTA 平台）—— 数据取自引擎 result.world（唯一查表点） */}
      {result.world && (
        <div className="card">
          <div className="card-title">本周外部环境</div>
          {[
            { k: '天气', icon: result.world.天气.图标, 名: `天气 · ${result.world.天气.名}`, 值: `客流 ×${result.world.天气.客流系数}`, 好: result.world.天气.客流系数 >= 1, 注: '天气只影响客流，不影响房价与成本' },
            { k: '季节', icon: 'date.week', 名: `淡旺季 · ${result.world.季节.名}`, 值: `需求 ×${result.world.季节.需求因子}`, 好: result.world.季节.需求因子 >= 1, 注: '淡旺季对全班所有店统一生效（不是选址维度）' },
            result.world.ota.适用
              // ★ §32-U4b 顺手修：这里原样打印浮点（学生看到 `0.8908333333333334`）⇒ 统一按百分比 1 位小数显示
              ? { k: 'ota', icon: 'event.ota', 名: `OTA 平台评分 · ${result.world.ota.评分}`, 值: `渠道流量 ×${result.world.ota.渠道系数}`, 好: result.world.ota.渠道系数 >= 1, 注: `评分由好评率 / 客诉率 / 差评回复决定（本周：好评率 ${pct(result.world.ota.明细.好评率)} · 客诉率 ${pct(result.world.ota.明细.客诉率)} · 积压 ${result.world.ota.明细.待处理} 条）` }
              : { k: 'ota', icon: 'prop.hotel', 名: '自主直营 · 不受平台评分影响', 值: '渠道 ×1.0', 好: true, 注: '直营没有 OTA 流量加成，也没有平台罚款（口径分离）' },
          ].map(row => (
            <div key={row.k} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 16, flexShrink: 0, display: 'flex' }}><Icon name={row.icon} size={16} /></span>
              <span style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{row.名}</span>
                <span style={{ fontSize: 13, marginLeft: 8, color: row.好 ? '#065F46' : '#991B1B', fontWeight: 700 }}>{row.值}</span>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{row.注}</div>
              </span>
            </div>
          ))}
          {result.world.违规 && result.world.违规.length > 0 && (
            <div style={{ marginTop: 8, padding: '8px 10px', background: '#FEF0EF', borderRadius: 8, fontSize: 12, color: '#991B1B', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              本周平台处罚 {result.world.违规.length} 项（合计罚款 {result.world.违规罚款.toLocaleString()} 元，已计入本周成本）：
              {result.world.违规.map(v => `\n· ${v.名}（触发值 ${v.触发值}）→ 渠道流量 ×${v.降权}｜${v.tip}`).join('')}
            </div>
          )}
        </div>
      )}

      {/* 本周事件（条件触发：你的经营状态招来的好事/坏事；按 危机→负面→正面 排序） */}
      {result.events && result.events.length > 0 && (
        <div className="card">
          <div className="card-title">本周经营事件</div>
          {[...result.events].sort((a, b) => ({ crisis: 0, bad: 1, good: 2 }[a.type] ?? 3) - ({ crisis: 0, bad: 1, good: 2 }[b.type] ?? 3)).map((e, i) => (
            e.type === 'crisis'
              ? <CrisisCard key={i} event={e} week={result.week} />
              : <div key={i} style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 8, background: e.来源 === 'teacher' ? '#FFF4E0' : (e.type === 'good' ? '#EAF9F0' : '#FEF0EF'), border: e.来源 === 'teacher' ? '1px solid #FBE3B3' : 'none' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: e.来源 === 'teacher' ? '#A96407' : (e.type === 'good' ? '#065F46' : '#991B1B') }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span>
 {/* §32-U8-补 §2②：老师注入来源标识（引擎侧 来源:'teacher' ⇒ 周报显著区分）
                        · 标题里去掉引擎事件名自带的「老师注入 · 」前缀 —— 徽章已经标明，避免重复与挤行 */}
                    <Icon name={e.icon} size={14} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {e.来源 === 'teacher' ? String(e.name).replace('老师注入 · ', '') : e.name}
                    {e.来源 === 'teacher' && <span style={{ fontSize: 10, background: '#E8940F', color: '#fff', borderRadius: 5, padding: '1px 6px', marginLeft: 6, fontWeight: 700, whiteSpace: 'nowrap' }}>老师注入</span>}
                  </span>
                  {e.impact && e.impact !== '—' && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#fff', borderRadius: 6, padding: '2px 7px', border: `1px solid ${e.type === 'good' ? '#A7F3D0' : '#FECACA'}`, color: e.impact.includes('-') ? '#DC2626' : '#10B981', flexShrink: 0 }}>
                      {e.impact}
                    </span>
                  )}
                </span>
              </div>
                  <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, marginTop: 3 }}>{e.text}</div>
 {/* §32-U8-补 §2③：离线补算跨过事件周 ⇒ 显著标注（文案唯一生成点在 teacherEvents.离线默认标注） */}
                  {e.离线标注 && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#991B1B', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '6px 10px', marginTop: 6, lineHeight: 1.6 }}>
 {e.离线标注}
                    </div>
                  )}
 {/* §32-U8-补 §2②：你的应对（当周选择留痕 · 复盘可见） */}
                  {e.你的应对 && (
                    <div style={{ fontSize: 11, color: '#065F46', fontWeight: 600, marginTop: 3 }}>你的应对：{e.你的应对}</div>
                  )}
                  <div style={{ fontSize: 11, color: '#A96407', marginTop: 3 }}>{e.tip}</div>
                  {(() => {
                    // 与口碑页同口径：该事件产生的差评已在口碑页标注来源
                    const n = (result.generatedReviews || []).filter(rv => rv.source && rv.source.name === e.name).length
                    if (!n) return null
                    return (
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#991B1B', background: '#FEF2F2', borderRadius: 5, padding: '3px 8px', marginTop: 5, display: 'inline-block' }}>
                        已在口碑页标注到 {n} 条差评的来源
                      </div>
                    )
                  })()}
                </div>
          ))}
          <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.6 }}>
            事件不是纯随机：是你把某个属性推到极端（如高出租率+少人手）才会触发。经营的平衡点由你把握。
          </div>
        </div>
      )}

 {/* §32-U8-补 §2④：AI 领班复盘卡（授权设置 + 本周代管记录）—— 无条件渲染（复盘必看） */}
      <SupervisorCard result={result} />

      {/* 决策复盘 */}
      {result.insights && result.insights.length > 0 && (
        <div className="card">
          <div className="card-title">决策复盘</div>
          {result.insights.map((ins, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: i < result.insights.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}><Icon name={ins.good ? 'status.done' : 'status.warn'} size={16} /></span>
              <span style={{ fontSize: 13, color: ins.good ? '#065F46' : '#991B1B', lineHeight: 1.6 }}>{ins.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* 分享本周成绩 */}
      <div className="card">
        <div className="card-title">分享本周成绩</div>
        <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => {
          const evText = result.events && result.events.length ? `
经历事件：${result.events.map(e => e.name).join('、')}` : ''
          const text = `云悦酒店·第${result.week}周成绩单
出租率 ${result.occupancy}% | 营收 ${(result.revenue/10000).toFixed(1)}万 | 利润 ${result.profit >= 0 ? '+' : ''}${result.profit}元
好评率 ${result.finalGoodRate}% | 差评 ${result.negativeCount}条
${after.icon} 当前称号：${after.title}${evText}
——来自云悦酒店经营模拟`
          let owed = null
          try {
            const revs = JSON.parse(localStorage.getItem('hotel-sim-reviews') || '[]')
            owed = revs.filter(r => r.status === 'pending' || r.status === 'ignored').length
          } catch (e) {}
          const badges = [
            history.some(h => h.profit > 0),
            history.some(h => h.occupancy >= 80),
            history.some(h => h.finalGoodRate >= 90),
            history.some(h => h.negativeCount === 0 && h.reviewCount > 0),
            after.title !== '普通旅社' && after.title !== '舒适旅店',
            owed === 0,
            history.length >= 12,
          ].filter(Boolean).length
          navigator.clipboard.writeText(text + `
 勋章 ${badges}/7`).then(() => setCopied(true)).catch(() => setCopied(false))
        }}>一键复制成绩单（发群里）</button>
        {copied && <div style={{ fontSize: 11, color: '#16A34A', marginTop: 6 }}>已复制，去微信粘贴吧</div>}
      </div>

 {/* E2：本周变更记录（第几天改了什么 + 次日生效）—— 与 E3 的「次日生效」互为证据 */}
      {Array.isArray(result.changeLogLines) && result.changeLogLines.length > 0 && (
        <div className="card">
          <div className="card-title">本周变更记录</div>
          <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.9 }}>
            {result.changeLogLines.map((t, i) => <div key={i}>· {t}</div>)}
          </div>
          <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
            决策【次日生效】：第 N 天提交的改动，第 N+1 天起算（当日已发生的不可回溯）
          </div>
        </div>
      )}

 {/* D52-a：周中调价 ⇒ 营收分段卡。
 §19.1（单元 1·B4）：引擎已能【按天实算】⇒ 有真分段时**撤掉"估算"标注**；
            旧档/无改动周仍走显示级估算路径，标注照旧（教学诚实：是什么就标什么）。 */}
      {result.revenueSegments && (
        <div className="card">
          <div className="card-title">{result.revenueSegments.标题}</div>
          <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.9 }}>
            {result.revenueSegments.rows.map((x, i) => (
              result.revenueSegments.实算
                ? <div key={i}>· {x.段}：{Number(x.金额).toLocaleString()} 元（{x.天数} 天）</div>
                : <div key={i}>· {x.段}：约 {x.金额估算.toLocaleString()} 元（{x.天数} 天）</div>
            ))}
          </div>
          {result.revenueSegments.实算 ? (
            <div style={{ fontSize: 10, color: '#15803D', marginTop: 6, background: '#F0FDF4', border: '1px dashed #86EFAC', borderRadius: 6, padding: '5px 8px' }}>
 以上为<b>引擎按天实算</b>：各段用「该天生效的决策」真跑，<b>Σ分段 = 周报收入</b>（不重不漏）。
            </div>
          ) : (
            <div style={{ fontSize: 10, color: '#B45309', marginTop: 6, background: '#FFFBEB', border: '1px dashed #FCD34D', borderRadius: 6, padding: '5px 8px' }}>
 以上为<b>估算</b>：当前引擎按「整周一套决策」实收，分段是按改价时点的显示级近似；
              周报的<b>总营收/利润仍以引擎实收为准</b>（两处数字不冲突）。
            </div>
          )}
        </div>
      )}
      {Array.isArray(result.changeLogLines) && result.changeLogLines.length > 0 && (
        <div className="card">
          <div className="card-title">本周变更记录</div>
          <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.9 }}>
            {result.changeLogLines.map((t, i) => <div key={i}>· {t}</div>)}
          </div>
          <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
            决策【次日生效】：第 N 天提交的改动，第 N+1 天起算（当日已发生的不可回溯）
          </div>
        </div>
      )}

      {/* 竞品动态 */}
      {result.competitors && result.competitors.length > 0 && (
        <div className="card">
          <div className="card-title">周边竞品动态</div>
          {result.competitors.map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F9FAFB' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF' }}>基准价 ¥{c.basePrice}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.action === 'hold' ? '#9CA3AF' : c.action === '促销' || c.action === '降价' ? '#EF4444' : '#10B981' }}>{c.action}</div>
                {c.priceChange !== 0 && <div style={{ fontSize: 10, color: c.priceChange < 0 ? '#EF4444' : '#10B981' }}>¥{c.price > 0 ? c.price : c.basePrice + c.priceChange}</div>}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>竞品AI会根据市场情况自主调价/促销，直接影响你的客源</div>
        </div>
      )}

      {/* 复盘建议 */}
      <div className="card" style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}>
        <div className="card-title">复盘建议</div>
        {(() => {
          // 下周提示生成器：按本周最弱维度给一条优先建议
          const tips = []
          if (result.profit < 0) tips.push('控制成本是第一优先——检查人力/营销花费，先止损再谈增长')
          if (result.occupancy < 55) tips.push('出租率是当前短板——考虑调价让利或加大OTA/活动投放拉客')
          if (result.negativeCount > 2) tips.push('差评积压是口碑杀手——先去口碑页把待处理清零再谈其他')
          if (result.finalGoodRate < 80) tips.push('口碑修复需要时间——卫生深清洁+真诚回复差评，坚持两周见效')
          if (tips.length === 0) tips.push('各项指标健康！下周可尝试提价或减少促销，验证利润上限')
          return (
            <div style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', marginBottom: 10, fontSize: 13, fontWeight: 700, color: '#1E40AF' }}>
 下周优先：{tips[0]}
            </div>
          )
        })()}
        <div style={{ fontSize: 13, color: '#1E40AF', lineHeight: 1.7 }}>
 {result.occupancy < 55 && ' 出租率偏低，考虑降价促销或提升口碑拉客流。'}
 {result.occupancy >= 55 && result.occupancy < 75 && ' 出租率适中，可优化房价策略提升 RevPAR。'}
 {result.occupancy >= 75 && ' 出租率较高，注意满负荷服务质量和差评风险。'}
 {!isProfit && ' 本周亏损，重点检查成本（人力/营销）是否过高。'}
 {result.negativeCount > 0 && ' 有差评待处理，及时回复可减半负面影响。'}
        </div>
      </div>

      <div style={{ padding: '8px 20px 24px' }}>
        <button className="btn-confirm" onClick={onClose}>
 {result.week >= 12 ? ' 查看 12 周最终成绩 →' : `进入第 ${result.week + 1} 周，重新决策 →`}
        </button>
 {/* E2：周报是【自动】产生的 —— 允许"先不处理，回去接着做决策"，
 经营页保留只读回看入口「 查看本周周报」（不允许这里再改任何数值） */}
        {onLater && (
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8, fontSize: 12 }} onClick={onLater}>
            ⏸ 稍后再看（返回经营页，先继续做决策）
          </button>
        )}
      </div>
    </div>
  )
}
