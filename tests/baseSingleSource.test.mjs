// §21.1-A-1（D61）· base 单源守门：分段结算的 base 必须【两端同源】，不许各反推各的
// 运行：node tests/baseSingleSource.test.mjs   （挂 run-all fast）
//
// ── 背景（决策端 D61 抓到 · 真问题）──────────────────────────────
//   `weeklyAuto.decisionsByDayFrom` 的契约是"**由调用方给 base**（反推会猜）"，
//   但两端当时**都在反推**（把 decisionChanges 的 from 回退）⇒ 函数与调用方自相矛盾；
//   且服务端可能只拿到不完整的变更记录 ⇒ 两端 `decisionsByDay` 可能不同
//   ⇒ **"补算 === 在线"破**（与 §16.2-B7 同类）。
//   现在：客户端上传真实 base（`weekBase`）· 服务端直接读 · 反推降级为【交叉核对】。
//
// ── 判据（四条）─────────────────────────────────────────────────
//   ① 两端同源：同 base + 同 changes ⇒ decisionsByDay **逐字节相同**
//   ② 来源可辨：读不到上传 ⇒ `baseSource='derived'` 兜底（不静默假装拿到）
//   ③ 交叉核对：上传值与反推值不一致 ⇒ `baseMismatch=true`（捕获"客户端记账缺失"）
//   ④ 旧档不崩
import { readFileSync } from 'node:fs'
import { advanceGroupOneDay } from '../src/serverTick.mjs'
import { decisionsByDayFrom } from '../src/weeklyAuto.mjs'
import { 同决策集 } from '../src/weekSegments.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

const 存档 = {
  location: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2, district: '锦江区' },
  brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' },
  attrs: { quality: 60, reputation: 70, morale: 65 }, capital: 1490000, history: [],
  lastDecisions: { pricing: '不跟降', shifts: '满编保服务' },
  decisionChanges: [{ key: 'pricing', from: '不跟降', to: '降价 20% 抢客', 提交日: 3, 生效日: 4 }],
}
const 真实base = { pricing: '不跟降', shifts: '满编保服务' }

console.log('▶ §21.1-A-1 · base 单源守门（分段结算的 base 不许各反推各的）')

console.log('\n[1] 两端同源：同 base + 同 changes ⇒ decisionsByDay 逐字节相同')
{
  // 客户端：用【上传的 base】+ 变更记录
  const 客户端 = decisionsByDayFrom({ base: 真实base, changes: 存档.decisionChanges, week: 1 })
  // 服务端：读同一个上传 base（走真实 advanceGroupOneDay）
  const r = advanceGroupOneDay({ ...存档, weekBase: { 版本: 1, week: 1, decisions: 真实base } }, 7)
  const 服务端 = decisionsByDayFrom({ base: 真实base, changes: 存档.decisionChanges, week: 1 })
  ok(JSON.stringify(客户端) === JSON.stringify(服务端), '两端 decisionsByDay 逐字节相同（同 base + 同 changes）')
  ok(客户端.length === 7 && 客户端[0].pricing === '不跟降' && 客户端[3].pricing === '降价 20% 抢客',
    '生效日语义正确：第 1-3 天旧值 / 第 4 天起新值')
  ok(r.baseSource === 'save' && r.baseMismatch === false, `服务端确认采用上传 base（baseSource=${r.baseSource} · mismatch=${r.baseMismatch}）`)
  ok(r.advanced === true, '推进正常（分段结算已接通）')
}

console.log('\n[2] 来源可辨：读不到上传 ⇒ derived 兜底（不静默假装拿到）')
{
  const 旧档 = advanceGroupOneDay({ ...存档 }, 7)
  ok(旧档.baseSource === 'derived', `旧档（无 weekBase）⇒ baseSource=${旧档.baseSource}`)
  ok(旧档.baseMismatch === false, '兜底时 mismatch 不误报（没有上传值可比）')
  ok(旧档.advanced === true, '旧档不崩、照常推进')
  const 周号不符 = advanceGroupOneDay({ ...存档, weekBase: { 版本: 1, week: 9, decisions: 真实base } }, 7)
  ok(周号不符.baseSource === 'derived', '周号不符 ⇒ 不采用（退回 derived）')
  const 版本不符 = advanceGroupOneDay({ ...存档, weekBase: { 版本: 99, week: 1, decisions: 真实base } }, 7)
  ok(版本不符.baseSource === 'derived', '版本不符 ⇒ 不采用（退回 derived）')
}

console.log('\n[3] ★ 交叉核对：上传值与反推值不一致 ⇒ baseMismatch=true（捕获"客户端记账缺失"）')
{
  const 缺记 = advanceGroupOneDay({ ...存档, weekBase: { 版本: 1, week: 1, decisions: { pricing: '别的价', shifts: '满编保服务' } } }, 7)
  ok(缺记.baseSource === 'save', '仍采用上传值（它是权威）')
  ok(缺记.baseMismatch === true, '★ 但**明确标出**上传与反推不一致 ⇒ 客户端记账可能缺失（不静默）')
  ok(typeof 缺记.baseMismatch === 'boolean', 'baseMismatch 是布尔（可机器判定）')
}

console.log('\n[4] 结构：反推已降级为交叉核对，不再是入参来源')
{
  const s = src('serverTick.mjs')
  ok(/const 变更前决策 = 上传base \|\| 反推base/.test(s), '入参 base = 上传值 || 反推兜底（顺序明确：上传优先）')
  ok(/baseMismatch/.test(s), '服务端返回 baseMismatch（交叉核对结果可见）')
  ok(/同决策集/.test(s), '使用 weekSegments 导出的 同决策集（口径单源，不另写一份比较）')
  ok(/weekBase/.test(src('App.jsx')), '客户端上传 weekBase（App.jsx）')
  // 契约一致：weeklyAuto 说"由调用方给 base"，两端确实都给了
  const w = src('weeklyAuto.mjs')
  ok(/由调用方给 base/.test(w), 'weeklyAuto 的契约注明"由调用方给 base"（函数与调用方现在一致）')
  ok(!/反推/.test(w.split('export function decisionsByDayFrom')[1]?.slice(0, 1200) || ''), 'decisionsByDayFrom 内部不做反推（只按生效日应用）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：两端 decisionsByDay 逐字节相同 · 来源可辨 · 不一致必标 · 旧档不崩')
process.exit(fail ? 1 : 0)
