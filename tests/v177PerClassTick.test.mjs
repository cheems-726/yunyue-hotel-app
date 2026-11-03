// V177§1~§2 · 按班 tick：两班互不拖累 + 归档/草稿零推进 + 每班独立 classDay
// 运行：node tests/v177PerClassTick.test.mjs   （挂 run-all fast）
//
// 做法：本地假 REST（PostgREST 子集）返回**多行 class_state**，真跑 scripts/host/tick.mjs。
//   RV：TICK_SRC=<旧全局版 tick.mjs> ⇒ 本套件红（旧版只读 id=1 + 不传 semesterStatus）。
//   判据（卡 §1/§2/§4）：
//     ① A running / B draft ⇒ 跑 1 轮：A 的 3 组推进，B 逐字节不变
//     ② B 改 running ⇒ 下一轮 B 推进，A 不重复
//     ③ archived 班即使日期有效也零推进
//     ④ 每班 classDay 独立（A 第1天 / D 第8天）
//     ⑤ 归不到班的组 ⇒ 不推进 + 显式上报（不静默丢）
import http from 'node:http'
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decisions } from '../src/decisions.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TICK = process.env.TICK_SRC || path.join(APP, 'scripts/host/tick.mjs')
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const code = readFileSync(TICK, 'utf8')

console.log('▶ V177 · 按班 tick（两班互不拖累）')

// ── 静态：必须是"多行 + 按班传闸"，不许回到 id=1 全局 ──────────────
console.log('\n[静态] 多班读取 + 按班学期闸')
{
  ok(!/id=eq\.1/.test(code), '不再只读 class_state id=1（全局单班路径已删）')
  ok(/class_code/s.test(code) && /semester_status/.test(code), '读 class_code + semester_status（按班判定）')
  ok(/semesterStatus:\s*cls\.semester_status/.test(code), '每班把 semester_status 传给引擎学期闸（旧版漏传 = 归档班被推过头的真因）')
  ok(/startsWith|前缀/.test(code) && /group_key/.test(code), '组按 group_key 前缀归班')
}

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
const 今天 = new Date().toISOString().slice(0, 10)
const mkGroup = (gk, cls, week = 1) => ({
  user_id: 'u-' + gk, group_key: gk, week, finished: false,
  state: { week, location: SITE, brand: BRAND, attrs: { quality: 60, reputation: 70, morale: 65 }, capital: 5020000, history: [], doneDecisions: 十八项(), bizMode: 'direct', __cls: cls },
})

function mkServer() {
  const st = {
    classes: [
      { id: 1, class_code: 'A班', semester_status: 'running', start_date: 今天, teacher_offset_days: 0, injected_events: [] },
      { id: 2, class_code: 'B班', semester_status: 'draft', start_date: 今天, teacher_offset_days: 0, injected_events: [] },
      { id: 3, class_code: 'C班', semester_status: 'archived', start_date: 今天, teacher_offset_days: 0, injected_events: [] },
      { id: 4, class_code: 'D班', semester_status: 'running', start_date: 今天, teacher_offset_days: 7, injected_events: [] },
    ],
    groups: [
      ...['1', '2', '3'].map(n => mkGroup('A班|' + n, 'A')),
      ...['1', '2', '3'].map(n => mkGroup('B班|' + n, 'B')),
      ...['1', '2', '3'].map(n => mkGroup('C班|' + n, 'C')),
      ...['1', '2', '3'].map(n => mkGroup('D班|' + n, 'D', 2)),   // D 班独立 classDay=8 ⇒ 第 2 周
      mkGroup('无班孤儿', 'X'),
    ],
    logs: [], snapshots: 0,
  }
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://localhost')
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => {
      const send = (cN, obj) => { res.writeHead(cN, { 'Content-Type': 'application/json' }); res.end(obj === undefined ? '' : JSON.stringify(obj)) }
      if (req.method === 'GET' && u.pathname === '/class_state') return send(200, st.classes)
      if (req.method === 'GET' && u.pathname === '/game_states') return send(200, st.groups)
      if (req.method === 'GET' && u.pathname === '/profiles') return send(200, [])
      if (req.method === 'POST' && u.pathname === '/server_tick_log') { st.logs.push(JSON.parse(body)); return send(201) }
      if (req.method === 'POST' && u.pathname === '/pre_settle_snapshots') { st.snapshots++; return send(201) }
      if (req.method === 'PATCH' && u.pathname === '/game_states') {
        const gk = u.searchParams.get('group_key')?.replace(/^eq\./, '')
        const g = st.groups.find(x => x.group_key === gk)
        if (g) { const b = JSON.parse(body); g.state = b.state; g.week = b.week; g.finished = b.finished }
        return send(200)
      }
      send(404, { error: 'not found ' + req.method + ' ' + u.pathname })
    })
  })
  return { server, st }
}

