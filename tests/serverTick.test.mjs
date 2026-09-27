// Wave 1 · W1-3 ★ 服务端逐日推进的等效验证
// 运行：node tests/serverTick.test.mjs   （已挂 run-all）
//
// ★ 本套件是"D7 是否真落地"的【唯一客观证据】：
//     不打开任何浏览器 → 服务端（等效 Node 进程）自己推进 1 天
//   并且：服务端输出 === 浏览器端 settle() 输出（逐字节）
//
// 判据（§二十二·三 Wave 1 验收）：
//   ① 不打开客户端 → 推进 1 天
//   ② 服务端输出 === 浏览器输出（逐字节）
//   ③ 幂等（重复触发结果相同）
//   ④ 数值合理性校验生效（越界不写回）
//   ⑤ 服务端【不重写引擎】（同一份 src/engine/index.js）
//   ⑥ 数据库侧无业务计算（cloud-settle.sql 作废未复活）
import {
  advanceGroupOneDay, advanceGroupToDay, daySnapshotOf, dayToWeekDay,
  tickKey, validateDecisions, validateStateBounds, chainHash, fnv1a, TICK_VERSION,
} from '../src/serverTick.mjs'
import { settle, buildDailyReport } from '../src/engine/index.js'
import { readFileSync, readdirSync, existsSync } from 'node:fs'

const APP = 'D:/教学app/hotel-app/'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const read = (p) => readFileSync(APP + p, 'utf8')

// ── 构造"班级第 5 天"的存档（真实形状：与 localStorage 的 hotel-sim-state 同构）──
const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const DEC = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }
const mkSave = () => ({
  location: SITE, brand: BRAND, attrs: { quality: 60, reputation: 70, morale: 65 },
  capital: 5020000, history: [], doneDecisions: DEC, bizMode: 'direct',
})

console.log('▶ Wave 1 · W1-3 服务端逐日推进（等效验证 · D7 客观证据）')
console.log(`  引擎版本标记 TICK_VERSION = ${TICK_VERSION}`)

console.log('\n[1] ★① 不打开浏览器 → 服务端自己推进 1 天（classDay=5）')
{
  const save = mkSave()
  const r = advanceGroupOneDay(save, 5)
  ok(r.advanced === true, '推进发生（advanced=true）')
  ok(r.classDay === 5 && r.week === 1 && r.dayIndex === 5, `定位正确：classDay=5 → 第 ${r.week} 周第 ${r.dayIndex} 天`)
  ok(!!r.snapshot, '取到第 5 天的日快照')
  ok(r.save.history.length === 1, `存档多出一周（history ${save.history.length} → ${r.save.history.length}）`)
  console.log(`     第 5 天：营收 ${r.snapshot.revenue} · 成本 ${r.snapshot.cost} · 净流入 ${r.snapshot.cashDelta}`)
}

console.log('\n[2] ★② 服务端输出 === 浏览器端 settle() 输出（逐字节）')
{
  const save = mkSave()
  const r = advanceGroupOneDay(save, 5)

  // 独立地"像浏览器那样"算一遍：直接调 settle()（不经 serverTick），再用同一个日行构造器取第 5 行
  const browserWeek = settle({ site: SITE, brand: BRAND, decisions: DEC, week: 1, attrs: save.attrs, prevGoodRate: null, prevCapital: save.capital, bizMode: 'direct' })
  const browserRow = buildDailyReport(browserWeek).find(x => x.dayIndex === 5)

  ok(JSON.stringify(r.snapshot) === JSON.stringify(browserRow),
    '第 5 天日行【逐字节相同】：服务端 tick === 浏览器 settle+buildDailyReport')
  ok(JSON.stringify(r.save.history[0]) === JSON.stringify(browserWeek),
    '整周结果【逐字节相同】：服务端写回的那一周 === 浏览器单独结算的那一周')
  // 逐字段比对（便于失败时定位）
  const diffs = Object.keys(browserRow).filter(k => JSON.stringify(r.snapshot[k]) !== JSON.stringify(browserRow[k]))
  ok(diffs.length === 0, `逐字段无差异（差异字段 ${diffs.length}：${diffs.join(',') || '无'}）`)
}

