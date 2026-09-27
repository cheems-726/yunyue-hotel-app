// W3-2 · 认领页「物业报价单」（P2 交互层 · W3 裁决：开工，但在 W14 之后 ✓）
//
// ★ 硬约束（任务包 §二十二·五 / B3）：本模块【只加展示】，**不改任何结算数值**
//   ⇒ 纯函数、无副作用、不被 settlement.js 引用（守门 tests/propertyQuote.test.mjs 会断言这一点）
//
// ── 设计原则（三条，都是本项目的血泪）────────────────────────────
//   ① 每个数字都要能追到【已有口径】，不新造口径：
//        房量   = parseRooms(brand.standard)        （A3：房量唯一权威，与结算同源）
//        年租金 = 房量 × rentPerRoomDay(租金档) × 365（★ A-1 起【直接引用】引擎的租金表达式，
//                不再自带一份副本 —— 原先副本是 35+档×10，A-1 改曲线时它静默漂移了）
//        费率   = src/franchiseModel.mjs 的三件套    （加盟费/保证金/单房造价/筹备费/PMS）
//   ② 缺数据一律返回「待补」（status: 'missing'），界面显示"待补" —— **不许编造**
//      （franchiseModel 目前只有 汉庭 / 汉庭快捷 两个品牌；其余品牌的经济条款 = 待补）
//   ③ 三件套随行：能追到来源的字段把 { 来源, 取数日期, 置信度 } 一起带出去，界面可 hover 展示
//
// ── 与 W3-1/W3-3 的边界（不越界）──────────────────────────────────
//   本模块【不】计算：出租率 / ADR / 年现金流 / 回收期 —— 那些需要"用哪套 ADR·OCC 口径"的拍板
//   （属 A7 教学口径），已写进待决策队列；报价单只做【投资侧】的加减乘除。
import { FRANCHISE_MODEL } from './franchiseModel.mjs'
import { parseRooms, rentPerRoomDay } from './settlement.js'

export const STATUS = { OK: 'ok', DERIVED: 'derived', MISSING: 'missing' }

// 取某品牌的经济条款（franchiseModel 是纯数据模块；没有该品牌 ⇒ null ⇒ 界面显示待补）
export function brandTerms(brandName) {
  return (brandName && FRANCHISE_MODEL[brandName]) || null
}

// 🔴 A-1：租金口径【不再在本文件定义】—— 直接复用引擎的 rentPerRoomDay（单源；此处 re-export 保持旧引用可用）
export { rentPerRoomDay }

const 待补 = (label, why) => ({ label, status: STATUS.MISSING, note: why })
const 元 = (v) => (Number.isFinite(v) ? Math.round(v) : null)

/**
 * 物业报价单（纯函数）
 * @param {{name:string, standard:string}} brand   品牌（房量取 brand.standard）
 * @param {{name:string, areaNum?:number}} property 物业
 * @param {{租金?:number}} districtAttrs            区县六维属性（租金 1-5 档）
 */
