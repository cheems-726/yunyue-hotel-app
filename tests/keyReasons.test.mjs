// V131 §1-B · 本周关键决策（代价级代理表）与理由条数
// 运行：node tests/keyReasons.test.mjs   （挂 run-all fast）
import { 本周关键决策, 关键理由条数, 理由合格, 代价级表 } from '../src/keyReasons.mjs'
import { decisions } from '../src/decisions.js'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ V131 §1-B · 关键决策理由')

console.log('\n[①] 每周恰好 3 项（按代价级降序 · 全部真实存在）')
{
  const ids = 本周关键决策(decisions)
  ok(ids.length === 3, `恰好 3 项（实得 ${ids.length}：${ids.join('/')}）`)
  ok(ids[0] === 'renovation' && ids[1] === 'hr-optimize' && ids[2] === 'pricing', `前三 = 改造投资/人力优化/动态调价（实得 ${ids.join('/')}）`)
  const 存在 = new Set(decisions.map(d => d.id))
  ok(ids.every(id => 存在.has(id)), '全部是 decisions.js 里真实存在的 id')
  ok(代价级表.every(x => Number.isFinite(x.级)), '代价级表每项都有数值级（可排序）')
}

console.log('\n[②] 决策子集 ⇒ 只从可用项里挑（最多 3）')
{
  const 子 = decisions.filter(d => ['pricing', 'energy'].includes(d.id))
  const ids = 本周关键决策(子)
  ok(ids.length === 2 && ids[0] === 'pricing' && ids[1] === 'energy', `只有调价+能耗 ⇒ [pricing, energy]（实得 ${ids.join('/')}）`)
  ok(本周关键决策([]).length === 3, '空列表 ⇒ 仍返回代理表前 3（调用方应传真实决策表）')
}

console.log('\n[③] 理由条数：按本周 · 空文本不算 · 0–3')
{
  const 关键 = ['renovation', 'hr-optimize', 'pricing']
  const 理由 = {
    renovation: { week: 3, 文本: '回收期太长，这周不投' },
    'hr-optimize': { week: 3, 文本: '   ' },
    pricing: { week: 2, 文本: '上周的' },
  }
  ok(关键理由条数(理由, 3, 关键) === 1, '本周只算 1 条（空文本/上周都不算）')
  ok(关键理由条数({ renovation: { week: 3, 文本: 'a' }, 'hr-optimize': { week: 3, 文本: 'b' }, pricing: { week: 3, 文本: 'c' } }, 3, 关键) === 3, '三条齐 ⇒ 3')
  ok(关键理由条数({}, 3, 关键) === 0, '一条没有 ⇒ 0')
  ok(关键理由条数(null, 3, 关键) === 0, '空 map ⇒ 0（不崩）')
}

console.log('\n[④] 单条理由合格：非空且 ≤30 字')
{
  ok(理由合格('不投：回收期超过学期') === true, '正常一句 ⇒ 合格')
  ok(理由合格('') === false && 理由合格('   ') === false, '空/空白 ⇒ 不合格')
  ok(理由合格('x'.repeat(30)) === true && 理由合格('x'.repeat(31)) === false, '30 字边界（31 ⇒ 不合格）')
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
