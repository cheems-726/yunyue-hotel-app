// §32-U8-B · AI 领班 —— 「看不见的手」正式化（授权式 · 确定性 · 留痕 · 不享职务加成）
//
// ── 出处 ────────────────────────────────────────────────────────
//   单元卡 `2-任务包/现行/单元卡-U8.md` §3 · 设计 `3-设计文档/B3-ai领班设计.md`
//   确定性原型 `tests/_b3-proto.mjs`（8/0 已跑通）—— 本文件把原型**正式化为 src 模块**（学生不在时的代管）
//
// ── 定位（B3 §一）───────────────────────────────────────────────
//   学生**不在时**的代管者。**默认不代管**（默认全关 = 全班行为一致 = 公平）；
//   两层授权：**全班统一默认**（老师端可改）+ 学生个人在默认之上**收窄或放宽**。
//   ★ 不代管不会"瘫"（决策是状态、不是一次性动作），会发生的是**僵化惩罚**——而这正是教学要的。
//
// ── 与 R4 职务加成的关系（卡内 §3④ 明令写清）────────────────────
//   代管**不享受** ×1.3 —— 那是「对岗真人」的激励；AI 领班不是真人，拿加成就是**双重加成**。
//   ★ 本模块的产出**不进** roleBonus 的任何计算路径（守门断言：两模块零引用）。
//
// ── 一期边界（B3 §六）───────────────────────────────────────────
//   一期 = **架构位**：接口 + 数据结构 + 周报代管记录槽位。规则集用 B3 的初始 4 条（R1/R2/R3/R7），
//   其中需要"日级竞对价序列"的 R1/R2 在一期用**周级近似**（竞对周快照）—— 如实标注，二期换真日序列。

export const 领班规则 = [
  {
    id: 'R1', item: 'pricing', weight: 'high', requires: 'price_adj',
    说明: '竞对均价降幅 ≥10% 且本店出租率 <55% 且竞对价低于本店 ⇒ 在授权幅度内下调房价至 竞对价×0.97（不破你的价格下限 · 保流量）',
    // ★ §32-U8-补 接线实测抓到（真实竞对数据）：锦江区竞对均价 ~1251（含香格里拉/君悦等 lux 竞对），
    //   经济型本店定价 ~283 ⇒ 原式 `max(下限, 竞对价×0.97)` 会给出"下调至 1214 元"的荒谬建议（实为涨 4 倍）。
    //   修：① 只有【竞对价低于本店】才触发（对标价高于我们时"跟降"无意义）；② 目标夹进 [价格下限, 当前价]。
    when: (s) => s.竞对降价幅度 >= 10 && s.出租率 < 55 && Number.isFinite(Number(s.竞对均价)) && Number(s.竞对均价) > 0
      && Math.round(Number(s.竞对均价) * 0.97) < Number(s.当前价),
    act: (s) => {
      const 目标 = Math.round(Number(s.竞对均价) * 0.97)
      const 上限 = Number.isFinite(Number(s.当前价)) ? Math.round(Number(s.当前价)) : 目标
      return { item: 'pricing', to: Math.max(学生下限(s), Math.min(目标, 上限)) }
    },
    reason: (s, a) => a ? `竞对均价降 ${s.竞对降价幅度}%、我们出租率 ${s.出租率}%（低于健康线）→ 在你授权的幅度内把房价调至 ${a.to} 元（对标竞对价 · 不破你的价格下限 · 不超过你当前定价）。若想自己管，可在授权页收紧调价幅度` : `竞对均价降 ${s.竞对降价幅度}%、我们出租率 ${s.出租率}%（低于健康线）→ 建议下调房价（未获授权，仅报告不动作）`,
    一期口径: '竞对价为【周级快照近似】（真日级序列二期换）',
  },
  {
    id: 'R2', item: 'pricing', weight: 'high', requires: 'price_adj',
    说明: '出租率 ≥90% 且本店定价低于竞对 ≥5% ⇒ 上调 5%（测试支付意愿）',
    when: (s) => s.出租率 >= 90 && s.竞对溢价 >= 5,
    act: (s) => ({ item: 'pricing', to: Math.min(Math.round(s.当前价 * 1.05), 学生下限(s) * 2) }),
    reason: (s, a) => a ? `出租率 ${s.出租率}% 且定价低于市场 ${s.竞对溢价}% → 上调房价至 ${a.to} 元测试支付意愿` : `出租率 ${s.出租率}% 且定价低于市场 ${s.竞对溢价}% → 建议上调房价（未获授权，仅报告不动作）`,
    一期口径: '同 R1（周级近似）',
  },
  {
    id: 'R3', item: 'overbook', weight: 'low', requires: 'overbook',
    说明: '本周超售赔偿 ≥2 次 ⇒ 超售清零止损',
    when: (s) => s.本周超售赔偿次数 >= 2,
    act: () => ({ item: 'overbook', to: 0 }),
    reason: (s) => `本周已赔 ${s.本周超售赔偿次数} 次到店无房 → 超售清零止损`,
  },
  {
    id: 'R7', item: '__report', weight: 'low', requires: 'none',
    说明: '卫生检查不合格 ⇒ 建议停房深清洁（超出领班权限，只报告）',
    when: (s) => !!s.卫生不合格,
    act: () => null,
    reason: (s) => `卫生检查不合格：建议停房深清洁（超出领班权限，请店主处理）`,
  },
]

