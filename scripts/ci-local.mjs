#!/usr/bin/env node
// §33-V4-E② · 本地 CI 骨架（把「全量门禁 + build + 关键 RV」串成一条 · 输出一眼可读）
//   ★ 本地等价实现（零网络/零凭据 · 与 github actions 解耦）；不许为此放宽任何判据。
//   用法：node scripts/ci-local.mjs            全流程
//         node scripts/ci-local.mjs --fast     快检档（跳浏览器 · 约半分钟）
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FAST = process.argv.includes('--fast')
const 步 = []
let 失败 = 0

const 记 = (名, ok, 备注 = '') => {
  步.push({ 名, ok, 备注 })
  if (!ok) 失败++
  console.log(`${ok ? '✅' : '❌'} ${名}${备注 ? '  — ' + 备注 : ''}`)
}
const 跑 = (名, cmd, args, 判定) => {
  console.log(`\n▶ ${名}（${cmd} ${args.join(' ')}）`)
  const t0 = Date.now()
  const r = spawnSync(cmd, args, { cwd: APP, encoding: 'utf8', shell: process.platform === 'win32' })
  const out = (r.stdout || '') + (r.stderr || '')
  const dur = ((Date.now() - t0) / 1000).toFixed(1) + 's'
  const ok = 判定 ? 判定(r.status, out) : r.status === 0
  记(名, ok, `${dur}${ok ? '' : ' · 失败（详见上方输出）'}`)
  return { ok, out }
}

console.log('════════ 本地 CI（§33-V4-E②）════════')
console.log(`档位：${FAST ? 'fast（跳浏览器）' : 'full（含浏览器 · 约 8 分钟）'}\n`)

// ① build（改 src 必须 build —— 卡内 §5⑥）
跑('① build', process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'],
  (st, out) => st === 0 && /built in/.test(out))

// ② 门禁（fast 或 full）
跑(FAST ? '② 门禁 fast' : '② 门禁 full', process.platform === 'win32' ? 'node.exe' : 'node',
  ['tests/run-all.mjs', ...(FAST ? ['--fast', '--no-build'] : [])],
  (st) => st === 0)

// ③ 关键 RV（改哪防哪 · 每个 ≤ 1 分钟；全跑也不碰网络）
const RVS = [
  ['RV-32u1（危机三红线）', 'tests/_rv-32u1.mjs'],
  ['RV-32u4c（R6 代价）', 'tests/_rv-32u4c.mjs'],
  ['RV-32u8（注入三红线）', 'tests/_rv-32u8.mjs'],
  ['RV-32u8补（界面接线）', 'tests/_rv-32u8补.mjs'],
  ['RV-33v1（文档锚点）', 'tests/_rv-33v1.mjs'],
]
for (const [名, f] of RVS) {
  if (!existsSync(path.join(APP, f))) { 记(`③ ${名}`, false, '脚本不存在'); continue }
  跑(`③ ${名}`, process.platform === 'win32' ? 'node.exe' : 'node', [f], (st) => st === 0)
}

// ④ 门禁记录与工作区一致性（快照判据）
{
  let g = {}
  try { g = JSON.parse(readFileSync(path.join(APP, 'tests', '_last-gate.json'), 'utf8')) } catch (e) {}
  const 档 = FAST ? g.fast : g.full
  记('④ 门禁记录存在且 0 失败', !!(档 && 档.失败 === 0), 档 ? `${FAST ? 'fast' : 'full'} ${档.通过}/0 @${String(档.head).slice(0, 7)}` : '无记录')
}

console.log('\n════════ 结论 ════════')
for (const s of 步) console.log(`${s.ok ? '✅' : '❌'} ${s.名}${s.备注 ? '  — ' + s.备注 : ''}`)
const 全过 = 失败 === 0
console.log(`\n${全过 ? '✅ CI 全绿' : `❌ CI ${失败} 项失败`}`)
process.exit(全过 ? 0 : 1)
