// §32-U3 的**可执行**反向验证（RV）：世界层三件的"接线 / 表值"改回"没有影响" ⇒ 跑 ⇒ 必红 ⇒ 还原 ⇒ 绿
//
//   RV-1 天气系数全设 1.0（单元卡 §2 明文要求的形态）⇒ worldLayer[1] 表值断言必红
//   RV-2 季节因子全设 1.0（单元卡 §3）                ⇒ worldLayer[1] 表值断言必红
//   RV-3 删 settle 需求链里的 `* 天气系数`（接线被切）⇒ worldLayer[3] 比值恒等式必红
//   RV-4 渠道流量系数改"评分不影响流量"（恒 1）        ⇒ worldLayer[2] 必红
//
// 说明：四条都打真文件（天气表 / 季节表 / settlement 接线 / otaRating 系数）——
//       能改绿就说明守门只覆盖了"声明"而没覆盖"算式"。
// 用法：node tests/_rv-32u3.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const W = path.join(APP, 'src', 'weather.mjs')
const S = path.join(APP, 'src', 'season.mjs')
const ST = path.join(APP, 'src', 'settlement.js')
const O = path.join(APP, 'src', 'otaRating.mjs')
const 测试 = path.join(APP, 'tests', 'worldLayer.test.mjs')

const 跑 = () => {
  try { return { code: 0, out: execFileSync(process.execPath, [测试], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } }
  catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') } }   // 失败写 stderr ⇒ 必须并收
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
  } finally {
    writeFileSync(文件, 备份)   // 无论中间怎么炸，必还原（防把世界层改坏留在工作区）
  }
}

console.log('【RV §32-U3】世界层"改成没影响" ⇒ 必红（红→绿可逆）\n')

例('RV-1 天气表改全 1（阴/雨/暴雨 客流 → 1）—— 单元卡 §2 要求的那条',
  W, "  { 名: '阴', 图标: '☁️', 客流: 0.96", "  { 名: '阴', 图标: '☁️', 客流: 1.00",
  '第 2 周 阴 ×0.96')
例('RV-2 季节表改全 1（w7 淡季 0.88 → 1.00）',
  S, "{ 周: 7, 名: '淡季', 因子: 0.88", "{ 周: 7, 名: '淡季', 因子: 1.00",
  'w1 平季 1.00 · w4 旺季 1.12 · w7 淡季 0.88')
例('RV-3 切断天气接线（settlement 里删 * 天气系数）',
  ST, '* 天气系数 * 季节系数', '* 季节系数',
  '天气因子精确生效')
例('RV-4 渠道系数改成"评分不影响流量"（恒 1）',
  O, "  if (bizMode !== 'ota') return 1", "  if (bizMode !== 'ota') return 1\n  if (true) return 1",
  'OTA 模式：高评分加分、低评分减分')

console.log(`\n判定：${全过 ? '✓ RV 全过（4 条靶子）' : '❌ 有靶子未按预期变红/还原'}`)
process.exit(全过 ? 0 : 1)
