// R113-1 判据：**重置后 N 天推进 ⇒ 历史恰好 ⌊N/7⌋ 条**
//   实测根因（本地复算）：引擎没问题 —— classDay 从 0 或 1 起跑 84 天 = 12 周；
//   **从 7 起跑 = 13 周**（7..90 跨了 13 个日历周）⇒ 错在 runner 的重置起点，不在 settlement/serverTick。
//   反例 RV：把起点改成 7 ⇒ 84 天产出 13 条 ⇒ 本套件红。
// 同时验 R113-2（审计端判断"可能与 R113-1 同源"）：最后一周的一次性项必须只有保证金退还。
import { advanceGroupOneDay } from '../src/serverTick.mjs'
import { dayToWeekDay } from '../src/weeklyAuto.mjs'

const bad = []
let 检查数 = 0
const ok = (cond, msg) => { 检查数++; if (!cond) bad.push(msg) }

function 新档() {
  return {
    __groupKey: 'g1', week: 1, capital: 1490000, attrs: {}, history: [],
    location: { district: '锦江区', attrs: { 客流: 3, 竞争: 3, 租金: 3, 消费: 3, 交通: 3, 环境: 3 } },
    brand: { name: '汉庭', level: '经济型', standard: '客房70间起' },
    doneDecisions: { pricing: '不跟降' }, bizMode: 'direct',
  }
}
function 推(save, 起点, 天数) {
  for (let d = 起点; d < 起点 + 天数; d++) {
    const r = advanceGroupOneDay(save, d, { groupKey: 'g1' })
    if (r.advanced) save = r.save
  }
  return save
}

// ① 经典口径：从第 1 天起跑 84 天 ⇒ 12 条（week 1..12）
{
  const s = 推(新档(), 1, 84)
  const 周s = s.history.map(h => h.week)
  ok(s.history.length === 12, `84 天（从第 1 天起）应恰好 12 条历史，实得 ${s.history.length}`)
  ok(JSON.stringify(周s) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), `周次应连续 1..12（实得 ${周s.join(',')}）`)
  // ★ R113-2：最后一周（W12）一次性项只该有"保证金退还"，开业费用必须 0
  const w12 = s.history[11]
  const ot = w12 && w12.oneTimeFees
  ok(!!ot, 'W12 应带 oneTimeFees（结算第 12 周时）')
  ok(ot && Number(ot.开业费用) === 0, `W12 开业费用必须 0（实得 ${ot && ot.开业费用}）—— 若为 338000 即 R113-2 复现`)
  ok(ot && Number(ot.保证金退还) === 100000, `W12 保证金退还应为 100000（实得 ${ot && ot.保证金退还}）`)
  ok(w12 && Number(w12.weeklyExpenses && w12.weeklyExpenses['保证金退还']) === -100000, 'W12 weeklyExpenses.保证金退还 应为 −100000（负成本）')
  // 前 11 周都没有"保证金退还"（只有 W1 有开业费用）
  const 前退 = s.history.slice(0, 11).filter(h => h && h.weeklyExpenses && h.weeklyExpenses['保证金退还'])
  ok(前退.length === 0, `第 1–11 周不应出现保证金退还（实得 ${前退.length} 周）`)
  const w1 = s.history[0]
  ok(Number(w1.oneTimeFees && w1.oneTimeFees.开业费用) === 338000, 'W1 开业费用应为 338000（一次性费用清单合计）')
}

// ② 反例 RV：从第 7 天起跑 84 天 —— ★V126 后周结算只在周尾（第 7/14/…/84 天），
//   day7..day90 覆盖第 1..12 周的周尾 ⇒ 12 条（旧的"第 13 周提前结算"已随 §1 闸门消失）。
{
  const s = 推(新档(), 7, 84)
  ok(s.history.length === 12, `从第 7 天起跑 84 天应得 12 条（实测 ${s.history.length}）—— 周结算只在周尾（V126-#1）`)
  const 周s = s.history.map(h => h.week)
  ok(周s[0] === 1 && 周s[11] === 12, `起点 7 ⇒ 周次 1..12（实得 ${周s[0]}..${周s[11]}）`)
}

// ③ 周映射本身（0 与 1 都是第 1 周第 1 天；第 7 天是第 1 周最后一天）
ok(dayToWeekDay(0).week === 1 && dayToWeekDay(0).dayIndex === 1, 'dayToWeekDay(0) 应 = 第1周第1天')
ok(dayToWeekDay(7).week === 1 && dayToWeekDay(7).dayIndex === 7, 'dayToWeekDay(7) 应 = 第1周第7天')
ok(dayToWeekDay(8).week === 2 && dayToWeekDay(8).dayIndex === 1, 'dayToWeekDay(8) 应 = 第2周第1天')

// ④ 幂等：同一天重复 tick 不产生第二条
{
  let s = 推(新档(), 1, 7)
  const n1 = s.history.length
  const r = advanceGroupOneDay(s, 7, { groupKey: 'g1' })
  ok(r.advanced === false, '同一天重复 tick 应返回 advanced=false（幂等）')
  ok(s.history.length === n1, '重复 tick 不得追加历史')
}

console.log('══ R113-1 重置后 N 天 ⇒ ⌊N/7⌋ 条（含 R113-2 一次性项核对）══')
{
  const s = 推(新档(), 1, 84)
  console.log(`  起点 1 · 84 天 ⇒ ${s.history.length} 条（week 1..12）· W1 开业费用 ${s.history[0].oneTimeFees.开业费用} · W12 退还 ${s.history[11].oneTimeFees.保证金退还}`)
}
for (const b of bad.slice(0, 8)) console.log('  ✗ ' + b)
console.log(`结果: ${检查数 - bad.length} 通过 / ${bad.length} 失败`)
process.exit(bad.length === 0 ? 0 : 1)
