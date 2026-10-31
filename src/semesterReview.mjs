// V164 · 学期教学复盘报告纯层 —— 只读分析 · 零网络 · 零引擎改动
// 数据纪律：指标一律取自【成绩单行】（reportCard.成绩单行 = scoreOf 单源 ⇒ 与成绩单逐项一致由构造保证）；
//           归因/未决策/画像从 history 明细字段算，每条给出来源字段名（判据③ 可溯源）。
// 红线：本文件不许出现任何网络调用或外部依赖（tests 有静态扫描的 token 白名单）；不许出现"学生不努力"类归因。

export const 未决策阈值 = 6   // 卡 §1④：决策不足 6 项的周数（history.决策数 < 阈值）

const 百分比 = (x) => (x == null ? '—' : (x * 100).toFixed(1) + '%')            // 真 0-1 率（净利率）
const 百分数 = (x) => (x == null ? '—' : Number(x).toFixed(1) + '%')            // 库内百分数数值（出租率/好评率 · 81 = 81%）
const 率pp = (x) => (x == null ? null : Number(x))                               // 库内已是百分点数值，直用

/** 未决策统计：逐组 未决策周数 + 最长连续未决策周数（来源 = history[].决策数） */
export function 未决策统计(history = []) {
  let 周数 = 0, 连续 = 0, 最长 = 0
  for (const h of history || []) {
    const 决策数 = Number(h && (h['决策数'] ?? h.doneCount)) || 0
    if (决策数 < 未决策阈值) { 周数++; 连续++; 最长 = Math.max(最长, 连续) } else 连续 = 0
  }
  return { 周数, 最长连续: 最长, 来源: 'history[].决策数 < ' + 未决策阈值 }
}

/**
 * 复盘报告主入口（只读）
 * @param {object} p
 *   rows    成绩单行[]（reportCard.成绩单行 输出 · 指标单源）
 *   组数据   { [组号]: { capital, history, decisionChanges } }（期末资金与明细字段）
 * @returns {{指标并排, 极值, 归因, 未决策, 画像}}
 */
export function 复盘报告({ rows = [], 组数据 = {} }) {
  const 指标并排 = rows.map(r => {
    const g = 组数据[r.组号] || {}
    return {
      组号: r.组号, 累计营收: r.累计营收, 经营净利: r.经营净利, 净利率: r.净利率,
      平均出租率: r.平均出租率, 平均好评率: r.平均好评率, 差评处理率: r.差评处理率,
      期末资金: Number(g.capital) || null, 来源: '成绩单行（scoreOf 单源）+ game_states.state.capital',
    }
  })
  const 极值 = 指标极值(指标并排)
  const 未决策 = rows.map(r => ({ 组号: r.组号, ...(未决策统计((组数据[r.组号] || {}).history)) }))
  const 归因 = 差异归因(指标并排, 未决策)
  const 画像 = rows.map(r => 决策画像卡({ 组号: r.组号, row: r, 组数据 }))
  return { 指标并排, 极值, 归因, 未决策, 画像 }
}

/** 极值与差距：每个指标各列 最好组/最差组/差距值（差评处理率 null=无差评待办周，不补 0） */
export function 指标极值(指标并排 = []) {
  const 定义 = [
    { 名: '累计营收', 取: r => r.累计营收, 好: 'max', 格式: v => Math.round(v).toLocaleString() + ' 元' },
    { 名: '经营净利', 取: r => r.经营净利, 好: 'max', 格式: v => Math.round(v).toLocaleString() + ' 元' },
    { 名: '净利率', 取: r => r.净利率, 好: 'max', 格式: 百分比 },
    { 名: '平均出租率', 取: r => r.平均出租率, 好: 'max', 格式: 百分数 },
    { 名: '平均好评率', 取: r => r.平均好评率, 好: 'max', 格式: 百分数 },
    { 名: '差评处理率', 取: r => r.差评处理率, 好: 'max', 格式: 百分数 },
    { 名: '期末资金', 取: r => r.期末资金, 好: 'max', 格式: v => v == null ? '—' : Math.round(v).toLocaleString() + ' 元' },
  ]
  return 定义.map(d => {
    const 有数 = 指标并排.filter(r => d.取(r) != null)
    if (有数.length < 2) return { 指标: d.名, 最好组: '—', 最差组: '—', 差距: '—', 来源: d.名 }
    const 排序 = [...有数].sort((a, b) => d.好 === 'max' ? d.取(b) - d.取(a) : d.取(a) - d.取(b))
    const 最好 = 排序[0], 最差 = 排序[排序.length - 1]
    return { 指标: d.名, 最好组: `${最好.组号}（${d.格式(d.取(最好))}）`, 最差组: `${最差.组号}（${d.格式(d.取(最差))}）`, 差距: d.格式(d.取(最好) - d.取(最差)), 来源: d.名 }
  })
}

