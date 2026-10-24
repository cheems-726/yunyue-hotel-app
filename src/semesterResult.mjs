// V152 §1 · 学期成果页纯数据层 —— 只重排 history 既有字段，不重算引擎、不改 history（卡红线）
//
// 口径（沿用 V145 / D342）：
//   · 主指标 = 经营净利（= 净利润 + 开业费用 − 保证金退还；不含一次性）—— 单源 src/weeklyProfit.mjs
//   · 成果页永远只看【前 12 周】（学期口径）：续营跑到的 13–24 周不进成果、不覆盖前 12 周
//   · 一句话点评只用已有数据，每条 claim 带依据（页面上可点开看）
//   · 班级并排 = 重排，不排序、不排名、不打分（D342 口径 A）
import { TOTAL_WEEKS } from './semester.mjs'
import { sumGop, sumNet, totalRevenue, gopOf } from './metricDefs.mjs'
import { 周经营净利, 周策略, 一次性投入, 累计GOP } from './weeklyProfit.mjs'

/** 学期切片：只取前 TOTAL_WEEKS 周（按周号，缺周照实缺；续营周 13+ 一律不进成果） */
export function 学期切片(history) {
  const hs = Array.isArray(history) ? history : []
  return hs.filter(h => Number(h && h.week) >= 1 && Number(h.week) <= TOTAL_WEEKS)
}

const 决策名 = {
  pricing: '动态调价', shifts: '前台排班', overbook: '超额预订', 'member-convert': '会员转化',
  'quality-check': '客房质检', linen: '布草管理', hygiene: '卫生计划', ota: 'OTA优化',
  campaign: '活动策划', corporate: '协议客户', reputation: '口碑管理', 'member-threshold': '会员门槛',
  'report-diagnosis': '报表诊断', 'revenue-mgmt': '收益管理', 'hr-optimize': '人力优化',
  energy: '能耗管控', renovation: '改造投资', emergency: '应急预案',
}
const 决策名Of = (id) => 决策名[id] || id
const 决策简述 = (h, n = 3) => 周策略(h, n).map(r => r.name).slice(0, n)

/** 最好/最差一周（按 周经营净利；并列取先出现的一周 —— 确定性，不掷骰子） */
export function 最好最差周(history) {
  const hs = 学期切片(history)
  if (!hs.length) return { 最好: null, 最差: null }
  let 最好 = hs[0], 最差 = hs[0]
  for (const h of hs) {
    if (周经营净利(h) > 周经营净利(最好)) 最好 = h
    if (周经营净利(h) < 周经营净利(最差)) 最差 = h
  }
  const 打包 = (h) => h && ({
    周次: h.week,
    净利: 周经营净利(h),
    策略: 决策简述(h),
    依据: { 周次: h.week, netProfit: Number.isFinite(Number(h.netProfit)) ? Number(h.netProfit) : Number(h.profit) || 0, oneTimeFees: h.oneTimeFees || null },
  })
  return { 最好: 打包(最好), 最差: 打包(最差) }
}

/** 12 周净利曲线（逐周 周经营净利；缺周如实缺，不补 0） */
export function 净利曲线(history) {
  return 学期切片(history).map(h => ({ 周次: h.week, 净利: 周经营净利(h) }))
}

/** 回本进度（GOP 口径 · 续营参考）：首次"累计GOP ≥ 一次性投入"的周号；没到就 null */
export function 回本周(history) {
  const 投入 = 一次性投入(history)
  if (投入 == null || 投入 <= 0) return null
  let 累计 = 0
  for (const h of (Array.isArray(history) ? history : [])) {
    累计 += gopOf(h) || 0
    if (累计 >= 投入) return { 周次: h.week, 投入, 累计 }
  }
  return null
}

