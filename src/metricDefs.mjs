// W2-3 · GOP / 净利润 口径单源（W10 正名）
// 三处界面（WeeklyReport / FinalResult / TeacherDashboard）共用本模块的标签与定义，
// 保证"同一个词在三处说的是同一件事"；断言见 tests/metrics-w2-3.test.mjs。
//
// 口径依据（已冻结，不许改）：
//   · T1.4/B3：GOP 不含租金/加盟费/利息
//   · W2-1  ：部门成本 5 科目已并入（变动按入住量、固定按可售房）
//   · W10   ：净利润 = GOP − 租金 − 非经常项；★ 期末评分基准 = 净利润
//   · W2-2  ：netProfit === 既有 profit（正名不改数值语义）

export const GOP_LABEL = 'GOP（经营毛利）'
export const GOP_SHORT = 'GOP'   // 紧凑行（列表/导出表头）用短式；长式用于明细/总结
export const GOP_DEF = 'GOP（经营毛利）＝ 营收 −（变动成本 + 部门固定成本 + 营销 + OTA佣金）；★ 不含租金/加盟费/利息'
export const NET_LABEL = '净利润'
export const NET_DEF = '净利润 ＝ GOP − 租金 − 超售赔偿 − 改造投资 − 事件罚款；★ 期末评分基准'

// 单周读数。GOP 仅新口径周具备（旧档周无该字段 → null，界面显示"—"，不编造）；
// 净利润与既有 profit 同值（引擎恒等式 netProfit === profit），旧档回退读 profit 不算编造。
export const gopOf = (h) => (Number.isFinite(h && h.gop) ? h.gop : null)
export const netOf = (h) => {
  if (Number.isFinite(h && h.netProfit)) return h.netProfit
  return Number.isFinite(h && h.profit) ? h.profit : null
}

// 累加：只累加【有该字段】的周，并回报覆盖度 —— 缺字段的周【不按 0 计入】（否则总额被静默低估）
const sumBy = (read) => (history) => {
  const arr = Array.isArray(history) ? history : []
  let value = 0, weeks = 0
  for (const h of arr) { const v = read(h); if (v !== null) { value += v; weeks++ } }
  return { value, weeks, total: arr.length, complete: arr.length > 0 && weeks === arr.length }
}
export const sumGop = sumBy(gopOf)
export const sumNet = sumBy(netOf)

export const pct = (v, d = 1) => (Number.isFinite(v) ? (v * 100).toFixed(d) + '%' : '—')
export const wan2 = (v) => (Number.isFinite(v) ? (v / 10000).toFixed(2) + '万' : '—')
export const yuanFmt = (v) => (Number.isFinite(v) ? v.toLocaleString() + ' 元' : '—')