console.log('\n[3] ★③ 幂等：重复触发结果相同')
{
  const save = mkSave()
  const a = advanceGroupOneDay(save, 5)
  const b = advanceGroupOneDay(a.save, 5)    // 同一天再触发一次
  const c = advanceGroupOneDay(b.save, 5)    // 第三次
  ok(b.advanced === false && c.advanced === false, '重复触发不再结算（advanced=false）')
  ok(JSON.stringify(a.snapshot) === JSON.stringify(b.snapshot) && JSON.stringify(b.snapshot) === JSON.stringify(c.snapshot),
    '三次快照逐字节相同')
  ok(b.save.history.length === a.save.history.length, `history 未被重复追加（仍是 ${b.save.history.length} 周）`)
  ok(tickKey(5, 'g1') === 'd5|g1', `幂等键形状：${tickKey(5, 'g1')}`)
  // 同周不同天：也应幂等（不重复结算，只是取另一天）
  const d7 = advanceGroupOneDay(a.save, 7)
  ok(d7.advanced === false && d7.dayIndex === 7, '同周的第 7 天：不再结算，直接取该天分片')
  ok(d7.save.history.length === 1, '同周内推进不新增 history')
}

console.log('\n[4] 跨周推进与补算一致性')
{
  const save = mkSave()
  const d8 = advanceGroupOneDay(advanceGroupOneDay(save, 7).save, 8)
  ok(d8.advanced === true && d8.week === 2, '第 8 天跨到第 2 周 ⇒ 触发新结算')
  ok(d8.save.history.length === 2, 'history 有 2 周')

  // 补算（逐天推到第 10 天）=== 直接跳到第 10 天
  const stepwise = advanceGroupToDay(mkSave(), 10)
  const jump = (() => { let s = mkSave(); for (const d of [10]) { const r = advanceGroupOneDay(s, d); s = r.save } return s })()
  // 直接跳也会先结算第 1 周（因为第 10 天属于第 2 周，需要第 1 周的结果作 prevGoodRate）
  ok(stepwise.days.length === 10, `逐天推进产生 10 条记录（${stepwise.days.length}）`)
  ok(stepwise.days.filter(x => x.advanced).length === 2, `其中真正结算的只有 2 次（第 1、2 周；实际 ${stepwise.days.filter(x => x.advanced).length}）`)
  const swLast = stepwise.days[stepwise.days.length - 1].snapshot
  ok(!!swLast && swLast.dayIndex === 3, `第 10 天 = 第 2 周第 3 天（dayIndex=${swLast && swLast.dayIndex}）`)
  ok(!!jump.history.length, `直接跳到第 10 天也能算（history ${jump.history.length} 周）`)
  // 逐天 vs 直接跳：周 1 的结果必须一致
  const browserW1 = settle({ site: SITE, brand: BRAND, decisions: DEC, week: 1, attrs: mkSave().attrs, prevCapital: mkSave().capital })
  ok(JSON.stringify(stepwise.save.history[0]) === JSON.stringify(browserW1), '补算出的第 1 周 === 浏览器结算的第 1 周（逐字节）')
}

console.log('\n[5] ★④ 数值合理性校验（越界不写回）')
{
  const save = mkSave()
  // 决策越界：空调温度 99℃
  const bad = advanceGroupOneDay(save, 1, { decisions: { ...DEC, energy: 99 } })
  ok(bad.violations.length > 0, `越界决策被识别（${bad.violations.length} 条）：${bad.violations[0]}`)
  const good = advanceGroupOneDay(save, 1, { decisions: { ...DEC, energy: 23 } })
  ok(good.violations.length === 0, '合法决策无违规')
  // 状态越界：capital 非有限
  const nanCap = advanceGroupOneDay({ ...save, capital: NaN }, 1)
  ok(nanCap.violations.length === 0, 'capital=NaN 不报违规（入口归一化已兜住，回落起始资金）')
  const oob = validateStateBounds({ capital: 5020000, attrs: { quality: 999 }, history: [{ occupancy: 130, profit: 100 }] })
  ok(oob.ok === false && oob.violations.length >= 2, `状态越界被抓（${oob.violations.length} 条）：${oob.violations.join(' / ')}`)
  const v = validateDecisions({ overbook: -1, energy: 23 })
  ok(v.ok === false && v.violations[0].id === 'overbook', '区间校验：overbook=-1 被拒')
}

