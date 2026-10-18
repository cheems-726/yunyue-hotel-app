// V115-② 守门：**死导出 = 0**（白名单为空数组）
//   判定：`src/*.mjs` 的每个 export 名，必须在【其它 src 文件】或【tests】里出现 ≥1 次；
//        仅在本文件出现 ⇒ 死导出 ⇒ 红。
//   反例 RV：新加 `export function 没人用() {}` ⇒ 必红。
//   ★ 顺序纪律（审计端 2026-10-18）：**先处置再守门** —— 所以本套件在白名单为 0 落地的同一天启用。
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const 坏 = []
let 检查数 = 0
const ok = (c, m) => { 检查数++; if (!c) 坏.push(m) }

const srcs = readdirSync('src').filter(f => /\.mjs$/.test(f) && !f.startsWith('settle-old'))
const testFiles = readdirSync('tests').filter(f => /\.(mjs|js)$/.test(f))
// ★ V116-P0-3：**引用方必须扫全部 src 文件**（.mjs/.js/.jsx 递归）——
//   上一版只扫 .mjs ⇒ GeoMap.jsx 对 CITY_GEO 的引用看不见 ⇒ 误删（构建挂）。口径写在这里，输出也打印。
const 扫 = (dir) => {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) { if (!['node_modules', 'dist', '.git'].includes(e.name)) out.push(...扫(p)) }
    else if (/\.(mjs|js|jsx)$/.test(e.name)) out.push(p)
  }
  return out
}
const 全部src = 扫('src')
const 全文 = {}
for (const p of 全部src) 全文[p.replace(/\\/g, '/')] = readFileSync(p, 'utf8')
for (const f of testFiles) 全文['tests/' + f] = readFileSync(join('tests', f), 'utf8')

// 收集导出名
const 导出 = []
for (const f of srcs) {
  const s = 全文['src/' + f]
  // export function X / export const X / export async function X / export let/var X
  // ★ 标识符允许中文（V116-P0-3：原先只认 ASCII ⇒ 131 这个数被少算了）
  for (const m of s.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([^\s=({\n]+)/g)) {
    导出.push({ 名: m[1], 文件: 'src/' + f })
  }
}
ok(导出.length > 100, `导出总量应 >100（实测 ${导出.length}）—— 太小说明扫描器坏了`)

let 死 = 0
for (const { 名, 文件 } of 导出) {
  // 别的 src 文件里出现（含 import / 调用）
  // ★ V116-P0-3：`\b` 只认 ASCII 词边界 ⇒ 中文名一律"未引用"。改用 Unicode 边界（前后不能是标识符字符）
  const esc = 名.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const 引用 = (文) => new RegExp(`(^|[^\\w$\\u4e00-\\u9fa5])${esc}($|[^\\w$\\u4e00-\\u9fa5])`).test(文)
  const 他处src = Object.entries(全文).some(([k, 文]) => k.startsWith('src') && k !== 文件 && 引用(文))
  const 他处test = Object.entries(全文).some(([k, 文]) => k.startsWith('tests/') && 引用(文))
  if (!他处src && !他处test) { 死++; 坏.push(`死导出：${名}（${文件}）—— 只在定义处出现`) }
}

const 白名单 = []   // ★ 必须为空（审计端要求）
ok(白名单.length === 0, `白名单必须为空（实得 ${白名单.length} 条）`)
ok(死 === 0, `死导出必须为 0（实得 ${死}）`)

console.log('══ V115-② 死导出守门 ══')
console.log(`  扫描 ${srcs.length} 个 src 模块 · ${导出.length} 个导出 · 死导出 ${死}`)
for (const b of 坏.slice(0, 12)) console.log('  ✗ ' + b)
console.log(`结果: ${检查数 - 坏.length} 通过 / ${坏.length} 失败`)
process.exit(坏.length === 0 ? 0 : 1)
