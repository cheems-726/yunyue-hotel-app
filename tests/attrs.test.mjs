// 3-A 自测：src/attrs.js 纯函数行为验证（不接 UI、不碰 DOM）
// 运行：node tests/attrs.test.mjs
import {
  ATTR_INIT, ATTR_MIN, ATTR_MAX, tierOf, tierDecay, tierMultiplier,
  normalizeAttrs, applyDecisionToAttrs, applyEventToAttrs, applyWeeklyDecay, qualityOf,
  attrsComposite, attrsToTitle,
} from '../src/attrs.js'
import { TITLES } from '../src/hotelTitle.js'
import { decisions } from '../src/decisions.js'

let pass = 0, fail = 0
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}  ${extra}`) }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

console.log('▶ 初始值')
ok('ATTR_INIT = {60,70,65}', eq(ATTR_INIT, { quality: 60, reputation: 70, morale: 65 }))
ok('上限100 / 下限20', ATTR_MAX === 100 && ATTR_MIN === 20)

console.log('\n▶ 档位判断（含"中高档"必须先于"高档"的坑）')
ok("'经济型 · 国民' → economy", tierOf('经济型 · 国民') === 'economy')
ok("'中档' → mid", tierOf('中档') === 'mid')
ok("'精选 · 中高档' → upperMid（不被高档吃掉）", tierOf('精选 · 中高档') === 'upperMid', tierOf('精选 · 中高档'))
ok("'中高档' → upperMid", tierOf('中高档') === 'upperMid')
ok("'高档' → upscale", tierOf('高档') === 'upscale')
ok("'奢华' → luxury", tierOf('奢华') === 'luxury')
ok('空/未知 → mid 兜底', tierOf('') === 'mid' && tierOf(undefined) === 'mid')

console.log('\n▶ 衰减值与放大系数（规格 §2.4）')
ok('经济型衰减 -3', tierDecay('经济型 · 国民') === 3)
ok('中档型衰减 -2', tierDecay('中档') === 2)
ok('中高档衰减 -2', tierDecay('精选 · 中高档') === 2)
ok('高档型衰减 -1', tierDecay('高档') === 1)
ok('奢华型衰减 -1', tierDecay('奢华') === 1)
ok('放大系数 0.8/1.0/1.2/1.4/1.6',
  tierMultiplier('经济型 · 国民') === 0.8 && tierMultiplier('中档') === 1.0 &&
  tierMultiplier('精选 · 中高档') === 1.2 && tierMultiplier('高档') === 1.4 && tierMultiplier('奢华') === 1.6)

console.log('\n▶ 验收用例：客房质检 60 → 65')
const afterQC = applyDecisionToAttrs(ATTR_INIT, 'quality-check', ['隔音', '卫生', '床品', '卫生间', '空调'])
ok('quality 60 → 65', afterQC.quality === 65, `got ${afterQC.quality}`)
ok('返回新对象（不可变，原对象未变）', ATTR_INIT.quality === 60)
ok('未提交（空答案）不变化', applyDecisionToAttrs(ATTR_INIT, 'quality-check', []).quality === 60)

console.log('\n▶ 决策表逐条（规格 §2.2 / §3.2 / §4.2）')
ok('改造投资·投150万 → quality +15', applyDecisionToAttrs(ATTR_INIT, 'renovation', '投150万改造').quality === 75)
ok('改造投资·不投 → quality -2', applyDecisionToAttrs(ATTR_INIT, 'renovation', '不投').quality === 58)
const hyg = applyDecisionToAttrs(ATTR_INIT, 'hygiene', '停房深清洁')
ok('卫生计划·停房深清洁 → quality+4 / rep+2', hyg.quality === 64 && hyg.reputation === 72)
const hyg2 = applyDecisionToAttrs(ATTR_INIT, 'hygiene', '不停房')
ok('卫生计划·不停房 → quality-3 / rep-2', hyg2.quality === 57 && hyg2.reputation === 68)
ok('口碑·道歉+赔偿 → rep +5', applyDecisionToAttrs(ATTR_INIT, 'reputation', '道歉+赔偿').reputation === 75)
ok('口碑·解释原因 → rep +3', applyDecisionToAttrs(ATTR_INIT, 'reputation', '解释原因').reputation === 73)
ok('口碑·模板回复 → rep -5', applyDecisionToAttrs(ATTR_INIT, 'reputation', '模板回复').reputation === 65)
const sh = applyDecisionToAttrs(ATTR_INIT, 'shifts', '满编保服务')
ok('排班·满编保服务 → rep+2 / morale+5', sh.reputation === 72 && sh.morale === 70)
const sh2 = applyDecisionToAttrs(ATTR_INIT, 'shifts', '精简省成本')
ok('排班·精简省成本 → rep-2 / morale-5', sh2.reputation === 68 && sh2.morale === 60)
ok('人力·裁员1人 → morale -15（重罚）', applyDecisionToAttrs(ATTR_INIT, 'hr-optimize', '裁员1人').morale === 50)
const hr = applyDecisionToAttrs(ATTR_INIT, 'hr-optimize', '全员培训')
ok('人力·全员培训 → morale+8 / rep+2', hr.morale === 73 && hr.reputation === 72)
const mc = applyDecisionToAttrs(ATTR_INIT, 'member-convert', '强调品质')
ok('会员转化·强调品质 → rep+2 / morale+1', mc.reputation === 72 && mc.morale === 66)
ok('会员转化·强调优惠 → rep -1', applyDecisionToAttrs(ATTR_INIT, 'member-convert', '强调优惠').reputation === 69)
ok('会员转化·不主动推销 → 无变化（规格未给规则）', eq(applyDecisionToAttrs(ATTR_INIT, 'member-convert', '不主动推销'), ATTR_INIT))

console.log('\n▶ 能耗管控（slider）')
ok('20℃ → morale -3', applyDecisionToAttrs(ATTR_INIT, 'energy', 20).morale === 62)
ok('21℃ → morale -3（边界）', applyDecisionToAttrs(ATTR_INIT, 'energy', 21).morale === 62)
ok('23℃ → 无变化（平衡区）', applyDecisionToAttrs(ATTR_INIT, 'energy', 23).morale === 65)
ok('25℃ → morale +2（边界）', applyDecisionToAttrs(ATTR_INIT, 'energy', 25).morale === 67)
ok('26℃ → morale +2', applyDecisionToAttrs(ATTR_INIT, 'energy', 26).morale === 67)
ok('非数字答案 → 无变化不抛错', applyDecisionToAttrs(ATTR_INIT, 'energy', 'abc').morale === 65)

console.log('\n▶ 活动策划（budget，★补充规则：激励占比 ≥25% 为"高"）')
const campHigh = applyDecisionToAttrs(ATTR_INIT, 'campaign', { 线上广告: 1000, 门店物料: 1000, 员工激励: 2000, 会员礼包: 1000 })
ok('员工激励 2000/5000 = 40% → morale +3', campHigh.morale === 68, `got ${campHigh.morale}`)
const campZero = applyDecisionToAttrs(ATTR_INIT, 'campaign', { 线上广告: 2500, 门店物料: 1500, 员工激励: 0, 会员礼包: 1000 })
ok('员工激励 = 0 → morale -3', campZero.morale === 62, `got ${campZero.morale}`)
const campMid = applyDecisionToAttrs(ATTR_INIT, 'campaign', { 线上广告: 2500, 门店物料: 2000, 员工激励: 500, 会员礼包: 0 })
ok('员工激励 500/5000 = 10% → 无变化', campMid.morale === 65, `got ${campMid.morale}`)
ok('空预算 → 无变化不抛错', applyDecisionToAttrs(ATTR_INIT, 'campaign', {}).morale === 65)

console.log('\n▶ 物资采购（筹建期伪 id est-supplier）')
ok('官方渠道(buy-a) → quality +4', applyDecisionToAttrs(ATTR_INIT, 'est-supplier', 'buy-a').quality === 64)
ok('中间档(buy-b) → 无变化', applyDecisionToAttrs(ATTR_INIT, 'est-supplier', 'buy-b').quality === 60)
ok('自采(buy-c) → quality -3', applyDecisionToAttrs(ATTR_INIT, 'est-supplier', 'buy-c').quality === 57)
ok('文案原文"供应商 A：华住易购（官方）" → +4', applyDecisionToAttrs(ATTR_INIT, 'est-supplier', '供应商 A：华住易购（官方）').quality === 64)
ok('文案原文"供应商 C：自行采购" → -3', applyDecisionToAttrs(ATTR_INIT, 'est-supplier', '供应商 C：自行采购').quality === 57)

console.log('\n▶ clamp 边界（★补充规则：下限 20 对决策同样生效）')
const low = { quality: 25, reputation: 25, morale: 25 }
ok('士气 25 裁员(-15) → 20（不破下限）', applyDecisionToAttrs(low, 'hr-optimize', '裁员1人').morale === 20)
const high = { quality: 98, reputation: 98, morale: 98 }
ok('品质 98 投150万(+15) → 100（不破上限）', applyDecisionToAttrs(high, 'renovation', '投150万改造').quality === 100)
ok('normalizeAttrs 缺字段 → 补 ATTR_INIT', eq(normalizeAttrs({ quality: 80 }), { quality: 80, reputation: 70, morale: 65 }))
ok('normalizeAttrs 脏数据（null/NaN/字符串）→ 不 NaN 不报错', eq(normalizeAttrs({ quality: null, reputation: 'x', morale: NaN }), { quality: 60, reputation: 70, morale: 65 }))
ok('normalizeAttrs(undefined) → ATTR_INIT', eq(normalizeAttrs(undefined), ATTR_INIT))
ok('normalizeAttrs(null 字段) 不被当成 0 → 回退 ATTR_INIT（防 Number(null)=0 坑）', eq(normalizeAttrs({ quality: null, reputation: '', morale: null }), ATTR_INIT))
ok('normalizeAttrs 越界值被 clamp', eq(normalizeAttrs({ quality: 999, reputation: -50, morale: 55 }), { quality: 100, reputation: 20, morale: 55 }))

console.log('\n▶ 改答案（撤销旧增量，防重复累加）')
const qc1 = applyDecisionToAttrs(ATTR_INIT, 'quality-check', ['a'])
const qc2 = applyDecisionToAttrs(qc1, 'quality-check', ['a'], -1)
ok('撤销后回到初始值 60', qc2.quality === 60, `got ${qc2.quality}`)
const rep1 = applyDecisionToAttrs(ATTR_INIT, 'reputation', '模板回复')
const rep2 = applyDecisionToAttrs(rep1, 'reputation', '模板回复', -1)
const rep3 = applyDecisionToAttrs(rep2, 'reputation', '道歉+赔偿')
ok('模板回复(-5)改道歉+赔偿(+5) → 75（不是 70/60）', rep3.reputation === 75, `got ${rep3.reputation}`)
ok('重复编辑不累加（+5 撤销后回 70）', applyDecisionToAttrs(rep3, 'reputation', '道歉+赔偿', -1).reputation === 70)
const en1 = applyDecisionToAttrs(ATTR_INIT, 'energy', 20)
ok('能耗撤销：62 → 65', applyDecisionToAttrs(en1, 'energy', 20, -1).morale === 65)
const c1 = applyDecisionToAttrs(ATTR_INIT, 'campaign', { 员工激励: 5000 })
ok('活动策划撤销：68 → 65', applyDecisionToAttrs(c1, 'campaign', { 员工激励: 5000 }, -1).morale === 65)

console.log('\n▶ 事件（规格 §6）')
ok('卫生敷衍 → q-2 / r-3', eq(applyEventToAttrs(ATTR_INIT, '卫生敷衍'), { quality: 58, reputation: 67, morale: 65 }))
ok('负面舆情（危机）→ r-4 / m-2', eq(applyEventToAttrs(ATTR_INIT, '负面舆情（危机）'), { quality: 60, reputation: 66, morale: 63 }))
ok('员工请假 → r-1 / m-3', eq(applyEventToAttrs(ATTR_INIT, '员工请假'), { quality: 60, reputation: 69, morale: 62 }))
ok('网红探店 → r+3', applyEventToAttrs(ATTR_INIT, '网红探店').reputation === 73)
ok('员工关怀日 → m+4', applyEventToAttrs(ATTR_INIT, '员工关怀日').morale === 69)
ok('设备故障 → q-2 / r-1', eq(applyEventToAttrs(ATTR_INIT, '设备故障'), { quality: 58, reputation: 69, morale: 65 }))
ok('整改获认可·追加好评 → q+2/r+1/m+1', eq(applyEventToAttrs(ATTR_INIT, '整改获认可·追加好评'), { quality: 62, reputation: 71, morale: 66 }))
ok('竞店开业 → m-1', applyEventToAttrs(ATTR_INIT, '竞店开业').morale === 64)
ok('会展旺季 → m+2', applyEventToAttrs(ATTR_INIT, '会展旺季').morale === 67)
ok('资金链断裂（危机）→ r-3 / m-5', eq(applyEventToAttrs(ATTR_INIT, '资金链断裂（危机）'), { quality: 60, reputation: 67, morale: 60 }))
ok('深夜噪音投诉 → q-1 / r-2', eq(applyEventToAttrs(ATTR_INIT, '深夜噪音投诉'), { quality: 59, reputation: 68, morale: 65 }))
ok('未知事件 → 无变化不抛错', eq(applyEventToAttrs(ATTR_INIT, '不存在的事件'), ATTR_INIT))

console.log('\n▶ 每周衰减（规格 §7，验收：经济-3 / 高档-1）')
const d1 = applyWeeklyDecay(ATTR_INIT, '经济型 · 国民')
ok('经济型：quality -3 / rep -1 / morale -1', eq(d1, { quality: 57, reputation: 69, morale: 64 }), JSON.stringify(d1))
const d2 = applyWeeklyDecay(ATTR_INIT, '高档')
ok('高档型：quality -1 / rep -1 / morale -1', eq(d2, { quality: 59, reputation: 69, morale: 64 }), JSON.stringify(d2))
const d3 = applyWeeklyDecay(ATTR_INIT, '精选 · 中高档')
ok('中高档：quality -2', d3.quality === 58)
// 品质惩罚（规格 §5.2）：quality=40 奢华 → (50-40)/10×1.6 = 1.6 → rep -2.6 → round(-2.6+70)=67
const d4 = applyWeeklyDecay({ quality: 40, reputation: 70, morale: 65 }, '奢华')
ok('品质40 + 奢华：声誉惩罚 1.6（规格 §5.2 示例）', d4.reputation === 67, `got ${d4.reputation}`)
const d5 = applyWeeklyDecay({ quality: 40, reputation: 70, morale: 65 }, '经济型 · 国民')
ok('品质40 + 经济：惩罚 0.8 → 70-1-0.8=68.2 → 68', d5.reputation === 68, `got ${d5.reputation}`)
ok('品质≥50 无惩罚', applyWeeklyDecay({ quality: 50, reputation: 70, morale: 65 }, '奢华').reputation === 69)
const d6 = applyWeeklyDecay({ quality: 21, reputation: 21, morale: 21 }, '经济型 · 国民')
ok('衰减不破下限 20', d6.quality === 20 && d6.morale === 20, JSON.stringify(d6))

console.log('\n▶ 称号综合分（规格 §九 权重 30/40/30）')
ok('初始值综合分 = 60*0.3+70*0.4+65*0.3 = 65.5 → 66', attrsComposite(ATTR_INIT) === 66, `got ${attrsComposite(ATTR_INIT)}`)
ok('满值 → 100', attrsComposite({ quality: 100, reputation: 100, morale: 100 }) === 100)
const t = attrsToTitle(ATTR_INIT, TITLES)
ok('接 hotelTitle.TITLES 可用（综合66 → 精品酒店）', t.title === '精品酒店' && t.composite === 66, JSON.stringify(t))

console.log('\n▶ 覆盖率盘点（对 decisions.js / settlement.js 实际清单）')
const covered = ['quality-check', 'renovation', 'hygiene', 'reputation', 'shifts', 'hr-optimize', 'member-convert', 'energy', 'campaign']
const ids = decisions.map(d => d.id)
ok('决策表 id 全部存在于 decisions.js', covered.every(id => ids.includes(id)), covered.filter(id => !ids.includes(id)).join(','))
const noAttr = ids.filter(id => !covered.includes(id))
console.log(`  · 规格表覆盖 ${covered.length}/${ids.length} 项；暂无属性规则的 ${noAttr.length} 项：${noAttr.join(', ')}`)

console.log('\n▶ qualityOf 统一来源（N2：四端品质唯一来源）')
ok('裸 attrs 对象 → 取其 quality', qualityOf({ quality: 65, reputation: 70, morale: 65 }) === 65)
ok('state 对象（{attrs:{...}}）→ 取 attrs.quality', qualityOf({ attrs: { quality: 42, reputation: 1, morale: 1 } }) === 42)
ok('旧档无 attrs → 回退初值 60', qualityOf({}) === 60 && qualityOf(undefined) === 60 && qualityOf(null) === 60)
ok('attrs.attrs 为 null → 回退 60（不当成 0）', qualityOf({ attrs: null }) === 60)
ok('脏数据 → 回退 60，不 NaN', qualityOf({ quality: null }) === 60 && qualityOf({ quality: 'x' }) === 60 && Number.isFinite(qualityOf({ quality: NaN })))
ok('越界值 clamp', qualityOf({ quality: 999 }) === 100 && qualityOf({ quality: -5 }) === 20)
ok('与 normalizeAttrs 口径一致', qualityOf({ quality: 77 }) === normalizeAttrs({ quality: 77 }).quality)

console.log(`\n========== attrs 自测：${pass} 通过 / ${fail} 失败 ==========`)
process.exit(fail ? 1 : 0)
