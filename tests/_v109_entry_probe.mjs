// V129-R109-4 · 入口自检（Node · 不依赖浏览器 · 可复跑）
// 运行：node tests/_v109_entry_probe.mjs
// 判据：
//   · https://test.2026911301.xyz/health 期望 200
//   · http://121.196.196.37/health       期望 200
//   · https://121.196.196.37/health      自签 ⇒ 记「需点继续」
//   · 端口面：22/80/443 可达；3000/4000/9999 不可达（安全面）
//   · 师生视角各一次 anon 读（同一 URL/key ⇒ 同源）
// 退出码：至少一个入口可用 = 0；入口都不可达 = 1；本机无网络 = 0（打印 SKIP，不许静默绿）
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import dns from 'node:dns/promises'
import { SUPABASE_URL, SUPABASE_KEY } from '../src/supabaseClient.js'

const 域名 = process.env.V129_DOMAIN || 'test.2026911301.xyz'
const IP = process.env.V129_IP || '121.196.196.37'
const 超时 = 6000
const 结果 = []
const 记 = (名, 通过, 详情) => { 结果.push({ 名, 通过, 详情 }); console.log(`  ${通过 ? '✓' : '✗'} ${名}：${详情}`) }

function 请求(url, { timeout = 超时, rejectUnauthorized = true } = {}) {
  return new Promise((resolve) => {
    let u
    try { u = new URL(url) } catch (e) { return resolve({ ok: false, status: 0, error: 'bad url' }) }
    const lib = u.protocol === 'https:' ? https : http
    const req = lib.request(u, { method: 'GET', timeout, rejectUnauthorized, headers: { 'User-Agent': 'v129-entry-probe' } }, (res) => {
      let body = ''
      res.on('data', c => { if (body.length < 200) body += c })
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode, body, 位置: res.headers.location || '' }))
    })
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, error: 'timeout' }) })
    req.on('error', (e) => resolve({ ok: false, status: 0, error: e.code || e.message }))
    req.end()
  })
}

function 端口(host, port) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port, timeout: 4000 })
    const done = (ok) => { try { s.destroy() } catch (e) {}; resolve(ok) }
    s.on('connect', () => done(true))
    s.on('timeout', () => done(false))
    s.on('error', () => done(false))
  })
}

console.log('▶ V129-R109-4 · 入口自检')

// ① 本机有没有网（DNS）—— 没网 ⇒ SKIP，不许静默绿
let 有网 = true
try { await dns.lookup(域名) } catch (e) {
  try { await dns.lookup(IP) } catch (e2) { 有网 = false }
}
if (!有网) {
  console.log(`⏭ SKIP：本机无 DNS 解析（${域名} / ${IP} 都解析不到）—— 入口自检需要外网，本次不计结论`)
  process.exit(0)
}

// ② 三入口
const A = await 请求(`https://${域名}/health`)
记(`A https://${域名}/health`, A.status === 200, A.status ? `HTTP ${A.status}` : `不可达（${A.error}）`)

const B = await 请求(`http://${IP}/health`)
// ★ T1（2026-11-09）：IP 入口改为 302 到正式域名（旧站点页没有离线演示入口）⇒ 判据 = "302 且 Location 指向正式域"
const B跳 = B.status === 302 && String(B.位置 || '').startsWith(`https://${域名}`)
记(`B http://${IP}/health（现应 302→正式域）`, B跳, B.status ? `HTTP ${B.status}${B.位置 ? ' → ' + B.位置 : ''}` : `不可达（${B.error}）`)

const C1 = await 请求(`https://${IP}/health`)
let C = C1
let Cnote = C1.status ? `HTTP ${C1.status}` : `${C1.error || '不可达'}（需点「继续前往」）`
if (!C1.ok && /CERT|SELF_SIGNED|UNABLE_TO_VERIFY/.test(String(C1.error || ''))) {
  C = await 请求(`https://${IP}/health`, { rejectUnauthorized: false })
  Cnote = `自签证书 ⇒ 需点「继续前往」${C.status ? `（跳过校验后 HTTP ${C.status}）` : ''}`
}
// ★ T1：IP 的 https 同样 302 到正式域（先过自签提示）
const C跳 = C.status === 302 && String(C.位置 || '').startsWith(`https://${域名}`)
记(`C https://${IP}/health（自签 · 现应 302→正式域）`, C跳, Cnote + (C.位置 ? ' → ' + C.位置 : ''))

// ③ 端口面
const 应开 = [22, 80, 443]
const 应关 = [3000, 4000, 9999]
const 开 = []
const 关 = []
for (const p of 应开) 开.push([p, await 端口(IP, p)])
for (const p of 应关) 关.push([p, await 端口(IP, p)])
const 开ok = 开.filter(([, v]) => v).map(([p]) => p)
const 关ok = 关.filter(([, v]) => !v).map(([p]) => p)
记('端口面（22/80/443 可达）', 应开.every(p => 开ok.includes(p)), `开：${开ok.join('/') || '无'}`)
记('端口面（3000/4000/9999 不可达）', 应关.every(p => 关ok.includes(p)), `意外开放：${应关.filter(p => !关ok.includes(p)).join('/') || '无'}`)

// ④ 师生视角 anon 读（同一 URL/key）
async function anon读(role) {
  const u = `${SUPABASE_URL}/rest/v1/profiles?select=role&role=eq.${role}&limit=1`
  return new Promise((resolve) => {
    const req = https.request(u, { method: 'GET', timeout: 超时, headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } }, (res) => {
      res.resume(); resolve({ status: res.statusCode })
    })
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }) })
    req.on('error', (e) => resolve({ status: 0, error: e.code || e.message }))
    req.end()
  })
}
const 师 = await anon读('teacher')
const 学 = await anon读('student')
if (!师.status && !学.status && 师.error === 学.error) {
  console.log(`  ⏭ SKIP 师生视角 anon 读：本机到 Supabase 不通（${师.error}）；入口本身可用，同源未验证`)
} else {
  const 同源 = 师.status > 0 && 师.status === 学.status
  记('师生视角 anon 读（同一 URL/key）', 同源, `teacher=${师.status || 师.error} · student=${学.status || 学.error}（401/403 属 RLS 预期）`)
}

// ⑤ 结论
// ★ T1：302→正式域 也算"入口可用"（IP 现在是跳转入口，不是独立站点）
const 入口可用 = [A.status === 200, B跳, C跳].filter(Boolean).length
const 安全面ok = 应关.every(p => 关ok.includes(p))
const 通过数 = 结果.filter(x => x.通过).length
const 失败数 = 结果.filter(x => !x.通过).length
const 结论 = 入口可用 > 0 ? 'PASS' : 'FAIL'
console.log(`\n结论: ${结论} · 可用入口 ${入口可用}/3 · 安全面 ${安全面ok ? 'OK' : '有端口意外开放'} · ${通过数}/${结果.length} 项通过`)
// ★ V132 §4：run-all 统一解析的尾行（SKIP 不计失败，但上面已打印）
console.log(`结果: ${通过数} 通过 / ${失败数} 失败`)
process.exit(通过数 > 0 && 失败数 === 0 && 入口可用 > 0 && 安全面ok ? 0 : 1)
