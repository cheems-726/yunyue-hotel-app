// §32-U4-R4 的**可执行**反向验证（RV）：把"职务加成"改回"谁处理都一样" ⇒ 必红 ⇒ 还原 ⇒ 绿
//
//   RV-1 ROLE_BONUS 1.3 → 1.0（倍率被抹平 —— 单元卡 §3 RV 要求的那条）
//   RV-2 匹配判定改成永远不匹配（职务匹配恒 false）⇒ 权重全 1.0
//   RV-3 切断 weekInputs 的产出（resolvedWeight 直接等于 resolvedCount）⇒ [2] 进结算断言必红
//   RV-4 settle 忽略权重（不用 有效处理数 判门槛）⇒ 增益断言必红
//
// 用法：node tests/_rv-32u4.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RB = path.join(APP, 'src', 'roleBonus.mjs')
const WI = path.join(APP, 'src', 'weekInputs.mjs')
const ST = path.join(APP, 'src', 'settlement.js')
const 测试 = path.join(APP, 'tests', 'roleBonus.test.mjs')
const 跑 = () => {
  try { return { code: 0, out: execFileSync(process.execPath, [测试], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } }
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
console.log('【RV §32-U4-R4】把职务加成改成"谁处理都一样" ⇒ 必红（红→绿可逆）\n')
例('RV-1 倍率 1.3 → 1.0（抹平加成）', RB, 'export const ROLE_BONUS = 1.3', 'export const ROLE_BONUS = 1.0', '倍率 = ')
例('RV-2 匹配恒 false（职务不起作用）', RB, '  return !!g && g === r', '  return false', '对应职务 ⇒ ×1.3')
例('RV-3 weekInputs 不产出权重（回退成计数）', WI, 'const resolvedWeight = 有效处理权重(结算卡.filter(r => r.status === \'resolved\'), 处理人职务)', 'const resolvedWeight = resolvedCount', '对岗：权重 ')
例('RV-4 settle 忽略权重（门槛仍用计数）', ST, 'if (有效处理数 >= EVENT_CONFIG.renovationPraise.minResolved', 'if (resolvedCount >= EVENT_CONFIG.renovationPraise.minResolved', '增益按权重')
console.log(`\n判定：${全过 ? '✓ RV 全过（4 条靶子）' : '❌ 有靶子未按预期变红/还原'}`)
process.exit(全过 ? 0 : 1)
