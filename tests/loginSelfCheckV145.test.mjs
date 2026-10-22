// V145 §2 · 登录自检 5/5：逐层判定（故障夹具只翻该层）
import { readFileSync } from 'node:fs'
import { 判定L1, 判定L2, 判定L3, 判定登录 } from '../scripts/server/loginSelfCheck.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
console.log('▶ V145 · 登录自检 5/5')

const entry = 'index-abc12345-abcdef12.js'
const goodHtml = `<script type="module" src="/assets/${entry}"></script>`
const goodJs = 'var a=1;'
console.log('\n[L1 包]')
{
  ok(判定L1({ html: goodHtml, entry, assetStatus: 200, assetText: goodJs }).ok, '正常包 ⇒ L1 绿')
  ok(!判定L1({ html: goodHtml, entry, assetStatus: 200, assetText: 'x jgytwxaeeezmdbxfsyvs y' }).ok, '塞回旧云端 ⇒ L1 红')
  ok(!判定L1({ html: goodHtml, entry: 'index-abc12345.js', assetStatus: 200, assetText: goodJs }).ok, '没有 hash8 ⇒ L1 红')
  ok(!判定L1({ html: goodHtml, entry, assetStatus: 404, assetText: '' }).ok, '入口包 404 ⇒ L1 红')
}

console.log('\n[L2 缓存]')
{
  const now = Date.now()
  const goodSw = `const CACHE_NAME='hotel-sim-${now}'; self.skipWaiting(); clients.claim(); API_RE`
  ok(判定L2(goodSw, now).ok, '当前构建号 + 接管 + API 排除 ⇒ L2 绿')
  ok(!判定L2(goodSw.replace(String(now), '__BUILD_VERSION__'), now).ok, '构建号未替换 ⇒ L2 红')
  ok(!判定L2(`const CACHE_NAME='hotel-sim-${now - 61 * 86400000}'; self.skipWaiting(); clients.claim(); API_RE`, now).ok, '缓存版本 61 天前 ⇒ L2 红')
  ok(!判定L2(goodSw.replace('clients.claim();', ''), now).ok, '没有 clients.claim ⇒ L2 红')
}

console.log('\n[L3 兼容]')
{
  ok(判定L3(goodJs).ok, '普通 ES5/ES2017 ⇒ L3 绿')
  ok(!判定L3('var a = b?.c;').ok, '产物含 ?. ⇒ L3 红')
  ok(!判定L3('var a = b ?? c;').ok, '产物含 ?? ⇒ L3 红')
  ok(!判定L3("import('./x.js')").ok, '产物含 import() ⇒ L3 红')
}

console.log('\n[L4/L5 判定]')
{
  ok(判定登录({ status: 200, text: '{"access_token":"x"}' }, 'success'), 'success：200 + access_token')
  ok(!判定登录({ status: 200, text: '{}' }, 'success'), 'success：无 token 判红')
  ok(判定登录({ status: 400, text: '{"error_code":"invalid_credentials"}' }, 'invalid'), 'invalid_credentials')
  ok(判定登录({ status: 400, text: '{"error_code":"user_banned"}' }, 'banned'), 'user_banned')
  ok(判定登录({ status: 0, text: '' }, 'network'), '网络错 status=0')
  ok(判定登录({ status: 429, text: '' }, 'rate'), '429 限流')
}

console.log('\n[接线]')
{
  const deploy = readFileSync('scripts/server/deploy.mjs', 'utf8')
  const monitor = readFileSync('scripts/server/monitor.mjs', 'utf8')
  ok(/loginSelfCheck\.mjs/.test(deploy) && /⑤/.test(deploy), 'deploy.mjs 第⑤步接自检')
  ok(/loginSelfCheck\.mjs/.test(monitor), 'monitor 每日接自检')
  ok(/--days/.test(readFileSync('scripts/server/loginSelfCheck.mjs', 'utf8')), '自检脚本支持 --days 回查')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
