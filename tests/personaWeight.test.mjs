// §33-V6 · 客群结构加权 —— 守门（三路并行 × 归一化占比 × 混合效应 × 水位线）
// 判据（每条对着"占比真的在算"）：
//   ① 结构生效：同 dominant 不同占比 ⇒ 加权分不同
//   ② 混合效应：非 dominant 路的命中反馈照出
//   ③ 占比微调 ⇒ 结果可测变化（RV 判据的同款正向形态）
//   ④ 零权重路不出现（占0%的客群无份量 —— 也是水位线形态）
//   ⑤ 归一化：三路等比与归一化后等权同分
//   ⑥ 水位线：无 district（表未命中）⇒ 走均衡兜底（与改前逐字一致）
//   ⑦ 确定性（公平红线）
//   ⑧ 不双扣锚：客群段不引用 roleBonus（R4）/ decisionRisk 代价（R6 独立）/ V4 两维系数
// 运行：node tests/personaWeight.test.mjs   （挂 run-all fast）
import { settle } from '../src/settlement.js'
import { CUSTOMER_PERSONAS } from '../src/siteLocations.mjs'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ §33-V6 客群结构加权')
const 品牌 = { name: '汉庭', price: '180-280元', standard: '客房70间起', level: '经济型' }
const 决策 = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', energy: 23, overbook: 2, reputation: '道歉+赔偿' }
const 属性 = { quality: 60, reputation: 70, morale: 65 }
const 跑v6 = (district) => settle({ site: { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3, district }, brand: 品牌, decisions: 决策, week: 2, attrs: { ...属性 }, prevGoodRate: 80, prevCapital: 1200000 })

// ① 结构生效：同 dominant（business）但占比不同 ⇒ 加权分不同
const 锦江 = 跑v6('锦江区')     // 商55/游30/家15
const 高新 = 跑v6('高新区')     // 商65/游15/家20
ok(锦江.personaBonus !== 高新.personaBonus,
  `★ 占比真的在算：同 dominant（商务主力）不同占比 ⇒ 加权分不同（锦江 ${锦江.personaBonus} vs 高新 ${高新.personaBonus}）`,
  '两区同分 ⇒ 结构加权没生效')

// ② 混合效应：非 dominant 路的命中反馈照出（都江堰 商10/游60/家30 · 游客主力）
const 都江堰 = 跑v6('都江堰市')
ok(都江堰.personaFeedback.some(f => f.includes('游客')), '★ 混合效应：非 dominant 路的命中反馈照出')
ok(Number.isFinite(都江堰.personaBonus) && 都江堰.personaBonus !== 0, `都江堰加权分非零（${都江堰.personaBonus}）`)

// ③ 占比微调 ⇒ 结果可测变化
{
  const per = CUSTOMER_PERSONAS['锦江区']
  const 备份 = { business: per.business, tourist: per.tourist, family: per.family }
  per.business = 90; per.tourist = 5; per.family = 5
  const 微调后 = 跑v6('锦江区')
  per.business = 备份.business; per.tourist = 备份.tourist; per.family = 备份.family
  ok(微调后.personaBonus !== 锦江.personaBonus,
    `★ 占比微调 ⇒ 结果可测变化（锦江 55/30/15 ⇒ 90/5/5：${锦江.personaBonus} → ${微调后.personaBonus}）`,
    '占比改了结果没变 ⇒ 加权是摆设')
}

// ④ 零权重路不出现（100/0/0 ⇒ 只有商务客反馈）
{
  const per = CUSTOMER_PERSONAS['锦江区']
  const 备份 = { business: per.business, tourist: per.tourist, family: per.family }
  per.business = 100; per.tourist = 0; per.family = 0
  const 独占 = 跑v6('锦江区')
  per.business = 备份.business; per.tourist = 备份.tourist; per.family = 备份.family
  ok(!独占.personaFeedback.some(f => f.includes('游客') || f.includes('家庭')),
    '★ 零权重路不出现（100/0/0 ⇒ 只有商务客反馈）',
    JSON.stringify(独占.personaFeedback))
}

// ⑤ 归一化占比加权：三路等比（100/100/100）⇒ 权重各 1/3 ⇒ 与锦江占比（55/30/15 归一化后不同权）不同；
//    但与【人为等比】（如 34/33/33）同分 —— 用"改前同分锚"验证归一化在算：
{
  const per = CUSTOMER_PERSONAS['锦江区']
  const 备份 = { business: per.business, tourist: per.tourist, family: per.family }
  per.business = 34; per.tourist = 33; per.family = 33
  const 等权 = 跑v6('锦江区')
  per.business = 备份.business; per.tourist = 备份.tourist; per.family = 备份.family
  ok(等权.personaBonus !== 锦江.personaBonus,
    `★ 归一化在算：等比（34/33/33 ⇒ 各≈1/3）与锦江（55/30/15）不同分（${等权.personaBonus} vs ${锦江.personaBonus}）`,
    '归一化失效 ⇒ 两形态同分')
  // 再证：等比归一化后 === 各 1/3 ⇒ 与 100/100/100 同分
  per.business = 100; per.tourist = 100; per.family = 100
  const 全等 = 跑v6('锦江区')
  per.business = 备份.business; per.tourist = 备份.tourist; per.family = 备份.family
  ok(全等.personaBonus === 等权.personaBonus,
    `★ 归一化：34/33/33 与 100/100/100 同分（各 1/3：${全等.personaBonus} === ${等权.personaBonus}）`,
    '归一化没做 ⇒ 两形态不同分')
}

