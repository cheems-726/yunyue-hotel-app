// W3-1 · 「一页钱账」（选址/认领阶段）+ W3-5 · 回本周期（外推）
//
// ★ 口径（决策端 2026-09-27 拍板）：**选项 (b) 本店实测口径**
//   · ADR / OCC ：取【引擎确定性单周】的实收结果（settle 固定种子 `week*100+7`，"同一周全班同结果"）
//                  —— 不是拍脑袋的参考值，也不是华住样板
//   · CRS       ：按加盟资料【单列展示、不并入成本】（避免与 5% 管理费重复计）
//   · 回本周期   ：W4 裁决 = 外推法 ⇒ 页面必须标注"外推，非实际发生"
//
// ★ 与任务包原式的一处【明示偏差】（留痕，便于决策端否决/回退）：
//   任务包 W3-1 写的是 `房量×ADR×OCC×365 − 租金 − 人力 − 管理费5% − CRS`，
//   其中"人力"是 **W14（部门成本 5 科目）落地之前**的口径。本页改用**完整部门成本**
//   （固定 41.1 元/间可售房/天 + 变动按入住量），理由：(b) 的核心是"与后续真实结算同源"，
//   只扣人力会系统性高估现金流。页面把 人力固定 单列出来（口径不丢），并在页脚写明这一点。
//
// ★ 硬约束：只加展示、不改结算（纯函数；不被 settlement.js 引用 —— 守门会断言）
import { settle, parseRooms } from './settlement.js'
import { FRANCHISE_MODEL } from './franchiseModel.mjs'
// ★ STATUS 与报价单【共用同一个】状态词表（engineBarrel 的导出名冲突守门抓到我原先重复定义了一个）
import { propertyQuote, STATUS } from './propertyQuote.mjs'
import { DEPT_COST_LINES } from './deptCosts.mjs'

export const WEEKS_PER_YEAR = 52          // 年化基准：周值 × 52（与引擎周口径一致）
export const EXTRAPOLATION_NOTE = '外推：按基准单周年化，非实际发生（W4 裁决：外推法）'
// ★ 引擎当前缺口（P3 暂缓 · 决策端 2026-09-27 定）：结算【不】收加盟费/保证金/管理费/CRS。
//   本页按加盟资料把【管理费】计入现金流 ⇒ 本页比游戏内实际更保守；差额恰好 = 管理费。
//   实测证据（tests/onePageLedger.test.mjs）：全季（无费率数据）时 现金流 === 引擎利润年化（差 0）；
//   汉庭（有费率）时 差额 === 年管理费。P3 落地后本页无需改（届时引擎自己也会扣）。
export const ENGINE_GAP_NOTE = '引擎当前未对加盟费/管理费计费（P3 待定）—— 故游戏内实际会比本页乐观；本页按加盟资料计入管理费'

// 基准决策 = "常规经营"（与批次报告/单配置锚点同源的 7 项），不是"不作为"的空决策
export const BASE_DECISIONS = {
  pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗',
  'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿',
}
// 属性初值与 verify-gop / _w2-numbers / propertyQuote 的单配置口径一致（同源可复算）
export const BASE_ATTRS = { quality: 60, reputation: 70, morale: 65 }

// 引擎确定性单周（纯函数；同一 (site, brand, week=1) 必得同一结果）
export function baseWeek(site, brand) {
  return settle({ site, brand, decisions: BASE_DECISIONS, week: 1, attrs: { ...BASE_ATTRS } })
}

const 人力固定 = DEPT_COST_LINES.find(l => l.key === 'laborFixed')    // 18.5 元/间可售房/天（口径单源）
export const 部门固定合计 = DEPT_COST_LINES.reduce((a, l) => a + l.单价, 0)   // 41.1（供界面引用，避免写死数字）
export const 人力固定单价 = 人力固定?.单价 ?? null

