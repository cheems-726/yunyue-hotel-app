// 第1步自测：src/guests.js
//  ① 50 个客人身份 100% 自洽（男→🧑先生 / 女→👩女士）
//  ② 10 条 front_slow 差评：像不像真人、是否重复、是否含具体细节
//  ③ 模拟"精简排班" → front_slow 权重显著高于其他
//  ④ 硬约束：guests.js 绝不调用结算的全局 rand()（源码级断言）
import { readFileSync } from 'node:fs'
import {
  guestsRng, guestOf, causeWeightsOf, pickCause, makeReviewText, makeReview,
  SURNAMES, PERSONAS, ROOM_TYPES, CAUSE_NEGATIVE, CAUSE_POSITIVE, CAUSE_SOURCE, reviewSeverityOf,
} from '../src/guests.js'

let pass = 0, fail = 0
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('  ✓ ' + name) } else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ ① 客人身份自洽（50 个）')
const rnd = guestsRng(20260921)
const guests = Array.from({ length: 50 }, () => guestOf(rnd))
const bad = guests.filter(g => (g.gender === 'male' && !(g.avatar === '🧑' && g.title === '先生')) || (g.gender === 'female' && !(g.avatar === '👩' && g.title === '女士')))
ok(bad.length === 0, '男→🧑+先生 / 女→👩+女士 100% 自洽', JSON.stringify(bad.slice(0, 2)))
ok(guests.every(g => SURNAMES.includes(g.surname)), '姓氏全部取自姓氏池')
ok(guests.every(g => PERSONAS.includes(g.persona)), '客群全部合法（4 种）')
ok(guests.every(g => ROOM_TYPES.includes(g.roomType)), '房型全部合法（3 种）')
ok(guests.every(g => g.nights >= 1 && g.nights <= 5), '入住天数都在 1~5 晚')
ok(guests.every(g => g.name === g.surname + g.title && g.card === g.name + ' · ' + g.persona), '称呼/名片拼接正确')
ok(guests.every(g => ['🧑', '👩'].includes(g.avatar)), '头像只可能是 🧑 或 👩')
const genders = new Set(guests.map(g => g.gender))
ok(genders.size === 2, '男女都出现过（随机分布正常）')
const personasSeen = new Set(guests.map(g => g.persona))
ok(personasSeen.size === 4, '4 种客群都出现过', [...personasSeen].join('/'))
console.log('   样例：' + guests.slice(0, 5).map(g => `${g.avatar}${g.card}·${g.roomType}${g.nights}晚`).join(' | '))