// ⑥ 水位线：无 district（客群表未命中）⇒ 走均衡兜底（与改前逐字一致 · fixture 形态）
const 无区 = settle({ site: { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }, brand: { name: '汉庭快捷', price: '160-240元', standard: '客房60间起', level: '经济型（轻改/特许）' }, decisions: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 }, prevCapital: 1490000 })
ok(无区.personaFeedback.length === 2 && 无区.personaFeedback[0].includes('深清洁') && 无区.personaFeedback[1].includes('优质差评回复'),
  '★ 水位线：无 district（表未命中）⇒ 走均衡兜底（与改前逐字一致）',
  JSON.stringify(无区.personaFeedback))

// ⑦ 确定性：同输入两跑逐字节
ok(JSON.stringify(跑v6('锦江区')) === JSON.stringify(锦江), '确定性：同输入两跑逐字节一致（公平红线）')

// ⑨ ★ §33-V3：AI 领班代管 —— 学生决策优先 + 未授权水位线（RV-33v3 靶 RV-1/RV-2 的守门侧）
{
  const { 领班代管 } = await import('../src/aiSupervisor.mjs')
  // 上周 = 真实结算结果形态（含 decisions 快照 —— R6 的室温延续读它）
  const 上周 = { occupancy: 54, revenue: 92000, occupiedRooms: 40, overbookCompensation: 1840, price: 230, decisions: { energy: 26, overbook: 8 } }
  const 全开 = { overbook: { ok: true }, energy: { ok: true } }
  // (a) 学生决策优先：学生本周两项都做了 ⇒ 领班什么都不管（代管 = {} —— 不覆盖学生任何选择）
  const r学生有 = 领班代管({ 上周, 学生决策: { overbook: 3, energy: 26 }, 全班默认: 全开 })
  ok(Object.keys(r学生有.代管决策).length === 0,
    '★ V3 学生决策优先：学生两项都做了 ⇒ 领班零代管（不覆盖学生任何选择）',
    JSON.stringify(r学生有.代管决策))
  // (a2) 学生只做了 energy(26) ⇒ 领班不碰 energy（学生优先另一侧）· overbook 没做 ⇒ R3 代管 0
  const r学生有e = 领班代管({ 上周, 学生决策: { energy: 26 }, 全班默认: 全开 })
  ok(r学生有e.代管决策.overbook === 0 && r学生有e.代管决策.energy === undefined,
    '★ V3 学生决策优先（另一侧）：学生自己设了 26℃ ⇒ 领班不碰（代管只剩 overbook:0）',
    JSON.stringify(r学生有e.代管决策))
  // (b) 学生本周没做 overbook/energy ⇒ 沿用上周（overbook=8 ⇒ R3 · energy=26 延续 ⇒ R6）⇒ 双代管
  const r学生无 = 领班代管({ 上周, 学生决策: {}, 全班默认: 全开 })
  ok(r学生无.代管决策.overbook === 0 && r学生无.代管决策.energy === 23,
    `★ V3 代管生效：学生没做 ⇒ 沿用上周（超售 8 次 ⇒ R3 清零 · 室温延续 26 ⇒ R6 回归）（${JSON.stringify(r学生无.代管决策)}）`,
    JSON.stringify(r学生无.代管决策))
  // (c) 未授权水位线：默认全关 ⇒ 代管空（一步不动）
  const r未授权 = 领班代管({ 上周, 学生决策: {}, 全班默认: null, 学生覆盖: null })
  ok(Object.keys(r未授权.代管决策).length === 0,
    '★ V3 未授权水位线：默认全关 ⇒ 代管决策为空（一步不动 · 公平红线）')
  // (d) 确定性：同状态同授权 ⇒ 同动作（与 (b) 同参数）
  const r重复 = 领班代管({ 上周, 学生决策: {}, 全班默认: 全开 })
  ok(JSON.stringify(r学生无.代管决策) === JSON.stringify(r重复.代管决策), '★ V3 确定性：同状态同授权 ⇒ 同代管（公平红线）')
}

// ⑧ 不双扣锚：客群段源码零引用 roleBonus / decisionRisk / V4 两维系数
{
  const src = readFileSync(path.join(APP, 'src', 'settlement.js'), 'utf8')
  const 段 = /客群结构加权[\s\S]*?goodRate = Math\.max\(Math\.min\(goodRate \+ personaBonus/.exec(src)
  ok(!!段, '客群段可定位（源码结构锚）')
  if (段) {
    // ★ 剥注释再判（守门通则）：不双扣锚判的是【代码引用】，注释里提到"×R6 代价（decisionRisk）"是边界说明
    const 剥注释 = 段[0].split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
    ok(!/roleBonus/.test(剥注释), '★ 不双扣锚：客群段零引用 roleBonus（R4 在差评处理权重链 · 不同事）')
    ok(!/decisionRisk|代价表/.test(剥注释), '★ 不双扣锚：客群段零引用 decisionRisk（R6 代价独立记账）')
    ok(!/房价环境|人力系数/.test(剥注释), '★ 不双扣锚：客群段零引用 V4 两维系数（量的链 vs 质的链分立）')
  }
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('RV：node tests/_rv-33v6.mjs —— 退回旧行为/占比置0仍出反馈/归一化破坏 ⇒ 必红')
process.exit(fail ? 1 : 0)
