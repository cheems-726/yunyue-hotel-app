// V130 §1 反向验证（RV）：往**非 allowlist** 的被跟踪文件里塞一个明文口令 ⇒ 守门必须红
// 做法：读原字节 ⇒ 追加一行针 ⇒ 跑 tests/ledgerSecrets.test.mjs（期望红）⇒ 逐字节还原 ⇒ 再跑（期望绿）
// 运行：node tests/_rv-v130-ledger.mjs
// 判据：红态里**只能**看到我们塞的那个文件（防止"红是别的断言给的"= 假红/假绿）
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(HERE, '..')
const TARGET = path.join(APP, 'scripts', 'server', 'opscheck.sh')   // 已跟踪 + 不在 allowlist
const GATE = path.join(HERE, 'ledgerSecrets.test.mjs')
const NEEDLE = 'test' + '123456'

const runGate = () => {
  const r = spawnSync(process.execPath, [GATE], { cwd: APP, encoding: 'utf8', shell: false })
  const out = (r.stdout || '') + (r.stderr || '')
  const m = /结果:\s*(\d+)\s*通过\s*\/\s*(\d+)\s*失败/.exec(out)
  return { code: r.status, pass: m ? +m[1] : -1, fail: m ? +m[2] : -1, out }
}

console.log('══ V130 §1 RV · 明文口令守门必须能变红 ══')
const 原字节 = readFileSync(TARGET)

const before = runGate()
console.log(`  ① 原样：exit=${before.code} ${before.pass}/${before.fail}（期望 0 · 0 失败）`)
if (before.code !== 0) { console.error('  ✗ 前置不绿 ⇒ RV 无意义'); process.exit(1) }

const 注入 = Buffer.concat([原字节, Buffer.from(`\n# RV-130 注入针 ${NEEDLE}\n`, 'utf8')])
writeFileSync(TARGET, 注入)
let after
try {
  after = runGate()
} finally {
  writeFileSync(TARGET, 原字节)   // 逐字节还原（哪怕上一步崩了也还原）
}
const 命中目标 = after.out.includes('scripts/server/opscheck.sh')
const 只命中目标 = after.out.split('\n').filter(l => /·\s+(文档仓|代码仓):/.test(l)).every(l => l.includes('opscheck.sh'))
console.log(`  ② 注入后：exit=${after.code} ${after.pass}/${after.fail}（期望 1 · 1 失败）· 命中目标文件=${命中目标} · 只命中目标=${只命中目标}`)

const restored = readFileSync(TARGET)
const 一致 = Buffer.compare(restored, 原字节) === 0
const re = runGate()
console.log(`  ③ 还原后：exit=${re.code} ${re.pass}/${re.fail}（期望 0 · 0 失败）· 逐字节一致=${一致}`)

const okAll = before.code === 0 && after.code === 1 && after.fail >= 1 && 命中目标 && 只命中目标 && 一致 && re.code === 0
console.log(okAll ? '\n✓ RV 通过：注入必红、还原必绿、命中定位正确' : '\n✗ RV 失败（见上）')
process.exit(okAll ? 0 : 1)
