// 第1步自测：src/reviewRate.js（三因子动态评价率）
// 产出：不同档次 / 客流 / 满意度 的概率对比表 + 硬保护 + 纯函数性 + 预估日评价条数
import { readFileSync } from 'node:fs'
import {
  dailyReviewProb, satisfactionOf, tierFactor, rollReview, expectedPerDay,
  REVIEW_BASE_RATE, REVIEW_K, CAP_DAY, CAP_WEEK,
} from '../src/reviewRate.js'
import { guestsRng } from '../src/guests.js'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.log('  ✗ ' + n + (extra ? '  [' + extra + ']' : '')) } }
const pct = (v) => (v * 100).toFixed(2) + '%'
const MID = { quality: 60, reputation: 70, morale: 65 }         // 中性属性 → s = 0.65
const LOW = { quality: 25, reputation: 30, morale: 30 }
const HIGH = { quality: 95, reputation: 95, morale: 90 }
const DEC = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', 'hr-optimize': '全员培训' }

console.log('▶ 满意度 satisfactionOf')
const sMid = satisfactionOf(MID, {})
const sHigh = satisfactionOf(HIGH, DEC)
const sLow = satisfactionOf(LOW, { shifts: '精简省成本', 'hr-optimize': '裁员1人', hygiene: '不停房', reputation: '模板回复' })
console.log(`   中性属性={60,70,65} → s=${sMid.toFixed(3)}（= (60*.4+70*.4+65*.2)/100 = 0.65 ✓）`)
console.log(`   高属性+好决策      → s=${sHigh.toFixed(3)}`)
console.log(`   低属性+省钱决策    → s=${sLow.toFixed(3)}`)
ok(Math.abs(sMid - 0.65) < 1e-9, '中性属性满意度 = 0.65（品质40%+声誉40%+士气20%）')
ok(sHigh > 0.9 && sLow < 0.4, '满意度能拉开（高 0.9+ / 低 0.4-）')
ok(satisfactionOf(LOW, { shifts: '精简省成本' }) < satisfactionOf(LOW, { shifts: '满编保服务' }), '决策修正生效（满编 > 精简）')
ok(satisfactionOf({}, {}) === satisfactionOf({ quality: 60, reputation: 70, morale: 65 }, {}), '属性缺省 → 按中性值（不报错）')

console.log('\n▶ 档次系数 tierFactor（经济0.8 / 中档1.0 / 中高1.2 / 高档1.4 / 奢华1.6）')
const tiers = [['经济型 · 国民', 0.8], ['中档', 1.0], ['精选 · 中高档', 1.2], ['高档', 1.4], ['奢华', 1.6]]
tiers.forEach(([lv, exp]) => console.log(`   ${lv.padEnd(12)} → ${tierFactor(lv)}`))
ok(tiers.every(([lv, exp]) => tierFactor(lv) === exp), '五档系数与规格一致')
ok(tierFactor('') === 1.0, '空档位兜底 = 1.0')

console.log('\n▶ 概率对比表（同一状态，只改一个因子）')
const base = { rooms: 72, occupancy: 0.8, brandLevel: '中档', attrs: MID, decisions: DEC }
console.log('   A) 档次（客流/满意度不变）')
tiers.forEach(([lv]) => {
  const p = dailyReviewProb({ ...base, brandLevel: lv })
  console.log(`      ${lv.padEnd(12)} pGood=${pct(p.pGood)}  pBad=${pct(p.pBad)}  预估日评价≈${expectedPerDay(p)} 条`)
})
const pEco = dailyReviewProb({ ...base, brandLevel: '经济型 · 国民' })
const pLux = dailyReviewProb({ ...base, brandLevel: '奢华' })
ok(pLux.pGood > pEco.pGood * 1.9, '奢华概率 ≈ 经济型 2 倍（0.8 → 1.6）')

console.log('   B) 客流（档次/满意度不变）')
;[0.3, 0.6, 0.9].forEach(o => {
  const p = dailyReviewProb({ ...base, occupancy: o })
  console.log(`      在店 ${String(p.inHouse).padStart(2)} 间（occ ${o}） crowd=${p.crowd.toFixed(2)}  pGood=${pct(p.pGood)}  预估日评价≈${expectedPerDay(p, p.inHouse)} 条`)
})
const pLowOcc = dailyReviewProb({ ...base, occupancy: 0.3 })
const pHighOcc = dailyReviewProb({ ...base, occupancy: 0.9 })
ok(pHighOcc.pGood > pLowOcc.pGood * 2.5, '客流越高概率越高（0.3→0.9 间数 3 倍）')

