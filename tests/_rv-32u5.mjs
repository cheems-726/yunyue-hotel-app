// §32-U5 的**可执行**反向验证（RV）：冻结前校核 —— 三方一致判据真的能咬
//   RV-1 产物文档 1 格改错（金额）⇒ reportCaliber 必红
//   RV-2 产物文档 属性三元组 改错 ⇒ reportCaliber 必红（品质位）
//   RV-3 产物文档 好评率 改错 ⇒ reportCaliber 必红
//   RV-4 四处指纹之一改成旧 HEAD ⇒ docs-sync 必红
// 用法：node tests/_rv-32u5.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(APP, '..')
const 长跑 = path.join(ROOT, '4-审计与报告', '18周（126天）长跑报告.md')
const 数值平衡 = path.join(ROOT, '4-审计与报告', '数值平衡与口径总览-20260929.md')
const 闸门 = path.join(ROOT, '9-夜间自动化', '夜间开工闸门.txt')
const 口径 = path.join(APP, 'tests', 'reportCaliber.test.mjs')
const 同步 = path.join(APP, 'tests', 'docs-sync.mjs')
const 跑 = (测试) => {
  try { return { code: 0, out: execFileSync(process.execPath, [测试], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } }
  catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') } }
}
let 全过 = true
const 例 = (label, 文件, 旧, 新, 片段, 测试) => {
  const 备份 = readFileSync(文件, 'utf8').replace(/\r\n/g, '\n')
  try {
    if (!备份.includes(旧)) { console.log(`     ❌ 找不到靶子：${label}（期望片段：${旧.slice(0, 80)}）`); 全过 = false; return }
    writeFileSync(文件, 备份.replace(旧, 新))
    const r = 跑(测试)
    const 掉红 = r.code !== 0 && r.out.includes(片段)
    writeFileSync(文件, 备份)
    const 还原 = 跑(测试)
    const 复绿 = 还原.code === 0
    if (!(掉红 && 复绿)) 全过 = false
    console.log(`     ${掉红 && 复绿 ? '✓' : '✗'} ${label}：改后 exit=${r.code}（红=${掉红}）· 还原后 exit=${还原.code}（绿=${复绿}）`)
  } finally { writeFileSync(文件, 备份) }
}
console.log('【RV §32-U5】合并校核 · 三方一致判据（红→绿可逆）\n')
// RV-1 金额格
例('RV-1 金额：长跑 1勤奋型 期末资金改错',
  长跑, '| 1勤奋型 | **1,869,179** | 2,191,060 |', '| 1勤奋型 | **1,869,180** | 2,191,060 |',
  '第 1 列', 口径)
// RV-2 属性格（品质位 · 三元组逐项判死的靶）
例('RV-2 属性：长跑 1勤奋型 品质 60→61',
  长跑, '50% | 60 / 97 / 95', '50% | 61 / 97 / 95',
  '品质位', 口径)
// RV-3 好评率格
例('RV-3 好评率：长跑 1勤奋型 50%→51%',
  长跑, '**−321,881** | 50% | 60 / 97 / 95', '**−321,881** | 51% | 60 / 97 / 95',
  '好评率', 口径)
// RV-4 指纹
例('RV-4 指纹：闸门 HEAD 改成旧值',
  闸门, '（★ 收尾指纹：HEAD', '（★ 收尾指纹：HEAD 0000000 · 未推 **30** —— 伪造',
  '收尾指纹', 同步)
console.log(`\n判定：${全过 ? '✓ RV 全过（4 条靶子：金额/属性/好评率/指纹）' : '❌ 有靶子未按预期变红/还原'}`)
process.exit(全过 ? 0 : 1)
