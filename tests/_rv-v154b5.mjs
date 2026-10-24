// V154 批5 RV · 去掉 manualChunks 拆包 ⇒ 入口包 >800KB ⇒ 判据①红；还原 ⇒ 复绿
// 运行：node tests/_rv-v154b5.mjs （自动还原 vite.config.js 并重建）
import { readFileSync, writeFileSync, copyFileSync, unlinkSync, statSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

let pass = 0, fail = 0
const ok = (c, n) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n) } }
const V = 'vite.config.js', BAK = 'scripts/_rv154b5.bak'
const build = () => { const r = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { encoding: 'utf8' }); if (r.status !== 0) throw new Error('RV 构建失败') }
const 入口大小 = () => {
  const f = readdirSync('dist/assets').filter(x => /^index-.*\.js$/.test(x)).map(x => statSync('dist/assets/' + x).size)
  return Math.max(...f)
}
try {
  copyFileSync(V, BAK)
  let s = readFileSync(V, 'utf8')
  const i = s.indexOf('    // ★ V154 批5：vendor 拆包')
  const j = s.indexOf('  },\n  server:', i)
  if (i < 0 || j < 0) throw new Error('RV 锚缺失：manualChunks 块')
  // 摘掉批5整段（注释 + rollupOptions + build 收口），回到单文件主包形态
  s = s.slice(0, i) + "    target: 'es2017',\n  },\n" + s.slice(j + '  },\n'.length)
  writeFileSync(V, s, 'utf8')
  build()
  const size = 入口大小()
  ok(size > 800 * 1024, 'RV-1 去掉拆包 ⇒ 入口包 ' + (size / 1024).toFixed(0) + 'KB > 800KB（判据①能判死）')
  const r2 = spawnSync(process.execPath, ['tests/perfV154.test.mjs'], { encoding: 'utf8' })
  ok(/✗ FAIL: ① 入口包/.test((r2.stdout || '') + (r2.stderr || '')), 'RV-2 perfV154 判据①红')
} finally {
  copyFileSync(BAK, V)
  unlinkSync(BAK)
  build()
}
const size2 = 入口大小()
ok(size2 <= 800 * 1024, `RV-3 还原后入口包 ${(size2 / 1024).toFixed(0)}KB ≤ 800KB（复绿）`)
console.log(`\nRV 结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
