// V104 R4-4：入口自检脚本（一键跑，防复发）
//   ① IP 入口 200 且返回应用 HTML      ② API 三端点 200
//   ③ 域名 http / https —— **记录项，不预设结论**（不同网络路径结论不一致，见下）
//   ④ 外部 3000/4000/9999 应不可达（超时）
//   ⑤ 一行结论 + 退出码（①②④ 全符合预期 => 0）
//
// 用法：node _v104_entry_check.mjs [IP] [域名]
//   ★ 测的是**公网面**，请在有外网的机器上跑。
//   ★ 关于 ③ 为何只记录不判定：实测发现同一域名在不同路径上结论不一致
//     —— 经本机 HTTP 代理（curl/schannel）会「重置/000」，而**直连路径（Node fetch）返回 200**，
//        且服务器本机环回域名也 200。故 ③ 仅记录，不下结论；要判定需一次「干净路径」的对照实验。
import net from 'node:net'

const IP = process.argv[2] || '121.196.196.37'
const DOMAIN = process.argv[3] || 'test.2026911301.xyz'
const ANON = process.env.ANON || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzkxNzg4MTQ4LCJleHAiOjIxMDcxNDgxNDh9.IZjV4yvU28WikpIfJSslDYqnvKzjI87vEpVH59arbVc'
const T = Number(process.env.TIMEOUT_MS || 8000)

const fails = []
const rec = (name, ok, detail) => { if (!ok) fails.push(name); console.log(`  ${ok ? '✓' : '✗'} ${name}  ${detail}`) }
const recInfo = (name, detail) => console.log(`  · ${name}  ${detail}`)

async function httpGet(url, { headers = {} } = {}) {
  const t0 = performance.now()
  try {
    const r = await fetch(url, { headers, redirect: 'manual' })
    const body = await r.text()
    return { code: r.status, ms: performance.now() - t0, body, loc: r.headers.get('location') }
  } catch (e) {
    return { code: 0, ms: performance.now() - t0, err: e.cause?.code || e.name }
  }
}
function tcp(port) {
  return new Promise(res => {
    const s = net.connect({ host: IP, port })
    s.setTimeout(T)
    s.on('connect', () => { s.destroy(); res('open') })
    s.on('timeout', () => { s.destroy(); res('timeout') })
    s.on('error', e => res(e.code === 'ECONNREFUSED' ? 'refused' : e.code))
  })
}

console.log(`══ 入口自检 · IP=${IP} 域名=${DOMAIN} ══`)

// ① IP 入口
const home = await httpGet(`http://${IP}/`)
const isHtml = /<!DOCTYPE html>/i.test(home.body || '') && /云悦酒店/.test(home.body || '')
rec('① IP 入口 http://IP/ 返回应用 HTML', home.code === 200 && isHtml, `http=${home.code} ${home.ms.toFixed(0)}ms html=${isHtml}`)

// ② API 三端点（IP 同源）
const api = [
  ['/health', await httpGet(`http://${IP}/health`)],
  ['/auth/v1/health', await httpGet(`http://${IP}/auth/v1/health`)],
  ['/rest/v1/game_states', await httpGet(`http://${IP}/rest/v1/game_states?select=group_key`, { headers: { apikey: ANON } })],
]
rec('② API 三端点', api.every(([, r]) => r.code === 200), api.map(([p, r]) => `${p}=${r.code}`).join(' '))

// ③ 域名（**记录项**）
const dHttp = await httpGet(`http://${DOMAIN}/`)
const dHttps = await httpGet(`https://${DOMAIN}/`)
recInfo('③a 域名 http ', `http=${dHttp.code}${dHttp.loc ? ' -> ' + dHttp.loc : ''}${dHttp.err ? ' ' + dHttp.err : ''}`)
recInfo('③b 域名 https', `https=${dHttps.code}${dHttps.err ? ' ' + dHttps.err : ''}（本机直连路径）`)

// ④ 端口面
const ports = {}
for (const p of [22, 80, 443, 3000, 4000, 9999]) ports[p] = await tcp(p)
rec('④a 22/80/443 应开放', [22, 80, 443].every(p => ports[p] === 'open'), [22, 80, 443].map(p => `${p}=${ports[p]}`).join(' '))
rec('④b 3000/4000/9999 应不可达', [3000, 4000, 9999].every(p => ports[p] !== 'open'), [3000, 4000, 9999].map(p => `${p}=${ports[p]}`).join(' '))

console.log(`\n端口矩阵：${Object.entries(ports).map(([p, v]) => `${p}:${v}`).join(' · ')}`)
console.log(fails.length === 0
  ? 'PASS —— 入口自检符合预期（IP 入口可用；域名两项见上方记录项）'
  : `FAIL —— ${fails.length} 项不符预期：${fails.join(' / ')}`)
process.exit(fails.length === 0 ? 0 : 1)
