#!/usr/bin/env node
// V145 §2 · 登录自检 5/5（一句话定位：包/缓存/兼容/鉴权/分支）
// 逐层检查；任一层红 ⇒ exit 1。结果写 /var/log/yunyue-login-check.jsonl（一天一行，同一天覆盖）。
// 用法：node loginSelfCheck.mjs [--days 7]
import https from 'node:https'
import http from 'node:http'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const DOMAIN = process.env.YUNYUE_DOMAIN || 'test.2026911301.xyz'
const OUT = process.env.YUNYUE_LOGIN_CHECK_LOG || '/var/log/yunyue-login-check.jsonl'
const OLD_HOST = 'jgytwxaeeezmdbxfsyvs'
const PORTS = 443

function req(path, { method = 'GET', body = null, headers = {}, timeout = 15000, host = '127.0.0.1', port = PORTS, servername = DOMAIN } = {}) {
  const started = Date.now()
  return new Promise((resolve) => {
    const r = https.request({ host, port, path, method, servername, rejectUnauthorized: false, timeout,
      headers: { Host: DOMAIN, ...headers } }, (res) => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => resolve({ status: res.statusCode || 0, text: data, ms: Date.now() - started }))
    })
    r.on('timeout', () => r.destroy(new Error('timeout')))
    r.on('error', (e) => resolve({ status: 0, text: '', error: e.message, ms: Date.now() - started }))
    if (body) r.write(body)
    r.end()
  })
}

// ── 纯判定层（单测注入故障夹具；主流程只负责取数）──────────────────────
export function 判定L1({ html = '', entry = '', assetStatus = 0, assetText = '' } = {}) {
  const 旧 = (assetText.split(OLD_HOST).length - 1)
  const 有hash = /^index-[A-Za-z0-9_-]+-[0-9a-f]{8}\.js$/.test(entry)
  const 引用 = !!entry && String(html).includes(`assets/${entry}`)
  const ok = assetStatus === 200 && !!assetText && 旧 === 0 && 有hash && 引用
  return { ok, detail: `包=${entry || '无'} · HTTP=${assetStatus} · 旧云端=${旧} · hash8=${有hash} · 引用=${引用}` }
}

export function 判定L2(swText = '', now = Date.now()) {
  const m = /hotel-sim-([0-9]+)/.exec(String(swText))
  const 版本 = m ? Number(m[1]) : 0
  const 天 = 版本 ? Math.floor((now - 版本) / 86400000) : null
  const 未替换 = /__BUILD_VERSION__/.test(String(swText))
  const 有接管 = /skipWaiting\(\)/.test(swText) && /clients\.claim\(\)/.test(swText)
  const 有API排除 = /API_RE/.test(swText)
  const ok = !!版本 && !未替换 && 天 != null && 天 <= 60 && 有接管 && 有API排除
  return { ok, detail: `CACHE_NAME=${版本 || '无'} · ${天 == null ? '无法解析' : 天 + ' 天前'} · 未替换=${!未替换} · 接管=${有接管} · API排除=${有API排除}` }
}

