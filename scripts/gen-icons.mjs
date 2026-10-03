// V10b 图标注册表生成器：读 3-设计文档/图标/*.svg（语义键.svg）⇒ 写 src/iconPaths.mjs
// 运行：node scripts/gen-icons.mjs（图标更新后重跑一次；产物已提交，构建不依赖外部目录）
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const 根 = dirname(dirname(fileURLToPath(import.meta.url)))
const 图标目录 = join(根, '..', '3-设计文档', '图标')
const 产物 = join(根, 'src', 'iconPaths.mjs')

const files = readdirSync(图标目录).filter(f => f.endsWith('.svg')).sort()
const entries = []
for (const f of files) {
  const key = f.replace(/\.svg$/, '')
  const src = readFileSync(join(图标目录, f), 'utf8')
  const m = src.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)
  if (!m) { console.error(`✗ ${f}: 无 <svg> 内容`); process.exit(1) }
  const body = m[1].replace(/\s+/g, ' ').trim()
  entries.push(`  '${key}': '${body.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',`)
}

const out = `// ★ 自动生成（scripts/gen-icons.mjs · 源：3-设计文档/图标/*.svg · 键=语义键）——勿手改
export const ICONS = {
${entries.join('\n')}
}
`
writeFileSync(产物, out, 'utf8')
console.log(`✓ ${产物}（${entries.length} 个图标键）`)
