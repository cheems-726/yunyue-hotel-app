#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// V130 §10-2 · 服务器使用监测（本地 cron/timer 每条 10 分钟落一行 JSON）
//
// 采集：负载/内存/swap/磁盘 · SSH 成功与失败 · fail2ban 封禁 · nginx 请求量与 5xx/独立 IP/
//       热门路径 · 库内活跃（今日决策数、游戏状态数、教学日、结算前快照行数）·
//       tick 新鲜度 · 备份新鲜度 · 证书剩余天数
// 输出：/var/log/yunyue-monitor.jsonl（机器可读，一行一快照，>5MB 自动轮转）
//       /var/log/yunyue-monitor.log（人读一行摘要）
//       /var/log/yunyue-alerts.log（只记告警，出现即写）
// 用法：node monitor.mjs           采一条
//       node monitor.mjs --report 24    汇总最近 24 小时
//       node monitor.mjs --report 24 --json
// 告警判据（任一命中 ⇒ 退出码 1，systemd 记 failed，`systemctl --failed` 可见）：
//   磁盘>80% · 可用内存<150MB · tick>30 分钟没跑 · 备份>48h · 证书<15 天 ·
//   SSH 失败>200 次/日 · 当前封禁>10 个
// ═══════════════════════════════════════════════════════════════════════════
import { execSync, spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'

const JSONL = '/var/log/yunyue-monitor.jsonl'
const HUMAN = '/var/log/yunyue-monitor.log'
const ALERTS = '/var/log/yunyue-alerts.log'

const sh = (cmd, def = '') => {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000 }).trim() } catch { return def }
}
const num = (s, def = 0) => { const n = Number(String(s).replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : def }
const args = process.argv.slice(2)

// ── 报表模式 ────────────────────────────────────────────────────────────
if (args.includes('--report')) {
  const hours = Number(args[args.indexOf('--report') + 1]) || 24
  const since = Date.now() - hours * 3600e3
  const rows = existsSync(JSONL)
    ? readFileSync(JSONL, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch { return null } }).filter(r => r && Date.parse(r.ts) >= since)
    : []
  if (!rows.length) { console.log(`（最近 ${hours} 小时没有监测数据）`); process.exit(0) }
  const last = rows[rows.length - 1]
  const max = (k) => Math.max(...rows.map(r => Number(r[k]) || 0))
  const sum = (k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0)
  const 汇总 = {
    窗口小时: hours, 采样数: rows.length,
    '磁盘已用%_最大': max('diskUsedPct'), '可用内存MB_最小': Math.min(...rows.map(r => r.memAvailMB)),
    '请求数_合计': sum('nginxReqToday'), '今日请求_末值': last.nginxReqToday,
    '今日5xx_末值': last.nginx5xxToday, '今日独立IP_末值': last.nginxUniqIpToday,
    'SSH失败_最大': max('sshFail'), 'SSH成功_最大': max('sshOk'),
    'fail2ban当前封禁_最大': max('banned'), 'fail2ban累计封禁_末值': last.bannedTotal,
    '今日决策数_末值': last.decisionsToday, '教学日_末值': last.classDay,
    '今日登录_末值': last.loginsToday, '24h活跃用户_末值': last.activeUsers24h,
    'tick分钟前_最大': max('tickAgeMin'), '备份小时前_最大': max('backupAgeH'),
    '证书剩余天_末值': last.certDays, '告警条数': rows.filter(r => (r.alarms || []).length).length,
  }
  if (args.includes('--json')) { console.log(JSON.stringify(汇总, null, 2)); process.exit(0) }
  console.log(`══ 服务器使用 · 最近 ${hours} 小时（${rows.length} 个采样 · 末次 ${last.ts}）══`)
  for (const [k, v] of Object.entries(汇总)) console.log(`  ${k.padEnd(24)} ${v}`)
  const alarms = rows.flatMap(r => (r.alarms || []).map(a => `${r.ts} ${a}`)).slice(-10)
  if (alarms.length) { console.log('\n  最近告警：'); alarms.forEach(a => console.log('   · ' + a)) }
  process.exit(0)
}

// ── 采样 ────────────────────────────────────────────────────────────────
const now = new Date()
const ts = now.toISOString()
const today = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/') // 20/Oct/2026

const diskUsedPct = num(sh("df -P / | awk 'NR==2{gsub(/%/,\"\",$5); print $5}'"), 0)
const memAvailMB = Math.round(num(sh("awk '/^MemAvailable:/{print $2}' /proc/meminfo")) / 1024)
const swapUsedMB = num(sh("free -m | awk '/^Swap:/{print $3}'"), 0)
const load1 = Number(os.loadavg()[0].toFixed(2))

const sshFail = num(sh('grep -ac "Failed password" /var/log/auth.log 2>/dev/null'), 0)
const sshOk = num(sh('grep -ac "Accepted " /var/log/auth.log 2>/dev/null'), 0)
const f2b = sh('fail2ban-client status sshd 2>/dev/null')
const banned = num((/Currently banned:\s*(\d+)/.exec(f2b) || [])[1], 0)
const bannedTotal = num((/Total banned:\s*(\d+)/.exec(f2b) || [])[1], 0)

