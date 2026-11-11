// V191 · A 步 rev 乐观锁（静态守门）
// 判据：迁移在位 / 读带 rev / 写带条件 / 冲突可见（不重试不覆盖）/ 连三暂停 / tick 必须推进 rev / 文案红线
import { readFileSync, existsSync } from 'node:fs'
const rd = (p) => { try { return readFileSync(new URL(p, import.meta.url), 'utf8') } catch { return '' } }
let pass = 0, fail = 0
const ok = (c, n, x = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (x ? '  [' + x + ']' : '')) } }
console.log('▶ V191 · rev 乐观锁')
const sql = rd('../supabase-migration-v191-game-states-rev.sql')
ok(existsSync(new URL('../supabase-migration-v191-game-states-rev.sql', import.meta.url)), '迁移文件存在')
ok(/ADD COLUMN IF NOT EXISTS rev integer NOT NULL DEFAULT 0/i.test(sql), '迁移：rev 列（幂等 + 非空默认 0）')
ok(/UPDATE public\.game_states SET rev = 0 WHERE rev IS NULL/i.test(sql), '迁移：历史行兜底归零')
const sc = rd('../src/supabaseClient.js')
ok(/export async function fetchGameStateRow/.test(sc) && /select\('state,rev'\)/.test(sc), '读：fetchGameStateRow 带 rev')
ok(/eq\('rev', 旧\)/.test(sc) && /rev: 旧 \+ 1/.test(sc), '写：条件更新 ?rev=eq.N 且 body rev=N+1')
ok(/conflict: true/.test(sc) && /data\.length === 0/.test(sc), '写：0 行 ⇒ conflict=true（不重试不覆盖）')
ok(/filterLock/.test(sc) && /return=representation/.test(sc), '关页冲刷同样走 rev 条件 + 可数返回')
const app = rd('../src/App.jsx')
ok(/async function 处理冲突/.test(app), '冲突处理函数存在')
ok(/fetchGameStateRow\(user\.uid, gk\)/.test(app) && /应用云端档\(云端档\)/.test(app), '冲突①重拉云端 ②覆盖本机')
ok(/decisionId: '__sync__'/.test(app), '冲突③证据：写进经营操作记录')
const 文案 = /轻: '([^']+)'[\s\S]*?保存: '([^']+)'[\s\S]*?连三: '([^']+)'/.exec(app)
ok(!!文案, '冲突文案三档在位')
if (文案) {
  const 全 = 文案[1] + 文案[2] + 文案[3]
  ok(!/冲突|CAS|409|被覆盖|请刷新页面/.test(全), '文案红线：无「冲突/CAS/409/被覆盖/请刷新页面」', 全)
  ok(/暂停自动同步 30 秒/.test(文案[3]), '连三文案含暂停 30 秒')
}
ok(/冲突计数\.current >= 3/.test(app) && /暂停同步至\.current = Date\.now\(\) \+ 30000/.test(app), '连续 3 次 ⇒ 暂停 30 秒')
ok(/if \(Date\.now\(\) < 暂停同步至\.current\) return/.test(app), '暂停窗口内不推')
const tick = rd('../scripts/host/tick.mjs')
ok(/select=user_id,group_key,state,week,finished,rev/.test(tick) && /rev: \(Number\(group\.rev\) \|\| 0\) \+ 1/.test(tick), 'tick（repo）：读 rev + 写 rev+1')
const edge = rd('../supabase/functions/advance-day/db.ts')
ok(/select\('user_id, group_key, state, week, finished, rev'\)/.test(edge) && /rev: \(Number\(group\.rev\) \|\| 0\) \+ 1/.test(edge), 'edge advance-day：读 rev + 写 rev+1')
// B 步不混：脏标记与 rev 是两件事
ok(/if \(!脏版本\.current\) return/.test(app) && /云端rev\.current/.test(app), '脏标记（B 步）与 rev（A 步）分开存在')
console.log(`结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
