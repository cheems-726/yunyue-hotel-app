#!/usr/bin/env node
// V139 §5 / V141 配套 · GoTrue 登录取证
//
// 用法：
//   node auth-report.mjs --daily               # 今天按类别汇总一行 → /var/log/yunyue-auth.jsonl（同一天覆盖）
//   node auth-report.mjs --account 20240101    # 该账号最近 10 次【成功】登录（时间/IP掩码）
//   node auth-report.mjs --days 7 --json       # 原始窗口统计（不写盘）
//
// 说明（如实）：GoTrue 的失败日志**不记录尝试的账号**（只有 error_code/status/IP），
//   所以按账号查只能覆盖成功登录；失败请用客户端「登录不上？点这里」诊断面板（本机记录最近一次尝试）。
import { execSync } from 'node:child_process'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

const OUT = process.env.YUNYUE_AUTH_LOG || '/var/log/yunyue-auth.jsonl'
const args = process.argv.slice(2)
const 参数 = (name, def = null) => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] || def) : def }
const DAYS = Number(参数('--days', 1)) || 1
const ACCOUNT = 参数('--account', '')
const DAILY = args.includes('--daily')
const JSONOUT = args.includes('--json')

const sh = (cmd) => { try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 }) } catch (e) { return '' } }
const 掩码IP = (ip) => {
  const s = String(ip || '')
  if (/^\d+\.\d+\.\d+\.\d+$/.test(s)) { const p = s.split('.'); return `${p[0]}.${p[1]}.*.*` }
  if (s.includes(':')) return s.split(':').slice(0, 2).join(':') + ':*'
  return s || '未知'
}
function 读日志() {
  const raw = sh(`journalctl -u gotrue --since "${DAYS} days ago" --no-pager -o cat 2>/dev/null`)
  const rows = []
  for (const line of raw.split('\n')) {
    const i = line.indexOf('{')
    if (i < 0) continue
    let j = null
    try { j = JSON.parse(line.slice(i)) } catch (e) { continue }
    if (!j || j.path !== '/token' || String(j.method).toUpperCase() !== 'POST') continue
    rows.push(j)
  }
  return rows
}
function 分类(j) {
  const code = String(j.error_code || '')
  const err = String(j.error || '')
  const st = Number(j.status) || 0
  if (st === 200) return 'success'
  if (code === 'user_banned' || /user is banned/i.test(err)) return 'banned'
  if (st === 429 || /rate.?limit|too many requests/i.test(err)) return 'rate_limit'
  if (code === 'invalid_credentials' || /invalid login/i.test(err)) return 'invalid'
  if (st >= 500 || st === 408) return 'server'
  return 'other'
}
const 本地日 = (t) => {
  const d = t ? new Date(t) : new Date()
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })
}
function 汇总(rows) {
  const out = { date: 本地日(), total: 0, success: 0, invalid: 0, rate_limit: 0, banned: 0, server: 0, other: 0, uniqueIps: 0, topIp: '' }
  const ips = new Map()
  for (const j of rows) {
    if (本地日(j.time) !== out.date) continue
    out.total++
    out[分类(j)]++
    const ip = String(j.remote_addr || '')
    if (ip) ips.set(ip, (ips.get(ip) || 0) + 1)
  }
  out.uniqueIps = ips.size
  const top = [...ips.entries()].sort((a, b) => b[1] - a[1])[0]
  out.topIp = top ? `${掩码IP(top[0])}（${top[1]} 次）` : ''
  return out
}
function 写日报(s) {
  let lines = []
  try { lines = existsSync(OUT) ? readFileSync(OUT, 'utf8').split('\n').filter(Boolean) : [] } catch (e) { lines = [] }
  const kept = lines.filter(l => { try { return JSON.parse(l).date !== s.date } catch (e) { return true } })
  kept.push(JSON.stringify(s))
  writeFileSync(OUT, kept.join('\n') + '\n')
}

const rows = 读日志()
if (ACCOUNT) {
  const want = `${String(ACCOUNT).toLowerCase()}@yunyue.study`
  const hits = rows
    .filter(j => String((j.auth_event && j.auth_event.actor_username) || '').toLowerCase() === want && 分类(j) === 'success')
    .slice(-10)
  console.log(`══ 账号 ${ACCOUNT} · 最近 ${hits.length} 次成功登录（失败日志不带账号，见文末说明）══`)
  for (const j of hits) console.log(`  ${j.time} · 200 · IP ${掩码IP(j.remote_addr)}${j.referer ? ' · 来源 ' + j.referer : ''}`)
  if (!hits.length) console.log('  （窗口内没有成功登录）')
  console.log('  ⚠ GoTrue 的失败尝试不记录账号 ⇒ 失败请用客户端诊断面板的「最近一次尝试」')
  process.exit(0)
}

const s = 汇总(rows)
if (JSONOUT) { console.log(JSON.stringify(s, null, 2)); process.exit(0) }
console.log(`══ GoTrue 登录汇总 · ${s.date} ══`)
console.log(`  总 ${s.total} · 成功 ${s.success} · 凭证错 ${s.invalid} · 限流 ${s.rate_limit} · 停用 ${s.banned} · 5xx ${s.server} · 其他 ${s.other}`)
console.log(`  独立 IP ${s.uniqueIps}${s.topIp ? ' · 最多 ' + s.topIp : ''}`)
if (DAILY) { 写日报(s); console.log(`  ✓ 已写入 ${OUT}（同一天覆盖）`) }
