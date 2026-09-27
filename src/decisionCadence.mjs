// A5 · 决策节奏（粒度丙）与归属日规则 —— 口径单源（二期 §5-E3 的前置定义）
//
// 依据（照抄，不改口径）：
//   · 三档粒度：归档包《任务包-实时经营改造-含前置修复.md》E3 段（实时项/周期项/一次性）
//   · 归属日规则：T11 —— 决策归属日 = 服务端 classDay + 1；**客户端不判定归属**；当日已发生不可回溯
//   · 时间锚：T9/T10 —— 班级共享 classDay；本地时钟只用于显示
//
// ★ 本模块只放【规则与数据】（纯数据 + 纯函数），不含 UI、不含结算逻辑 ⇒ 不改结算（守门会断言）
// ★ 覆盖纪律：18 项决策里，凡归档规格【没有明说】档位的一律进 待定档 并显式列出 ——
//   不许"猜一个"塞进已定档（那等于替老师定教学口径）。待定项已进待决策队列。
import { decisions } from './decisions.js'

export const 档 = { 实时: 'realtime', 周期: 'periodic', 一次性: 'onetime', 待定: 'pending' }

// ── 已定（来源：归档 E3 规格原文，逐项对齐 id）──────────────────────
//   规格原文：实时项=房价/超售数/排班/能耗温度/布草 · 周期项=会员策略/营销活动/OTA合作/收益管理
//             一次性=投资改造/裁员招聘/品牌加盟
// 🔴 2026-09-28（N-3 · D47-d 已拍）：原"待定档"的 7 项已由决策端代拍落定，全 18 项【无待定】
export const 已定档 = {
  // 实时项（随时可改 · 次日生效）：规格 5 项 + 代拍 4 项
  [档.实时]: ['pricing', 'overbook', 'shifts', 'energy', 'linen', 'quality-check', 'hygiene', 'reputation', 'emergency'],
  // 周期项（每 7 天一次）：规格 4 项 + 代拍 3 项
  [档.周期]: ['member-convert', 'campaign', 'ota', 'revenue-mgmt', 'report-diagnosis', 'corporate', 'member-threshold'],
  // 一次性（全程 1–2 次）：规格 2 项（"品牌加盟"属认领流程，非决策项）
  [档.一次性]: ['renovation', 'hr-optimize'],
}
// 规格里的"品牌加盟"不是决策项（属认领流程），单独记录，避免下一个人再去找它的 id
export const 非决策项 = [{ 规格名: '品牌加盟', 说明: '属认领流程（Claim），不是 18 项决策之一' }]

// ── 待定（规格未明说 ⇒ 不许猜）────────────────────────────────────
//   ★ 2026-09-28（N-3）：D47-d 代拍后【清空】—— 保留该空数组是为了：
//     ① 断言"无待定"仍可被机器检查（一旦有人往里塞东西 = 出现未拍板项，门禁会看见）
//     ② 与 档语[档.待定] 的界面文案保持同一条链（没有待定项 ⇒ 界面不显示该组）
export const 待定档 = []

// ── 归属日规则（T11）──────────────────────────────────────────────
//   决策归属日 = 服务端 classDay + 1（今天改，明天生效）；客户端只提交意图，不判定归属
export const 归属日 = (classDay) => {
  const cd = Math.max(0, Math.round(Number(classDay) || 0))
  return cd + 1
}
//   可回溯性：目标归属日必须【严格晚于】当前 classDay ⇒ 提交"昨天/今天"一律拒绝
export const 可提交 = (classDay, 目标日) => {
  const cd = Math.max(0, Math.round(Number(classDay) || 0))
  const t = Math.round(Number(目标日))
  return Number.isFinite(t) && t > cd
}

// ── 覆盖度自检（供断言引用，避免两处各数一遍）──────────────────────
export function 覆盖度() {
  const all = decisions.map(d => d.id)
  const 已定 = Object.values(已定档).flat()
  const 未覆盖 = all.filter(id => !已定.includes(id) && !待定档.includes(id))
  const 多余 = [...已定, ...待定档].filter(id => !all.includes(id))
  // ★ 重复项也要能被看见（同一个 id 被塞进两档 ⇒ 界面会出现两个组标签）
  const 重复 = 已定.filter((id, i) => 已定.indexOf(id) !== i)
  return { 全部: all, 已定, 待定: 待定档, 未覆盖, 多余, 重复 }
}

// 某决策项属于哪一档（界面分组/断言共用；未知 id ⇒ null，不猜）
export function 档位(id) {
  for (const k of [档.实时, 档.周期, 档.一次性]) if (已定档[k].includes(id)) return k
  return 待定档.includes(id) ? 档.待定 : null
}

// 按档分组（保持 decisions.js 的原顺序；界面直接用）
export function 按档分组(items) {
  const arr = Array.isArray(items) ? items : decisions
  const out = { [档.实时]: [], [档.周期]: [], [档.一次性]: [], [档.待定]: [] }
  for (const d of arr) { const k = 档位(d.id); if (k) out[k].push(d) }
  return out
}

// ── 界面用文案（三档节奏在界面上要"可辨" —— 二期 §5-E3 验收）────────
export const 档语 = {
  [档.实时]: { 名: '实时项', 说明: '随时可改 · 次日生效（改完影响明天起）' },
  [档.周期]: { 名: '周期项', 说明: '每 7 天一次（本周内不改）' },
  [档.一次性]: { 名: '一次性', 说明: '全程 1–2 次（改了就很难回头）' },
  [档.待定]: { 名: '待定档', 说明: '档位待拍板（归档规格未明说，已进队列）' },
}
