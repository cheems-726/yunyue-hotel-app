// §33-V3 的**可执行**反向验证（RV）：AI 领班二期 —— 代管动作真生效的四条防线
//   RV-1 学生优先：把代管并入改成"领班覆盖学生"⇒「学生决策优先」守门必红
//   RV-2 未授权仍代管：把 未授权早退 删掉 ⇒ 必红
//   RV-3 代管留痕：把 operatorLog 的领班留痕块删掉 ⇒ 必红
//   RV-4 serverTick 领班入参：摘掉 serverTick 的 supervisorAuth 通道 ⇒ weeklyAuto 全通道断言必红
// 用法：node tests/_rv-33v3.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const AI = path.join(APP, 'src', 'aiSupervisor.mjs')
const APPJSX = path.join(APP, 'src', 'App.jsx')
const TICK = path.join(APP, 'src', 'serverTick.mjs')
const 守门 = path.join(APP, 'tests', 'personaWeight.test.mjs')
const 全通道 = path.join(APP, 'tests', 'weeklyAuto.test.mjs')
const 跑 = (测试) => {
  try { return { code: 0, out: execFileSync(process.execPath, [测试], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } }
  catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') } }
}
let 全过 = true
const 例 = (label, 文件, 旧, 新, 片段, 测试) => {
  // 旧/新 支持数组（多处替换 · 同批生效同批还原 —— V6 教训：单处替换构不成"等价退回"）
  const 旧s = Array.isArray(旧) ? 旧 : [旧]
  const 新s = Array.isArray(新) ? 新 : [新]
  const 备份 = readFileSync(文件, 'utf8').replace(/\r\n/g, '\n')   // ★ CRLF 归一化（V4 教训）
  try {
    if (!旧s.every(x => 备份.includes(x))) { console.log(`     ❌ 找不到靶子：${label}（期望片段：${旧s[0].slice(0, 80)}）`); 全过 = false; return }
    let 改 = 备份
    for (let i = 0; i < 旧s.length; i++) 改 = 改.replace(旧s[i], 新s[i])
    writeFileSync(文件, 改)
    const r = 跑(测试)
    if (process.env.RV_DEBUG) console.log('     [debug]', r.out.slice(-260))
    const 掉红 = r.code !== 0 && r.out.includes(片段)
    writeFileSync(文件, 备份)
    const 还原 = 跑(测试)
    const 复绿 = 还原.code === 0
    if (!(掉红 && 复绿)) 全过 = false
    console.log(`     ${掉红 && 复绿 ? '✓' : '✗'} ${label}：改后 exit=${r.code}（红=${掉红}）· 还原后 exit=${还原.code}（绿=${复绿}）`)
  } finally { writeFileSync(文件, 备份) }
}
console.log('【RV §33-V3】领班二期四防线（红→绿可逆）\n')
// RV-1 学生优先：领班代管() 里"只填学生没做的"改成"无条件填"（领班覆盖学生）⇒ 守门「占比/学生优先」必红
例('RV-1 学生优先被推翻（领班覆盖学生）',
  AI,
  "      if (落点 && (学生决策 || {})[落点] === undefined) 代管决策[落点] = a.to   // ★ 学生决策优先",
  "      代管决策[a.item === 'overbook' ? 'overbook' : a.item === 'energy' ? 'energy' : a.item] = a.to   // RV：领班覆盖学生",
  '学生决策优先',
  守门)
// RV-2 未授权仍代管：把"未授权早退"改成"未授权 ⇒ 强制全开"（模拟越权代管）⇒ 未授权水位线断言必红
例('RV-2 未授权仍代管（未授权 ⇒ 强制全开 = 越权）',
  AI,
  "    if (!全班默认 && !学生覆盖) return 空结果                       // 未授权 ⇒ 一步不动（默认全关 = 公平）",
  "    if (!全班默认 && !学生覆盖) { 全班默认 = { overbook: { ok: true }, energy: { ok: true }, price_adj: { ok: true } } }   // RV：越权（未授权却全开）",
  '★ V3 未授权水位线：默认全关 ⇒ 代管决策为空（一步不动 · 公平红线）',
  守门)
// RV-3 代管留痕：删掉 operatorLog 留痕的「依据规则」字段 ⇒ u8supplement「留痕带依据规则 id」必红
例('RV-3 代管留痕被摘（删两处「依据规则」字段）',
  APPJSX,
  ["          if (条) 新日志.push({ ...条, 依据规则: 依据 ? 依据.ruleId : 规则, 领班reason: 依据 ? 依据.reason : '', 生效周: week })",
   "          if (条) 新日志.push({ ...条, 依据规则: r.ruleId, 领班reason: r.reason })"],
  ["          if (条) 新日志.push({ ...条 })   // RV：依据规则被摘（留痕退化为流水）",
   "          if (条) 新日志.push({ ...条 })   // RV：依据规则被摘"],
  '留痕带【依据规则 id】（谁/何时/什么/依据）',
  path.join(APP, 'tests', 'u8supplement.test.mjs'))
// RV-4 serverTick 领班入参被摘 ⇒ weeklyAuto 全通道断言必红
例('RV-4 serverTick 领班入参被摘',
  TICK,
  '  let 生效决策 = decisions',
  '  const 生效决策 = decisions   // RV：领班代管被摘（恒等于学生决策）',
  '★★ V3 全通道：授权领班（R3+R6）+ 离线补算 === 一直在线【逐字节】',
  全通道)
console.log(`\n判定：${全过 ? '✓ RV 全过（4 条靶子：学生优先/未授权/留痕/serverTick 通道）' : '❌ 有靶子未按预期变红/还原'}`)
process.exit(全过 ? 0 : 1)
