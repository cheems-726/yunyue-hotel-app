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

// §16.2-B1：把品牌【真的声明过的】物业门槛渲染成报价单行（各家表述不同 ⇒ 逐项按存在性生成）
//   ★ 一项都没有 ⇒ 只出一行「品牌物业门槛 · 待补」（而不是伪造四五种"缺项"）
function 门槛行(门槛, 品牌名) {
  const out = []
  const 出 = (label, 值, unit, fmt, note) => out.push({ label, value: 值, unit, fmt, status: STATUS.OK, note })
  if (门槛?.最少房量) 出('品牌最少房量', 门槛.最少房量.值, '间', 'num', `品牌方要求 ≥${门槛.最少房量.值} 间（${门槛.最少房量.来源}）`)
  // 区间类统一转成【展示字符串】（值 "60–200" + 单位 间）—— 渲染层不认数组，直接给数组会渲染成 "60,200"
  if (门槛?.房量区间) 出('品牌房量区间', `${门槛.房量区间.值[0]}–${门槛.房量区间.值[1]}`, '间', 'num', `品牌方要求 ${门槛.房量区间.值[0]}–${门槛.房量区间.值[1]} 间（${门槛.房量区间.来源}）`)
  if (门槛?.建筑面积下限) 出('品牌面积下限', 门槛.建筑面积下限.值, '㎡', 'num', `品牌方要求 ≥${门槛.建筑面积下限.值} ㎡（${门槛.建筑面积下限.来源}）`)
  if (门槛?.建筑面积区间) 出('品牌面积区间', `${门槛.建筑面积区间.值[0]}–${门槛.建筑面积区间.值[1]}`, '㎡', 'num', `品牌方要求 ${门槛.建筑面积区间.值[0]}–${门槛.建筑面积区间.值[1]} ㎡（${门槛.建筑面积区间.来源}）`)
  if (门槛?.城市限定) 出('城市限定', 门槛.城市限定.值, '', 'text', `品牌方原文：${门槛.城市限定.值}（${门槛.城市限定.来源}）`)
  if (out.length === 0) out.push(待补('品牌物业门槛', `${品牌名 || '该品牌'} 的房量/面积门槛暂无来源数据`))
  return out
}

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
  const 门槛 = t?.物业门槛 ?? null          // §16.2-B1：品牌方物业门槛（房量/面积/城市限定）
  const 单房造价 = t?.单房造价?.新建?.值 ?? null
  const 加盟费单价 = t?.加盟费?.单价?.值 ?? null
  const 加盟费下限 = t?.加盟费?.下限?.值 ?? null
  const 加盟费 = (rooms && 加盟费单价) ? Math.max(rooms * 加盟费单价, 加盟费下限 ?? 0) : null
  const 保证金 = t?.保证金?.值 ?? null
  const 筹备费 = t?.筹备费?.值 ?? null
  const 总投资 = (rooms && 单房造价) ? (rooms * 单房造价) + (加盟费 ?? 0) + (保证金 ?? 0) + (筹备费 ?? 0) : null

  // ★ §16.2-B1（2026-09-28）：总投资是【四项之和】——但半接入品牌只有造价一项有来源。
  //   原先那句 note 一律写"单房造价×房量 + 加盟费 + 保证金 + 筹备费"，对缺项品牌会**读成四项都算进去了**
  //   （那就是"空位填了≠填的是真的"的同族）。⇒ 这里逐项点名：算进去的 / 待补的，写在口径里。
  const 四项 = [
    { 名: '单房造价×房量', 值: (rooms && 单房造价) ? rooms * 单房造价 : null },
    { 名: '加盟费', 值: 加盟费 },
    { 名: '保证金', 值: 保证金 },
    { 名: '筹备费', 值: 筹备费 },
  ]
  const 已计入 = 四项.filter(x => x.值 != null).map(x => x.名)
  const 未计入待补 = 四项.filter(x => x.值 == null).map(x => x.名)
  const 总投资口径 = 总投资 == null ? null
    : (未计入待补.length === 0
      ? `= ${已计入.join(' + ')}（四项齐全）`
      : `= ${已计入.join(' + ')}；★ ${未计入待补.join('、')} **无来源 ⇒ 未计入**（总投资被低估，不是"就这么多"）`)

  const 源 = t ? (() => {
    // 三件套随行：优先取【加盟费】的来源；半接入品牌没有加盟费 ⇒ 退到【单房造价】；再退到【物业门槛】
    const c = t.加盟费?.单价 || t.单房造价?.新建 || t.物业门槛?.最少房量 || t.物业门槛?.建筑面积下限
    return c ? { 来源: c.来源, 取数日期: c.取数日期, 置信度: c.置信度 } : null
  })() : null

  const lines = [
    { label: '建筑面积', value: 面积, unit: '㎡', fmt: 'num', status: 面积 ? STATUS.OK : STATUS.MISSING,
      note: 面积 ? '物业资料' : '该物业未提供面积数字' },
    { label: '可排房量', value: rooms, unit: '间', fmt: 'num', status: rooms ? STATUS.OK : STATUS.MISSING,
      note: 'parseRooms(品牌标准) —— 与结算同源（A3 唯一权威）' },
    { label: '租金单价', value: 租金单价, unit: '元/㎡·天', fmt: 'fixed2', status: 租金单价 ? STATUS.DERIVED : STATUS.MISSING,
      note: 租金单价 ? '由引擎租金口径反推（年租金 ÷ 面积 ÷ 365）' : '缺面积 ⇒ 无法反推' },
    { label: '年租金', value: 年租金, unit: '元/年', fmt: 'wan', status: 年租金 ? STATUS.OK : STATUS.MISSING,
      note: `引擎口径（A-1 单源）：房量 × rentPerRoomDay(租金档 ${Number.isFinite(租金档) ? 租金档 : 3}) × 365` },
    // ★ §16.2-B1（2026-09-28）：物业门槛进报价单 —— 学生要能自己核对"这个物业够不够开这个品牌"。
    //   ★ 只列【该品牌真的声明过的】门槛项 —— 不许把"品牌没这么写"渲染成"待补"
    //     （各家用不同表述：汉庭/全季写"面积区间"，桔子/CitiGO 写"面积下限"，你好写"房量区间"）
    ...门槛行(门槛, brand?.name),
    { label: '单房造价', value: 单房造价, unit: '元/间', fmt: 'wan', status: 单房造价 ? STATUS.OK : STATUS.MISSING,
      note: 单房造价 ? '新建标准（franchiseModel 三件套）' : `${brand?.name || '该品牌'} 的经济条款暂无来源数据` },
    { label: '加盟费', value: 加盟费, unit: '元', fmt: 'wan', status: 加盟费 ? STATUS.OK : STATUS.MISSING,
      note: 加盟费 ? `元/间 × 房量，且不低于下限 ${加盟费下限 ? (加盟费下限 / 10000) + ' 万' : '—'}` : '加盟费单价暂无来源数据' },
    { label: '保证金', value: 保证金, unit: '元', fmt: 'wan', status: 保证金 ? STATUS.OK : STATUS.MISSING,
      note: 保证金 ? '可退（期末返还）' : '保证金暂无来源数据' },
    { label: '筹备费', value: 筹备费, unit: '元', fmt: 'wan', status: 筹备费 ? STATUS.OK : STATUS.MISSING,
      note: 筹备费 ? '开业筹备（franchiseModel 三件套）' : '筹备费暂无来源数据' },
    { label: '总投资（估算）', value: 总投资, unit: '元', fmt: 'wan', status: 总投资 ? STATUS.DERIVED : STATUS.MISSING,
      note: 总投资
        ? `投资侧口径 ${总投资口径}（未含装修档/软装/IT/布草——见 W3-3 待补）`
        : '缺单房造价 ⇒ 无法估算' },
  ]

  // 门槛核对（能核就核，不能核就明说缺哪边 —— 不猜）
  const 门禁核对 = (() => {
    const 项 = []
    if (门槛?.最少房量 && rooms) 项.push({ 项: '房量 ≥ 最少房量', 过: rooms >= 门槛.最少房量.值, 实: `${rooms} 间`, 要求: `≥${门槛.最少房量.值} 间` })
    if (门槛?.房量区间 && rooms) 项.push({ 项: '房量落在区间内', 过: rooms >= 门槛.房量区间.值[0] && rooms <= 门槛.房量区间.值[1], 实: `${rooms} 间`, 要求: `${门槛.房量区间.值[0]}–${门槛.房量区间.值[1]} 间` })
    if (门槛?.建筑面积下限 && 面积) 项.push({ 项: '面积 ≥ 面积下限', 过: 面积 >= 门槛.建筑面积下限.值, 实: `${面积} ㎡`, 要求: `≥${门槛.建筑面积下限.值} ㎡` })
    return { 项, 全部通过: 项.length > 0 && 项.every(x => x.过), 可核对: 项.length }
  })()

  return {
    brand: brand?.name || null, property: property?.name || null,
    rooms, 面积, 租金档, 日租PerRoomDay: 日租, lines, sources: 源,
    总投资口径, 门禁核对,
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
    总投资口径: q.总投资口径,          // §16.2-B1：算进去的 / 未计入待补的，逐项点名
    来源: q.sources?.来源 ?? null, 置信度: q.sources?.置信度 ?? null,
  }
}
