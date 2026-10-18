// V116-P0-2① 导入/导出对称性：**每个具名 import 都必须在目标文件里真的 export**
//   比"死导出"更要紧：死导出只是多一个没人用的东西，**漏导出会直接让构建挂**（V115-② 就这么挂的）。
//   反例 RV：删掉 `export const CITY_GEO` ⇒ 必红。
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'

const 坏 = []
let 检查数 = 0
const ok = (c, m) => { 检查数++; if (!c) 坏.push(m) }

const 扫 = (dir) => {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) { if (!['node_modules', 'dist', '.git'].includes(e.name)) out.push(...扫(p)) }
    else if (/\.(mjs|js|jsx)$/.test(e.name)) out.push(p)
  }
  return out
}
const 文件 = 扫('src')
ok(文件.length > 60, `src 应扫到 >60 个文件（实测 ${文件.length}）`)

const 导出名 = (p) => {
  const s = readFileSync(p, 'utf8')
  const 名 = new Set()
  // ★ 标识符允许中文（本项目大量 export const 中文名）⇒ 不能只认 [A-Za-z_$]
  for (const m of s.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([^\s=({\n]+)/g)) 名.add(m[1])
  // export { A, B as C }
  for (const m of s.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const t = part.trim()
      if (!t) continue
      const as = t.split(/\s+as\s+/)
      名.add((as[1] || as[0]).trim())
    }
  }
  return 名
}

const barrel = new Set()
let import数 = 0
for (const f of 文件) {
  const s = readFileSync(f, 'utf8')
  for (const m of s.matchAll(/import\s*\{([^}]+)\}\s*from\s*'(\.[^']+)'/g)) {
    const 目标原 = m[2]
    // 解析相对路径（补扩展名）
    let 目标 = resolve(dirname(f), 目标原)
    if (!existsSync(目标)) {
      const 候选 = ['', '.mjs', '.js', '.jsx'].map(ext => 目标 + ext).find(p => existsSync(p))
      if (!候选) { 坏.push(`${f}: import '${目标原}' 指向的文件不存在`); 检查数++; continue }
      目标 = 候选
    }
    const 存 = 导出名(目标)
    // ★ barrel（`export * from …`）无法静态展开 ⇒ 视为"全部导出"（并在输出里注明，不静默放行）
    const 是Barrel = /export\s*\*/.test(readFileSync(目标, 'utf8'))
    if (是Barrel) { barrel.add(目标) }
    for (const part of m[1].split(',')) {
      const t = part.trim()
      if (!t) continue
      const [原名, 别名] = t.split(/\s+as\s+/).map(x => x.trim())
       import数++
      if (!是Barrel) ok(存.has(原名), `${f}: 从 ${目标原} 导入的「${原名}」**没有被导出**（构建会挂）`)
    }
  }
}

console.log('══ V116-P0-2① 导入/导出对称性 ══')
console.log(`  扫描 ${文件.length} 个文件（.mjs/.js/.jsx）· 具名导入 ${import数} 条 · barrel 跳过 ${barrel.size} 个`)
for (const b of 坏.slice(0, 10)) console.log('  ✗ ' + b)
console.log(`结果: ${检查数 - 坏.length} 通过 / ${坏.length} 失败`)
process.exit(坏.length === 0 ? 0 : 1)