export function onePageLedger({ brand, property, districtAttrs }) {
  const w = baseWeek(districtAttrs, brand)
  const rooms = parseRooms(brand?.standard)
  const occ = w.occupancy                       // 0-100（引擎口径）
  const adr = w.occupiedRooms > 0 ? Math.round(w.revenue / (w.occupiedRooms * 7)) : null   // 实收均价（T1.4/B2）

  const t = (brand?.name && FRANCHISE_MODEL[brand.name]) || null
  const 管理费率 = t?.管理费?.费率?.值 ?? null
  const CRS费率 = t?.中央预订系统_CRS?.费率?.值 ?? null

  const 年营收 = w.revenue * WEEKS_PER_YEAR
  const 年租金 = w.rentCost * WEEKS_PER_YEAR
  const 年部门固定 = w.deptCost * WEEKS_PER_YEAR                       // 按可售房发生（固定）
  const 年变动与其他 = (w.totalCost - w.rentCost - w.deptCost) * WEEKS_PER_YEAR   // 变动+营销+OTA+超售+改造+罚款（引擎实测）
  const 年管理费 = 管理费率 != null ? 年营收 * 管理费率 : null
  const 年CRS = CRS费率 != null ? 年营收 * CRS费率 : null              // ★ 单列，不并入
  const 年现金流 = 年营收 - 年租金 - 年部门固定 - 年变动与其他 - (年管理费 ?? 0)

  const quote = propertyQuote(brand, property, districtAttrs)
  const 总投资 = quote.lines.find(l => l.label === '总投资（估算）').value
  const 回本年 = (总投资 && 年现金流 > 0) ? 总投资 / 年现金流 : null

  const lines = [
    { label: '可排房量', value: rooms, unit: '间', fmt: 'num', status: rooms ? STATUS.OK : STATUS.MISSING, note: 'parseRooms(品牌标准)（A3 唯一权威）' },
    { label: '基准周出租率', value: occ, unit: '%', fmt: 'num', status: STATUS.OK, note: `引擎确定性单周（固定种子 week1）· 基准决策 7 项常规经营` },
    { label: '基准周平均房价（实收）', value: adr, unit: '元/间·天', fmt: 'num', status: adr ? STATUS.OK : STATUS.MISSING, note: '引擎实收 = 周客房收入 ÷ 售出间夜（T1.4/B2 口径）' },
    { label: '年营收', value: 年营收, unit: '元/年', fmt: 'wan', status: STATUS.DERIVED, note: `基准周营收 ${Math.round(w.revenue)} × ${WEEKS_PER_YEAR} 周` },
    { label: '年租金', value: 年租金, unit: '元/年', fmt: 'wan', status: STATUS.DERIVED, note: `基准周租金 ${Math.round(w.rentCost)} × ${WEEKS_PER_YEAR}（引擎租金口径）` },
    { label: '年部门成本（固定）', value: 年部门固定, unit: '元/年', fmt: 'wan', status: STATUS.DERIVED,
      note: `按可售房发生：${部门固定合计.toFixed(1)} 元/间·天 × ${rooms} 间 × 365（含人力固定 ${人力固定?.单价} 元/间·天）` },
    { label: '年变动与其他', value: 年变动与其他, unit: '元/年', fmt: 'wan', status: STATUS.DERIVED, note: '变动成本 + 营销 + OTA佣金 + 超售赔偿（引擎实测）' },
    { label: '年管理费（特许费）', value: 年管理费, unit: '元/年', fmt: 'wan', status: 年管理费 != null ? STATUS.DERIVED : STATUS.MISSING,
      note: 年管理费 != null ? `月营收 × ${(管理费率 * 100).toFixed(1)}%（加盟资料三件套）⇒ 年化 = 年营收 × 费率` : `${brand?.name || '该品牌'} 的管理费率暂无来源数据` },
    { label: '年现金流（本页口径）', value: 年现金流, unit: '元/年', fmt: 'wan', status: STATUS.DERIVED,
      note: 年管理费 != null
        ? '年营收 − 年租金 − 年部门成本(固定) − 年变动与其他 − 年管理费'
        : '年营收 − 年租金 − 年部门成本(固定) − 年变动与其他。★ 管理费缺来源数据【未计入】⇒ 实际现金流更低，别当净利看' },
    { label: 'CRS（单列·不并入）', value: 年CRS, unit: '元/年', fmt: 'wan', status: 年CRS != null ? STATUS.DERIVED : STATUS.MISSING,
      note: 年CRS != null ? `中央预订系统抽成 ${(CRS费率 * 100).toFixed(1)}% × 年营收 —— 按决策端口径【仅展示，不并入成本】` : 'CRS 费率暂无来源数据' },
  ]

  return {
    brand: brand?.name || null, property: property?.name || null,
    rooms, occ, adr, weeks: WEEKS_PER_YEAR,
    baseWeek: { revenue: w.revenue, rentCost: w.rentCost, deptCost: w.deptCost, totalCost: w.totalCost, occupiedRooms: w.occupiedRooms, occupancy: w.occupancy },
    yearly: { 营收: 年营收, 租金: 年租金, 部门固定: 年部门固定, 变动与其他: 年变动与其他, 管理费: 年管理费, CRS: 年CRS, 现金流: 年现金流 },
    总投资, 回本年, lines,
    extrapolation: EXTRAPOLATION_NOTE,
    engineGap: ENGINE_GAP_NOTE,
    // ★ 与引擎的一致性锚点：无管理费数据时 现金流 === 引擎利润年化（差 0）；有费率时差额 === 管理费
    引擎利润年化: (w.revenue - w.totalCost) * WEEKS_PER_YEAR,
    missing: lines.filter(l => l.status === STATUS.MISSING).map(l => l.label),
  }
}

// 回本周期文案（W3-5）：只在这里生成，避免各处自己拼（含"外推"标注与不可回本分支）
// ⚠️ 取数走 ledger.yearly.现金流（顶层没有这个字段 —— 曾因读错路径导致"永远不适用"，守门已钉）
export function paybackText(ledger) {
  const 现金流 = ledger?.yearly?.现金流
  const 总投资 = ledger?.总投资
  if (总投资 == null) return { text: '回本周期：待补（总投资缺来源数据）', ok: false }
  if (!(现金流 > 0)) return { text: '回本周期：不适用（基准口径下年现金流为 0 或为负 —— 先改善经营再谈回本）', ok: false }
  const y = 总投资 / 现金流
  return { text: `回本周期：约 ${y.toFixed(1)} 年（外推：按基准单周年化，非实际发生）`, ok: true }
}