console.log('   C) 满意度（档次/客流不变）')
;[['很差', LOW, { shifts: '精简省成本', 'hr-optimize': '裁员1人', hygiene: '不停房', reputation: '模板回复' }],
  ['中性', MID, {}], ['很好', HIGH, DEC]].forEach(([label, a, d]) => {
  const p = dailyReviewProb({ ...base, attrs: a, decisions: d })
  console.log(`      ${label.padEnd(4)} s=${p.s.toFixed(3)}  pGood=${pct(p.pGood)}  pBad=${pct(p.pBad)}  好评:差评 = ${(p.pGood / Math.max(p.pBad, 1e-9)).toFixed(1)} : 1`)
})
const pBad = dailyReviewProb({ ...base, attrs: LOW, decisions: { shifts: '精简省成本', 'hr-optimize': '裁员1人', hygiene: '不停房', reputation: '模板回复' } })
ok(pBad.pBad > pBad.pGood, '满意度差 → 差评概率 > 好评概率')
ok(pBad.pGood === 0, '满意度低于 0.5 → 好评概率为 0（max(0,s-0.5)²=0）')

console.log('\n▶ 硬保护（当日 3 / 当周 10）')
const capD = dailyReviewProb({ ...base, attrs: HIGH, decisions: DEC, todayCount: CAP_DAY })
const capW = dailyReviewProb({ ...base, attrs: HIGH, decisions: DEC, weekCount: CAP_WEEK })
ok(capD.pGood === 0 && capD.capped === true, `当日已 ${CAP_DAY} 条 → 概率归零（capped）`)
ok(capW.pGood === 0 && capW.capped === true, `当周已 ${CAP_WEEK} 条 → 概率归零（capped）`)
const capOK = dailyReviewProb({ ...base, attrs: HIGH, decisions: DEC, todayCount: 2, weekCount: 9 })
ok(capOK.pGood > 0 && !capOK.capped, '未触顶时正常给概率')

console.log('\n▶ 概率量级与「一节课能有几条」（LiveFeed 实速：1 游戏分钟 = 2 真实秒）')
const ROLLS_PER_GAMEDAY = 22.7   // 退房 19 + 入住/夜间时段 x1/5 共 3.7（方案④）
const CLASS_ROLLS = +(ROLLS_PER_GAMEDAY * (45 / 48)).toFixed(1)   // 45 分钟 = 0.94 游戏日
console.log(`   每游戏日掷骰 ≈ ${ROLLS_PER_GAMEDAY} 次；一节课(45min=0.94游戏日) ≈ ${CLASS_ROLLS} 次`)
const SCEN = [
  ['中档·满租·中性', { ...base, attrs: MID, decisions: {} }],
  ['中档·满租·很好', { ...base, attrs: HIGH, decisions: DEC }],
  ['经济·半租·中性', { ...base, brandLevel: '经济型 - 国民', occupancy: 0.5, attrs: MID, decisions: {} }],
  ['奢华·满租·很好', { ...base, brandLevel: '奢华', attrs: HIGH, decisions: DEC }],
]
SCEN.forEach(([label, cfg]) => {
  const p = dailyReviewProb(cfg)
  const perClass = +Math.min(CAP_DAY, (p.pGood + p.pBad) * CLASS_ROLLS).toFixed(2)
  console.log(`   ${label.padEnd(14)} 单次 p=${pct(p.pGood + p.pBad)} → 一节课 ≈ ${perClass} 条（游戏日上限 ${CAP_DAY} 兜底）`)
})
ok(SCEN.every(([, cfg]) => { const p = dailyReviewProb(cfg); return p.pGood + p.pBad <= 0.6 }), '各场景单次概率 <=60%（未失控）')
ok(dailyReviewProb({ ...base, attrs: MID, decisions: {} }).pGood < 0.1, '中性态单次概率 <10%（罕见，符合「评价要低」）')

console.log('\n▶ 掷骰 rollReview（独立随机源）')
const rnd = guestsRng(2026)
let good = 0, bad = 0, none = 0
for (let i = 0; i < 2000; i++) { const r = rollReview(0.06, 0.02, rnd); if (r === 'good') good++; else if (r === 'bad') bad++; else none++ }
console.log(`   2000 次掷骰（pGood=6% pBad=2%）：好评 ${good} / 差评 ${bad} / 无 ${none}`)
ok(good > 80 && good < 200 && bad > 20 && bad < 80, '掷骰频率符合设定概率（≈6% / 2%）')

console.log('\n▶ 纯函数与硬约束（源码级）')
const src = readFileSync(new URL('../src/reviewRate.js', import.meta.url), 'utf8')
ok(!/from ['"]\.\/settlement/.test(src), '未 import settlement')
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n').replace(/'[^']*'/g, "''").replace(/`[^`]*`/g, '``')
ok((code.match(/(^|[^.\w])rand\(\)/g) || []).length === 0, '代码中无裸全局 rand() 调用')
ok(typeof REVIEW_BASE_RATE === 'number' && typeof REVIEW_K === 'number', 'baseRate/K 为可调常量')
const p1 = dailyReviewProb(base), p2 = dailyReviewProb(base)
ok(JSON.stringify(p1) === JSON.stringify(p2), '同输入 → 同输出（确定性）')

console.log(`\n========== reviewRate 自测：${pass} 通过 / ${fail} 失败 ==========`)
process.exit(fail ? 1 : 0)
