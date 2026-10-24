// V152 RV · 三条反向验证（改源 ⇒ 判据红；还原 ⇒ 复绿）
//   RV-§1 已内建在 semesterResult.test.mjs（改 history ⇒ 最好/最差/曲线跟着变 · 行为级）
//   本脚本做：
//     RV-§2 把迁移默认 false→true ⇒ v152Continue「默认关」红
//     RV-§3a 删掉 PriceElastic 的 onRecord 调用 ⇒ priceElastic「RV 锚」红（记录判据断链）
//     RV-§3b 删掉 App 的成果页入口锚 ⇒ v152Continue「入口锚」红
// 运行：node tests/_rv-v152.mjs（自动还原；中断请 git checkout -- 对应文件，会丢 V152 改动）
import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

let pass = 0, fail = 0
const ok = (c, n) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n) } }
const run = (suite) => {
  const r = spawnSync(process.execPath, ['tests/' + suite], { encoding: 'utf8' })
  return (r.stdout || '') + (r.stderr || '')
}
const patch = (file, from, to, bak) => {
  copyFileSync(file, bak)
  const s = readFileSync(file, 'utf8')
  if (!s.includes(from)) { unlinkSync(bak); throw new Error('RV 锚缺失：' + file + ' :: ' + from) }
  writeFileSync(file, s.split(from).join(to), 'utf8')
}
const restore = (file, bak) => { copyFileSync(bak, file); unlinkSync(bak) }

const M = 'supabase-migration-v152-continue.sql', MB = 'scripts/_rv152-m.bak'
const P = 'src/games/PriceElastic.jsx', PB = 'scripts/_rv152-p.bak'
const A = 'src/App.jsx', AB = 'scripts/_rv152-a.bak'
try {
  patch(M, 'continue_enabled boolean not null default false', 'continue_enabled boolean not null default true', MB)
  ok(/默认关/.test(run('v152Continue.test.mjs')) && /✗ FAIL/.test(run('v152Continue.test.mjs')), 'RV-§2 迁移默认改 true ⇒ v152Continue 红（开关默认关判据能判死）')
} finally { restore(M, MB) }
try {
  patch(P, 'onRecord && onRecord(', 'onRecord && void 0 && onRecord(', PB)
  ok(/✗ FAIL/.test(run('priceElastic.test.mjs')), 'RV-§3a 删掉 onRecord 调用 ⇒ priceElastic RV 锚红（记录判据断链）')
} finally { restore(P, PB) }
try {
  patch(A, 'data-semester-result-entry', 'data-result-entry-rv', AB)
  ok(/✗ FAIL/.test(run('v152Continue.test.mjs')), 'RV-§3b 删掉成果页入口锚 ⇒ v152Continue 红（入口判据能判死）')
} finally { restore(A, AB) }

ok(!/✗ FAIL/.test(run('v152Continue.test.mjs')), '还原后 v152Continue 复绿')
ok(!/✗ FAIL/.test(run('priceElastic.test.mjs')), '还原后 priceElastic 复绿')
console.log(`\nRV 结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
