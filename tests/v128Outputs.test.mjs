// V128-#2 · V118 四个出口的行为验收（注入 + 应对 ⇒ 只在这四个出口上产生差异）
// 运行：node tests/v128Outputs.test.mjs   （挂 run-all fast）
//
// 判据（卡 §2）：
//   ① E7 涨薪/加福利 ⇒ 变动成本 +8000（元·总额）且士气不跌；冷处理/离线 ⇒ 士气 −10
//   ② E3 立即整改 vs 停房深清洁 ⇒ 品质 −4 vs −8、声誉 −2.5 vs −5（属性池取整）
//   ③ 同周 E3+E7 都触发 ⇒ 两个出口叠加，不互相覆盖
//   ④ 无注入 / 有注入但无应对 ⇒ 数值与改前一致（改前逐字节由 _v128-before-after.mjs 证）
//   ⑤ 差异只出现在四个出口及其派生金额字段（营收/出租率/部门成本逐字节相同）
import { settle } from '../src/settlement.js'
import { decisions } from '../src/decisions.js'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const DEC = (() => {
  const o = {}
  for (const d of decisions) {
    if (d.type === 'option' || d.type === 'timer') o[d.id] = d.options[0].label
    else if (d.type === 'slider') o[d.id] = d.min ?? 0
    else if (d.type === 'budget') {
      const a = Math.floor(d.total / d.items.length)
      o[d.id] = Object.fromEntries(d.items.map((it, i) => [it, a + (i === 0 ? d.total - a * d.items.length : 0)]))
    } else if (d.type === 'sort') o[d.id] = [...d.items]
  }
  return o
})()
const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2, district: '锦江区' }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const ATTR = { quality: 60, reputation: 70, morale: 65 }
const BASE = { site: SITE, brand: BRAND, decisions: DEC, week: 1, attrs: ATTR, prevCapital: 1490000, bizMode: 'direct' }
const E7 = { week: 1, source: 'teacher', 来源事件: 'E7', name: '📌 老师注入 · 员工集体请辞威胁', text: 'x' }
const E3 = { week: 1, source: 'teacher', 来源事件: 'E3', name: '📌 老师注入 · 卫生突检', text: 'y' }
const 算 = (注入, 应对) => settle({ ...BASE, injectedEvents: 注入 || null, eventResponses: 应对 || null })

console.log('▶ V128-#2 · V118 四出口')

console.log('\n[①] E7：涨薪 vs 冷处理')
{
  const 冷 = 算([E7], { E7: '冷处理' })
  const 涨 = 算([E7], { E7: '涨薪' })
  const 福利 = 算([E7], { E7: '加福利' })
  ok(冷.attrsAfter.morale === 涨.attrsAfter.morale - 10, `冷处理比涨薪多扣 10 士气（${冷.attrsAfter.morale} vs ${涨.attrsAfter.morale}）`)
  ok(涨.attrsAfter.morale === 福利.attrsAfter.morale, '涨薪与加福利士气一致（都不跌）')
  ok(冷.profit - 涨.profit === 8000, `涨薪本周多花 8000（利润差 ${冷.profit - 涨.profit}）`)
  ok(涨.weeklyExpenses['客房变动成本'] - 冷.weeklyExpenses['客房变动成本'] === 8000, '★ 变动成本出口：客房变动成本 +8000（元·总额）')
  ok(冷.revenue === 涨.revenue && 冷.occupancy === 涨.occupancy && 冷.deptCost === 涨.deptCost, '非成本链（营收/出租率/部门成本）不变')
}

console.log('\n[②] E3：立即整改 vs 停房深清洁')
{
  const 立即 = 算([E3], { E3: '立即整改' })
  const 停房 = 算([E3], { E3: '停房深清洁' })
  ok(立即.attrsAfter.quality - 停房.attrsAfter.quality === 4, `立即整改比停房品质高 4（${立即.attrsAfter.quality} vs ${停房.attrsAfter.quality}）`)
  const dr = 立即.attrsAfter.reputation - 停房.attrsAfter.reputation
  ok(dr >= 2 && dr <= 3, `声誉差 = 2.5（属性池取整后 ${dr}）`)
  ok(立即.profit === 停房.profit && 立即.revenue === 停房.revenue, '两种应对不影响钱（成本/营收逐字节相同）')
  ok(JSON.stringify(立即.dailySnapshots) === JSON.stringify(停房.dailySnapshots), '日快照逐字节相同（只有属性不同）')
}

console.log('\n[③] 同周 E3+E7：叠加不覆盖')
{
  const 双 = 算([E3, E7], { E3: '立即整改', E7: '涨薪' })
  const 单E3 = 算([E3], { E3: '立即整改' })
  const 单E7 = 算([E7], { E7: '涨薪' })
  ok(双.attrsAfter.quality === 单E3.attrsAfter.quality, 'E3 品质 delta 不被 E7 覆盖')
  ok(双.attrsAfter.morale === 单E7.attrsAfter.morale, 'E7 士气 delta 不被 E3 覆盖')
  ok(双.profit === 单E7.profit, 'E7 成本加仍在（E3 不影响钱）')
}

console.log('\n[④⑤] 无注入 / 无应对 / 无关事件 ⇒ 不生效')
{
  const 无 = 算(null, null)
  ok(JSON.stringify(算(null, { E7: '涨薪' })) === JSON.stringify(无), '无注入时，即使带应对也不产生任何变化（逐字节）')
  const 无应对 = 算([E7], null)
  const 冷 = 算([E7], { E7: '冷处理' })
  ok(无应对.attrsAfter.morale === 冷.attrsAfter.morale && 无应对.profit === 冷.profit, '有注入但无应对 ⇒ 按改前口径（士气 −10），数值与冷处理一致')
  const 无关 = 算([E3], { E7: '涨薪' })
  ok(无关.profit === 算([E3], null).profit, '★ 只注入 E3 时，E7 的涨薪应对不得加 8000')
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
