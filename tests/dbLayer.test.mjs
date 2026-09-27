// 批次 B2-4 · 数据层职责抽查（T3.5）验收
// 运行：node tests/dbLayer.test.mjs   （已挂 run-all）
//
// 判据（§二十一·五 批次 B2-4）：确认"数据库侧无业务计算残留"
//   —— B2-4 当时只出结论、不删文件（删除需拍板）；★ B-2（2026-09-27 · D47-a）已拍板 ⇒ 文件已删，判据升级为【不许复活】
//
// 本套件把结论固化成【可复跑的守门】：
//   ① cloud-settle.sql 及其部署/测试脚本【已删除】（D47-a）· 任一被复原 ⇒ 红
//   ② 任何 SQL 都不得再出现"含结算变量的 PL/pgSQL 函数"（新增一处就要被看见）
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

console.log('\n[1] ① ★ B-2（D47-a 拍板）：cloud-settle.sql 已【删除】，且不许复活')
{
  // 拍板链：BL-1 否决"云端另写一套 SQL" → D8 定为【同一份 JS 两端跑】→ D47-a 代拍 (a)「按 D8 改调同一份 JS ⇒ 随后删 SQL」
  //   落点：supabase/functions/advance-day/（Edge Function，装配 engine/ 同构副本；组装脚本自带"逐字节相同"断言）
  const 已删 = ['scripts/cloud-settle.sql', 'scripts/deploy-cloud-settle.cjs', 'scripts/test-cloud-settle.cjs']
  for (const p of 已删) ok(!existsSync(APP + p), `已删除：${p}`)
  // 反向验证（R3）：文件若被复原 ⇒ 本段立刻红（下面这行是"复活即红"的判据本身）
  const 复活 = 已删.filter(p => existsSync(APP + p))
  ok(复活.length === 0, `无"复活"（命中 ${复活.length}）—— 复原任一份即报红`, 复活.join(','))
  // 更宽的判据：整个 scripts/ 与 supabase/ 不得再出现"结算型 PL/pgSQL"
  const 残留 = []
  for (const p of SQLS) {
    const s = read(p)
    if (SETTLE_MARKERS.test(s)) 残留.push(p)
  }
  ok(残留.length === 0, `全库 ${SQLS.length} 份 SQL 均无结算计算（残留 ${残留.length}）`, 残留.join(','))
  // 正确落点必须仍在（删掉 SQL 不等于删掉"不看也在跑"）
  ok(existsSync(APP + 'supabase/functions/advance-day/index.ts') && existsSync(APP + 'supabase/functions/advance-day/engine/settlement.js'),
    '替代落点存在：Edge Function（index.ts + engine/settlement.js 同构副本）')
}

console.log('\n[2] ② 业务计算的扩散：任何 SQL 都不得含结算计算')
{
  const offenders = []
  for (const p of SQLS) {
    const s = read(p)
    if (SETTLE_MARKERS.test(s)) offenders.push(p)
  }
  ok(offenders.length === 0, `${SQLS.length} 份 SQL 均不含结算计算${offenders.length ? ' → 残留：' + offenders.join(', ') : ''}`)
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

console.log('\n[4] ④ 旧口径阈值不得以"活体 SQL"形式存在')
{
  const hits = []
  for (const p of SQLS) {
    const lines = read(p).split(/\r?\n/).filter(l => !/^\s*--/.test(l))
    lines.forEach((l, i) => { if (OLD_SCALE.test(l)) hits.push(`${p}:${i + 1} ${l.trim().slice(0, 60)}`) })
  }
  ok(hits.length === 0, `活体 SQL 无旧量级阈值（命中 ${hits.length} 处）`)
  hits.slice(0, 4).forEach(h => console.log('     ⚠ ' + h))
}

console.log('\n[5] 结论固化：处置方向与依据必须可追溯（SQL 已删 ⇒ 依据改由【文档 + 替代落点】承担）')
{
  // B-2：SQL 本体已按 D47-a 删除 ⇒ "处置依据"不能再挂在被删文件上（那会变成查不到依据）。
  //   依据改为两处【仍然存在】的地方：① 决策登记册的 BL-1/D8/D47-a；② 替代落点 src/engine/index.js 的注释。
  const barrel = read('src/engine/index.js')
  ok(/同一份 JS|同构/.test(barrel), 'engine/index.js 写明【同一份 JS 两端跑】的同构方向（依据落点①）')
  ok(existsSync(APP + 'src/engine/index.js'), '同构落点存在：src/engine/index.js（B2-3）')
  ok(existsSync(APP + 'scripts/build-edge-function.mjs'), '组装脚本存在：scripts/build-edge-function.mjs（D8 落地的最后一公里）')
  const 登记册 = read('../1-总纲与进度/决策登记册.md')
  ok(/D47-a|cloud-settle/.test(登记册), '决策登记册留有 D47-a / cloud-settle 的处置记录（依据落点② · 决策端维护）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
