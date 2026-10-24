// V154 批1 RV · 把"真拖"改成"设 value 不走事件" ⇒ 交互断言红；还原 ⇒ 复绿
// 运行：node tests/_rv-v154.mjs （自动还原；中断请 git checkout -- src/BetCard.jsx src/DecisionPanel.jsx）
import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

let pass = 0, fail = 0
const ok = (c, n) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n) } }
const run = () => { const r = spawnSync(process.execPath, ['tests/interactionV154.test.mjs'], { encoding: 'utf8' }); return (r.stdout || '') + (r.stderr || '') }
const build = () => { const r = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { encoding: 'utf8' }); if (r.status !== 0) throw new Error('RV 构建失败：' + (r.stderr || '').slice(0, 200)) }
const patch = (file, from, to, bak) => {
  copyFileSync(file, bak)
  const s = readFileSync(file, 'utf8')
  if (!s.includes(from)) { unlinkSync(bak); throw new Error('RV 锚缺失：' + file) }
  writeFileSync(file, s.split(from).join(to), 'utf8')
  build()   // 套件跑的是 dist ⇒ 改 src 后必须重建（否则 RV 打在旧包上 = 假红/假绿）
}
const restore = (file, bak) => { copyFileSync(bak, file); unlinkSync(bak); build() }

const B = 'src/BetCard.jsx', BB = 'scripts/_rv154-bet.bak'
try {
  // 模拟"假拖"：滑块改成只被程序设值、不接用户事件（onChange 摘除 ⇒ 真拖断言必红）
  patch(B, 'onChange={e => set出租率(Number(e.target.value))}', 'onChange={e => {}}', BB)
  const out = run()
  ok(/✗ FAIL: ① /.test(out), 'RV-1 摘除滑块 onChange ⇒ ① 组断言红（真拖/显示同步至少一条红 ⇒ 假拖可判死）')
} finally { restore(B, BB) }

ok(!/✗ FAIL/.test(run()), 'RV-2 还原后 interactionV154 复绿')
console.log(`\nRV 结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
