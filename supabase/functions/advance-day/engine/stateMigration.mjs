// 存档口径迁移（批次 B1 · D25 公式）
//
// ── 背景 ────────────────────────────────────────────────────────
// T1.1 把金额量级改了 m 倍（revenue/fixedCost/variableCost 由【一晚】×7 扩为【一周】，
// 再由 A3 的 m 修正资金三数）。旧存档里的金额仍是旧量级 ⇒ 不迁移就会出现【一周混口径】：
//   旧 capital（50 万量级）+ 新 profit（10 倍量级）→ 资金曲线瞬间跳变、"破产预警"教学失真。
//
// ── ★ D25 公式（不许写成 capital × m）──────────────────────────
//   capital_new = IC_new + (capital_old − IC_old) × m
//     IC_old = 500,000 ｜ IC_new = 5,020,000 ｜ m = 10.0483
//   为什么不是 capital × m：乘 m 会把"玩家已赚/已亏的那部分"也按新起点放大 ——
//   一个刚开局（capital ≈ IC_old）的旧档会被放大到 IC_old×m ≈ 503 万，凭空多出 3 万；
//   而 D25 公式把它还原到 IC_new ≈ 502 万，只放大【相对起点的盈亏】。
//
// ── 幂等 / 回滚 / 不删档 ────────────────────────────────────────
//   · 幂等：scaleVersion === 2 直接原样返回（跑两次结果逐字节相同）
//   · .bak：模块本身【纯函数、不写盘】；备份由调用方（App）在写回前落 .bak 键
//   · 不删档：只改数值，绝不删除任何字段/条目（history 长度不变）
//
// ── 缩放边界（哪些乘、哪些不乘）──────────────────────────────────
//   ×m  ：周总额类 —— revenue / totalCost / rentCost / gop / profit / eventFine /
//         overbookCompensation / totalExpenses / weeklyExpenses 各项 / dailySnapshots 各项 / capital
//   不乘：price（ADR 是【每间每晚】，T1.1 没动它）· gopRate（比率）· occupancy / rooms /
//         occupiedRooms / reviewCount / negativeCount / goodRate / finalGoodRate（瞬时或计数）
//         · decisions / events / insights / attrsAfter（非金额）
//
// ── 已知遗留（不在本批修，记入报告）────────────────────────────
//   history 里存的是 settle() 的【整个返回对象】，因此 Phase D 新增的 dailySnapshots
//   会随 history 一起落存档 —— 与"天数据不持久化"的字面要求有出入（详见 B1 报告 §诚实记录）。

// 🔴 W2-2：改成【版本序表】——口径每变一次只加一行，迁移按跳次依次执行（不再每次重写）
//   ① v1→v2：T1.1（一晚→一周 ×7 + 资金三数 m=10.0483）⇒ IC 50万 → 502万
//   ② v2→v3：W2-1 部门成本落地 ⇒ 利润量级 ×0.2970 ⇒ IC 502万 → 149万
//   ★ 合并校验：500,000 × 10.0483 × 0.2970 = 1,492,150 ≈ IC_NEW 1,490,000（万位取整）
export const SCALE_STEPS = [
  { from: 1, to: 2, IC_OLD: 500000, IC_NEW: 5020000, m: 10.0483, why: 'T1.1 一晚→一周 ×7 + 资金三数按 m' },
  { from: 2, to: 3, IC_OLD: 5020000, IC_NEW: 1490000, m: 0.2970, why: 'W2-1 部门成本落地 ⇒ 利润量级 ×0.297' },
]
const IC_NEW = 1490000   // 当前起始资金（W2-2 落值 · D40 裁定）
export const SCALE = {
  IC_OLD: 500000,        // 最旧档起始资金（文档/断言引用）
  IC_NEW,                // 当前起始资金（W2-2 落值）
  m: SCALE_STEPS.reduce((a, st) => a * st.m, 1),   // ★ 累计缩放【由各跳推导】，不手写 —— 避免与跳表漂移
  VERSION_LEGACY: 1,
  VERSION_CURRENT: 3,
  // 🔴 W2 收尾（学生可见错值修复）：资金三数【由 IC 推导】——界面与守门一律引用这两个常量。
  //   比例来自 D40（黄/IC = 0.2000、红/IC = 0.1000，决策端第 12 轮实算复核）。
  //   为什么要常量：W2-2 改 IC 时，界面里【硬编码】的 502 万文案 / 100.4 万预警线没跟着改
  //   ⇒ 学生看到"启动约 502 万"却拿到 149 万、周报预警线（100.4万）与资金卡变黄线（29.8万）两套。
  //   从此单源：改 IC 一处，文案/阈值/守门全部跟着走。
  变黄线: Math.round(IC_NEW * 0.2),   // 298,000 = UI「⚠ 资金偏低」
  变红线: Math.round(IC_NEW * 0.1),   // 149,000 = UI「🚨 破产预警」
}

