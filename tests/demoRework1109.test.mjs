// T2（2026-11-09）· 白屏根因两件：旧 SW 自动换新 + 诊断面板不占首屏
// 运行：node tests/demoRework1109.test.mjs   （挂 run-all fast）
//
// 判据（卡 T2）：
//   ① 换包后不清缓存 ⇒ 自动换新（版本比对 + 注销 + 清缓存 + 只 reload 一次）
//   ② 首屏顶部没有诊断面板占位；「诊断」是可点开的小按钮
//   ③ SW 缓存名带构建版本（vite 注时间戳）
//   ④ 连点刷新不出现 reload 循环（sessionStorage 闸）
import { readFileSync } from 'node:fs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const vite = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8')

console.log('▶ T2 · 旧 SW 自动换新 + 诊断不占首屏')

console.log('\n[① 旧 SW 换新]')
{
  ok(/sw-cache-seen/.test(html), '记录上次 SW 缓存版本（localStorage.sw-cache-seen）')
  ok(/fetch\('\/sw\.js',\s*\{\s*cache:\s*'no-store'\s*\}\)/.test(html), '拉 /sw.js 绕过缓存（no-store）')
  ok(/getRegistrations\(\)/.test(html) && /unregister\(\)/.test(html), '版本变 ⇒ 注销旧 SW')
  ok(/caches\.keys\(\)/.test(html) && /caches\.delete\(/.test(html), '版本变 ⇒ 清旧 cache')
  ok(/location\.reload\(\)/.test(html), '版本变 ⇒ 只重载一次')
  ok(/sw-healed/.test(html) && /sessionStorage/.test(html), 'sessionStorage 闸防 reload 循环')
  ok(/疑似旧SW = !seen && !!navigator\.serviceWorker\.controller/.test(html), '老用户（无 seen 记录 + 已有 SW 接管）也会触发一次清理（换新功能上线前的旧 SW）')
}

console.log('\n[② 诊断面板不占首屏]')
{
  // 旧实现是全屏：position:fixed + top:0 + bottom:0
  ok(!/position:fixed;left:0;right:0;top:0;bottom:0/.test(html), '不再是全屏 fixed 面板（旧实现 top:0;bottom:0）')
  ok(/bottom:0/.test(html) && /max-height:46vh/.test(html), '改为底部条 + 限高（不占满屏）')
  ok(/诊断 ▸/.test(html), '折叠按钮「诊断 ▸」')
  ok(/more\.style\.cssText = 'display:none'/.test(html), '折叠区默认收起')
  ok(/收起 ▾/.test(html), '可再次收起（开合双向）')
}

console.log('\n[③ SW 缓存名带构建版本]')
{
  ok(/CACHE_NAME = 'hotel-sim-__BUILD_VERSION__'/.test(sw), 'sw.js CACHE_NAME 含 __BUILD_VERSION__ 占位')
  ok(/__BUILD_VERSION__/.test(vite) && /Date\.now\(\)/.test(vite), 'vite 构建时注入时间戳（每次部署必变）')
  ok(/caches\.delete\(k\)/.test(sw), 'activate 时删除旧版本 cache')
}

console.log('\n[④ 不回归：SW 注册仍在]')
{
  ok(/serviceWorker\.register\('\/sw\.js'\)/.test(html), '仍注册 /sw.js')
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
