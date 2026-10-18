// V125 守门的反例验证（RV）：把每条修复逐次"拿掉" ⇒ v125Ui 必须变红；还原 ⇒ 复绿
// 运行：node tests/_rv-v125.mjs      （evidence 脚本，不进 run-all）
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const 跑 = () => {
  try {
    const out = execFileSync(process.execPath, [path.join(APP, 'tests', 'v125Ui.test.mjs')], { cwd: APP, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') }
  }
}

const 试一例 = (label, 文件, 旧, 新) => {
  const p = path.join(APP, 文件)
  const 备份 = readFileSync(p, 'utf8')
  if (!备份.includes(旧)) { console.log(`  ❌ 找不到靶子：${label}`); return false }
  try {
    writeFileSync(p, 备份.replace(旧, 新))
    const r = 跑()
    const 掉红 = r.code !== 0
    const 还原 = readFileSync(p, 'utf8')
    writeFileSync(p, 备份)
    const 复绿 = 跑().code === 0
    console.log(`  ${掉红 && 复绿 ? '✓' : '✗'} ${label}：拿掉后 exit=${r.code}（红=${掉红}）· 还原后绿=${复绿}`)
    return 掉红 && 复绿
  } finally {
    writeFileSync(p, 备份)
  }
}

console.log('【RV-V125】四处靶子（每次只改一处 · 逐次还原）\n')
const 结果 = [
  试一例('#8 cloudState 去掉 hotelName', 'src/App.jsx', 'report, hotelName, week, history', 'report, week, history'),
  试一例('#8 登录不恢复 hotelName', 'src/App.jsx', "setHotelName(cloudSaved.hotelName || '')", "setHotelName('')"),
  试一例('#7 教师端改回「全班决策数」', 'src/TeacherDashboard.jsx', "l: '全班已完成决策'", "l: '全班决策数'"),
  试一例('#2 去掉首屏待做提示', 'src/App.jsx', '本周还有 ${18 - doneCount} 项决策待做 · 去决策 →', ''),
]
console.log(`\n结果: ${结果.filter(Boolean).length} / ${结果.length} 条 RV 成立`)
process.exit(结果.every(Boolean) ? 0 : 1)
