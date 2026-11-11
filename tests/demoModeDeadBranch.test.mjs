// D367 · A1-② 死分支检测（裸扫包）：演示构建里禁用词必须为 0
//
// 判据：
//   ① dist/assets/*.js 内禁用词命中数 = 0（demo 构建已把严格分支物理删除）
//   ② dist-strict/assets/*.js（若已构建）内命中数 > 0
//      ⇒ 证明「源码里的严格口径仍在」，只是构建时被 tree-shaking 删掉（不是删源码换绿）
//   ③ 命中 > 0 时逐条输出：文件 + 偏移 + 片段（便于定位哪个分支没被删掉）
//
// 运行：node tests/demoModeDeadBranch.test.mjs   （先 npm run build）
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const 禁用词 = ['待补', '无公开来源', '无法核算', '无法估算', '装不下', '成本不完整', '缺数据', '未采', '不计费']

function 扫目录(dir) {
  if (!existsSync(dir)) return null
  const files = readdirSync(dir).filter(f => f.endsWith('.js'))
  let text = ''
  for (const f of files) text += readFileSync(join(dir, f), 'utf8')
  const 命中 = []
  for (const w of 禁用词) {
    let i = text.indexOf(w)
    while (i >= 0) {
      命中.push({ word: w, at: i, snippet: text.slice(Math.max(0, i - 60), i + w.length + 60).replace(/\n/g, ' ') })
      i = text.indexOf(w, i + w.length)
    }
  }
  return { files: files.length, bytes: text.length, 命中 }
}

const demo = 扫目录('dist/assets')
const strict = 扫目录('dist-strict/assets')

let 失败 = 0, 检查数 = 0
const ok = (cond, msg, detail) => { 检查数++
  console.log((cond ? '  ✓ ' : '  ✗ ') + msg)
  if (!cond) { 失败++; if (detail) console.log('    ' + String(detail).slice(0, 600)) }
}

console.log('▶ D367 · 演示包禁用词死分支检测')
ok(!!demo, 'dist/assets 存在（先跑 npm run build）')
if (demo) {
  ok(demo.命中.length === 0, `演示包禁用词 0 命中（${demo.files} 个 js · ${(demo.bytes / 1024 / 1024).toFixed(2)} MB）`,
    demo.命中.slice(0, 20).map(h => `[${h.word}]@${h.at} …${h.snippet}…`).join('\n    '))
}

if (strict) {
  ok(strict.命中.length > 0, `严格包仍保留严格文案（${strict.命中.length} 处 ⇒ 证明源码未删，只是 demo 构建被 tree-shaking）`)
} else {
  console.log('  ⏭ dist-strict 未构建（可选）：YUNYUE_DEMO_FILL=0 npx vite build --outDir dist-strict')
}

console.log(`结果: ${检查数 - 失败} 通过 / ${失败} 失败 / 0 跳过`)
process.exit(失败 === 0 ? 0 : 1)
