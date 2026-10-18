// V123-#1 防复发（精确版 · 不做通用扫描）：子组件用父作用域状态 ⇒ 必须在 props 里传进来
//   已实测两只：InjectionPanel 用了 classDay（渲染即崩 · 教师端白屏）、classWeek（点"注入"崩）。
//   反例 RV：删掉任一处 `classDay={classDay}` / `classWeek={classWeek}` ⇒ 必红。
import { readFileSync } from 'node:fs'

const 坏 = []
let 检查数 = 0
const ok = (c, m) => { 检查数++; if (!c) 坏.push(m) }

const f = 'src/TeacherDashboard.jsx'
const s = readFileSync(f, 'utf8')

// ① 签名必须接收这两个
{
  const m = /function\s+InjectionPanel\s*\(\s*\{([^}]*)\}\s*\)/.exec(s)
  ok(!!m, '应能找到 InjectionPanel 的定义')
  const props = m ? m[1] : ''
  ok(/classDay/.test(props), 'InjectionPanel 签名必须接收 classDay（否则渲染注入列表即白屏）')
  ok(/classWeek/.test(props), 'InjectionPanel 签名必须接收 classWeek（否则点「注入」时 ReferenceError）')
}

// ② 每一处调用都必须传
{
  const 调用 = [...s.matchAll(/<InjectionPanel\b[^>]*\/>/g)].map(x => x[0])
  ok(调用.length >= 2, `应至少 2 处调用（主区 + 大屏侧栏），实得 ${调用.length}`)
  for (const c of 调用) {
    ok(/classDay=\{classDay\}/.test(c), '有一处 InjectionPanel 调用没传 classDay：' + c.slice(0, 60))
    ok(/classWeek=\{classWeek\}/.test(c), '有一处 InjectionPanel 调用没传 classWeek：' + c.slice(0, 60))
  }
}

// ③ 组件体内不出现"既非 prop 也非本地"的高风险状态名（只查这两个，守住已实测的两只）
{
  const 体起 = s.indexOf('function InjectionPanel(')
  const 体止 = s.indexOf('\nfunction ', 体起 + 10)
  const 体 = s.slice(体起, 体止 > 0 ? 体止 : undefined)
  for (const 名 of ['classDay', 'classWeek']) {
    const 声明 = new RegExp('\\b(?:const|let)\\s*\\[\\s*' + 名).test(体)
    ok(!声明 || 名 === 'x', `InjectionPanel 体内不得重复声明 ${名}`)
  }
}

console.log('══ V123-#1 防复发：InjectionPanel 的 prop 完整性 ══')
console.log(`  ${检查数} 条判据 · 调用点 ${(s.match(/<InjectionPanel\b/g) || []).length} 处`)
for (const b of 坏.slice(0, 8)) console.log('  ✗ ' + b)
console.log(`结果: ${检查数 - 坏.length} 通过 / ${坏.length} 失败`)
process.exit(坏.length === 0 ? 0 : 1)
