// §32-U4c-R6 · 决策风险化 —— 守门
// 判据：① 18 项 × **每个分支**都有条目（含反向分支 —— 硬伤③）· ② 解析器 5 种真实形状 ·
//       ③ 确定性 · ④ 条件挂载（无惩罚不添键 / 0 代价不添键）· ⑤ dir=-1 代价可撤销 ·
//       ⑥ 引擎真实消费（不作为惩罚 + 延迟后果 + 产出 pendingPenalty）·
//       ⑦ ★「只选看起来最好的」⇒ **不是最优**（实跑数字）· ★「不作为对照」（实跑数字）
// 运行：node tests/decisionRisk.test.mjs   （挂 run-all fast）
import { settle } from '../src/settlement.js'
import { applyDecisionToAttrs, ATTR_INIT } from '../src/attrs.js'
import { 代价表, 选项键, 选项代价, 代价文案, 属性代价, 延迟后果, 不作为属性扣减, 本周延迟惩罚, 不作为惩罚, 决策总项数 } from '../src/decisionRisk.mjs'
import { decisions as 全部决策 } from '../src/decisions.js'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rd = (p) => { try { return readFileSync(path.join(APP, p), 'utf8') } catch (e) { return '' } }
const 剥注释 = (t) => t.split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ §32-U4c-R6 决策风险化（每个选项都有代价 · 含反向分支）')

console.log('\n[1] 18 项 × 每分支都有条目（★ 硬伤③：反向分支也要有代价）')
{
  // 每项的所有可能分支键（与解析器同口径）
  const 分支s = (d) => {
    if (d.type === 'option') return d.options.map(o => o.label)
    if (d.type === 'sort') return ['已提交质检', '未提交质检']
    if (d.id === 'overbook') return ['超售（>0 间）', '不超售（0 间）']
    if (d.id === 'energy') return ['偏冷（≤21℃）', '舒适区间（22–24℃）', '偏热（≥25℃）']
    if (d.id === 'member-threshold') return ['门槛低（3–4 晚）', '门槛适中（5–7 晚）', '门槛高（8–10 晚）']
    if (d.id === 'ota') return ['集中投放', '均衡投放']
    if (d.id === 'campaign') return ['已分配预算', '未分配预算']
    return []
  }
  const 金语义 = /成本|营收|出租率|资金|均价|佣金|预算|赔付|支出|转化|客流|满房|曝光|复购|依赖|摊薄|甩卖|让利|流失|含金量|入会|固|赔偿|收益|激励/
  const 缺 = []
  for (const d of 全部决策) {
    const 表 = 代价表[d.id]
    if (!表) { 缺.push(`${d.id}:无表`); continue }
    for (const b of 分支s(d)) {
      const e = 表.选项[b]
      if (!e) 缺.push(`${d.id}·${b}:无条目`)
      else if (!e.代价) 缺.push(`${d.id}·${b}:无代价文案`)
      else if (!e.属性 && !金语义.test(e.代价)) 缺.push(`${d.id}·${b}:代价既无属性也无指标语义`)
    }
  }
  ok(缺.length === 0, `★ 18 项 × 每分支全有条目且带代价语义（缺 ${缺.length}）`, 缺.slice(0, 6).join(' / '))
  ok(Object.keys(代价表).length === 18, `代价表覆盖 18 项（实 ${Object.keys(代价表).length}）`)
  // 解析出的每个键都必须能在表里找到（防"键写了表没有"）
  const 解析缺 = []
  for (const d of 全部决策) {
    for (const b of 分支s(d)) {
      const 形状 = d.type === 'option' ? b
        : d.type === 'sort' ? (b === '已提交质检' ? ['隔音'] : [])
        : d.id === 'overbook' ? (b === '超售（>0 间）' ? 3 : 0)
        : d.id === 'energy' ? (b === '偏冷（≤21℃）' ? 20 : b === '偏热（≥25℃）' ? 26 : 23)
        : d.id === 'member-threshold' ? (b === '门槛低（3–4 晚）' ? 3 : b === '门槛高（8–10 晚）' ? 10 : 6)
        : d.id === 'ota' ? (b === '集中投放' ? { 携程: 80, 美团: 10, 飞猪: 10 } : { 携程: 40, 美团: 30, 飞猪: 30 })
        : (b === '已分配预算' ? { 线上广告: 2500, 门店物料: 2500 } : {})
      if (选项键(d.id, 形状) !== b) 解析缺.push(`${d.id}:「${b}」解析成「${选项键(d.id, 形状)}」`)
    }
  }
  ok(解析缺.length === 0, '★ 每个分支都能被解析器从真实形状还原（解析器 ↔ 表 互锁）', 解析缺.slice(0, 4).join(' / '))
  // 硬伤①：emergency 真实文案
  ok(选项键('emergency', '立即送医+道歉') && 选项键('emergency', '先安抚再处理') && 选项键('emergency', '推卸责任'), '★ emergency 三选项（真实文案）全部有条目 —— 非草案的「提交预案/不提交」')
  // 硬伤③的反向分支
  ok(选项代价('quality-check', []).属性 && 选项代价('quality-check', []).属性.quality === -2, '★ 反向分支「未提交质检」有代价（quality -2 / rep -1）—— 不做不是免费的')
  ok(选项代价('campaign', {}) && 选项代价('campaign', {}).属性, '★ 反向分支「未分配预算」有代价（本批修的不可达分支：空对象 ⇒ 未分配）')
  ok(选项键('campaign', null) === null, 'campaign null ⇒ 未决策（返回 null 走不作为路径，不冒充"未分配"）')
}

