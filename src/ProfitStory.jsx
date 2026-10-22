// V141 §1 · 经营表现（主展示 = 赚了多少）+ 每周策略归因 + 投资回收（折叠）
import React from 'react'
import { wan1 } from './metricDefs.mjs'
import { 周经营净利, 经营口径文案, 周策略, 变化项, 周归因, 回本参考 } from './weeklyProfit.mjs'

const 带号万 = (v) => (Number.isFinite(v) ? (v >= 0 ? '+' : '') + wan1(v) : '—')

export default function ProfitStory({ history = [], capital }) {
  const hs = Array.isArray(history) ? history : []
  const 文案 = 经营口径文案(hs, capital)
  const c = 文案.c
  const 本周 = hs.length ? 周经营净利(hs[hs.length - 1]) : null
  const 上周 = hs.length > 1 ? 周经营净利(hs[hs.length - 2]) : null
  const 差 = (本周 != null && 上周 != null) ? 本周 - 上周 : null
  const 最大 = Math.max(1, ...hs.map(h => Math.abs(周经营净利(h) || 0)))
  const 最好 = hs.reduce((a, h) => (!a || 周经营净利(h) > 周经营净利(a) ? h : a), null)
  const 最差 = hs.reduce((a, h) => (!a || 周经营净利(h) < 周经营净利(a) ? h : a), null)
  const 回收 = 回本参考(hs)

  return (
    <div className="card" data-profit-story="1" style={{ borderColor: 'var(--primary-border)' }}>
      <div className="card-title" style={{ marginBottom: 6 }}>经营表现（赚了多少）</div>
      {hs.length === 0 ? (
        <div style={{ fontSize: 16, color: 'var(--text-muted)', textAlign: 'center', padding: '18px 0' }}>
          完成第一次结算后，这里显示经营净利与每周趋势
        </div>
      ) : (
        <>
          {/* ① 12 周经营净利（扣租金/装修/加盟费，不含一次性）—— 第一视觉 */}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{c.周数} 周经营净利（扣租金/装修/加盟费，不含一次性）</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 34, fontWeight: 800, color: c.经营净利 >= 0 ? 'var(--good)' : 'var(--bad)', lineHeight: 1.15 }}>{带号万(c.经营净利)}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 4, lineHeight: 1.8 }}>{文案.副}</div>
          <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2, lineHeight: 1.8 }}>{文案.一次性}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.8 }}>{文案.一句话}</div>
          {/* ② 本周 vs 上周 */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 本周 >= 0 ? 'var(--good)' : 'var(--bad)' }}>本周 {带号万(本周)}</div>
            {差 != null && (
              <div style={{ fontSize: 16, fontWeight: 600, color: 差 >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                {差 >= 0 ? '↑' : '↓'} {wan1(Math.abs(差))}
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>（比上周）</span>
              </div>
            )}
          </div>

          {/* ③ 每周趋势（12 周柱） */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 88, marginTop: 14, padding: '0 2px' }}>
            {hs.map((h, i) => {
              const g = 周经营净利(h)
              const hgt = Math.max(4, Math.round(Math.abs(g) / 最大 * 66))
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }} title={`第${h.week}周 ${带号万(g)}`}>
                  <div style={{ width: '100%', maxWidth: 22, height: hgt, borderRadius: 3, background: g >= 0 ? 'var(--good)' : 'var(--bad)', opacity: 0.85 }} />
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{h.week}</div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginTop: 4, gap: 8, flexWrap: 'wrap' }}>
            <span>最好：第 {最好?.week} 周 {带号万(周经营净利(最好))}</span>
            <span>最差：第 {最差?.week} 周 {带号万(周经营净利(最差))}</span>
          </div>

          {/* 每周策略 → 赚多赚少（教学核心） */}
          <div style={{ marginTop: 14, borderTop: '1px solid var(--fill)', paddingTop: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>每周策略 → 赚多赚少</div>
            {hs.map((h, i) => {
              const g = 周经营净利(h)
              const 前 = i > 0 ? 周经营净利(hs[i - 1]) : null
              const d = (前 != null && Number.isFinite(g)) ? g - 前 : null
              const 前周 = i > 0 ? hs[i - 1] : null
              const 变 = 前周 ? 变化项(h, 前周) : []
              const 策 = 前周 ? 变 : 周策略(h, 3)
              return (
                <div key={i} style={{ padding: '7px 0', borderBottom: '1px solid var(--fill)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>第 {h.week} 周</span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: g >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                      {带号万(g)}
                      {d != null && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>比上周 {d >= 0 ? '+' : '−'}{wan1(Math.abs(d))}</span>}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>
                    {前周
                      ? (变.length ? `调整：${变.map(x => `${x.name}（${x.旧} → ${x.新}）`).join(' · ')}` : '调整：本周未调整决策')
                      : (策.length ? `首周策略：${策.map(x => `${x.name}（${x.选项}）`).join(' · ')}` : '首周无决策记录')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.6 }}>
                    归因：{周归因(h, 前周)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 投资回收：默认折叠，不进首屏 */}
          <details data-payback="1" style={{ marginTop: 10 }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', minHeight: 44, lineHeight: '44px' }}>展开：投资回收（参考）</summary>
            <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.8, padding: '0 2px 6px' }}>
              {回收.待补 ? (
                <div>一次性投入：待补（缺来源数据）</div>
              ) : (
                <>
                  <div>一次性投入 −{wan1(回收.投入)} · 已回收 {Math.round(回收.进度 * 100)}% · {回收.约第N周 != null ? `约第 ${回收.约第N周} 周回本（估算）` : '按最近 4 周节奏暂无法估算'}</div>
                  <div>口径：已回收 = 累计 GOP（经营赚的）；外推只用最近 4 周平均，不是整段平均；<b>课程内不要求回本</b>。</div>
                </>
              )}
            </div>
          </details>
        </>
      )}
    </div>
  )
}
