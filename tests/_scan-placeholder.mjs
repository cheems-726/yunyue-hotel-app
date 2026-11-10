// D367 · 禁用词盘点脚本（A2c 口径：只扫「运行时会显示的文案」，注释/文档不算）
//
// 用法：
//   node tests/_scan-placeholder.mjs            # 扫 src/（去注释后的运行时字符串/JSX 文本）
//   node tests/_scan-placeholder.mjs dist       # 扫构建产物（原样，不去注释——产物本无注释）
//
// 退出码：0 = 0 命中；1 = 有命中（打印 文件:行 + 片段）
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// A2c 定稿：数据缺失类。不扫「暂无 / 没有 / 待处理 / 尚未」——那些是真实空态；
// 「不适用」也不扫（回本周期在负现金流时的真实判据，不是缺数据）。
export const 禁用词 = ['待补', '无公开来源', '无法核算', '无法估算', '装不下', '成本不完整', '缺数据', '未采', '不计费']

/** 去注释：块注释、行注释、JSX 注释保留换行以维持行号 */
export function 去注释(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, ' '))
}

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) { if (f !== 'node_modules') walk(p, out) }
    else if (/\.(mjs|js|jsx)$/.test(f)) out.push(p)
  }
  return out
}

/** 扫文本，返回 [{file,line,col,word,snippet}] */
export function 扫(文本, file = '') {
  const 命中 = []
  const lines = 文本.split(/\r?\n/)
  lines.forEach((line, i) => {
    for (const w of 禁用词) {
      let idx = line.indexOf(w)
      while (idx >= 0) {
        const snippet = line.slice(Math.max(0, idx - 40), idx + w.length + 40).trim()
        命中.push({ file, line: i + 1, col: idx + 1, word: w, snippet })
        idx = line.indexOf(w, idx + w.length)
      }
    }
  })
  return 命中
}

// CLI
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('_scan-placeholder.mjs')) {
  const 目标 = process.argv[2]
  let files
  if (目标 === 'dist') {
    files = readdirSync('dist/assets').filter(f => f.endsWith('.js')).map(f => join('dist/assets', f))
  } else {
    files = walk(目标 || 'src')
  }
  let all = []
  for (const f of files) all = all.concat(扫(目标 === 'dist' ? readFileSync(f, 'utf8') : 去注释(readFileSync(f, 'utf8')), f))
  if (!all.length) { console.log(`✓ 禁用词 0 命中（${files.length} 个文件）`); process.exit(0) }
  console.log(`✗ 禁用词命中 ${all.length} 处 / ${new Set(all.map(x => x.file)).size} 个文件：`)
  for (const h of all) console.log(`  ${h.file}:${h.line}:${h.col}  [${h.word}]  ${h.snippet}`)
  process.exit(1)
}
