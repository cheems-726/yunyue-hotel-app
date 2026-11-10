// V152 §1 · 学期成果页（学生端全屏覆盖层 · 老师投屏用）
// 红线：只重排 history（前 12 周），不重算引擎、不改 history；主指标 = 经营净利（V145 口径）；
//       不排名、不用"是否回本"当成绩（D342 口径 A）；回本只作折叠参考。
import React from 'react'
import { DEMO_FILL } from './demoFill.mjs'   // D367 演示口径（编译期常量）
import { 学期成果 } from './semesterResult.mjs'
import { TOTAL_WEEKS, 学期口径说明 } from './semester.mjs'
import { wan1 } from './metricDefs.mjs'
import { getTitle } from './hotelTitle.js'
import { qualityOf } from './attrs.js'
import { useEscClose } from './useEscClose.mjs'   // ★ V154 批1：Esc 关成果页

const 万元 = (v) => (v == null || !Number.isFinite(v)) ? '—' : wan1(v)
const 率 = (v) => (v == null || !Number.isFinite(v)) ? '—' : (v * 100).toFixed(1) + '%'

/** 单组成果卡（学生/教师共用渲染；教师端只喂本组的 history） */
export function 成果卡({ 成果, 称号 }) {
  const [看点评, set看点评] = React.useState(null)
  const [看回本, set看回本] = React.useState(false)
  const 曲线 = 成果.曲线 || []
  const 最大 = Math.max(1, ...曲线.map(p => Math.abs(p.净利 || 0)))
  const y0 = (v) => 34 - Math.round((v / 最大) * 26)   // 8..34 的 y 域
  return (
    <div>
      {/* ① 我这 12 周：五项核心数字 */}
      <div className="card" style={{ textAlign: 'center', padding: 18 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{成果.周数} 周 · 学期口径（第 1–{TOTAL_WEEKS} 周）</div>
        <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--primary)', marginTop: 6 }}>
          {成果.经营净利 >= 0 ? '+' : '−'}{万元(Math.abs(成果.经营净利))}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>经营净利（扣租金/装修/加盟费，不含一次性）</div>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 12, fontSize: 14 }}>
          <span>营收 <b>{万元(成果.营收)}</b></span>
          <span>净利率 <b>{率(成果.净利率)}</b></span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 6, fontSize: 14 }}>
          <span>期末出租率 <b>{成果.期末出租率 == null ? '—' : 成果.期末出租率 + '%'}</b></span>
          <span>好评率 <b>{成果.好评率 == null ? '—' : 成果.好评率 + '%'}</b></span>
        </div>
        {称号 && <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: 'var(--warn)' }}>{称号}</div>}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6 }}>{学期口径说明}</div>
      </div>

      {/* ② 最好一周 vs 最差一周（可溯源：展开看该周净利与决策快照） */}
      <div className="card">
        <div className="card-title">最好一周 vs 最差一周</div>
        {[
          { 标: '最好', d: 成果.最好周, 色: 'var(--good)' },
          { 标: '最差', d: 成果.最差周, 色: 'var(--bad)' },
        ].map(({ 标, d, 色 }) => d && (
          <div key={标} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
              <span style={{ fontWeight: 700 }}>{标}：第 {d.周次} 周</span>
              <span style={{ color: 色, fontWeight: 700 }}>{d.净利 >= 0 ? '+' : '−'}{万元(Math.abs(d.净利))}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>关键策略：{d.策略.join('、') || '（无决策记录）'}</div>
            <details data-basis={'bestworst-' + 标} style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              <summary style={{ cursor: 'pointer' }}>依据（点开看）</summary>
              <div style={{ padding: '4px 8px', lineHeight: 1.7 }}>
                该周 netProfit = {d.依据.netProfit} 元{d.依据.oneTimeFees ? ' · oneTimeFees = ' + JSON.stringify(d.依据.oneTimeFees) : ''}；
                经营净利 = netProfit + 开业费用 − 保证金退还（V145 口径 · 取自 history 第 {d.周次} 周，未重算）
              </div>
            </details>
          </div>
        ))}
      </div>

      {/* ③ 12 周净利曲线（与经营页同一套数 = 逐周 周经营净利） */}
      {曲线.length > 0 && (
        <div className="card">
          <div className="card-title">12 周经营净利曲线</div>
          <svg viewBox="0 0 320 44" style={{ width: '100%', height: 56 }} role="img" aria-label="12 周经营净利曲线">
            <line x1="0" x2="320" y1={y0(0)} y2={y0(0)} stroke="var(--border-strong)" strokeDasharray="3 3" strokeWidth="0.6" />
            {曲线.map((p, i) => {
              const W = 320 / Math.max(1, 曲线.length)
              const x = i * W + W / 2
              const h = Math.abs(p.净利) / 最大 * 26
              return <rect key={p.周次} x={x - W * 0.32} width={W * 0.64} y={p.净利 >= 0 ? y0(0) - h : y0(0)} height={Math.max(0.8, h)} fill={p.净利 >= 0 ? 'var(--good)' : 'var(--bad)'} rx="1.5" />
            })}
          </svg>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>逐周经营净利（正=绿 · 负=红 · 虚线=0）· 数据与经营页同源</div>
        </div>
      )}

      {/* ④ 一句话点评（每条数字可点开看依据） */}
      <div className="card">
        <div className="card-title">一句话点评</div>
        {成果.点评.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>（还没有可点评的数据）</div>}
        {成果.点评.map((c, i) => (
          <div key={i} style={{ fontSize: 14, lineHeight: 1.8, marginBottom: 8 }}>
            · {c.文本}
            <button data-basis-toggle={'review-' + i} onClick={() => set看点评(看点评 === i ? null : i)}
              style={{ marginLeft: 6, fontSize: 11, background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 5, color: 'var(--text-muted)', padding: '1px 8px', minHeight: 24, cursor: 'pointer' }}>
              依据
            </button>
            {看点评 === i && (
              <div data-basis={'review-' + i} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--fill)', borderRadius: 6, padding: '6px 8px', marginTop: 4, lineHeight: 1.7 }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{JSON.stringify(c.依据, null, 1)}</pre>
                <div>（以上全部读自 history 既有字段，未重算）</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ⑤ 折叠：投资回收（参考）—— 只作参考，不作成绩（口径 A） */}
      <div className="card">
        <button data-payback-toggle onClick={() => set看回本(!看回本)} style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left', fontSize: 15, fontWeight: 700, color: 'var(--text)', cursor: 'pointer', minHeight: 44 }}>
          {看回本 ? '▾' : '▸'} 投资回收（参考 · 不计成绩）
        </button>
        {看回本 && (
          <div data-payback style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.8 }}>
            <PaybackRef history={成果.回本 && 成果.回本.投入 != null ? undefined : undefined} 投入={成果.回本 && 成果.回本.投入} GOP累计={成果.回本 && 成果.回本.GOP累计} />
            <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              真实参照：同规模汉庭单房造价约 6.8 万/间 ⇒ 70 间约 474 万，行业回本期约 4 年（外部参考值 · 非本模拟引擎产出）。
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PaybackRef({ 投入, GOP累计 }) {
  const txt = (投入 == null || 投入 <= 0)
    ? (DEMO_FILL ? '一次性投入：—（history 未记录 oneTimeFees 口径）—— 不出数、不猜。' : '一次性投入待补（history 缺 oneTimeFees 口径）—— 不出数、不猜。')
    : `一次性投入 ${万元(投入)} · 学期累计 GOP ${万元(GOP累计)} ⇒ 已回收约 ${GOP累计 > 0 ? Math.min(100, Math.round(GOP累计 / 投入 * 100)) : 0}%（GOP 口径 · 估算 · 12 周内本来就不可能回本，课程内不要求）。`
  return <div>{txt}</div>
}

/** 学生端全屏覆盖层 */
export default function SemesterResult({ history, attrs, 续营开关 = false, 已续营 = false, on续营, onBack, 班级行 = null }) {
  useEscClose(true, onBack)   // ★ V154 批1：Esc 可关
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 9000, overflowY: 'auto' }}>
      <div className="content">
        <div className="header">
          <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 14, minHeight: 44, cursor: 'pointer' }}>‹ 返回</button>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }} data-semester-result>我的经营成果</h1>
          <div className="sub">12 周学期成果 · 老师投屏用 · 只读重排，不改任何数据</div>
        </div>
        <SemesterResultBody history={history} attrs={attrs} 续营开关={续营开关} 已续营={已续营} on续营={on续营} 班级行={班级行} />
      </div>
    </div>
  )
}