console.log('\n▶ ② 10 条 front_slow 差评（真人感 / 去重 / 细节）')
const r2 = guestsRng(777)
const DETAIL_WORDS = ['二十分钟', '十分钟', '排队', '没人接', '充电器', '忙不过来', '前台就一个人', '队伍']
const texts = []
const recent = []
for (let i = 0; i < 10; i++) {
  const g = guestOf(r2)
  const t = makeReviewText({ cause: 'front_slow', persona: g.persona, stars: 1 + Math.floor(r2() * 2), rnd: r2, recent })
  texts.push(t); recent.push(t)
  console.log(`   ${i + 1}. ${g.avatar}${g.card}：${t}`)
}
ok(new Set(texts).size === texts.length, '10 条无完全重复', `唯一 ${new Set(texts).size}/10`)
ok(texts.every(t => DETAIL_WORDS.some(w => t.includes(w))), '每条都含具体细节词（非笼统"服务慢"）')
ok(!texts.some(t => /卫生差|服务慢|态度不好$/.test(t)), '不含笼统套话')
const lens = texts.map(t => t.length)
ok(Math.max(...lens) - Math.min(...lens) >= 15, `长度不一（最短 ${Math.min(...lens)} / 最长 ${Math.max(...lens)} 字）`)
// 🔴 原写法 `new Set(texts.map((_, i) => i)).size === 10` 是恒真式（下标集大小必为 10）——
//    见《测试质量审计》附录"假绿 + 功能失效互相掩护"典型案例。改成真有判别力的校验：
const genBad = texts.filter(t => typeof t !== 'string' || t.length < 12 || /undefined|NaN|\[object/.test(t))
ok(texts.length === 10 && genBad.length === 0,
  `10 条均真实生成且无脏内容（条数 ${texts.length}，脏 ${genBad.length}，最短 ${Math.min(...texts.map(t => String(t).length))} 字）`)

console.log('\n▶ ③ 精简排班 → front_slow 权重显著高于其他')
const baseDec = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', energy: 23 }
const leanDec = { ...baseDec, shifts: '精简省成本' }
const wBase = causeWeightsOf(baseDec, { attrs: { quality: 70, reputation: 70, morale: 65 }, occupancy: 60, price: 280 }, 1)
const wLean = causeWeightsOf(leanDec, { attrs: { quality: 70, reputation: 70, morale: 65 }, occupancy: 60, price: 280 }, 1)
console.log(`   基线 front_slow=${wBase.negative.front_slow} hygiene=${wBase.negative.hygiene}`)
console.log(`   精简 front_slow=${wLean.negative.front_slow} hygiene=${wLean.negative.hygiene}`)
ok(wLean.negative.front_slow === wBase.negative.front_slow + 3, '精简排班使 front_slow 权重 +3')
const othersLean = Object.entries(wLean.negative).filter(([k]) => k !== 'front_slow' && k !== 'hygiene').map(([, v]) => v)
ok(wLean.negative.front_slow > Math.max(...othersLean) * 1.5, `front_slow(${wLean.negative.front_slow}) 显著高于其他负向 cause（最大 ${Math.max(...othersLean)}）`)
// 抽样验证：按权重抽 200 次，front_slow 占比应明显提升
const cntBase = {}, cntLean = {}
const r3 = guestsRng(99)
for (let i = 0; i < 200; i++) { const c = pickCause(wBase.negative, r3); cntBase[c] = (cntBase[c] || 0) + 1 }
for (let i = 0; i < 200; i++) { const c = pickCause(wLean.negative, r3); cntLean[c] = (cntLean[c] || 0) + 1 }
console.log(`   抽样200次 front_slow：基线 ${cntBase.front_slow || 0} 次 → 精简 ${cntLean.front_slow || 0} 次`)
ok((cntLean.front_slow || 0) > (cntBase.front_slow || 0) * 1.5, '抽样中 front_slow 出现率显著提升')

console.log('\n▶ ④ 其他规格要点')
const wSup = causeWeightsOf({ ...baseDec, hygiene: '不停房', energy: 20 }, { attrs: { quality: 40, reputation: 60, morale: 50 }, occupancy: 90, price: 380 }, 3)
ok(wSup.negative.cold > 1, '能耗≤21℃ → cold 权重升高')
ok(wSup.negative.hygiene > 3, '不停房深清洁 → hygiene 权重升高')
ok(wSup.negative.overprice > 3, '房价>320 → overprice 权重升高')
ok(wSup.negative.noise > 1, '【补充规格】品质<50 → noise 权重升高')
const wHigh = causeWeightsOf({ ...baseDec, overbook: 0 }, { attrs: { quality: 90, reputation: 90, morale: 90 }, occupancy: 70, price: 280, flow: 5 }, 1)
ok(wHigh.positive.praise_clean >= 4, '品质≥80 → praise_clean 权重高')
ok(wHigh.negative.no_room === 0, '未超售 → no_room 权重为 0')
const wOver = causeWeightsOf({ ...baseDec, overbook: 3 }, { attrs: { quality: 60 }, occupancy: 90, price: 280 }, 1)
ok(wOver.negative.no_room > 4, `超售 → no_room 权重 ${wOver.negative.no_room}（结算侧另有必触发）`)
// 好评 cause 齐全（含补充的 praise_value）
ok(CAUSE_POSITIVE.length === 6 && CAUSE_POSITIVE.includes('praise_value'), '好评 cause 6 个（含补充规格 praise_value）')
ok(CAUSE_NEGATIVE.length === 10, '差评 cause 10 个')
ok(Object.keys(CAUSE_SOURCE).length >= CAUSE_NEGATIVE.length + CAUSE_POSITIVE.length - 3, 'cause→来源决策 映射已覆盖（供「关联经营」反查）')
// 一条完整评价的结构
const rev = makeReview({ decisions: leanDec, state: { attrs: { quality: 70 }, occupancy: 70, price: 280 }, week: 2, stars: 2, rnd: guestsRng(5) })
ok(!!(rev.guest && rev.cause && rev.stars && rev.text && rev.roomType && rev.nights), 'makeReview 返回结构化字段齐全')
ok(rev.relatedDecision === 'shifts', `front_slow 关联到决策 shifts（实际 ${rev.relatedDecision}）`)
console.log(`   样例：${rev.guest.avatar}${rev.guest.card} ⭐${rev.stars} 「${rev.text}」 来源=${rev.relatedDecision}`)

console.log('\n▶ ⑤ 硬约束：不调用结算的全局 rand()（源码级）')
const src = readFileSync(new URL('../src/guests.js', import.meta.url), 'utf8')
ok(!/from ['"]\.\/settlement/.test(src), 'guests.js 未 import settlement（不可能拿到它的 rand）')
// 先剥掉注释与字符串字面量，再检查裸 rand() —— 避免把注释里提到的 rand() 误判成调用
const code = src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
  .replace(/'[^']*'/g, "''").replace(/`[^`]*`/g, '``')
const bareRand = (code.match(/(^|[^.\w])rand\(\)/g) || []).length
ok(bareRand === 0, `代码中无裸全局 rand() 调用（剥注释后实际 ${bareRand} 处）`)
ok(/guestsRng/.test(src), '自带独立随机源 guestsRng 存在')
// 确定性：同种子两次生成完全一致
const t1 = makeReviewText({ cause: 'hygiene', persona: '家庭出游', stars: 1, rnd: guestsRng(42) })
const t2 = makeReviewText({ cause: 'hygiene', persona: '家庭出游', stars: 1, rnd: guestsRng(42) })
ok(t1 === t2, '同种子 → 同文本（可复现）')

// ── 差评严重度（语气分级）：必须挂经营状态、可解释、到店无房最重 ──
// ── T4：随机源纪律（源码级）——评价相关模块不得偷偷用全局 Math.random ──
// ── ② 回归：occupancy 单位必须是 0-100（HotelStatus 曾传 0-1 → "满负荷服务跟不上"类原因永远命不中）──
{
  const lean = { shifts: '精简省成本' }
  const S1 = { occupancy: 95, price: 230, attrs: { quality: 60, reputation: 70, morale: 65 } }
  const S2 = { occupancy: 0.95, price: 230, attrs: { quality: 60, reputation: 70, morale: 65 } }
  const hi = causeWeightsOf(lean, S1), bug = causeWeightsOf(lean, S2)
  console.log('\n[单位口径] occupancy 0-100 vs 0-1')
  ok((hi.negative.busy_service || 0) > 0, `满负荷(95) + 精简排班 → busy_service 权重 > 0（实测 ${(hi.negative.busy_service || 0).toFixed(1)}）`)
  // 实测（2026-09-22）：传 0.95 不会归零，而是把权重压到 1/4（4.0 → 1.0）—— 症状是该类原因很难出现而非永不出现
  ok((bug.negative.busy_service || 0) < (hi.negative.busy_service || 0) * 0.5,
    `误传 0.95（单位串线）→ busy_service 权重显著偏低（${(bug.negative.busy_service || 0).toFixed(1)} vs 正确 ${(hi.negative.busy_service || 0).toFixed(1)}）= 修复前症状`)
}

console.log('\n[随机源纪律] 评价相关模块不得依赖 Math.random')
{
  const read = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')
  const codeOnly = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
  // 口径（2026-09-22 实测）：guests.js / liveReview.js = 0 处；reviewRate.js 允许 1 处，
  // 且必须只出现在 `typeof rnd === 'function' ? rnd() : Math.random()` 的兜底分支
  const countRandom = (src) => (codeOnly(src).match(/Math\.random/g) || []).length
  const g = read('guests.js'), rr = read('reviewRate.js'), lr = read('liveReview.js')
  ok(countRandom(g) === 0, `guests.js 无 Math.random（实测 ${countRandom(g)} 处，自带 guestsRng 独立流）`)
  ok(countRandom(lr) === 0, `liveReview.js 无 Math.random（实测 ${countRandom(lr)} 处，未传 rnd 时用常量兜底）`)
  const rrLines = codeOnly(rr).split('\n').filter(l => /Math\.random/.test(l))
  ok(countRandom(rr) <= 1 && rrLines.every(l => /typeof\s+rnd\s*===\s*'function'/.test(l)),
    `reviewRate.js 的 Math.random 仅在 rnd 兜底分支（实测 ${countRandom(rr)} 处）`)
}

console.log('\n[严重度] reviewSeverityOf')
{
  const worst = reviewSeverityOf({ quality: 20, morale: 20, negRatio: 1, pending: 5 })
  const mid = reviewSeverityOf({ quality: 60, morale: 65, negRatio: 0.2, pending: 0 })
  const best = reviewSeverityOf({ quality: 100, morale: 100, negRatio: 0, pending: 0 })
  ok(worst === 1, '差到极点 → 1 星（实测 ' + worst + '）')
  ok(mid === 2, '中性状态 → 2 星（实测 ' + mid + '）')
  ok(best === 3, '状态很好 → 3 星（轻微不满，实测 ' + best + '）')
  ok(worst < mid && mid < best, '严重度随经营状态单调（越差星级越低）')
  ok(reviewSeverityOf({ cause: 'no_room', quality: 100, morale: 100 }) === 1, '到店无房恒 1 星（不看状态）')
  ok([1, 2, 3].includes(reviewSeverityOf({})), '缺参兜底也落在 1~3')
  ok(reviewSeverityOf({ quality: null, morale: undefined }) === mid, '脏数据兜底为中性（不 NaN）')
  const seq = [[100, 100], [80, 80], [60, 65], [40, 45], [20, 20]].map(([q, m]) => reviewSeverityOf({ quality: q, morale: m, negRatio: 0.1, pending: 1 }))
  ok(seq.every((s, i) => i === 0 || s <= seq[i - 1]), '属性单调递减：' + seq.join('→'))
}
console.log(`\n========== guests 自测：${pass} 通过 / ${fail} 失败 ==========`)
process.exit(fail ? 1 : 0)
