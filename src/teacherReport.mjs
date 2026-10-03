// §32-U2 · 一键图文经营报告 —— 【纯模型层】（只读汇总 · 零自算）
//
// ── 出处 ────────────────────────────────────────────────────────
//   单元卡 `2-任务包/现行/单元卡-U2.md`（= 模块六-3 = 三期「终结报告」）：
//   老师点一下拿到【某个组】的一页经营报告，用于期末讲评与成绩依据。
//
// ── ★★ 本模块的唯一铁律（违反即返工 · 单元卡 §3）─────────────────
//   报告里**每一个数字都必须来自既有权威源**，本模块**只做读取与整形**：
//     · 逐周结果  = `state.history[i]`（就是 settle() 的返回对象，原样读）
//     · 累计量    = `src/metricDefs.mjs`（totalRevenue / sumNet / sumOpNet / 累计净利率 / scoreOf / avg*）
//     · 日流水    = `history[i].dailySnapshots`（Σ7天 ≡ 周值，由 dayEngine.splitExact 保证）
//     · 资金与阈值= `src/stateMigration.mjs` 的 SCALE（IC / 变黄线 / 变红线 单源）
//     · 属性池    = `src/attrs.js` 的 normalizeAttrs（旧档无 attrs ⇒ 回退初值，绝不 NaN）
//     · 称号      = `src/hotelTitle.js` 的 getTitle（与学生端/教师端同一套）
//   ⇒ 本模块**没有**任何"营收＝Σ…"式的自算；要加新数字，先问"它有没有单源"。
//   ⇒ 守门 `tests/teacherReport.test.mjs` 断言这一点（结构扫描 + 逐值比对）。
//
// ── 边界 ────────────────────────────────────────────────────────
//   · 纯函数 · 不 import settlement（不触发结算）、不写任何存档、不被引擎/Edge 引用
//   · 云端存档可能为空/旧结构 ⇒ 一切字段兜底（缺就 null/0，不编造），绝不抛异常

import {
  scoreOf, totalRevenue, sumNet, sumOpNet, 累计净利率, 净利率口径, SCORE_WEIGHTS,
  netOf, opNetOf, gopOf, avgOccupancy, avgGoodRate, totalNegative,
  NET_LABEL, NET_DEF, GOP_SHORT, GOP_DEF, FEE_LABEL, FEE_DEF, sumFranchiseFee,
} from './metricDefs.mjs'
import { normalizeAttrs } from './attrs.js'
import { buildDailyReport, reconcileWithWeek } from './dailyReport.mjs'   // ★ 日快照/日汇总链单源
import { SCALE } from './stateMigration.mjs'
import { getTitle } from './hotelTitle.js'
import { missingWeeks, missingLabel } from './missingWeeks.mjs'

export const 报告口径注 = {
  净利率: `净利率分两口径：资金口径＝${净利率口径.资金}；经营口径＝${净利率口径.经营}。★ 本报告的教学引用行用【经营】口径`,
  净利润: NET_DEF,
  GOP: GOP_DEF,
  两费: FEE_DEF,
  合计两费: FEE_LABEL,
  资金: `运营启动资金＝SCALE.IC_NEW（单源 src/stateMigration.mjs）；资金偏低线 ${SCALE.变黄线} / 破产预警线 ${SCALE.变红线}（＝ IC×0.2 / IC×0.1）`,
}

// 周次标签（缺周由 missingWeeks 判定，报告要如实标"未经营"，不补零）
export const 周标签 = (week) => `第 ${week} 周`

