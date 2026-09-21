// 未使用 import 扫描器（轻量启发式，仅供人工复核）
// 用法：node scripts/scan-unused-imports.cjs
const fs = require('fs')
const path = require('path')

const files = fs.readdirSync('src').filter(f => /\.(js|jsx|mjs)$/.test(f))
const skip = new Set(['settle-old-r0.mjs', 'settle-old-rev.mjs', 'settle-old-sev.mjs']) // 测试夹具，故意保留旧 import 形态
const findings = []

for (const f of files) {
  if (skip.has(f)) continue
  const code = fs.readFileSync(path.join('src', f), 'utf8')
  const lines = code.split('\n')
  let i = 0
  while (i < lines.length) {
    if (/^\s*import\s/.test(lines[i])) {
      let stmt = lines[i], j = i
      while (!/from\s+['"]/.test(stmt) && j < lines.length - 1) { j++; stmt += '\n' + lines[j] }
      const names = []
      for (const m of stmt.matchAll(/\{([^}]*)\}/g)) {
        for (const raw of m[1].split(',')) {
          const nm = raw.trim().split(/\s+as\s+/).pop().trim()
          if (nm) names.push(nm)
        }
      }
      const defM = stmt.match(/^import\s+([A-Za-z0-9_$]+)\s*(,|from)/m)
      if (defM && defM[1] !== 'type') names.push(defM[1])
      const body = code.slice(0, code.indexOf(stmt)) + code.slice(code.indexOf(stmt) + stmt.length)
      for (const n of names) {
        const re = new RegExp('\\b' + n.replace(/\$/g, '\\$') + '\\b')
        if (!re.test(body)) findings.push({ file: f, line: i + 1, name: n })
      }
      i = j + 1
      continue
    }
    i++
  }
}

if (!findings.length) console.log('✅ 未发现未使用的 import（已跳过测试夹具 settle-old-*.mjs）')
else {
  console.log('⚠️ 疑似未使用的 import（' + findings.length + ' 处，需人工确认）:')
  for (const x of findings) console.log(`   ${x.file}:${x.line}  →  ${x.name}`)
}