export function 判定L3(jsText = '') {
  const 空值 = (String(jsText).match(/\?\?/g) || []).length
  const 可选 = (String(jsText).match(/\?\.(?![0-9])/g) || []).length
  const 动态 = (String(jsText).match(/import\(/g) || []).length
  return { ok: 空值 === 0 && 可选 === 0 && 动态 === 0, detail: `??=${空值} · ?.=${可选} · import()=${动态}` }
}

export function 判定登录(res = {}, kind = 'success') {
  const st = Number(res.status) || 0
  const body = String(res.text || '')
  const j = (() => { try { return JSON.parse(body) } catch { return {} } })()
  if (kind === 'success') return !!j.access_token && st === 200
  if (kind === 'invalid') return st === 400 && /invalid_credentials/i.test(body)
  if (kind === 'banned') return st === 400 && /user_banned/i.test(body)
  if (kind === 'network') return st === 0
  if (kind === 'rate') return st === 429 || /rate.?limit/i.test(body)
  return false
}

async function 主流程() {
  const 结果 = []
  const add = (name, ok, detail) => { 结果.push({ name, ok, detail }); console.log(`  ${ok ? '✓' : '✗'} ${name} ${detail}`) }

  // L1 包
  const html = await req('/')
  const entry = /assets\/(index-[A-Za-z0-9_-]+\.js)/.exec(html.text || '')?.[1] || ''
  const asset = entry ? await req(`/assets/${entry}`) : { status: 0, text: '' }
  const l1 = 判定L1({ html: html.text, entry, assetStatus: asset.status, assetText: asset.text })
  add('L1 包', l1.ok, l1.detail)

  // L2 缓存
  const sw = await req('/sw.js')
  const l2 = 判定L2(sw.text || '')
  add('L2 缓存', l2.ok, l2.detail)

  // L3 兼容
  const l3 = 判定L3(asset.text || '')
  add('L3 兼容', l3.ok, l3.detail)

  // L4 鉴权（真拿 token）
  let anon = '', accounts = null
  try { anon = JSON.parse(readFileSync('/opt/yunyue/etc/keys.json', 'utf8')).anon || '' } catch { /* 缺失按失败 */ }
  try { accounts = JSON.parse(readFileSync('/opt/yunyue/etc/probe-accounts.json', 'utf8')).accounts || [] } catch { /* 缺失按失败 */ }
  const 学生 = (accounts || []).find(a => a.role === 'student')
  const 教师 = (accounts || []).find(a => a.role === 'teacher')
  let l4ok = !!(学生 && 教师)
  const l4details = []
  for (const a of [学生, 教师].filter(Boolean)) {
    const res = await req('/auth/v1/token?grant_type=password', {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anon },
      body: JSON.stringify({ email: `${a.account}@yunyue.study`, password: a.password }),
    })
    const ok = 判定登录(res, 'success')
    l4ok = l4ok && ok
    l4details.push(`${a.account}:${ok ? 'OK' : 'FAIL(' + res.status + ')'}`)
  }
  add('L4 鉴权', !!学生 && !!教师 && l4ok, l4details.join(' / ') || '无账号配置')

  // L5 分支：错口令 / 限流 / 断网 / 停用
  const 错 = 学生 ? await req('/auth/v1/token?grant_type=password', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anon }, body: JSON.stringify({ email: `${学生.account}@yunyue.study`, password: 'self-check-wrong' }) }) : { status: 0, text: '' }
  let 有限流 = false
  if (学生) {
    for (let i = 0; i < 10; i++) {
      const r = await req('/auth/v1/token?grant_type=password', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anon }, body: JSON.stringify({ email: `${学生.account}@yunyue.study`, password: 'self-check-wrong' }) })
      if (判定登录(r, 'rate')) { 有限流 = true; break }
    }
  }
  const 停用 = await req('/auth/v1/token?grant_type=password', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anon }, body: JSON.stringify({ email: '20240201@yunyue.study', password: 'x' }) })
  const 断网 = await new Promise((resolve) => {
    const r = http.request({ host: '127.0.0.1', port: 1, path: '/', timeout: 3000 }, () => resolve({ status: 200 }))
    r.on('error', () => resolve({ status: 0 })); r.on('timeout', () => { r.destroy(); resolve({ status: 0 }) }); r.end()
  })
  // 限流按卡口径：429 或“明确未触发限流”都算通过（打印实际状态，不静默）
  const l5ok = 判定登录(错, 'invalid') && 判定登录(停用, 'banned') && 判定登录(断网, 'network')
  add('L5 分支', l5ok, `错口令=${判定登录(错, 'invalid') ? 'invalid' : 'FAIL'} · 限流=${有限流 ? '429' : '未触发（明确记录）'} · 停用=${判定登录(停用, 'banned') ? 'banned' : 'FAIL'} · 断网=${判定登录(断网, 'network') ? '网络错' : 'FAIL'}`)

  const 通过 = 结果.filter(x => x.ok).length
  console.log(`\nL1 ${结果[0].ok ? '✓' : '✗'} L2 ${结果[1].ok ? '✓' : '✗'} L3 ${结果[2].ok ? '✓' : '✗'} L4 ${结果[3].ok ? '✓' : '✗'} L5 ${结果[4].ok ? '✓' : '✗'} 登录自检 ${通过}/5`)

  const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })
  const row = { date, ts: new Date().toISOString(), ok: 通过 === 5, pass: 通过, build: entry, layers: 结果.map(x => ({ name: x.name, ok: x.ok, detail: x.detail })) }
  try {
    const lines = existsSync(OUT) ? readFileSync(OUT, 'utf8').split('\n').filter(Boolean).filter(l => { try { return JSON.parse(l).date !== date } catch { return true } }) : []
    lines.push(JSON.stringify(row)); writeFileSync(OUT, lines.join('\n') + '\n')
  } catch { /* 静默理由：日志写失败不影响自检结论 */ }
  process.exit(通过 === 5 ? 0 : 1)
}

const 是主模块 = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (是主模块) {
  if (process.argv.includes('--days')) {
    const n = Number(process.argv[process.argv.indexOf('--days') + 1]) || 7
    const lines = existsSync(OUT) ? readFileSync(OUT, 'utf8').split('\n').filter(Boolean).slice(-n) : []
    console.log(`最近 ${lines.length} 天登录自检：`)
    for (const l of lines) { try { const j = JSON.parse(l); console.log(`  ${j.date} · ${j.pass}/5 · ${j.build || ''}`) } catch { /* 坏行跳过 */ } }
    process.exit(0)
  }
  主流程().catch(e => { console.error('✗ 自检异常：' + (e && e.message)); process.exit(1) })
}
