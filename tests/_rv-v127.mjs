// V127 反例验证（RV）：四处修复逐次拿掉 ⇒ 对应守门必红；还原 ⇒ 复绿
// 运行：node tests/_rv-v127.mjs      （evidence 脚本，不进 run-all）
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(APP, '..')

const 跑 = (file) => {
  try {
    const out = execFileSync(process.execPath, [path.join(APP, file)], { cwd: APP, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') }
  }
}

const 试一例 = (label, 文件, 旧, 新, 套件) => {
  const p = path.join(APP, 文件)
  const 备份 = readFileSync(p, 'utf8')
  if (!备份.includes(旧)) { console.log(`  ❌ 找不到靶子：${label}`); return false }
  try {
    writeFileSync(p, 备份.replace(旧, 新))
    const r = 跑(套件)
    const 掉红 = r.code !== 0
    writeFileSync(p, 备份)
    const 复绿 = 跑(套件).code === 0
    console.log(`  ${掉红 && 复绿 ? '✓' : '✗'} ${label}：拿掉后 exit=${r.code}（红=${掉红}）· 还原后绿=${复绿}`)
    return 掉红 && 复绿
  } finally {
    writeFileSync(p, 备份)
  }
}

console.log('【RV-V127】四处靶子（每次只改一处 · 逐次还原）\n')
const 结果 = [
  试一例('#1 流水改回无条件写', 'scripts/host/tick.mjs',
    'if (!DRY && r.advanced) {\n      await 记流水(',
    'if (!DRY) {\n      await 记流水(', 'tests/hostTick.test.mjs'),
  试一例('#2 平均口碑加回 /20', 'src/TeacherDashboard.jsx',
    "avgRating != null ? avgRating.toFixed(1) : '—'",
    "avgRating != null ? (avgRating / 20).toFixed(1) : '—'", 'tests/teacherOverview.test.mjs'),
  试一例('#3 标签改回旧文案', 'src/TeacherDashboard.jsx',
    "l: '本周已完成决策'", "l: '全班已完成决策'", 'tests/teacherOverview.test.mjs'),
  试一例('#4 判据写回 classDay+7', path.relative(APP, path.join(ROOT, '4-审计与报告/交接包-20261018-本轮全量与双端任务.md')),
    '客户端 `week+1`', '客户端 `classDay +7`', 'tests/weekRollover.test.mjs'),
]
console.log(`\n结果: ${结果.filter(Boolean).length} / ${结果.length} 条 RV 成立`)
process.exit(结果.every(Boolean) ? 0 : 1)
