// V128 反例验证（RV）：按批次逐条拿掉修复 ⇒ 对应守门必红；还原 ⇒ 复绿
// 运行：node tests/_rv-v128.mjs      （evidence 脚本，不进 run-all）
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const 跑 = (file) => {
  try {
    const out = execFileSync(process.execPath, [path.join(APP, file)], { cwd: APP, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') }
  }
}
const 试一例 = (label, 文件, 旧, 新, 套件) => {
  const p = path.join(APP, 文件)
  const 备份 = readFileSync(p, 'utf8')
  if (!备份.includes(旧)) { console.log(`  ❌ 找不到靶子：${label}`); return false }
  try {
    writeFileSync(p, 备份.replace(旧, 新))
    const r = 跑(套件)
    const 掉红 = r.code !== 0
    writeFileSync(p, 备份)
    const 复绿 = 跑(套件).code === 0
    console.log(`  ${掉红 && 复绿 ? '✓' : '✗'} ${label}：拿掉后 exit=${r.code}（红=${掉红}）· 还原后绿=${复绿}`)
    return 掉红 && 复绿
  } finally {
    writeFileSync(p, 备份)
  }
}

const 例s = []
console.log('【RV-V128】逐批靶子（每次只改一处 · 逐次还原）\n')

// ── §1 V117 两列 ──────────────────────────────────────────────
例s.push(试一例('#1a 学生端承诺书改回 null', 'src/App.jsx',
  'const 承诺书 = 选址承诺书 ? 选址过程分(选址承诺书).过程分 : null',
  'const 承诺书 = null', 'tests/processScore.test.mjs'))
例s.push(试一例('#1b 教师端承诺书改回 null', 'src/processLedgerRows.mjs',
  'const 承诺书 = 选址承诺书 && typeof 选址承诺书 === \'object\' ? 选址过程分(选址承诺书).过程分 : null',
  'const 承诺书 = null', 'tests/processScore.test.mjs'))

// ── §2 V118 四出口 ────────────────────────────────────────────
例s.push(试一例('#2a 变动成本出口拿掉', 'src/settlement.js',
  'if (注入应对成本加) variableCost += 注入应对成本加',
  '', 'tests/v128Outputs.test.mjs'))
例s.push(试一例('#2b 士气出口拿掉', 'src/settlement.js',
  'attrsAfter = applyAttrsDelta(attrsAfter, { morale: Number(E7效力.士气) })',
  'attrsAfter = attrsAfter', 'tests/v128Outputs.test.mjs'))
例s.push(试一例('#2c 品质/声誉出口拿掉', 'src/settlement.js',
  'const 有应对E3 = !!(效力E3 && Number.isFinite(Number(效力E3.品质)))',
  'const 有应对E3 = false', 'tests/v128Outputs.test.mjs'))
例s.push(试一例('#2d 无应对分支改坏（零变化）', 'src/settlement.js',
  'attrsAfter = applyAttrsDelta(attrsAfter, { morale: -10 })',
  'attrsAfter = applyAttrsDelta(attrsAfter, { morale: -20 })', 'tests/_v128-before-after.mjs'))

console.log(`\n结果: ${例s.filter(Boolean).length} / ${例s.length} 条 RV 成立`)
process.exit(例s.every(Boolean) ? 0 : 1)