const nginxReqToday = num(sh(`grep -ac "${today}" /var/log/nginx/access.log 2>/dev/null`), 0)
const nginx5xxToday = num(sh(`grep -a "${today}" /var/log/nginx/access.log 2>/dev/null | grep -ac ' 5[0-9][0-9] '`), 0)
const nginxUniqIpToday = num(sh(`grep -a "${today}" /var/log/nginx/access.log 2>/dev/null | awk '{print $1}' | sort -u | wc -l`), 0)
const topPath = sh(`grep -a "${today}" /var/log/nginx/access.log 2>/dev/null | awk '{print $7}' | sort | uniq -c | sort -rn | head -1 | awk '{print $2}'`)

const db = sh(`sudo -u postgres psql -d yunyue -At -F'|' -c "select (select count(*) from decision_log where created_at::date=current_date), (select count(*) from game_states), class_day_now(), (select count(*) from pre_settle_snapshots), (select count(*) from auth.sessions where created_at::date=current_date), (select count(distinct user_id) from auth.sessions where created_at > now() - interval '24 hours')"`)
const [decisionsToday, gameStates, classDay, preSettleRows, loginsToday, activeUsers24h] = db.split('|').map(x => num(x, 0))

const tickEpoch = num(sh("date -d \"$(systemctl show yunyue-tick.timer -p LastTriggerUSec --value 2>/dev/null)\" +%s 2>/dev/null"), 0)
const tickAgeMin = tickEpoch ? Math.round((Date.now() / 1000 - tickEpoch) / 60) : -1
const newestDump = sh("ls -1t /opt/yunyue/bak/db/*.dump 2>/dev/null | head -1")
const backupAgeH = newestDump ? Math.round((Date.now() / 1000 - Number(sh(`stat -c %Y "${newestDump}"`))) / 3600) : -1
const certEnd = sh("openssl x509 -enddate -noout -in /etc/letsencrypt/live/test.2026911301.xyz/cert.pem 2>/dev/null | cut -d= -f2-")
const certDays = certEnd ? Math.floor((Date.parse(certEnd) - Date.now()) / 86400e3) : -1

const alarms = []
if (diskUsedPct > 80) alarms.push(`磁盘已用 ${diskUsedPct}% > 80%`)
if (memAvailMB < 150) alarms.push(`可用内存 ${memAvailMB}MB < 150MB`)
if (tickAgeMin < 0) alarms.push('取不到 tick 上次触发时间')
else if (tickAgeMin > 30) alarms.push(`tick 已 ${tickAgeMin} 分钟没跑`)
if (backupAgeH < 0) alarms.push('找不到任何 db 备份')
else if (backupAgeH > 48) alarms.push(`备份已 ${backupAgeH}h > 48h`)
if (certDays >= 0 && certDays < 15) alarms.push(`证书仅剩 ${certDays} 天`)
if (sshFail > 200) alarms.push(`SSH 失败 ${sshFail} 次/日 > 200`)
if (banned > 10) alarms.push(`当前封禁 ${banned} 个 IP > 10`)

const row = {
  ts, host: os.hostname(), load1, diskUsedPct, memAvailMB, swapUsedMB,
  sshFail, sshOk, banned, bannedTotal,
  nginxReqToday, nginx5xxToday, nginxUniqIpToday, topPath,
  decisionsToday, gameStates, classDay, preSettleRows, loginsToday, activeUsers24h,
  tickAgeMin, backupAgeH, certDays, alarms,
}

// 轮转（>5MB 换名）
try { if (existsSync(JSONL) && statSync(JSONL).size > 5 * 1024 * 1024) renameSync(JSONL, JSONL + '.1') } catch {}

appendFileSync(JSONL, JSON.stringify(row) + '\n')
const 本地时间 = now.toLocaleString('sv-SE').slice(0, 16)
const line = `[${本地时间}] 负载 ${load1} · 磁盘 ${diskUsedPct}% · 可用内存 ${memAvailMB}MB · ` +
  `SSH 失败 ${sshFail}/成功 ${sshOk} · 封禁 ${banned}(累计 ${bannedTotal}) · 今日请求 ${nginxReqToday}(5xx ${nginx5xxToday}, IP ${nginxUniqIpToday}) · ` +
  `今日登录 ${loginsToday}/活跃 ${activeUsers24h} 人 · 今日决策 ${decisionsToday} · 教学日 ${classDay} · 快照 ${preSettleRows} 行 · ` +
  `tick ${tickAgeMin} 分钟前 · 备份 ${backupAgeH}h 前 · 证书 ${certDays} 天`
appendFileSync(HUMAN, line + '\n')

if (alarms.length) {
  const aline = `[${ts}] ` + alarms.join(' | ')
  appendFileSync(ALERTS, aline + '\n')
  console.error('⚠ 告警：' + alarms.join(' | '))
  // ★ 邮件推送（1 小时内只发一次，防刷屏；未配置授权码时 notify.sh 自己退出 2，不影响监测）
  try {
    const STAMP = '/var/lib/yunyue-notify-last'
    let prev = 0
    try { prev = Number(readFileSync(STAMP, 'utf8').trim()) || 0 } catch { /* 首次 */ }
    if (Date.now() - prev > 3600e3) {
      const r = spawnSync('/bin/bash', ['/opt/yunyue/scripts/notify.sh', `【云悦告警】${alarms.length} 项`, `${alarms.join('\n')}\n\n${line}`], { encoding: 'utf8', timeout: 30000 })
      if (r.status === 0) { try { writeFileSync(STAMP, String(Date.now())) } catch {} }
      else console.error('  （邮件未发送：' + String((r.stdout || '') + (r.stderr || '')).trim().slice(0, 160) + '）')
    }
  } catch { /* 通知失败不影响监测结论 */ }
  process.exit(1)
}
process.exit(0)
