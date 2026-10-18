// R113-1 复位语义（按用户口径）：重置后第一次 tick 前，引擎必须认为"本周尚未结算"
//   ① 判"已结算"用的键 = history 里 `week === 本周`（不是 __autoSettled —— 那是客户端幂等键，引擎不读）
//   ② openDayNo **引擎不读**（它是客户端算教学日用的）⇒ 设 null 不会让引擎多结算一次
//   ③ weekBase 与 week 必须同时 = 1（weekBase 也是客户端字段；引擎只读 `week`）
//   判据：重置（week=1 · weekBase=1 · history=[]）→ 7 天 ⇒ **恰好 1 条**；84 天 ⇒ **恰好 12 条**
//   反例 RV：把首周的 history 塞一条 week=1 ⇒ 之后 7 天必须 0 条（幂等键生效，证明"已结算"看的是 history）
import { advanceGroupOneDay } from '../src/serverTick.mjs'

const 坏 = []
let 检查数 = 0
const ok = (c, m) => { 检查数++; if (!c) 坏.push(m) }

function 复位存档(额外 = {}) {
  return {
    __groupKey: 'g1', week: 1, weekBase: 1, openDayNo: 1, history: [], capital: 1490000, attrs: {},
    location: { district: '锦江区', attrs: { 客流: 3, 竞争: 3, 租金: 3, 消费: 3, 交通: 3, 环境: 3 } },
    brand: { name: '汉庭', level: '经济型', standard: '客房70间起' },
    doneDecisions: { pricing: '不跟降' }, bizMode: 'direct',
    ...额外,
  }
}
function 推(save, 起, 天数) {
  for (let d = 起; d < 起 + 天数; d++) {
    const r = advanceGroupOneDay(save, d, { groupKey: 'g1' })
    if (r.advanced) save = r.save
  }
  return save
}

// ① 重置 → 7 天 ⇒ 恰好 1 条
{
  const s = 推(复位存档(), 1, 7)
  ok(s.history.length === 1, `重置→7 天：history 应恰好 1 条，实得 ${s.history.length}`)
  ok(s.history[0] && s.history[0].week === 1, '唯一那条应是第 1 周')
  ok(s.week === 1, "第 7 天结算完，state.week 仍是 1（第 8 天才进第 2 周）· 实得 " + s.week)
}

// ② 重置 → 84 天 ⇒ 恰好 12 条
{
  const s = 推(复位存档(), 1, 84)
  ok(s.history.length === 12, `重置→84 天：应恰好 12 条，实得 ${s.history.length}`)
  ok(s.history[11].week === 12, '最后一条应是第 12 周')
}

// ③ openDayNo = null **不会**让引擎多结算（引擎不读它）
{
  const s = 推(复位存档({ openDayNo: null }), 1, 7)
  ok(s.history.length === 1, `openDayNo=null → 7 天仍应 1 条（实得 ${s.history.length}）—— 引擎不读 openDayNo`)
}

// ④ weekBase 缺省 / 不一致 **不影响**引擎（引擎只读 week）
{
  const a = 推(复位存档({ weekBase: undefined }), 1, 7)
  const b = 推(复位存档({ weekBase: 99 }), 1, 7)
  ok(a.history.length === 1 && b.history.length === 1, 'weekBase 缺省/异常都不影响引擎的周判定（实得 ' + a.history.length + '/' + b.history.length + '）')
}

// ⑤ RV：首周已有一条 week=1 ⇒ 之后 7 天不追加（"已结算"看的是 history）
{
  const 已结 = 复位存档({ history: [{ week: 1, revenue: 1 }] })
  const s = 推(已结, 1, 7)
  ok(s.history.length === 1, `首周已在 history ⇒ 7 天后仍应 1 条（实得 ${s.history.length}）—— 幂等键是 history.week`)
}

// ⑥ RV：起点错位（从第 7 天起跑 84 天）⇒ 13 条（这就是线上症状）
{
  const s = 推(复位存档(), 7, 84)
  ok(s.history.length === 13, `起点 7 跑 84 天应得 13 条（实得 ${s.history.length}）—— 复位必须从第 1 天起`)
}

console.log('══ R113-1 复位语义 ══')
console.log('  引擎判"已结算"= history 里 week===本周；openDayNo/weekBase 是客户端字段（引擎不读）')
for (const b of 坏.slice(0, 8)) console.log('  ✗ ' + b)
console.log('结果: ' + (检查数 - 坏.length) + ' 通过 / ' + 坏.length + ' 失败')
process.exit(坏.length === 0 ? 0 : 1)
