#!/usr/bin/env node
// V108-R1/R2：快进驱动器（**唯一推进手段**）
//   只改 teacher_offset_days（class_day_now() 的既有旋钮）→ **随后立刻 tick**（真结算这一天）
//   R2：一次只 +1 天；落后多天则**逐天循环**（+1 → tick → 再 +1），**绝不一次跳多天**
//   R5：pacing 留档（mode/day_seconds/起止/累计推进）写在 class_state.pacing
// 用法：DAY_SECONDS=30 node pace.mjs          （快进档：1 游戏日=30s）
//       DAY_SECONDS=514 node pace.mjs         （课堂档：≈8.57 分钟/日 ⇒ 1 周≈1 小时）
//       node pace.mjs --once                  （只推 1 天，供编排/测试）
//   切回 1 日=1 日：DAY_SECONDS=86400（或停 yunyue-pace.timer 并复原 teacher_offset_days）
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const REST = 'http://127.0.0.1:3000'
const SR = JSON.parse(readFileSync('/opt/yunyue/etc/keys.json', 'utf8')).service_role
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' }
const ONCE = process.argv.includes('--once')
const j = async (r) => { const t = await r.text(); return t ? JSON.parse(t) : null }
const get = async (p) => { const r = await fetch(REST + p, { headers: H }); if (!r.ok) throw new Error('GET ' + p + ' ' + r.status); return j(r) }
const patch = async (p, b) => { const r = await fetch(REST + p, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(b) }); if (!r.ok) throw new Error('PATCH ' + p + ' ' + r.status + ' ' + (await r.text())) }

const [cs] = await get('/class_state?select=teacher_offset_days,start_date,pacing&id=eq.1')
const pacing = cs.pacing || {}
const DAY_SECONDS = Number(process.env.DAY_SECONDS || pacing.day_seconds || 30)
const NOW = Date.now()

/** 推 1 天：offset+1 → 立刻 tick（这一天的真结算） */
function advanceOneDay() {
  const r = spawnSync('node', ['/opt/yunyue/tick/tick.mjs'], { encoding: 'utf8', cwd: '/opt/yunyue/tick' })
  return { ok: r.status === 0, out: (r.stdout || '').trim().slice(0, 200), err: (r.stderr || '').trim().slice(0, 200) }
}

let 推进 = 0
if (ONCE) {
  const off = Number((await get('/class_state?select=teacher_offset_days&id=eq.1'))[0].teacher_offset_days)
  await patch('/class_state?id=eq.1', { teacher_offset_days: off + 1 })
  const t = advanceOneDay()
  await patch('/class_state?id=eq.1', { pacing: { ...pacing, mode: 'manual-1day', day_seconds: DAY_SECONDS, last_advance_at: NOW, updated_at: new Date().toISOString(), 累计推进: (pacing.累计推进 || 0) + 1 } })
  console.log(JSON.stringify({ ok: t.ok, advanced: 1, day_seconds: DAY_SECONDS, tick: t.out }))
} else {
  const lastAt = Number(pacing.last_advance_at || 0) || NOW          // 首次：从"现在"起算（不补历史）
  let due = Math.floor((NOW - lastAt) / (DAY_SECONDS * 1000))
  if (due > 84) due = 84                                            // 安全上限：最多补 12 周
  let cursor = lastAt
  for (let i = 0; i < due; i++) {
    const off = Number((await get('/class_state?select=teacher_offset_days&id=eq.1'))[0].teacher_offset_days)
    await patch('/class_state?id=eq.1', { teacher_offset_days: off + 1 })   // ★ 一次只 +1
    const t = advanceOneDay()                                              // ★ 随后立刻 tick
    cursor += DAY_SECONDS * 1000
    推进++
    if (!t.ok) { console.log(JSON.stringify({ ok: false, at: i, tick: t.out, err: t.err })); process.exit(1) }
  }
  await patch('/class_state?id=eq.1', { pacing: { ...pacing, mode: pacing.mode || (DAY_SECONDS <= 60 ? '快进档' : '课堂档'), day_seconds: DAY_SECONDS, last_advance_at: 推进 ? cursor : lastAt, updated_at: new Date().toISOString(), 累计推进: (pacing.累计推进 || 0) + 推进, 本次推进: 推进 } })
  console.log(JSON.stringify({ ok: true, day_seconds: DAY_SECONDS, 本次推进: 推进, offsetNow: (await get('/class_state?select=teacher_offset_days&id=eq.1'))[0].teacher_offset_days }))
}
