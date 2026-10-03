// §32-U8-补 的**可执行**反向验证（RV）：把"界面接线"逐个摘掉 ⇒ 守门必红 ⇒ 还原 ⇒ 绿
//   RV-1 主菜：删掉老师端弹窗的「代价行」⇒ u8supplement[1] 必红（这是本包主菜，必须能被抓）
//   RV-2 同源：把 代价文案() 换成手写字符串 ⇒「无『代价：』字面量」断言必红（第二来源 = 漂移风险）
//   RV-3 入口：删掉教师端注入面板渲染 ⇒ u8supplement[2] 必红（界面不存在 = "引擎就绪"不算交付）
//   RV-4 (附) 加严：篡改长跑报告属性列【品质位】⇒ reportCaliber 必红（D96 尾巴 §5 的加严真咬）
// 用法：node tests/_rv-32u8补.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TD = path.join(APP, 'src', 'TeacherDashboard.jsx')
const 长跑报告 = path.join(APP, '..', '4-审计与报告', '18周（126天）长跑报告.md')
const 补测 = path.join(APP, 'tests', 'u8supplement.test.mjs')
const 口径测 = path.join(APP, 'tests', 'reportCaliber.test.mjs')
const 跑 = (测试) => {
  try { return { code: 0, out: execFileSync(process.execPath, [测试], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } }
  catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') } }
}
let 全过 = true
const 例 = (label, 文件, 旧, 新, 片段, 测试 = 补测) => {
  // ★ §33-V4 教训（CI 首跑抓到）：Windows 工作区该文件是 CRLF，靶子文本是 LF ⇒ includes 永远 false（"找不到靶子"）。
  //   修：读入先归一化 CRLF→LF 再匹配/替换；写回统一 LF（git autocrlf 签出时按配置转换，不影响判据）。
  const 备份 = readFileSync(文件, 'utf8').replace(/\r\n/g, '\n')
  try {
    if (!备份.includes(旧)) { console.log(`     ❌ 找不到靶子：${label}\n        （期望片段：${旧.slice(0, 90)}）`); 全过 = false; return }
    writeFileSync(文件, 备份.replace(旧, 新))
    const r = 跑(测试)
    const 掉红 = r.code !== 0 && r.out.includes(片段)
    writeFileSync(文件, 备份)
    const 还原 = 跑(测试)
    const 复绿 = 还原.code === 0
    if (!(掉红 && 复绿)) 全过 = false
    console.log(`     ${掉红 && 复绿 ? '✓' : '✗'} ${label}：改后 exit=${r.code}（红=${掉红}）· 还原后 exit=${还原.code}（绿=${复绿}）`)
  } finally { writeFileSync(文件, 备份) }
}
console.log('【RV §32-U8-补】界面接线摘掉 ⇒ 必红（红→绿可逆）\n')
// RV-1：主菜（弹窗代价行）—— 删掉渲染块的两行（代价文案 调用 + 显示）
例('RV-1 主菜：删掉弹窗「代价行」渲染',
  TD,
  `            {chipDetail.decisionId && 代价文案(chipDetail.decisionId, chipDetail.rawAnswer) && (
              <div style={{ fontSize: 12, color: '#991B1B', background: '#FEF2F2', borderRadius: 8, padding: '6px 10px', marginTop: 6, lineHeight: 1.6 }}>
                {代价文案(chipDetail.decisionId, chipDetail.rawAnswer)}
              </div>
            )}`,
  `            {/* RV：代价行被摘除 */}`,
  '弹窗渲染调 代价文案')
// RV-2：同源 —— 用"手写字符串"替换单源调用（含字面量「代价：」）
例('RV-2 同源：把 代价文案() 换成手写字符串',
  TD,
  '代价文案(chipDetail.decisionId, chipDetail.rawAnswer)',
  "'代价：课堂讨论：你选这个的代价是什么？'",
  '无「代价：」字面量')
// RV-3：教师端注入入口（面板渲染整块摘除）
例('RV-3 注入入口：删掉教师端注入面板渲染',
  TD,
  `      {/* ★ §32-U8-补 §2①：老师事件注入面板 */}
      {view === 'inject' && <InjectionPanel rawStates={rawStates} profiles={profiles} user={user} />}`,
  `      {/* RV：注入面板被摘除 */}`,
  '注入面板 import 单源（含 V8 自定义/效力/按日）')
// RV-4：附 —— reportCaliber 属性列【品质位】加严（篡改文档 ⇒ 必红）
{
  const 备份 = readFileSync(长跑报告, 'utf8')
  try {
    // 靶子：把「1勤奋型」行的三元组首格 60 改成 61（品质位 —— 加严前改这里不红）
    if (!/50% \| 60 \/ 97 \/ 95/.test(备份)) { console.log('     ❌ 找不到靶子：RV-4 长跑报告 §二 1勤奋型 属性三元组'); 全过 = false }
    else {
      writeFileSync(长跑报告, 备份.replace('50% | 60 / 97 / 95', '50% | 61 / 97 / 95'))
      const r = 跑(口径测)
      const 掉红 = r.code !== 0 && r.out.includes('品质位')
      writeFileSync(长跑报告, 备份)
      const 还原 = 跑(口径测)
      const 复绿 = 还原.code === 0
      if (!(掉红 && 复绿)) 全过 = false
      console.log(`     ${掉红 && 复绿 ? '✓' : '✗'} RV-4 加严：篡改属性【品质位】⇒ reportCaliber 必红：改后 exit=${r.code}（红=${掉红}）· 还原后 exit=${还原.code}（绿=${复绿}）`)
    }
  } finally { writeFileSync(长跑报告, 备份) }
}
console.log(`\n判定：${全过 ? '✓ RV 全过（4 条靶子：主菜/同源/入口/加严）' : '❌ 有靶子未按预期变红/还原'}`)
process.exit(全过 ? 0 : 1)
