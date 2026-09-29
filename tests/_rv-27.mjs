// §27.3 / §28.1 的反向验证（RV）：消费点守门 + 估算标注，**改回去必须红**
//
//   RV-1  摘掉 emergency→危机机制的映射（选项回到"零消费"）   ⇒ consumptionCoverage[1] 必红
//   RV-2  把「明日预抵（估算）」的"估算"字样去掉（退回裸数字）  ⇒ livePanel[7] 必红
//   RV-3  把 选址.房价 从登记表里删掉（假装它已接线）          ⇒ consumptionCoverage[2] 必红（未登记且零消费）
//   RV-5  §28.1-③：把「波动」塞进登记表（假阳性当年的原话）    ⇒ 必红（原 RV-4 用「客流」作靶子是**选错的** ——
//         客流有事件通道兜着，删掉消费后仍"可见"⇒ 侥幸过关；波动无事件通道 ⇒ 立刻暴露。靶子必须选最弱路径）
//   RV-6  §28.1-② RV-c：判据退回单配置版（加固前形态）         ⇒ 阳性对照自校准/结论必红
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

// ── §28.1-③（D76）：RV 靶子**改对** —— 原靶子「客流」靠事件通道侥幸过关 ⇒ 靶子选错；
//   「波动」无事件通道 ⇒ 塞进登记表立刻暴露（这正是守门假阳性当年骗过所有人的那个维）。
例('RV-5（§28.1-③）把「波动」塞进登记表（假装它未接线 —— 假阳性当年的原话）',
  CC,
  "  { 项: '选址.人力', 原因: '选址六维里\"人力\"未进入人力成本路径（部门成本按标准比例）', 归属: '待决策端拍板：接线（= 重基线）或永久移除该维 · §27.3-②b' },",
  "  { 项: '选址.人力', 原因: '选址六维里\"人力\"未进入人力成本路径（部门成本按标准比例）', 归属: '待决策端拍板：接线（= 重基线）或永久移除该维 · §27.3-②b' },\n  { 项: '选址.波动', 原因: '守门假阳性当年的原话：未进入任何路径（实为已接线 · settlement.js:319-320）', 归属: '本 RV 用 · 测完即还原' },",
  判(跑CC, '登记表不腐烂'))

// ★ §28.1-② RV-c：把判据**退回单配置版**（守门加固前 = 假阳性的来源）⇒ 阳性对照自校准必红
//   实现：把「有消费」改成只用配置B（饱和路径 · 六维全3 · week1 —— 波动/租金被 0.98 上限吃掉的坏配置）。
//   ★ 若**租金**在该配置下仍可见 ⇒ 阳性对照不红（那说明靶子选得还不对，需要再挑配置）——以实跑为准。
例('RV-6（§28.1-② RV-c）判据退回"单配置版"（加固前形态）⇒ 阳性对照/结论必红',
  CC,
  '  const 有消费 = (k) => 扰动(k, 配置A, 5, 低属性) || 扰动(k, 配置B, 1, 属性)',
  '  const 有消费 = (k) => 扰动(k, 配置B, 1, 属性)',
  判(跑CC, '阳性对照'))

console.log(`\n判定：${全过 ? '✓ §27.3/§28.1 RV 全过（6 条靶子 · 红→绿可逆）' : '❌ 有靶子未按预期变红/还原'}`)
process.exit(全过 ? 0 : 1)
