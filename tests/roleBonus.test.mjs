// §32-U4-R4 · 职务加成（软约束 ×1.3）—— 守门
// 判据：① 纯函数确定性（同输入同权重）② ×1.3 精确（匹配）③ 未设职务/未知 cause ⇒ ×1.0（不卡进度）
//       ④ **真的进结算**（weekInputs → settle：门槛与口碑增益都按权重走）⑤ 结构（Edge 登记 · 界面提示 · 逐卡留痕）
// 运行：node tests/roleBonus.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { settle } from '../src/settlement.js'
import { settleInputsFrom, weekInputsOf, WEEK_INPUTS_VERSION } from '../src/weekInputs.mjs'
import { 处理权重, 有效处理权重, 职务匹配, 责任职务, 职务标签, 建议职务文案, ROLE_BONUS, 责任职务表 } from '../src/roleBonus.mjs'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rd = (p) => { try { return readFileSync(path.join(APP, p), 'utf8') } catch (e) { return '' } }
const 剥注释 = (t) => t.split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ §32-U4-R4 职务加成（对应职务处理 ⇒ ×1.3 · 所有人仍能处理）')

console.log('\n[1] 纯函数：×1.3 精确 · 未知/未设 ⇒ ×1.0')
{
  ok(ROLE_BONUS === 1.3, `倍率 = ${ROLE_BONUS}（单元卡 §3 口径）`)
  ok(处理权重('clean', 'lobby') === 1.3 && 处理权重('no_room', 'manager') === 1.3, '对应职务 ⇒ ×1.3（clean→lobby · no_room→manager）')
  ok(处理权重('clean', 'finance') === 1 && 处理权重('clean', null) === 1 && 处理权重('clean', undefined) === 1, '非对应/未设职务 ⇒ ×1.0（★ 所有人仍能处理 · 不卡进度）')
  ok(处理权重('某个没见过的原因', 'lobby') === 1.3 && 责任职务('某个没见过的原因') === 'lobby', '未知 cause ⇒ 默认归 lobby（不臆造新职务 · 但也不报错）')
  ok(职务匹配('price', 'ops') && 职务匹配('staff', 'hr') && 职务匹配('cost', 'finance'), '映射表按 owner 词表：价格→ops · 人力→hr · 成本→finance')
  const 表值 = Object.values(责任职务表).filter(v => v !== 'default')
  ok(表值.every(v => ['lobby', 'finance', 'hr', 'ops', 'manager'].includes(v)), '责任职务只落在 decisions 的 5 个 owner 词汇内（不另立命名）')
  ok(JSON.stringify(处理权重('clean', 'lobby')) === JSON.stringify(处理权重('clean', 'lobby')), '确定性：同输入同权重（无随机/无时间）')
  ok(建议职务文案('clean').includes('大堂经理') && 建议职务文案('clean').includes('+30%'), `提示文案单源：${建议职务文案('clean')}`)
  ok(Object.keys(职务标签).length === 5, '五个职务标签齐（界面提示用）')
  // ★ 单元卡验收的"+5 vs +6.5"读法：5 张差评 · 匹配职务 ⇒ 有效处理量 5 × 1.3 = 6.5
  const 卡s = Array.from({ length: 5 }, (_, i) => ({ id: 'w1-' + i, status: 'resolved', cause: 'clean', handledByRole: 'lobby' }))
  ok(有效处理权重(卡s) === 6.5, `5 张对岗处理 ⇒ 有效处理量 ${有效处理权重(卡s)}（= 5 × 1.3 · 对应单元卡"组长 +5 vs 大堂 +6.5"）`)
  ok(有效处理权重(卡s.map(c => ({ ...c, handledByRole: 'hr' }))) === 5, '同 5 张但处理人是别岗 ⇒ 有效量 5.0（×1.0）')
  ok(有效处理权重(卡s.map(c => ({ ...c, handledByRole: null }))) === 5, '未设职务 ⇒ 5.0（旧行为 · 零变化）')
}