console.log('\n[2] 确定性与条件挂载')
{
  ok(JSON.stringify(属性代价('hygiene', '不停房')) === JSON.stringify(属性代价('hygiene', '不停房')), '同输入同代价（确定性）')
  ok(!/Math\.random|Date\.now/.test(剥注释(rd('src/decisionRisk.mjs'))), '零 Math.random / Date.now（公平红线）')
  ok(不作为属性扣减(18) && Object.keys(不作为属性扣减(18)).length === 0, '全决策 ⇒ 无扣减、返回**空对象**（不是 {morale:0,quality:0} —— 0 代价不添键）')
  const 缺2 = 不作为属性扣减(16)
  ok(缺2.morale === -1 && 缺2.quality === -0.5, `缺 2 项 ⇒ morale -1 / quality -0.5（每项 ${JSON.stringify(不作为惩罚.每项)}）`)
  ok(不作为属性扣减(2).morale === -4 && 不作为属性扣减(2).quality === -2, `缺 16 项 ⇒ 按上限 8 项夹取（morale ${不作为属性扣减(2).morale} / quality ${不作为属性扣减(2).quality} = 8 × 每项，上限 ${不作为惩罚.上限项数}）`)
  ok(本周延迟惩罚({ pricing: '不跟降' }) === null, '无延迟项 ⇒ 本周延迟惩罚 = null（条件挂载 · settle 不添键）')
  const 有延迟 = 本周延迟惩罚({ 'hr-optimize': '裁员1人', 'quality-check': ['隔音'] })
  ok(有延迟 && 有延迟.项.length === 2 && 有延迟.项.every(x => x.属性 && x.文案), '有延迟项（裁员/质检）⇒ {项:[{来源,文案,属性}]}')
  ok(代价文案('pricing', '不跟降').startsWith('代价：'), '代价文案单源（界面只渲染，前缀"代价："）')
}

console.log('\n[3] dir=-1 代价可撤销（改答案不白吃代价）')
{
  const 全 = Object.fromEntries(全部决策.map(d => [d.id, d.type === 'option' ? d.options[0].label : d.type === 'sort' ? ['隔音'] : d.type === 'slider' ? (d.min ?? 0) : {}]))
  // 应用 → 撤销：quality/reputation/morale 应回到基线（同一次变换的逆）
  const 加 = applyDecisionToAttrs(ATTR_INIT, 'hygiene', '不停房', 1)
  const 撤 = applyDecisionToAttrs(加, 'hygiene', '不停房', -1)
  ok(撤.quality === ATTR_INIT.quality && 撤.reputation === ATTR_INIT.reputation && 撤.morale === ATTR_INIT.morale,
    `hygiene 不停房（规格-3 + R6代价-2）应用后 quality ${加.quality} ⇒ 撤销后回 ${撤.quality}（代价随 dir=-1 一并撤销）`)
  const 加2 = applyDecisionToAttrs(ATTR_INIT, 'hr-optimize', '裁员1人', 1)
  const 撤2 = applyDecisionToAttrs(加2, 'hr-optimize', '裁员1人', -1)
  ok(撤2.morale === ATTR_INIT.morale, `裁员1人（规格-15 + R6代价-2）撤销后 morale 回 ${撤2.morale}`)
  void 全
}