/**
 * 组间差异前 3 条（自动归因 · 每条给来源字段）
 * 基准 = 经营净利最高组 vs 最低组；候选差异 = 出租率 / 好评率 / 差评数 / 未决策周数，按解释力度取前 3。
 */
export function 差异归因(指标并排 = [], 未决策 = []) {
  if (指标并排.length < 2) return []
  const 按 = [...指标并排].sort((a, b) => b.经营净利 - a.经营净利)
  const 甲 = 按[0], 乙 = 按[按.length - 1]
  const 未决策map = Object.fromEntries((未决策 || []).map(u => [u.组号, u.周数]))
  const 候选 = [
    { 名: '平均出租率', 甲值: 率pp(甲.平均出租率), 乙值: 率pp(乙.平均出租率), 单位: '个百分点', 来源: '成绩单行.平均出租率（history.occupancy 学期均值 · scoreOf 单源）' },
    { 名: '平均好评率', 甲值: 率pp(甲.平均好评率), 乙值: 率pp(乙.平均好评率), 单位: '个百分点', 来源: '成绩单行.平均好评率（history.goodRate 学期均值 · scoreOf 单源）' },
    { 名: '差评数', 甲值: 甲.差评数, 乙值: 乙.差评数, 单位: '条', 来源: '成绩单行.差评数（history.negativeCount 学期合计 · scoreOf 单源）', 反向: true },
    { 名: '未决策周数', 甲值: 未决策map[甲.组号] ?? 0, 乙值: 未决策map[乙.组号] ?? 0, 单位: '周', 来源: 'history[].决策数 < ' + 未决策阈值 },
  ]
  const 差 = 候选.map(c => ({ ...c, 差: Math.abs(c.甲值 - c.乙值) })).sort((a, b) => b.差 - a.差).slice(0, 3)
  const 净利差 = 甲.经营净利 - 乙.经营净利
  return 差.filter(c => c.差 > 0).map(c => {
    const 甲低 = c.甲值 < c.乙值
    const 差值 = Math.abs(Math.round((c.甲值 - c.乙值) * 10) / 10)
    const 方向 = c.反向 ? (甲低 ? '多' : '少') : (甲低 ? '低' : '高')
    return {
      文案: `${甲.组号}比${乙.组号}经营净利高 ${Math.round(净利差).toLocaleString()} 元，其中 ${c.名}${方向} ${差值} ${c.单位}（${甲.组号} ${c.甲值} vs ${乙.组号} ${c.乙值}）`,
      来源: c.来源,
    }
  })
}

/** 决策画像卡（§2 · 陈述事实 · 不给"应该/建议改为"类表述）
 *  数据边界：decisionChanges 只留【当周】流水（history 不含历史改动）——画像如实标注"当周流水"。 */