console.log('\n[2] 进结算：weekInputs 产出权重 → settle 按权重给口碑增益（真的被消费）')
{
  const 卡 = [{ id: 'w1-a', status: 'resolved', cause: 'clean', handledByRole: null }, { id: 'w1-b', status: 'resolved', cause: 'clean', handledByRole: null }]
  const 无职务 = settleInputsFrom({ reviews: 卡, week: 1 })
  const 对岗 = settleInputsFrom({ reviews: 卡.map(c => ({ ...c, handledByRole: 'lobby' })), week: 1 })
  ok(无职务.resolvedCount === 2 && 无职务.resolvedWeight === 2, `未设职务：resolvedCount ${无职务.resolvedCount} · 权重 ${无职务.resolvedWeight}（= 计数 ⇒ 零变化）`)
  ok(对岗.resolvedWeight === 2.6, `对岗：权重 ${对岗.resolvedWeight}（= 2 × 1.3 · 与计数分离）`)
  const 基 = { site: { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3 }, brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }, decisions: { pricing: '不跟降' }, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } }
  // 事件是概率性的（rand）⇒ 用固定周号遍历出一周触发，比较"有/无权重"的增益文案
  let 命中 = null
  for (let w = 1; w <= 30 && !命中; w++) {
    const r0 = settle({ ...基, week: w, resolvedCount: 2 })
    const e0 = (r0.events || []).find(e => e.name.includes('整改获认可'))
    if (!e0) continue
    const r1 = settle({ ...基, week: w, resolvedCount: 2, resolvedWeight: 2.6 })
    const e1 = (r1.events || []).find(e => e.name.includes('整改获认可'))
    命中 = { w, e0, e1, r0, r1 }
  }
  ok(!!命中, `找到触发「整改获认可」的周（w${命中 && 命中.w}）—— 该事件是条件概率，遍历取样而非写死`)
  if (命中) {
    ok(命中.e0.impact.includes('+2.0%') && 命中.e1.impact.includes('+2.6%'), `增益按权重：无权重 ${命中.e0.impact} vs 对岗 ${命中.e1.impact}（2% × 1.3 = 2.6%）`)
    ok(!命中.e0.text.includes("', impact:"), '★ 顺手修掉学生可见文本 bug：正文不再混入 `\', impact: …`（原字符串引号写崩）')
  }
  ok(weekInputsOf({ weekInputs: { ...无职务, week: 1 } }, 1)?.resolvedCount === 2, 'weekInputsOf 仍能读回（版本/周号校验不受影响）')
  ok(WEEK_INPUTS_VERSION >= 1, `版本号 ${WEEK_INPUTS_VERSION}（新增字段向后兼容：旧存档无 resolvedWeight ⇒ settle 回退计数）`)
}

console.log('\n[3] 结构：Edge 登记 · 界面提示 · 逐卡留痕 · 未设职务不阻塞')
{
  const be = rd('scripts/build-edge-function.mjs')
  ok(/roleBonus\.mjs/.test(be), '★ Edge 组装清单已登记 roleBonus.mjs（漏登 = 部署后 404 · 已踩 6 次）')
  const wi = 剥注释(rd('src/weekInputs.mjs'))
  ok(/有效处理权重/.test(wi) && /resolvedWeight/.test(wi), 'weekInputs 真的产出 resolvedWeight（不是只声明）')
  const st = 剥注释(rd('src/settlement.js'))
  ok(/const 有效处理数 = /.test(st) && /有效处理数 >= EVENT_CONFIG/.test(st) && /权重比/.test(st), 'settle 真的消费权重（门槛 + 增益都按有效处理数）')
  ok(/resolvedWeight = null/.test(st) && /Number\.isFinite\(Number\(resolvedWeight\)\)/.test(st), '缺省/非法权重 ⇒ 回退 resolvedCount（旧调用零变化）')
  const rep = rd('src/Reputation.jsx')
  ok(/建议职务文案/.test(rep) && /handledByRole: groupRole/.test(rep), '口碑页：卡片显示建议职务 + 处理时留痕 handledByRole')
  ok(!/disabled.*建议职务|disabled.*职务/.test(rep), '提示不阻塞操作（未设职务/非对岗仍可处理 —— 不卡进度）')
  const app = rd('src/App.jsx')
  ok(/<Reputation[^>]*groupRole=\{/.test(app), 'App 把 groupRole 传进口碑页（职务来源 = profiles.role_in_group）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('RV（可执行 · 需实测）：node tests/_rv-32u4.mjs —— 把 ×1.3 改回 ×1.0 ⇒ 本套件必红')
process.exit(fail ? 1 : 0)
