// V140 §1/§2/§3 · 手机白屏兼容守门
// 判据：① 产物 ?./?? 真实出现 0（排除 "? .92" 这类三元小数）② index.html 静态骨架+ES5 兜底
//       ③ 诊断面板含 UA/内核/SW
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { 内核文本, base是旧云端 } from '../src/loginReliability.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ V140 · 手机白屏兼容（es2017 / 静态骨架 / 兜底面板）')

console.log('\n[①] 构建目标与产物语法')
{
  const cfg = readFileSync('vite.config.js', 'utf8')
  ok(/build:\s*\{\s*target:\s*'es2017'/.test(cfg), "vite.config.js 明确 build.target='es2017'")
  ok(!existsSync('dist/index.html') ? false : true, 'dist 已构建（run-all 的 build 步负责）')
  const entry = readdirSync('dist/assets').find(f => /^index-.*\.js$/.test(f))
  ok(!!entry, '找到入口包')
  if (entry) {
    const s = readFileSync('dist/assets/' + entry, 'utf8')
    const 空值 = (s.match(/\?\?/g) || []).length
    const 动态导入 = (s.match(/import\(/g) || []).length
    const 真可选链 = (s.match(/\?\.(?![0-9])/g) || []).length
    const 全部问点 = [...s.matchAll(/\?\./g)]
    const 都是三元小数 = 全部问点.every(m => /[0-9]/.test(s[m.index + 2] || ''))
    console.log(`    [产物] ${entry} · ${s.length} B · ??=${空值} · 真可选链=${真可选链} · 裸 ?.=${全部问点.length}（三元小数=${都是三元小数}）`)
    ok(空值 === 0, '产物 ?? 出现 0 次（空值合并已降级）')
    ok(真可选链 === 0, '产物真实可选链出现 0 次（排除 "? .92" 三元小数）')
    ok(动态导入 === 0, '产物无 import() 动态导入（Chromium<63 可解析）')
    ok(都是三元小数, `裸 ?. 的每一处都是 "?.数字" 的三元写法，不是可选链（共 ${全部问点.length} 处）`)
  }
}

console.log('\n[②] index.html 静态骨架 + ES5 兜底')
{
  const src = readFileSync('index.html', 'utf8')
  const dist = existsSync('dist/index.html') ? readFileSync('dist/index.html', 'utf8') : ''
  for (const [name, s] of [['源码', src], ['产物', dist]]) {
    ok(/id="boot"/.test(s), `${name}：有静态骨架 #boot`)
    ok(/<noscript>/.test(s), `${name}：有 <noscript>`)
    ok(/addEventListener\('error'/.test(s) && /unhandledrejection/.test(s), `${name}：有 error/unhandledrejection 兜底`)
    ok(/id="boot-diag"/.test(s), `${name}：有「诊断」按钮`)
  }
  // 入口前的内联兜底必须是 ES5（旧 X5 解析不了箭头/可选链/模板串）
  const m = /<script>\s*\(function \(\) \{[\s\S]*?\}\)\(\);\s*<\/script>/.exec(src)
  ok(!!m, '找到内联兜底脚本')
  if (m) {
    const inline = m[0]
    ok(!/=>/.test(inline), '兜底脚本不用箭头函数')
    ok(!/\?\./.test(inline) && !/\?\?/.test(inline), '兜底脚本不用 ?./??')
    ok(!/`/.test(inline), '兜底脚本不用模板字符串')
    ok(/textarea/.test(inline) && /构建号/.test(inline) && /UA/.test(inline), '面板含可复制 textarea + 构建号 + UA')
  }
}

console.log('\n[②-2] Service Worker（V139 §3）：skipWaiting/claim/构建号入缓存 + API 不走缓存')
{ 
  const sw = readFileSync('public/sw.js', 'utf8')
  ok(/skipWaiting\(\)/.test(sw) && /clients\.claim\(\)/.test(sw), 'SW 有 skipWaiting + clients.claim（新版本能接管）')
  ok(/__BUILD_VERSION__/.test(sw) && /CACHE_NAME/.test(sw), 'SW 缓存名随构建版本变化（旧 cache 会被清）')
  ok(/API_RE/.test(sw) && /return/.test(sw), 'SW 对 /rest /auth /realtime 不 respondWith（不拿缓存假活着）')
}

console.log('\n[③] 诊断面板：UA / 内核 / SW')
{
  const app = readFileSync('src/App.jsx', 'utf8')
  ok(/data-login-diag="1"/.test(app), '登录页有诊断面板')
  ok(/UA：/.test(app) && /内核：/.test(app) && /Service Worker：/.test(app), '面板含 UA/内核/SW 三行')
  ok(/强制更新/.test(app) && /unregister\(\)/.test(app) && /caches\.delete/.test(app), '面板含强制更新（unregister + 清 cache）')
  ok(/data-diag-build="1"/.test(app) && /data-diag-base="1"/.test(app), '面板含构建号/接口地址')
  ok(/复制诊断信息/.test(app), '面板含一键复制')

  ok(内核文本('Mozilla/5.0 (Linux; Android 14) Chrome/77.0.3865.120 Mobile MicroMessenger/8.0') === 'Chrome/77 · X5/XWeb', '内核文本：MicroMessenger+Android ⇒ Chrome/77 · X5/XWeb')
  ok(内核文本('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17.0 Mobile Safari') === 'iOS WebKit', '内核文本：iPhone Safari ⇒ iOS WebKit')
  ok(base是旧云端('https://jgytwxaeeezmdbxfsyvs.supabase.co') === true, 'base 判定：supabase.co ⇒ 旧云端')
  ok(base是旧云端('https://test.2026911301.xyz') === false, 'base 判定：同源域名 ⇒ 正常')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
