// V154 批4 · 运维收口脚本静态/契约断言（脚本在服务器执行 ⇒ 本地只验结构与接线）
// 运行：node tests/opsCloseV154.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const rd = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8')

console.log('▶ V154 批4 · 运维收口（OSS 备份链 / VERSIONS / 旧包清理 / monitor 接入）')
{
  // ① 异地备份链：本地 dump 成功 ⇒ 自动 offsite；未配置 ⇒ SKIP 不影响本地成败
  const backup = rd('scripts/server/backup.sh')
  ok(/offsite-backup\.sh "\$DBF"/.test(backup), 'backup.sh：dump 成功后自动调 offsite-backup（OSS 链上）')
  ok(/SKIP offsite 未配置/.test(backup) && /exit 2/.test(rd('scripts/server/offsite-backup.sh')), '未配置 OSS ⇒ exit 2 SKIP（不把本地备份拖成失败）')
  ok(/30 天|30天|lifecycle|生命周期/.test(rd('scripts/server/offsite-backup.sh')), 'offsite 脚本带 30 天生命周期说明/命令')
  // 恢复对账闭环：OSS → restore-drill
  const drill = rd('scripts/server/drill-from-oss.sh')
  ok(/restore-drill\.sh/.test(drill), 'drill-from-oss：拉 OSS 最新 dump ⇒ 交 restore-drill 对账（临时库逐表计数）')
  ok(/exit 2/.test(drill) && /未配置/.test(drill), 'OSS 未配置/桶空 ⇒ SKIP（exit 2）')
  // monitor 接 OSS 状态
  const monitor = rd('scripts/server/monitor.mjs')
  ok(/OSS 桶里没有任何 dump（异地备份断链）/.test(monitor), 'monitor：OSS 桶空 ⇒ 告警（异地备份断链）')
  ok(/oss: OSS状态|oss: `/.test(monitor) || /row = \{\n  oss: OSS状态/.test(monitor) || /oss: OSS状态/.test(monitor), 'monitor：OSS 状态进日报 row（未配置如实记 SKIP）')

  // ② VERSIONS 接部署
  const deploy = rd('scripts/server/deploy.mjs')
  ok(/VERSIONS\.md 已登记|VERSIONS\.md; tail -1/.test(deploy), 'deploy：第⑥步登记 /opt/yunyue/VERSIONS.md（包名/sha256/来源）')
  ok(/来源 \$\{来源\}/.test(deploy) || /来源 \$SOURCE/.test(deploy) || /来源 \$\{来源\}|来源 \$\{GIT\}/.test(deploy) || /git rev-parse --short HEAD/.test(deploy), 'VERSIONS 行带来源 commit（verify-versions.sh 可核对）')

  // ③ 旧包清理接部署（第④步解包后）
  ok(/prune-assets\.sh/.test(deploy), 'deploy：解包后跑 prune-assets（assets 只留在用 + 最近两批）')
  ok(/只留当前构建|最近 2 个构建|≤ 12/.test(rd('scripts/server/prune-assets.sh')), 'prune-assets：保留策略在脚本里（在用 + 最近两批 · 不直接删）')

  // ④ opscheck ⑩ + 登录自检进 monitor
  ok(/opscheck ⑩|残留旧云端地址/.test(monitor), 'monitor：opscheck ⑩（旧云端残留）每日盯')
  ok(/loginSelfCheck\.mjs/.test(monitor) && /登录自检未过 5\/5/.test(monitor), 'monitor：登录自检 5/5 每日跑（失败进告警）')

  // 脚本语法护栏（外层 shell 已 bash -n；这里再钉不可变约定）
  ok(/set -uo pipefail/.test(backup) && /set -uo pipefail/.test(drill), 'shell 脚本保持 set -uo pipefail（错就退出）')
  ok(!/rm -rf\s+\/(var\/www\/html)?\s*$/.test(rd('scripts/server/prune-assets.sh')), 'prune-assets 不做裸 rm -rf（移 _old 观察）')
}
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
