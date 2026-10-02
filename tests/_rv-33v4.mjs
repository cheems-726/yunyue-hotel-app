// §33-V4 的**可执行**反向验证（RV）
//   RV-1 A8 回退：把「选址.房价」塞回 consumptionCoverage 登记表 ⇒ 「登记表不腐烂」必红（接线被回退会当场被抓）
//   RV-2 A8 回退：把「选址.人力」塞回登记表 ⇒ 同上必红
//   RV-3 A8 摘除：把 settlement 的 房价环境 乘数改成恒 1（1+(档-3)*0 → 恒 1.0）⇒ consumptionCoverage「零消费维数 === 登记数」必红
//   RV-4 B7 回退：把 serverTick 的 resolvedWeight 传参删掉 ⇒ weeklyAuto B7 全通道断言必红
// 用法：node tests/_rv-33v4.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const COV = path.join(APP, 'tests', 'consumptionCoverage.test.mjs')
const ST = path.join(APP, 'src', 'settlement.js')
const TICK = path.join(APP, 'src', 'serverTick.mjs')
const WEEKLY = path.join(APP, 'tests', 'weeklyAuto.test.mjs')
const 跑 = (测试) => {
  try { return { code: 0, out: execFileSync(process.execPath, [测试], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } }
  catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') } }
}
let 全过 = true
const 例 = (label, 文件, 旧, 新, 片段, 测试) => {
  // ★ CRLF 归一化（§33-V4 教训：Windows 工作区 CRLF vs 靶子 LF ⇒ includes 恒 false）
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
console.log('【RV §33-V4】A8 回退/摘除 + B7 回退 ⇒ 必红（红→绿可逆）\n')
例('RV-1 A8 回退：把「选址.房价」塞回 consumptionCoverage 登记表',
  COV,
  "const 未接线登记 = [\n  // ★★ §33-V4-A8（2026-10-01）：「选址.房价」「选址.人力」**已接线 ⇒ 从登记表移除**（登记了却有消费 ⇒ 本守门自己红）。",
  "const 未接线登记 = [\n  { 项: '选址.房价', 原因: 'RV：塞回登记表（模拟接线被回退）', 归属: 'RV-33v4' },\n  // ★★ §33-V4-A8（2026-10-01）：「选址.房价」「选址.人力」**已接线 ⇒ 从登记表移除**（登记了却有消费 ⇒ 本守门自己红）。",
  '登记表不腐烂：登记为"未接线"的选址维确实仍未接线',
  COV)
例('RV-2 A8 回退：把「选址.人力」塞回登记表',
  COV,
  "const 未接线登记 = [\n  // ★★ §33-V4-A8（2026-10-01）：「选址.房价」「选址.人力」**已接线 ⇒ 从登记表移除**（登记了却有消费 ⇒ 本守门自己红）。",
  "const 未接线登记 = [\n  { 项: '选址.人力', 原因: 'RV：塞回登记表（模拟接线被回退）', 归属: 'RV-33v4' },\n  // ★★ §33-V4-A8（2026-10-01）：「选址.房价」「选址.人力」**已接线 ⇒ 从登记表移除**（登记了却有消费 ⇒ 本守门自己红）。",
  '登记表不腐烂：登记为"未接线"的选址维确实仍未接线',
  COV)
例('RV-3 A8 摘除：settlement 房价环境乘数改恒 1（维变零消费）',
  ST,
  'const 房价环境 = 1 + ((Number.isFinite(Number(s.房价)) ? Number(s.房价) : 3) - 3) * 0.03',
  'const 房价环境 = 1 + ((Number.isFinite(Number(s.房价)) ? Number(s.房价) : 3) - 3) * 0   // RV：摘除接线',
  '零消费维数',
  COV)
例('RV-4 B7 回退：serverTick 删 resolvedWeight 传参',
  TICK,
  '    resolvedWeight: 输入.resolvedWeight,',
  '    // RV：resolvedWeight 传参被摘除',
  'B7 全通道',
  WEEKLY)
console.log(`\n判定：${全过 ? '✓ RV 全过（4 条靶子：A8 回退×2 / A8 摘除 / B7 回退）' : '❌ 有靶子未按预期变红/还原'}`)
process.exit(全过 ? 0 : 1)
