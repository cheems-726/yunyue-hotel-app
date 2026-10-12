// V102 T4：真实 API 并发复核（Node 版，走公网路径）
// 用法: node _v102_bench.mjs <BASE> <workers> <reqsPerWorker> <anonKey>
const [BASE0, W0, R0, ANON] = process.argv.slice(2)
const BASE = BASE0.replace(/\/$/, '')
const W = Number(W0), R = Number(R0)
const EMAIL = '20240102@yunyue.study', PW = 'test123456'
const GK = '酒管2401|2'

async function req(method, path, body, token, extra) {
  const h = { apikey: ANON, 'Content-Type': 'application/json', ...(extra || {}) }
  if (token) h.Authorization = 'Bearer ' + token
  const t0 = performance.now()
  try {
    const r = await fetch(BASE + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined })
    await r.text()
    return { ms: performance.now() - t0, code: r.status }
  } catch (e) {
    return { ms: performance.now() - t0, code: 0, err: e.name }
  }
}

const hres = await fetch(BASE + '/auth/v1/health')
console.log('health:', hres.status)
const tok = await (await fetch(BASE + '/auth/v1/token?grant_type=password', {
  method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON },
  body: JSON.stringify({ email: EMAIL, password: PW }),
})).json()
const TOKEN = tok.access_token
const SUB = JSON.parse(Buffer.from(TOKEN.split('.')[1], 'base64url').toString()).sub
console.log('login ok, sub =', SUB)

async function worker(wid, out) {
  for (let i = 0; i < R; i++) {
    const k = i % 10
    let r
    if (k < 7) r = await req('GET', '/rest/v1/game_states?select=user_id,week&group_key=eq.' + encodeURIComponent(GK), null, TOKEN)
    else if (k < 9) r = await req('POST', '/rest/v1/rpc/class_day_now', {}, TOKEN)
    else r = await req('POST', '/rest/v1/decision_log', { user_id: SUB, group_key: GK, week: 1, decision_id: `bench-${wid}-${i}`, answer: '压测', feedback: '压测行' }, TOKEN, { Prefer: 'return=minimal' })
    out.push(r)
  }
}

const all = []
const t0 = performance.now()
await Promise.all(Array.from({ length: W }, (_, w) => worker(w, all)))
const wall = performance.now() - t0

const ms = all.map(x => x.ms).sort((a, b) => a - b)
const ok = all.filter(x => x.code >= 200 && x.code < 300)
const fail = all.filter(x => !(x.code >= 200 && x.code < 300))
const p = q => ms[Math.min(ms.length - 1, Math.floor(ms.length * q))]
const mean = ms.reduce((a, b) => a + b, 0) / ms.length
console.log(`总请求=${all.length} 成功=${ok.length} 失败=${fail.length} 并发=${W}`)
console.log(`墙钟=${wall.toFixed(0)}ms 吞吐=${(all.length / (wall / 1000)).toFixed(1)} req/s`)
console.log(`p50=${p(0.5).toFixed(1)}ms p90=${p(0.9).toFixed(1)}ms p95=${p(0.95).toFixed(1)}ms p99=${p(0.99).toFixed(1)}ms max=${ms[ms.length - 1].toFixed(1)}ms mean=${mean.toFixed(1)}ms`)
if (fail.length) {
  const c = {}
  for (const f of fail) c[`${f.code}${f.err ? '/' + f.err : ''}`] = (c[`${f.code}${f.err ? '/' + f.err : ''}`] || 0) + 1
  console.log('失败分布:', JSON.stringify(c))
}