export function SemesterResultBody({ history, attrs, 续营开关 = false, 已续营 = false, on续营, 班级行 = null }) {
  const hs = (Array.isArray(history) ? history : []).filter(h => Number(h.week) >= 1 && Number(h.week) <= 12)
  const 期末行 = hs[hs.length - 1] || null
  const q = qualityOf(attrs)
  const 称号 = 期末行 ? getTitle(期末行.occupancy, 期末行.finalGoodRate, q).title : null
  return (
    <div>
      <成果卡 成果={学期成果(history, attrs)} 称号={称号} />
      {/* ⑤ 续营入口（班级开关默认关 ⇒ 只在老师开启时显示） */}
      {续营开关 && !已续营 && hs.length >= 12 && (
        <div className="card" style={{ background: 'var(--primary-bg)' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>继续经营 12 周（可选）</div>
          <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 4, lineHeight: 1.7 }}>
            学期成果永远以<b>前 12 周</b>为准，续营不会覆盖它；到第 24 周结束。回本参考会继续累计（GOP 口径）。
          </div>
          <button className="btn btn-primary" data-continue-btn style={{ marginTop: 10, width: '100%', minHeight: 44 }}
            onClick={() => { if (window.confirm('继续经营第 13–24 周？学期成果仍以前 12 周为准。')) on续营 && on续营() }}>
            继续经营第 13–24 周
          </button>
        </div>
      )}
      {已续营 && 期末行 == null && null}
      {已续营 && (() => {
        const 全 = Array.isArray(history) ? history : []
        const 投入 = (学期成果(全).回本 || {}).投入
        if (投入 == null || 投入 <= 0) return null
        let 累计 = 0
        for (const h of 全) { 累计 += (Number(h.gop) || 0); if (累计 >= 投入) return (
          <div className="card" style={{ background: 'var(--good-bg)' }} key="payback-hit">
            <div style={{ fontSize: 14, color: 'var(--good)', fontWeight: 700 }}>已回本（第 {h.week} 周 · GOP 口径 · 参考）</div>
          </div>
        ) }
        return null
      })()}
      {/* ⑥ 班级横向（教师端传入；不排名不打分） */}
      {班级行 && 班级行.length > 0 && <班级并排表 行={班级行} />}
    </div>
  )
}

