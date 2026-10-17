// V113-2.2 · 指标派生层（**纯派生 · 只加层不改数**）
//
// ── 输入从哪来（每条都注明）──────────────────────────────────────────
//   入参 = 一行真实结算结果（`settlement.js` 的 return 对象，或 tick 落库后的 history 行）。
//   只读它**已经算好的字段**（revenue / rooms / occupiedRooms / gop / totalCost / netProfit / weeklyExpenses），
//   **不重算任何成本或收入** —— 所以不可能与引擎出现"两个真相"。
//
// ── 分层（V113 §1① 已定口径 · 与 settlement.js:809 逐项恒等）────────────
//   部门利润   = revenue − (客房变动成本 + 客房部固定 + 人力固定)
//   未分配费用 = 公区能耗 + 行政管理 + 维修保养 + 营销推广 + OTA佣金
//   GOP        = 部门利润 − 未分配费用      ⇒ 必须 === row.gop（差额 0）
//   EBITDA 近似 = netProfit + 开业一次性费用 − 保证金退还（保险/FF&E 未建模 ⇒ 不加）
//
// ── 边界（守门断言见 tests/metricView.test.mjs）───────────────────────
//   · 本文件**不得 import** settlement / decisions / attrs（否则就是第二个真相源）
//   · 分母 revenue ≤ 0 或 rooms ≤ 0 ⇒ 全部返回 null（筹建周可能为 0，绝不产出 NaN/Infinity）

const 一次性键 = ['开业一次性费用', '保证金退还']

const 数 = (w, k) => { const v = Number(w && w[k]); return Number.isFinite(v) ? v : 0 }

/**
 * 成本结构（条形图数据 · 只算经营项，一次性项单列）
 * @returns {{经营成本:number|null, 项:Array<{名,额,一次性,占比:number|null}>, 合计:number|null}}
 */
export function 成本结构(row) {
  const w = (row && row.weeklyExpenses) || {}
  const 一次性额 = 一次性键.reduce((a, k) => a + 数(w, k), 0)
  const total = Number(row && row.totalCost)
  const 经营成本 = Number.isFinite(total) ? total - 一次性额 : null
  const 项 = Object.keys(w).map(名 => ({
    名, 额: 数(w, 名), 一次性: 一次性键.includes(名),
    占比: (!一次性键.includes(名) && 经营成本 > 0) ? 数(w, 名) / 经营成本 : null,
  }))
  const 经营项 = 项.filter(x => !x.一次性 && x.占比 != null)
  // ★ 无任何经营项（旧行/空明细）⇒ null（不返回 0 冒充 100%）
  const 合计 = (经营成本 > 0 && 经营项.length > 0) ? 经营项.reduce((a, x) => a + x.占比, 0) : null
  return { 经营成本, 项, 合计 }
}

/**
 * 本周 6 指标 + 分层 + 成本结构
 * @param {object} row 一行结算结果（或 history 行 + 其成本字段）
 */
export function metricView(row) {
  if (!row || typeof row !== 'object') return null
  const w = row.weeklyExpenses || {}
  const revenue = Number(row.revenue)
  const rooms = Number(row.rooms)
  const 售出 = Number(row.occupiedRooms)
  const 可算 = Number.isFinite(revenue) && revenue > 0 && Number.isFinite(rooms) && rooms > 0

  // ★ 缺字段 ⇒ null（**不许用 0 补**：旧 history 行没有成本明细，补 0 会把 GOP 算成营收 ⇒ 造数）
  const 有 = (k) => Number.isFinite(Number(w && w[k]))
  const 分层可算 = 可算 && ['客房变动成本', '客房部固定', '人力固定', '公区能耗', '行政管理', '维修保养', '营销推广', 'OTA佣金'].every(有)
  const 部门利润 = 分层可算 ? revenue - (数(w, '客房变动成本') + 数(w, '客房部固定') + 数(w, '人力固定')) : null
  const 未分配费用 = 分层可算 ? 数(w, '公区能耗') + 数(w, '行政管理') + 数(w, '维修保养') + 数(w, '营销推广') + 数(w, 'OTA佣金') : null
  const gop派生 = (部门利润 != null && 未分配费用 != null) ? 部门利润 - 未分配费用 : null
  const gop = Number(row.gop)
  const 一次性 = 数(w, '开业一次性费用') + 数(w, '保证金退还')
  const netProfit = Number(row.netProfit)

  return {
    week: row.week,
    分层: {
      部门利润, 未分配费用, GOP: gop派生,
      gop差额: (gop派生 != null && Number.isFinite(gop)) ? gop派生 - gop : null,
    },
    OCC: (可算 && Number.isFinite(售出) && 售出 >= 0) ? 售出 / rooms : null,
    // ★ occupiedRooms 是【日均】在住间数（OCC = 售出/房间数）⇒ ADR 分母是「周售出间夜」= 售出 × 7
    ADR: (可算 && Number.isFinite(售出) && 售出 > 0) ? revenue / (售出 * 7) : null,
    RevPAR: 可算 ? revenue / rooms / 7 : null,      // 每间可售房每日客房收入
    TRevPAR: 可算 ? revenue / rooms / 7 : null,     // ★ 本模型只有客房收入 ⇒ TRevPAR 与 RevPAR 同值（口径注记，不编餐饮）
    GOPPAR: (可算 && gop派生 != null) ? gop派生 / rooms / 7 : null,
    GOP率: (可算 && gop派生 != null) ? gop派生 / revenue : null,
    净利率: (可算 && Number.isFinite(netProfit)) ? netProfit / revenue : null,
    净利率口径: '含一次性项（开业费用/保证金退还）· 经营口径见"净利率·经营"',
    净利率经营: (可算 && Number.isFinite(netProfit)) ? (netProfit - 一次性) / revenue : null,
    部门利润率: (可算 && 部门利润 != null) ? 部门利润 / revenue : null,
    FlowThrough: null,   // 需要连续两周的 GOP/营收 ⇒ 单周不编（"—·待接数据"）
    成本: 成本结构(row),
    一次性,
    总营收: Number.isFinite(revenue) ? revenue : null,
  }
}

/**
 * ★ V113-2.4：12 周矩阵的行（只算**能算的**；算不出的给 null ⇒ 界面显示「—·待接数据」，绝不补 0）
 * @param {Array} history 存档 history（每周一条结算结果；旧行可能只有 13 个字段）
 * @returns {Array<{week:number, OCC:number|null, ADR:number|null, RevPAR:number|null, 好评率:number|null, GOPPAR:number|null, GOP率:number|null, 有分层:boolean}>}
 */
export function 矩阵行(history) {
  const arr = Array.isArray(history) ? history : []
  return arr
    .filter(h => h && Number.isFinite(Number(h.week)))
    .map(h => {
      const v = metricView(h)
      return {
        week: Number(h.week),
        OCC: v ? v.OCC : null,
        ADR: v ? v.ADR : null,
        RevPAR: v ? v.RevPAR : null,
        好评率: Number.isFinite(Number(h.finalGoodRate)) ? Number(h.finalGoodRate) / 100 : null,
        GOPPAR: v ? v.GOPPAR : null,
        GOP率: v ? v.GOP率 : null,
        有分层: !!(v && v.分层 && v.分层.GOP != null),
      }
    })
    .sort((a, b) => a.week - b.week)
}
