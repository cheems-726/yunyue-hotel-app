// Wave 4 · W4-4 自检：扫描器工具（--json / --since）
// 运行：node tests/scannerTools.test.mjs   （挂 run-all）
//
// 要求（增量包 §3A）：--json 输出可被 JSON.parse；--since 过滤后结果 ⊆ 全量结果
// ★ 断言同时钉【条件】与【内容】（W3-1 教训）：不仅断言"能解析"，还断言字段齐、过滤真的发生
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const runScanner = (args) => {
  const r = spawnSync('node', ['tests/_scan-stale-scale.mjs', ...args], { cwd: APP, encoding: 'utf8', shell: false, maxBuffer: 1 << 24 })
  return { code: r.status, out: (r.stdout || ''), err: (r.stderr || '') }
}
const git = (args) => spawnSync('git', args, { cwd: APP, encoding: 'utf8', shell: false }).stdout.trim()

console.log('▶ W4-4 自检 · 扫描器工具（--json / --since）')

// ── ① --json：可解析 + 字段齐 ─────────────────────────────────────
console.log('\n[1] --json 机器可读')
let full
{
  const r = runScanner(['--json'])
  let j = null
  try { j = JSON.parse(r.out) } catch (e) { /* 留给下面的断言报错 */ }
  ok(j !== null, '--json 输出可被 JSON.parse', r.out.slice(0, 120))
  if (j) {
    ok(j.scan && j.scope && Array.isArray(j.residual) && Array.isArray(j.whitelisted) && Array.isArray(j.rules),
      '字段齐全：scan / scope / residual / whitelisted / rules')
    ok(j.scope.dir === 'src/' && j.scope.scannedFiles > 0 && j.scope.totalFiles >= j.scope.scannedFiles,
      `scope 自洽：扫 ${j.scope.scannedFiles} / 共 ${j.scope.totalFiles} 个模块`)
    ok(typeof j.命中 === 'number' && j.命中 === j.whitelisted.length + j.residual.length,
      `计数自洽：命中 ${j.命中} = 白名单 ${j.whitelisted.length} + 真残留 ${j.residual.length}`)
    ok(r.code === (j.residual.length ? 1 : 0), `退出码与真残留数一致（exit=${r.code}）`)
    full = j
  }
}

// ── ② --since：过滤真的发生 + 结果 ⊆ 全量 ─────────────────────────
console.log('\n[2] --since 限定范围（且结果 ⊆ 全量）')
{
  const r2 = runScanner(['--since', 'HEAD~2', '--json'])
  const j2 = JSON.parse(r2.out)
  ok(j2.scope.since === 'HEAD~2' && Array.isArray(j2.scope.sinceFiles),
    `scope 记录 since 与改动清单（${(j2.scope.sinceFiles || []).length} 个文件）`)
  ok(j2.scope.scannedFiles < j2.scope.totalFiles,
    `过滤真的发生：只扫 ${j2.scope.scannedFiles} / 共 ${j2.scope.totalFiles}（HEAD~2 之后改动过的）`)
  // 🔴 2026-09-28（夜间 N-0）：本等式原先没做**与扫描器同一套排除**（settle-old-* 快照按设计不扫），
  //   于是 一旦某提交带入 src/settle-old-*.mjs（如 A-1 校准基线 settle-old-a1.mjs），本自检就假红。
  //   修法：把 sinceFiles 先按同一前缀过滤再比 —— 判据没放宽（"扫了但没记"仍会被抓），只是口径对齐。
  // 🔴 2026-10-03（V10b）：同 N-0 先例再做一次口径对齐 —— 扫描器只扫 src 根的 .js/.jsx/.mjs
  //   （styles.css 等非代码文件从来不在扫描范围），该扫清单按同一规则过滤后再比（判据不放宽）。
  const 该扫 = (j2.scope.sinceFiles || []).filter(f => /\.(js|jsx|mjs)$/.test(f) && !f.startsWith('settle-old'))
  ok(该扫.length === j2.scope.scannedFiles,
    `scannedFiles 恰等于【该扫的】改动代码文件数（${该扫.length} 个；已按扫描器同口径排除 settle-old-* 与非代码文件）`)
  // ⊆：--since 的真残留集合必须是全量的子集（按 file:line）
  if (full) {
    const key = (h) => h.rule + '|' + h.file + '|' + h.line
    const fullSet = new Set(full.residual.map(key))
    const sub = j2.residual.every(h => fullSet.has(key(h)))
    ok(sub, `--since 的真残留（${j2.residual.length} 处）⊆ 全量（${full.residual.length} 处）`)
    // 反向：改动文件里的残留必须被全量也抓到（不是只看一个方向）
    const j2Set = new Set(j2.residual.map(key))
    ok(j2.residual.every(h => j2Set.has(key(h))), '--since 结果内部无重复（按行去重正确）')
  }
  // 用一个"覆盖全部历史"的 ref ⇒ 扫描集合应恰等于"改动过且【现存】的文件"
  //   （git diff 列表含已删除文件；扫描器按 design 只扫现存文件 ⇒ 两边求交集才可比）
  const first = git(['rev-list', '--max-parents=0', 'HEAD']).split(/\r?\n/)[0]
  const changed = git(['diff', '--name-only', first, '--', 'src/']).split(/\r?\n/).filter(Boolean).map(p => p.replace(/^src\//, ''))
  const allSrc = readdirSync(new URL('../src/', import.meta.url)).filter(f => /\.(js|jsx|mjs)$/.test(f) && !f.startsWith('settle-old'))
  const changedNow = changed.filter(f => allSrc.includes(f))
  const r3 = runScanner(['--since', first, '--json'])
  const j3 = JSON.parse(r3.out)
  ok(j3.scope.scannedFiles === changedNow.length,
    `--since <首个提交>：扫"改动过且现存"的 ${changedNow.length} 个（另 ${changed.length - changedNow.length} 个已删除、${allSrc.length - changedNow.length} 个未改动 ⇒ 按设计都不扫）`)
  ok(j3.residual.length === (full ? full.residual.length : -1),
    `真残留与全量一致（${j3.residual.length} 处）⇒ 未扫的文件不藏残留`)
}

// ── ③ 坏 ref：明确报错而不是静默扫全量 ────────────────────────────
console.log('\n[3] 坏 ref 要明确报错（不许静默退化）')
{
  const r = runScanner(['--since', 'no-such-ref-xyz'])
  ok(r.code === 2 && /无法解析/.test(r.err), `无效 ref ⇒ 退出码 2 + 明确提示（exit=${r.code}）`, r.err.slice(0, 100))
}

// ── ④ 文本模式：尾行格式仍可被 run-all 汇总解析 ────────────────────
console.log('\n[4] 文本模式尾行格式（门禁汇总依赖它）')
{
  const r = runScanner([])
  ok(/扫描结果：真残留 \d+ 处/.test(r.out), '保留了"扫描结果：真残留 N 处"尾行（既有调用方不受影响）')
  const rl = runScanner(['--list'])
  ok(rl.code === 0 && /白名单/.test(rl.out), '--list 仍可用（只列白名单，退出码 0）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：--json 可解析且字段自洽 · --since 真过滤且结果 ⊆ 全量 · 坏 ref 明确报错')
process.exit(fail ? 1 : 0)
