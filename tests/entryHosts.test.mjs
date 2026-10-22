// V142 §1 · 入口域名白名单（单源 / 跳转地址 / 登录页接线）
import { readFileSync } from 'node:fs'
import { 合法入口, 正式入口, 是否本系统, 跳转地址 } from '../src/entryHosts.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
console.log('▶ V142 · 入口域名守卫')

ok(合法入口.length === 3 && 合法入口.includes('test.2026911301.xyz') && 合法入口.includes('localhost') && 合法入口.includes('127.0.0.1'), '白名单 = test/localhost/127.0.0.1')
ok(是否本系统('test.2026911301.xyz') && 是否本系统('localhost') && 是否本系统('127.0.0.1'), '白名单 3 个 host 通过')
ok(是否本系统('TEST.2026911301.xyz'), '大小写不敏感')
ok(!是否本系统('www.2026911301.xyz') && !是否本系统('') && !是否本系统(null), 'www / 空值判红')
ok(正式入口 === 'https://test.2026911301.xyz', '正式入口 = https://test.2026911301.xyz')
ok(跳转地址({ pathname: '/login', search: '?a=1' }) === 'https://test.2026911301.xyz/login?a=1', '跳转保留 path/search')
ok(跳转地址({}) === 'https://test.2026911301.xyz/', '空 location ⇒ 根路径')

const app = readFileSync('src/App.jsx', 'utf8')
ok(/data-host-guard="1"/.test(app) && /data-host-jump="1"/.test(app), '登录页有旧站红横幅 + 一键跳转')
ok(/data-diag-host="1"/.test(app) && /非本系统（旧站）/.test(app), '诊断面板显示当前域名/是否本系统')
ok(/from '\.\/entryHosts\.mjs'/.test(app), 'App 从 entryHosts 单源导入')
ok(!app.includes("'test.2026911301.xyz'"), 'App 不另写白名单字面量（单源）')

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
