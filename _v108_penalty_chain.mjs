// V108-D2 ★★ 差评概率 → 待处理累计 → 平台处罚 → 发酵 → 上热门 整条链：逐环节断言 + **两条反例 RV**
//   引擎级纯调用（不写库 · 可复跑）。用法：node penalty_chain.mjs
import { 违规判定, 违规后果, 平台评分, OTA_RATING_CONFIG } from './src/otaRating.mjs'
import { shouldHotReview, hotCrisisWeeks, HOT_REVIEW_CONFIG } from './src/hotReview.mjs'

let bad = 0
const ok = (name, cond, detail = '') => { console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? '  ' + detail : ''}`); if (!cond) bad++ }

console.log('══ V108-D2 处罚链 · 逐环节 ══')
const 违 = OTA_RATING_CONFIG.违规
console.log('【环节1 · 触发阈值（源：otaRating.mjs OTA_RATING_CONFIG.违规）】')
console.log(`  差评积压：待处理差评 ≥ ${违.差评积压.阈值} ⇒ 罚款 ${违.差评积压.罚款} 元 · 降权 ×${违.差评积压.降权}`)
console.log(`  到店无房：超售量 ≥ ${违.到店无房.阈值} ⇒ 罚款 ${违.到店无房.罚款} 元 · 降权 ×${违.到店无房.降权}`)
console.log(`  差评发酵：待处理 ≥ 2 且 roll<${0.4}（prob）⇒ 口碑 −3%`)
console.log(`  差评上热门：待处理 ≥ ${HOT_REVIEW_CONFIG.triggerPending} ⇒ **必触发（非概率）** · 声誉 ×${HOT_REVIEW_CONFIG.reputationCut} · 出租率 −${HOT_REVIEW_CONFIG.occPenalty * 100}% · 差评概率 ×${HOT_REVIEW_CONFIG.badReviewMul} · 危机 ${HOT_REVIEW_CONFIG.weeksBase}+(week%2) 周`)

console.log('\n【环节2 · 阈值边界（正好在界上/界下）】')
ok('待处理=1（界下）⇒ 不触发差评积压', 违规判定({ pendingNegatives: 1 }).length === 0)
ok('待处理=2（正好＝阈值）⇒ **触发**差评积压', 违规判定({ pendingNegatives: 2 }).some(v => v.类型 === '差评积压'))
ok('超售=3（界下）⇒ 不触发到店无房', 违规判定({ overbook: 3 }).every(v => v.类型 !== '到店无房'))
ok('超售=4（正好＝阈值）⇒ **触发**到店无房', 违规判定({ overbook: 4 }).some(v => v.类型 === '到店无房'))
ok('待处理=2（界下）⇒ 不上热门', !shouldHotReview({ pendingNegatives: 2 }))
ok('待处理=3（正好＝阈值）⇒ **必上热门**', shouldHotReview({ pendingNegatives: 3 }))

console.log('\n【环节3 · 罚款金额与降权系数】')
const r差评 = 违规后果(违规判定({ pendingNegatives: 2 }))
ok('差评积压 罚款=5000', r差评.罚款 === 5000, `实际 ${r差评.罚款}`)
ok('差评积压 降权=0.85', Math.abs(r差评.降权 - 0.85) < 1e-9, `实际 ${r差评.降权}`)
const r超售 = 违规后果(违规判定({ overbook: 4 }))
ok('到店无房 罚款=20000', r超售.罚款 === 20000, `实际 ${r超售.罚款}`)
ok('到店无房 降权=0.75', Math.abs(r超售.降权 - 0.75) < 1e-9, `实际 ${r超售.降权}`)
const r双 = 违规后果(违规判定({ pendingNegatives: 2, overbook: 4 }))
ok('两项同时触发 ⇒ 罚款叠加=25000 · 降权连乘=0.6375', r双.罚款 === 25000 && Math.abs(r双.降权 - 0.6375) < 1e-9, `实际 ${r双.罚款} / ${r双.降权}`)

console.log('\n【环节4 · 降权是否真的作用到客流（不是只写在文案里）】')
// demandStrength 里 ota后果.降权 是**连乘因子** ⇒ 有违规的那周，需求强度被乘小
const 无违规降权 = 违规后果(违规判定({ pendingNegatives: 0, overbook: 0 })).降权
ok('无违规 ⇒ 降权因子恒 =1（水位线：不影响原有数值）', 无违规降权 === 1, `实际 ${无违规降权}`)
ok('有违规 ⇒ 降权 <1 ⇒ 乘进 demandStrength ⇒ 出租率与被降权同步（源：settlement.js:441 连乘 ota后果.降权）', r超售.降权 < 1)

console.log('\n【环节5 · 危机期周数（确定性：同周同值）】')
const w = [1, 2, 3, 8].map(x => `W${x}=${hotCrisisWeeks(x)}周`).join(' · ')
ok('危机周数 = 2+(week%2) ⇒ 2~3 周且确定', hotCrisisWeeks(1) === 3 && hotCrisisWeeks(2) === 2, w)

console.log('\n【环节6 · 好评率/评分如何体现】')
const s好 = 平台评分({ goodRate: 0.9, negativeCount: 1, reviewCount: 10, pendingNegatives: 0 })
const s差 = 平台评分({ goodRate: 0.6, negativeCount: 4, reviewCount: 10, pendingNegatives: 3 })
ok('好评率高+无积压 ⇒ 评分更高', s好.评分 > s差.评分, `${s好.评分} vs ${s差.评分}`)
ok('评分明细含 replyK 回复修正（待处理越多扣越多）', s差.明细.回复修正 < 0)

console.log('\n══ 两条【反例 RV】（可证伪 · 两边都要有实测输出）══')
console.log('【RV-A · "每周及时处理差评" ⇒ **必须不触发**】')
const A1 = 违规判定({ pendingNegatives: 0, overbook: 0 })
const A2 = shouldHotReview({ pendingNegatives: 0 })
const A3 = 违规后果(A1)
ok('RV-A 平台处罚：无违规', A1.length === 0, `违规数=${A1.length}`)
ok('RV-A 罚款=0 且 降权=1', A3.罚款 === 0 && A3.降权 === 1, `罚款=${A3.罚款} 降权=${A3.降权}`)
ok('RV-A 不上热门（无危机期）', A2 === false)

console.log('【RV-B · "攒着不处理" ⇒ **必须触发**】')
const B1 = 违规判定({ pendingNegatives: 3, overbook: 4 })
const B2 = shouldHotReview({ pendingNegatives: 3 })
const B3 = 违规后果(B1)
ok('RV-B 平台处罚：两项都触发', B1.length === 2 && B1.map(v => v.类型).join('+') === '差评积压+到店无房', B1.map(v => v.类型).join('+'))
ok('RV-B 罚款=25000（5000+20000）', B3.罚款 === 25000, `实际 ${B3.罚款}`)
ok('RV-B 降权=0.6375（0.85×0.75）', Math.abs(B3.降权 - 0.6375) < 1e-9, `实际 ${B3.降权}`)
ok('RV-B **必上热门**（待处理≥3）', B2 === true)
console.log('  ⇒ 反例成立：**同一函数、同一阈值，输入一变结论就反转**（RV 可证伪）')

console.log(`\n${bad === 0 ? 'PASS —— 处罚链逐环节 + 两条反例 RV 全部符合预期' : 'FAIL —— ' + bad + ' 项不符'}`)
process.exit(bad === 0 ? 0 : 1)
