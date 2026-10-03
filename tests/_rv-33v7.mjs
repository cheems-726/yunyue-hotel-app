// §33-V7 的**可执行**反向验证（RV）：教辅守门两条防线
//   RV-1 把讲义里某个机制标记改成不存在的机制名 ⇒ 必红
//   RV-2 在讲义里加一个黑名单功能名 ⇒ 必红
// 用法：node tests/_rv-33v7.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const 讲义 = path.join(APP, '..', '7-教学材料', '12周课堂讲义.md')
const 守门 = path.join(APP, 'tests', 'teachingClaims.test.mjs')
const 跑 = () => {
  try { return { code: 0, out: execFileSync(process.execPath, [守门], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } }
  catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') } }
}
let 全过 = true
const 例 = (label, 文件, 旧, 新, 片段) => {
  const 备份 = readFileSync(文件, 'utf8')
  try {
    if (!备份.includes(旧)) { console.log(`     ❌ 找不到靶子：${label}（期望片段：${旧.slice(0, 80)}）`); 全过 = false; return }
    writeFileSync(文件, 备份.replace(旧, 新))
    const r = 跑()
    const 掉红 = r.code !== 0 && r.out.includes(片段)
    writeFileSync(文件, 备份)
    const 还原 = 跑()
    const 复绿 = 还原.code === 0
    if (!(掉红 && 复绿)) 全过 = false
    console.log(`     ${掉红 && 复绿 ? '✓' : '✗'} ${label}：改后 exit=${r.code}（红=${掉红}）· 还原后 exit=${还原.code}（绿=${复绿}）`)
  } finally { writeFileSync(文件, 备份) }
}
console.log('【RV §33-V7】教辅守门两防线（红→绿可逆）\n')
// RV-1 机制标记改成不存在的机制名
例('RV-1 机制标记改不存在名（decisionRisk → decisionRiskX）',
  讲义,
  '【机制:decisionRisk】',
  '【机制:decisionRiskX】',
  '缺失 = 讲义在说系统没有的东西')
// RV-2 加黑名单功能名
例('RV-2 讲义加黑名单功能名（自动排班助手）',
  讲义,
  '**本周学什么**：人力优化（hr-optimize）· 排班（shifts）· 布草（linen）· 能耗（energy）',
  '**本周学什么**：人力优化（hr-optimize）· 排班（shifts）· 布草（linen）· 能耗（energy）· 系统自带自动排班助手',
  '反向断言：讲义零黑名单功能名')
console.log(`\n判定：${全过 ? '✓ RV 全过（2 条靶子：假机制名/黑名单功能）' : '❌ 有靶子未按预期变红/还原'}`)
process.exit(全过 ? 0 : 1)