// ★ null 安全（§32-U8-补 接线时抓到）：原式 `Number.isFinite(Number(s.学生价格下限))` 对 null 判真
//   （Number(null)===0 是有限数）⇒ 会把"未设置"误读成下限 0。现在显式排除 null/undefined。
const 学生下限 = (s) => (s.学生价格下限 != null && Number.isFinite(Number(s.学生价格下限)))
  ? Number(s.学生价格下限)
  : Math.round(Number(s.当前价) * 0.85)

// 两层授权（B3 §一.3）：全班统一默认 + 学生个人收窄/放宽
export const 默认授权 = { price_adj: false, overbook: false, energy: false }   // 默认全关 = 公平

export function 生效授权({ 全班默认 = 默认授权, 学生覆盖 = null } = {}) {
  return { ...默认授权, ...(全班默认 || {}), ...(学生覆盖 || {}) }
}

// 领班决策（纯函数 · 确定性：同状态同授权同事件 ⇒ 同动作）
//   state 形状（一期由 weekInputs 派生）：{ 出租率, 当前价, 竞对均价, 竞对降价幅度, 竞对溢价, 本周超售赔偿次数, 卫生不合格, 学生价格下限 }
export function 领班决策({ state, authorizations }) {
  const s = { ...state }
  const actions = [], reports = []
  const claimed = new Set()
  for (const rule of 领班规则) {
    if (!rule.when(s)) continue
    if (rule.item !== '__report' && claimed.has(rule.item)) continue        // 同 item 互斥（数组序 = 优先级）
    const auth = authorizations[rule.requires]
    if (rule.requires !== 'none' && !(auth && auth.ok)) {
      // 无授权 ⇒ 只报告不动作（reason 拿建议值但不执行 —— 模板要能处理 a=null）
      let 建议值 = null
      try { 建议值 = rule.act(s) } catch (e) {}
      reports.push({ ruleId: rule.id, reason: rule.reason(s, 建议值) + (rule.item === '__report' ? '' : '（未获授权，仅报告不动作）') })
      continue
    }
    const a = rule.act(s)
    if (rule.item === '__report' || !a) { reports.push({ ruleId: rule.id, reason: rule.reason(s, a) }); continue }
    claimed.add(rule.item)
    // 授权边界裁剪（price_adj ±10%）
    let to = a.to
    if (rule.requires === 'price_adj' && auth.clamp) to = auth.clamp(to, s)
    actions.push({ ruleId: rule.id, item: rule.item, to, reason: rule.reason(s, { to }) })
  }
  return { actions, reports }
}

// 代管率（B3 §三 · 一等教学信号）：动作 / (动作 + 学生亲自决策)；整周离线（0/0）⇒ null 不进平均
export function 代管率(领班动作数, 学生亲自决策数) {
  const a = Number(领班动作数) || 0, b = Number(学生亲自决策数) || 0
  if (a + b === 0) return null
  return a / (a + b)
}
