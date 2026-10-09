// ★ V95（2026-10-09 · 用户点名）开业后「投资回报」守门 —— 三条可证伪断言 + 边界
// 口径：① 进度 = 累计利润 ÷ 总投资（单源：总投资只来自 onePageLedger）
//       ② 总投资 null ⇒ 待补分支且【不出任何数字】
//       ③ 回本判据与 BreakEvenChart 同源（累计序列 · 之前为负之后转正）
import { 投资回报, 累计序列, 回本索引, 百分比, 万元 } from '../src/investReturn.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.log('  ✗ ' + n + (extra ? '  ⇒ ' + extra : '')) } }

const 历史 = (profits) => profits.map((p, i) => ({ week: i + 1, profit: p }))
const 账 = (总投资, 回本年 = 8) => ({ 总投资, 回本年, lines: [] })

// ── ① 进度 = 累计利润 ÷ 总投资（造对照）────────────────
{
  const l = 账(1_000_000)
  const r1 = 投资回报({ ledger: l, history: 历史([-50000, -30000, 20000]) })   // 累计 -60000
  const r2 = 投资回报({ ledger: l, history: 历史([-50000, -30000, 20000, 120000]) }) // 累计 +60000
  ok(r1.累计利润 === -60000 && r2.累计利润 === 60000, '累计利润逐周累加正确（与 BreakEvenChart 同源）', `${r1.累计利润} / ${r2.累计利润}`)
  ok(r1.进度 === 0, '累计为负 ⇒ 进度钳到 0（不出现负进度）', String(r1.进度))
  ok(Math.abs(r2.进度 - 0.06) < 1e-9, '进度 = 累计利润 ÷ 总投资 = 60000/1000000 = 6%', 百分比(r2.进度))
  ok(Math.abs(投资回报({ ledger: 账(500000), history: 历史([100000]) }).进度 - 0.2) < 1e-9, '换一个总投资 ⇒ 进度随之变（证明不是写死）')
}

// ── ② 总投资 null ⇒ 待补分支且不出数字（负向 · 可证伪）───
{
  for (const [名, l] of [['null', 账(null)], ['缺字段', {}], ['非数', 账(NaN)], ['零', 账(0)]]) {
    const r = 投资回报({ ledger: l, history: 历史([-100, 200]) })
    const 全空 = r.待补 === true && r.总投资 === null && r.已回收 === null && r.进度 === null && r.roi === null && r.还需周数 === null
    ok(全空, `总投资${名} ⇒ 待补分支且全部数值为 null（不出数字）`, JSON.stringify({ 待补: r.待补, 进度: r.进度, roi: r.roi }))
  }
  const rl = 投资回报({ ledger: null, history: 历史([1000]) })
  ok(rl.待补 === true, 'ledger 整体为 null ⇒ 同样走待补（防 null 当 0 算无限 ROI）')
  ok(万元(null) === '待补（缺来源数据）' && 百分比(null) === '待补（缺来源数据）', '文案层缺数据 ⇒ 统一「待补（缺来源数据）」，不渲染 NaN/0')
}

// ── ③ 回本判据与 BreakEvenChart 同源 ─────────────────
{
  const 同源 = (ps) => { const cum = 累计序列(历史(ps)); return { cum, beIdx: 回本索引(cum) } }
  const a = 同源([-100, -50, 180])         // 累计 -100/-150/+30 ⇒ 第3周转正 ⇒ 索引 2
  const b = 同源([-100, -50, -30])         // 始终为负 ⇒ -1
  const c = 同源([100, 50, -30])           // 首周即正 ⇒ **不算回本**（beIdx 必须 >0）
  ok(a.beIdx === 2, '之前为负、第3周转正 ⇒ 回本索引 2', String(a.beIdx))
  ok(b.beIdx === -1, '始终为负 ⇒ 未回本（-1）', String(b.beIdx))
  ok(c.beIdx === -1, '★ 首周即正 ⇒ 不算回本（与 BreakEvenChart 的 beIdx>0 同款）', String(c.beIdx))
}

// ── ④ 已回本 / 还需周数 ──────────────────────────────
{
  const 已 = 投资回报({ ledger: 账(100000), history: 历史([60000, 60000]) })
  ok(已.实际回本 === 2 && /已回本/.test(已.状态), '累计 ≥ 总投资 ⇒ 状态「已回本」+ 记录在第几周内', 已.状态)
  ok(已.进度 === 1 && 已.roi === 1.2, '已回本 ⇒ 进度钳到 100%（ROI 可 >100%）', `${百分比(已.进度)} / ROI ${百分比(已.roi)}`)
  const 未 = 投资回报({ ledger: 账(100000), history: 历史([10000, 10000]) })   // 周均 1 万 ⇒ 还需 8 周
  ok(未.还需周数 === 8, '按当前速率外推剩余周数（(100000-20000)/10000 = 8）', String(未.还需周数))
  const 无回收 = 投资回报({ ledger: 账(100000), history: 历史([-5000, -5000]) })
  ok(无回收.还需周数 === null && /无法推算/.test(无回收.状态), '尚无正向回收 ⇒ 不出周数（不许硬凑）', 无回收.状态)
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
