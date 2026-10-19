// V128-#3 批1 · 每日委托生成器（种子可复现 · 每天 1–2 · 3 选 1 无最优解 · 每 3 天写一句）
// 运行：node tests/dailyQuests.test.mjs   （挂 run-all fast）
import { 生成当日委托, 委托库, 无最优解, 每天上限, 事件相关类 } from '../src/dailyQuests.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ V128-#3 批1 · 每日委托生成器')

console.log('\n[①] 五类库：每类 3 选 1 且无支配选项')
{
  const 类名 = Object.keys(委托库)
  ok(类名.length === 5, `五类委托齐全（实得 ${类名.length}：${类名.join('/')}）`)
  for (const k of 类名) {
    const o = 委托库[k].选项
    ok(o.length === 3, `${k}：恰好 3 个选项（实得 ${o.length}）`)
    ok(无最优解(o.map(x => ({ 维度: x.维度 }))), `${k}：没有"样样不差"的支配选项（无最优解）`)
    ok(o.every(x => x.代价 && String(x.代价).trim()), `${k}：每个选项都写明代价（不是免费选择）`)
  }
}

console.log('\n[②] 每天 1–2 个：无事件=1；有事件=2；上限=2')
{
  let 错 = []
  for (const 种子 of ['A', 'B', 'C']) {
    for (let 天 = 1; 天 <= 30; 天++) {
      const 无 = 生成当日委托({ 种子, 组: 'g1', 天, 待处理差评: 1, 天气: '暴雨', 入住压力: 'peak', 竞品动作: '降价' })
      if (无.length !== 1) 错.push(`无事件 ${种子}/${天}=${无.length}`)
      const 有 = 生成当日委托({ 种子, 组: 'g1', 天, 待处理差评: 1, 天气: '暴雨', 入住压力: 'peak', 竞品动作: '降价', 注入事件: { 来源事件: 'E7' } })
      if (有.length !== 2) 错.push(`有事件 ${种子}/${天}=${有.length}`)
      if (无.length < 1 || 无.length > 2 || 有.length < 1 || 有.length > 2) 错.push(`越界 ${种子}/${天}`)
    }
  }
  ok(错.length === 0, '90 天 × 3 种子：无事件恒 1 / 有事件恒 2 / 从不超过 2', 错.slice(0, 5).join(','))
  ok(每天上限 === 2, `默认上限 = 2（实得 ${每天上限}）`)
}

console.log('\n[③] 种子可复现：同输入两次完全相同')
{
  const args = { 种子: 'RUN42', 组: '酒管2401|3', 天: 3, 待处理差评: 2, 天气: '高温', 入住压力: 'peak', 竞品动作: '促销', 注入事件: { 来源事件: 'E3' } }
  const a = JSON.stringify(生成当日委托(args))
  const b = JSON.stringify(生成当日委托({ ...args }))
  ok(a === b, '同一 (种子,组,天,输入) ⇒ 逐字节相同')
  // 换组 ⇒ 30 天内至少有一天不同（不是恒等）
  let 不同 = 0
  for (let d = 1; d <= 30; d++) {
    const x = JSON.stringify(生成当日委托({ ...args, 组: 'g1', 天: d }))
    const y = JSON.stringify(生成当日委托({ ...args, 组: 'g2', 天: d }))
    if (x !== y) 不同++
  }
  ok(不同 > 0, `换组会产生不同委托（30 天中 ${不同} 天不同）`)
}

console.log('\n[④] 每 3 天至少一次「写一句」')
{
  let 缺 = []
  for (let 天 = 1; 天 <= 30; 天++) {
    const q = 生成当日委托({ 种子: 'W', 组: 'g1', 天, 待处理差评: 1 })
    if (天 % 3 === 0 && !q.some(x => x.需写一句)) 缺.push(天)
  }
  ok(缺.length === 0, `第 3/6/9… 天都有写一句标记（缺 ${缺.join(',')}）`)
  const 非 = 生成当日委托({ 种子: 'W', 组: 'g1', 天: 2, 待处理差评: 1 })
  ok(!非.some(x => x.需写一句), '非 3 倍数天不强制写')
}

console.log('\n[⑤] 五类都能出现 + 事件相关类映射')
{
  const 见 = new Set()
  for (let d = 1; d <= 60; d++) {
    for (const q of 生成当日委托({ 种子: 'COV', 组: 'g1', 天: d, 待处理差评: 1, 天气: '暴雨', 入住压力: 'peak', 竞品动作: '降价' })) 见.add(q.类)
  }
  ok(见.size === 5, `60 天覆盖五类（实得 ${[...见].join('/')}）`)
  for (const [ev, 类] of Object.entries(事件相关类)) {
    const q = 生成当日委托({ 种子: 'EV', 组: 'g1', 天: 1, 注入事件: { 来源事件: ev } })
    ok(q.some(x => x.类 === 类), `${ev} ⇒ 出现相关类「${类}」（实得 ${q.map(x => x.类).join('/')}）`)
  }
}

console.log('\n[⑥] 第一版只记录（零变化护栏）')
{
  const q = 生成当日委托({ 种子: 'X', 组: 'g1', 天: 1, 待处理差评: 1, 注入事件: { 来源事件: 'E7' } })
  ok(q.every(x => x.只记录 === true), '所有委托都标 只记录:true（引擎不读）')
}

console.log('\n[⑦] 上限 RV：把上限拿掉会变成 3 个')
{
  const 三 = 生成当日委托({ 种子: 'CAP', 组: 'g1', 天: 1, 待处理差评: 1, 天气: '暴雨', 入住压力: 'peak', 竞品动作: '降价', 注入事件: { 来源事件: 'E7' }, 上限: 3 })
  ok(三.length === 3, `上限=3（模拟"拿掉每天上限2"）⇒ 3 个（实得 ${三.length}）—— 默认路径必须 ≤2`)
  ok(生成当日委托({ 种子: 'CAP', 组: 'g1', 天: 1, 待处理差评: 1, 天气: '暴雨', 入住压力: 'peak', 竞品动作: '降价', 注入事件: { 来源事件: 'E7' } }).length === 2, '默认路径仍是 2')
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
