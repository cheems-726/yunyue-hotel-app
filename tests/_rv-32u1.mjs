// §32-U1 / R2+R3 的**可执行**反向验证（RV）：把惩罚四要素真改回"无惩罚"样 ⇒ 跑 ⇒ 必红 ⇒ 还原 ⇒ 绿
//
//   RV-1 触发阈值：triggerPending 3 → 99（回到"永不触发"）⇒ hotReview[1][2] 必红
//   RV-2 即时惩罚：reputationCut 0.5 → 1（声誉不腰斩）  ⇒ hotReview[1][2] 必红
//   RV-3 持续惩罚：occPenalty 0.30 → 0（出租率不掉）    ⇒ hotReview[3]   必红
//   RV-4 默认裁量：null/维持 ⇒ 照罚 改成 null ⇒ 不罚（"不该默认放人"）⇒ hotReview[4]① 必红
//
// 说明：四条靶子都在 src/hotReview.mjs（单源 · 换算子等于真改惩罚强度）——
//       只要能改绿，就说明断言只覆盖了"声明"而没覆盖"算式"。
// 用法：node tests/_rv-32u1.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HR = path.join(APP, 'src', 'hotReview.mjs')
const 测试 = path.join(APP, 'tests', 'hotReview.test.mjs')

const 跑 = () => {
  try { return { code: 0, out: execFileSync(process.execPath, [测试], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } }
  catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') } }   // 失败写 stderr ⇒ 必须并收
}

let 全过 = true
const 例 = (label, 旧, 新, 片段) => {
  const 备份 = readFileSync(HR, 'utf8')
  try {
    if (!备份.includes(旧)) { console.log(`     ❌ 找不到靶子：${label}\n        （期望片段：${旧.slice(0, 70)}）`); 全过 = false; return }
    writeFileSync(HR, 备份.replace(旧, 新))
    const r = 跑()
    const 掉红 = r.code !== 0 && r.out.includes(片段)
    writeFileSync(HR, 备份)
    const 还原 = 跑()
    const 复绿 = 还原.code === 0
    if (!(掉红 && 复绿)) 全过 = false
    console.log(`     ${掉红 && 复绿 ? '✓' : '✗'} ${label}：改后 exit=${r.code}（红=${掉红}）· 还原后 exit=${还原.code}（绿=${复绿}）`)
  } finally {
    writeFileSync(HR, 备份)   // 无论中间怎么炸，必还原（防把惩罚改坏留在工作区）
  }
}

console.log('【RV §32-U1/R2+R3】惩罚四要素真改回"无惩罚" ⇒ 必红（红→绿可逆）\n')

例('RV-1 触发阈值 3 → 99（回到永不触发）',
  'triggerPending: 3,', 'triggerPending: 99,',
  '欠 ≥3 条 ⇒ 触发判定真')

例('RV-2 即时惩罚 声誉 ×0.5 → ×1（不腰斩）',
  'reputationCut: 0.5,', 'reputationCut: 1,',
  '即时声誉 ×')

例('RV-3 持续惩罚 出租率 −30% → −0%',
  'occPenalty: 0.30,', 'occPenalty: 0,',
  '危机周出租率确实更低')

例('RV-4 默认裁量：null ⇒ 照罚 改成 null ⇒ 不罚（不该默认放人）',
  "if (c.override === '降级为期末扣分') return false", "if (c.override !== '维持处罚') return false",
  '① override=null')

console.log(`\n判定：${全过 ? '✓ RV 全过（4 条靶子）' : '❌ 有靶子未按预期变红/还原'}`)
process.exit(全过 ? 0 : 1)