// history / report 条目里【乘 m】的字段
const MONEY_KEYS = ['revenue', 'totalCost', 'rentCost', 'gop', 'profit', 'eventFine', 'overbookCompensation', 'totalExpenses']
// 子对象里【每个值都乘 m】的字段（成本构成 / 日快照）
const MONEY_MAPS = ['weeklyExpenses']
const DAY_MONEY_KEYS = ['revenue', 'cost', 'cashDelta']

const scaleNum = (v, m = SCALE.m) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * m) : v)

// 缩放一个"结算结果"对象（report 或 history[i]）—— 只读入参，返回新对象
function scaleResult(r, m = SCALE.m) {
  if (!r || typeof r !== 'object') return r
  const out = { ...r }
  for (const k of MONEY_KEYS) if (k in out) out[k] = scaleNum(out[k], m)
  for (const k of MONEY_MAPS) {
    if (out[k] && typeof out[k] === 'object') {
      const m2 = {}
      for (const [kk, vv] of Object.entries(out[k])) m2[kk] = scaleNum(vv, m)
      out[k] = m2
    }
  }
  if (Array.isArray(out.dailySnapshots)) {
    out.dailySnapshots = out.dailySnapshots.map(d => {
      if (!d || typeof d !== 'object') return d
      const dd = { ...d }
      for (const k of DAY_MONEY_KEYS) if (k in dd) dd[k] = scaleNum(dd[k], m)
      return dd
    })
  }
  out.scaled = true                    // 打标记：本条已按新量级换算
  return out
}

// ── 写档侧单一入口（批次 B1.5）────────────────────────────────
// 🔴 为什么需要它：B1 补了本地 saveState 的 scaleVersion 后，抽查发现【云端写入侧还漏着】——
//    漏一处就等于"写出去的档没有版本标记 ⇒ 下次读档被再迁移一次（金额涨 m 倍）"。
//    所以把"盖版本戳"收敛成一个函数，所有写档路径（本机 / 云端上传 / 未来新增）都必须过它。
//    ★ 用法：{ ...withScaleVersion(payload) } —— 不改入参，返回带戳的副本。
export function withScaleVersion(state) {
  if (!state || typeof state !== 'object') return state
  return { ...state, scaleVersion: SCALE.VERSION_CURRENT }
}

/**
 * 云端档 → 可直接写进 state 的规范化对象（批次 B1.5 读取侧）。
 * 🔴 抽成纯函数的原因：原来的云端恢复路径内联在 App 的 useEffect 里，依赖真实 Supabase
 *    （fetchGameState），导致"旧云档会不会被迁移"这件事【根本没法在测试里验】。
 *    现在恢复逻辑在这里，App 只负责把结果灌进 state ⇒ 可用纯函数直接跑测试。
 * @returns {{ state: object|null, migrated: boolean, reason: string }}
 */
export function restoreFromCloud(cloudSaved) {
  if (!cloudSaved || typeof cloudSaved !== 'object') return { state: null, migrated: false, reason: '云端无档' }
  const r = migrateSave(cloudSaved)
  return { state: r.save, migrated: r.migrated, reason: r.reason }
}

/**
 * 迁移存档。纯函数：不写盘、不改入参。
 * @param {object} saved 读到的存档对象（可能为 null/非法）
 * @returns {{ save: object|null, migrated: boolean, reason: string, from: number, to: number, scaledHistory: number }}
 */
