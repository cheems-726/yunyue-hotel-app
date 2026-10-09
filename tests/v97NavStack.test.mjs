// ★ V97 · 统一「返回/上一页」导航栈守门（2026-10-09 · 用户点名）
//   ① 表驱动：每个导航面都有返回语义 + 清单表行数与表一致（漏配/文档漂移即红）
//   ② 返回是**弹栈**不是固定跳转（A→B→C ⇒ 返回两次依次回 B、A）
//   ③ 栈空 ⇒ 按钮禁用依据（可以返回() === false）
//   ④ 教师端 popstate 处理器（纯函数）：派发一次 ⇒ 回退；栈空 ⇒ 不消费（返回 false，放行浏览器）
import { 创建导航栈, 造返回处理器, 导航面 } from '../src/navStack.mjs'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
let pass = 0, fail = 0
const ok = (c, msg, extra) => { c ? (pass++, console.log('  ✓ ' + msg)) : (fail++, console.log('  ✗ ' + msg + (extra !== undefined ? '  ← ' + extra : ''))) }

// ① 表驱动
const 合法 = new Set(['根', '弹栈', '上一步'])
const 缺 = 导航面.filter(x => !合法.has(x.返回语义)).map(x => x.id)
ok(缺.length === 0, `① 每个导航面都有合法返回语义（${导航面.length} 面）`, 缺.join(','))
const 重复 = 导航面.map(x => x.id).filter((v, i, a) => a.indexOf(v) !== i)
ok(重复.length === 0, '① 导航面 id 无重复', 重复.join(','))
const P = join(dirname(dirname(fileURLToPath(import.meta.url))), '..', '4-审计与报告', '导航返回清单-v1.md')
let md = ''
try { md = readFileSync(P, 'utf8') } catch {}
ok(md.length > 0, '① 清单表存在（4-审计与报告/导航返回清单-v1.md）')
if (md) {
  const 行 = md.split('\n').filter(l => l.startsWith('|') && /^\|\s*(学生|教师)\s*\|/.test(l))
  ok(行.length === 导航面.length, `① 清单表行数 === 导航面数（表 ${行.length} · 代码 ${导航面.length}）· 漏配即红`)
}

// ② 弹栈
{
  const s = 创建导航栈('A'); s.进入('B'); s.进入('C')
  const 一 = s.返回(); const 二 = s.返回()
  ok(一 === 'B' && 二 === 'A', '② 返回是弹栈：A→B→C ⇒ 返回两次依次回 B、A', `${一} / ${二}`)
  ok(s.可以返回() === false, '② 弹到根后不能再退')
}

// ③ 栈空
{
  const s = 创建导航栈('根')
  ok(s.可以返回() === false, '③ 栈空 ⇒ 可以返回() === false（按钮据此禁用/隐藏）')
  const 前 = s.当前(); s.返回()
  ok(s.当前() === 前, '③ 栈空时返回无副作用（不抛错、不改变当前）')
}

// ④ 教师端 popstate（纯函数）
{
  const s = 创建导航栈('live'); s.进入('groups'); s.进入('overview')
  const 变 = []; const h = 造返回处理器(s, v => 变.push(v))
  const 消费1 = h(); const 消费2 = h(); const 消费3 = h()
  ok(消费1 === true && 消费2 === true, '④ 教师端 popstate：两次派发依次回退（groups → live）', JSON.stringify(变))
  ok(JSON.stringify(变) === JSON.stringify(['groups', 'live']), '④ 回退序列正确（不是固定跳 me）', JSON.stringify(变))
  ok(消费3 === false, '④ 栈空 ⇒ 处理器返回 false（放行给浏览器 · 不假消费）')
}

// RV 反向自检：处理器/栈不是恒真
{
  const s = 创建导航栈('A')
  ok(造返回处理器(s, () => { throw new Error('不该被调用') })() === false, 'RV：栈空时处理器不调用应用（恒真即红）')
  const s2 = 创建导航栈('A'); s2.进入('B'); s2.进入('B')
  ok(s2.纵深() === 1, 'RV：同处重复进入不叠栈（纵深仍 1）', String(s2.纵深()))
}
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：漏配导航面 / 清单表少一行 / 返回变固定跳转 / 栈空仍可退 ⇒ 本套件红')
process.exit(fail ? 1 : 0)
