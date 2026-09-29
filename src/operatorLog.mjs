// §22.3-C3 · 每人操作被系统记录（操作者 + 职位归属 · 纯数据 + 纯函数）
//
// ── 需求原话（缺口表 C3/C2）─────────────────────────────────────
//   "每人操作都会被系统记录" · "职位分工体系：店长/大堂经理/财务/运营/人事 五种职位"
//
// ── 设计（依赖顺序：C3 在 C2 之前，但共用本模块的职位定义）────────────
//   · 职位单源 = decisions.OWNER_LABELS（五职位：manager/lobby/finance/ops/hr —— **已存在**，
//     18 项决策每项都带 owner ⇒ C2 侦察结论：**能直接映射，无需另立映射表**）
//   · C3 = 操作记录：谁（operatorId）在何时（classDay/week）提交了什么（决策 id + 答案）
//     ⇒ 生成一条条「操作记录」，供 C2（按职位看）/ C4（老师按人查）消费
//   · 纯函数：不碰 localStorage / 不碰结算（守门会断言"不进结算路径"）
//   · 旧档兼容：无操作者 ⇒ operatorId = '未记录'（不崩、如实标）
import { OWNER_LABELS, decisions } from './decisions.js'

// 职位单源（re-export：C2/C4 从这里取，不许再从 decisions.js 直接散引）
export const 职位 = OWNER_LABELS
export const 职位键 = Object.keys(OWNER_LABELS)              // ['manager','lobby','finance','ops','hr']
export const 职位名 = (k) => OWNER_LABELS[k]?.label ?? k
// 决策 id → 负责职位（单源映射：直接读 decisions 的 owner —— 已核=能直接映射）
export const 决策职位 = Object.fromEntries(decisions.map(d => [d.id, d.owner]))

// 未记录的占位（旧档兼容：如实标"未记录"，不编人名）
export const 未记录 = '未记录'

/**
 * 生成一条操作记录（纯函数）
 * @param {{decisionId:string, answer:any, operatorId?:string|null, operatorName?:string|null,
 *          week:number, classDay?:number|null, profitImpact?:number|null}} p
 */
export function 记录一条({ decisionId, answer, operatorId = null, operatorName = null, week, classDay = null, profitImpact = null } = {}) {
  const d = decisions.find(x => x.id === decisionId)
  if (!d) return null                                     // 未知决策 id ⇒ 不记录（调用方自行处理）
  return {
    decisionId,
    决策名: d.name,
    职位: d.owner,                                        // C2：决策按职位归属（单源 decisions.owner）
    职位名: 职位名(d.owner),
    operatorId: operatorId || 未记录,
    operatorName: operatorName || null,
    answer: (answer && typeof answer === 'object') ? JSON.parse(JSON.stringify(answer)) : answer,
    week: Number(week) || 0,
    classDay: Number.isFinite(Number(classDay)) ? Number(classDay) : null,
    profitImpact: Number.isFinite(Number(profitImpact)) ? Number(profitImpact) : null,   // C4：营收影响（可空）
  }
}

/** 批量：把"本次提交的决策集"变成操作记录列表 */
export function 记录一批({ answers, prevAnswers = {}, operatorId = null, operatorName = null, week, classDay = null, profitByDecision = null } = {}) {
  const out = []
  for (const [id, ans] of Object.entries(answers || {})) {
    const rec = 记录一条({ decisionId: id, answer: ans, operatorId, operatorName, week, classDay, profitImpact: profitByDecision?.[id] ?? null })
    // 首次填写（prev 里没有）也算操作记录 —— "每人操作"含首次分工执行
    if (rec) out.push(rec)
  }
  return out
}

/** 按人聚合（C4 的数据面）：同一 operatorId 的记录分组 + 汇总 */
export function 按人聚合(记录) {
  const arr = Array.isArray(记录) ? 记录 : []
  const map = new Map()
  for (const r of arr) {
    const key = r.operatorId || 未记录
    if (!map.has(key)) map.set(key, { operatorId: key, operatorName: r.operatorName || null, 条数: 0, 职位: {}, 周: new Set(), 净利影响: 0 })
    const g = map.get(key)
    g.条数++
    g.职位[r.职位名] = (g.职位[r.职位名] || 0) + 1
    g.周.add(r.week)
    if (Number.isFinite(r.profitImpact)) g.净利影响 += r.profitImpact
  }
  return [...map.values()].map(g => ({ ...g, 周: [...g.周].sort((a, b) => a - b) }))
}

/** 按职位聚合（C2 的数据面）：同职位的决策记录分组 */
export function 按职位聚合(记录) {
  const arr = Array.isArray(记录) ? 记录 : []
  const map = new Map()
  for (const r of arr) {
    if (!map.has(r.职位)) map.set(r.职位, { 职位: r.职位, 职位名: r.职位名, 条数: 0, 决策: new Set(), 操作者: new Set() })
    const g = map.get(r.职位)
    g.条数++
    g.决策.add(r.decisionId)
    g.操作者.add(r.operatorId || 未记录)
  }
  return [...map.values()].map(g => ({ ...g, 决策: [...g.决策], 操作者: [...g.操作者] }))
}
