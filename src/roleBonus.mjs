// §32-U4-R4 · 职务加成（软约束 ×1.3）—— 「谁处理不一样」的唯一判定点
//
// ── 出处 ────────────────────────────────────────────────────────
//   单元卡 `2-任务包/现行/单元卡-U4.md` §3 · 路线图 R4 · 需求 §五「职位分工 + 每人影响可查」
//   现状（改造前）：grep 职务加成|roleBonus ⇒ 0 ⇒ 谁处理都一样（职位只有记录、没有作用）
//
// ── 三条硬约束（单元卡）──────────────────────────────────────────
//   ① 对应职务处理 ⇒ 效果 ×1.3；非对应 ⇒ ×1.0
//   ② ★ **所有人仍能处理**（不卡进度）· **未设职务的组照常**（一律 ×1.0）
//   ③ 卡片要能标「建议由 🛎️ 大堂经理 处理（效果 +30%）」+ 显示处理人
//
// ── 口径（不许串）──────────────────────────────────────────────
//   · 「责任职务」按差评的 **cause**（`guests.js` 的结构化原因）映射到 decisions 的 owner 词表
//     （lobby/finance/hr/ops/manager）—— **复用同一套 owner 词汇**，不另立第五套命名（BL-7 家族）
//   · 职务来源 = `profiles.role_in_group`（App 存进 state.user.groupRole）
//   · 完全确定性：只看 (cause, 处理人职务) ⇒ 同输入同权重（无随机、无时间）
//   · ★ 与「选项必须有消费点」（D74）对偶：**本模块的产出必须真的进结算** ——
//     权重经 weekInputs.resolvedWeight → settle（门槛 + 口碑增益），守门有专断言，不能"算了不用"

export const ROLE_BONUS = 1.3

// 职务标签（界面显示用；owner 词汇与 decisions.js 一致）
export const 职务标签 = {
  lobby: '🛎️ 大堂经理',
  finance: '💰 财务经理',
  hr: '👥 人事经理',
  ops: '📣 运营经理',
  manager: '🧑‍💼 店长',
}

// 差评 cause（guests.js 的词表）→ 责任职务
//   · 客服/接待/态度类 ⇒ 大堂（前厅）· 价格/渠道类 ⇒ 运营 · 卫生/设施类 ⇒ 大堂（客房服务归口）
//   · 到店无房（超售）⇒ 店长（全局决策）· 人力/排班类 ⇒ 人事 · 成本/能耗类 ⇒ 财务
export const 责任职务表 = {
  service: 'lobby',        // 服务/接待
  praise_service: 'lobby',
  clean: 'lobby',          // 卫生
  praise_clean: 'lobby',
  facility: 'lobby',       // 设施/隔音
  noise: 'lobby',
  no_room: 'manager',      // 到店无房（超售 = 店长决策）
  overbook: 'manager',
  price: 'ops',            // 价格/性价比
  channel: 'ops',          // 渠道/OTA
  staff: 'hr',             // 人力/排班
  hr: 'hr',
  cost: 'finance',         // 成本/能耗
  energy: 'finance',
  default: 'lobby',        // 未知原因 ⇒ 归前厅（最贴近"客人体验"的岗）—— 不臆造新职务
}

export function 责任职务(cause) {
  const k = String(cause || '').trim()
  return 责任职务表[k] || 责任职务表.default
}

// 该 cause 是否应由「处理人职务」处理（未设职务/未知 ⇒ false ⇒ 权重 1.0，绝不卡进度）
export function 职务匹配(cause, 处理人职务) {
  const r = 责任职务(cause)
  const g = String(处理人职务 || '').trim()
  return !!g && g === r
}

// 有效处理权重：匹配 ×1.3，否则 ×1.0（纯函数 · 确定性）
export function 处理权重(cause, 处理人职务) {
  return 职务匹配(cause, 处理人职务) ? ROLE_BONUS : 1
}

// 卡片提示文案（唯一生成点；界面只渲染）
export function 建议职务文案(cause) {
  const r = 责任职务(cause)
  const 标签 = 职务标签[r] || r
  return `建议由 ${标签} 处理（效果 +${Math.round((ROLE_BONUS - 1) * 100)}%）`
}

// 有效处理权重（weekInputs 用）：**逐卡**取该卡被处理时的处理人职务（`handledByRole`）
//   ★ 为什么逐卡而不是"当前职务"：处理可能发生在不同周/不同人手上，用当前职务会把历史重写。
//   ★ 卡上没有该字段（旧存档 / 未设职务 / 离线演示卡）⇒ ×1.0 ⇒ 旧行为逐字节不变。
export function 有效处理权重(卡s, 兜底职务 = null) {
  const 列 = Array.isArray(卡s) ? 卡s : []
  return 列.reduce((s, r) => s + 处理权重(r && r.cause, (r && r.handledByRole) || 兜底职务), 0)
}
