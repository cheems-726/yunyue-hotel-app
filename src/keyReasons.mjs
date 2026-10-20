// V131 §1-B · 本周"代价最大"的关键决策（每周 3 项 · 必须写一句理由）
//
// 卡内原话："按决策表里'代价'字段自动挑" —— 实测 decisions.js **没有数值型代价字段**（只有影响/误区文本）。
// ⇒ 本模块用一张**显式代价级表**作代理（可审计、可断言），并只选 3 项。将来决策表补了代价字段，
//   只需替换这张表，不动调用方。
// 红线：理由只落库/进台账，不并入四维评分、不改引擎。
export const 代价级表 = [
  { id: 'renovation', 级: 5, 说明: '一次性大额改造（百万级投入）' },
  { id: 'hr-optimize', 级: 4, 说明: '裁员/培训（人力结构与口碑）' },
  { id: 'pricing', 级: 3, 说明: '价格杠杆（直接改营收）' },
  { id: 'overbook', 级: 2, 说明: '超售（赔偿与口碑风险）' },
  { id: 'ota', 级: 2, 说明: 'OTA 预算（佣金与流量）' },
  { id: 'energy', 级: 1, 说明: '能耗（成本与体验）' },
]

/** 本周关键决策（按代价级降序，取前 3；只保留真实存在的决策 id） */
export function 本周关键决策(决策列表 = []) {
  const ids = new Set((Array.isArray(决策列表) ? 决策列表 : []).map(d => d && d.id).filter(Boolean))
  return 代价级表
    .filter(x => ids.size === 0 || ids.has(x.id))
    .slice()
    .sort((a, b) => b.级 - a.级)
    .slice(0, 3)
    .map(x => x.id)
}

/** 本周 3 项里写了几条（0–3；空文本不算） */
export function 关键理由条数(决策理由, week, 关键ids = []) {
  const map = 决策理由 && typeof 决策理由 === 'object' ? 决策理由 : {}
  return (Array.isArray(关键ids) ? 关键ids : []).filter(id => {
    const r = map[id]
    return r && Number(r.week) === Number(week) && String(r.文本 || '').trim().length > 0
  }).length
}

/** 某条理由是否合格（≤30 字 · 非空） */
export function 理由合格(text) {
  const t = String(text == null ? '' : text).trim()
  return t.length > 0 && t.length <= 30
}
