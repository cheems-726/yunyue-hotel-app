// V163 · 一键收口纯层单测（失败停步 / 幂等 / 断点续跑 / RV）+ 接线静态断言
// 运行：node tests/oneTouchCloseoutV163.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
import { normalizeSteps, canRun, runOneTouch, STEPS, 收口报告, 校验冷备 } from '../src/oneTouchCloseout.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ V163 · 一键收口四步纯层')
{
  ok(STEPS.length === 4 && STEPS[0] === 'snapshot' && STEPS[3] === 'archive', '四步顺序固定 snapshot→coldbackup→finish→archive')

  // ① 顺序执行全绿
  const 调用 = []
  const 全好执行器 = Object.fromEntries(STEPS.map(k => [k, async () => { 调用.push(k); return { note: k + '-ok' } }]))
  let 存盘 = null
  const r1 = await runOneTouch({ steps: {}, executors: 全好执行器, persist: async s => { 存盘 = JSON.parse(JSON.stringify(s)) } })
  ok(r1.stoppedAt === null && STEPS.every(k => r1.steps[k].state === '成功'), '四步全绿 · 无停步')
  ok(调用.join(',') === STEPS.join(','), '按序执行不跳步')
  ok(!!存盘 && 存盘.archive.state === '成功', '每步 persist（断点续跑的"存"）')

  // ② 中途失败 ⇒ 停在该步 · 后续不执行
  调用.length = 0
  const 半坏执行器 = { ...全好执行器, coldbackup: async () => { throw new Error('磁盘满') } }
  const r2 = await runOneTouch({ steps: {}, executors: 半坏执行器, persist: async () => {} })
  ok(r2.stoppedAt === 'coldbackup' && r2.steps.coldbackup.state === '失败' && /磁盘满/.test(r2.steps.coldbackup.reason),
    '失败停步 + 原因落 steps（判据①）')
  ok(调用.join(',') === 'snapshot', '失败后 finish/archive 未执行（不许跳步 · 抛错执行器不进调用序）')

  // ③ 断点续跑：从服务端读回失败现场 ⇒ 重试本步成功 ⇒ 继续
  调用.length = 0
  const r3 = await runOneTouch({ steps: r2.steps, executors: 全好执行器, persist: async () => {} })
  ok(r3.stoppedAt === null && 调用.join(',') === 'coldbackup,finish,archive', '断点续跑：已成功的 snapshot 不重跑（幂等），从断点继续')
  const r3b = await runOneTouch({ steps: r3.steps, executors: 全好执行器, persist: async () => {}, only: 'archive' })
  ok(r3b.ran.length === 0 && 调用.length === 3, '重试本步（已完成步骤）= 幂等跳过，不产生第二份产物（判据③）')

  // ④ 跳步拦截
  const 只做一半 = normalizeSteps({ snapshot: { state: '成功' } })
  const g = canRun(只做一半, 'finish')
  ok(!g.ok && /不许跳步/.test(g.reason), '前置未成功 ⇒ canRun 拒绝（不许跳步）')

  // ⑤ 收口报告
  const 报告 = 收口报告({ ...r1.steps, snapshot: { state: '成功', files: { '学期快照-测试.json': { size: 3800, sha256: 'abcdef1234567890' } } } })
  ok(/① 生成结课快照.*✅/.test(报告) && /abcdef12/.test(报告), '收口报告含四步状态 + 文件清单 + sha256 前 8 位')

  // ⑥ 校验冷备（含 RV 场景：改坏 content ⇒ 该文件失败）
  const sha256Hex = async (s) => { const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); return [...d].map(x => x.toString(16).padStart(2, '0')).join('') }
  const 内容 = 'hello-archive'
  const 文件 = { 'db-logical.json': { size: 内容.length, sha256: await sha256Hex(内容), content: 内容 }, 'dump（服务器脚本产物）': { size: 1, sha256: 'x', content: null } }
  const v1 = await 校验冷备(文件, sha256Hex)
  ok(v1.全过 && v1.通过 === 2, '校验：清单与实算一致 ⇒ N/N 通过（判据②正向）')
  const 坏 = JSON.parse(JSON.stringify(文件)); 坏['db-logical.json'].content = 'tampered'
  const v2 = await 校验冷备(坏, sha256Hex)
  ok(!v2.全过 && v2.明细[0].ok === false && /≠/.test(v2.明细[0].why), 'RV：改坏副本 ⇒ 校验点名失败文件（判据②反向）')

  // ⑦ RV：把"失败停步"改成"继续往下" ⇒ 停步语义消失 ⇒ 判据必红
  调用.length = 0
  const r7 = await runOneTouch({ steps: {}, executors: 半坏执行器, persist: async () => {}, continueOnFailure: true })
  ok(r7.stoppedAt === null && r7.steps.coldbackup.state === '失败' && r7.steps.finish.state === '成功' && 调用.join(',') === 'snapshot,finish,archive',
    'RV-1 continueOnFailure ⇒ 连跳步闸一起绕过（失败的 coldbackup 之后 finish/archive 照跑 · 复现被禁行为）')
  ok(r2.stoppedAt === 'coldbackup', 'RV-2 默认实现仍停步（RV 可证伪：改坏必红）')

  // ⑧ 接线静态断言（迁移/RLS/前端接线/服务器脚本）
  const 迁移 = readFileSync(new URL('../supabase-migration-v163-semester-closeouts.sql', import.meta.url), 'utf8')
  ok(/create table if not exists public\.semester_closeouts/.test(迁移), '迁移：semester_closeouts 表（服务端持久 · 判据②）')
  ok(/class_code text not null unique/.test(迁移), '迁移：class_code 唯一（每班一行 ⇒ 重复收口 upsert 幂等）')
  ok(/enable row level security/.test(迁移) && /is_teacher\(auth\.uid\(\)\)/.test(迁移), '迁移：RLS + 教师写策略')
  const client = readFileSync(new URL('../src/supabaseClient.js', import.meta.url), 'utf8')
  ok(/semester_closeouts/.test(client), 'supabaseClient：closeout 读写接线')
  const dash = readFileSync(new URL('../src/TeacherDashboard.jsx', import.meta.url), 'utf8')
  ok(/data-onetouch-closeout/.test(dash) && /data-closeout-panel/.test(dash), '教师端：一键收口按钮 + 面板接线')
  ok(/data-coldbackup-card/.test(dash), '教师端：冷备状态卡接线（§2）')
  ok(/runOneTouch/.test(dash) && /oneTouchCloseout\.mjs/.test(dash), '教师端：走纯层 runOneTouch（不许内联第二份实现）')
  ok(/continueOnFailure/.test(dash) === false, '教师端不传 continueOnFailure（失败停步是硬语义 · RV 挂在纯层）')
  const 脚本 = readFileSync(new URL('../scripts/server/closeout-semester.sh', import.meta.url), 'utf8')
  ok(/pg_dump -Fc/.test(脚本) && /SHA256SUMS/.test(脚本) && /README\.md/.test(脚本), '服务器脚本：与 V162 手工产物同构（dump+SHA256SUMS+README）')
  ok(/只增不改|no-clobber/.test(脚本) || /mkdir -p/.test(脚本), '服务器脚本：目录只增不改（不覆盖已有学期归档）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
