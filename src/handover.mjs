// §33-V2 · R7 强制移交 —— 移交/代提交【纯核心】（唯一数据形状与规则单源）
//
// ── 口径（卡 §2④ · 推荐口径已采纳 · 必须与报告一致）────────────────
//   ★ **加成只认「谁的职务」，不认「谁点的键」**：R4 职务加成（roleBonus）按该决策项的
//     【责任职务 owner】（decisions.js 词表）计 ×1.3 —— 移交/代提交【不改数值】⇒ 零重基线。
//   ★ 本模块的产出【只进留痕与界面】，绝不进 settle 入参 —— 守门 tests/handover.test.mjs
//     以「带/不带移交信息两次 settle 逐字节相同」钉死这一条（移交不改数值的机器证明）。
//
// ── 形状（路线图原形 + 代提交扩展）────────────────────────────────
//   handover: { decisionId, from_uid, to_uid, at }              ← 移交（路线图原形，一字段不多）
//   proxy:    { decisionId, by_uid, owner_uid, at }             ← 代提交（代提交人 by / 责任人 owner 两个独立字段，不许混写）
//   ★ 条件挂载：无移交/代提交 ⇒ 不添键（旧档零变化 · 水位线纪律）
//
// ── 代提交阈值（卡 §2③：阈值写死并在注释里说明）────────────────────
//   「责任人当周未登录」：组档快照按周推进，无法可靠感知"当周是否登录过"（无登录流水表），
//   故教学版阈值定为【当周未操作该项】—— 即本周 doneDecisions 里该项仍未定且距周首 ≥3 天时，
//   界面把「代提交」从灰色提示升为可用按钮。是否到期【不阻断】任何操作（R7 的意义就是给出路）。
export const 代提交阈值说明 = '责任人当周未操作该项（距周首 ≥3 天仍未定）⇒「代提交」高亮可用；任何时点都不阻断组员操作'

// 决策项责任职务（复用 decisions.js 的 owner 词表 —— 不另立第五套命名，BL-7 家族）
import { decisions as DECISIONS } from './decisions.js'

export function decisionOwnerOf(decisionId) {
  const d = DECISIONS.find(x => x.id === decisionId)
  return d ? (d.owner || null) : null
}

// 挂载一条移交记录（条件挂载：entries 无该键才建；重复移交 = 覆盖并保留 at 更新）
export function mountHandover(entries, { decisionId, from_uid, to_uid, at }) {
  if (!entries || typeof entries !== 'object') return entries
  const prev = entries[decisionId]
  if (prev && prev.from_uid === from_uid && prev.to_uid === to_uid) return entries   // 幂等：同甲乙不重写
  return { ...entries, [decisionId]: { decisionId, from_uid, to_uid, at } }
}

// 挂载一条代提交记录（★ by_uid=代提交人 / owner_uid=责任人 —— 两个字段各自独立，不许混写）
export function mountProxy(entries, { decisionId, by_uid, owner_uid, at }) {
  if (!entries || typeof entries !== 'object') return entries
  return { ...entries, [decisionId]: { decisionId, by_uid, owner_uid, at } }
}

export function handoverOf(entries, decisionId) {
  return (entries && entries[decisionId]) || null
}

// 界面横幅文案（非负责人视图 · 不阻断 —— 卡 §3：不许做成硬阻断）
export function handoverBanner(decisionId, myRole) {
  const owner = decisionOwnerOf(decisionId)
  if (!owner || owner === myRole) return null          // 责任人本人（或未选职务/null）⇒ 无横幅
  return { owner }
}
