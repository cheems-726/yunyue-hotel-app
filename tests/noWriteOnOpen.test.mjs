// D369 · 同步「打开即覆盖」根治（B 步）· 静态守门
// 判据（可证伪）：
//   ① 两条上传路径（doSave / flushSave）**先读脏版本**，为 0 一律 return
//   ② 脏版本是 ref（不落 localStorage）
//   ③ 六类真操作都置脏（决策保存/周结算/认领/筹建/押注/复盘/委托/取名/重开）
//   ④ 脏版本定义必须在 App() 作用域内（**不许**落在子组件 Business/DecisionPanel 里 —— 真实踩过：运行时报 脏版本 is not defined）
//   ⑤ 上传成功后按版本号归零（期间又有改动则保留）
import { readFileSync } from 'node:fs'
let pass = 0, fail = 0
const ok = (c, n, x = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (x ? '  [' + x + ']' : '')) } }
const s = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const lines = s.split(/\r?\n/)
const lineOf = (re) => lines.findIndex(l => re.test(l)) + 1

console.log('▶ D369 · 打开即覆盖根治（静态）')

const appLine = lineOf(/^export default function App\(\)/)
const refLine = lineOf(/const 脏版本 = useRef\(0\)/)
const 标记Line = lineOf(/const 标记改动 = \(\) =>/)
const 上传Line = lineOf(/const doSave = async/)
ok(appLine > 0 && refLine > appLine, '脏版本定义在 App() 内', `App@${appLine} ref@${refLine}`)
ok(refLine > 0 && 上传Line > refLine, '上传路径在定义之后', `ref@${refLine} doSave@${上传Line}`)
// 定义前最近的顶层函数不能是子组件（Business 等）
const 定义前 = lines.slice(0, refLine - 1).reverse().find(l => /^(export default function|function)\s+\w+/.test(l) || /^const\s+\w+\s*=\s*\(/.test(l))
ok(/function App\(|const App\s*=/.test(定义前 || ''), '定义所在的最近函数是 App（不是子组件）', 定义前)

const 紧跟脏守卫 = (startRe) => {
  const i = lines.findIndex(l => startRe.test(l))
  if (i < 0) return false
  return lines.slice(i + 1, i + 6).map(x => x.trim()).filter(Boolean).some(x => x === 'if (!脏版本.current) return')
}
ok(紧跟脏守卫(/const doSave = async \(\) => \{/), 'doSave 先读脏版本（为 0 直接 return）')
ok(紧跟脏守卫(/const flushSave = \(\) => \{/), 'flushSave 先读脏版本（刷新/关页不写）')
ok(/if \(ok\) \{ if \(脏版本\.current === 本次版本\) 脏版本\.current = 0; return \}/.test(s), '上传成功按版本号归零（不误清并发改动）')
ok(!/localStorage\.(setItem|getItem)\([^\n]*脏版本/.test(s), '脏版本不落 localStorage（跨会话不污染）')

const 置脏点 = [
  [/setHistory\(下一步\.history\)/.test(s) && /下一周状态\(/.test(s), '周结算'],
  [/标记改动\(\)\s*\/\/ D369：认领提交/.test(s), '认领提交'],
  [/标记改动\(\)\s*\/\/ D369：筹建提交/.test(s), '筹建提交'],
  [/标记改动\(\)\s*\/\/ D369：决策保存/.test(s), '决策保存'],
  [/标记改动\(\)\s*\/\/ D369：押注/.test(s), '押注'],
  [/标记改动\(\)\s*\/\/ D369：复盘/.test(s), '复盘'],
  [/标记改动\(\)\s*\/\/ D369：委托/.test(s), '每日委托'],
  [/标记改动\(\)\s*\/\/ D369：取名/.test(s), '取名'],
]
for (const [c, n] of 置脏点) ok(c, `置脏：${n}`)

console.log(`结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
