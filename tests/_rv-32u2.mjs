// §32-U2 的**可执行**反向验证（RV）：把报告里的数字真改成"硬编码错值 / 第二本账" ⇒ 跑 ⇒ 必红 ⇒ 还原 ⇒ 绿
//
//   RV-1 硬编码错值：累计营收 totalRevenue(history) → 999999999（单元卡 §4 明文要求的那条）
//   RV-2 第二本账：逐周营收 h.revenue → 自算 h.revenue * 1.01（"报告自己乘一遍"⇒ 结构扫描 + 逐格比对双红）
//   RV-3 极值方向：最好周 'max' → 'min'（最好/最差都取 min ⇒ 方向断言红）
//   RV-4 单源旁路：累计净利率(history,'经营') → 累计净利率(history,'资金')（口径混装 ⇒ 逐值比对红）
//
// 说明：四条靶子都打在 `src/teacherReport.mjs`（报告层）—— 只要能改绿，就说明守门只覆盖了"声明"没覆盖"值"。
// 用法：node tests/_rv-32u2.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TR = path.join(APP, 'src', 'teacherReport.mjs')
const 测试 = path.join(APP, 'tests', 'teacherReport.test.mjs')

const 跑 = () => {
  try { return { code: 0, out: execFileSync(process.execPath, [测试], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } }
  catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') } }   // 失败写 stderr ⇒ 必须并收
}

let 全过 = true
const 例 = (label, 旧, 新, 片段) => {
  const 备份 = readFileSync(TR, 'utf8')
  try {
    if (!备份.includes(旧)) { console.log(`     ❌ 找不到靶子：${label}\n        （期望片段：${旧.slice(0, 70)}）`); 全过 = false; return }
    writeFileSync(TR, 备份.replace(旧, 新))
    const r = 跑()
    const 掉红 = r.code !== 0 && r.out.includes(片段)
    writeFileSync(TR, 备份)
    const 还原 = 跑()
    const 复绿 = 还原.code === 0
    if (!(掉红 && 复绿)) 全过 = false
    console.log(`     ${掉红 && 复绿 ? '✓' : '✗'} ${label}：改后 exit=${r.code}（红=${掉红}）· 还原后 exit=${还原.code}（绿=${复绿}）`)
  } finally {
    writeFileSync(TR, 备份)   // 无论中间怎么炸，必还原（防把错值留在工作区）
  }
}

console.log('【RV §32-U2】把报告数字改成硬编码错值 / 第二本账 ⇒ 必红（红→绿可逆）\n')

例('RV-1 硬编码错值：累计营收 → 999999999',
  '累计营收,\n    累计净利_资金口径', '累计营收: 999999999,\n    累计净利_资金口径',
  '累计营收 === metricDefs.totalRevenue')

例('RV-2 第二本账：逐周营收自己乘一遍（×1.01）',
  '营收: Number.isFinite(h && h.revenue) ? h.revenue : null,',
  '营收: Number.isFinite(h && h.revenue) ? Math.round(h.revenue * 1.01) : null,',
  '营收/成本/净流')

例('RV-3 极值方向：最好周改成取 min（最好==最差）',
  "最好周_经营: 极值周(行s, '经营净流', 'max'),",
  "最好周_经营: 极值周(行s, '经营净流', 'min'),",
  '方向正确：最好 ≥ 最差')

例('RV-4 口径混装：经营净利率偷用资金口径',
  "净利率_经营口径: 累计净利率(history, '经营'),",
  "净利率_经营口径: 累计净利率(history, '资金'),",
  '两条净利率 === metricDefs.累计净利率')

console.log(`\n判定：${全过 ? '✓ RV 全过（4 条靶子）' : '❌ 有靶子未按预期变红/还原'}`)
process.exit(全过 ? 0 : 1)
