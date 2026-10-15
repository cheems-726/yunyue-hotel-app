#!/usr/bin/env node
// V108⑤：12 周逐日真结算彩排（**不跳天**：每天 offset+1 → 立刻 tick）→ 产出 12 周 × 组 汇总表
//   用法（测试机）：node rehearsal.mjs [目标末天=84]
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
const REST = 'http://127.0.0.1:3000'
const SR = JSON.parse(readFileSync('/opt/yunyue/etc/keys.json', 'utf8')).service_role
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' }
const j = async r => { const t = await r.text(); return t ? JSON.parse(t) : null }
const get = async p => { const r = await fetch(REST + p, { headers: H }); if (!r.ok) throw new Error(p + ' ' + r.status); return j(r) }
const patch = async (p, b) => { const r = await fetch(REST + p, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(b) }); if (!r.ok) throw new Error(p + ' ' + r.status + ' ' + (await r.text())) }
const TARGET = Number(process.argv[2] || 84)

const start = (await get('/class_state?select=teacher_offset_days&id=eq.1'))[0].teacher_offset_days
const day0 = Number((await get('/rpc/class_day_now')).value ?? (await get('/rpc/class_day_now')))

let day = day0
let 推进 = 0, 失败 = 0
const t0 = Date.now()
while (day < TARGET) {
  const [cs] = await get('/class_state?select=teacher_offset_days&id=eq.1')
  await patch('/class_state?id=eq.1', { teacher_offset_days: Number(cs.teacher_offset_days) + 1 })   // ★ 一次只 +1 天
  const r = spawnSync('node', ['/opt/yunyue/tick/tick.mjs'], { encoding: 'utf8', cwd: '/opt/yunyue/tick' })  // ★ 立刻真结算这一天
  if (r.status !== 0) { 失败++; console.log('  tick 失败 @day' + (day + 1) + ': ' + (r.stderr || '').slice(0, 160)); }
  day++; 推进++
  if (推进 % 7 === 0) process.stdout.write(`  已推进 ${推进} 天（classDay=${day}）\n`)
}
const 秒 = ((Date.now() - t0) / 1000).toFixed(1)
console.log(`\n彩排完成：推进 ${推进} 天 · tick 失败 ${失败} · 墙钟 ${秒}s`)

// ── 汇总表：12 周 × 各组 ──
const rows = await get('/game_states?select=group_key,user_id,week,state&order=group_key.asc')
const GROUPS = ['酒管2401|1', '酒管2401|2', '酒管2401|3', '酒管2401|4', '酒管2401|5', '酒管2401|6']
console.log('\n【12 周 × 6 组 · 每周权威结算（capital / 净利 / 出租率 / 罚款 / 事件数）】')
console.log('周次 | ' + GROUPS.map(g => g.replace('酒管2401|', 'G')).join(' | '))
for (let w = 1; w <= 12; w++) {
  const cells = GROUPS.map(gk => {
    const row = rows.find(r => r.group_key === gk)
    const h = (row?.state?.history || []).find(x => x.week === w)
    if (!h) return '—'
    return `${(h.capital / 10000).toFixed(1)}万/${(h.netProfit / 10000).toFixed(1)}万/${h.occupancy}%/${h.eventFine || 0}/${(h.events || []).length}`
  })
  console.log(`W${String(w).padStart(2)}  | ` + cells.join(' | '))
}
console.log('\n各组 history 长度 / week：')
for (const gk of GROUPS) {
  const row = rows.find(r => r.group_key === gk)
  const h = row?.state?.history || []
  const 完整性 = h.map(x => x.week).join(',')
  console.log(`  ${gk}: hist=${h.length} · week=${row?.week} · 周次串=[${完整性}]`)
}
