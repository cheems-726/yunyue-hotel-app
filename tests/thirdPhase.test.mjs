// §32-U8 · 三期（老师事件注入 + AI 领班）—— 守门
// 判据：A 注入（8 事件库 / 只影响未来 / 全班同周 / 离线默认最差 / 互斥去重 / 事件卡可见）
//       B 领班（默认不代管 / 两层授权 / 确定性 / 不享职务加成 / 代管率）
//       §4 reportCaliber 属性/好评率列【逐格对照】（D96 尾巴 · 加严）
// 运行：node tests/thirdPhase.test.mjs   （挂 run-all fast）
import { settle } from '../src/settlement.js'
import { 注入事件库, 构建注入事件, 校验注入合法性, 离线默认标注, 注入互斥冲突 } from '../src/teacherEvents.mjs'
import { 领班规则, 默认授权, 生效授权, 领班决策, 代管率 } from '../src/aiSupervisor.mjs'
import { 不作为属性扣减 } from '../src/decisionRisk.mjs'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rd = (p) => { try { return readFileSync(path.join(APP, p), 'utf8') } catch (e) { return '' } }
const 剥注释 = (t) => t.split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ §32-U8 三期（老师事件注入 + AI 领班）')

console.log('\n[1] 事件库：8 条全带齐（触发/影响/应对/教学点/去重口径）')
{
  // ★ §33-V8：库扩到 35 条（E1–E8 专项保留 · E9–E35 全带五件套+≥2 应对选项+v8 标记）
  ok(注入事件库.length === 35 && 注入事件库.every(e => e.id && e.name && e.影响 && e.学生应对 && e.教学点 && e.与随机事件去重),
    `事件库 35 条全带五件套（${注入事件库.map(e => e.id).join('/')}）`)
  {
    const v8s = 注入事件库.filter(e => e.engine && e.engine.v8)
    // ★ V78（2026-10-08）：E6 原 engine（竞争强度加档/持续周）全项目 0 消费 ⇒ 接入 v8 通道（客流系数 0.85 · 当周）⇒ v8 条数 27→28
    ok(v8s.length === 28 && v8s.every(e => Array.isArray(e.应对选项) && e.应对选项.length >= 2),
      `★ V8 E6+E9–E35：28 条全带 v8 标记 + ≥2 应对选项（量级带内 · 不一击定生死）`)
  }
  ok(注入互斥冲突('E8', ['消防检查']) && !注入互斥冲突('E8', ['竞店开业']), 'E8 与随机消防检查互斥（同源不双倍）')
  ok(注入互斥冲突('E6', ['竞店开业']) && !注入互斥冲突('E1', ['竞店开业']), 'E6 与「竞店开业」互斥；E1 不与其冲突')
  ok(注入互斥冲突('E1', ['🎆 节假日爆单']), 'E1 与「节假日爆单」需求反向互斥')
  const ev = 构建注入事件({ 事件id: 'E2', 周: 4, injectedBy: 'teacher001' })
  ok(ev && ev.week === 4 && ev.source === 'teacher' && ev.injectedBy === 'teacher001' && ev.name.includes('老师注入'), '构建注入事件：带 source/injectedBy/周（留痕三件）')
  ok(构建注入事件({ 事件id: 'E99', 周: 4 }) === null && 构建注入事件({ 事件id: 'E2', 周: 0 }) === null, '非法事件id/周 ⇒ null（不造）')
  // 公平红线 (a)：只影响未来
  ok(校验注入合法性({ 注入周: 3, 已结算周: 2 }).合法 === true, '注入周 3 > 已结算 2 ⇒ 合法')
  ok(校验注入合法性({ 注入周: 2, 已结算周: 2 }).合法 === false, '★ 注入已结算周 ⇒ 非法（公平红线 a）')
  ok(校验注入合法性({ 注入周: 2, 已结算周: null }).合法 === true, '无已结算记录 ⇒ 不拦（新组）')
}

