// 全量测试汇总入口：一条命令跑完所有测试，出汇总表
//
// 用途：①「改完必跑门禁」的单一入口 ②夜间/交接时的系统健康快照
// 运行：node tests/run-all.mjs            全部（含浏览器端到端 + 冒烟，约 6-8 分钟）
//       node tests/run-all.mjs --fast     只跑引擎/脚本类（不含浏览器，约 1 分钟）
//       node tests/run-all.mjs --no-build 跳过 npm run build
// 退出码：0 = 全绿；1 = 有失败；2 = 有环境性跳过
import { spawnSync, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const FAST = process.argv.includes('--fast')
const NO_BUILD = process.argv.includes('--no-build')

// 期望通过数（脚本自报尾行解析，这里只做"红/绿 + 计数"汇总）
const SUITES = [
  { name: 'settlement（结算引擎）', file: 'tests/settlement.test.mjs' },
  { name: 'attrs（属性池）', file: 'tests/attrs.test.mjs' },
  { name: 'guests（客人/原因/文本/严重度）', file: 'tests/guests.test.mjs' },
  { name: 'reviewRate（评价率三因子）', file: 'tests/reviewRate.test.mjs' },
  { name: 'liveReview（实时评价纯核心）', file: 'tests/liveReview.test.mjs' },
  { name: 'shadow-reviews（改前vs改后·逐周一致）', file: 'tests/shadow-reviews.mjs' },
  { name: 'verify-severity（语气分级）', file: 'tests/verify-severity.mjs' },
  { name: 'rehearsal（6组×12周彩排）', file: 'tests/rehearsal.mjs' },
  { name: 'rehearsal-stress（压力与边界）', file: 'tests/rehearsal-stress.mjs' },
  { name: 'location-matrix（选址矩阵）', file: 'tests/location-matrix.mjs', optional: true },
  { name: 'verify-capital（资金权威 + B5）', file: 'tests/verify-capital.mjs', browser: true },
  { name: 'verify-live-review-ui（浏览器端到端）', file: 'tests/verify-live-review-ui.mjs', browser: true },
  { name: 'ui-smoke（已并入 npm run test:ui）', file: null, npm: 'test:ui', browser: true, note: '含 build' },
]

const rows = []
let failed = 0, skipped = 0

function run(cmd, args, label) {
  const t0 = Date.now()
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', shell: process.platform === 'win32' })
  const out = (r.stdout || '') + (r.stderr || '')
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  // 解析尾部的「N 通过 / M 失败」或「N 通过, M 失败」
  const m = out.match(/(\d+)\s*通过\s*[/,，]\s*(\d+)\s*失败/) || out.match(/通过[：:]\s*(\d+)[^\d]+(\d+)/)
  const pass = m ? Number(m[1]) : null
  const fail = m ? Number(m[2]) : null
  return { code: r.status, out, secs, pass, fail, label }
}

console.log('══ 全量测试汇总 ══' + (FAST ? '（--fast：跳过浏览器类）' : '') + (NO_BUILD ? '（跳过 build）' : ''))

if (!NO_BUILD) {
  const b = run('npm', ['run', 'build'], 'build')
  console.log(`build .......... ${b.code === 0 ? '✓ 通过' : '✗ 失败'} (${b.secs}s)`)
  if (b.code !== 0) { console.log(b.out.slice(-1200)); process.exit(1) }
  rows.push({ name: 'npm run build', state: '✓', pass: '-', fail: '-', secs: b.secs })
}

for (const s of SUITES) {
  if (s.npm) {
    if (FAST) { rows.push({ name: s.name, state: '⏭ 跳过（--fast）', pass: '-', fail: '-', secs: '-' }); skipped++; continue }
    const r = run('npm', ['run', s.npm], s.name)
    const state = r.code === 0 ? '✓' : '✗'
    if (r.code !== 0) failed++
    console.log(`${s.name.padEnd(38)} ${state} ${r.pass != null ? r.pass + ' 通过 / ' + r.fail + ' 失败' : ''} (${r.secs}s)`)
    rows.push({ name: s.name, state, pass: r.pass ?? '-', fail: r.fail ?? '-', secs: r.secs, out: r.out })
    continue
  }
  if (s.browser && FAST) { rows.push({ name: s.name, state: '⏭ 跳过（--fast）', pass: '-', fail: '-', secs: '-' }); skipped++; continue }
  if (!existsSync(s.file)) {
    rows.push({ name: s.name, state: '⏭ 不存在', pass: '-', fail: '-', secs: '-' }); skipped++
    console.log(`${s.name.padEnd(38)} ⏭ 文件不存在：${s.file}`)
    continue
  }
  const r = run('node', [s.file], s.name)
  const state = r.code === 0 ? '✓' : '✗'
  if (r.code !== 0) failed++
  console.log(`${s.name.padEnd(38)} ${state} ${r.pass != null ? r.pass + ' 通过 / ' + r.fail + ' 失败' : ''} (${r.secs}s)`)
  rows.push({ name: s.name, state, pass: r.pass ?? '-', fail: r.fail ?? '-', secs: r.secs, out: r.out })
}

// ── 汇总表 ──
console.log('\n── 汇总 ──')
const total = rows.reduce((a, r) => a + (Number(r.pass) || 0), 0)
const totalFail = rows.reduce((a, r) => a + (Number(r.fail) || 0), 0)
for (const r of rows) console.log(`  ${r.state}  ${String(r.name).padEnd(40)} ${String(r.pass).padStart(4)} 通过 / ${String(r.fail).padStart(2)} 失败  ${r.secs}s`)
console.log(`\n合计断言：${total} 通过 / ${totalFail} 失败${skipped ? ` · 跳过 ${skipped} 项` : ''}`)

if (failed) {
  console.log('\n✗ 失败项详情（尾部 40 行）：')
  rows.filter(r => r.state === '✗').forEach(r => {
    console.log(`\n──── ${r.name} ────`)
    console.log(String(r.out || '').split('\n').slice(-40).join('\n'))
  })
  process.exit(1)
}
console.log('\n✅ 全绿')
process.exit(0)
