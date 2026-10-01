// §32-U8 的**可执行**反向验证（RV）：三红线拆一条 ⇒ 必红 ⇒ 还原 ⇒ 绿
//   RV-1 去「只影响未来」：校验函数改成恒合法 ⇒ thirdPhase[1] 必红
//   RV-2 去离线默认最差：标注函数改成"按正常计入" ⇒ thirdPhase[2] 的标注断言必红
//   RV-3 去授权仍代管：生效授权恒全开 ⇒ thirdPhase[3] 必红
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TE = path.join(APP, 'src', 'teacherEvents.mjs')
const AI = path.join(APP, 'src', 'aiSupervisor.mjs')
const 测试 = path.join(APP, 'tests', 'thirdPhase.test.mjs')
const 跑 = () => {
  try { return { code: 0, out: execFileSync(process.execPath, [测试], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } }
  catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') } }
}
let 全过 = true
const 例 = (label, 文件, 旧, 新, 片段) => {
  const 备份 = readFileSync(文件, 'utf8')
  try {
    if (!备份.includes(旧)) { console.log(`     ❌ 找不到靶子：${label}\n        （期望片段：${旧.slice(0, 60)}）`); 全过 = false; return }
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
console.log('【RV §32-U8】公平红线拆一条 ⇒ 必红（红→绿可逆）\n')
例('RV-1 去「只影响未来」（校验恒合法）',
  TE, '  if (Number.isFinite(done) && n <= done) return { 合法: false, 原因: `不能改已结算周（第 ${done} 周已结算，注入周必须 > ${done}）` }',
  '  if (false) return { 合法: false }',
  '★ 注入已结算周 ⇒ 非法（公平红线 a）')
例('RV-2 去离线默认最差（标注改"按正常计入"）',
  TE, "  return `第 ${周} 周 ${事件name}（你离线未应对，按最差结果计入）`",
  "  return `第 ${周} 周 ${事件name}（离线，按正常计入）`",
  '离线默认标注文案')
例('RV-3 去授权仍代管（生效授权恒全开）',
  AI, 'export function 生效授权({ 全班默认 = 默认授权, 学生覆盖 = null } = {}) {\n  return { ...默认授权, ...(全班默认 || {}), ...(学生覆盖 || {}) }\n}',
  'export function 生效授权({ 全班默认 = 默认授权, 学生覆盖 = null } = {}) {\n  return { price_adj: { ok: true }, overbook: { ok: true }, energy: { ok: true } }   // RV：恒全开\n}',
  '★ 默认不代管 ⇒ 动作数 0')
console.log(`\n判定：${全过 ? '✓ RV 全过（3 条靶子）' : '❌ 有靶子未按预期变红/还原'}`)
process.exit(全过 ? 0 : 1)
