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
  // #217：追加行必须带「| 日期 时分」前缀（verify 只认 ^\|\s*YYYY-MM-DD 的行，否则写了不参与判定）
  ok(/printf '\| \$\{时间\} \| frontend \|/.test(deploy), 'deploy 追加台账行带「| 日期时分」前缀（#217 · 落进 verify 的取行范围）')
  ok(!/printf '%s \| frontend/.test(deploy), '无参 %s 写法已清除（曾产出无日期行 ⇒ verify 全跳过）')
  // 判据等价自检：本机实测 deploy 产出行能被 verify 的取行正则命中（把 verify 里的正则原样抽出来跑）
  const verify = rd('scripts/server/verify-versions.sh')
  const 取行m = /grep -E '([^']+)'/ .exec(verify)
  ok(!!取行m && /\^\\\|/.test(取行m[1]), 'verify-versions 取行正则仍在（^\\|+日期）')
  const 样例 = `| ${new Date().toISOString().replace('T', ' ').slice(0, 16)} | frontend | /var/www/html/assets/index-x.js | abc | 来源 b3e8ed7 | 迁移 12/12 已应用 | DSH`
  ok(!!取行m && new RegExp(取行m[1]).test(样例), 'deploy 产出格式的样例行能被 verify 取行正则命中（两端同源）')

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
