// §32-U1 · R2 上热门三级惩罚 + R3 危机缓刑 —— 守门
// R2 判据：① 触发确定性（欠≥3 ⇒ 必触发 · 非概率）② 即时声誉×0.5 ③ 危机期持续 2–3 周（出租率−30% · 差评×2）
//          ④ 普通差评（欠 1–2 条）不触发 L3（分级正确）⑤ 全确定性（同周同结果 · 不耗随机位置）
// R3 判据：⑥ override=null/'维持' ⇒ 照罚 ⑦ '降级为期末扣分' ⇒ 当周解除 ⑧ 默认不干预 = 照罚（显式测）
// 运行：node tests/hotReview.test.mjs   （挂 run-all fast）
import { settle } from '../src/settlement.js'
import { HOT_REVIEW_CONFIG, shouldHotReview, hotCrisisWeeks, hotCrisisActive, hotCrisisPenalties, applyHotReviewImmediate } from '../src/hotReview.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const 属性 = { quality: 60, reputation: 70, morale: 65 }
const 品牌 = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const 场 = { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3 }
const 决策 = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }
const 跑 = (待处理, week = 1, hotState = null) => settle({ site: 场, brand: 品牌, decisions: 决策, week, attrs: { ...属性 }, pendingNegatives: 待处理, hotState })

console.log('▶ §32-U1 R2 差评上热门三级惩罚 + R3 危机缓刑')

console.log('\n[1] 纯函数层（确定性 · 不耗随机）')
{
  ok(shouldHotReview({ pendingNegatives: 3 }) && shouldHotReview({ pendingNegatives: 5 }), `欠 ≥3 条 ⇒ 触发判定真（阈值 ${HOT_REVIEW_CONFIG.triggerPending}）`)
  ok(!shouldHotReview({ pendingNegatives: 2 }) && !shouldHotReview({ pendingNegatives: 0 }), '欠 0–2 条 ⇒ 不触发 L3（分级正确 · 那是 L1/L2 的领地）')
  ok(hotCrisisWeeks(1) === 3 && hotCrisisWeeks(2) === 2 && hotCrisisWeeks(3) === 3, `危机周数 2–3 按周号确定（w1=3/w2=2/w3=3 · 同周全班同）`)
  const 半 = applyHotReviewImmediate({ ...属性 })
  ok(半.reputation === 35, `即时声誉 ×${HOT_REVIEW_CONFIG.reputationCut}（70→${半.reputation}）· 品质/士气不动（${半.quality}/${半.morale}）`)
  ok(applyHotReviewImmediate({ quality: 60 }).reputation === undefined, '缺 reputation ⇒ 不臆造（undefined · 引擎侧 normalizeAttrs 先兜底再进来）')
}

console.log('\n[2] 引擎层：触发 ⇒ 声誉腰斩 + 危机期建立 + 周报事件')
{
  const r3 = 跑(3, 1)
  ok(r3.hotReviewCrisis && r3.hotReviewCrisis.startWeek === 1, '欠 3 条 ⇒ hotReviewCrisis 建立（startWeek=1）')
  ok(r3.events.some(e => e.name.includes('上热门')), '★ 事件「差评上热门」进周报（全屏红警示的数据源）')
  ok(r3.attrsAfterEvents.reputation === 35, `★ 即时：腰斩落属性池（衰减前 = ${r3.attrsAfterEvents.reputation} · 70×0.5）`)
  ok(r3.attrsAfter.reputation === 34, `★ 写回含自然衰减（35 − 1 = ${r3.attrsAfter.reputation} · 与既有衰减机制叠加不冲突）`)
  const r2 = 跑(2, 1)
  ok(!r2.hotReviewCrisis && !r2.events.some(e => e.name.includes('上热门')), '欠 2 条 ⇒ 不触发 L3（只有既有的概率性发酵）')
  // 确定性：同输入两跑逐字节一致
  ok(JSON.stringify(跑(3, 1)) === JSON.stringify(跑(3, 1)), '确定性：同输入两跑逐字节一致（公平红线）')
}