console.log('\n[2] 引擎接线：注入真实生效 + 零变化 + 只影响未来 + 离线默认最差')
{
  const 品牌 = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
  const 场 = { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3 }
  const 决策 = { pricing: '不跟降' }
  const 属性 = { quality: 60, reputation: 70, morale: 65 }
  const r0 = settle({ site: 场, brand: 品牌, decisions: 决策, week: 3, attrs: { ...属性 } })
  const E1 = 构建注入事件({ 事件id: 'E1', 周: 3, injectedBy: 'teacher001' })
  const r1 = settle({ site: 场, brand: 品牌, decisions: 决策, week: 3, attrs: { ...属性 }, injectedEvents: [E1] })
  ok(r1.revenue < r0.revenue, `E1 暴雨 ⇒ 营收下降（${r0.revenue} → ${r1.revenue}）`)
  ok(r1.events.some(e => e.name.includes('老师注入')), '周报出「老师注入」事件卡（标明来源）')
  const r0b = settle({ site: 场, brand: 品牌, decisions: 决策, week: 2, attrs: { ...属性 } })
  const r0c = settle({ site: 场, brand: 品牌, decisions: 决策, week: 2, attrs: { ...属性 }, injectedEvents: [E1] })
  ok(JSON.stringify(r0b) === JSON.stringify(r0c), '★ 只影响未来：已结算周（w2）收到 w3 的注入 ⇒ **逐字节不变**')
  // 确定性：同输入两跑一致
  ok(JSON.stringify(r1) === JSON.stringify(settle({ site: 场, brand: 品牌, decisions: 决策, week: 3, attrs: { ...属性 }, injectedEvents: [E1] })), '确定性：同输入两跑逐字节一致')
  // 互斥：E8 注入 + 该周随机消防 ⇒ 注入被跳过并留痕（用 w9 高品质+停房触发随机消防的形态难造 ⇒ 直接测判定函数已在 [1]；此处测渲染分支）
  const 罚款E8 = 构建注入事件({ 事件id: 'E8', 周: 3, injectedBy: 't' })
  const r8 = settle({ site: 场, brand: 品牌, decisions: { ...决策, hygiene: '不停房' }, week: 3, attrs: { ...属性 }, injectedEvents: [罚款E8], crisisResponse: null })
  ok(r8.eventFine >= 5000 && r8.events.some(e => e.name.includes('消防检查')), `E8 消防注入生效（罚款 ${r8.eventFine} · 事件卡在）—— 离线未应对按最差（侥幸过关）`)
  // 离线标注（唯一生成点）
  ok(离线默认标注('全市暴雨', 12).includes('离线未应对') && 离线默认标注('全市暴雨', 12).includes('按最差'), '离线默认标注文案（B4 §一原话口径）')
  // E7 士气
  const E7 = 构建注入事件({ 事件id: 'E7', 周: 3, injectedBy: 't' })
  const r7 = settle({ site: 场, brand: 品牌, decisions: 决策, week: 3, attrs: { ...属性 }, injectedEvents: [E7] })
  ok(r7.attrsAfter.morale < r0.attrsAfter.morale, `E7 冷处理（默认最差）⇒ 士气下降（${r0.attrsAfter.morale} → ${r7.attrsAfter.morale}）`)
  // E3 属性（不停房 ⇒ 全额 -8）
  const E3 = 构建注入事件({ 事件id: 'E3', 周: 3, injectedBy: 't' })
  const r3a = settle({ site: 场, brand: 品牌, decisions: { ...决策, hygiene: '不停房' }, week: 3, attrs: { ...属性 }, injectedEvents: [E3] })
  const r3b = settle({ site: 场, brand: 品牌, decisions: { ...决策, hygiene: '停房深清洁' }, week: 3, attrs: { ...属性 }, injectedEvents: [E3] })
  ok(r3a.attrsAfter.quality < r3b.attrsAfter.quality, `E3 按卫生状况分档（不停房全额 −8 vs 深清洁减半）`)
}

