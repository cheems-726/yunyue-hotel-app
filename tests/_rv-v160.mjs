// V160 RV · 摘掉学期闸 ⇒ 判据①红（blockedBy 丢失）；还原 ⇒ 复绿
// 运行：node tests/_rv-v160.mjs
import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

let pass = 0, fail = 0
const ok = (c, n) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n) } }
const run = () => { const r = spawnSync(process.execPath, ['tests/semesterGateV160.test.mjs'], { encoding: 'utf8' }); return (r.stdout || '') + (r.stderr || '') }

const S = 'src/serverTick.mjs', BAK = 'scripts/_rv160.bak'
try {
  copyFileSync(S, BAK)
  const s = readFileSync(S, 'utf8')
  const i = s.indexOf('if (!学期闸结果.allowed) {')
  if (i < 0) throw new Error('RV 锚缺失：学期闸 if')
  // 摘闸：让 if 永远为 false（闸不在 ⇒ blockedBy 丢失 · 判据①红）
  writeFileSync(S, s.slice(0, i) + 'if (false && !学期闸结果.allowed) {' + s.slice(i + 'if (!学期闸结果.allowed) {'.length), 'utf8')
  const out = run()
  ok(/✗ FAIL: .*finished ⇒ blockedBy/.test(out) || /✗ FAIL: .*running \+ week 13/.test(out), 'RV-1 摘掉学期闸 ⇒ blockedBy 判据红')
} finally { copyFileSync(BAK, S); unlinkSync(BAK) }

ok(!/✗ FAIL/.test(run()), 'RV-2 还原后复绿 18/0')
console.log(`\nRV 结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
