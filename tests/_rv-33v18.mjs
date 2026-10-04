// RV · §33-V18 批3（甲3 两表守门 · ≥3 靶）
// 靶① 删某 🟢 行的来源词（锦江行去掉来源列实词）⇒ 必红；还原 ⇒ 绿
// 靶② 改格数（删一行）⇒ 必红；还原 ⇒ 绿
// 靶③ 给 🟢 行塞「估算」字样 ⇒ 必红；还原 ⇒ 绿
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = dirname(dirname(fileURLToPath(import.meta.url)))
const F = join(APP, '..', '4-审计与报告', '数据-甲3表一逐格26区位-20261005.md')
const 跑 = () => spawnSync('node', ['tests/dataCompleteness.test.mjs'], { cwd: APP, encoding: 'utf8', timeout: 120000 })

let 全过 = true
const 判 = (ok, label) => { if (!ok) 全过 = false; console.log(`     ${ok ? '✓' : '✗'} ${label}`) }

const raw = readFileSync(F, 'utf8')
try {
  // ── 靶① 删 🟢 行来源 ──
  //   ★ 替换文本不许含「来源」二字（守门正则按来源实词匹配 —— 用「（待补）」才是真·无来源）
  writeFileSync(F, raw.replace('成都发布通报（媒体转载）· 成都新闻网 2025-08-08（首批已录）', '（待补）'), 'utf8')
  let r = 跑()
  判(r.status !== 0, `靶① 删🟢行来源 ⇒ dataCompleteness 红（exit=${r.status}）`)
  writeFileSync(F, raw, 'utf8')
  r = 跑()
  判(r.status === 0, `靶① 还原 ⇒ 绿（exit=${r.status}）`)

  // ── 靶② 删一行（改格数 26→25）──
  const rows = raw.split('\n')
  const i = rows.findIndex(l => /^\| 2 \| /.test(l))
  writeFileSync(F, rows.filter((_, k) => k !== i).join('\n'), 'utf8')
  r = 跑()
  判(r.status !== 0, `靶② 删一行（26→25）⇒ 红（exit=${r.status}）`)
  writeFileSync(F, raw, 'utf8')
  r = 跑()
  判(r.status === 0, `靶② 还原 ⇒ 绿（exit=${r.status}）`)

  // ── 靶③ 给 🟢 行塞「估算」──
  writeFileSync(F, raw.replace('| 🟢 |', '| 🟢（估算） |'), 'utf8')
  r = 跑()
  判(r.status !== 0, `靶③ 🟢行塞「估算」⇒ 红（exit=${r.status}）`)
  writeFileSync(F, raw, 'utf8')
  r = 跑()
  判(r.status === 0, `靶③ 还原 ⇒ 绿（exit=${r.status}）`)
} finally {
  writeFileSync(F, raw, 'utf8')   // 任何路径都逐字节还原
}

console.log(`\n判定：${全过 ? '✓ V18批3 RV 三靶全过（删来源/改格数/塞估算 各必红·还原绿）' : '❌ RV 失败'}`)
process.exit(全过 ? 0 : 1)