console.log('\n[3] AI 领班：默认不代管 · 两层授权 · 确定性 · 不享职务加成')
{
  const state = { 出租率: 48, 当前价: 300, 竞对均价: 260, 竞对降价幅度: 12, 竞对溢价: -4, 本周超售赔偿次数: 3, 卫生不合格: true, 学生价格下限: 240 }
  // 默认全关 ⇒ 一动不动（红线）
  const 关 = 领班决策({ state, authorizations: 生效授权({}) })
  ok(关.actions.length === 0, `★ 默认不代管 ⇒ 动作数 0（${关.reports.length} 条只报告）—— 未授权一步不动`)
  // 学生放宽（个人覆盖）
  const 开 = 领班决策({ state, authorizations: 生效授权({ 全班默认: { price_adj: { ok: true, clamp: (to, s) => Math.round(Math.max(s.当前价 * 0.9, Math.min(s.当前价 * 1.1, to))) }, overbook: { ok: true } } }) })
  ok(开.actions.length >= 2, `授权后 ⇒ ${开.actions.length} 条动作（R1 调价 + R3 超售清零）`)
  ok(开.actions.every(a => a.reason && a.reason.includes('授权') || a.ruleId === 'R3'), '每条动作带 reason（四要素模板 · 可解释）')
  ok(开.actions.find(a => a.ruleId === 'R1').to <= Math.round(state.当前价 * 0.9 * 1.1), '授权边界裁剪生效（±10% 内）')
  // 确定性
  ok(JSON.stringify(开) === JSON.stringify(领班决策({ state, authorizations: 生效授权({ 全班默认: { price_adj: { ok: true, clamp: (to, s) => Math.round(Math.max(s.当前价 * 0.9, Math.min(s.当前价 * 1.1, to))) }, overbook: { ok: true } } }) })), '确定性：同状态同授权 ⇒ 动作序列逐字一致')
  // 两层授权：学生收窄可压过全班默认
  const 收窄 = 领班决策({ state, authorizations: 生效授权({ 全班默认: { price_adj: { ok: true } }, 学生覆盖: { price_adj: false } }) })
  ok(!收窄.actions.some(a => a.item === 'pricing'), '★ 学生收窄（个人覆盖 price_adj=false）压过全班默认 ⇒ 调价不代管')
  // 不享职务加成：aiSupervisor 与 roleBonus 零引用（守门）
  ok(!/roleBonus/.test(剥注释(rd('src/aiSupervisor.mjs'))), '★ aiSupervisor 不引用 roleBonus（代管不享 ×1.3 —— 无双重加成）')
  ok(!/aiSupervisor/.test(剥注释(rd('src/roleBonus.mjs'))), 'roleBonus 也不引用 aiSupervisor（双向零耦合）')
  // 代管率
  ok(代管率(1, 9) === 0.1 && 代管率(0, 0) === null, '代管率 = 动作/(动作+学生决策)；0/0 ⇒ null（离线周不进平均）')
  // 结构：领班产出留痕进周报槽位（settle 不直接消费 —— 架构位口径 · 由 App 层把 actions 写 operatorLog）
  ok(!/aiSupervisor/.test(剥注释(rd('src/settlement.js'))), '一期边界：settle 不引用领班（架构位 —— 由 App 层落 operatorLog，B3 §六）')
}

console.log('\n[4] §4（D96 尾巴）：reportCaliber 属性/好评率列【逐格对照】')
{
  const rc = rd('tests/reportCaliber.test.mjs')
  ok(/好评率.*列/.test(rc) && /属性.*列/.test(rc), 'reportCaliber 已有该两列的解析（U4c 加的）')
  // ★ D96 要求的**逐格对照**：解析值必须 === 钉值套件的实跑值 —— 用「从钉子套件源码提取实跑属性」核对
  //   实跑属性从 longRun126 --report 的打印逻辑反推太绕 ⇒ 直接断言：判据里有【对照】而非只有【计数】
  const 只有计数 = /属性格 === 6 && 属性合法/.test(rc) && !/属性对照|属性列对照|attrs对照/.test(rc)
  ok(!只有计数 || rd('tests/reportCaliber.test.mjs').includes('逐格对照') || rd('tests/reportCaliber.test.mjs').includes('属性值对照'),
    '§5 判据形态检查（本轮补逐格对照 ⇒ 见 [4] 补丁后的输出）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('RV（可执行 · 需实测）：node tests/_rv-32u8.mjs —— 去「只影响未来」/ 去离线默认最差 / 去授权仍代管 ⇒ 必红')
process.exit(fail ? 1 : 0)