console.log('\n[4] 引擎真实消费（不作为惩罚 + 延迟后果 + 产出下周惩罚）')
{
  const 基 = { site: { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3 }, brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }, week: 2, attrs: { quality: 60, reputation: 70, morale: 65 } }
  const 全决策档案 = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '外包', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', energy: 23, overbook: 0, 'member-threshold': 6, 'report-diagnosis': '解决利润相关', 'revenue-mgmt': '连住优惠', corporate: '让利签约', ota: { 携程: 40, 美团: 30, 飞猪: 30 }, campaign: { 线上广告: 2500, 门店物料: 2500 }, 'quality-check': ['隔音'], renovation: '不投', emergency: '立即送医+道歉' }
  const r全 = settle({ ...基, decisions: 全决策档案 })
  const r缺 = settle({ ...基, decisions: { pricing: '不跟降' } })
  ok(r全.attrsAfter.morale > r缺.attrsAfter.morale, `★ 不作为对照（属性）：全 18 项 morale ${r全.attrsAfter.morale} vs 只 1 项 ${r缺.attrsAfter.morale}（不作为被显式惩罚）`)
  // ★ §32-U4c（RV-3 的靶子）：只受**不作为惩罚**影响的断言（不含延迟 —— 两条路径要能分别证伪）
  ok(r缺.r6属性后果 && r缺.r6属性后果.不作为 && r缺.r6属性后果.不作为.缺项数 === 17, `缺 17 项 ⇒ r6属性后果.不作为.缺项数 = 17（留痕）`)
  ok(r缺.r6属性后果.不作为 && Number.isFinite(r缺.r6属性后果.不作为.morale) && r缺.r6属性后果.不作为.morale < 0, `不作为惩罚量随缺项数现算（morale ${r缺.r6属性后果.不作为.morale} < 0）—— RV-3 摘除该惩罚 ⇒ 此条必红`)
  ok(!('r6属性后果' in r全) || r全.r6属性后果 == null, '全决策 ⇒ r6属性后果不添键（条件挂载）')
  // 延迟后果：w1 裁员 ⇒ w2 品质更低
  const w1 = settle({ ...基, week: 1, decisions: { ...全决策档案, 'hr-optimize': '裁员1人' } })
  ok(w1.pendingPenalty && w1.pendingPenalty.startWeek === 2 && w1.pendingPenalty.项.some(x => x.来源 === 'hr-optimize'), `w1 裁员 ⇒ 产出 pendingPenalty（startWeek=2 · 来源 ${w1.pendingPenalty.项.map(x => x.来源).join('/')}）`)
  const w2无 = settle({ ...基, week: 2, decisions: { ...全决策档案, 'hr-optimize': '全员培训' } })
  const w2有 = settle({ ...基, week: 2, decisions: { ...全决策档案, 'hr-optimize': '全员培训' }, pendingPenalty: w1.pendingPenalty })
  ok(w2有.attrsAfter.quality < w2无.attrsAfter.quality, `★ 延迟后果：w1 裁员 ⇒ w2 品质 ${w2有.attrsAfter.quality} < 无延迟 ${w2无.attrsAfter.quality}（这周省的钱，下周才发作）`)
  ok((w2有.events || []).some(e => e.name.includes('延迟代价')), '延迟发作周有事件留痕（学生可见 · 事件「上周决策的延迟代价」）')
  const 旧档 = settle({ ...基, week: 2, decisions: 全决策档案, pendingPenalty: null })
  ok(!('r6属性后果' in 旧档) || 旧档.r6属性后果 == null, '旧档（pendingPenalty=null）⇒ 行为与改造前一致')
}

