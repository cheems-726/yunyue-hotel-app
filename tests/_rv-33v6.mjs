// §33-V6 的**可执行**反向验证（RV）：客群结构加权"占比真的在算"
//   RV-1 退回旧行为：把三路加权改成"只看 dominant"（等价于改前）⇒ consumptionCoverage/专测必红
//   RV-2 占比置 0：把某客群占比改成 0 ⇒ 该客群反馈不再出现（专测断言必红）
//   RV-3 占比均等：三路占比全相等 ⇒ 加权分 === 三路均值（一致性断言必红）
// 用法：node tests/_rv-33v6.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ST = path.join(APP, 'src', 'settlement.js')
// 专测 = V6 守门（内嵌在 settlement.test.mjs [客群结构] 段）
// 守门在 personaWeight.test.mjs（V6 专守门）
const 跑 = (测试文件 = 测试) => {
  try { return { code: 0, out: execFileSync(process.execPath, [测试文件], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } }
  catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') } }
}
let 全过 = true
const 例 = (label, 文件, 旧, 新, 片段, 测试文件) => {
  // 旧/新 支持数组（多处替换 · 同批生效同批还原）
  const 旧s = Array.isArray(旧) ? 旧 : [旧]
  const 新s = Array.isArray(新) ? 新 : [新]
  const 原始 = readFileSync(文件, 'utf8')
  const 是CRLF = 原始.includes('\r\n')
  const 备份 = 是CRLF ? 原始.replace(/\r\n/g, '\n') : 原始   // ★ CRLF 归一化（V4 教训）
  try {
    if (!旧s.every(x => 备份.includes(x))) { console.log(`     ❌ 找不到靶子：${label}（期望片段：${旧s[0].slice(0, 80)}）`); 全过 = false; return }
    let 改 = 备份
    for (let i = 0; i < 旧s.length; i++) 改 = 改.replace(旧s[i], 新s[i])
    writeFileSync(文件, (是CRLF ? 改.replace(/\n/g, '\r\n') : 改))
    const r = 跑(测试文件)
    if (process.env.RV_DEBUG) console.log('     [debug] 改后输出尾部：', r.out.slice(-400))
    const 掉红 = r.code !== 0 && r.out.includes(片段)
    writeFileSync(文件, 原始)
    const 还原 = 跑(测试文件)
    const 复绿 = 还原.code === 0
    if (!(掉红 && 复绿)) 全过 = false
    console.log(`     ${掉红 && 复绿 ? '✓' : '✗'} ${label}：改后 exit=${r.code}（红=${掉红}）· 还原后 exit=${还原.code}（绿=${复绿}）`)
  } finally { writeFileSync(文件, 原始) }
}
console.log('【RV §33-V6】客群结构加权 —— 占比真的在算（红→绿可逆）\n')
// RV-1 退回"只看 dominant"：三路 if 改 dominant 门 + 分不打权（×1.0）—— 逐字等价改前 ⇒ 「占比真的在算」必红
例('RV-1 退回旧行为：三路加权 → dominant 门 + 不打权',
  ST,
  ['  if (权.business > 0) {', '  if (权.tourist > 0) {', '  if (权.family > 0) {',
   '    personaBonus += 路 * 权.business', '    personaBonus += 路 * 权.tourist', '    personaBonus += 路 * 权.family'],
  ["  if (persona.dominant === 'business') {", "  if (persona.dominant === 'tourist') {", "  if (persona.dominant === 'family') {",
   '    personaBonus += 路', '    personaBonus += 路', '    personaBonus += 路'],
  '占比真的在算：同 dominant（商务主力）不同占比 ⇒ 加权分不同',
  path.join(APP, 'tests', 'personaWeight.test.mjs'))
// RV-2 占比置 0：把占比 0% 的路强制照跑（文案出现）⇒ 「零权重路不出现」断言必红
例('RV-2 占比置 0 仍出反馈：删掉零权重跳过',
  ST,
  '  if (权.tourist > 0) {',
  '  if (true) {   // RV：零权重路也跑（占0%也出文案）',
  '零权重路不出现（100/0/0 ⇒ 只有商务客反馈）',
  path.join(APP, 'tests', 'personaWeight.test.mjs'))
// RV-3 占比均等 ⇒ 一致性：把归一化改成"恒等 dominant 权重 1" ⇒ 均衡占比一致性断言必红
例('RV-3 归一化破坏：占比和恒 1（不等权）',
  ST,
  '  const 占比和 = 有客群表\n    ? Math.max(0.0001, (Number(persona.business) || 0) + (Number(persona.tourist) || 0) + (Number(persona.family) || 0))\n    : 0',
  '  const 占比和 = 1   // RV：归一化被破坏（占比不再归一）',
  '归一化：34/33/33 与 100/100/100 同分（各 1/3：',
  path.join(APP, 'tests', 'personaWeight.test.mjs'))
console.log(`\n判定：${全过 ? '✓ RV 全过（3 条靶子：退回旧行为/占比置0/归一化破坏）' : '❌ 有靶子未按预期变红/还原'}`)
process.exit(全过 ? 0 : 1)
