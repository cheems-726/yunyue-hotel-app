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
export const NET_DEF = '净利润 ＝ GOP − 租金 − 超售赔偿 − 改造投资 − 事件罚款 − 加盟两费（管理费 + CRS）；★ 期末评分基准'

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

// ── 🔴 E1（二期 · 唯一账本）· 聚合量与四维评分【单源】──────────────────────────
// 起因（BL-7 同族：同一批"可由引擎周值导出的量"曾各写一份）：
//   · 累计利润：HotelStatus 自己 `history.reduce((s,h)=>s+h.profit,0)` —— 与 sumNet 两套（旧档口径还不同）
//   · 四维评分：FinalResult 与 TeacherDashboard 各写一份【相同阶梯】⇒ 改一处必漏另一处
//   · 平均出租率/好评率/差评数/处理率/总营收：同样两套
// ⇒ 统一收在本模块：谁要这些量，只许调这里的函数（守门 tests/ledgerSingleSource.test.mjs）。
// ★ 零变化证明：下面是 FinalResult 原内联式的【逐字提取】；测试保留旧式当 oracle，逐字段比对。

// 平均出租率 / 平均好评率（四舍五入到整数；无周 → 0）
export const avgOccupancy = (history) => {
  const arr = Array.isArray(history) ? history : []
  return arr.length ? Math.round(arr.reduce((s, h) => s + h.occupancy, 0) / arr.length) : 0
}
export const avgGoodRate = (history) => {
  const arr = Array.isArray(history) ? history : []
  return arr.length ? Math.round(arr.reduce((s, h) => s + h.finalGoodRate, 0) / arr.length) : 0
}
// 差评总数（缺字段按 0 —— 教师端口径；原学生端未兜底，脏数据会让整段变 NaN，本次按更安全者统一）
export const totalNegative = (history) => (Array.isArray(history) ? history : []).reduce((s, h) => s + (h.negativeCount || 0), 0)
// 差评处理率（只统计"本周确有差评待办"的周；无 → null ⇒ 调用方回退旧口径，不惩罚历史档）
export const avgHandleRateOf = (history) => {
  const arr = Array.isArray(history) ? history : []
  const weeks = arr.filter(h => h.handleStats && (h.handleStats.pending + h.handleStats.resolved) > 0)
  return weeks.length ? weeks.reduce((s, h) => s + h.handleStats.resolved / (h.handleStats.pending + h.handleStats.resolved), 0) / weeks.length : null
}
// 总营收（缺字段按 0）
export const totalRevenue = (history) => (Array.isArray(history) ? history : []).reduce((s, h) => s + (h.revenue || 0), 0)

// 四维评分 + 评级（★ 学生端 FinalResult 与 教师端 TeacherDashboard 共用；口径 W10/W2-2/D20 已冻结）
//   40% 累计净利润 · 25% 平均口碑 · 20% 平均出租率 · 15% 差评控制（有处理率快照则按处理率，否则按条数）
//   ★ 空 history → finalScore 0（原教师端行为；学生端到不了这一步）
export function scoreOf(history) {
  const arr = Array.isArray(history) ? history : []
  const totalProfit = sumNet(arr).value
  const avgOcc = avgOccupancy(arr)
  const avgGood = avgGoodRate(arr)
  const totalNeg = totalNegative(arr)
  const handleRate = avgHandleRateOf(arr)
  const profitScore = totalProfit >= 150000 ? 100 : totalProfit >= 90000 ? 85 : totalProfit >= 30000 ? 70 : totalProfit >= 0 ? 55 : 40
  const reputationScore = avgGood >= 90 ? 95 : avgGood >= 85 ? 85 : avgGood >= 75 ? 70 : avgGood >= 60 ? 55 : 40
  const occupancyScore = avgOcc >= 75 ? 95 : avgOcc >= 65 ? 80 : avgOcc >= 55 ? 65 : avgOcc >= 45 ? 50 : 40
  const negativeScore = totalNeg === 0
    ? 100
    : handleRate != null
      ? (handleRate >= 0.9 ? 95 : handleRate >= 0.7 ? 85 : handleRate >= 0.5 ? 70 : handleRate >= 0.3 ? 55 : 40)
      : (totalNeg <= 5 ? 80 : totalNeg <= 10 ? 65 : 50)
  const finalScore = arr.length ? Math.round(profitScore * 0.4 + reputationScore * 0.25 + occupancyScore * 0.2 + negativeScore * 0.15) : 0
  const grade = finalScore >= 90 ? 'S · 标杆酒店' : finalScore >= 80 ? 'A · 优秀经营' : finalScore >= 70 ? 'B · 良好经营' : finalScore >= 60 ? 'C · 合格经营' : 'D · 需改进'
  return { totalProfit, avgOccupancy: avgOcc, avgGoodRate: avgGood, totalNegative: totalNeg, avgHandleRate: handleRate, profitScore, reputationScore, occupancyScore, negativeScore, finalScore, grade }
}

