// §22.4-③ · 参数敏感性分析（教学解释用 · **不改任何默认值**）
//
// 做法：对 18 项决策 / 6 维属性做【单因素扫描】—— 每次只改一个因素、其余全保持基准，
//       量出"它对 出租率/利润 的影响幅度" ⇒ 产出"关键决策点"表（供老师讲课抓重点）。
// ★ 只读扫描：引擎一个字节不动；输出纯报告。
import { settle } from '../src/settlement.js'

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2, district: '锦江区' }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const BASE_DEC = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', energy: 23, overbook: 2, 'member-threshold': 5 }
const BASE_ATTRS = { quality: 60, reputation: 70, morale: 65, 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const WEEK = 5   // 取中间周（避开 week1 开业费与 week12 退款的特殊周）

const 跑 = (dec = BASE_DEC, attrs = BASE_ATTRS, site = SITE) => {
  const r = settle({ site, brand: BRAND, decisions: dec, week: WEEK, attrs })
  return { rev: r.revenue, profit: r.netProfit, occ: r.occupancy }
}
const 基 = 跑()

// ── ① 决策选项扫描：每项决策的每个选项（相对基准）───────────────────
// 选项集（取 decisions 的实际选项文案；slider 给两端与基准）
const 变体 = {
  pricing: ['降价 20% 抢客', '跟降 10%', '不跟降'],
  shifts: ['精简省成本', '满编保服务'],
  hygiene: ['不停房', '停房深清洁'],
  linen: ['外包', '自洗'],
  'hr-optimize': ['裁员1人', '全员培训'],
  'member-convert': ['强调优惠', '强调品质'],
  reputation: ['不理会', '模板回复', '道歉+赔偿'],
  energy: [20, 23, 26],
  overbook: [0, 2, 5],
}
console.log('▶ §22.4-③ 参数敏感性分析（单因素扫描 · 不改任何默认值）\n')
console.log('基准：全季 80 间 · 锦江区 · week' + WEEK + ' ⇒ 营收 ' + 基.rev + ' · 净利 ' + 基.profit + ' · 出租率 ' + 基.occ + '%\n')
console.log('## 决策敏感性（每行 = 该项决策换成某选项后，相对基准的变化）\n')
console.log('| 决策 | 选项 | 营收 Δ | 净利 Δ | 出租率 Δ |')
console.log('|---|---|---|---|---|')
for (const [id, opts] of Object.entries(变体)) {
  for (const v of opts) {
    if (BASE_DEC[id] === v) continue
    const r = 跑({ ...BASE_DEC, [id]: v })
    console.log(`| ${id} | ${JSON.stringify(v)} | ${r.rev - 基.rev >= 0 ? '+' : ''}${r.rev - 基.rev} | ${r.profit - 基.profit >= 0 ? '+' : ''}${r.profit - 基.profit} | ${r.occ - 基.occ >= 0 ? '+' : ''}${r.occ - 基.occ}pp |`)
  }
}

// ── ② 属性扫描：六维 1–5 档（相对基准档）──────────────────────────
console.log('\n## 选址属性敏感性（六维 1↔5 档）\n')
console.log('| 属性 | 扫描 | 营收 Δ | 净利 Δ | 出租率 Δ |')
console.log('|---|---|---|---|---|')
for (const k of ['客流', '房价', '租金', '竞争', '人力', '波动']) {
  for (const v of [1, 5]) {
    if (BASE_ATTRS[k] === v) continue
    // ★ 六维在【site】不在 attrs（侦察：settlement 从 site.attrs/district 取）⇒ 扫描改 site
    const r = 跑(BASE_DEC, BASE_ATTRS, { ...SITE, [k]: v })
    console.log(`| ${k} | ${BASE_ATTRS[k]}→${v} | ${r.rev - 基.rev >= 0 ? '+' : ''}${r.rev - 基.rev} | ${r.profit - 基.profit >= 0 ? '+' : ''}${r.profit - 基.profit} | ${r.occ - 基.occ >= 0 ? '+' : ''}${r.occ - 基.occ}pp |`)
  }
}
console.log('\n★ 口径：单因素扫描（其余全保持基准）· 全季 80 间 · week' + WEEK + ' · 引擎实收 · 未改任何默认值')