// 逐周行：**逐字段原样读** history[i]（不做任何加减；缺字段 ⇒ null，界面显示"—"）
//   ★ 日快照走【单源】`dailyReport.mjs`（buildDailyReport 知道 dayIndex 藏在 d.dailySnapshot 里；
//     自证走 reconcileWithWeek —— 本模块**不自己 Σ**，否则就是"第二份日汇总链"（ledgerSingleSource 实测抓到））
function 逐周行(h, i) {
  const week = Number.isFinite(h && h.week) ? h.week : i + 1
  const 快照行s = buildDailyReport(h)          // [] = 旧档/未接线（界面显示"该周存档无逐日快照"，不补造）
  const raw = Array.isArray(h && h.dailySnapshots) ? h.dailySnapshots : []
  return {
    week,
    营收: Number.isFinite(h && h.revenue) ? h.revenue : null,
    成本: Number.isFinite(h && h.totalCost) ? h.totalCost : null,
    GOP: gopOf(h),                       // 旧档周无 gop ⇒ null（不编造）
    净流: netOf(h),                       // 资金口径 = 引擎 netProfit（旧档回退 profit）
    经营净流: opNetOf(h),                  // 经营口径 = 资金 + 一次性净额
    出租率: Number.isFinite(h && h.occupancy) ? h.occupancy : null,
    差评数: Number.isFinite(h && h.negativeCount) ? h.negativeCount : 0,
    资金: Number.isFinite(h && h.capital) ? h.capital : null,
    加盟两费: h && h.franchiseFees && Number.isFinite(h.franchiseFees.合计) ? h.franchiseFees.合计 : null,
    日快照: 快照行s.map((r, k) => ({
      天: r.dayIndex, 营收: r.revenue, 成本: r.cost, 现金: r.cashDelta, 在店: r.occupied, 评价: r.reviews,
      入住: raw[k] && Number.isFinite(raw[k].checkins) ? raw[k].checkins : null,
      退房: raw[k] && Number.isFinite(raw[k].checkouts) ? raw[k].checkouts : null,
    })),
    // ★ 日快照 Σ === 周值（判据在 dailyReport.reconcileWithWeek —— 引擎 splitExact 保证）
    日快照自证: 快照行s.length ? reconcileWithWeek(h) : null,
    事件: (Array.isArray(h && h.events) ? h.events : []).map(e => ({
      week, icon: e.icon || '', name: e.name || '（未命名事件）', text: e.text || '', impact: e.impact || '', tip: e.tip || '', type: e.type || '',
    })),
  }
}

// 最好/最差周（★ 两个口径都给，名字里带口径，界面照抄名字 —— 避免"哪个口径"说不清）：
//   · 资金口径（净流）＝ 引擎 netProfit（含开业一次性费用与保证金退还）⇒ 第 1 周通常最差，那是**开业费**不是经营差
//   · 经营口径（经营净流）＝ 资金 + 一次性净额 ⇒ 讲"哪周经营得好"用这个（与教学引用口径一致）
//   并列取更早的周（稳定 · 可复算）
function 极值周(行s, key, 方向) {
  const 有值 = 行s.filter(r => Number.isFinite(r[key]))
  if (!有值.length) return null
  return 有值.reduce((a, b) => {
    const 更好 = 方向 === 'max' ? b[key] > a[key] : b[key] < a[key]
    return 更好 ? b : a
  })
}

