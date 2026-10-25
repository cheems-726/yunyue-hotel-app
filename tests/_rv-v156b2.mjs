// V156 阶段二 RV · 摘掉幂等闸 ⇒ 并发判据红（能判死"闸不在"）；还原 ⇒ 复绿
// 运行：node tests/_rv-v156b2.mjs
import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

let pass = 0, fail = 0
const ok = (c, n) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n) } }
const run = () => { const r = spawnSync(process.execPath, ['tests/settleIdempotent.test.mjs'], { encoding: 'utf8' }); return (r.stdout || '') + (r.stderr || '') }

const S = 'src/settleIdempotent.mjs', BAK = 'scripts/_rv156b2.bak'
try {
  copyFileSync(S, BAK)
  const s = readFileSync(S, 'utf8')
  if (!s.includes('if (gate.hit)')) throw new Error('RV 锚缺失：gate.hit')
  // 摘闸：幂等命中也照常进引擎（= 闸不在的旧行为）
  writeFileSync(S, s.replace('if (gate.hit) {', 'if (false && gate.hit) {  // [RV] 幂等闸已摘'), 'utf8')
  const out = run()
  ok(/✗ FAIL: .*并发 10 次同周|✗ FAIL: .*只有第 1 次 advanced|✗ FAIL: .*重试 3 次/.test(out), 'RV-1 摘掉幂等闸 ⇒ 并发/重试判据红（判据能判死）')
  if (!/✗ FAIL/.test(out)) console.log('    [输出尾] ' + out.slice(-300))
} finally {
  copyFileSync(BAK, S); unlinkSync(BAK)
}
ok(!/✗ FAIL/.test(run()), 'RV-2 还原后复绿 17/0')
console.log(`\nRV 结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
