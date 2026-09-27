// Wave 1 · W1-4 ★ 防作弊三件套验收（T3.6）
// 运行：node tests/antiCheat.test.mjs   （已挂 run-all）
// 验收（§二十二·三 W1-4）：**篡改一条 log → 报断点；提交越界决策 → 被拒**
import {
  fnv1a, entryIdOf, appendEntry, chainHash, verifyChain, detectUniformPattern, CHAIN_GENESIS,
} from '../src/decisionLogIntegrity.mjs'
import { validateDecisions, validateStateBounds, NUMERIC_BOUNDS } from '../src/serverTick.mjs'
import { decisions as DECISIONS } from '../src/decisions.js'
import { readFileSync } from 'node:fs'

const APP = 'D:/教学app/hotel-app/'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const read = (p) => readFileSync(APP + p, 'utf8')

const mkLog = () => {
  let log = []
  const add = (e) => { log = appendEntry(log, e).log }
  add({ day: 1, item: 'pricing', to: '不跟降', type: 'realtime', confirmed: true })
  add({ day: 1, item: 'shifts', to: '满编保服务', type: 'realtime', confirmed: true })
  add({ day: 2, item: 'pricing', to: '跟降 10%', type: 'realtime', confirmed: true })
  add({ day: 2, item: 'hygiene', to: '停房深清洁', type: 'periodic', confirmed: true })
  return log
}

console.log('▶ Wave 1 · W1-4 防作弊三件套（T3.6）')

console.log('\n[1] ① 链式校验：正常链通过')
{
  const log = mkLog()
  const v = verifyChain(log)
  ok(v.ok === true && v.brokenAt === null, `4 条正常链校验通过（length=${v.length}）`)
  ok(chainHash([]).hash === CHAIN_GENESIS, `空链 hash = '${CHAIN_GENESIS}'（genesis）`)
  ok(log.every(e => typeof e.hash === 'string' && e.hash.length === 8), '每条都带 8 位 hash')
  ok(log.every((e, i) => e.prevHash === (i === 0 ? CHAIN_GENESIS : log[i - 1].hash)), 'prevHash 逐条串联正确')
  ok(log.every(e => typeof e.entryId === 'string' && e.entryId.length === 8), '每条都带稳定 entryId')
}

console.log('\n[2] ★ 验收①：篡改一条 → 报断点（位置精确）')
{
  const log = mkLog()
  for (const idx of [0, 1, 2, 3]) {
    const t = JSON.parse(JSON.stringify(log))
    t[idx].to = '被改过的值'
    const v = verifyChain(t)
    ok(v.ok === false && v.brokenAt === idx, `篡改第 ${idx + 1} 条 → 断点在 index ${v.brokenAt}（期望 ${idx}）`)
  }
  // 改写存储的 entryId 字段也必须被检出
  //   注意原理：entryId 是【由内容派生】的，权威值永远重算 ⇒ 只改 id 字段不改内容时，
  //   链本身仍然自洽，但"存储值 ≠ 派生值"这件事本身暴露了篡改。
  const t2 = JSON.parse(JSON.stringify(log)); t2[2].entryId = 'deadbeef'
  const v2 = verifyChain(t2)
  ok(v2.ok === false && v2.brokenAt === 2 && /entryId/.test(v2.reason || ''),
    `改写 entryId 字段 → 在 index ${v2.brokenAt} 报「${v2.reason}」`)
  // 反向：不改内容、不改 id、只重算（合法重建）→ 仍然通过
  ok(verifyChain(JSON.parse(JSON.stringify(log))).ok === true, '原样复制 → 仍通过（无误报）')
}

console.log('\n[3] 删除 / 插入也会被检出（链式校验的两大经典攻击）')
{
  const log = mkLog()
  const del = JSON.parse(JSON.stringify(log)); del.splice(1, 1)
  const vd = verifyChain(del)
  ok(vd.ok === false && vd.brokenAt === 1, `删除第 2 条 → 断点 index ${vd.brokenAt}`)
  const ins = JSON.parse(JSON.stringify(log))
  ins.splice(1, 0, { day: 9, item: 'hack', to: 'x', type: 'realtime', confirmed: true, entryId: '00000000', prevHash: log[0].hash, hash: 'ffffffff' })
  const vi = verifyChain(ins)
  ok(vi.ok === false && vi.brokenAt === 1, `插入伪造条目 → 断点 index ${vi.brokenAt}`)
  // 追加（正常操作）不算断链
  const appended = appendEntry(log, { day: 3, item: 'linen', to: '自洗', type: 'once', confirmed: true }).log
  ok(verifyChain(appended).ok === true, '正常 append（追加）不触发断链')
}

