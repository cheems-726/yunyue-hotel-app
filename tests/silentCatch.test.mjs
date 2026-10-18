// V115 §1-④ 判据：**无理由的静默 catch = 0**
//   规则：每处 `catch {}` / `.catch(()=>{})` 的**前面 3 行内**必须有 `// 静默理由：<为什么可以吞>`
//   反例 RV：删掉任一条理由注释 ⇒ 必红；新加一处裸 `catch {}` ⇒ 必红。
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const 坏 = []
let 检查数 = 0
const ok = (c, m) => { 检查数++; if (!c) 坏.push(m) }

const 扫 = (d) => readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const p = join(d, e.name)
  if (e.isDirectory()) return ['node_modules', 'dist'].includes(e.name) ? [] : 扫(p)
  return /\.(mjs|js|jsx)$/.test(e.name) ? [p] : []
})

let 静默总数 = 0, 有理由 = 0
for (const p of 扫('src')) {
  const L = readFileSync(p, 'utf8').split('\n')
  L.forEach((line, i) => {
    const 静默 = /catch\s*(\([^)]*\))?\s*\{\s*\}/.test(line) || /\.catch\(\s*\([^)]*\)\s*=>\s*\{\s*\}\s*\)/.test(line)
    if (!静默) return
    静默总数++
    const 前文 = [L[i - 1] || '', L[i - 2] || '', L[i - 3] || '', line].join('\n')
    // 同一行内联注释也认
    if (/静默理由：\S/.test(前文)) 有理由++
    else 坏.push(`${p.replace(/\\/g, '/')}:${i + 1} 静默 catch 没有「静默理由」`)
  })
}
ok(静默总数 > 0, `应扫到静默 catch（实测 ${静默总数}）—— 太少说明扫描器坏了`)
ok(坏.length === 0, `无理由的静默 catch 必须为 0（实得 ${坏.length}）`)

console.log('══ V115 §1-④ 静默 catch 白名单 ══')
console.log(`  静默 catch ${静默总数} 处 · 有理由 ${有理由} 处 · 无理由 ${坏.length} 处`)
for (const b of 坏.slice(0, 10)) console.log('  ✗ ' + b)
console.log(`结果: ${检查数 - 坏.length} 通过 / ${坏.length} 失败`)
process.exit(坏.length === 0 ? 0 : 1)
