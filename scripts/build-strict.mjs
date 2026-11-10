// D367 · 严格口径构建（证据链专用包，不部署）
// 产出 dist-strict/ ⇒ 该包内演示分支被物理删除，严格分支完整保留（可核对"未采/待补"证据仍在源里）
import { spawnSync } from 'node:child_process'
const r = spawnSync('npm.cmd', ['exec', '--', 'vite', 'build', '--outDir', 'dist-strict'], {
  stdio: 'inherit', shell: false, env: { ...process.env, YUNYUE_DEMO_FILL: '0' },
})
process.exit(r.status ?? 1)
