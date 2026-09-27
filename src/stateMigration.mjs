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

export const SCALE = {
  IC_OLD: 500000,
  IC_NEW: 5020000,
  m: 10.0483,
  VERSION_LEGACY: 1,   // 旧档（无 scaleVersion 字段 ⇒ 视为 1）
  VERSION_CURRENT: 2,  // 已迁移
}

// history / report 条目里【乘 m】的字段
const MONEY_KEYS = ['revenue', 'totalCost', 'rentCost', 'gop', 'profit', 'eventFine', 'overbookCompensation', 'totalExpenses']
// 子对象里【每个值都乘 m】的字段（成本构成 / 日快照）
const MONEY_MAPS = ['weeklyExpenses']
const DAY_MONEY_KEYS = ['revenue', 'cost', 'cashDelta']

const scaleNum = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * SCALE.m) : v)

// 缩放一个"结算结果"对象（report 或 history[i]）—— 只读入参，返回新对象
function scaleResult(r) {
  if (!r || typeof r !== 'object') return r
  const out = { ...r }
  for (const k of MONEY_KEYS) if (k in out) out[k] = scaleNum(out[k])
  for (const k of MONEY_MAPS) {
    if (out[k] && typeof out[k] === 'object') {
      const m2 = {}
      for (const [kk, vv] of Object.entries(out[k])) m2[kk] = scaleNum(vv)
      out[k] = m2
    }
  }
  if (Array.isArray(out.dailySnapshots)) {
    out.dailySnapshots = out.dailySnapshots.map(d => {
      if (!d || typeof d !== 'object') return d
      const dd = { ...d }
      for (const k of DAY_MONEY_KEYS) if (k in dd) dd[k] = scaleNum(dd[k])
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

  const history = Array.isArray(saved.history) ? saved.history : []
  // capital_old：有字段就用它；否则回退"IC_old + Σ历史利润"（与旧版 App 的兜底口径一致）
  const sumProfitOld = history.reduce((a, h) => a + (Number(h && h.profit) || 0), 0)
  const capitalOld = typeof saved.capital === 'number' ? saved.capital : SCALE.IC_OLD + sumProfitOld
  // ★ D25：只放大【相对起点的盈亏】
  const capitalNew = Math.round(SCALE.IC_NEW + (capitalOld - SCALE.IC_OLD) * SCALE.m)

  const save = {
    ...saved,
    capital: capitalNew,
    history: history.map(scaleResult),
    scaleVersion: SCALE.VERSION_CURRENT,
  }
  if (saved.report && typeof saved.report === 'object') save.report = scaleResult(saved.report)

  return { save, migrated: true, reason: `scaleVersion ${ver} → ${SCALE.VERSION_CURRENT}`, from: ver, to: SCALE.VERSION_CURRENT, scaledHistory: history.length }
}

// 供测试与文档引用的字段清单（"哪些乘了 m，为什么"）
export const SCALED_KEYS_DOC = [
  { 字段: 'capital', 口径: '周总额', 公式: 'IC_new + (capital_old − IC_old) × m', 为什么: '★ D25：只放大相对起点的盈亏，不把起点本身也乘 m' },
  { 字段: 'history[].revenue / totalCost / rentCost / gop / profit', 口径: '周总额', 为什么: 'T1.1 由【一晚】扩为【一周】（×7），再叠加资金量级 m 修正' },
  { 字段: 'history[].eventFine / overbookCompensation', 口径: '单次金额', 为什么: '同上：单次科目在旧口径下也是旧量级' },
  { 字段: 'history[].totalExpenses / weeklyExpenses.*', 口径: '周成本构成', 为什么: '与 totalCost 同量级，必须同步（否则成本条形图与总额对不上）' },
  { 字段: 'history[].dailySnapshots[].revenue / cost / cashDelta', 口径: '日金额', 为什么: '派生自周值，同量级' },
  { 字段: 'report.*（当周未归档的周报）', 口径: '同上', 为什么: '与 history 条目同结构' },
  { 字段: '（不乘）price / gopRate / occupancy / rooms / occupiedRooms / reviewCount / negativeCount / goodRate / finalGoodRate', 口径: '瞬时值·比率·计数', 为什么: 'ADR 是【每间每晚】、T1.1 没动它；比率与计数天然无量级' },
]
