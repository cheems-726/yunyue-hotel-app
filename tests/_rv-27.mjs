// §27.3 的反向验证（RV）：消费点守门 + 估算标注，**改回去必须红**
//
//   RV-1  摘掉 emergency→危机机制的映射（选项回到"零消费"）   ⇒ consumptionCoverage[1] 必红
//   RV-2  把「明日预抵（估算）」的"估算"字样去掉（退回裸数字）  ⇒ livePanel 必红
//   RV-3  把 选址.房价 从登记表里删掉（假装它已接线）          ⇒ consumptionCoverage[2] 必红（未登记且零消费）
//   RV-4  把某个真在用的维（客流）也加进登记表                ⇒ consumptionCoverage「登记表不腐烂」必红
//
// 用法：node tests/_rv-27.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WEEKINPUTS = path.join(APP, 'src', 'weekInputs.mjs')
const HS = path.join(APP, 'src', 'HotelStatus.jsx')
const CC = path.join(APP, 'tests', 'consumptionCoverage.test.mjs')

const 跑 = (脚本) => {
  try { return { code: 0, out: execFileSync(process.execPath, [脚本], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } }
  catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || ''), err: e.message } }
}
const 跑CC = () => 跑(CC)
const 跑LP = () => 跑(path.join(APP, 'tests', 'livePanel.test.mjs'))
const 判 = (fn, 片段) => Object.assign(fn, { 红: r => r.code !== 0 && (!片段 || r.out.includes(片段)) })

let 全过 = true
const 例 = (label, 文件, 旧, 新, 判据) => {
  const 备份 = readFileSync(文件, 'utf8')
  if (!备份.includes(旧)) { console.log(`     ❌ 找不到靶子：${label}\n        （期望片段：${旧.slice(0, 70)}）`); 全过 = false; return }
  writeFileSync(文件, 备份.replace(旧, 新))
  const r = 判据()
  writeFileSync(文件, 备份)
  const 掉红 = 判据.红(r)
  const 还原 = 判据()
  const 复绿 = 还原.code === 0
  if (!(掉红 && 复绿)) 全过 = false
  console.log(`     ${掉红 && 复绿 ? '✓' : '✗'} ${label}：改后 exit=${r.code}（红=${掉红}）· 还原后 exit=${还原.code}（绿=${复绿}）`)
}

console.log('【RV §27.3】选项落实（消费点守门 + 估算标注）—— 改回"装饰品"必须红\n')

例('RV-1 摘掉 emergency→危机机制的映射（回到零消费 · D74 原状）',
  WEEKINPUTS,
  '  const 处置 = 突发处置映射[decisions && decisions.emergency] || null\n  const crisisResponse = 危机卡选 || 处置',
  '  const crisisResponse = 危机卡选',
  判(跑CC, '每个决策项都至少有一个消费点'))

例('RV-2 「明日预抵（估算）」去掉"估算"字样（退回像真数据的裸数字 · D74 原状）',
  HS,
  "{ l: '明日预抵（估算）', v: Math.max(0, Math.round(occRooms * 0.3 + (seed % 6))) + ' 间', c: '#6B7280', sub: '按在店×30%＋波动推算 · 非引擎值' }",
  "{ l: '明日预抵', v: Math.max(0, Math.round(occRooms * 0.3 + (seed % 6))) + ' 间', c: '#6B7280' }",
  判(跑LP, '明日预抵'))

例('RV-3 从登记表里删掉 选址.房价（假装它已接线）',
  CC,
  "  { 项: '选址.房价', 原因: '选址六维里\"房价\"未进入定价/营收路径（引擎按品牌与决策定价）', 归属: '待决策端拍板：接线（= 重基线）或永久移除该维 · §27.3-②b' },\n",
  '',
  判(跑CC, '每个选址维都至少有一个消费点'))

例('RV-4 把真在用的维（客流）也塞进登记表（制造腐败条目）',
  CC,
  "  { 项: '选址.波动', 原因: '选址六维里\"波动\"未进入任何路径（引擎的随机性由 seed 决定，不读该维）', 归属: '待决策端拍板：接线（= 重基线）或永久移除该维 · §27.3-②b' },",
  "  { 项: '选址.波动', 原因: '选址六维里\"波动\"未进入任何路径（引擎的随机性由 seed 决定，不读该维）', 归属: '待决策端拍板：接线（= 重基线）或永久移除该维 · §27.3-②b' },\n  { 项: '选址.客流', 原因: '故意塞进来的腐败条目（客流其实有大量消费点）', 归属: '本 RV 用 · 测完即还原' },",
  判(跑CC, '登记表不腐烂'))

console.log(`\n判定：${全过 ? '✓ §27.3 RV 全过（4 条靶子 · 红→绿可逆）' : '❌ 有靶子未按预期变红/还原'}`)
process.exit(全过 ? 0 : 1)
