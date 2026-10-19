// V129-R109-3 · Service Worker 离线策略：API 永不复用缓存 · 只对导航/静态资源回退 · 版本随构建
// 运行：node tests/swPolicy.test.mjs   （挂 run-all fast）
import { readFileSync, existsSync } from 'node:fs'
import vm from 'node:vm'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const code = readFileSync('public/sw.js', 'utf8')
const handlers = {}
const store = new Map([
  ['https://app.x/index.html', 'INDEX'],
  ['/index.html', 'INDEX'],   // caches.match('/index.html') 在 SW 里按 scope 解析
  ['https://app.x/assets/app.js', 'JS'],
])
const ctx = {
  self: { addEventListener: (n, f) => { handlers[n] = f }, skipWaiting() {}, clients: { claim() {} } },
  caches: {
    open: async () => ({ addAll: async () => {}, put: async () => {} }),
    keys: async () => ['old-1', 'old-2'],
    delete: async () => true,
    match: async (req) => store.get(typeof req === 'string' ? req : req.url),
  },
  fetch: async () => { throw new TypeError('Failed to fetch') },   // 模拟离线
  Response: { error: () => '@ERROR@' },
  URL, Promise, console, setTimeout, clearTimeout,
}
vm.runInNewContext(code, ctx)

function 发请求(req) {
  let called = false, p = null
  handlers.fetch({ request: req, respondWith: (x) => { called = true; p = x } })
  return { called, p }
}

console.log('▶ V129-R109-3 · Service Worker 离线策略')

console.log('\n[①] API 一律走网络（断网必须 reject，不拿缓存）')
{
  for (const u of ['https://x.supabase.co/rest/v1/game_states', 'https://x.supabase.co/auth/v1/token', 'https://x.supabase.co/realtime/v1/websocket']) {
    const r = 发请求({ method: 'GET', url: u, mode: 'cors', destination: '' })
    ok(r.called === false, `${u.replace('https://x.supabase.co', '')} ⇒ 不 respondWith（浏览器直接 reject）`)
  }
  const r = 发请求({ method: 'GET', url: 'https://app.x/rest/v1/x', mode: 'cors', destination: '' })
  ok(r.called === false, '同源 /rest 也一样（前缀规则）')
}

console.log('\n[②] 离线回退：导航 → 缓存页面；静态资源 → 缓存；其它 → error')
{
  const nav = 发请求({ method: 'GET', url: 'https://app.x/some/route', mode: 'navigate', destination: 'document' })
  ok(nav.called === true, '导航请求会 respondWith（否则离线白屏）')
  ok((await nav.p) === 'INDEX', '导航离线 ⇒ 回退 /index.html 缓存')

  const js = 发请求({ method: 'GET', url: 'https://app.x/assets/app.js', mode: 'cors', destination: 'script' })
  ok((await js.p) === 'JS', '静态 JS 离线 ⇒ 用缓存（否则页面打不开）')

  const other = 发请求({ method: 'GET', url: 'https://app.x/api-ish', mode: 'cors', destination: '' })
  ok((await other.p) === '@ERROR@', '非导航/非静态 ⇒ Response.error()（不伪装成功）')
}

console.log('\n[③] 缓存版本随构建变化')
{
  ok(/CACHE_NAME = 'hotel-sim-__BUILD_VERSION__'/.test(code), 'sw.js 用构建占位符作缓存版本')
  const cfg = readFileSync('vite.config.js', 'utf8')
  ok(/name: 'sw-build-version'/.test(cfg) && /__BUILD_VERSION__/.test(cfg), 'vite 构建时替换 __BUILD_VERSION__')
  if (existsSync('dist/sw.js')) {
    const dist = readFileSync('dist/sw.js', 'utf8')
    ok(!dist.includes('__BUILD_VERSION__'), '构建产物里的占位符已替换')
    ok(/CACHE_NAME = 'hotel-sim-\d{10,}'/.test(dist), '构建产物缓存版本是时间戳数字')
  } else {
    console.log('  - dist/sw.js 不存在（跳过产物断言；build 后会自动检查）')
  }
}

console.log('\n[④] 旧版本缓存会被清（activate）')
{
  ok(/keys.filter\(\(k\) => k !== CACHE_NAME\)/.test(code) && /caches\.delete\(k\)/.test(code), 'activate 清掉所有非当前版本缓存')
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
