// V156 阶段一 RV ×2 · 复现 V155 型"漏 import"与"页面塞 undefinedVar" ⇒ 矩阵必红且报出该页
// 运行：node tests/_rv-v156.mjs（自动改 src + 重建 dist + 跑矩阵 + 还原；中断请 git checkout -- 对应文件）
import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

let pass = 0, fail = 0
const ok = (c, n) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n) } }
const build = () => { const r = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { encoding: 'utf8' }); if (r.status !== 0) throw new Error('RV 构建失败：' + (r.stderr || '').slice(0, 200)) }
const runMatrix = () => { const r = spawnSync(process.execPath, ['tests/uiMatrix.mjs'], { encoding: 'utf8', timeout: 10 * 60 * 1000 }); return (r.stdout || '') + (r.stderr || '') }
const patch = (file, from, to, bak) => {
  copyFileSync(file, bak)
  const s = readFileSync(file, 'utf8')
  if (!s.includes(from)) { unlinkSync(bak); throw new Error('RV 锚缺失：' + file + ' :: ' + from.slice(0, 50)) }
  writeFileSync(file, s.replace(from, to), 'utf8')
  build()
}
const restore = (file, bak) => { copyFileSync(bak, file); unlinkSync(bak); build() }

// RV-1（卡 §1②）：ClassroomPack.jsx 删一个 import ⇒ 教师总览/投屏红且报出该页（复现 V155 的坏）
const C = 'src/ClassroomPack.jsx', CB = 'scripts/_rv156-c.bak'
try {
  patch(C,
    "import { 学期报告HTML, 成绩单CSV, 与scoreOf零差, 组装课堂行 } from './classroomPack.mjs'   // ★ V155：组装课堂行 漏 import ⇒ 运行时 ReferenceError（D344\"绿着的坏\"·v155Verify 实测）",
    "import { 学期报告HTML, 成绩单CSV, 与scoreOf零差 } from './classroomPack.mjs'   // [RV] 组装课堂行 import 已删",
    CB)
  const out = runMatrix()
  const 红 = /✗ FAIL: \[教师\] (班级总览|学期成果并排|课堂投屏)/.test(out)
  ok(红, 'RV-1 删 ClassroomPack import ⇒ 教师矩阵红且报出该页（复现 V155 的坏可被机器抓到）')
  if (!红) console.log('    [输出尾] ' + out.split('\n').filter(l => l.includes('✗')).slice(0, 5).join(' / '))
} finally { restore(C, CB) }

// RV-2（卡 §1③）：报表页塞 undefinedVar ⇒ 矩阵红
// RV-2（卡 §1③）：报表页塞 undefinedVar ⇒ 矩阵红 —— 用矩阵内置 RV 钩子（V156_INJECT_REPORT=1）
//   在「报表」页抛真 ReferenceError（未捕获），验证的是【矩阵的检测通道】能抓页面级错误并报出该页；
//   （往 src 塞 throw 的做法会让整棵树卸载、后续格子全崩 —— 对"矩阵能否定位到页"反而是钝刀，弃用）
{
  const r = spawnSync(process.execPath, ['tests/uiMatrix.mjs'], { encoding: 'utf8', timeout: 10 * 60 * 1000, env: { ...process.env, V156_INJECT_REPORT: '1' } })
  const out2 = (r.stdout || '') + (r.stderr || '')
  ok(/✗ FAIL: \[学生\] 报表/.test(out2) && /undefinedVar/.test(out2), 'RV-2 报表页塞 undefinedVar ⇒ 矩阵红且报出 [学生] 报表')
  if (!/✗ FAIL: \[学生\] 报表/.test(out2)) console.log('    [输出尾] ' + out2.slice(-500))
}

const out3 = runMatrix()
ok(/结果: 28 通过 \/ 0 失败/.test(out3), 'RV-3 还原后矩阵复绿 28/0')
console.log(`\nRV 结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