/** 学期成果总表（学生端 + 教师端共用同一套数） */
export function 学期成果(history, attrs = null) {
  const hs = 学期切片(history)
  const 营收 = totalRevenue(hs)
  const 净 = sumNet(hs).value
  const 经营净利 = hs.reduce((a, h) => a + 周经营净利(h), 0)
  const 净利率 = 营收 > 0 ? 经营净利 / 营收 : null
  const 期末 = hs[hs.length - 1] || null
  const { 最好, 最差 } = 最好最差周(hs)
  return {
    周数: hs.length,
    营收,
    经营净利,
    净利率,
    期末出租率: 期末 ? Math.round(Number(期末.occupancy) || 0) : null,
    好评率: 期末 ? Math.round(Number(期末.finalGoodRate) || 0) : null,
    GOP: sumGop(hs).value,
    最好周: 最好,
    最差周: 最差,
    曲线: 净利曲线(hs),
    点评: 点评生成(hs),
    回本: { 投入: 一次性投入(hs), GOP累计: 累计GOP(hs) },
  }
}

/** 一句话点评（只用已有数据；每条带依据 ⇒ 页面可点开看） */
export function 点评生成(history) {
  const hs = 学期切片(history)
  if (!hs.length) return []
  const claims = []
  // ① 利润主要来自哪几周：净利为正的周按贡献排序，取前三
  const 赚周 = hs.filter(h => 周经营净利(h) > 0).sort((a, b) => 周经营净利(b) - 周经营净利(a)).slice(0, 3)
  if (赚周.length) {
    claims.push({
      文本: `利润主要来自第 ${赚周.map(h => h.week).join('、')} 周（各贡献 ${赚周.map(h => 周经营净利(h)).join(' / ')} 元）`,
      依据: 赚周.map(h => ({ 周次: h.week, 经营净利: 周经营净利(h), 策略: 决策简述(h, 5) })),
    })
  }
  // ② 拖累最大的一周：净利最低的周 + 它当时在做的关键策略
  const 差周 = hs.reduce((a, h) => (周经营净利(h) < 周经营净利(a) ? h : a), hs[0])
  if (周经营净利(差周) < 0) {
    claims.push({
      文本: `第 ${差周.week} 周拖累最大（净利 ${周经营净利(差周)} 元），当时的关键策略：${决策简述(差周).join('、') || '（无决策记录）'}`,
      依据: { 周次: 差周.week, 经营净利: 周经营净利(差周), decisions: 差周.decisions || null, 事件: (差周.events || []).map(e => e.name) },
    })
  }
  // ③ 口碑线：好评率最高/最低差
  const 好评最高 = hs.reduce((a, h) => ((Number(h.finalGoodRate) || 0) > (Number(a.finalGoodRate) || 0) ? h : a), hs[0])
  const 好评最低 = hs.reduce((a, h) => ((Number(h.finalGoodRate) || 0) < (Number(a.finalGoodRate) || 0) ? h : a), hs[0])
  if (好评最高.week !== 好评最低.week) {
    claims.push({
      文本: `口碑从第 ${好评最低.week} 周的 ${Math.round(好评最低.finalGoodRate)}% 到第 ${好评最高.week} 周的 ${Math.round(好评最高.finalGoodRate)}%`,
      依据: [好评最低, 好评最高].map(h => ({ 周次: h.week, finalGoodRate: h.finalGoodRate, 差评数: h.negativeCount ?? null })),
    })
  }
  return claims
}

/** 班级并排（教师端）：纯重排。不排序、不排名、不打分 —— 输入什么顺序就什么顺序 */
export function 班级并排(rows) {
  const list = Array.isArray(rows) ? rows : []
  return list.map(g => {
    const hs = 学期切片(g.history || [])
    const 营收 = totalRevenue(hs)
    const 经营净利 = hs.reduce((a, h) => a + 周经营净利(h), 0)
    const 期末 = hs[hs.length - 1] || null
    return {
      组名: g.组名 || g.name || '',
      酒店名: g.酒店名 || g.hotel || '',
      周数: hs.length,
      营收,
      经营净利,
      净利率: 营收 > 0 ? 经营净利 / 营收 : null,
      出租率: 期末 ? Math.round(Number(期末.occupancy) || 0) : null,
      // 续营区分（卡 §2 判据③）：13+ 周的合计单列，不混进学期口径
      续营净利: (Array.isArray(g.history) ? g.history : []).filter(h => Number(h.week) > TOTAL_WEEKS).reduce((a, h) => a + 周经营净利(h), 0),
      续营周数: (Array.isArray(g.history) ? g.history : []).filter(h => Number(h.week) > TOTAL_WEEKS).length,
    }
  })
}
