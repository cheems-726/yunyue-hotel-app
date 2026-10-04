// RV · §33-V14 批1-M2 硬验收（卡：location-matrix 塞 1 条必失败断言 ⇒ 门禁必红；撤 ⇒ 绿）
// 塞法：往 location-matrix.mjs 的 dead 数组塞 1 条假重亏组合 ⇒ fail 26 > 基线 25 ⇒ M2 边界触发
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = dirname(dirname(fileURLToPath(import.meta.url)))
const 跑门禁 = () => spawnSync('node', ['tests/run-all.mjs', '--fast', '--no-build'], { cwd: APP, encoding: 'utf8', timeout: 900000 })
const LM = join(APP, 'tests', 'location-matrix.mjs')

let 全过 = true
const raw = readFileSync(LM)
const 原始 = raw.toString('utf8')
try {
  const 塞后 = 原始.replace(
    "const 断言失败 = dead.length",
    "dead.push({ loc: 'RV·塞入', brand: 'RV', profit: -99999 })\nconst 断言失败 = dead.length"
  )
  if (塞后 === 原始) { console.log('❌ 锚未命中'); process.exit(1) }
  writeFileSync(LM, 塞后)
  console.log('  已塞入 1 条假重亏组合（fail 25 → 26）· 跑门禁（fast · 约 6 分钟）…')
  const r1 = 跑门禁()
  const out1 = (r1.stdout || '') + (r1.stderr || '')
  const 红 = r1.status !== 0 && out1.includes('M2 豁免边界触发')
  writeFileSync(LM, raw)   // ★ 还原写 raw 原字节
  console.log('  已还原 · 再跑门禁确认绿…')
  const r2 = 跑门禁()
  const 绿 = !( (r2.stdout||'')+(r2.stderr||'') ).includes('M2 豁免边界触发')   // 还原判据=M2 信号消失（其他红=指纹族环境噪声 · 不属本靶）
  if (!(红 && 绿)) 全过 = false
  console.log(`     ${红 && 绿 ? '✓' : '✗'} M2 靶：塞入后门禁红=${红}（exit ${r1.status}）· 还原后绿=${绿}（exit ${r2.status}）`)
} finally { writeFileSync(LM, raw) }

console.log(`\n判定：${全过 ? '✓ M2 硬验收通过（基线外新增失败 ⇒ 门禁必红 · 豁免有边界）' : '❌ M2 验收失败'}`)
process.exit(全过 ? 0 : 1)
