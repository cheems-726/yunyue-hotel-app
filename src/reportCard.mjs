// V153 · 学期末成绩单 + 归档快照（纯函数层）
//
// 口径（卡 §1 / D342 口径 A）：
//   · 四维 40/25/20/15 —— 分数【整套】来自 metricDefs.scoreOf（唯一计算点，本模块不自算一分）
//   · 过程分/委托【不进】成绩单（红线）
//   · 经营净利 = V145 口径（周经营净利之和 · 前 12 周切片，与 V152 成果页同一切片）
//   · 归档 = 快照（把数值复制成一份独立 JSON/CSV），不实时读库；不参与任何计算
import { scoreOf, totalRevenue, SCORE_WEIGHTS, wan2 } from './metricDefs.mjs'
import { 周经营净利 } from './weeklyProfit.mjs'
import { 学期切片 } from './semesterResult.mjs'
import { TOTAL_WEEKS } from './semester.mjs'

/** 一组的成绩单行（数字全部来自 scoreOf / history 既有字段；误差 0） */
export function 成绩单行({ 组号, 班级 = '', 酒店名 = '', history = [] }) {
  const hs = 学期切片(history)   // 学期口径 = 前 12 周（与 V152 成果页同一刀）
  const S = scoreOf(hs)
  const 营收 = totalRevenue(hs)
  const 经营净利 = hs.reduce((a, h) => a + 周经营净利(h), 0)
  const 处理率 = S.avgHandleRate
  return {
    组号: String(组号 ?? ''),
    班级,
    酒店名,
    周数: hs.length,
    累计营收: 营收,
    经营净利,
    净利率: 营收 > 0 ? 经营净利 / 营收 : null,
    平均出租率: S.avgOccupancy,
    平均好评率: S.avgGoodRate,
    差评处理率: 处理率,   // null = 学期无差评待办周（如实空，不补 0）
    差评数: S.totalNegative,
    利润分: S.profitScore,
    口碑分: S.reputationScore,
    出租率分: S.occupancyScore,
    差评分: S.negativeScore,
    总分: S.finalScore,
    等级: S.grade,
    _scoreSource: { finalScore: S.finalScore, weights: { ...SCORE_WEIGHTS }, weeks: hs.length },   // 供"与 scoreOf 零差"断言用
  }
}

/** 一次算一组成绩单 + 该组的 history 索引（供"与 scoreOf 零差"自检用同一份输入，避免两处各查一遍） */
export function 成绩单(inputs) {
  const rows = [], histBy组号 = {}
  for (const it of (inputs || [])) {
    rows.push(成绩单行(it))
    histBy组号[String(it.组号)] = it.history || []
  }
  return { rows, histBy组号 }
}

const PCT = (v) => (v == null || v === '' ? '' : Math.round(v * 100) + '%')

const CSV头 = '组号,班级,酒店,周数,累计营收(元),经营净利(元),净利率,平均出租率(%),平均好评率(%),差评处理率,差评数,利润分,口碑分,出租率分,差评分,总分,等级'

/** 成绩单 CSV 文本（BOM 在下载时加，保持本函数纯文本可测） */
export function 成绩单CSV(rows) {
  const esc = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [`# 云悦酒店 · 学期末成绩单（口径 A：利润 ${SCORE_WEIGHTS.profit * 100}/口碑 ${SCORE_WEIGHTS.reputation * 100}/出租率 ${SCORE_WEIGHTS.occupancy * 100}/差评处理率 ${SCORE_WEIGHTS.negative * 100} · 过程分不进总表 · 学期口径 = 前 ${TOTAL_WEEKS} 周）`, CSV头]
  for (const r of (rows || [])) {
    lines.push([
      r.组号, esc(r.班级), esc(r.酒店名), r.周数, r.累计营收, r.经营净利,
      r.净利率 == null ? '' : (r.净利率 * 100).toFixed(1) + '%',
      r.平均出租率, r.平均好评率,
      r.差评处理率 == null ? '无差评待办周' : PCT(r.差评处理率),
      r.差评数, r.利润分, r.口碑分, r.出租率分, r.差评分, r.总分, esc(r.等级),
    ].join(','))
  }
  return lines.join('\r\n')
}

/**
 * 归档快照（§2）：把成绩单与六组摘要【复制】成独立对象 —— 生成后与库无关。
 * 性质：只读留档、不参与任何计算；快照里不放 history 原始引用（只放摘要数字），天然冻结。
 */
export function 归档快照({ 班级 = '', 生成人 = '', rows = [], 摘要 = [] }) {
  const 冻结行 = (rows || []).map(r => ({ ...r, _scoreSource: undefined }))
  return {
    版本: 'semester-archive-v1',
    口径: 'D342-A（四维 40/25/20/15 · 过程分不进总表 · 学期口径前 12 周）',
    生成时间: null,          // 由调用方填（纯函数层不读时钟 —— 与公平性纪律同族）
    生成人: String(生成人 || ''),
    班级: String(班级 || ''),
    条数: 冻结行.length,
    成绩单: 冻结行,
    摘要: (摘要 || []).map(g => ({ ...g })),   // 六组 history 摘要（每组：组号/周数/资金/经营净利 —— 调用方给形状）
  }
}

/** 从快照出 CSV（只读快照字段 ⇒ 改学生数据不影响已生成文件） */
export function 归档CSV(快照) {
  if (!快照 || !Array.isArray(快照.成绩单)) return ''
  const lines = [`# 云悦酒店 · 学期归档（${快照.生成时间 || '时间待填'} · 生成人 ${快照.生成人 || '—'} · ${快照.口径}）`, CSV头]
  for (const r of 快照.成绩单) {
    lines.push([
      r.组号, r.班级, r.酒店名, r.周数, r.累计营收, r.经营净利,
      r.净利率 == null ? '' : (r.净利率 * 100).toFixed(1) + '%',
      r.平均出租率, r.平均好评率,
      r.差评处理率 == null ? '无差评待办周' : PCT(r.差评处理率),
      r.差评数, r.利润分, r.口碑分, r.出租率分, r.差评分, r.总分, r.等级,
    ].join(','))
  }
  return lines.join('\r\n')
}

/** 自检：成绩单行与 scoreOf 逐项零差（判据①；tamper 一格 ⇒ 立刻暴露） */
export function 与scoreOf零差(rows, 按组history) {
  const bad = []
  for (const r of (rows || [])) {
    const S = scoreOf(学期切片((按组history && 按组history[r.组号]) || []))
    for (const k of ['利润分', '口碑分', '出租率分', '差评分', '总分']) {
      if (r[k] !== S[{ 利润分: 'profitScore', 口碑分: 'reputationScore', 出租率分: 'occupancyScore', 差评分: 'negativeScore', 总分: 'finalScore' }[k]]) {
        bad.push(`${r.组号}.${k} 行=${r[k]} scoreOf=${S[{ 利润分: 'profitScore', 口碑分: 'reputationScore', 出租率分: 'occupancyScore', 差评分: 'negativeScore', 总分: 'finalScore' }[k]]}`)
      }
    }
  }
  return bad
}
