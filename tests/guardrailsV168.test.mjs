// V168 · 护栏三修 —— §1 教师 guard + RLS 迁移 · §2 账本写入无条件 + failedSuites · §3 单行探针
// 运行：node tests/guardrailsV168.test.mjs   （挂 run-all fast）
import { readFileSync, existsSync } from 'node:fs'
import { 扫描声明, checkMigrations } from '../scripts/server/migrationCheck.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ V168 · 护栏三修')
{
  // §1 客户端 guard（两个保存路径 + 命名写路径）
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  ok(app.split("V168§1").length >= 3, 'App 保存 effect 与命名路径都有教师 guard（防双击口径：guard 数 ≥2 处）')
  ok(/if \(user\.role && user\.role !== 'student'\) return\s*\/\/ ★ V168§1/.test(app), '防抖保存 effect：role=teacher 直接 return（判据①客户端半）')
  ok(/教师账号不写学生经营档/.test(app), '命名写路径：教师显式拒（toast）')
  // RV：去掉 guard ⇒ 上面断言红（本行断言 guard 存在即 RV 的机器形态）

  // §1 数据侧双保险（迁移 · 待审计端过审实施）
  const mig = readFileSync(new URL('../supabase-migration-v168-game-states-student-only.sql', import.meta.url), 'utf8')
  ok(/drop policy if exists game_states_self/.test(mig) && /with check \(/.test(mig), '迁移：重建 game_states_self（含写者角色判据）')
  ok(/= 'student'/.test(mig) && /profiles p where p\.user_id = auth\.uid\(\)/.test(mig), '写判据 = profiles.role 必须 student（等价判据 · jwt role 恒 authenticated 不可用）')
  ok(/回滚（如需）/.test(mig) && /using \(auth\.uid\(\) = user_id\) with check \(auth\.uid\(\) = user_id\);/.test(mig), '迁移附回滚语句（红线）')

  // §2 账本写入无条件（D352）
  const ra = readFileSync(new URL('./run-all.mjs', import.meta.url), 'utf8')
  ok(/failedSuites: 失败套件名/.test(ra), '记录新增 failedSuites 字段（失败套件名列表）')
  ok(!/if \(!failed \|\| 仅本套件失败\) \{/.test(ra) && /if \(true\) \{/.test(ra), '写入不再被"全绿/仅文档失败"条件把门（判据①：造假失败 ⇒ 记录仍更新）')
  ok(/仅文档套件失败\) \? total \+ totalFail : total/.test(ra), '文档类自指失败仍按"修好后应有值"计数（防 docs-sync 自指死锁 · 原语义保留）')
  // RV：把写入放回旧条件 ⇒ 上面第二断言红（机器形态 = 断言旧条件必须不存在）

  // §3 单行探针（#216 补验 · 本地等价验证；⑥ 真跑归审计端）
  // ★ #232§4：单行探针已由审计端真跑并删除（取证在 审查回执；本套件改为内联探针保住等价验证）
  ok(!existsSync(new URL('../supabase-migration-zzz-probe.sql', import.meta.url)), '探针文件已删（⑥ 真跑完成 · 复跑 13/13 exit 0）')
  const d = 扫描声明('supabase-migration-zzz-probe.sql', 'alter table public.class_state add column if not exists __probe_v168__ text;')
  ok(d.length === 1 && d[0].table === 'class_state' && d[0].name === '__probe_v168__', '单行写法 ⇒ 扫描声明恰 1 条（内联探针 · 不再蒸发）')
  const r = checkMigrations(d, { columns: new Set(), tables: new Set(), policies: new Set() })
  ok(r.missing.length === 1, '库内无此列 ⇒ missing 恰 1 ⇒ deploy ⑥ 将非 0 退出（判据①）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
