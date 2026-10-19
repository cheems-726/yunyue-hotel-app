// V129-#5 · HEAD 自包含守门（D329 教训：V128 批1 的文件没进库，工作区守门全绿 ⇒ 干净检出 build 直接挂）
// 运行：node tests/headSelfContained.test.mjs           （读 HEAD 的树与文件内容）
//       node tests/headSelfContained.test.mjs --drop src/dailyQuests.mjs   （RV：模拟该文件没进库）
//
// 判据：HEAD 里 src/**/*.{js,jsx,mjs} 的每一条【相对 import/export from】都必须命中 HEAD 里的文件。
// ★ 只认 import/export ... from 与裸 import '...'；先剥掉块注释/行注释（注释里的示例路径不误报）。
// ★ 读的是 HEAD（git show），不是工作区 —— 否则 untracked 文件会骗过守门（D329 正是这样漏的）。
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const APP = process.cwd()
const DROP = (() => {
  const i = process.argv.indexOf('--drop')
  return i > 0 ? String(process.argv[i + 1] || '') : ''
})()

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const git = (args) => execFileSync('git', args, { cwd: APP, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

console.log('▶ V129-#5 · HEAD 自包含（干净检出能否 build）')
if (DROP) console.log(`  [RV] 模拟"该文件从未进库"：${DROP}`)

let 文件s = []
try { 文件s = git(['ls-tree', '-r', '--name-only', 'HEAD']).split(/\r?\n/).filter(Boolean) } catch (e) {
  console.error('✗ 读不到 HEAD 树：' + e.message); process.exit(1)
}
const 集合 = new Set(文件s)
if (DROP) 集合.delete(DROP)

const 剥注释 = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')                 // 块注释
  .split(/\r?\n/).map(l => l.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n')   // 行注释（不误伤 http://）

function 依赖们(code) {
  const out = []
  // import X from '...' · import {a} from '...' · export * from '...'
  const re = /\b(?:import|export)\s+[^;]*?\bfrom\s*['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(code))) out.push(m[1])
  // 裸 import '...'
  const re2 = /\bimport\s*['"]([^'"]+)['"]/g
  while ((m = re2.exec(code))) out.push(m[1])
  return out
}

function 候选(target) {
  const base = target.replace(/\/+$/, '')
  return [base, base + '.js', base + '.jsx', base + '.mjs',
    base + '/index.js', base + '/index.jsx', base + '/index.mjs']
}

const 源文件s = [...集合].filter(f => /^src\/.*\.(js|jsx|mjs)$/.test(f))
ok(源文件s.length >= 50, `HEAD 里 src 源文件数 = ${源文件s.length}（≥50）`)

const 缺失 = []
let 导入数 = 0
for (const f of 源文件s) {
  let code
  try { code = git(['show', `HEAD:${f}`]) } catch (e) { 缺失.push(`${f} → （git show 失败）`); continue }
  const deps = 依赖们(剥注释(code)).filter(s => s.startsWith('.') || s.startsWith('/'))
  for (const dep of deps) {
    导入数++
    const target = dep.startsWith('/') ? dep.slice(1) : path.posix.join(path.posix.dirname(f), dep)
    if (!候选(target).some(p => 集合.has(p))) 缺失.push(`${f} → ${dep}（解析为 ${target}）`)
  }
}
ok(导入数 > 200, `扫描到 ${导入数} 条相对导入（>200）`)
ok(缺失.length === 0, `★ 所有相对 import 都能在 HEAD 里命中（缺失 ${缺失.length}）`, 缺失.slice(0, 8).join(' | '))

// 反例自检（不依赖 --drop）：纯函数必须能识别"指向不存在文件"的导入
{
  const 假 = new Set(['src/a.js'])
  const 目标 = path.posix.join('src', './ghost.js')
  ok(!候选(目标).some(p => 假.has(p)), '解析器能把"指向不存在文件"的导入判为缺失（反例自检）')
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败' + (DROP ? '（RV 模式）' : ''))
process.exit(fail === 0 ? 0 : 1)
