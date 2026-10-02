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
    id: 'R6', item: 'energy', weight: 'low', requires: 'energy',
    说明: '室温 ≤21℃ 或 ≥26℃ ⇒ 回归 23℃（舒适区 · 客人不投诉能耗也没占便宜）',
    // ★ §33-V3（二期落地 · B3 §六"零账本改动"档）：act 落点 = decisions.energy ⇒ 引擎既有消费链
    //   （variableCost (energy−23)×2 + goodRate 极端扣分 + insights 提醒）自动生效。
    //   不双扣：R6 决策代价表（decisionRisk）管【学生选极端温度的属性代价】，本规则是【代管把温度调回舒适区】
    //   —— 代管后的 energy=23 不再命中极端扣分 ⇒ 是"代管消除代价"，不是"代价被算两次"。
    when: (s) => Number.isFinite(Number(s.室温)) && (Number(s.室温) <= 21 || Number(s.室温) >= 26),
    act: () => ({ item: 'energy', to: 23 }),
    reason: (s) => `室温 ${s.室温}℃ 过于极端（客人投诉舒适度、能耗也没省）→ 回归 23℃ 舒适区`,
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


// ★★ §33-V3（二期 · 同构纯函数 · 双端共用）：代管动作 → 并入决策集（学生决策优先）
//
// ── §33-V3 不双扣边界表（卡内 §1③ · 四层逐条 · 守门在 tests/personaWeight 与 thirdPhase）────
//   × **V4 选址两维**（房价→priceCompetitive / 人力→成本+服务）：领班代管只改【决策项本身】
//     （overbook/energy 的值）；代管后的决策照常流经 V4 两维的消费链 ⇒ 是"作用于代管后的状态"，
//     不是"代管被额外乘一次" —— 无二次叠加。
//   × **V6 客群结构加权**：同上 —— 客群加权评的是【决策与客群的匹配】，代管改的是【决策值】；
//     代管后的 energy=23 会照常参与客群路命中（如"温度适合家庭"）⇒ 单次计算，无重复。
//   × **R4 职务加成 ×1.3**：R4 乘在【差评处理的有效权重】（weekInputs 单源）；领班代管不碰差评处理
//     ⇒ 结构性零交叠（既有断言：aiSupervisor ↔ roleBonus 双向零引用 —— 继续保持并已扩展到 领班代管）。
//   × **R6 决策代价表（decisionRisk）**：决策代价表评的是【学生选的选项自身的代价】（如 energy=26 的
//     极端代价走事件/insights 链）；代管把 energy 改成 23 ⇒ 极端代价链自然不再命中 ⇒ 是"代管消除了
//     代价触发条件"，不是"代价被扣两次"。★ 注意区分：B3 规则 R6（能耗回归）与决策风险化 R6 是两回事
//     —— 前者是领班规则 id，后者是代价表模块；命名撞车但机制零关联（注释在此说明，防后人误改）。
//
//   · 输入：上周结算结果（上周）+ 学生当前决策（学生决策）+ 两层授权
//   · 输出：{ 代管决策, 记录 } —— 代管决策 = 只含【学生没做】的项（学生优先 · 空对象 = 不动）
//   · ★ 双端共用：客户端 App.doSettle 与服务端 serverTick 都调本函数 ⇒ "补算 === 在线"由【同一份源码】保证
//     （不是靠两处实现碰巧一致 —— weeklyAuto/serverTick 的既有纪律）。
//   · 范围：R3（overbook→0）/ R6（energy→23）—— 零账本改动档；R1/R2 需竞对价日级序列 ⇒ 明确不做
//     （快照的 竞对均价/降价幅度/溢价 传 null ⇒ R1/R2 的 when 天然不触发，且调用方不得传周级值冒充）。
//   · 不双扣（×V4/V6/R4/R6）：见文件顶部边界表 —— 代管只改【决策项本身】，所有既有消费链
//     （V4 两维/V6 客群加权/R4 处理权重/R6 决策代价）照常作用于代管后的决策，无二次叠加。
export function 领班代管({ 上周, 学生决策, 全班默认 = null, 学生覆盖 = null }) {
  const 空结果 = { 代管决策: {}, 记录: null }
  try {
    if (!上周 || typeof 上周 !== 'object') return 空结果
    if (!全班默认 && !学生覆盖) return 空结果                       // 未授权 ⇒ 一步不动（默认全关 = 公平）
    const 授权 = 生效授权({ 全班默认, 学生覆盖 })
    if (!Object.keys(授权).some(k => 授权[k] && 授权[k].ok)) return 空结果   // 全关 ⇒ 不动
    const 实收均价 = (Number(上周.occupiedRooms) > 0 && Number.isFinite(Number(上周.revenue)))
      ? Math.round(Number(上周.revenue) / (Number(上周.occupiedRooms) * 7)) : null
    const 快照 = {
      出租率: Number(上周.occupancy) || 0,
      当前价: 实收均价,
      竞对均价: null, 竞对降价幅度: 0, 竞对溢价: null,   // R1/R2 需竞对价日级序列 ⇒ 二期不做 ⇒ null 不触发
      本周超售赔偿次数: (Number(上周.overbookCompensation) > 0 && Number(上周.price) > 0)
        ? Math.round(Number(上周.overbookCompensation) / Math.round(Number(上周.price))) : 0,
      卫生不合格: (学生决策 || {}).hygiene === '不停房',
      // ★ §33-V3 R6 语义（学生优先的推论）：室温 = 学生本周决策.energy，没做 ⇒ **延续上周值**
      //   （决策是状态、不是一次性动作 —— B3 §一 的延续语义）。上周值从 上周.decisions.energy 推；
      //   上周也没有 ⇒ 23（舒适区缺省 ⇒ 不触发）。学生本周做了 ⇒ 学生优先（本路会被下方过滤剔除，
      //     但 when 仍按延续值判 —— 剔除发生在过滤层，不影响 when 的真实性）。
      室温: (学生决策 || {}).energy != null ? Number((学生决策 || {}).energy)
        : (上周.decisions && 上周.decisions.energy != null) ? Number(上周.decisions.energy) : 23,
    }
    const rec = 领班决策({ state: 快照, authorizations: 授权 })
    const 代管决策 = {}
    for (const a of rec.actions) {
      const 落点 = a.item === 'overbook' ? 'overbook' : a.item === 'energy' ? 'energy' : null
      if (落点 && (学生决策 || {})[落点] === undefined) 代管决策[落点] = a.to   // ★ 学生决策优先
    }
    return { 代管决策, 记录: { ...rec, 代管决策: { ...代管决策 } } }
  } catch (e) { return 空结果 }
}