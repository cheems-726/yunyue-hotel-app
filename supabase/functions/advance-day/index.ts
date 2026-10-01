// Supabase Edge Function · advance-day（Wave 1 · W1-1）
//
// ── 职责边界（★ 硬约束 D8：不许在本文件里写业务计算）────────────────
//   本文件【只做三件事】：
//     ① 读库：班级 classDay + 各组存档（service_role）
//     ② 调逻辑：把每组交给 src/serverTick.mjs 的 advanceGroupOneDay()
//     ③ 写回：把结果写进 game_states.state + 记 server_tick_log（幂等键）
//   ⇒ 结算计算【全部】在 ./engine/ 里（部署脚本从 src/ 自动组装，与浏览器同一份源码）。
//     本文件里出现任何 occupancy/profit/公式 之类的算式，都算违规（有测试守着）。
//
// ── 幂等（W1-2）───────────────────────────────────────────────────
//   幂等键 = tickKey(classDay, groupKey)。写 server_tick_log 时用主键冲突兜底：
//   同一天重复触发 → 该周已在 history 里 → advanceGroupOneDay 返回 advanced=false → 不重复结算。
//
// ── 触发 ──────────────────────────────────────────────────────────
//   pg_cron 每 10 分钟 POST 一次（见 supabase/migrations/*_server_tick.sql）。
//   也支持手动调用：POST /functions/v1/advance-day?dry=1 只算不写（供巡检）。

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { advanceGroupOneDay, tickKey, TICK_VERSION } from './engine/serverTick.mjs'
import { classDayNow, readGroups, readClassState, writeGroupState, writeTickLog } from './db.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const url = new URL(req.url)
  const dry = url.searchParams.get('dry') === '1'

  const supa = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  )

  try {
    // ① 读库：classDay 的唯一权威在服务端（客户端不参与判定）
    const cls = await readClassState(supa)
    const classDay = classDayNow(cls)
    if (!classDay || classDay < 1) {
      return json({ ok: true, skipped: '班级未开学（class_state.start_date 未设置）', classDay: 0 })
    }

    const groups = await readGroups(supa)
    // ★ §32-U8-补 §2①：全班注入事件（class_state.injected_events）—— 按组过滤后交给引擎
    //   · 迁移未应用（列不存在）⇒ undefined ⇒ 空数组 ⇒ 与改前行为一致（水位线）
    //   · 目标过滤口径与前端一致：targets=null ⇒ 全班；否则需含该组 group_key
    const allInjections: any[] = Array.isArray((cls as any)?.injected_events) ? (cls as any).injected_events : []
    const out = []

    for (const g of groups) {
      const save = g.state || {}
      const gk = g.group_key || g.user_id
      const injections = allInjections.filter((e: any) => e && (!Array.isArray(e.targets) || e.targets.includes(gk)))
      // ② 调逻辑（本文件不含任何计算）
      const r = advanceGroupOneDay(save, classDay, { groupKey: gk, injectedEvents: injections.length ? injections : null })
      out.push({ group: gk, advanced: r.advanced, week: r.week, dayIndex: r.dayIndex, violations: r.violations })

      // 数值合理性不过 → 记录但不静默覆盖（③ 只存结果，不改数）
      if (r.violations.length) {
        await writeTickLog(supa, { tick_key: tickKey(classDay, gk), class_day: classDay, group_key: gk, result: { violations: r.violations, engineVersion: TICK_VERSION }, ok: false, dry })
        continue
      }
      if (!dry && r.advanced) await writeGroupState(supa, g, r.save)
      if (!dry) await writeTickLog(supa, { tick_key: tickKey(classDay, gk), class_day: classDay, group_key: gk, result: { advanced: r.advanced, week: r.week, dayIndex: r.dayIndex, engineVersion: TICK_VERSION }, ok: true, dry })
    }

    return json({ ok: true, classDay, groups: out.length, advanced: out.filter(x => x.advanced).length, detail: out, dry, engineVersion: TICK_VERSION })
  } catch (e) {
    return json({ ok: false, error: String(e && e.message || e) }, 500)
  }
})

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
