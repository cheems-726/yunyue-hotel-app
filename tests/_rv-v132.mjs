// V132 反例验证：逐条拿掉返工/展示 ⇒ 对应守门必红；还原 ⇒ 复绿
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const 跑 = (file) => { try { execFileSync(process.execPath, [path.join(APP, file)], { cwd: APP, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); return 0 } catch (e) { return e.status ?? 1 } }
const 试一例 = (label, 文件, 旧, 新, 套件) => {
  const p = path.join(APP, 文件); const 备份 = readFileSync(p, 'utf8')
  if (!备份.includes(旧)) { console.log(`  ❌ 找不到靶子：${label}`); return false }
  try {
    writeFileSync(p, 备份.replace(旧, 新))
    const 红 = 跑(套件) !== 0
    writeFileSync(p, 备份)
    const 绿 = 跑(套件) === 0
    console.log(`  ${红 && 绿 ? '✓' : '✗'} ${label}：拿掉后红=${红} · 还原后绿=${绿}`)
    return 红 && 绿
  } finally { writeFileSync(p, 备份) }
}
console.log('【RV-V132】逐条靶子\n')
const 例s = [
  试一例('#1 认领"本步可继续"恒 true', 'src/Claim.jsx', 'const 可继续 = 本步可继续(current.key, 取舍, 取舍理由, 理由合格)', 'const 可继续 = true', 'tests/v132.test.mjs'),
  试一例('#2 删周报"你的开局选择"', 'src/WeeklyReport.jsx', '你的开局选择（6 步取舍 · 点开）', '开局（点开）', 'tests/v132.test.mjs'),
  试一例('#4 删 entryProbe 标准尾行', 'tests/_v109_entry_probe.mjs', 'console.log(`结果: ${通过数} 通过 / ${失败数} 失败`)', '', 'tests/v132.test.mjs'),
  试一例('#5 台账迟押显示回分数', 'src/processScore.mjs', "押注迟押 ? '迟' : 押注分", '押注分', 'tests/processScore.test.mjs'),
]
console.log(`\n结果: ${例s.filter(Boolean).length} / ${例s.length} 条 RV 成立`)
process.exit(例s.every(Boolean) ? 0 : 1)