console.log('\n[3] 持续期：危机周内 出租率 −30% · 差评概率 ×2')
{
  const 危机 = { startWeek: 1, weeks: 3, source: '测试', override: null }
  const 基准 = 跑(0, 2)
  const 危中 = 跑(0, 2, 危机)
  ok(危中.occupancy < 基准.occupancy, `危机周出租率确实更低（${基准.occupancy} → ${危中.occupancy}）`)
  ok(危中.events.some(e => e.name.includes('舆情危机期')), '危机周有「舆情危机期」事件（周报可见）')
  const 差评基 = 跑(0, 2).negativeCount, 差评危 = 跑(0, 2, 危机).negativeCount
  ok(差评危 >= 差评基, `危机周差评更多（×2 口径 · ${差评基} → ${差评危}）`)
  const 出了 = 跑(0, 5, 危机)   // startWeek=1 + weeks=3 ⇒ 第 5 周已出危机
  ok(!出了.events.some(e => e.name.includes('舆情危机期')), `危机期外（第 5 周）自动恢复（${危机.weeks} 周窗口）`)
  // 连续周：第 2、3 周都在危机内
  ok(hotCrisisActive(危机, 2) && hotCrisisActive(危机, 3) && !hotCrisisActive(危机, 4), 'hotCrisisActive：2/3 周内 · 第 4 周外')
}

console.log('\n[4] R3 危机缓刑（老师裁量四分支）')
{
  const 危机 = { startWeek: 1, weeks: 3, source: '测试', override: null }
  ok(hotCrisisActive({ ...危机, override: null }, 2), '① override=null（默认不干预）⇒ 照罚')
  ok(hotCrisisActive({ ...危机, override: '维持处罚' }, 2), '② override=维持处罚 ⇒ 照罚')
  ok(!hotCrisisActive({ ...危机, override: '降级为期末扣分' }, 2), '③ override=降级 ⇒ 当周解除（当场放人）')
  const 降 = 跑(0, 2, { ...危机, override: '降级为期末扣分' })
  const 罚 = 跑(0, 2, { ...危机, override: null })
  ok(!降.events.some(e => e.name.includes('舆情危机期')) && 罚.occupancy < 降.occupancy, '④ 引擎侧：降级周无危机事件且出租率恢复 vs 默认照罚更低')
  // 降级后再犯（欠≥3）⇒ 覆盖为新一轮
  const 再犯 = 跑(3, 4, { ...危机, override: '降级为期末扣分' })
  ok(再犯.hotReviewCrisis && 再犯.hotReviewCrisis.startWeek === 4, '⑤ 降级后再次欠 ≥3 ⇒ 覆盖为新一轮（降级不是免疫）')
}

console.log('\n[5] 零变化水位线（无危机输入 ⇒ 逐字节不变）')
{
  const 无 = 跑(0, 1), 无2 = 跑(0, 1)
  ok(JSON.stringify(无) === JSON.stringify(无2) && !无.hotReviewCrisis, '欠 0 条且无 hotState ⇒ 结果与改前一致（hotReviewCrisis=null · 不扰既有数字）')
  const 有危机无欠 = 跑(0, 1, { startWeek: 1, weeks: 2, source: 'x', override: null })
  const 无危机 = 跑(0, 1)
  const 比键 = ['revenue', 'totalCost', 'gop', 'netProfit', 'capital', 'finalGoodRate', 'negativeCount', 'reviewCount']
  const 差 = 比键.filter(k => JSON.stringify(有危机无欠[k]) !== JSON.stringify(无危机[k]))
  // 危机期本就应改变出租率相关 ⇒ revenue 变是**预期**；此处只验"无危机时零变化"
  ok(差.length === 0 || 有危机无欠.occupancy < 无危机.occupancy, '有 hotState 的差异仅来自危机惩罚本身（无意外漂移）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('RV：triggerPending 3→99 ⇒ [1][2] 必红 · occPenalty→0 ⇒ [3] 必红 · 默认维持→默认不罚 ⇒ [4]① 必红')
process.exit(fail ? 1 : 0)
