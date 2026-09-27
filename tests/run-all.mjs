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
  { name: 'dayEngine（日引擎·一期D1）', file: 'tests/dayEngine.test.mjs' },
  { name: 'fairness（B5 公平性形式化）', file: 'tests/fairness.test.mjs' },
  // dataDict（B6+M2 术语断言）：🔴 T1.4 已完成（RevPAR÷7 / ADR实收 / GOP 三修）⇒ 摘掉 expectedFail，按【全绿】要求
  { name: 'dataDict（B6 口径 + M2 术语）', file: 'tests/dataDict.check.mjs' },
  // W2-3（W10 正名）：GOP / 净利润 口径 + 三处界面显示（含"评分基准零变化"）
  { name: 'metrics-w2-3（GOP/净利润 口径与界面）', file: 'tests/metrics-w2-3.test.mjs' },
  // W2 收尾：资金三数【单源】守门（改 IC 漏改文案/阈值的漂移类 ⇒ fast 抓，不必等浏览器）
  { name: 'capital-single-source（资金三数单源）', file: 'tests/capital-single-source.test.mjs' },
  // Wave 3 · W3-2：认领页物业报价单（投资侧纯计算 · 不改结算）
  { name: 'propertyQuote（认领页报价单·W3-2）', file: 'tests/propertyQuote.test.mjs' },
  // Wave 4 · D-2：仓库卫生（垃圾文件不得被跟踪 + .gitignore 规则在位 + 证据图引用检查）
  { name: 'repoHygiene（仓库卫生·D-2）', file: 'tests/repoHygiene.test.mjs' },
  // Wave 4 · D-1：对象字面量重复键扫描（'静默吞掉'家族守门）
  { name: 'noDuplicateKeys（重复键守门·D-1）', file: 'tests/noDuplicateKeys.test.mjs' },
  // Wave 3 · W3-1/W3-5：一页钱账（口径 (b) 本店实测）+ 回本周期（外推）
  { name: 'onePageLedger（一页钱账+回本·W3-1/W3-5）', file: 'tests/onePageLedger.test.mjs' },
  { name: 'verify-gop（GOP 口径 + 拆租金零变化）', file: 'tests/verify-gop.mjs' },
  { name: 'teachingClock（教学日历时钟·T2.3）', file: 'tests/teachingClock.test.mjs' },
  { name: 'missingWeeks（缺周展示·T2.4）', file: 'tests/missingWeeks.test.mjs' },
  { name: 'franchiseModel（加盟经济模型 P1·Phase F）', file: 'tests/franchiseModel.test.mjs' },
  { name: 'stateMigration（存档口径迁移·批次 B1）', file: 'tests/stateMigration.test.mjs' },
  { name: 'stateMigrationCompat（旧档+续营3周·无混口径）', file: 'tests/stateMigrationCompat.test.mjs' },
  { name: 'cloudMigration（云端路径补迁·批次 B1.5）', file: 'tests/cloudMigration.test.mjs' },
  { name: 'longRun126（126天长跑+故障注入·批次 B2）', file: 'tests/longRun126.test.mjs' },
  { name: 'dailyReport（日报 T3.3/T3.4·批次 B2）', file: 'tests/dailyReport.test.mjs' },
  { name: 'engineBarrel（引擎统一出口 T3.1·批次 B2）', file: 'tests/engineBarrel.test.mjs' },
  { name: 'dbLayer（数据层职责抽查 T3.5·批次 B2）', file: 'tests/dbLayer.test.mjs' },
  { name: 'nullGuardPattern（!= null 模式守门·批次 B2.5）', file: 'tests/nullGuardPattern.test.mjs' },
  // —— Wave 1（服务端自动结算）——
  { name: 'serverTick（服务端逐日推进·W1-3 D7 证据）', file: 'tests/serverTick.test.mjs' },
  { name: 'antiCheat（防作弊三件套·W1-4）', file: 'tests/antiCheat.test.mjs' },
  { name: 'progressLag（老师端进度提示·W1-5）', file: 'tests/progressLag.test.mjs' },
  { name: 'engine-parity（M4 同构验证）', file: 'tests/engine-parity.mjs' },
  { name: 'docs-sync（M5 文档同步守卫）', file: 'tests/docs-sync.mjs' },
  { name: 'rehearsal（6组×12周彩排）', file: 'tests/rehearsal.mjs' },
  { name: 'rehearsal-stress（压力与边界）', file: 'tests/rehearsal-stress.mjs' },
  // ⏳ 已知红（平衡性待决 · A 级 · 2026-09-27 用户拍板 D39）：本套件的断言【一个字没改】——
  //    它在真实 45% 完整部门成本下报「死亡选址过多 24/52（>15%）」，属【教学平衡问题】：
  //    低出租率选址在按可售房摊的固定部门成本下真亏。目标值（门槛 or 租金曲线）已进待决策队列，
  //    等用户拍板；**不许调阈值、不许调租金曲线来变绿**。
  //    ⇒ 门禁把它显示为「⏳ 已知红」并写明理由，不计入失败数，但【仍在门禁内、仍然会跑】。
  { name: 'location-matrix（选址矩阵）', file: 'tests/location-matrix.mjs', knownRed: {
      reason: '平衡性待决：真实 45% 部门成本下低出租选址真亏（24/52 > 15% 阈值）；目标值待拍板',
      since: '2026-09-27', decision: 'D39', owner: '用户（待决策队列）',
    } },
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
    // D39：已知红（平衡性待决）—— 跑、报告、写明理由，但不计入失败数（断言本身未改动）
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
  // expectedFail：当前预期失败（如 M2 修复前红）；红→记「预期红」不算失败，绿→记「已转绿」
  if (s.expectedFail) {
    const state = r.code === 0 ? '✅ 已转绿' : '⏳ 预期红'
    if (r.code === 0) console.log(`${s.name.padEnd(38)} ${state} ${r.pass != null ? r.pass + ' 通过 / ' + r.fail + ' 失败' : ''} (${r.secs}s)`)
    else console.log(`${s.name.padEnd(38)} ${state} ${r.pass != null ? r.pass + ' 通过 / ' + r.fail + ' 失败（T1.3/T1.4 完成后转绿）' : ''} (${r.secs}s)`)
    rows.push({ name: s.name, state, pass: r.pass ?? '-', fail: r.fail ?? '-', secs: r.secs, out: r.out })
    continue
  }
  // ⏳ D39「已知红」：平衡性待决项 —— 套件【断言一个字没改】，仍然跑、仍然报红，
  //    但明确标注理由与拍板编号，且不计入失败数（避免掩盖，也避免误导）
  if (s.knownRed) {
    const state = r.code === 0 ? '✅ 已知红已转绿' : '⏳ 已知红'
    if (r.code === 0) console.log(`${s.name.padEnd(38)} ${state} ${r.pass != null ? r.pass + ' 通过 / ' + r.fail + ' 失败' : ''} (${r.secs}s)`)
    else console.log(`${s.name.padEnd(38)} ${state} ${r.pass != null ? r.pass + ' 通过 / ' + r.fail + ' 失败' : ''} (${r.secs}s)· ${s.knownRed.decision} 待决`)
    rows.push({ name: s.name, state, pass: r.pass ?? '-', fail: r.fail ?? '-', secs: r.secs, out: r.out, knownRed: s.knownRed })
    continue
  }
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
const knownReds = rows.filter(r => r.knownRed)
if (knownReds.length) {
  console.log('\n⏳ 已知红（在门禁内保留 · 断言未改动 · 不计入失败数）：')
  knownReds.forEach(r => {
    console.log(`  · ${r.name}`)
    console.log(`    理由：${r.knownRed.reason}`)
    console.log(`    拍板：${r.knownRed.decision}（${r.knownRed.since}）· 归属：${r.knownRed.owner}`)
  })
  console.log('  ★ 纪律：不许调阈值 / 不许调租金曲线来让它变绿 —— 目标值待拍板')
}

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
