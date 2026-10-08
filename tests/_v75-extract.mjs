// V75 · 全站可点击项重抽取（与决策端 20261006 清单同口径：onClick/onChange/role=button + 就近标签 + 行为表达式）
// ★ 口径纪律（卡⓿预防针）：161 是【清单行数】不是覆盖度结论；本脚本只产出"候选可点击项"，分类靠逐条读码。
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
const files = []
const walk = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, f.name)
  if (f.isDirectory()) { if (!/node_modules|dist|\.git|android|证据/.test(p)) walk(p) }
  else if (/\.jsx$/.test(f.name)) files.push(p)
} }
walk('src')
let n = 0
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split(/\r?\n/)
  lines.forEach((l, i) => {
    if (/onClick=|onChange=|role="button"/.test(l)) {
      n++
      // 就近中文标签：本行中文串，没有则向上找最近带中文的行
      let label = ''
      const zh = (s) => { const m = s.match(/[\u4e00-\u9fa5][\u4e00-\u9fa5A-Za-z0-9 ·＿_>]*/g); return m ? m[m.length - 1] : '' }
      label = zh(l)
      if (!label) { for (let j = i - 1; j >= 0 && i - j < 6; j--) { label = zh(lines[j]); if (label) break } }
      const 行为 = (l.match(/onClick=\{([^}]{0,80})|onChange=\{([^}]{0,80})/g) || ['(内联)']).join(' ').slice(0, 90)
      console.log(`${n}\t${path.basename(f)}\t${label.slice(0, 24) || '(无名)'}\t${行为}\t${path.basename(f)}:${i + 1}`)
    }
  })
}
console.error(`总计 ${n} 项`)
