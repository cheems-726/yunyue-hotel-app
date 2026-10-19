// V127-#1 · host tick.mjs：入库 + 生产流水口径（真推进 +6 / 无推进 +0 / 撞键 warn+计数）
// 运行：node tests/hostTick.test.mjs   （挂 run-all fast）
//
// 做法：起一个本地假 REST（模拟 Supabase PostgREST），把 scripts/host/tick.mjs + 组装引擎
//       按服务器布局复制到临时目录（tick.mjs + engine/），真跑脚本、真收请求。
//   覆盖卡内判据：
//     ① 真推进一天 ⇒ server_tick_log 恰好 +6 行，tick_key = d{N}|{组}|tYYYYMMDDHHmm
//     ② 无推进（该周已结算）⇒ +0 行
//     ③ 前置闸拦下（周内决策不足）⇒ advanced=0 / gated=6 / +0 行
//     ④ 同一分钟重复真推进 ⇒ 撞键必须有 warn + duplicates=6（不再静默）
//     ⑤ 周尾 0 决策 ⇒ 6 组兜底结算（决策数=0）并 +6 行
import http from 'node:http'
import { readFileSync, writeFileSync, mkdtempSync, cpSync, mkdirSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decisions } from '../src/decisions.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const code = readFileSync(path.join(APP, 'scripts/host/tick.mjs'), 'utf8')

console.log('▶ V127-#1 · host tick.mjs 入库与生产流水口径')

// ── 静态：来源/键/写流水条件 ──────────────────────────────────────
console.log('\n[静态] 仓库内文件 + 分钟键 + 只在真结算时写')
{
  ok(/唯一来源/.test(code) && /禁止在服务器上直接手改/.test(code), '文件头写明：本文件 = 服务器版本的唯一来源（禁止手改服务器）')
  ok(/import \{[^}]*tickLogKey[^}]*\} from '\.\/engine\/serverTick\.mjs'/.test(code), '从同一份组装引擎取 tickLogKey（与 Edge 同源）')
  ok(!/tickKey\(/.test(code), '不再用 tickKey 写流水（旧键会被历史轮次占满）')
  ok(/const logKey = tickLogKey\(classDay, gk\)/.test(code), '每个组/每次调用一个分钟戳流水键')
  ok(/if \(!DRY && r\.advanced\) \{[\s\S]{0,400}记流水\(/.test(code), '只在 advanced=true 时写 ok:true 流水')
  ok(/r\.violations && r\.violations\.length/.test(code) && /ok: false/.test(code), '违规时写 ok:false 流水')
  ok(/console\.warn/.test(code) && /duplicate: true/.test(code), '撞键 ⇒ console.warn + duplicate 计数（不静默）')
  ok(!/function settle\s*\(/.test(code) && !/occupiedRooms\s*\*|revenue\s*=\s*Math\.round/.test(code), '不含任何结算公式（引擎数值路径零改动）')
}

// ── 假 REST（PostgREST 子集）───────────────────────────────────
function 十八项() {
  const o = {}
  for (const d of decisions) {
    if (d.type === 'option' || d.type === 'timer') o[d.id] = d.options[0].label
    else if (d.type === 'slider') o[d.id] = d.min ?? 0
    else if (d.type === 'budget') {
      const avg = Math.floor(d.total / d.items.length)
      o[d.id] = Object.fromEntries(d.items.map((it, i) => [it, avg + (i === 0 ? d.total - avg * d.items.length : 0)]))
    } else if (d.type === 'sort') o[d.id] = [...d.items]
  }
  return o
}
const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2, district: '锦江区' }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const 今天的UTC = new Date().toISOString().slice(0, 10)

function mkServer() {
  const st = {
    offset: 0,
    groups: Array.from({ length: 6 }, (_, i) => ({
      user_id: 'u' + (i + 1), group_key: 'g' + (i + 1), week: 1, finished: false,
      state: { week: 1, location: SITE, brand: BRAND, attrs: { quality: 60, reputation: 70, morale: 65 }, capital: 5020000, history: [], doneDecisions: 十八项(), bizMode: 'direct' },
    })),
    logs: [],
    logKeys: new Set(),
    snapshots: 0,
    ignoreWrites: false,
  }
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://localhost')
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => {
      const send = (codeN, obj) => { res.writeHead(codeN, { 'Content-Type': 'application/json' }); res.end(obj === undefined ? '' : JSON.stringify(obj)) }
      if (req.method === 'GET' && u.pathname === '/class_state') {
        return send(200, [{ current_week: 1, start_date: 今天的UTC, teacher_offset_days: st.offset, injected_events: [] }])
      }
      if (req.method === 'GET' && u.pathname === '/game_states') return send(200, st.groups)
      if (req.method === 'POST' && u.pathname === '/server_tick_log') {
        const row = JSON.parse(body)
        if (st.logKeys.has(row.tick_key)) return send(409, { code: '23505', message: 'duplicate key value violates unique constraint "server_tick_log_pkey"' })
        st.logKeys.add(row.tick_key); st.logs.push(row); return send(201)
      }
      if (req.method === 'POST' && u.pathname === '/pre_settle_snapshots') { st.snapshots++; return send(201) }
      if (req.method === 'PATCH' && u.pathname === '/game_states') {
        if (st.ignoreWrites) return send(200)
        const gk = u.searchParams.get('group_key')?.replace(/^eq\./, '')
        const uid = u.searchParams.get('user_id')?.replace(/^eq\./, '')
        const g = st.groups.find(x => (gk && x.group_key === gk) || (uid && x.user_id === uid))
        if (g) { const b = JSON.parse(body); g.state = b.state; g.week = b.week; g.finished = b.finished }
        return send(200)
      }
      send(404, { error: 'not found ' + req.method + ' ' + u.pathname })
    })
  })
  return { server, st }
}