export function propertyQuote(brand, property, districtAttrs) {
  const rooms = parseRooms(brand?.standard)
  const 租金档 = districtAttrs?.租金
  const 日租 = rentPerRoomDay(租金档)
  const 年租金 = rooms ? rooms * 日租 * 365 : null
  const 面积 = Number.isFinite(property?.areaNum) ? property.areaNum : null
  // 租金单价：由引擎口径【反推】（年租金 ÷ 面积 ÷ 365）—— 标注 derived，不是独立数据源
  const 租金单价 = (面积 && 年租金) ? 年租金 / 面积 / 365 : null

  const t = brandTerms(brand?.name)
  const 单房造价 = t?.单房造价?.新建?.值 ?? null
  const 加盟费单价 = t?.加盟费?.单价?.值 ?? null
  const 加盟费下限 = t?.加盟费?.下限?.值 ?? null
  const 加盟费 = (rooms && 加盟费单价) ? Math.max(rooms * 加盟费单价, 加盟费下限 ?? 0) : null
  const 保证金 = t?.保证金?.值 ?? null
  const 筹备费 = t?.筹备费?.值 ?? null
  const 总投资 = (rooms && 单房造价) ? (rooms * 单房造价) + (加盟费 ?? 0) + (保证金 ?? 0) + (筹备费 ?? 0) : null

  const 源 = t ? { 来源: t.加盟费?.单价?.来源 || '任务包 §十七·七（转述华住官网/加盟开发手册）', 取数日期: t.加盟费?.单价?.取数日期, 置信度: t.加盟费?.单价?.置信度 } : null

  const lines = [
    { label: '建筑面积', value: 面积, unit: '㎡', fmt: 'num', status: 面积 ? STATUS.OK : STATUS.MISSING,
      note: 面积 ? '物业资料' : '该物业未提供面积数字' },
    { label: '可排房量', value: rooms, unit: '间', fmt: 'num', status: rooms ? STATUS.OK : STATUS.MISSING,
      note: 'parseRooms(品牌标准) —— 与结算同源（A3 唯一权威）' },
    { label: '租金单价', value: 租金单价, unit: '元/㎡·天', fmt: 'fixed2', status: 租金单价 ? STATUS.DERIVED : STATUS.MISSING,
      note: 租金单价 ? '由引擎租金口径反推（年租金 ÷ 面积 ÷ 365）' : '缺面积 ⇒ 无法反推' },
    { label: '年租金', value: 年租金, unit: '元/年', fmt: 'wan', status: 年租金 ? STATUS.OK : STATUS.MISSING,
      note: `引擎口径（A-1 单源）：房量 × rentPerRoomDay(租金档 ${Number.isFinite(租金档) ? 租金档 : 3}) × 365` },
    { label: '单房造价', value: 单房造价, unit: '元/间', fmt: 'wan', status: 单房造价 ? STATUS.OK : STATUS.MISSING,
      note: 单房造价 ? '新建标准（franchiseModel 三件套）' : `${brand?.name || '该品牌'} 的经济条款暂无来源数据` },
    { label: '加盟费', value: 加盟费, unit: '元', fmt: 'wan', status: 加盟费 ? STATUS.OK : STATUS.MISSING,
      note: 加盟费 ? `元/间 × 房量，且不低于下限 ${加盟费下限 ? (加盟费下限 / 10000) + ' 万' : '—'}` : '加盟费单价暂无来源数据' },
    { label: '保证金', value: 保证金, unit: '元', fmt: 'wan', status: 保证金 ? STATUS.OK : STATUS.MISSING,
      note: 保证金 ? '可退（期末返还）' : '保证金暂无来源数据' },
    { label: '筹备费', value: 筹备费, unit: '元', fmt: 'wan', status: 筹备费 ? STATUS.OK : STATUS.MISSING,
      note: 筹备费 ? '开业筹备（franchiseModel 三件套）' : '筹备费暂无来源数据' },
    { label: '总投资（估算）', value: 总投资, unit: '元', fmt: 'wan', status: 总投资 ? STATUS.DERIVED : STATUS.MISSING,
      note: 总投资 ? '单房造价 × 房量 + 加盟费 + 保证金 + 筹备费（未含装修档/软装/IT/布草——见 W3-3 待补）' : '缺单房造价 ⇒ 无法估算' },
  ]

  return {
    brand: brand?.name || null, property: property?.name || null,
    rooms, 面积, 租金档, 日租PerRoomDay: 日租, lines, sources: 源,
    missing: lines.filter(l => l.status === STATUS.MISSING).map(l => l.label),
  }
}

// 报价单的"可核验摘要"（测试与报告引用；避免各处自己挑字段）
export function quoteSummary(q) {
  const get = (label) => q.lines.find(l => l.label === label)?.value ?? null
  return {
    房量: q.rooms, 面积: q.面积,
    年租金: get('年租金'), 单房造价: get('单房造价'), 加盟费: get('加盟费'),
    保证金: get('保证金'), 总投资: get('总投资（估算）'), 待补字段: q.missing,
  }
}
