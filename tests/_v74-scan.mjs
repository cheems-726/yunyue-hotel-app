// V74 一次性扫描：占位/暂无/二期 在 src 的逐处定位（只读）
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
const out = []
const walk = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, f.name)
  if (f.isDirectory()) { if (!/node_modules|dist|\.git|android|证据/.test(p)) walk(p) }
  else if (/\.(jsx?|mjs|css|html)$/.test(f.name)) out.push(p)
} }
walk('src'); out.push('index.html')
const PATS = [['占位', /占位/g], ['暂无', /暂无/g], ['二期', /二期/g]]
const counts = { 占位: 0, 暂无: 0, 二期: 0 }
for (const f of out) {
  const lines = readFileSync(f, 'utf8').split(/\r?\n/)
  lines.forEach((l, i) => {
    for (const [name, re] of PATS) {
      re.lastIndex = 0
      if (re.test(l)) { counts[name]++; console.log(`${name}\t${f}:${i + 1}\t${l.trim().slice(0, 170)}`) }
    }
  })
}
console.log('===== 计数 =====', JSON.stringify(counts))