console.log('\n[6] ★⑤ 服务端不重写引擎（同一份源码）')
{
  const st = read('src/serverTick.mjs')
  ok(/from '\.\/engine\/index\.js'/.test(st), 'serverTick 从 src/engine/index.js 取引擎（统一出口）')
  ok(!/function settle\s*\(/.test(st), 'serverTick 内【没有】自写 settle 实现')
  ok(!/occupiedRooms\s*\*|revenue\s*=\s*Math\.round/.test(st), 'serverTick 内【没有】结算公式')
  // Edge Function 也必须是薄适配层
  // ⚠️ 静态检查必须先【剥注释】—— 否则本文件里那句"出现任何 occupancy/profit 都算违规"的注释
  //    会把检查自己绊倒（第一次跑就是这样误报的）
  const stripCode = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
  const idxRaw = read('supabase/functions/advance-day/index.ts')
  const idx = stripCode(idxRaw)
  const dbts = stripCode(read('supabase/functions/advance-day/db.ts'))
  ok(/from '\.\/engine\/serverTick\.mjs'/.test(idx), 'Edge Function 从 ./engine/serverTick.mjs 取逻辑')
  ok(!/[a-zA-Z]*occupancy[a-zA-Z]*\s*[*/+-]=?\s*/.test(idx) && !/\bprofit\s*=/.test(idx),
    'Edge Function 内无结算算式（只有读→调→写）')
  ok(!/\b(revenue|totalCost|goodRate)\s*[-+*/]?=/.test(idx + dbts), 'index.ts/db.ts 内无营收·成本·好评率赋值')
  ok(!/^\s*\*\s*[0-9]/m.test(idx), 'Edge Function 内无裸乘常数')
}

console.log('\n[7] engine/ 组装物与 src/ 同源（除 import 路径外逐字节）')
{
  const OUT = 'supabase/functions/advance-day/engine/'
  ok(existsSync(APP + OUT), 'engine/ 目录存在（已组装）')
  const PAIRS = [['src/settlement.js', 'settlement.js'], ['src/serverTick.mjs', 'serverTick.mjs'], ['src/engine/index.js', 'index.js']]
  const stripImports = (s) => s.replace(/(from\s*['"])[^'"]+(['"])/g, '$1$2')
  let bad = 0
  for (const [a, b] of PAIRS) {
    if (stripImports(read(a)) !== stripImports(read(OUT + b))) { bad++; console.error(`     ✗ ${b} 与 ${a} 不同源`) }
  }
  ok(bad === 0, `抽样 ${PAIRS.length} 个模块：除 import 路径外逐字节相同` + (bad ? '　⇒ 组装物已过期，请跑 node scripts/build-edge-function.mjs' : ''))
  // 组装物里不得残留会 404 的 import
  const files = readdirSync(APP + OUT)
  const oob = files.filter(f => /from\s*['"](?:\.\.\/|\.\/engine\/)/.test(read(OUT + f)))
  ok(oob.length === 0, `engine/ 内无会 404 的 import（${oob.length} 个文件命中）`)
}

console.log('\n[8] ★⑥ 数据库侧无业务计算（作废的 cloud-settle.sql 未复活）')
{
  const cs = read('scripts/cloud-settle.sql')
  ok(/已作废/.test(cs.slice(0, 400)), 'cloud-settle.sql 仍带作废警示头')
  ok(/尚未实施/.test(cs.slice(0, 1200)), '警示头仍写明"尚未实施"')
  ok(chainHash([]).hash === 'genesis', `链式哈希起点 = genesis（FNV1a 实现可用）`)
  ok(fnv1a('genesis') === fnv1a('genesis') && fnv1a('a') !== fnv1a('b'), 'FNV1a 确定性 + 区分性')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
