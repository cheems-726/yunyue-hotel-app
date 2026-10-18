// V113-2.1 · 本周 6 指标 + 成本结构条形（**只读派生** · 数据来自本周真实结算）
//   判据：条形合计 100%±0.1% · 一次性项独立一色单列 · 数字全部来自 metricView（不在这里重算）
import { metricView } from './metricView.mjs'

const 万元 = (v) => Number.isFinite(v) ? (v / 10000).toFixed(1) + ' 万' : '—'
const 元 = (v) => Number.isFinite(v) ? Math.round(v).toLocaleString('zh-CN') : '—'
const pct = (v) => Number.isFinite(v) ? (v * 100).toFixed(1) + '%' : '—'

export default function MetricBoard({ row }) {
  const v = metricView(row)
  if (!v) return null
  const 无数据 = v.OCC == null
  const 六 = [
    { k: 'OCC（出租率）', v: pct(v.OCC) },
    { k: 'ADR（平均房价）', v: Number.isFinite(v.ADR) ? 元(v.ADR) + ' 元' : '—' },
    { k: 'RevPAR', v: Number.isFinite(v.RevPAR) ? 元(v.RevPAR) + ' 元' : '—' },
    { k: 'GOP 率', v: pct(v.GOP率) },
    { k: '净利率（含一次性）', v: pct(v.净利率) },
    { k: '总营收', v: 万元(v.总营收) },
  ]
  const 经营项 = v.成本.项.filter(x => !x.一次性 && x.占比 != null && x.占比 > 0)
  // ★ V115 §3-③：GOP 之前 = 部门成本 + 营销 + OTA（这些算进经营毛利）；之后 = 租金/两费/罚款/改造/超售
  const 前置键 = ['客房变动成本', '客房部固定', '人力固定', '公区能耗', '行政管理', '维修保养', '营销推广', 'OTA佣金']
  const 前置项 = 经营项.filter(x => 前置键.includes(x.名))
  const 后置项 = 经营项.filter(x => !前置键.includes(x.名))
  const 合 = (arr) => arr.reduce((a, x) => a + x.占比, 0)
  const 一次项 = v.成本.项.filter(x => x.一次性 && x.额 !== 0)
  const 色 = ['var(--primary)', 'var(--info)', 'var(--good)', 'var(--warn)', 'var(--bad)']
  return (
    <div style={{ margin: '0 20px 14px', padding: 12, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>本周指标观察</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
        {无数据 ? '本周无营收数据（筹建/停业周）⇒ 指标显示「—」，不补算' : '全部由本周结算结果派生（只加层，不改数）'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        {六.map(x => (
          <div key={x.k} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{x.k}</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{x.v}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sub)', marginBottom: 6 }}>
        成本结构（合计 {pct(v.成本.合计)} · 一次性项单列不计入）
      </div>
      {经营项.length > 0 ? (
        <>
          {[
            { 段: 'GOP 之前（经营毛利内）', 项s: 前置项, 起: 0 },
            { 段: 'GOP 之后（租金/两费/罚款/改造/超售）', 项s: 后置项, 起: 前置项.length },
          ].map(({ 段, 项s, 起 }) => (
            <div key={段} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 3 }}>{段} · 占经营成本 {pct(合(项s))}</div>
              {项s.length > 0 ? (
                <>
                  <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', background: 'var(--fill)' }} data-costbar="1">
                    {项s.map((x, k) => (
                      <div key={x.名} title={`${x.名} ${pct(x.占比)}`} data-w={x.占比.toFixed(6)}
                        style={{ width: (x.占比 * 100) + '%', background: 色[(起 + k) % 色.length] }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                    {项s.map((x, k) => (
                      <span key={x.名} style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 色[(起 + k) % 色.length], marginRight: 4 }} />
                        {x.名} {pct(x.占比)}
                      </span>
                    ))}
                  </div>
                </>
              ) : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>本周无此类科目（0 值不占行）</div>}
            </div>
          ))}
        </>
      ) : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>成本明细缺失 ⇒ 不画条形（不补算）</div>}

      {一次项.length > 0 && (
        <div data-onetime="1" style={{ marginTop: 8, padding: '6px 8px', borderRadius: 8, background: 'var(--warn-bg)', border: '1px dashed var(--warn-border)', fontSize: 12, color: 'var(--warn)' }}>
          一次性项（单独一色 · 不进上面的 100%）：{一次项.map(x => `${x.名} ${万元(x.额)}`).join(' · ')}
        </div>
      )}
    </div>
  )
}
