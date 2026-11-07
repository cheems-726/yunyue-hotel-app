// ★ V189 · 每周 9 项重点（课堂模式）：主题 6 + 异常推荐 3
//   · 主题 6：按周轮换（12 周覆盖全部 18 项，每项各出现 4 次）
//   · 异常 3：按上周结果推荐（出租率 / 差评 / 资金 / 会员），与主题去重后补足 3
//   · 纯函数：不读 DOM、不改状态；引擎仍收 18 项（没做的按"维持现状"结算）
export const 分组 = {
  价格收益: ['pricing', 'revenue-mgmt', 'overbook'],
  渠道营销: ['ota', 'campaign', 'corporate'],
  服务口碑: ['quality-check', 'hygiene', 'reputation'],
  成本人力: ['shifts', 'hr-optimize', 'energy'],
  会员复购: ['member-convert', 'member-threshold', 'linen'],
  资产风险: ['renovation', 'emergency', 'report-diagnosis'],
}

// 12 周主题（每周 2 组 × 3 项 = 6 项）
const 周主题 = [
  ['价格收益', '渠道营销'],
  ['服务口碑', '成本人力'],
  ['会员复购', '资产风险'],
  ['价格收益', '服务口碑'],
  ['渠道营销', '成本人力'],
  ['会员复购', '价格收益'],
  ['资产风险', '渠道营销'],
  ['服务口碑', '会员复购'],
  ['成本人力', '资产风险'],
  ['价格收益', '成本人力'],
  ['渠道营销', '会员复购'],
  ['服务口碑', '资产风险'],
]

export function 主题六项(week) {
  const w = ((Number(week) || 1) - 1) % 12
  const [a, b] = 周主题[w]
  return [...分组[a], ...分组[b]]
}

/**
 * 异常推荐 3 项（按上周报告；无报告 ⇒ 默认三件）
 * @param {{report?:object, capital?:number, pendingReviewCount?:number, 资金警戒线?:number}} ctx
 */
export function 异常三项({ report, capital, pendingReviewCount = 0, 资金警戒线 = 300000 } = {}) {
  const 负评 = Number(report && (report.差评数 ?? report.negCount)) || 0
  const occ = Number(report && (report.平均出租率 ?? report.occ))
  const 好评率 = Number(report && (report.平均好评率 ?? report.goodRate))

  if (!report) return ['report-diagnosis', 'overbook', 'emergency']          // 第 1 周：先把"看数/超订/应急"立起来
  if (Number.isFinite(occ) && occ < 0.55) return ['ota', 'campaign', 'pricing']       // 没人来 ⇒ 渠道与价格
  if (负评 >= 2 || (Number.isFinite(好评率) && 好评率 < 88)) return ['quality-check', 'hygiene', 'reputation'] // 口碑塌 ⇒ 服务
  if (Number.isFinite(capital) && capital < 资金警戒线) return ['energy', 'hr-optimize', 'linen']              // 钱紧 ⇒ 抠成本
  if (pendingReviewCount > 0) return ['reputation', 'member-convert', 'campaign']      // 差评没处理/复购弱
  return ['report-diagnosis', 'member-threshold', 'renovation']                        // 平稳周：看数 + 会员 + 改造
}

/** 本周 9 项：主题 6 + 异常 3（去重、补足 9、保持稳定顺序） */
export function 本周重点({ week = 1, report = null, capital = null, pendingReviewCount = 0 } = {}) {
  const six = 主题六项(week)
  const 候选 = 异常三项({ report, capital, pendingReviewCount })
  const out = [...six]
  for (const id of [...候选, 'report-diagnosis', 'overbook', 'emergency', 'pricing', 'reputation', 'shifts']) {
    if (out.length >= 9) break
    if (!out.includes(id)) out.push(id)
  }
  return out.slice(0, 9)
}
