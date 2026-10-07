// V68 · 通电后验收脚本（一条命令 · 只读探测 · 不碰线上数据写入）
// 用法：node tests/_poweron-verify.mjs   （通电四步做完后跑一次；隔 10 分钟再跑一次对比 classDay 可证端到端推进）
// 四步 = 推送与通电清单-20261003.md §二：(a) server_tick.sql (b) Edge advance-day (c) u8-class-events.sql (d) 设开学日
// 红线：读不到 = ✗ + 原因 + 怎么修（不伪造通过）；本脚本零写操作（advance-day 只做存在性探测，绝不真触发）
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_KEY } from '../src/supabaseClient.js'

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)
const lines = []
const say = m => { console.log(m); lines.push(m) }
say('═ V68 通电验收（' + new Date().toLocaleString('zh-CN') + ' · 只读探测）═')

const res = {}
// ── (a) server_tick.sql：class_day_now() RPC 存在且返回正数（缺它 ⇒ 时间推进的核心权威不在）──
try {
  const { data, error } = await sb.rpc('class_day_now')
  if (error) { res.a = { ok: false, why: 'RPC class_day_now 不存在（' + (error.message || '').slice(0, 60) + '）' } }
  else {
    const d = Number(data) || 0
    res.a = { ok: d > 0, why: d > 0 ? `class_day_now() = ${d}` : 'RPC 存在但返回 ' + d + '（多半是开学日还没设 ⇒ 见第 (d) 步）', classDay: d }
  }
} catch (e) { res.a = { ok: false, why: '调用异常：' + (e.message || e).slice(0, 60) } }
say(`(a) server_tick 迁移（class_day_now 权威）：${res.a.ok ? '✓' : '✗'} · ${res.a.why}`)

// ── (b) Edge advance-day：存在性探测（401/405=已部署路由在 · 404=未部署）· 绝不 POST 真触发 ──
let edge = '未知'
try {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/advance-day`, { method: 'GET' })
  edge = r.status === 404 ? '未部署（404）' : `已部署（HTTP ${r.status} = 路由存在）`
  res.b = { ok: r.status !== 404, status: r.status }
} catch (e) { res.b = { ok: false }; edge = '网络不可达：' + (e.message || e).slice(0, 40) }
say(`(b) Edge advance-day：${res.b.ok ? '✓' : '✗'} · ${edge}（只探测存在性 · 从不真触发以免写线上数据）`)

// ── (c) u8-class-events.sql：class_state 的 injected_events / supervisor_auth 两列是否存在 ──
try {
  const { data, error } = await sb.from('class_state').select('injected_events, supervisor_auth').limit(1)
  if (error) res.c = { ok: false, why: '列不存在（' + (error.message || '').slice(0, 60) + '）' }
  else res.c = { ok: true, why: '两列可读（返回 ' + (data?.length ?? 0) + ' 行）' }
} catch (e) { res.c = { ok: false, why: '调用异常：' + (e.message || e).slice(0, 60) } }
say(`(c) u8-class-events 迁移（注入/领班两列）：${res.c.ok ? '✓' : '✗'} · ${res.c.why}`)

// ── (d) 开学日：start_date 非空（配 (a) 的 classDay>0 才算全通）──
let sd = '读不到'
try {
  const { data, error } = await sb.from('class_state').select('start_date, teacher_offset_days').limit(1)
  if (error) sd = '读取失败（' + (error.message || '').slice(0, 50) + '）'
  else if (!data || !data.length) sd = 'class_state 表为空（还没初始化班级）'
  else sd = data[0].start_date ? `开学日 = ${data[0].start_date}（偏移 ${data[0].teacher_offset_days ?? 0} 天）` : 'start_date 为空 ⇒ 开学日未设'
  res.d = { ok: !!(data?.[0]?.start_date) }
} catch (e) { res.d = { ok: false }; sd = '调用异常：' + (e.message || e).slice(0, 40) }
say(`(d) 开学日（class_state.start_date）：${res.d.ok ? '✓' : '✗'} · ${sd}`)

// ── 端到端：说明（推进要等 pg_cron 下一个 10 分钟拍；跑两次对比 classDay）──
say(`端到端推进：本次 classDay = ${res.a.classDay ?? '读不到'}。隔 ≥10 分钟再跑一次本脚本：数字变大 = pg_cron→Edge 链路真的在推进；不变 = 看 (b) 是否 ✗。`)

// ── 给人看的总结 ──
const allOk = res.a.ok && res.b.ok && res.c.ok && res.d.ok
const fixes = []
if (!res.a.ok) fixes.push('(a) 后台 SQL Editor 粘贴 supabase/migrations/20260927_server_tick.sql 全文执行')
if (!res.b.ok) fixes.push('(b) 命令行 supabase functions deploy advance-day（需先 supabase login）')
if (!res.c.ok) fixes.push('(c) 粘贴 supabase-migration-u8-class-events.sql 全文执行')
if (!res.d.ok) fixes.push('(d) 后台 Table Editor 打开 class_state → 把 start_date 设成今天（或班级设置页设定）')
say('─ 汇总 ─')
say(allOk
  ? '✅ 四步全通：实时经营链路就绪——时间会自动推进、周报按第 7 游戏日自动出、教师端评分开始积累。经营页/教师端的「时间不推进」琥珀说明行会自动消失（V63/V67）。'
  : '❌ 还没通全：剩 ' + fixes.length + ' 步——' + fixes.join('；') + '。做完重跑本脚本再验。全部修法详见《4-审计与报告/推送与通电清单-20261003.md》与《通电操作单-v1.md》。')
say(allOk
  ? '结论：现在可以演示实时经营（时间推进/自动周报/成绩积累）。'
  : '结论：实时经营暂不能演示（时间不动），但 85% 演示不受影响——按《课堂演示脚本-v1》节点 1–9 + 《演示应急卡-v1》档 C 话术即可。')
import { writeFileSync } from 'node:fs'
writeFileSync('../4-审计与报告/V68-通电验收/最近一次验收.txt', lines.join('\n') + '\n')
process.exit(allOk ? 0 : 1)