// §33-V1 的**可执行**反向验证（RV）：锚点断言"数字变了要红 · 状态变了也要红"
//   RV-1 数字：把长效总表的「全量 2094」改成错值 2095 ⇒ A08 必红；还原必绿
//   RV-2 状态：把长效总表 B14 职务加成的「✅ 已实施」改回「grep ⇒ 0」未做形态 ⇒ A13 必红；还原必绿
//   RV-3 (附) 横幅：把 App现状全景评估 的「已过期」横幅删掉 ⇒ A01 必红；还原必绿
//   RV-4 (附) 代码互证：往 src/ 塞一个含 handover 的临时文件 ⇒ A16（零命中判据）必红；删除后必绿
// 用法：node tests/_rv-33v1.mjs
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(APP, '..')
const 总表 = path.join(ROOT, '1-总纲与进度', '长效任务总表（总纲·开工先读）.md')
const 评估 = path.join(ROOT, '1-总纲与进度', 'App现状全景评估.md')
const 判 = path.join(APP, 'tests', 'docs-staleness.mjs')
const 跑 = () => {
  try { return { code: 0, out: execFileSync(process.execPath, [判, '--gate'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } }
  catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') } }
}
let 全过 = true
const 例 = (label, 文件, 旧, 新, 片段) => {
  const 备份 = readFileSync(文件, 'utf8')
  try {
    if (!备份.includes(旧)) { console.log(`     ❌ 找不到靶子：${label}\n        （期望片段：${旧.slice(0, 70)}）`); 全过 = false; return }
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
console.log('【RV §33-V1】锚点断言：数字红 · 状态红 · 横幅红 · 代码互证红\n')
例('RV-1 数字类：长效总表「全量 2094」→ 2095（A08 必红）',
  总表, '全量 **2094 通过 / 0 失败**', '全量 **2095 通过 / 0 失败**', 'A08 长效总表「全量 N」=== 门禁记录')
例('RV-2 状态类：B14 职务加成「已实施」改回「未做」（A13 必红）',
  总表,
  '| **B14** | R4 职务加成（×1.3 软约束） | 路线图 R4 / 模块五 | ✅ **已实施**',
  '| **B14** | R4 职务加成（×1.3 软约束） | 路线图 R4 / 模块五 | grep `职务加成|roleBonus` ⇒ **0** ⇒ **谁处理都一样**',
  'A13 长效总表 B14')
// RV-3 横幅类（App 评估头部第一块被删）
{
  const 备份 = readFileSync(评估, 'utf8')
  try {
    if (!备份.startsWith('> ⚠️ **【已过期')) { console.log('     ❌ 找不到靶子：RV-3 App评估横幅（首行不是横幅）'); 全过 = false }
    else {
      writeFileSync(评估, 备份.replace(/^> ⚠️ \*\*【已过期[^\n]*\n/, '> （历史文档 · V1）\n'))
      const r = 跑()
      const 掉红 = r.code !== 0 && r.out.includes('A01 App现状全景评估')
      writeFileSync(评估, 备份)
      const 还原 = 跑()
      const 复绿 = 还原.code === 0
      if (!(掉红 && 复绿)) 全过 = false
      console.log(`     ${掉红 && 复绿 ? '✓' : '✗'} RV-3 横幅类：删 App评估「已过期」横幅（A01 必红）：改后 exit=${r.code}（红=${掉红}）· 还原后 exit=${还原.code}（绿=${复绿}）`)
    }
  } finally { writeFileSync(评估, 备份) }
}
// RV-4 代码互证（A16 零命中判据被真实代码打破）
{
  const 探 = path.join(APP, 'src', '_rv-handover-probe.mjs')
  try {
    writeFileSync(探, '// RV 探针（用完删）\nexport const handover = null\n')
    const r = 跑()
    const 掉红 = r.code !== 0 && r.out.includes('A16 路线图 R7')
    const 复绿 = (() => { try { unlinkSync(探); return 跑().code === 0 } catch (e) { return false } })()
    if (!(掉红 && 复绿)) 全过 = false
    console.log(`     ${掉红 && 复绿 ? '✓' : '✗'} RV-4 代码互证：src 出现 handover ⇒ A16 必红：改后 exit=${r.code}（红=${掉红}）· 删探针后（绿=${复绿}）`)
  } finally { try { unlinkSync(探) } catch (e) {} }
}
console.log(`\n判定：${全过 ? '✓ RV 全过（4 条靶子：数字/状态/横幅/代码互证）' : '❌ 有靶子未按预期变红/还原'}`)
process.exit(全过 ? 0 : 1)
