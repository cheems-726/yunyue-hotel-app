// §24.2 [7] 的反向验证（RV）：改文档任一格 / 改套件钉值 ⇒ 必红；还原 ⇒ 绿
// 用法：node tests/_rv-24-2.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(APP, '..')
const DIR = path.join(ROOT, '4-审计与报告')
const 总览 = path.join(DIR, '数值平衡与口径总览-20260929.md')
const 长跑 = path.join(DIR, '18周（126天）长跑报告.md')
const 过审包 = path.join(DIR, '全日过审包-20260929.md')
const 学期套件 = path.join(APP, 'tests', 'semesterRun12.test.mjs')

const 跑 = () => {
  // 注意：套件的失败行走 stderr ⇒ 必须显式捕获（否则"红了但看起来没红"）
  try {
    const out = execFileSync(process.execPath, [path.join(APP, 'tests', 'reportCaliber.test.mjs')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') }
  }
}
const 红 = (r) => r.code !== 0 && r.out.includes('[7]') && /FAIL: ★ .*口径：文档六组/.test(r.out)
// §24.1② 过审包靶子的判据在 docs-sync（文档类套件 · 有"按修好后计数记"的记录策略兜自指）
const 跑DS = () => {
  try {
    const out = execFileSync(process.execPath, [path.join(APP, 'tests', 'docs-sync.mjs')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') }
  }
}
const 红DS = (r) => r.code !== 0 && /✗.*全日过审包「门禁数字」行/.test(r.out)

const 试一例 = (label, 文件, 旧, 新, 判据 = 'caliber') => {
  const 备份 = readFileSync(文件, 'utf8')
  if (!备份.includes(旧)) { console.log(`     ❌ 找不到靶子：${label}（${旧}）`); return false }
  writeFileSync(文件, 备份.replace(旧, 新))
  const r = 判据 === 'caliber' ? 跑() : 跑DS()
  writeFileSync(文件, 备份)
  const 掉红 = 判据 === 'caliber' ? 红(r) : 红DS(r)
  const 还原 = 判据 === 'caliber' ? 跑() : 跑DS()
  const 复绿 = 还原.code === 0
  console.log(`     ${掉红 && 复绿 ? '✓' : '✗'} ${label}：改后 exit=${r.code}（红=${掉红}）· 还原后 exit=${还原.code}（绿=${复绿}）`)
  return 掉红 && 复绿
}

console.log('【RV-§24.2[7] + §24.1②】靶子四处（改一处验证一处 · 逐次还原）\n')
const a = 试一例('① 改《数值平衡总览》§四 学期列一格（1勤奋型 1,773,090 → 1,773,091）', 总览, '**1,773,090**', '**1,773,091**')
const b = 试一例('② 改《长跑报告》§二 长稳列一格（1勤奋型 1,942,060 → 1,942,061）', 长跑, '1,942,060', '1,942,061')
const c = 试一例('③ 改学期套件钉值（1勤奋型 1773090 → 1773091）', 学期套件, "'1勤奋型': 1773090", "'1勤奋型': 1773091")
const d = 试一例('④ 改《过审包》「门禁数字」行一格（全量 1657 → 1658）', 过审包, '全量 **1657/0**', '全量 **1658/0**', 'docsync')

console.log(`\n判定：${a && b && c && d ? '✓ RV 四条全过（红→绿可逆）' : '❌ 有靶子未变红，断言未真正生效'}`)
process.exit(a && b && c && d ? 0 : 1)
