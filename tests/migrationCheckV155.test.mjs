// V155 §1 · 迁移检查（纯层单测 + deploy 接线静态断言 + 判据②③④ 的本地等价验证）
// 运行：node tests/migrationCheckV155.test.mjs   （挂 run-all fast；deploy 真跑属审计端）
import { readFileSync, writeFileSync, unlinkSync, existsSync, readdirSync } from 'node:fs'
import { 扫描声明, checkMigrations, 结论文本 } from '../scripts/server/migrationCheck.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ V155 · 部署第⑥步迁移检查')
{
  // ① 扫描真仓库的迁移文件
  const 文件们 = readdirSync('.').filter(f => /^supabase-migration-.*\.sql$/.test(f)).sort()
  ok(文件们.length >= 4, `仓库含 ${文件们.length} 个迁移文件（≥4）`, 文件们.join(','))
  const 声明们 = 文件们.flatMap(f => 扫描声明(f, readFileSync(f, 'utf8')))
  ok(声明们.length >= 8, `共抽 ${声明们.length} 条声明（列/表 + 策略）`)
  const v152 = 扫描声明('supabase-migration-v152-continue.sql', readFileSync('supabase-migration-v152-continue.sql', 'utf8'))
  ok(v152.length === 1 && v152[0].table === 'class_state' && v152[0].name === 'continue_enabled' && v152[0].level === 'block',
    'v152-continue ⇒ 期望 class_state.continue_enabled（block 级）', JSON.stringify(v152))
  // 注释里的 drop column 不算声明（剥注释）
  ok(v152.length === 1, '注释里的 `drop column` 不被当声明（剥注释后 0 命中）')

  // ② 全部存在 ⇒ 「迁移 ✓ 已应用 N/N 项」
  const 全库 = new Set()
  for (const d of 声明们) 全库.add(`${d.table}.${d.name}`)
  全库.add(d => d)  // noop
  const 库全 = { columns: new Set(声明们.filter(d => d.kind === 'column').map(d => `${d.table}.${d.name}`)), tables: new Set(声明们.filter(d => d.kind === 'table').map(d => d.table)), policies: new Set(声明们.filter(d => d.kind === 'policy').map(d => `${d.table}.${d.name}`)) }
  const c1 = checkMigrations(声明们, 库全)
  ok(c1.missing.length === 0 && c1.applied === 声明们.length, `判据①等价：全部存在 ⇒ applied ${c1.applied}/${声明们.length}`)
  ok(/迁移 ✓ 已应用/.test(结论文本(c1, 声明们.length)), '结论文本 =「迁移 ✓ 已应用 N/N 项」')

  // ③ 造缺失 ⇒ missing 非空 + 结论列出 列与文件（deploy 由此 die）
  const 探针 = [{ file: 'supabase-migration-zzz-test.sql', kind: 'column', table: 'class_state', name: '__probe__', level: 'block' }]
  const c2 = checkMigrations([...声明们, ...探针], 库全)
  ok(c2.missing.length === 1 && c2.missing[0].name === '__probe__', '判据②等价：造未应用迁移 ⇒ missing 恰 1 条（deploy 非 0 退出的数据源）')
  ok(/class_state\.__probe__（supabase-migration-zzz-test\.sql）/.test(结论文本(c2, c2.applied + c2.missing.length + c2.warned.length)), '结论打印 缺失列 + 对应 .sql 文件路径')

  // policy 缺失只告警
  const pol = [{ file: 'x.sql', kind: 'policy', table: 't', name: 'p1', level: 'warn' }]
  const c3 = checkMigrations(pol, { columns: new Set(), tables: new Set(), policies: new Set() })
  ok(c3.missing.length === 0 && c3.warned.length === 1, '策略缺失 ⇒ 只告警不阻断（level: warn）')

  // deploy 接线静态断言
  const dep = readFileSync(new URL('../scripts/server/deploy.mjs', import.meta.url), 'utf8')
  ok(/step\('⑥', '迁移检查/.test(dep), 'deploy 有第⑥步「迁移检查」（第⑤登录自检之后）')
  ok(/MIGRATIONS_ALLOW_MISSING === '1'/.test(dep) && /if \(结论\.missing\.length && !MIG_ALLOW\)/.test(dep), '默认阻断 · MIGRATIONS_ALLOW_MISSING=1 才放行（判据③）')
  ok(/information_schema\.columns/.test(dep) && /pg_policies/.test(dep), '查库走 information_schema + pg_policies（既有 ssh 通道）')
  ok(/迁移 \$\{迁移注\}/.test(dep), 'VERSIONS.md 每条记录带「迁移：N/M 已应用」（卡 §1 附加要求）')
}

// RV（源码级）：摘掉第⑥步的 die ⇒ 静态断言红
{
  const P = 'scripts/server/deploy.mjs', BAK = 'scripts/_rv155.bak'
  let s = readFileSync(P, 'utf8')
  const 锚 = "if (结论.missing.length && !MIG_ALLOW) {"
  if (!锚) { ok(false, 'RV 锚存在'); }
  else {
    const { copyFileSync } = await import('node:fs')
    copyFileSync(P, BAK)
    s = s.replace(锚, "if (false && 结论.missing.length && !MIG_ALLOW) {")
    writeFileSync(P, s, 'utf8')
    const s2 = readFileSync(P, 'utf8')
    ok(!/if \(结论\.missing\.length && !MIG_ALLOW\) \{\n *die/.test(s2), 'RV-1 摘掉第⑥步阻断 ⇒ 静态断言红（deploy 不再非 0 退出）')
    copyFileSync(BAK, P); unlinkSync(BAK)
    ok(/if \(结论\.missing\.length && !MIG_ALLOW\) \{\n *die/.test(readFileSync(P, 'utf8')), 'RV-2 还原后复绿')
  }
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
