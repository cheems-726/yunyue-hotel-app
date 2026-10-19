#!/usr/bin/env node
// V106-A1 / R5：host 端的 advance-day（替代云端 pg_cron + Edge Function）
//   · 与 supabase/functions/advance-day/{index.ts,db.ts} **逐行等价**（本文件只做 IO，不含任何结算计算）
//   · 引擎用 **同一份组装物** ./engine/（由 scripts/build-edge-function.mjs 从 src/ 机械搬运）
//   · ★ V127-#1：本文件是服务器 /opt/yunyue/tick/tick.mjs 的【唯一来源】。
//     禁止在服务器上直接手改（必须先进这个仓库、再由审计端部署）。
//   · 流水：只在 advanced=true 或 violations>0 时写 server_tick_log；键用 tickLogKey（分钟戳），
//     撞键 ⇒ console.warn + duplicates 计数（不再静默）。
// 用法：node tick.mjs [--dry]
import { readFileSync } from 'node:fs'
import { advanceGroupOneDay, tickLogKey, TICK_VERSION } from './engine/serverTick.mjs'

const CONF = process.env.YUNYUE_CONF || '/opt/yunyue/etc/keys.json'
const REST = process.env.YUNYUE_REST || 'http://127.0.0.1:3000'
const DRY = process.argv.includes('--dry')
const SR = JSON.parse(readFileSync(CONF, 'utf8')).service_role
const H = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' }

const j = async (r) => { const t = await r.text(); return t ? JSON.parse(t) : null }

// ── 与 db.ts classDayNow 等价 ──
function classDayNow(cls) {
  if (!cls || !cls.start_date) return 0
  const start = new Date(cls.start_date + 'T00:00:00Z')
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')
  const days = Math.floor((today - start) / 86400000) + 1
  return Math.max(1, days + (Number(cls.teacher_offset_days) || 0))
}

async function readClassState() {
  let r = await fetch(REST + '/class_state?select=current_week,start_date,teacher_offset_days,injected_events&id=eq.1', { headers: H })
  if (r.ok) return (await j(r))[0] || null
  r = await fetch(REST + '/class_state?select=current_week,start_date,teacher_offset_days&id=eq.1', { headers: H })
  if (!r.ok) throw new Error('读 class_state 失败：' + r.status)
  return (await j(r))[0] || null
}

/** 组档优先于个人档（与前端 groupKeyOf 同口径） */
async function readGroups() {
  const r = await fetch(REST + '/game_states?select=user_id,group_key,state,week,finished', { headers: H })
  if (!r.ok) throw new Error('读 game_states 失败：' + r.status)
  const rows = await j(r)
  const byGroup = new Map()
  for (const row of rows || []) {
    if (row.group_key) { if (!byGroup.has(row.group_key)) byGroup.set(row.group_key, row) }
    else byGroup.set('solo:' + row.user_id, row)
  }
  return [...byGroup.values()]
}

/** 只写结果字段，不碰归属（组档不携带 user_id —— 与前端 saveGameState 同纪律） */
async function writeGroupState(group, save) {
  const base = { state: save, week: save.week || 1, finished: !!save.finished, updated_at: new Date().toISOString() }
  const q = group.group_key
    ? '/game_states?group_key=eq.' + encodeURIComponent(group.group_key)
    : '/game_states?user_id=eq.' + encodeURIComponent(group.user_id)
  const r = await fetch(REST + q, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(base) })
  if (!r.ok) throw new Error('写档失败：' + r.status + ' ' + (await r.text()))
}

/** 审计流水（键带分钟戳）；撞键 = 同一分钟重复调用 ⇒ warn + 返回 duplicate（不再静默） */
async function writeTickLog({ tick_key, class_day, group_key, result, ok }) {
  if (DRY) return { inserted: false, duplicate: false }
  const r = await fetch(REST + '/server_tick_log', {
    method: 'POST', headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify({ tick_key, class_day, group_key, result, ok }),
  })
  if (!r.ok) {
    const b = await r.text()
    if (/23505|duplicate key/.test(b)) {
      console.warn(`[tick] 流水撞键（同一分钟重复调用）：tick_key=${tick_key} group=${group_key} class_day=${class_day}`)
      return { inserted: false, duplicate: true }
    }
    throw new Error('写 server_tick_log 失败：' + r.status + ' ' + b)
  }
  return { inserted: true, duplicate: false }
}

