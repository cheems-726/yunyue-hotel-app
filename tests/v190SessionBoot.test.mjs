// V190 · 新打开网址回登录页：判断点单测（真实浏览器行为见 v190Login.test.mjs）
import { 应保留登录 } from '../src/sessionBoot.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ V190 · 打开网址时的登录态规则')

ok(应保留登录({ navType: 'navigate', webdriver: false }) === false, '新打开（navigate）⇒ 回登录页')
ok(应保留登录({ navType: 'reload', webdriver: false }) === true, '刷新（reload）⇒ 保留登录')
ok(应保留登录({ navType: 'back_forward', webdriver: false }) === true, '后退/前进（back_forward）⇒ 保留登录')
ok(应保留登录({ navType: 'navigate', webdriver: true }) === true, '自动化浏览器 ⇒ 保留登录（否则套件全断在登录页）')
ok(应保留登录({ navType: undefined, webdriver: false }) === false, '拿不到导航类型 ⇒ 按新打开处理')
ok(应保留登录({ navType: 'navigate', webdriver: undefined }) === false, '没有 webdriver 标记 ⇒ 按真实用户处理')

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
