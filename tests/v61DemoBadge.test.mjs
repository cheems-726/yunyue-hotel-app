// V61 · 演示/离线态显式标注守门（挂 run-all fast）
// 判据（决策端线上实证：进入离线演示后全屏 0 处「演示」· V55-e 覆盖面不足）：
//   ① DemoPill 组件：user?.cloud !== false ⇒ null（真实登录 cloud:true ⇒ 不渲染）
//   ② 全域挂载：11 处壳层（登录外的教师台/欢迎/选址/品牌/认领/筹建/主壳/结算壳）都有 <DemoPill>
//   ③ 文案 = 演示模式 · 数据只存本机 · 非真实经营（title 展开说明为什么是演示）
//   ④ 红线：pointerEvents='none'（不挡操作）· position fixed（常驻）· token 配色（不刺眼）
// 可证伪：删 DemoPill 定义 / 拔掉壳层挂载 / 改回可点击 ⇒ 对应断言红。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const app = readFileSync(join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src', 'App.jsx'), 'utf8')

console.log('▶ V61 · 演示态常驻标注守门')

// ① 组件定义与条件
ok(/function DemoPill\(\{ user \}\) \{\s*if \(user\?\.cloud !== false\) return null/.test(app), '① DemoPill：cloud!==false ⇒ null（演示登录专属）')
ok(app.includes("onLogin({ role, id: role === 'student' ? '20240101' : 'T001', name: role === 'student' ? '陈小明（演示）' : '王老师（演示）', cloud: false })"), '① 演示登录确实落 cloud:false（判据同源）')

// ② 全域挂载：预开店早退壳 + 主壳都有（登录前壳 user 为空时组件自返 null）
const mounts = (app.match(/<DemoPill user=\{user\} \/>/g) || []).length
ok(mounts >= 10, `② 全域挂载 ≥10 处壳层（实测 ${mounts} · 覆盖教师台/欢迎/选址/品牌/认领/筹建/主壳/结算）`)
ok(/if \(!location\) \{[\s\S]{0,400}<DemoPill user=\{user\} \/>/.test(app), '② 选址壳已挂（决策端实证起点）')
ok(/user\.role === 'teacher'[\s\S]{0,400}<DemoPill user=\{user\} \/>/.test(app), '② 教师后台壳已挂（教师演示态同享）')

// ③ 文案 + 说明
ok(/演示模式 · 数据只存本机 · 非真实经营/.test(app), '③ 角标文案（常驻可读）')
ok(/离线演示：不连服务器，数据只保存在本机，不写真实班次、不计入成绩/.test(app), '③ title 展开说明「为什么是演示」（不含真实账号/班次）')

// ④ 红线：不挡操作 + 不刺眼（只切 DemoPill 函数体 · 防越界假阳性）
const fn = app.slice(app.indexOf('function DemoPill'), app.indexOf('export default function App'))
ok(fn.includes("pointerEvents: 'none'"), '④ pointerEvents=none（绝不拦截点击 · V61 红线）')
ok(fn.includes("position: 'fixed'") && fn.includes('zIndex: 260'), '④ fixed 常驻 + z 序 260')
ok(fn.includes('var(--fill)') && fn.includes('var(--text-muted)') && !/#[0-9a-fA-F]{3,6}/.test(fn), '④ token 配色（无裸色值 · 不刺眼）')

// ⑤ V55-e 另两处仍在：演示确认弹层标注 + 演示用户名后缀
ok(app.includes('【演示数据 · 非真实经营】'), '⑤ 弹层标注仍在（演示确认卡）')
ok(/'陈小明（演示）'/.test(app), '⑤ 演示用户名后缀仍在（我的页可见）')

console.log(`结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
