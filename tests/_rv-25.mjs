// §25 的反向验证（RV）：把决策端实核抓到的两个洞**逐条校准**——不只"能红"，还要证明"该红的地方真的红"
//
//   RV-1  改《数值平衡与口径总览》§四 **第二列** 任一格        ⇒ reportCaliber 必红
//   RV-2  改 §四 **第三列**（已作废 v4 列）任一格              ⇒ **必须红**（§25 之前它不红 = 病根）
//   RV-3  把 `取表()` 改回"只取第一个数字"（模拟退化）        ⇒ **防退化自检必红**（校准工具本身）
//   RV-4  改《长跑报告》§二 **差额列**一格（制造表内自相矛盾）  ⇒ 必红
//   RV-5  改《过审包》收尾指纹的 HEAD 成不存在的哈希            ⇒ docs-sync 必红
//   RV-6  改《过审包》收尾指纹的 未推 数（错值）                ⇒ docs-sync 必红
//   RV-7  只改**一处**收尾文件（四处不一致）                    ⇒ docs-sync 必红
//
// 用法：node tests/_rv-25.mjs      （每条：改 → 跑 → 还原 → 再跑，逐次可逆）
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(APP, '..')
const DIR = path.join(ROOT, '4-审计与报告')
const 总览 = path.join(DIR, '数值平衡与口径总览-20260929.md')
const 长跑 = path.join(DIR, '18周（126天）长跑报告.md')
const 过审包 = path.join(DIR, '全日过审包-20260929.md')
const 交接卡 = path.join(DIR, '会话交接卡.md')
const 闸门 = path.join(ROOT, '9-夜间自动化', '夜间开工闸门.txt')
const 队列 = path.join(ROOT, '9-夜间自动化', 'night-run-log.md')
const CAL = path.join(APP, 'tests', 'reportCaliber.test.mjs')

const 跑 = (文件) => {
  try {
    const out = execFileSync(process.execPath, [文件], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, out }
  } catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') } }
}
const 跑CAL = () => 跑(path.join(APP, 'tests', 'reportCaliber.test.mjs'))
const 跑DS = () => 跑(path.join(APP, 'tests', 'docs-sync.mjs'))
const 红CAL = (r, 片段) => r.code !== 0 && r.out.includes('FAIL') && (!片段 || r.out.includes(片段))
const 红DS = (r) => r.code !== 0 && /✗.*收尾指纹/.test(r.out)

let 全过 = true
const 例 = (label, 文件, 旧, 新, 判据) => {
  const 备份 = readFileSync(文件, 'utf8')
  if (!备份.includes(旧)) { console.log(`     ❌ 找不到靶子：${label}\n        （期望片段：${旧}）`); 全过 = false; return }
  writeFileSync(文件, 备份.replace(旧, 新))
  const r = 判据()
  writeFileSync(文件, 备份)
  const 掉红 = 判据.红(r)
  const 还原 = 判据()
  const 复绿 = 还原.code === 0
  if (!(掉红 && 复绿)) 全过 = false
  console.log(`     ${掉红 && 复绿 ? '✓' : '✗'} ${label}：改后 exit=${r.code}（红=${掉红}）· 还原后 exit=${还原.code}（绿=${复绿}）`)
}

// —— reportCaliber 靶子（[7] 逐列）——
console.log('【RV §25.1】reportCaliber [7] 逐列解析（改一格必须红 · 还原必须绿）\n')
例('RV-1 改 §四 **第二列**（长稳现行）1勤奋型 1,942,060 → 1,942,061', 总览, '| **1,773,090** | **1,942,060** |', '| **1,773,090** | **1,942,061** |',
  Object.assign(跑CAL, { 红: r => 红CAL(r, '§四 第 2 列') }))
例('RV-2 改 §四 **第三列**（已作废 v4）1勤奋型 2,191,060 → 2,191,061', 总览, '| 2,191,060 |', '| 2,191,061 |',
  Object.assign(跑CAL, { 红: r => 红CAL(r, '§四 第 3 列') }))
例('RV-4 改《长跑报告》§二 **差额列** 1勤奋型 −249,000 → −249,001', 长跑, '| **1,942,060** | 2,191,060 | **−249,000** |', '| **1,942,060** | 2,191,060 | **−249,001** |',
  Object.assign(跑CAL, { 红: r => 红CAL(r, '§二 第 3 列') }))
// RV-3：把解析器改回"只取第一个数字"⇒ 防退化自检必须红（**校准工具本身**）
例('RV-3 把 `取表()` 退化成"只取每行第一个金额"（应触发防退化自检）', CAL,
  '      const idx = 组名.findIndex(n => cells[1] === n)\n      if (idx < 0) continue',
  '      const idx = 组名.findIndex(n => cells[1] === n)\n      if (idx < 0) continue\n      { const m0 = 金额.exec(cells.slice(2).join(" ")); if (m0) 列[表头[1]][组名[idx]] = Number(m0[1].replace(/,/g, "")); continue }',
  Object.assign(跑CAL, { 红: r => 红CAL(r, '防退化自检') }))

// —— docs-sync 靶子（收尾指纹）——
console.log('\n【RV §25.2】docs-sync 收尾指纹（HEAD + 未推 入判据）\n')
例('RV-5 改《过审包》指纹 HEAD → 不存在的哈希 `deadbee`', 过审包, /HEAD\s*`?([0-9a-f]{7,40})`?\s*·\s*未推/.exec(readFileSync(过审包, 'utf8'))?.[0] || '__找不到__',
  m => String(m).replace(/[0-9a-f]{7,40}/, 'deadbee'), Object.assign(跑DS, { 红: 红DS }))
const 未推真 = Number(/未推\s*\**\s*(\d+)/.exec(readFileSync(过审包, 'utf8'))?.[1] ?? NaN)
例(`RV-6 改《过审包》指纹 未推 ${未推真} → ${未推真 + 7}（错值）`, 过审包, `未推 **${未推真}**`, `未推 **${未推真 + 7}**`,
  Object.assign(跑DS, { 红: 红DS }))
例('RV-7 只改《闸门》指纹（四处不一致）', 闸门, `未推 **${未推真}**`, `未推 **${未推真 + 1}**`,
  Object.assign(跑DS, { 红: 红DS }))
// 参考：确认四处指纹当前真的存在且一致（否则上面几条"红"可能是因缺行而红）
{
  const 指纹 = (p, 截断 = false) => {
    const t = readFileSync(p, 'utf8')
    const m = /HEAD\s*`?([0-9a-f]{7,40})`?\s*·\s*未推\s*\**\s*(\d+)/.exec(截断 ? t.slice(0, 6000) : t)
    return m ? m[1] + '/' + m[2] : null
  }
  const 四 = [指纹(闸门), 指纹(队列, true), 指纹(过审包), 指纹(交接卡)]
  const 一致 = 四.every(x => x && x === 四[0])
  console.log(`\n     参考：四处指纹 = ${JSON.stringify(四)} ⇒ ${一致 ? '✓ 一致' : '✗ 不一致或缺失'}`)
  if (!一致) 全过 = false
}
console.log(`\n判定：${全过 ? '✓ §25 RV 全过（7 条靶子 · 红→绿可逆）' : '❌ 有靶子未按预期变红/还原'}`)
process.exit(全过 ? 0 : 1)
