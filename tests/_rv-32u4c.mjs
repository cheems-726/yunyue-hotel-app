// §32-U4c 的**可执行**反向验证（RV）：把某项决策还原成"纯收益" ⇒ 必红 ⇒ 还原 ⇒ 绿
//   RV-1 属性类：删「未提交质检」的属性代价（quality -2 / rep -1）⇒ 该分支变纯收益 ⇒ decisionRisk[1] 必红
//   RV-2 钱类：删「超售（>0 间）」条目 ⇒ 反向分支无条目 ⇒ decisionRisk[1] 必红
//   RV-3 接线：删 settle 的不作为惩罚调用 ⇒ decisionRisk[4][6] 必红
// 用法：node tests/_rv-32u4c.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DR = path.join(APP, 'src', 'decisionRisk.mjs')
const ST = path.join(APP, 'src', 'settlement.js')
const 测试 = path.join(APP, 'tests', 'decisionRisk.test.mjs')
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
console.log('【RV §32-U4c/R6】把决策改回"纯收益" ⇒ 必红（红→绿可逆）\n')
例('RV-1 属性类：「未提交质检」去掉属性代价（变纯收益）',
  DR, "    '未提交质检': { 代价: '硬伤留在房里被客人碰到 ⇒ 差评与品质下滑（省了人力，赔了口碑）', 类别: '属性', 属性: { quality: -2, reputation: -1 } },",
  "    '未提交质检': { 代价: '（无）', 类别: '钱' },",
  '每分支全有条目且带代价语义')
例('RV-2 钱类：删「超售（>0 间）」整条（分支无条目）',
  DR, "    '超售（>0 间）': { 代价: '到店无房赔偿 + 差评风险（超售越多概率越高）', 类别: '钱' },\n",
  '',
  '每分支全有条目且带代价语义')
例('RV-3 不作为惩罚（单源层摘除）',
  DR, 'export function 不作为属性扣减(已决策项数) {',
  'export function 不作为属性扣减(已决策项数) {\n  void 已决策项数; return {};   // RV：摘除不作为惩罚（单源层 · 全路径不扣）',
  '不作为惩罚量随缺项数现算')
console.log(`\n判定：${全过 ? '✓ RV 全过（3 条靶子）' : '❌ 有靶子未按预期变红/还原'}`)
process.exit(全过 ? 0 : 1)
