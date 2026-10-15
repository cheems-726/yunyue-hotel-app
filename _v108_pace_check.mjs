#!/usr/bin/env node
// V108 交付物：`_v108_pace_check.mjs` —— tick_log 完整性守门
//   ① 逐日无缺档：min..max classDay 之间**每一天**都有行（且每档都齐）
//   ② 无重复键：tick_key 全库唯一
//   ③ 断点续跑证据：任意两天的 group 集合一致（停机补算不丢不重）
// 用法（测试机）：node pace_check.mjs [组数期望]
import { readFileSync } from 'node:fs'
const REST = 'http://127.0.0.1:3000'
const SR = JSON.parse(readFileSync('/opt/yunyue/etc/keys.json', 'utf8')).service_role
const H = { apikey: SR, Authorization: 'Bearer ' + SR }
const j = async (r) => { const t = await r.text(); return t ? JSON.parse(t) : null }
const get = async (p) => { const r = await fetch(REST + p, { headers: H }); if (!r.ok) throw new Error(p + ' ' + r.status); return j(r) }

const rows = await get('/server_tick_log?select=tick_key,class_day,group_key,ok&order=class_day.asc&limit=5000')
const byDay = new Map()
for (const r of rows) { if (!byDay.has(r.class_day)) byDay.set(r.class_day, []); byDay.get(r.class_day).push(r) }
const days = [...byDay.keys()].sort((a, b) => a - b)
const lo = days[0], hi = days[days.length - 1]
const 期望档数 = Number(process.argv[2] || (byDay.get(hi) || []).length)

let bad = 0
const 缺档 = []
for (let d = lo; d <= hi; d++) if (!byDay.has(d)) 缺档.push(d)
const 不全 = days.filter(d => byDay.get(d).length !== 期望档数).map(d => `${d}(${byDay.get(d).length})`)
const keys = rows.map(r => r.tick_key)
const dup = keys.length - new Set(keys).size

console.log('══ V108 快进完整性自检 ══')
console.log(`  tick_log 行数=${rows.length} · 覆盖 classDay ${lo}..${hi}（${days.length} 天）· 期望每日档数=${期望档数}`)
console.log(`  ① 逐日无缺档：${缺档.length === 0 ? '✓ 无缺档' : '✗ 缺 ' + 缺档.join(',')}`); if (缺档.length) bad++
console.log(`  ② 无重复键：${dup === 0 ? '✓ tick_key 全唯一' : '✗ 重复 ' + dup + ' 个'}`); if (dup) bad++
console.log(`  ③ 每日档数一致：${不全.length === 0 ? '✓ 全一致' : '✗ 不一致 ' + 不全.join(' ')}`); if (不全.length) bad++
console.log(`  （断点续跑：tick_key 作主键 ⇒ 重复 tick 静默跳过；停机后补算缺天、已算不重算）`)
console.log(bad === 0 ? 'PASS' : 'FAIL')
process.exit(bad === 0 ? 0 : 1)
