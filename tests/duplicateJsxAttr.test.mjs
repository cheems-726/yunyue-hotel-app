// R109-1 防复发（**精确断言 · 不靠编译器警告**）：
//   登录页每个调用 `handleLogin()` 的 `onKeyDown` 处理器**必须带 `!busy` 守卫**，
//   且**同一 JSX 元素内不得出现两次 `onKeyDown=`**（JSX 重复属性只有最后一个生效 ⇒ 守卫会被静默丢弃）。
//   背景：两个输入框各挂两个 onKeyDown，带 `!busy` 的在前、无守卫的在后 ⇒ 实际生效的是后者 ⇒
//         回车可在 busy 中重复提交（自 v0.30 `55e8b9e` 潜伏；R109-1 / D307）
//   ★ 实测记录：`vite build` 在本配置下**不报** Duplicate 警告（那是 dev 模式行为）⇒ 不能靠它当判据。
import { readFileSync } from 'node:fs'

const f = 'src/App.jsx'
const raw = readFileSync(f, 'utf8')
const bad = []

// ① 每个调用 handleLogin() 的 onKeyDown 必须带 !busy
const 行 = raw.split('\n')
行.forEach((l, i) => {
  if (/onKeyDown=/.test(l) && /handleLogin\(\)/.test(l) && !/!busy/.test(l)) bad.push(`${f}:${i + 1} onKeyDown 调 handleLogin() 但**没有 !busy 守卫**`)
})

// ② 用括号平衡切出每个 JSX 元素，数其中 onKeyDown= 的出现次数（≥2 ⇒ 重复属性）
const 段 = (() => {
  const out = []
  let i = 0
  while (i < raw.length) {
    const m = raw.indexOf('<input', i)
    if (m === -1) break
    let j = m, depth = 0
    while (j < raw.length) {
      const c = raw[j]
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) break
      j++
    }
    out.push({ start: m, text: raw.slice(m, j + 1) })
    i = j + 1
  }
  return out
})()
for (const s of 段) {
  const n = (s.text.match(/onKeyDown=/g) || []).length
  if (n >= 2) bad.push(`${f}: <input> 元素内出现 ${n} 次 onKeyDown=（重复属性 ⇒ 守卫会被丢掉）`)
}

console.log('══ R109-1 防复发：登录页回车守卫（!busy）+ 重复属性 ══')
console.log(`  扫描 ${行.length} 行 · ${段.length} 个 <input> 元素`)
for (const b of bad.slice(0, 5)) console.log('  ✗ ' + b)
console.log(bad.length === 0 ? 'PASS —— 每个 handleLogin 的 onKeyDown 都带 !busy，且无重复属性' : `FAIL —— ${bad.length} 处`)
process.exit(bad.length === 0 ? 0 : 1)
