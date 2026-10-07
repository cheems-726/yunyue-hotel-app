// V66 · 学生首次使用引导守门（挂 run-all fast）
// 判据（决策端线上实证：有 6 步框架但无"第一次该怎么做"的最小指引）：
//   ① GuideTip 组件：localStorage 持久（hotel-guide-<k>）· 非弹窗（inline 提示条 + 关闭按钮）
//   ② 四处挂载：site（选址一句话）/ decide（决策：每日关键三项真实存在 KEY_DECISIONS + 未决策按维持现状生效）
//      / claim（第 X/6 步 · 复用 step）/ setup（第 X/4 步 · 复用 currentStep）——判据同源，不另造
//   ③ 重置双入口：Profile「我要重看引导」+ 教师端「重置演示引导（本机）」
//   ④ 红线：不挡屏（无 fixed 弹层）· 文案与引擎一致（维持现状 = settlement.js 决策复盘段原文）
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const rd = f => readFileSync(join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src', f), 'utf8')
const gt = rd('GuideTip.jsx')
const app = rd('App.jsx')
const site = rd('SiteSelection.jsx')
const claim = rd('Claim.jsx')
const est = rd('Establishment.jsx')
const td = rd('TeacherDashboard.jsx')

console.log('▶ V66 · 首次使用引导守门')

// ① 组件机制
ok(/hotel-guide-/.test(gt) && /guideSeen|getItem/.test(gt), '① localStorage 持久（关闭后不再出现）')
ok(/position: 'fixed'/.test(gt) === false, '① 红线：GuideTip 非 fixed 弹层（inline 提示条 · 不挡屏）')
ok(/aria-label="关闭本条引导"/.test(gt) && /setGone\(true\)/.test(gt), '① 有关闭按钮（点了即持久关闭）')

// ② 四处挂载与判据同源
ok(site.includes('<GuideTip k="site">') && site.includes('确认后本学期不可更改'), '② 选址页一句话引导（含不可更改预告 · 与 V54 同句式）')
ok(app.includes('<GuideTip k="decide">') && app.includes('每日关键') && app.includes('维持现状'), '② 决策列表引导（每日关键三项 + 维持现状生效）')
ok(/const KEY_DECISIONS = \['pricing', 'shifts', 'reputation'\]/.test(app) && /\['key', '每日关键'\]/.test(app), '② 「每日关键」为真实功能（KEY_DECISIONS + 筛选 tab · 非引导杜撰）')
ok(/未决策的部分按"维持现状"生效/.test(rd('settlement.js')), '② 判据同源：settlement.js 决策复盘段原文（不做也会生效 = 引擎真行为）')
ok(claim.includes('<GuideTip k="claim">') && /第 \{step \+ 1\}\/6 步/.test(claim), '② 认领引导（动态第 X/6 步 · 复用 step 状态）')
ok(est.includes('<GuideTip k="setup">') && /第 \{currentStep \+ 1\} 步/.test(est), '② 筹建引导（动态第 X/4 步 · 复用 currentStep 状态）')

// ③ 重置双入口
ok(app.includes('我要重看引导') && app.includes('guideResetAll'), '③ Profile「我要重看引导」入口')
ok(td.includes('重置演示引导（本机）') && td.includes('guideResetAll'), '③ 教师端重置入口（本机口径如实）')

// ④ 挂载完整性：import 都在
ok(site.includes("from './GuideTip.jsx'") && claim.includes("from './GuideTip.jsx'") && est.includes("from './GuideTip.jsx'") && app.includes("from './GuideTip.jsx'"), '④ 四个消费方 import 齐全')

console.log(`结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
