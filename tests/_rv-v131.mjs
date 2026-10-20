// V131 反例验证（RV）：逐条拿掉修复 ⇒ 对应守门必红；还原 ⇒ 复绿
// 运行：node tests/_rv-v131.mjs      （evidence 脚本，不进 run-all）
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const 跑 = (file) => {
  try {
    const out = execFileSync(process.execPath, [path.join(APP, file)], { cwd: APP, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, out }
  } catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') } }
}
const 试一例 = (label, 文件, 旧, 新, 套件) => {
  const p = path.join(APP, 文件)
  const 备份 = readFileSync(p, 'utf8')
  if (!备份.includes(旧)) { console.log(`  ❌ 找不到靶子：${label}`); return false }
  try {
    writeFileSync(p, 备份.replace(旧, 新))
    const r = 跑(套件); const 掉红 = r.code !== 0
    writeFileSync(p, 备份); const 复绿 = 跑(套件).code === 0
    console.log(`  ${掉红 && 复绿 ? '✓' : '✗'} ${label}：拿掉后 exit=${r.code}（红=${掉红}）· 还原后绿=${复绿}`)
    return 掉红 && 复绿
  } finally { writeFileSync(p, 备份) }
}

console.log('【RV-V131】逐条靶子（每次只改一处 · 逐次还原）\n')
const 例s = []
例s.push(试一例('#1a 去掉"未押注禁用下一周"', 'src/WeeklyReport.jsx',
  'disabled={需复盘 || 需押注}', 'disabled={需复盘}', 'tests/v131Bet.test.mjs'))
例s.push(试一例('#1b 押注阈值放水（≤3 改 ≤10 满分）', 'src/bets.mjs',
  'if (d <= 3) return 10', 'if (d <= 10) return 10', 'tests/bets.test.mjs'))
例s.push(试一例('#1c 押注分并入台账合计', 'src/processScore.mjs',
  'const 项 = [承诺, 归因分, 理由条数]', 'const 项 = [承诺, 归因分, 理由条数, 押注分]', 'tests/processScore.test.mjs'))

// 批2：关键理由必填 / 三问复盘闸门
例s.push(试一例('#2a 去掉关键理由必填', 'src/DecisionPanel.jsx',
  'if (要求理由 && !理由合格(理由))', 'if (false)', 'tests/v131Thinking.test.mjs'))
例s.push(试一例('#2b 去掉三问复盘闸门', 'src/WeeklyReport.jsx',
  'const 需复盘 = !本周复盘完成(复盘历史, result && result.week)', 'const 需复盘 = false', 'tests/v131Thinking.test.mjs'))
例s.push(试一例('#2c 三问最短改 1 字', 'src/weekReview.mjs',
  'export const 每题最短 = 20', 'export const 每题最短 = 1', 'tests/weekReview.test.mjs'))
console.log(`\n结果: ${例s.filter(Boolean).length} / ${例s.length} 条 RV 成立`)
process.exit(例s.every(Boolean) ? 0 : 1)