/** 班级并排表（教师端「学期成果」/学生端共用；不排名不打分） */
export function 班级并排表({ 行 = [] }) {
  {
    const 班级行 = 行
    return (
        <div className="card">
          <div className="card-title">班级横向（并排 · 不排名）</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px' }}>组</th>
                  <th style={{ padding: '4px 6px' }}>酒店</th>
                  <th style={{ padding: '4px 6px' }}>周数</th>
                  <th style={{ padding: '4px 6px' }}>经营净利</th>
                  <th style={{ padding: '4px 6px' }}>净利率</th>
                  <th style={{ padding: '4px 6px' }}>出租率</th>
                  <th style={{ padding: '4px 6px' }}>续营净利</th>
                </tr>
              </thead>
              <tbody style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {班级行.map(r => (
                  <tr key={r.组名} style={{ borderTop: '1px solid var(--fill)' }}>
                    <td style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 600 }}>{r.组名}</td>
                    <td style={{ padding: '4px 6px' }}>{r.酒店名 || '—'}</td>
                    <td style={{ padding: '4px 6px' }}>{r.周数}</td>
                    <td style={{ padding: '4px 6px' }}>{r.经营净利 >= 0 ? '+' : '−'}{万元(Math.abs(r.经营净利))}</td>
                    <td style={{ padding: '4px 6px' }}>{率(r.净利率)}</td>
                    <td style={{ padding: '4px 6px' }}>{r.出租率 == null ? '—' : r.出租率 + '%'}</td>
                    <td style={{ padding: '4px 6px', color: 'var(--text-muted)' }}>{r.续营周数 ? `${r.续营周数}周 ${r.续营净利 >= 0 ? '+' : '−'}${万元(Math.abs(r.续营净利))}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>并排展示，不排名、不打分（口径 A）；"续营净利"= 第 13 周起单列，不混进学期口径。</div>
        </div>
  )
}
}
