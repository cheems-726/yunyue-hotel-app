// V131 §1-A · 押注接线：服务端结算揭晓 · 无押注零变化 · 闸门/周报/台账接线
// 运行：node tests/v131Bet.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
import { advanceGroupOneDay } from '../src/serverTick.mjs'
import { decisions } from '../src/decisions.js'
import { 净利档Of, 出租率得分, 方向得分 } from '../src/bets.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const DEC18 = (() => {
  const o = {}
  for (const d of decisions) {
    if (d.type === 'option' || d.type === 'timer') o[d.id] = d.options[0].label
    else if (d.type === 'slider') o[d.id] = d.min ?? 0
    else if (d.type === 'budget') {
      const a = Math.floor(d.total / d.items.length)
      o[d.id] = Object.fromEntries(d.items.map((it, i) => [it, a + (i === 0 ? d.total - a * d.items.length : 0)]))
    } else if (d.type === 'sort') o[d.id] = [...d.items]
  }
  return o
})()
const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2, district: '锦江区' }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const mk = (extra = {}) => ({ __groupKey: 'g1', week: 1, location: SITE, brand: BRAND, attrs: { quality: 60, reputation: 70, morale: 65 }, capital: 1490000, history: [], doneDecisions: { ...DEC18 }, bizMode: 'direct', ...extra })

console.log('▶ V131 §1-A · 押注接线')

console.log('\n[①] 服务端结算：history[].押注 = 押 X → 实际 Y → 得分 Z')
{
  const 押 = { week: 1, 出租率: 70, 净利方向: '明显亏损', 提交时刻: 't' }
  const r = advanceGroupOneDay(mk({ 本周押注: 押 }), 1)
  const h = r.save.history[0]
  ok(!!h.押注, '结算结果带 押注 揭晓')
  ok(h.押注.实际出租率 === h.occupancy, `实际出租率回填 = 结算出租率（${h.押注.实际出租率}）`)
  ok(h.押注.实际方向 === 净利档Of(h.押注.实际净利), '实际净利档回填正确')
  ok(h.押注.出租率得分 === 出租率得分(70, h.occupancy), '出租率得分按写死阈值')
  ok(h.押注.方向得分 === 方向得分('明显亏损', h.押注.实际净利), '方向得分按四档')
  ok(h.押注.总分 === h.押注.出租率得分 + h.押注.方向得分, '总分 = 两项之和（≤15）')
  ok(h.押注.总分 <= 15, '总分不超过满分 15')
}

console.log('\n[②] 零变化：无押注 ⇒ 结算结果不加 押注 键，金额不变')
{
  const a = advanceGroupOneDay(mk(), 1).save.history[0]
  const b = advanceGroupOneDay(mk({ 本周押注: { week: 1, 出租率: 70, 净利方向: '小幅盈利', 提交时刻: 't' } }), 1).save.history[0]
  ok(!('押注' in a), '无押注 ⇒ 没有 押注 键（旧档形状不变）')
  ok(a.profit === b.profit && a.revenue === b.revenue && a.capital === b.capital, '押注只记录：金额/资金逐字节不变')
}

console.log('\n[③] 补押（迟押）⇒ 记录但不计分')
{
  const r = advanceGroupOneDay(mk({ 本周押注: { week: 1, 出租率: 70, 净利方向: '明显亏损', 提交时刻: 't', 迟押: true } }), 1)
  const p = r.save.history[0].押注
  ok(p.迟押 === true && p.总分 === 0 && p.出租率得分 === 0 && p.方向得分 === 0, '迟押 ⇒ 0 分（但仍记录押了什么/实际多少）')
  ok(p.实际出租率 === r.save.history[0].occupancy, '迟押仍回填实际值（供讲评）')
}

console.log('\n[④] 闸门与接线（静态）')
{
  const wr = readFileSync('src/WeeklyReport.jsx', 'utf8')
  ok(/const 需押注 = !本周已押/.test(wr), '周报：未押注 ⇒ 需押注')
  ok(/disabled=\{需反思 \|\| 需押注\}/.test(wr), '★ 未押注 ⇒ 「进入下一周」禁用')
  ok(/押 \{押\.出租率\}%|押 <b>\{押\.出租率\}%/.test(wr), '周报渲染「押 X% → 实际 Y% → 得分 Z」')
  ok(/补押 · 不计分/.test(wr), '补押明确标注不计分')
  const app = readFileSync('src/App.jsx', 'utf8')
  ok(/<BetCard week=\{week\} 押注=\{押注\} onSubmit=\{on押注\}/.test(app), '经营页渲染押注卡')
  ok(/function 提交押注\(值\)/.test(app) && /押注有效\(本周押注, week\)/.test(app), '提交押注走周锁定校验')
  ok(/结算押注\(本周押注, result\)/.test(app), '客户端结算时打分')
  const st = readFileSync('src/serverTick.mjs', 'utf8')
  ok(/结算押注\(src\.本周押注, result\)/.test(st), '服务端结算时也打分（补算/离线一致）')
  const ps = readFileSync('src/processScore.mjs', 'utf8')
  ok(/押注校准/.test(ps), '台账第五列 押注校准')
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