console.log('\n[4] ★ 验收②：提交越界决策 → 被拒')
{
  const bad = validateDecisions({ pricing: '不跟降', energy: 99 })
  ok(bad.ok === false && bad.violations[0].id === 'energy', `energy=99 被拒（${bad.violations[0].why}）`)
  ok(validateDecisions({ energy: 23 }).ok === true, 'energy=23 通过')
  ok(validateDecisions({ energy: NaN }).ok === false, 'energy=NaN 被拒')
  ok(validateDecisions({ overbook: 999 }).ok === false, 'overbook=999 被拒')
  ok(validateDecisions({ 'member-threshold': 0 }).ok === false, 'member-threshold=0 被拒')
  ok(validateStateBounds({ capital: 5020000, history: [{ occupancy: 130, finalGoodRate: 90, profit: 1 }] }).ok === false,
    '状态越界（occupancy=130）被拒')
  ok(validateStateBounds({ capital: 5020000, history: [{ occupancy: 60, finalGoodRate: 88, profit: 100 }] }).ok === true,
    '合法状态通过')
}

console.log('\n[5] ② 范围表与 decisions.js 同源（防止区间表脱离实际选项漂移）')
{
  const ids = DECISIONS.map(d => d.id)
  ok(ids.length === 18, `决策项 18 项（实测 ${ids.length}）`)
  const numericIds = Object.keys(NUMERIC_BOUNDS)
  const allAreReal = numericIds.every(id => ids.includes(id))
  ok(allAreReal, `区间表里的项都是真实决策项（${numericIds.join(', ')}）`)
  // 每项区间必须是非空闭区间且 lo < hi
  ok(Object.values(NUMERIC_BOUNDS).every(([lo, hi]) => Number.isFinite(lo) && Number.isFinite(hi) && lo < hi),
    '每个区间都满足 lo < hi 且有限')
}

console.log('\n[6] ③ 留痕 + 异常模式提示')
{
  const uniform = Object.fromEntries(Array.from({ length: 18 }, (_, i) => ['k' + i, '不跟降']))
  const r1 = detectUniformPattern(uniform)
  ok(r1.suspicious === true && r1.count === 18, `全 18 项同值 → 提示（${r1.reason}）`)
  const diverse = Object.fromEntries(DECISIONS.map((d, i) => [d.id, i % 2 ? 'A' : 'B']))
  ok(detectUniformPattern(diverse).suspicious === false, '取值有差异 → 不提示')
  ok(detectUniformPattern({}).suspicious === false && detectUniformPattern(null).suspicious === false, '空/非法输入不误报')
  ok(detectUniformPattern({ a: 'x', b: 'x' }).suspicious === false, '项数太少不误报（避免噪声）')
}

console.log('\n[7] 单一实现：serverTick 与防作弊模块共用同一份哈希链（无重复代码）')
{
  const st = read('src/serverTick.mjs')
  ok(/from '\.\/decisionLogIntegrity\.mjs'/.test(st), 'serverTick 从 decisionLogIntegrity 取哈希链')
  ok(!/function fnv1a/.test(st), 'serverTick 内已无 fnv1a 重复实现')
  ok(!/function chainHash/.test(st), 'serverTick 内已无 chainHash 重复实现')
  const eng = read('src/engine/index.js')
  ok(/decisionLogIntegrity/.test(eng), 'engine 统一出口已含防作弊模块（Edge Function 也能用）')
}

console.log('\n[8] 设计取舍声明（诚实边界）：非密码学哈希')
{
  const m = read('src/decisionLogIntegrity.mjs')
  ok(/不是密码学哈希|非密码学/.test(m), '模块内声明"FNV-1a 不是密码学哈希"')
  ok(/HMAC/.test(m), '声明了二期升级路径（HMAC + 服务端密钥）')
  // 32 位哈希的碰撞面：不假装它很强
  const samples = Array.from({ length: 2000 }, (_, i) => fnv1a('entry' + i))
  ok(new Set(samples).size === samples.length, `2000 个不同输入无碰撞（32 位在实际规模下够用，但不等于安全）`)
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
