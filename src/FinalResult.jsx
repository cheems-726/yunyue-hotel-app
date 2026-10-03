import React from 'react'
import Icon from './Icon.jsx'

import { strategyOf } from './TeacherDashboard.jsx'
import { missingWeeks, missingLabel } from './missingWeeks.mjs'
import { EVENT_INFO } from './settlement.js'
import { fetchMyNotes } from './supabaseClient.js'
import { getTitle } from './hotelTitle.js'
import { qualityOf } from './attrs.js'
import { GOP_LABEL, GOP_DEF, NET_LABEL, NET_DEF, sumGop, sumNet, wan2, scoreOf, totalRevenue } from './metricDefs.mjs'
import { TOTAL_WEEKS, 学期口径说明 } from './semester.mjs'   // §22.2-B2：学期长度单源（保证金退还周）

// 最终成绩：12周经营结束后，按四维评分
// 评分权重：利润40% / 口碑25% / 出租率20% / 差评处理率15%
export default function FinalResult({ history, onRestart, user, attrs }) {
  const [copied, setCopied] = React.useState(false)
  const [teacherNote, setTeacherNote] = React.useState(null)
  // 云端用户拉最新教师批注（成绩单引用）
  React.useEffect(() => {
    if (user?.cloud && user?.uid) {
      fetchMyNotes(user.uid).then(ns => { if (ns && ns.length) setTeacherNote(ns[0]) }).catch(() => {})
    }
  }, [user?.uid])
  // 品质分唯一来源 = 属性池（N2 统一；旧档经 normalizeAttrs 兜底回退 60）
  const quality = qualityOf(attrs)

  // 汇总12周经营数据
  // 🔴 W2-3（W10 正名）：评分基准 = 【净利润】。净利润与既有 profit 同值（引擎恒等式 netProfit === profit），
  //   ⇒ 数值语义零变化；旧档周无 netProfit 字段时回退读 profit；缺字段的周【不按 0 计入】累加
  const netTotal = sumNet(history)
  const gopTotal = sumGop(history)
  // 🔴 E1（二期 · 唯一账本）：四维评分的【整套计算】收进 metricDefs.scoreOf —— 此前学生端/教师端各写一份
  //   完全相同的阶梯（改一处必漏另一处），且平均出租率/好评率/差评数/处理率也是两份。
  //   ★ 零变化：scoreOf 是原内联式的逐字提取，守门用【旧式 oracle】逐字段比对（tests/ledgerSingleSource.test.mjs）
  const S = scoreOf(history)
  const totalProfit = S.totalProfit
  const avgOccupancy = S.avgOccupancy
  const avgGoodRate = S.avgGoodRate
  const totalNegative = S.totalNegative
  const profitScore = S.profitScore
  const reputationScore = S.reputationScore
  const occupancyScore = S.occupancyScore
  const negativeScore = S.negativeScore
  const finalScore = S.finalScore
  const grade = S.grade

  // ★ §22.2-B2（2026-09-29）：保证金在【第  周结算时】退还（引擎钩子）。
  //   若本学期没跑到第  周（老师提前结业/锁周），退款没发生 ⇒ 如实标注（不假装退过）。
  const 保证金未退 = (history.length > 0 && history.length < TOTAL_WEEKS && history[0]?.oneTimeFees?.保证金)
    ? history[0].oneTimeFees.保证金 : null   // 实收多少退多少 —— 读 week1 结算的快照（单源，不重算）

  const dimensions = [
    // 🔴 W2-3：40% 维度的名字 = 【累计净利润】（= 评分基准）；数值口径未变（netProfit === profit）
    { label: '累计净利润', weight: '40%', score: profitScore, value: `${(totalProfit / 10000).toFixed(2)}万`, hint: NET_DEF },
    { label: '平均口碑', weight: '25%', score: reputationScore, value: `${avgGoodRate}%` },
    { label: '平均出租率', weight: '20%', score: occupancyScore, value: `${avgOccupancy}%` },
    { label: '差评控制', weight: '15%', score: negativeScore, value: `${totalNegative}条差评` },
  ]

  return (
    <div className="content">
      <div className="header">
        <span className="step-tag">学期总结</span>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>12 周经营成绩</h1>
        <div className="sub">你的酒店经营成果总结</div>
 {/* T2.4/E2：缺周展示 —— 老师跳过的周显式列出； 不参与任何平均值分母（只展示，不回写 history） */}
        {missingWeeks(history).length > 0 && (
          <div style={{ margin: '8px 0 0', padding: '8px 10px', background: 'var(--fill)', border: '1px dashed var(--border-strong)', borderRadius: 8, fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.7 }}>
            {missingWeeks(history).map(w => <div key={w}>{missingLabel(w)}</div>)}
            <div style={{ color: 'var(--text-muted)' }}>（以上周次不计入平均分分母 —— 跳周不算学生失职）</div>
          </div>
        )}
      </div>

      {/* 总成绩 */}
      <div className="card" style={{ textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 56, fontWeight: 700, color: 'var(--primary)' }}>{finalScore}</div>
        <div style={{ fontSize: 16, color: 'var(--warn)', fontWeight: 600, marginTop: 4 }}>{grade}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>满分 100 · 按四维加权评分</div>
      </div>

      {/* 四维评分 */}
      <div className="card">
        <div className="card-title">四维评分明细</div>
        {dimensions.map(d => (
          <div key={d.label} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }} title={d.hint}>{d.label} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>（权重{d.weight}）</span></span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>{d.score}分 · {d.value}</span>
            </div>
            <div style={{ height: 8, background: 'var(--fill)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: d.score + '%', background: d.score >= 80 ? 'var(--good)' : d.score >= 60 ? 'var(--primary)' : 'var(--bad)', borderRadius: 4 }}></div>
            </div>
          </div>
        ))}
 {/* §22.2-B2：保证金在【第 {TOTAL_WEEKS} 周结算时】退还（引擎钩子）。
            本学期没跑满 ⇒ 退款未发生 ⇒ 如实标注（不假装退过、也不把它算进成绩）。
            金额读 week1 结算快照的实收（单源），不在此重算。 */}
        {保证金未退 != null && (
          <div style={{ fontSize: 12, color: 'var(--warn)', background: 'var(--warn-bg)', border: '1px dashed var(--warn-border)', borderRadius: 6, padding: '6px 8px', lineHeight: 1.7 }}>
            ℹ️ 本学期经营了 {history.length}/{TOTAL_WEEKS} 周 —— 开业缴存的保证金 {(保证金未退 / 10000).toFixed(1)} 万
            <b>尚未退还</b>（按口径在第 {TOTAL_WEEKS} 周结算时全额退还）。{学期口径说明}
          </div>
        )}
      </div>

      {/* 学期回顾：策略画像 + 称号轨迹 */}
      {(() => {
        const st = strategyOf(history)
        let prevTitle = null
        const nodes = []
        history.forEach(h => {
          const t2 = getTitle(h.occupancy, h.finalGoodRate, quality).title
          if (t2 !== prevTitle) { nodes.push(`第${h.week}周 ${t2}`); prevTitle = t2 }
        })
        return (
          <div className="card">
            <div className="card-title">学期画像回顾</div>
            {st && (
              <div style={{ fontSize: 16, fontWeight: 700, color: st.color, marginBottom: 6 }}>
                <Icon name={st.icon} size={15} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> 本学期策略风格：{st.tag}
              </div>
            )}
            {nodes.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7 }}>
                称号轨迹：{nodes.join(' → ')}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              策略风格由 12 周的决策快照自动归纳；轨迹仅在称号变化处记录节点
            </div>
            {(() => {
              // 事件类型分布：12周触发过的事件按次数排序
              const counts = {}
              history.forEach(h => (h.events || []).forEach(e => { counts[e.icon + e.name] = (counts[e.icon + e.name] || 0) + 1 }))
              const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
              if (!top.length) return null
              return (
                <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--fill)', lineHeight: 1.8 }}>
                  12周共触发事件 <b>{history.reduce((a, h) => a + (h.events || []).length, 0)}</b> 次，最常见：
                  {top.map(([key, n]) => {
                    // title 联动 EVENT_INFO：hover 显示触发条件与教学提示
                    const info = EVENT_INFO.find(e => e.icon + e.name === key)
                    return <span key={key} title={info ? `触发条件：${info.trigger}` : undefined} style={{ background: 'var(--bg)', borderRadius: 5, padding: '1px 6px', marginRight: 4, cursor: 'help' }}>{key}×{n}</span>
                  })}
                </div>
              )
            })()}
            {(() => {
              // 最值得复盘的一周：经营表现（出租率/好评率各半）周间波动最大的一周
              if (history.length < 2) return null
              const perf = history.map(h => h.occupancy * 0.5 + h.finalGoodRate * 0.5)
              let worst = 1, swing = 0
              for (let i = 1; i < perf.length; i++) {
                const d = Math.abs(perf[i] - perf[i - 1])
                if (d > swing) { swing = d; worst = i }
              }
              if (swing < 8) return null // 波动太小不值得点名
              const up = perf[worst] > perf[worst - 1]
              return (
                <div style={{ fontSize: 12, color: 'var(--warn)', background: 'var(--warn-bg)', borderRadius: 8, padding: '6px 10px', marginTop: 8, lineHeight: 1.6 }}>
                  最值得复盘：第 {history[worst].week} 周（综合表现较前一周{up ? '飙升' : '下滑'} {Math.round(swing)} 分）——去「我的」页经营操作记录看看那周做了什么决策
                  {(() => {
                    // 联动事件摘要：展示该周的主要事件（复盘有具体抓手）
                    const evs = (history[worst].events || [])
                    if (!evs.length) return null
                    return (
                      <div style={{ fontSize: 12, color: 'var(--bad)', marginTop: 4 }}>
 该周事件：{evs.map(e => `${e.name}`).join('、')}
                      </div>
                    )
                  })()}
                </div>
              )
            })()}
            <button className="btn btn-primary" style={{ marginTop: 10, width: '100%', fontSize: 12 }}
              onClick={() => {
                const grade = document.querySelector('.card div[style*="color: rgb(232, 148, 15)"]')
                const score = history.length >= 1
                const txt = [
                  '云悦酒店 · 12周经营成绩单',
                  `${user?.className ? user.className + ' · ' : ''}${user?.groupNo ? '第' + user.groupNo + '组 · ' : ''}${user?.name || ''}（学号 ${user?.id || '—'}）`,
                  `策略风格：${st ? st.tag : '—'}`,
                  `称号轨迹：${nodes.join(' → ') || '—'}`,
                  `累计净利润：${(totalProfit / 10000).toFixed(2)}万${gopTotal.weeks > 0 ? `（累计GOP ${(gopTotal.value / 10000).toFixed(2)}万）` : ''} · 平均出租率 ${avgOccupancy}% · 平均好评率 ${avgGoodRate}%`,
                  ...(teacherNote && teacherNote.note ? [`教师点评：${teacherNote.note.slice(0, 40)}${teacherNote.note.length > 40 ? '…' : ''}`] : []),
                  '—— 云悦酒店经营模拟',
                ].join('\n')
                navigator.clipboard.writeText(txt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})
              }}
            >{copied ? '已复制，去群里粘贴吧' : '一键复制成绩单（发群里）'}</button>
          </div>
        )
      })()}

      {/* 事件应对复盘：危机事件 + 当时应对 + 结果 */}
      {(() => {
        const crises = []
        history.forEach((h, i) => {
          (h.events || []).forEach(e => {
            if (e.type === 'crisis') {
              // 应对结果：下一周 insights 里的危机应对评语
              const nextIns = history[i + 1] ? (history[i + 1].insights || []).find(x => x.text.includes('危机')) : null
              const decCnt = Object.keys(h.decisions || {}).length
              crises.push({ week: h.week, icon: e.icon, name: e.name, response: h.crisisChoice || null, result: nextIns ? nextIns.text : null, decCnt })
            }
          })
        })
        if (!crises.length) {
          return (
            <div className="card" style={{ background: 'var(--good-bg)' }}>
              <div className="card-title">事件应对复盘</div>
              <div style={{ fontSize: 12, color: 'var(--good)', textAlign: 'center', padding: '10px 0' }}>
                12 周零危机——差评没攒过线、资金没见底，风险控制本身就是实力
              </div>
            </div>
          )
        }
        return (
          <div className="card">
            <div className="card-title">事件应对复盘（{crises.length} 次危机）</div>
            {crises.map((c, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: i < crises.length - 1 ? '1px solid var(--fill)' : 'none' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--bad)' }}>
                  第{c.week}周 <Icon name={c.icon} size={14} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {c.name}
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-sub)', marginLeft: 6 }}>（当时决策完成 {c.decCnt}/18）</span>
                  {c.response && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--info)', background: 'var(--primary-bg)', borderRadius: 5, padding: '1px 6px', marginLeft: 6 }}>应对：{c.response}</span>}
                </div>
                {c.result && <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 3, lineHeight: 1.6 }}>结果：{c.result}</div>}
                {!c.response && <div style={{ fontSize: 12, color: 'var(--bad)', marginTop: 3 }}>当时未选择应对方案（按最差情况处理）</div>}
              </div>
            ))}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              危机不可怕，可怕的是没有预案。对照每次应对与结果，下次遇到就知道怎么选。
            </div>
          </div>
        )
      })()}

      {/* 经营总结 */}
      <div className="card" style={{ background: 'var(--warn-bg)' }}>
        <div className="card-title">经营总结</div>
        <div style={{ fontSize: 16, color: 'var(--warn)', lineHeight: 1.7 }}>
          你完成了 12 周经营。累计净利润 {totalProfit >= 0 ? '+' : ''}{(totalProfit / 10000).toFixed(2)} 万，
          平均出租率 {avgOccupancy}%，平均好评率 {avgGoodRate}%。
 {/* W2-3：GOP 与净利润分列（GOP 为经营毛利，不含租金 ⇒ 天然大于净利润）
              旧档周无 gop 字段 ⇒ 只统计有该字段的周并写明覆盖度，绝不按 0 补 */}
          <div title={GOP_DEF}>累计 {GOP_LABEL}：<b>{wan2(gopTotal.value)}</b>
            {!gopTotal.complete && gopTotal.weeks > 0 && <span style={{ color: 'var(--text-muted)' }}>（仅统计 {gopTotal.weeks}/{gopTotal.total} 周，旧档周无 GOP 字段）</span>}
            {gopTotal.weeks === 0 && <span style={{ color: 'var(--text-muted)' }}>（旧档无 GOP 字段，暂不可算）</span>}
          </div>
          <div title={NET_DEF}>累计 {NET_LABEL}（评分基准）：<b>{wan2(totalProfit)}</b></div>
          {(() => {
            // 🔴 T1.4/B1：RevPAR（每间可售房【每天】收入）= 总营收 ÷ (房量 × 周数 × 7)
            //   行业标准口径是"每天"；周营收必须 ÷7（缺口表 A3）
            const roomsArr = history.map(h => h.rooms).filter(Boolean)
            if (!roomsArr.length) return null
            const avgRooms = Math.round(roomsArr.reduce((a, b) => a + b, 0) / roomsArr.length)
 const totalRevSum = totalRevenue(history) // E1：总营收也走单源（原自算 Σ revenue）
            const revpar = Math.round(totalRevSum / (avgRooms * (history.length || 1) * 7))
            if (!revpar || revpar <= 0) return null
            return <div>单房收益（RevPAR）：<b>{revpar}</b> 元/间·天</div>
          })()}
          {finalScore >= 80 && ' 经营出色，展现了优秀的酒店管理能力！'}
          {finalScore >= 60 && finalScore < 80 && ' 经营稳健，还有提升空间，注意成本和口碑的平衡。'}
          {finalScore < 60 && ' 经营遇到挑战，建议复盘每周期决策，关注利润和差评处理。'}
        </div>
      </div>

      <div style={{ padding: '8px 20px 24px' }}>
        <button className="btn-confirm" onClick={() => {
          if (window.confirm('确定重新开始 12 周经营吗？\n当前成绩将清空，云端存档也会被新进度覆盖，此操作不可恢复！')) {
            onRestart()
          }
        }}>重新开始经营</button>
      </div>
    </div>
  )
}