export function 构建经营报告(gs, { 组名 = '', 批注 = [] } = {}) {
  const s = (gs && gs.state) || gs || {}
  const history = Array.isArray(s.history) ? s.history : []
  const attrs = normalizeAttrs(s.attrs)
  const 评分 = scoreOf(history)
  const 累计营收 = totalRevenue(history)
  const 资金净利 = sumNet(history)
  const 经营净利 = sumOpNet(history)
  const 累计两费 = sumFranchiseFee(history)
  const 行s = history.map(逐周行)
  const 缺周 = missingWeeks(history)
  const titleInfo = getTitle(评分.avgOccupancy, 评分.avgGoodRate, attrs.quality)

  const 头部 = {
    组名,
    酒店: s.brand?.name && s.property?.name ? `${s.brand.name}·${s.property.name}` : (s.brand?.name || '未开业'),
    称号: `${titleInfo.icon} ${titleInfo.title}`,
    品牌: s.brand?.name || null,
    选址: s.location ? `${s.location.city || ''}${s.location.city && s.location.district ? '·' : ''}${s.location.district || ''}` : null,
    开店模式: s.bizMode === 'ota' ? 'OTA 平台合作（佣金 15% · 线上流量更稳）' : '自主直营（无平台佣金）',
    当前周: Number.isFinite(s.week) ? s.week : (行s.length ? 行s[行s.length - 1].week : 0),
    已结业: !!s.finished,
    已结算周数: 行s.length,
    缺周: 缺周.map(w => missingLabel(w)),
  }

  const 关键 = {
    运营启动资金: SCALE.IC_NEW,
    当前资金: Number.isFinite(s.capital) ? s.capital : null,
    资金状态: !Number.isFinite(s.capital) ? null
      : (s.capital < SCALE.变红线 ? '破产预警线以下' : (s.capital < SCALE.变黄线 ? '资金偏低' : '正常')),
    累计营收,
    累计净利_资金口径: 资金净利.value,
    累计净利_经营口径: 经营净利.value,
    净利率_资金口径: 累计净利率(history, '资金'),
    净利率_经营口径: 累计净利率(history, '经营'),
    出租率: avgOccupancy(history),
    好评率: 评分.avgGoodRate,
    品质: attrs.quality, 声誉: attrs.reputation, 士气: attrs.morale,
    差评总数: totalNegative(history),
    累计加盟两费: 累计两费,
    覆盖度: { 周数: 行s.length, 净利周数: 资金净利.weeks, 净利完整: 资金净利.complete, 经营完整: 经营净利.complete, GOP完整: 行s.every(r => r.GOP !== null) },
  }

  const 期末评分 = {
    分: 评分.finalScore, 等级: 评分.grade,
    维度: [
      { 名: '累计净利', 权重: `${SCORE_WEIGHTS.profit * 100}%`, 得分: 评分.profitScore },
      { 名: '平均口碑', 权重: `${SCORE_WEIGHTS.reputation * 100}%`, 得分: 评分.reputationScore },
      { 名: '平均出租率', 权重: `${SCORE_WEIGHTS.occupancy * 100}%`, 得分: 评分.occupancyScore },
      { 名: '差评控制', 权重: `${SCORE_WEIGHTS.negative * 100}%`, 得分: 评分.negativeScore },
    ],
    末周净利率: 行s.length && Number.isFinite(行s[行s.length - 1].营收) && 行s[行s.length - 1].营收 > 0 ? 行s[行s.length - 1].净流 / 行s[行s.length - 1].营收 : null,
  }

  return {
    未开业: 行s.length === 0,
    未开业提示: 行s.length === 0
      ? '该组还没有已结算的周 —— 学生尚未开业，或第 1 周还没结算。等它跑出一周后，这里会自动出现完整经营报告。'
      : null,
    头部, 关键, 期末评分,
    逐周: 行s,
    时间线: 行s.flatMap(r => r.事件),
    最好周_经营: 极值周(行s, '经营净流', 'max'),
    最差周_经营: 极值周(行s, '经营净流', 'min'),
    最好周_资金: 极值周(行s, '净流', 'max'),
    最差周_资金: 极值周(行s, '净流', 'min'),
    极值口径注: '「最好/最差周」两条口径都给：资金口径＝引擎净利润（第 1 周含开业一次性费用，通常最差 —— 那是开店花的钱，不是经营差）；经营口径＝剔除一次性项（讲"哪周经营得好"用这个）',
    批注: (Array.isArray(批注) ? 批注 : []).map(n => ({
      week: n.week || 0, note: n.note || '', score: Number.isFinite(n.score) ? n.score : null, at: n.updated_at || null,
    })).sort((a, b) => (a.week || 0) - (b.week || 0)),
    口径注: 报告口径注,
  }
}

// 图表用：逐周净流（正负）与出租率序列 —— 只从 行s 取，不再读第二遍源
export function 周序列(报告) {
  const 行s = (报告 && 报告.逐周) || []
  return {
    weeks: 行s.map(r => r.week),
    净流: 行s.map(r => r.净流),
    营收: 行s.map(r => r.营收),
    出租率: 行s.map(r => r.出租率),
    最大: Math.max(1, ...行s.map(r => Math.abs(r.净流 || 0))),
  }
}