export function 决策画像卡({ 组号, row, 组数据 = {}, 决策名 = {} }) {
  const g = 组数据[组号] || {}
  const changes = Array.isArray(g.decisionChanges) ? g.decisionChanges : []
  const 计数 = {}
  for (const c of changes) if (c && c.key) 计数[c.key] = (计数[c.key] || 0) + 1
  const 最常改 = Object.entries(计数).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([k, n]) => `${决策名[k] || k}×${n}`)
  const 未 = 未决策统计(g.history)
  return {
    组号,
    改动次数: changes.length,
    改动口径: 'game_states.state.decisionChanges（当周流水 · history 不含历史改动）',
    最常改: 最常改.length ? 最常改.join('、') : '无改动记录',
    未决策周数: 未.周数,
    最长连续未决策: 未.最长连续,
    结果: { 经营净利: row.经营净利, 平均出租率: row.平均出租率, 平均好评率: row.平均好评率 },
    文案: `${组号}：本学期未决策周 ${未.周数} 周（最长连续 ${未.最长连续} 周）；当周改动流水 ${changes.length} 处${最常改.length ? '（' + 最常改.join('、') + '）' : ''}；经营净利 ${Math.round(row.经营净利).toLocaleString()} 元 · 出租率 ${百分数(row.平均出租率)} · 好评率 ${百分数(row.平均好评率)}。`,
  }
}

/** §3 教学建议：规则表驱动（条件 → 一句话 · 零网络 · 每条带规则编号与命中数字）
 *  RV：传入空规则表 ⇒ 返回 ['数据暂不支撑结论']，不许编。 */
export const 默认教学规则 = [
  { id: 'T1', text: '本学期六组整体亏损，建议下轮先讲成本结构（租金/人力占营收比）', 命中: m => `全班平均经营净利 = ${Math.round(m.平均净利).toLocaleString()} 元 < 0`, when: m => m.平均净利 < 0 },
  { id: 'T2', text: '超过三分之一的组存在多周未做满决策，建议把决策时限写进课堂流程', 命中: m => `未决策周数 ≥ 3 的组 = ${m.多未决策组数}/${m.组数} 组`, when: m => m.组数 > 0 && m.多未决策组数 * 3 > m.组数 },
  { id: 'T3', text: '口碑是短板，建议下一轮单列一节讲差评处理与卫生检查', 命中: m => `全班平均好评率 = ${百分数(m.平均好评率)} < 70%`, when: m => m.平均好评率 != null && m.平均好评率 < 70 },
  { id: 'T4', text: '出租率不低但利润薄，建议讲定价与成本控制', 命中: m => `平均出租率 = ${百分数(m.平均出租率)} ≥ 80% 且平均净利率 = ${百分比(m.平均净利率)} < 5%`, when: m => m.平均出租率 != null && m.平均出租率 >= 80 && m.平均净利率 != null && m.平均净利率 < 0.05 },
]

export function 教学建议({ rows = [], 未决策 = [], 规则表 = 默认教学规则 }) {
  if (!rows.length) return { 建议: ['数据暂不支撑结论'], 规则数: (规则表 || []).length }
  const n = rows.length
  const 有率 = rows.filter(r => r.平均好评率 != null)
  const m = {
    组数: n,
    平均净利: rows.reduce((a, r) => a + r.经营净利, 0) / n,
    平均净利率: (() => { const 有 = rows.filter(r => r.净利率 != null); return 有.length ? 有.reduce((a, r) => a + r.净利率, 0) / 有.length : null })(),
    平均好评率: 有率.length ? 有率.reduce((a, r) => a + r.平均好评率, 0) / 有率.length : null,
    平均出租率: (() => { const 有 = rows.filter(r => r.平均出租率 != null); return 有.length ? 有.reduce((a, r) => a + r.平均出租率, 0) / 有.length : null })(),
    多未决策组数: (未决策 || []).filter(u => u.周数 >= 3).length,
  }
  if (!(规则表 || []).length) return { 建议: ['数据暂不支撑结论'], 规则数: 0, 汇总: m }
  const 建议 = 规则表.filter(r => { try { return r.when(m) } catch (e) { return false } })
    .map(r => ({ 规则: r.id, 文本: r.text, 命中: r.命中 ? r.命中(m) : '' }))
  return { 建议: 建议.length ? 建议 : ['数据暂不支撑结论'], 规则数: 规则表.length, 汇总: m }
}
