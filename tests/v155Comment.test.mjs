// V155 §2 · 点评时间序 + 升/降（卡判据：造「第 2 周 80% → 第 8 周 50%」⇒ 必须写「从第 2 周的 80% 降到第 8 周的 50%」）
// 运行：node tests/v155Comment.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
import { 点评生成 } from '../src/semesterResult.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const mk = (w, g, neg = 0) => ({ week: w, revenue: 100000, netProfit: 0, profit: 0, occupancy: 60, finalGoodRate: g, negativeCount: neg, decisions: {}, events: [] })

console.log('▶ V155 · 点评时间序与升降')
{
  // 卡判据原样：第 2 周 80% → 第 8 周 50%
  const hs = [mk(2, 80), mk(3, 70), mk(4, 65), mk(5, 60), mk(6, 55), mk(7, 52), mk(8, 50)]   // 卡判据原样：第 2 周 80% → 第 8 周 50%
  const claims = 点评生成(hs)
  const 口碑 = claims.find(c => c.文本.includes('口碑'))
  ok(!!口碑, '口碑点评存在')
  ok(/从第 2 周的 80% 降到第 8 周的 50%/.test(口碑.文本), `判据④ 原样：${口碑.文本}`, 口碑.文本)
  // 时间正序：文本里第一个"第 N 周" < 第二个"第 N 周"
  const 周 = [...口碑.文本.matchAll(/第 (\d+) 周/g)].map(m => Number(m[1]))
  ok(周.length === 2 && 周[0] < 周[1], `时间从早到晚（${周[0]} → ${周[1]}）`)
  // 升
  const hs2 = [mk(1, 50), mk(6, 90)]
  const 升 = 点评生成(hs2).find(c => c.文本.includes('口碑'))
  ok(/升到/.test(升.文本), `数值大=升：${升.文本}`)
  // 持平
  const hs3 = [mk(1, 72), mk(6, 72)]
  const 平 = 点评生成(hs3).find(c => c.文本.includes('口碑'))
  ok(/基本持平（72%）/.test(平.文本), `两端相等 ⇒ 基本持平：${平.文本}`)
  // RV 锚：实现必须取首/末周（不是最高/最低下标）——源码级钉
  const src = readFileSync(new URL('../src/semesterResult.mjs', import.meta.url), 'utf8')
  ok(/const 首 = hs\[0\], 末 = hs\[hs\.length - 1\]/.test(src), 'RV 锚：实现取首/末周（改回最高/最低下标 ⇒ 本锚红）')
}
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
