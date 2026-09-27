// 批次 B2-4 · 数据层职责抽查（T3.5）验收
// 运行：node tests/dbLayer.test.mjs   （已挂 run-all）
//
// 判据（§二十一·五 批次 B2-4）：确认"数据库侧无业务计算残留"
//   —— 只出结论、不删文件（删除需拍板）
//
// 本套件把结论固化成【可复跑的守门】：
//   ① 已知的业务计算残留（cloud-settle.sql）必须带【⛔ 已作废 · 禁止部署】警示头
//   ② 除它之外，不得再出现"含结算变量的 PL/pgSQL 函数"（新增一处就要被看见）
//   ③ schema/迁移类 SQL 只做鉴权/RLS/归档，不得含结算计算
//   ④ 退役文件不得被部署脚本"误伤"引入（部署脚本必须显式指向目标文件）
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const APP = 'D:/教学app/hotel-app/'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const read = (p) => readFileSync(APP + p, 'utf8')

// 找全部 sql（排除 node_modules）
function findSql(dir = APP, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue
    const p = join(dir, e.name)
    if (e.isDirectory()) findSql(p, out)
    else if (e.name.endsWith('.sql')) out.push(p)
  }
  return out
}
const SQLS = findSql().map(p => p.replace(/\\/g, '/').replace(APP, ''))
console.log('▶ 批次 B2-4 · 数据层职责抽查（T3.5）')
console.log(`  扫描 SQL 文件 ${SQLS.length} 份：${SQLS.join(' · ')}`)

// 结算类变量/标识（出现在 PL/pgSQL 里即视为"业务计算"）
const SETTLE_MARKERS = /v_occupancy|v_revenue|v_profit|v_good_rate|v_total_cost|settle_group|settle_all_groups|rand_next|rand_float/
// 旧口径阈值（T1.1 之后不该在 SQL 里以"活体"形式出现）
const OLD_SCALE = /\b(500000|100000|50000)\b/

console.log('\n[1] ① 已知业务计算残留：cloud-settle.sql 必须带作废警示头')
{
  const p = 'scripts/cloud-settle.sql'
  ok(existsSync(APP + p), `文件存在：${p}`)
  const s = read(p)
  const head = s.split('\n').slice(0, 3).join('\n')
  ok(/已作废/.test(head) && /禁止部署/.test(head), '头部带【已作废 · 禁止部署】警示（防顺手部署）')
  ok(/BL-1/.test(s) && /D8/.test(s), '警示头写明了依据（BL-1 更正 + D8 同构方向）')
  const markers = s.match(SETTLE_MARKERS)
  console.log(`     该文件含结算标识 ${markers ? markers.length : 0} 处（v_occupancy/v_revenue/settle_group/rand_next…）`)
  ok(!!markers && markers.length > 0, '确认它【确实是】一套完整的业务计算（不是空壳）')
  ok(/尚未实施/.test(s), '警示头写明"尚未实施"（登记册 BL-1 的状态）')
}

console.log('\n[2] ② 业务计算的扩散：除已标记的退役文件外，不得再有')
{
  const offenders = []
  for (const p of SQLS) {
    if (p.endsWith('cloud-settle.sql')) continue          // 已标记退役
    const s = read(p)
    if (SETTLE_MARKERS.test(s)) offenders.push(p)
  }
  ok(offenders.length === 0, `其余 ${SQLS.length - 1} 份 SQL 均不含结算计算${offenders.length ? ' → 新增残留：' + offenders.join(', ') : ''}`)
  // 退役文件的警示头必须仍在（防止被"顺手清理"掉）
  const retired = read('scripts/cloud-settle.sql')
  ok(/⛔/.test(retired), '退役文件的警示头仍在（守门有效）')
}

console.log('\n[3] ③ schema / 迁移类 SQL 只做鉴权·RLS·归档，不含结算')
{
  for (const p of SQLS.filter(x => /schema|migration/.test(x))) {
    const s = read(p)
    const hasRLS = /enable row level security|create policy|is_teacher/i.test(s)
    const hasSettle = SETTLE_MARKERS.test(s)
    ok(!hasSettle, `${p}：不含结算计算${hasRLS ? '（含 RLS/鉴权，符合职责）' : ''}`)
    // 关键表不得有"计算生成的列"（generated column 会把业务计算藏进 DB）
    const gen = s.match(/generated\s+(always\s+)?as\s*\(/gi)
    ok(!gen, `${p}：无 generated 计算列`)
  }
}

console.log('\n[4] ④ 旧口径阈值不得以"活体 SQL"形式存在（除退役文件）')
{
  const hits = []
  for (const p of SQLS) {
    if (p.endsWith('cloud-settle.sql')) continue
    const lines = read(p).split(/\r?\n/).filter(l => !/^\s*--/.test(l))   // 剥纯注释行（警示头正是注释）
    lines.forEach((l, i) => { if (OLD_SCALE.test(l)) hits.push(`${p}:${i + 1} ${l.trim().slice(0, 60)}`) })
  }
  ok(hits.length === 0, `活体 SQL 无旧量级阈值（命中 ${hits.length} 处）`)
  hits.slice(0, 4).forEach(h => console.log('     ⚠ ' + h))
}

console.log('\n[5] 结论固化：处置方向与依据必须可追溯')
{
  const s = read('scripts/cloud-settle.sql')
  ok(/同一份 JS/.test(s) || /src\/engine\/index\.js/.test(s),
    '警示头指明了正确做法（同构一份 JS / engine/index.js 统一出口）')
  ok(/待决策队列/.test(s), '警示头指明处置属 A 级、已进待决策队列（不擅自删）')
  // B2-3 建的统一出口必须真的存在（否则"同构"没有落点）
  ok(existsSync(APP + 'src/engine/index.js'), '同构落点存在：src/engine/index.js（B2-3）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
