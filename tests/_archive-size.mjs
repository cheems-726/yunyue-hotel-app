// N-10 · 存档体积实测（真实引擎产出，不是合成 fixture）
// 运行：node tests/_archive-size.mjs
//
// 为什么另测一遍：cloudMigration 里用的是【合成行】(mkHist)；本脚本用【真引擎跑出的 18 周 history】测，
//   含 weeklyExpenses / dailySnapshots(7) / generatedReviews / handleStats 等真实字段 ⇒ 数字更贴线上。
// 判据（D30 附加要求）：单档 > 500KB 才需要考虑只保留本周 ⇒ 本脚本只测量、不改策略。
import { settle } from '../src/settlement.js'
import { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } from '../src/attrs.js'
import { decisions as DEC_CATALOG } from '../src/decisions.js'
import { withScaleVersion } from '../src/stateMigration.mjs'

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2, district: '锦江区' }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const DEC = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }

function run(weeks) {
  let attrs = { ...ATTR_INIT }, pg = null, cap = 1490000, pn = 0, rs = 0
  const history = []
  for (let w = 1; w <= weeks; w++) {
    let a = attrs
    for (const [id, ans] of Object.entries(DEC)) a = applyDecisionToAttrs(a, id, ans)
    const r = settle({ site: SITE, brand: BRAND, decisions: DEC, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
    r.handleStats = { pending: pn, resolved: rs }
    history.push(r)
    pg = r.finalGoodRate; cap = r.capital
    const neg = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
    rs = Math.ceil(neg * 0.5); pn = Math.max(0, pn + neg - rs)
    attrs = normalizeAttrs(r.attrsAfter)
  }
  return history
}

const size = (h) => Buffer.byteLength(JSON.stringify(withScaleVersion({ capital: 1490000, history: h, attrs: { ...ATTR_INIT }, scaleVersion: 3 })), 'utf8')
const 周 = [4, 12, 18]
console.log('▶ N-10 · 存档体积实测（真引擎产出 · 锦江区真实链路）')
console.log('   周数 | 含日快照存档 | 单周增量')
let prev = 0
for (const w of 周) {
  const h = run(w)
  const s = size(h)
  console.log(`   ${String(w).padStart(3)} 周 | ${(s / 1024).toFixed(1).padStart(6)} KB | ${w === 4 ? '—' : ((s - prev) / (w - (w === 12 ? 4 : 12)) / 1024).toFixed(1) + ' KB/周'}`)
  prev = s
}
const 十八 = size(run(18))
console.log(`\n   判据：单档 > 500 KB 才需考虑"只保留本周"（D30 附加要求）`)
console.log(`   实测 18 周 = ${(十八 / 1024).toFixed(1)} KB ⇒ ${十八 < 500 * 1024 ? '远低于阈值，D30「保持持久化」成立 ✅' : '★ 超阈值，需出方案'}`)
console.log(`   （另：cloudMigration 套件用合成行测得 12 周 14.8 KB / 外推 18 周 22.3 KB —— 本脚本数字更大，因为含真实评价与日快照全字段）`)