/** ★ V107-E3：结算前**不可变**快照（insert-only、**无 conflict target** ⇒ 同日重跑只追加、绝不覆盖）。
 *  为什么必须写在 writeGroupState **之前**：tick 会改写 capital/attrs/history —— 事后再存就只剩"结算后"的值，
 *  等于没有回滚点（D295 实测反驳了"archive_daily 可回溯"：它是 on conflict do update ⇒ 同日覆盖）。 */
async function writePreSettleSnapshot({ tick_key, group }) {
  const s = group.state || {}
  const r = await fetch(REST + '/pre_settle_snapshots', {
    method: 'POST', headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify({
      tick_key,
      group_key: group.group_key || null,
      user_id: group.user_id || null,
      week: group.week ?? null,
      capital_before: s.capital ?? null,
      history_len_before: Array.isArray(s.history) ? s.history.length : 0,
      state_before: s,
    }),
  })
  if (!r.ok) throw new Error('写 pre_settle_snapshots 失败：' + r.status + ' ' + (await r.text()))
}

async function main() {
  const cls = await readClassState()
  const classDay = classDayNow(cls)
  if (!classDay || classDay < 1) { console.log(JSON.stringify({ ok: true, skipped: '班级未开学（class_state.start_date 未设置）', classDay: 0 })); return }
  const groups = await readGroups()
  const allInjections = Array.isArray(cls?.injected_events) ? cls.injected_events : []
  const out = []
  let duplicates = 0
  const 记流水 = async (args) => { const L = await writeTickLog(args); if (L && L.duplicate) duplicates++; return L }
  for (const g of groups) {
    const save = g.state || {}
    const gk = g.group_key || g.user_id
    const injections = allInjections.filter(e => e && (!Array.isArray(e.targets) || e.targets.includes(gk)))
    const r = advanceGroupOneDay(save, classDay, { groupKey: gk, injectedEvents: injections.length ? injections : null })
    out.push({ group: gk, advanced: r.advanced, gated: r.gated || false, gate: r.gate || null, week: r.week, dayIndex: r.dayIndex, 决策数: r.决策数, violations: r.violations })
    // ★ V127-#1：一次调用一个流水键（分钟戳）—— 旧 tickKey 已被历史轮次占满，导致日志整轮被静默吞掉
    const logKey = tickLogKey(classDay, gk)
    if (r.violations && r.violations.length) {
      await 记流水({ tick_key: logKey, class_day: classDay, group_key: gk, result: { violations: r.violations, engineVersion: TICK_VERSION }, ok: false })
      continue
    }
    if (!DRY && r.advanced && r.save) {
      await writePreSettleSnapshot({ tick_key: logKey, group: g })   // ★ V107-E3：先落不可变快照，再改档
      await writeGroupState(g, r.save)
    }
    // ★ V127-#1：只在【真结算】时写流水（无推进/被前置闸拦下的日子不写）
    if (!DRY && r.advanced) {
      await 记流水({ tick_key: logKey, class_day: classDay, group_key: gk, result: { advanced: r.advanced, week: r.week, dayIndex: r.dayIndex, 决策数: r.决策数, 决策来源: r.决策来源, engineVersion: TICK_VERSION }, ok: true })
    }
  }
  console.log(JSON.stringify({ ok: true, classDay, groups: out.length, advanced: out.filter(x => x.advanced).length, gated: out.filter(x => x.gated).length, duplicates, dry: DRY, engineVersion: TICK_VERSION, detail: out }))
}
main().catch(e => { console.error(JSON.stringify({ ok: false, error: String(e && e.message || e) })); process.exit(1) })