// ── 🔴 §14.3（G3 第二步）· 加盟两费（管理费 + CRS）单源 ──────────────────
//   引擎自 §14.3 起对 汉庭/全季/海友 按营收实收两费（唯一计算点 = src/franchiseFees.mjs）。
//   本处只提供【读取口径】：界面（周报/终局/教师端）要露这笔钱就读这里，
//   不许各自去 history[i].weeklyExpenses 里翻键名 —— 那又是两套命名（BL-7 同族）。
export const FEE_LABEL = '加盟两费（管理费 + CRS）'
export const FEE_DEF = '加盟两费 ＝ 加盟管理费（营收 × 5%）+ 加盟CRS（营收 × 有效 2.4% = 名义 8% × 渠道占比 30%）；★ 只对 汉庭/全季/海友 实收；其余品牌费率待补（不计费、不编造）'
// ★ §23.2（D65）：净利率【分口径】—— B2 后 week1 含开业一次性费用（全季 80 间 = 34.9 万），
//   它会淹没经营差异（2.9 万/周 的费用 vs 几千的周净利）⇒ 两个口径必须各起名、各标清：
//     「资金口径」= 净利润（含开业费用与保证金退还）—— 用于讲【现金流/开店成本】
//     「经营口径」= 净利润 + 一次性净额（加回开业费、减去退还）—— 用于讲【经营好坏 · 教学引用用这个】
//   ★ 凡出现"净利率"的地方必须标口径（报告/全景表/长跑/台账 —— reportCaliber/gapUI 有守门）。
export const 净利率口径 = {
  资金: '含开业一次性费用与保证金退还（现金流视角）',
  经营: '剔除一次性项（经营好坏视角 · 教学引用用这个）',
}
// 一次性净额 = 开业费用 − 保证金退还（正 = 期初净流出；week12 退还后部分回冲）
export const oneTimeNetOf = (h) => (h && h.oneTimeFees ? h.oneTimeFees.开业费用 - h.oneTimeFees.保证金退还 : 0)
// 经营净利（周）= 资金净利 + 一次性净额（把一次性项加回）
export const opNetOf = (h) => (Number.isFinite(netOf(h)) ? netOf(h) + oneTimeNetOf(h) : null)   // 经营 = 资金 + 净额（把开业费加回）

export const franchiseFeeOf = (h) => (h && h.franchiseFees && Number.isFinite(h.franchiseFees.合计) ? h.franchiseFees.合计 : 0)
export const sumFranchiseFee = (history) => (Array.isArray(history) ? history : []).reduce((s, h) => s + franchiseFeeOf(h), 0)

// 周环比用的"上一周分数"（去掉最后一周再算；不足 2 周 → null）
export const prevScore = (history) => {
  const arr = Array.isArray(history) ? history : []
  return arr.length <= 1 ? null : scoreOf(arr.slice(0, -1)).finalScore
}

export const pct = (v, d = 1) => (Number.isFinite(v) ? (v * 100).toFixed(d) + '%' : '—')
export const wan2 = (v) => (Number.isFinite(v) ? (v / 10000).toFixed(2) + '万' : '—')
export const yuanFmt = (v) => (Number.isFinite(v) ? v.toLocaleString() + ' 元' : '—')
