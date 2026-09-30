// §32-U1 / A1-补② 的**可执行**反向验证（RV）：把 A1 的两层校验真改回旧样 ⇒ 跑 ⇒ 必红 ⇒ 还原 ⇒ 绿
//
//   RV-1  前端：删掉 handleBrandClick 里的超档 return（回到"只渲染横幅不校验"的 D83-c 原状）⇒ tierLimit[3] 必红
//   RV-2  引擎：删掉 settle 入口的 校验等级限制 调用（超档不再 throw）                    ⇒ tierLimit[2] 必红
//
// 用法：node tests/_rv-31a1.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BS = path.join(APP, 'src', 'BrandSelection.jsx')
const ST = path.join(APP, 'src', 'settlement.js')

const 跑 = () => {
  try { return { code: 0, out: execFileSync(process.execPath, [path.join(APP, 'tests', 'tierLimit.test.mjs')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } }
  catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') } }
}

let 全过 = true
const 例 = (label, 文件, 旧, 新, 片段) => {
  const 备份 = readFileSync(文件, 'utf8')
  if (!备份.includes(旧)) { console.log(`     ❌ 找不到靶子：${label}\n        （期望片段：${旧.slice(0, 70)}）`); 全过 = false; return }
  writeFileSync(文件, 备份.replace(旧, 新))
  const r = 跑()
  writeFileSync(文件, 备份)
  const 掉红 = r.code !== 0 && r.out.includes(片段)
  const 还原 = 跑()
  const 复绿 = 还原.code === 0
  if (!(掉红 && 复绿)) 全过 = false
  console.log(`     ${掉红 && 复绿 ? '✓' : '✗'} ${label}：改后 exit=${r.code}（红=${掉红}）· 还原后 exit=${还原.code}（绿=${复绿}）`)
}

console.log('【RV §32-U1/A1-补②】两层校验真改回旧样 ⇒ 必红（红→绿可逆）\n')

例('RV-1 前端：删掉 handleBrandClick 的超档 return（D83-c 原状）',
  BS,
  'if (gi + 1 > maxTier) {',
  'if (false) {',
  '超档直接 return')

例('RV-2 引擎：删掉 settle 入口的 校验等级限制 调用',
  ST,
  '校验等级限制({ site: s, brand })',
  '/* §rv-31a1 临时摘除 */',
  'settle **抛错**')

console.log(`\n判定：${全过 ? '✓ RV 全过（2 条靶子）' : '❌ 有靶子未按预期变红/还原'}`)
process.exit(全过 ? 0 : 1)