function 准备部署目录() {
  const dir = mkdtempSync(path.join(tmpdir(), 'v127-tick-'))
  cpSync(path.join(APP, 'scripts/host/tick.mjs'), path.join(dir, 'tick.mjs'))
  cpSync(path.join(APP, 'supabase/functions/advance-day/engine'), path.join(dir, 'engine'), { recursive: true })
  writeFileSync(path.join(dir, 'keys.json'), JSON.stringify({ service_role: 'test-key' }), 'utf8')
  return dir
}

function 跑tick(dir, port) {
  return new Promise(resolve => {
    const p = spawn(process.execPath, ['tick.mjs'], { cwd: dir, env: { ...process.env, YUNYUE_CONF: path.join(dir, 'keys.json'), YUNYUE_REST: `http://127.0.0.1:${port}` } })
    let out = '', err = ''
    p.stdout.on('data', d => { out += d })
    p.stderr.on('data', d => { err += d })
    p.on('close', c => resolve({ c, out, err }))
  })
}
const 解析 = (out) => { try { return JSON.parse(out.trim().split('\n').pop()) } catch (e) { return null } }

const dir = 准备部署目录()
const { server, st } = mkServer()
await new Promise(r => server.listen(0, '127.0.0.1', r))
const port = server.address().port

try {
  // ① 真推进 +6（并模拟旧轮次已占满 d1|gN 键 —— 冷启动判据 ⑤）
  console.log('\n[①] 真推进一天 ⇒ 恰好 +6 行，键带分钟戳（旧键已占满也能插）')
  {
    st.offset = 0
    for (let i = 1; i <= 6; i++) st.logKeys.add(`d1|g${i}`)   // 旧轮次遗留键（无分钟戳）
    const before = st.logs.length
    const r = await 跑tick(dir, port)
    const j = 解析(r.out)
    ok(r.c === 0 && j && j.ok === true, `脚本正常退出（exit=${r.c}）`, r.err.slice(0, 200))
    ok(j && j.advanced === 6, `6 组都真结算（advanced=${j && j.advanced}）`)
    ok(st.logs.length - before === 6, `旧键占满时新键仍插入成功：恰好 +6 行（实际 +${st.logs.length - before}）`)
    ok(st.logs.slice(before).every(x => /^d1\|g\d+\|t\d{12}$/.test(x.tick_key)), '键形如 d1|gN|tYYYYMMDDHHmm', st.logs.slice(before).map(x => x.tick_key).join(','))
    ok(st.snapshots === 6, `结算前不可变快照 6 条（实际 ${st.snapshots}）`)
  }

  // ② 无推进 +0
  console.log('\n[②] 同一周已结算 ⇒ +0 行')
  {
    const before = st.logs.length
    const r = await 跑tick(dir, port)
    const j = 解析(r.out)
    ok(r.c === 0 && j && j.advanced === 0, '幂等命中：advanced=0')
    ok(st.logs.length === before, `无推进 ⇒ +0 行（实际 +${st.logs.length - before}）`)
  }

  // ③ 前置闸拦下 +0
  console.log('\n[③] 周内决策不足 ⇒ 前置闸拦下，+0 行')
  {
    st.groups.forEach(g => { g.state = { ...g.state, history: [], doneDecisions: {} }; g.week = 1 })
    st.offset = 1   // classDay=2 ⇒ 第 1 周第 2 天
    const before = st.logs.length
    const r = await 跑tick(dir, port)
    const j = 解析(r.out)
    ok(j && j.advanced === 0 && j.gated === 6, `advanced=0 · gated=6（实得 ${j && j.advanced}/${j && j.gated}）`)
    ok(st.logs.length === before, '被闸住 ⇒ +0 行')
  }

  // ④ 撞键 warn + duplicates
  console.log('\n[④] 同一分钟重复真推进 ⇒ 撞键必须 warn + duplicates=6')
  {
    st.groups.forEach(g => { g.state = { ...g.state, week: 2, history: [], doneDecisions: 十八项() }; g.week = 2 })
    st.offset = 7                   // classDay=8 ⇒ 第 2 周第 1 天（避开前面已用过的 d1/d2/d7 键）
    st.ignoreWrites = true          // 让第二次仍"真结算" ⇒ 同一分钟同组同键
    const r1 = await 跑tick(dir, port)
    const j1 = 解析(r1.out)
    const r2 = await 跑tick(dir, port)
    const j2 = 解析(r2.out)
    st.ignoreWrites = false
    ok(j1 && j1.advanced === 6 && j1.duplicates === 0, '第一次：advanced=6 · duplicates=0')
    ok(j2 && j2.duplicates === 6, `第二次：duplicates=6（实得 ${j2 && j2.duplicates}）`)
    ok(/撞键/.test(r2.err), 'stderr 有撞键 warn 行', r2.err.slice(0, 200))
  }

  // ⑤ 周尾 0 决策兜底
  console.log('\n[⑤] 周尾 0 决策 ⇒ 6 组兜底结算（决策数=0）')
  {
    st.groups.forEach(g => { g.state = { ...g.state, history: [], doneDecisions: {} }; g.week = 1 })
    st.offset = 6   // classDay=7
    const before = st.logs.length
    const r = await 跑tick(dir, port)
    const j = 解析(r.out)
    ok(j && j.advanced === 6, `周尾照常结算（advanced=${j && j.advanced}）`)
    ok(j && j.detail.every(x => x.决策数 === 0), '6 组决策数都是 0')
    ok(st.logs.length - before === 6, `流水 +6 行（实际 +${st.logs.length - before}）`)
  }
} finally {
  server.close()
  rmSync(dir, { recursive: true, force: true })
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