export function migrateSave(saved) {
  const none = { save: saved, migrated: false, reason: '', from: 0, to: 0, scaledHistory: 0 }
  if (!saved || typeof saved !== 'object') return { ...none, reason: '不是对象，原样返回' }

  const ver = Number(saved.scaleVersion) || SCALE.VERSION_LEGACY
  if (ver >= SCALE.VERSION_CURRENT) return { ...none, reason: `已是 scaleVersion=${ver}，跳过（幂等）`, from: ver, to: ver }

  // 🔴 W2-2：按【跳次】依次迁移（每跳只做一次 D25 变换）
  //   跳内变换：capital = IC_new + (capital − IC_old) × m ；history/report 金额 × m
  const steps = SCALE_STEPS.filter(st => st.from >= ver)
  const scaledOnce = (obj, m) => {
    const r = scaleResult(obj, m)
    return r
  }
  let cur = { ...saved }
  let history = Array.isArray(cur.history) ? cur.history : []
  for (const st of steps) {
    // capital：有字段就用它；无则先按该跳的 IC_OLD + Σ利润 还原
    const sumProfit = history.reduce((a, h) => a + (Number(h && h.profit) || 0), 0)
    const capitalOld = typeof cur.capital === 'number' ? cur.capital : st.IC_OLD + sumProfit
    const capitalNew = Math.round(st.IC_NEW + (capitalOld - st.IC_OLD) * st.m)   // ★ D25：只放大相对起点的盈亏
    history = history.map(h => scaledOnce(h, st.m))
    cur = { ...cur, capital: capitalNew, history }
    if (cur.report && typeof cur.report === 'object') cur.report = scaledOnce(cur.report, st.m)
  }
  const save = { ...cur, scaleVersion: SCALE.VERSION_CURRENT }
  return {
    save, migrated: true,
    reason: `scaleVersion ${ver} → ${SCALE.VERSION_CURRENT}（${steps.length} 跳：${steps.map(s => `v${s.from}→v${s.to}`).join(' ')}）`,
    from: ver, to: SCALE.VERSION_CURRENT, scaledHistory: (save.history || []).length,
  }
}

// 供测试与文档引用的字段清单（"哪些乘了 m，为什么"）
export const SCALED_KEYS_DOC = [
  { 字段: 'capital', 口径: '周总额', 公式: 'IC_new + (capital_old − IC_old) × m', 为什么: '★ D25：只放大相对起点的盈亏，不把起点本身也乘 m' },
  { 字段: 'history[].revenue / totalCost / rentCost / gop / profit', 口径: '周总额', 为什么: 'T1.1 由【一晚】扩为【一周】（×7），再叠加资金量级 m 修正' },
  { 字段: 'history[].eventFine / overbookCompensation', 口径: '单次金额', 为什么: '同上：单次科目在旧口径下也是旧量级' },
  { 字段: 'history[].totalExpenses / weeklyExpenses.*', 口径: '周成本构成', 为什么: '与 totalCost 同量级，必须同步（否则成本条形图与总额对不上）' },
  { 字段: 'history[].dailySnapshots[].revenue / cost / cashDelta', 口径: '日金额', 为什么: '派生自周值，同量级' },
  { 字段: 'report.*（当周未归档的周报）', 口径: '同上', 为什么: '与 history 条目同结构' },
  // ★ §32-U4c-R6（D91）：延迟后果的形状登记 —— 缺失/旧档 ⇒ null ⇒ settle 按「无惩罚」处理（条件挂载不添键）
  { 字段: 'pendingPenalty（§32-U4c 新）', 口径: '周对象（条件挂载）', 公式: '{ 项: [{ 来源: 决策id, 文案, 属性: {quality/reputation/morale} }], startWeek } ⇒ 下周由 settle 消费', 为什么: '延迟后果：本周省成本的决策，下周才显现代价；缺失 ⇒ null ⇒ 不扣（旧档零变化）' },
  { 字段: '（不乘）price / gopRate / occupancy / rooms / occupiedRooms / reviewCount / negativeCount / goodRate / finalGoodRate', 口径: '瞬时值·比率·计数', 为什么: 'ADR 是【每间每晚】、T1.1 没动它；比率与计数天然无量级' },
]
