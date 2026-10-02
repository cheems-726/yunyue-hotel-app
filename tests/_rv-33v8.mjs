// §33-V8 的**可执行**反向验证（RV）：自定义/按日事件的四条防线
//   RV-1 只影响未来：去掉按日校验的"生效日已过去"拦截 ⇒ 必红
//   RV-2 补算通道：摘掉 serverTick 的 injectedEvents 透传 ⇒ V8 全通道断言必红
//   RV-3 日粒度：把生效日分段逻辑摘掉（事件恒整周生效）⇒「按日 ≠ 整周」必红
//   RV-4 纯叙事零变化：给纯叙事事件强塞一个客流效力 ⇒「数字逐字节不变」必红
// 用法：node tests/_rv-33v8.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TE = path.join(APP, 'src', 'teacherEvents.mjs')
const TICK = path.join(APP, 'src', 'serverTick.mjs')
const SEG = path.join(APP, 'src', 'weekSegments.mjs')
const 全通道 = path.join(APP, 'tests', 'weeklyAuto.test.mjs')
const 跑 = (测试) => {
  try { return { code: 0, out: execFileSync(process.execPath, [测试], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } }
  catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') } }
}
let 全过 = true
const 例 = (label, 文件, 旧, 新, 片段, 测试) => {
  const 旧s = Array.isArray(旧) ? 旧 : [旧]
  const 新s = Array.isArray(新) ? 新 : [新]
  const 备份 = readFileSync(文件, 'utf8').replace(/\r\n/g, '\n')
  try {
    if (!旧s.every(x => 备份.includes(x))) { console.log(`     ❌ 找不到靶子：${label}（期望片段：${旧s[0].slice(0, 80)}）`); 全过 = false; return }
    let 改 = 备份
    for (let i = 0; i < 旧s.length; i++) 改 = 改.replace(旧s[i], 新s[i])
    writeFileSync(文件, 改)
    const r = 跑(测试)
    if (process.env.RV_DEBUG) console.log('     [debug] 改后尾部：', r.out.slice(-300))
    const 掉红 = r.code !== 0 && r.out.includes(片段)
    writeFileSync(文件, 备份)
    const 还原 = 跑(测试)
    const 复绿 = 还原.code === 0
    if (!(掉红 && 复绿)) 全过 = false
    console.log(`     ${掉红 && 复绿 ? '✓' : '✗'} ${label}：改后 exit=${r.code}（红=${掉红}）· 还原后 exit=${还原.code}（绿=${复绿}）`)
  } finally { writeFileSync(文件, 备份) }
}
console.log('【RV §33-V8】自定义/按日事件四防线（红→绿可逆）\n')
// RV-1 只影响未来：校验按日触发的"已过去"分支改成恒合法 ⇒ weeklyAuto 的按日断言场景失效…
//   ⚠ 校验在面板时拦截（注入前），引擎侧 weekSegments 只对生效日分段 —— 已过去的生效日在补算路径无法区分。
//   守门侧：u8supplement 钉了「校验按日触发(」存在；这里直接改 校验按日触发 让已过去的天返回合法 ⇒ 单源断言必红。
例('RV-1 只影响未来校验被拆（已过去的天 ⇒ 恒合法）',
  TE,
  "  if (Number(注入周) === Number(当前教学周) && Number.isFinite(d) && d > 1 && Number.isFinite(Number(当前dayIndex)) && d <= Number(当前dayIndex)) {\n    return { 合法: false, 原因: `生效日（第 ${d} 天）已过去（当前第 ${当前dayIndex} 天）—— 只影响未来` }\n  }",
  "  // RV：只影响未来校验被拆\n  void d; void 当前dayIndex; void 当前教学周",
  '★ V8 按日校验：生效日（第2天）已过去（当前第4天）⇒ 非法（只影响未来 · 天粒度）',
  path.join(APP, 'tests', 'u8supplement.test.mjs'))
// RV-2 补算通道被摘
例('RV-2 serverTick 事件透传被摘',
  TICK,
  '    injectedEvents: Array.isArray(opts.injectedEvents) ? opts.injectedEvents : null,',
  '    injectedEvents: null,   // RV：事件透传被摘',
  'V8 全通道：按日自定义事件（生效日=4）+ 离线补算 === 一直在线【逐字节】',
  全通道)
// RV-3 日粒度被摘（生效日分段逻辑删掉 ⇒ 事件恒整周）
例('RV-3 日粒度被摘（生效日分段逻辑删掉）',
  SEG,
  "  if (事件日s.length > 0) {",
  "  if (false) {   // RV：日粒度被摘（事件恒整周生效）",
  '★ V8 按日 ≠ 整周：生效日=4（后 4 天带 0.95）≠ 整周 0.95（日粒度在算 · revenue ',
  全通道)
// RV-4 纯叙事被赋效力（面板白名单失效 ⇒ 造出非零效力）
例('RV-4 纯叙事被赋非零效力（效力白名单失效）',
  TE,
  "export function 效力选择转引擎(选择 = []) {\n  const engine = { v8: true }",
  "export function 效力选择转引擎(选择 = []) {\n  const engine = { v8: true, 客流系数: 1.25 }   // RV：白名单失效（纯叙事也被塞效力）",
  '★ V8 纯叙事：0 效力选择 ⇒ engine 无任何数值维度（数字逐字节不变）',
  path.join(APP, 'tests', 'u8supplement.test.mjs'))
console.log(`\n判定：${全过 ? '✓ RV 全过（4 条靶子：只影响未来/补算通道/日粒度/纯叙事零变化）' : '❌ 有靶子未按预期变红/还原'}`)
process.exit(全过 ? 0 : 1)