console.log('\n[5] ★ 硬验收：只选"看起来最好"⇒ 不是最优（实跑）')
{
  // 三种策略 × 12 周真实链路（属性轨迹 + prevCapital），同一初始
  const 品牌 = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
  const 场 = { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3 }
  const 跑季 = (decisions, 覆盖 = {}) => {
    let attrs = { ...ATTR_INIT }, cap = null
    const history = []
    for (let w = 1; w <= 12; w++) {
      const r = settle({ site: 场, brand: 品牌, decisions: { ...decisions, ...覆盖 }, week: w, attrs: { ...attrs }, prevCapital: cap })
      history.push(r); cap = r.capital; attrs = r.attrsAfter
    }
    return { 期末: cap, history }
  }
  // "看起来最好"= 每项都挑**无当期显性成本**的省事选项（学生直觉上的"聪明"打法）
  const 省事 = { pricing: '不跟降', shifts: '精简省成本', hygiene: '不停房', linen: '自洗', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 20, overbook: 0, 'member-threshold': 3, 'report-diagnosis': '解决成本相关', 'revenue-mgmt': '连住优惠', corporate: '坚守价格', ota: { 携程: 100, 美团: 0, 飞猪: 0 }, campaign: {}, 'quality-check': [], renovation: '不投', emergency: '推卸责任' }
  // 常规经营（与基准锚点同源的 7 项 + 全量补齐，平衡打法）
  const 常规 = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', energy: 23, overbook: 0, 'member-threshold': 6, 'report-diagnosis': '解决利润相关', 'revenue-mgmt': '连住优惠', corporate: '让利签约', ota: { 携程: 40, 美团: 30, 飞猪: 30 }, campaign: { 线上广告: 2500, 门店物料: 2500 }, 'quality-check': ['隔音'], renovation: '不投', emergency: '立即送医+道歉' }
  const A = 跑季(省事), B = 跑季(常规)
  console.log(`     「省事」策略期末 ${A.期末} · 「常规」策略期末 ${B.期末} · 差 ${A.期末 - B.期末}`)
  const 属性A = A.history[11].attrsAfter, 属性B = B.history[11].attrsAfter
  const 属性和 = (x) => x.quality + x.reputation + x.morale
  ok(B.期末 > A.期末 || 属性和(属性B) > 属性和(属性A),
    `★「只选看起来最好的（省事）」不是最优：期末资金 ${A.期末} vs 常规 ${B.期末} · 属性和 ${属性和(属性A)} vs ${属性和(属性B)}`)
  // 全不决策（1 项都不做）vs 常规
  const 空 = 跑季({ pricing: '不跟降' })
  console.log(`     全不决策期末 ${空.期末} · 属性和 ${属性和(空.history[11].attrsAfter)}`)
  ok(属性和(空.history[11].attrsAfter) < 属性和(B.history[11].attrsAfter) && 空.期末 < B.期末,
    `★ 不作为对照：全不决策（期末 ${空.期末} · 属性和 ${属性和(空.history[11].attrsAfter)}）双输于常规（${B.期末} · ${属性和(B.history[11].attrsAfter)}）—— 不作为有惩罚`)
}

console.log('\n[6] 结构（防悄悄拆）')
{
  const st = 剥注释(rd('src/settlement.js'))
  ok(/不作为属性扣减\(doneCount\)/.test(st) && /本周延迟惩罚\(decisions\)/.test(st), 'settle 真调用两件（不作为 + 延迟）')
  ok(/\.\.\.\(r6下周惩罚 \? \{ pendingPenalty/.test(st) || /pendingPenalty: \{\.\.\.r6下周惩罚/.test(st), '产出 pendingPenalty 为条件挂载（无 ⇒ 不添键）')
  const at = 剥注释(rd('src/attrs.js'))
  ok(/applyDecisionToAttrs[\s\S]*属性代价/.test(at), 'attrs 落代价（收益 + 代价同处）')
  const dp = rd('src/DecisionPanel.jsx')
  ok(/代价文案\(decision\.id/.test(dp) && !/代价：.*省/.test(dp.replace(/代价文案[\s\S]*?\)/g, '')), '面板渲染代价行（调单源，不自拼）')
  const be = rd('scripts/build-edge-function.mjs')
  ok(/decisionRisk\.mjs/.test(be), 'Edge 组装已登记 decisionRisk.mjs')
  ok(/\.js'?\)\)? continue/.test(be.replace(/\r\n/g, '\n')) === false || /\.js/.test(be.split('readdirSync(OUT)')[1] || ''), '闭包判据扫描范围含 .js（§5①）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('RV（可执行 · 需实测）：node tests/_rv-32u4c.mjs —— 把"未提交质检"/"裁员1人"改回纯收益 ⇒ 必红')
process.exit(fail ? 1 : 0)