function 准备目录() {
  const dir = mkdtempSync(path.join(tmpdir(), 'v177-tick-'))
  cpSync(TICK, path.join(dir, 'tick.mjs'))
  cpSync(path.join(APP, 'supabase/functions/advance-day/engine'), path.join(dir, 'engine'), { recursive: true })
  writeFileSync(path.join(dir, 'keys.json'), JSON.stringify({ service_role: 'test-key' }), 'utf8')
  return dir
}
const 跑tick = (dir, port) => new Promise(resolve => {
  const p = spawn(process.execPath, ['tick.mjs'], { cwd: dir, env: { ...process.env, YUNYUE_CONF: path.join(dir, 'keys.json'), YUNYUE_REST: `http://127.0.0.1:${port}` } })
  let out = '', err = ''
  p.stdout.on('data', d => { out += d })
  p.stderr.on('data', d => { err += d })
  p.on('close', c => resolve({ c, out, err }))
})
const 解析 = (out) => { try { return JSON.parse(out.trim().split('\n').pop()) } catch (e) { return null } }
const 快照 = (g) => JSON.stringify({ week: g.week, finished: g.finished, state: g.state })

const dir = 准备目录()
const { server, st } = mkServer()
await new Promise(r => server.listen(0, '127.0.0.1', r))
const port = server.address().port

try {
  const A前 = st.groups.filter(g => g.state.__cls === 'A').map(快照)
  const B前 = st.groups.filter(g => g.state.__cls === 'B').map(快照)
  const C前 = st.groups.filter(g => g.state.__cls === 'C').map(快照)
  const 孤儿前 = 快照(st.groups.find(g => g.state.__cls === 'X'))

  console.log('\n[①] A running / B draft / C archived / D running(offset 7) ⇒ 跑 1 轮')
  {
    const r = await 跑tick(dir, port)
    const j = 解析(r.out)
    ok(r.c === 0 && j && j.ok === true, `脚本正常退出（exit=${r.c}）`, r.err.slice(0, 300))
    ok(j && j.advanced === 6, `只有 A(3) + D(3) 推进（实得 advanced=${j && j.advanced}）`)
    ok(JSON.stringify(st.groups.filter(g => g.state.__cls === 'A').map(快照)) !== JSON.stringify(A前), 'A 班确实推进了（history 增长）')
    ok(JSON.stringify(st.groups.filter(g => g.state.__cls === 'B').map(快照)) === JSON.stringify(B前), 'B（draft）逐字节不变')
    ok(JSON.stringify(st.groups.filter(g => g.state.__cls === 'C').map(快照)) === JSON.stringify(C前), 'C（archived）即使日期有效也零推进')
    ok(JSON.stringify(st.groups.find(g => g.state.__cls === 'X')) && 快照(st.groups.find(g => g.state.__cls === 'X')) === 孤儿前, '归不到班的组零推进')
    ok(j && Array.isArray(j.未归属) && j.未归属.includes('无班孤儿'), '孤儿组显式上报（不静默丢）', JSON.stringify(j && j.未归属))
    const 班日志 = st.logs.filter(x => x.result && x.result.class === 'A班')
    const 班D = st.logs.filter(x => x.result && x.result.class === 'D班')
    ok(班日志.length === 3 && 班D.length === 3, `流水按班各 3 行（A=${班日志.length} D=${班D.length}）`)
    ok(班日志.every(x => x.class_day === 1), 'A 班 classDay=1（start_date 今天）')
    ok(班D.every(x => x.class_day === 8), `D 班 classDay=8（offset 7 ⇒ 各自独立，实得 ${[...new Set(班D.map(x => x.class_day))].join(',')}）`)
    ok(st.logs.filter(x => x.result && x.result.class === 'B班').length === 0, 'B 班零流水（draft 不推）')
  }

  console.log('\n[②] B 改 running ⇒ 下一轮 B 推进，A 幂等不重复')
  {
    st.classes.find(c => c.class_code === 'B班').semester_status = 'running'
    const A前2 = st.groups.filter(g => g.state.__cls === 'A').map(快照)
    const r = await 跑tick(dir, port)
    const j = 解析(r.out)
    ok(j && j.advanced === 3, `B 的 3 组推进（A/D 同周已结算 ⇒ advanced=${j && j.advanced}）`)
    ok(JSON.stringify(st.groups.filter(g => g.state.__cls === 'A').map(快照)) === JSON.stringify(A前2), 'A 班仍逐字节不变（幂等）')
  }
} finally {
  server.close()
  rmSync(dir, { recursive: true, force: true })
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
