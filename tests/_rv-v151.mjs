// V151 RV · 撤掉 shifts 的改善（−4 → +18）⇒ 单调性破 ⇒ 判据红；还原后复绿
// 运行：node tests/_rv-v151.mjs   （会临时改 src/settlement.js，结束自动还原；中断需 git checkout -- src/settlement.js 会丢 V151 改动 —— 本卡未提交期间请改用 stash）
import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const P = 'src/settlement.js'
const BAK = 'scripts/_rv-v151.bak'
copyFileSync(P, BAK)
let pass = 0, fail = 0
const ok = (c, n) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n) } }
const runSuite = () => {
  const r = spawnSync(process.execPath, ['tests/v151Roi.test.mjs'], { encoding: 'utf8' })
  return (r.stdout || '') + (r.stderr || '')
}
try {
  let s = readFileSync(P, 'utf8')
  s = s.replace("if (decisions.shifts === '满编保服务') perRoomVariable -= 4", "if (decisions.shifts === '满编保服务') perRoomVariable += 18")
  s = s.replace("decisions.shifts === '满编保服务' ? -4 :", "decisions.shifts === '满编保服务' ? 18 :")
  writeFileSync(P, s, 'utf8')
  const r = runSuite()
  ok(/✗ FAIL: (① 四项边际|② 18 项|③ 单调|⑤ 18 − 6)/.test(r),
    'RV-1 撤掉 shifts 改善 ⇒ v151Roi 至少一条判据红（回到 V150 的倒挂形态）')
  const m = /18 项全量：(-?\d+)/.exec(r)
  ok(m && Number(m[1]) < 279736, `RV-2 撤改善后 18 项回落（${m ? m[1] : '?'} < 279,736 = 6 项水平）`)
} finally {
  copyFileSync(BAK, P)
  unlinkSync(BAK)
}
const r2 = runSuite()
ok(/结果: 6 通过 \/ 0 失败/.test(r2), 'RV-3 还原后 v151Roi 复绿 6/0')
console.log(`\nRV 结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
