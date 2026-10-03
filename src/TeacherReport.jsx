// §32-U2 · 一键图文经营报告 —— 【展示层】（只读 · 可打印为 PDF）
//
//   数据全部来自 `src/teacherReport.mjs` 的纯模型（该模型只读权威源 · 零自算）
//   本文件【不做任何数字运算】—— 只管排版与格式化（格式化统一走 metricDefs 的 pct/wan2/yuanFmt）
import React, { useState } from 'react'
import Icon from './Icon.jsx'
import { 构建经营报告, 周序列 } from './teacherReport.mjs'
import { pct, wan2, yuanFmt, NET_LABEL, GOP_SHORT } from './metricDefs.mjs'

const 卡片 = { background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }
const 小标 = { fontSize: 11, color: '#9CA3AF', marginBottom: 4 }
const 数值 = { fontSize: 17, fontWeight: 700, color: '#111827' }
const 表头格 = { padding: '6px 8px', fontSize: 11, color: '#6B7280', fontWeight: 700, borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }
const 表格格 = { padding: '6px 8px', fontSize: 12, color: '#111827', borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' }

const 金额 = (v) => (Number.isFinite(v) ? Math.round(v).toLocaleString() + ' 元' : '—')
const 万 = (v) => (Number.isFinite(v) ? wan2(v) : '—')
const 百分比 = (v, d = 1) => (Number.isFinite(v) ? pct(v, d) : '—')
const 整数 = (v, 后缀 = '') => (Number.isFinite(v) ? String(v) + 后缀 : '—')

function 键值({ 名, 值, 副 }) {
  return (
    <div style={{ minWidth: 132 }}>
      <div style={小标}>{名}</div>
      <div style={数值}>{值}</div>
      {副 && <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{副}</div>}
    </div>
  )
}

// 迷你柱状（纯 CSS 宽度，不引图表库）—— 只画"逐周净流"正负
function 迷你柱({ 报告 }) {
  const { weeks, 净流, 最大 } = 周序列(报告)
  if (!weeks.length) return null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 64, paddingTop: 6 }}>
      {weeks.map((w, i) => {
        const v = 净流[i] || 0
        const h = Math.max(2, Math.round(Math.abs(v) / 最大 * 28))
        return (
          <div key={w} style={{ flex: 1, textAlign: 'center' }} title={`第 ${w} 周 ${yuanFmt(v)}`}>
            <div style={{ height: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              {v >= 0 && <div style={{ width: '70%', height: h, background: '#10B981', borderRadius: 2 }} />}
            </div>
            <div style={{ height: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
              {v < 0 && <div style={{ width: '70%', height: h, background: '#EF4444', borderRadius: 2 }} />}
            </div>
            <div style={{ fontSize: 9, color: '#9CA3AF' }}>{w}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function TeacherReport({ gs, 组名 = '', 批注 = [], onClose }) {
  const [展开周, set展开周] = useState(null)
  const 报告 = 构建经营报告(gs, { 组名, 批注 })
  const 打印 = () => { try { window.print() } catch (e) {} }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#F5F6F8', zIndex: 9000, overflowY: 'auto' }}>
      <style>{`
        @media print {
          .tr-noprint { display: none !important; }
          .tr-page { position: static !important; background: #fff !important; overflow: visible !important; }
          .tr-card { break-inside: avoid; box-shadow: none !important; border: 1px solid #E5E7EB; }
          body { background: #fff; }
        }
      `}</style>

      {/* 工具条（打印时隐藏） */}
      <div className="tr-noprint" style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, zIndex: 2 }}>
        <button onClick={onClose} style={{ border: 'none', background: '#F3F4F6', borderRadius: 8, padding: '7px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>← 返回</button>
        <div style={{ fontSize: 14, fontWeight: 700 }}>经营报告{组名 ? ` · ${组名}` : ''}</div>
        <div style={{ flex: 1 }} />
        <button onClick={打印} style={{ border: 'none', background: '#A96407', color: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>打印 / 另存 PDF</button>
      </div>

      <div className="tr-page" style={{ maxWidth: 1000, margin: '0 auto', padding: '14px 16px 40px' }}>
        {报告.未开业 ? (
          <div style={{ ...卡片, textAlign: 'center', padding: '36px 16px' }}>
            <div style={{ fontSize: 34, marginBottom: 8, display: 'flex', justifyContent: 'center' }}><Icon name="date.week" size={34} /></div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>该组还没有可报告的经营数据</div>
            <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7 }}>{报告.未开业提示}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 10 }}>
              （已读到该组存档，但 `history` 为空 —— 报告不会用 0 或估算值假装有数据）
            </div>
          </div>
        ) : (
          <>
            {/* 一、头部 */}
            <div className="tr-card" style={卡片}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{报告.头部.酒店}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                    {组名 && <span style={{ marginRight: 10 }}>{组名}</span>}
                    {报告.头部.品牌 && <span style={{ marginRight: 10 }}>{报告.头部.品牌}</span>}
                    {报告.头部.选址 && <span style={{ marginRight: 10 }}>{报告.头部.选址}</span>}
                    <span style={{ marginRight: 10 }}>{报告.头部.开店模式}</span>
                    <span>{报告.头部.已结业 ? '已结业' : `进行到第 ${报告.头部.当前周} 周`} · 已结算 {报告.头部.已结算周数} 周</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>称号</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#A96407' }}>{报告.头部.称号}</div>
                </div>
              </div>
              {报告.头部.缺周.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#92400E', background: '#FEF3C7', borderRadius: 8, padding: '6px 10px' }}>
                  有 {报告.头部.缺周.length} 个周次未经营（老师跳过）：{报告.头部.缺周.join('、')} —— 这些周**不参与**任何平均值分母
                </div>
              )}
            </div>

            {/* 二、关键数（每个数字都标来源/口径） */}
            <div className="tr-card" style={卡片}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>二、关键数 <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 400 }}>（全部取自该组存档与 metricDefs 单源 · 报告不做任何自算）</span></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
                <键值 名="运营启动资金（IC）" 值={万(报告.关键.运营启动资金)} 副="单源 SCALE.IC_NEW" />
                <键值 名="当前资金" 值={金额(报告.关键.当前资金)} 副={报告.关键.资金状态 || '存档无该字段'} />
                <键值 名="累计营收" 值={金额(报告.关键.累计营收)} 副="Σ history[].revenue" />
                <键值 名={`累计${NET_LABEL}（资金口径）`} 值={金额(报告.关键.累计净利_资金口径)} 副={`率 ${百分比(报告.关键.净利率_资金口径)} · 含开业一次性费用`} />
                <键值 名={`累计${NET_LABEL}（经营口径）`} 值={金额(报告.关键.累计净利_经营口径)} 副={`率 ${百分比(报告.关键.净利率_经营口径)} · 剔除一次性项（教学引用）`} />
                <键值 名="平均出租率" 值={整数(报告.关键.出租率, '%')} 副="Σ 周值 ÷ 已结算周数" />
                <键值 名="平均好评率" 值={整数(报告.关键.好评率, '%')} 副="末周好评率均值" />
                <键值 名="品质 / 声誉 / 士气" 值={`${整数(报告.关键.品质)} / ${整数(报告.关键.声誉)} / ${整数(报告.关键.士气)}`} 副="属性池（旧档回退初值）" />
                <键值 名="差评总数" 值={整数(报告.关键.差评总数, ' 条')} 副="Σ history[].negativeCount" />
                {报告.关键.累计加盟两费 > 0 && <键值 名="累计加盟两费" 值={金额(报告.关键.累计加盟两费)} 副="引擎实收（管理费 + CRS）" />}
              </div>
              {(!报告.关键.覆盖度.净利完整 || !报告.关键.覆盖度.GOP完整 || 报告.关键.覆盖度.净利周数 < 报告.关键.覆盖度.周数) && (
                <div style={{ marginTop: 10, fontSize: 11, color: '#92400E', lineHeight: 1.7 }}>
                  {!报告.关键.覆盖度.净利完整 && (
                    <div>净利润覆盖度：{报告.关键.覆盖度.净利周数}/{报告.关键.覆盖度.周数} 周有净利润字段（旧档周缺字段时**不按 0 计入**，避免总额被静默低估）</div>
                  )}
                  {!报告.关键.覆盖度.GOP完整 && (
                    <div>GOP 覆盖度：本组有旧档周（无 GOP 字段）⇒ GOP 列显示"—"，这是**如实留空**，不是算不出来（GOP 口径见上）</div>
                  )}
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 10, color: '#9CA3AF', lineHeight: 1.7 }}>
                {报告.口径注.净利润}<br />{报告.口径注.净利率}<br />{报告.口径注.资金}
              </div>
            </div>

            {/* 三、逐周表 + 迷你柱 */}
            <div className="tr-card" style={卡片}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>三、逐周经营 <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 400 }}>（点某行看该周 7 天流水；列值均为 history 原值）</span></div>
              <迷你柱 报告={报告} />
              <div style={{ overflowX: 'auto', marginTop: 6 }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      {['周', '营收', '总成本', GOP_SHORT, `${NET_LABEL}（资金）`, `${NET_LABEL}（经营）`, '出租率', '差评', '期末资金', '事件'].map(h => <th key={h} style={表头格}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {报告.逐周.map(r => (
                      <React.Fragment key={r.week}>
                        <tr onClick={() => set展开周(展开周 === r.week ? null : r.week)} style={{ cursor: 'pointer', background: 展开周 === r.week ? '#FFF9F0' : 'transparent' }}>
                          <td style={{ ...表格格, fontWeight: 700 }}>第 {r.week} 周</td>
                          <td style={表格格}>{万(r.营收)}</td>
                          <td style={表格格}>{万(r.成本)}</td>
                          <td style={表格格}>{r.GOP === null ? '—' : 万(r.GOP)}</td>
                          <td style={{ ...表格格, color: Number.isFinite(r.净流) && r.净流 < 0 ? '#EF4444' : '#10B981', fontWeight: 700 }}>{万(r.净流)}</td>
                          <td style={{ ...表格格, color: Number.isFinite(r.经营净流) && r.经营净流 < 0 ? '#EF4444' : '#111827' }}>{万(r.经营净流)}</td>
                          <td style={表格格}>{整数(r.出租率, '%')}</td>
                          <td style={表格格}>{r.差评数}{r.差评数 > 0 ? ' 条' : ''}</td>
                          <td style={表格格}>{r.资金 === null ? '—' : 金额(r.资金)}</td>
                          <td style={{ ...表格格, color: '#6B7280' }}>{r.事件.length ? r.事件.map(e => e.icon || '•').join('') : '—'}</td>
                        </tr>
                        {展开周 === r.week && (
                          <tr key={`${r.week}-days`}>                            <td colSpan={10} style={{ padding: '8px 10px', background: '#FFF9F0', borderBottom: '1px solid #F3F4F6' }}>
                              {r.日快照.length ? (
                                <>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#A96407', marginBottom: 4 }}>
                                    第 {r.week} 周逐日流水（Σ7 天 ≡ 周值 · 引擎 splitExact 精确分摊）
                                    {r.日快照自证 && <span style={{ marginLeft: 8, color: r.日快照自证.ok ? '#10B981' : '#EF4444' }}>
 {r.日快照自证.ok ? ` 自证通过（${r.日快照自证.rows} 天）` : ` 与周值不等：${(r.日快照自证.diff || []).join('、')}（异常，请报告）`}
                                    </span>}
                                  </div>
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {r.日快照.map(d => (
                                      <div key={d.天} style={{ fontSize: 10, background: '#fff', borderRadius: 6, padding: '4px 8px', color: '#374151' }}>
                                        第 {d.天} 天：收 {万(d.营收)} · 支 {万(d.成本)} · 现金 {万(d.现金)} · 入住 {d.入住 ?? '—'}/{d.退房 ?? '—'} · 在店 {d.在店} · 评价 {d.评价 ?? 0}
                                      </div>
                                    ))}
                                  </div>
                                </>
                              ) : <span style={{ fontSize: 11, color: '#9CA3AF' }}>该周存档无逐日快照（旧档）—— 报告不补造。</span>}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 18, marginTop: 12, flexWrap: 'wrap' }}>
                <键值 名="最好周（经营口径）" 值={报告.最好周_经营 ? `第 ${报告.最好周_经营.week} 周 · ${万(报告.最好周_经营.经营净流)}` : '—'} />
                <键值 名="最差周（经营口径）" 值={报告.最差周_经营 ? `第 ${报告.最差周_经营.week} 周 · ${万(报告.最差周_经营.经营净流)}` : '—'} />
                <键值 名="最好周（资金口径）" 值={报告.最好周_资金 ? `第 ${报告.最好周_资金.week} 周 · ${万(报告.最好周_资金.净流)}` : '—'} />
                <键值 名="最差周（资金口径）" 值={报告.最差周_资金 ? `第 ${报告.最差周_资金.week} 周 · ${万(报告.最差周_资金.净流)}` : '—'} />
              </div>
              <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 6 }}>{报告.极值口径注}</div>
            </div>

            {/* 四、期末评分 */}
            <div className="tr-card" style={卡片}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>四、期末评分 <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 400 }}>（单源 metricDefs.scoreOf —— 与学生端终局页同一套阶梯）</span></div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <div style={{ fontSize: 30, fontWeight: 800, color: '#A96407' }}>{报告.期末评分.分}</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{报告.期末评分.等级}</div>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                {报告.期末评分.维度.map(d => (
                  <div key={d.名} style={{ fontSize: 11, color: '#6B7280' }}>
                    {d.名}（{d.权重}）<b style={{ color: '#111827' }}> {d.得分}</b>
                  </div>
                ))}
              </div>
            </div>

            {/* 五、事件时间线 */}
            <div className="tr-card" style={卡片}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>五、关键事件时间线 <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 400 }}>（共 {报告.时间线.length} 条 · 取自 history[].events）</span></div>
              {报告.时间线.length ? (
                <div>
                  {报告.时间线.map((e, i) => (
                    <div key={`${e.week}-${i}`} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: i === 报告.时间线.length - 1 ? 'none' : '1px solid #F3F4F6' }}>
                      <div style={{ fontSize: 11, color: '#9CA3AF', minWidth: 56 }}>第 {e.week} 周</div>
                      <div style={{ fontSize: 12, color: '#111827' }}>
                        <b>{e.icon} {e.name}</b>{e.impact && <span style={{ color: '#A96407', marginLeft: 6 }}>{e.impact}</span>}
                        {e.text && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{e.text}</div>}
                        {e.tip && <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{e.tip}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div style={{ fontSize: 11, color: '#9CA3AF' }}>这段时间没有触发任何事件。</div>}
            </div>

            {/* 六、老师批注（只读） */}
            <div className="tr-card" style={卡片}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>六、老师批注 <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 400 }}>（只读展示 · 写批注在总览页的组卡片里）</span></div>
              {报告.批注.length ? 报告.批注.map((n, i) => (
                <div key={i} style={{ padding: '7px 10px', background: '#FFF9F0', borderRadius: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#A96407' }}>{n.week > 0 ? `第 ${n.week} 周批注` : '总评'}{n.score != null ? ` · 评分 ${n.score}/100` : ''}</div>
                  <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, marginTop: 3, whiteSpace: 'pre-wrap' }}>{n.note}</div>
                </div>
              )) : <div style={{ fontSize: 11, color: '#9CA3AF' }}>还没有批注。</div>}
            </div>

            <div style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.8 }}>
              本报告为**只读汇总**：数字全部取自该组云端存档的 `history` 与引擎单源口径（metricDefs / stateMigration），报告本身不做任何加减计算。<br />
              资金口径与经营口径并列展示的原因见第二节脚注；两者都是引擎实收，不存在第二本账。
            </div>
          </>
        )}
      </div>
    </div>
  )
}
