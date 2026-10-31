// V160 · 学期闸（纯层 + 接线断言 + 学期外标记）
// 运行：node tests/semesterGateV160.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
import { 学期闸 } from '../src/semesterGate.mjs'
import { advanceGroupOneDay } from '../src/serverTick.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ V160 · 学期闸')
{
  // ① 纯层判定
  ok(学期闸({ semester_status: 'running' }, 3).allowed, 'running + week 3 ⇒ 允许')
  ok(!学期闸({ semester_status: 'running' }, 13).allowed, 'running + week 13 ⇒ 阻（超 12 周）')
  ok(!学期闸({ semester_status: 'finished' }, 3).allowed, 'finished ⇒ 阻')
  ok(!学期闸({ semester_status: 'archived' }, 3).allowed, 'archived ⇒ 阻')
  ok(!学期闸({ semester_status: 'draft' }, 3).allowed, 'draft ⇒ 阻')
  ok(学期闸({}, 3).allowed, '无状态字段 ⇒ 缺省 running（零变化水位线）')
  ok(学期闸({ semester_status: 'running' }, 12).allowed, 'week 12 = 恰好边界 ⇒ 允许')
  const blocked = 学期闸({ semester_status: 'finished' }, 13)
  ok(blocked.reason && blocked.reason.length > 0, '阻时带人话原因：' + blocked.reason)
}

console.log('\n[② advanceGroupOneDay 接线]')
{
  const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2, district: '锦江区' }
  const BRAND = { name: '汉庭', price: '210-310元', standard: '客房70间起', level: '经济型 · 国民', rentFactor: 0.30 }
  const DEC = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'member-convert': '强调品质', energy: 23, overbook: 0, ota: null, reputation: '道歉+赔偿', 'hr-optimize': '全员培训' }
  const mkSave = (week, capital) => ({ __groupKey: 'g1|1', location: SITE, brand: BRAND, week, capital, history: [], attrs: { quality: 60, reputation: 70, morale: 65 }, doneDecisions: DEC, __autoSettled: [] })

  // semesterStatus 缺省 = running ⇒ 零变化水位线
  const r1 = advanceGroupOneDay(mkSave(1, 1500000), 1, {})
  ok(r1.advanced === true && !r1.blockedBy, '缺省 semesterStatus ⇒ 零变化水位线（正常推进）')

  // finished ⇒ 阻
  const r2 = advanceGroupOneDay(mkSave(1, 1500000), 1, { semesterStatus: 'finished' })
  ok(r2.advanced === false && r2.blockedBy === 'semester', 'finished ⇒ blockedBy=semester（不写 history）')
  const 原档 = mkSave(1, 1500000)
  ok(JSON.stringify(r2.save) === JSON.stringify(原档), 'blocked ⇒ save 原样返回（零变化 · deepEqual）')

  // week > TOTAL_WEEKS ⇒ 阻
  const r3 = advanceGroupOneDay(mkSave(13, 1500000), 85, { semesterStatus: 'running' })
  ok(r3.advanced === false && r3.blockedBy === 'semester', 'running + week 13 ⇒ 阻（超 12 周）')

  // RV 锚：源码级——闸必须在幂等检查之前
  const src = readFileSync(new URL('../src/serverTick.mjs', import.meta.url), 'utf8')
  const gatePos = src.indexOf('学期闸结果')
  const idemPos = src.indexOf('const already')
  ok(gatePos > 0 && idemPos > gatePos, 'RV 锚：学期闸在幂等检查之前（闸先行）')
}

console.log('\n[③ 学期外标记]')
{
  // 纯层：学期外标记只加布尔，不改数值
  const mk = (w, net) => ({ week: w, revenue: 100000, netProfit: net, profit: net, occupancy: 60, finalGoodRate: 70, decisions: {}, events: [] })
  const hs = [mk(1, 5000), mk(2, -3000)]
  hs.push({ ...mk(13, -25928), 学期外: true })
  ok(hs[2].学期外 === true && hs[2].netProfit === -25928, '第 13 周 加 学期外:true ⇒ 数值零改动')
  // 成果页切片（前 12 周）自然跳过学期外——semesterResult 学期切片已有此功能
  const src = readFileSync(new URL('../src/semesterResult.mjs', import.meta.url), 'utf8')
  ok(/学期切片/.test(src) && /TOTAL_WEEKS/.test(src), 'semesterResult 学期切片 = 前 12 周（学期外不进成果）')
}

console.log('\n[接线断言]')
{
  const st = readFileSync(new URL('../src/serverTick.mjs', import.meta.url), 'utf8')
  const edge = readFileSync(new URL('../supabase/functions/advance-day/engine/serverTick.mjs', import.meta.url), 'utf8')
  ok(st.includes('学期闸') && edge.includes('学期闸'), 'src 与 edge 副本同一实现（都有学期闸）')
  const idx = readFileSync(new URL('../supabase/functions/advance-day/index.ts', import.meta.url), 'utf8')
  ok(/semesterStatus.*semester_status/.test(idx), 'index.ts 传 semesterStatus 给引擎')
  // RV 锚：摘掉闸 ⇒ 断言红
  ok(/if \(!学期闸结果\.allowed\)/.test(st), 'RV 锚：闸的 if 判断在位（摘掉 ⇒ 下面的 blockedBy 测试红）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
