// R3 反向验证（W2-4）：把"我们侧部门成本率"打回 W2 前的状态（无部门成本 ⇒ ≈0）
//   ⇒ F2（口径对齐）/ F3（差异归因）必须报红；还原后复绿。
// 运行：node tests/_rv-w2-4.mjs      （evidence 脚本，不进 run-all）
// ★ 它会临时改写 tests/dataDict.check.mjs 并在结束时还原（锚点找不到就拒绝执行）
import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(HERE, '..')
const P = path.join(HERE, 'dataDict.check.mjs')
const BAK = path.join(HERE, '_rv-datadict.bak.mjs')

copyFileSync(P, BAK)
const orig = readFileSync(P, 'utf8')

const anchor = '  const { weighted: us } = runSeason6()\n'
if (!orig.includes(anchor)) { console.error('✗ 找不到锚点，脚本失效（源码已变？）'); unlinkSync(BAK); process.exit(1) }
writeFileSync(P, orig.replace(anchor, anchor + '  us.deptRate = 0.0   // ← 反向验证注入：模拟 W2 前\n'))

const run = () => {
  const r = spawnSync('node', ['tests/dataDict.check.mjs'], { cwd: APP, encoding: 'utf8', shell: false })
  const out = (r.stdout || '') + (r.stderr || '')
  return { code: r.status, red: out.split('\n').filter(l => /^\s*✗/.test(l)).slice(0, 6) }
}

const red = run()
console.log('【1】模拟 W2 前（部门成本率 = 0）：exit=' + red.code)
red.red.forEach(l => console.log('   ' + l.trim()))

copyFileSync(BAK, P)
unlinkSync(BAK)
const green = run()
console.log('【2】还原后：exit=' + green.code)

const okRV = red.code === 1 && red.red.some(l => /F2/.test(l)) && green.code === 0
console.log(okRV ? '\n✅ 反向验证成立：W2 前状态必红（F2 口径对齐），还原后复绿' : '\n🔴 反向验证不成立')
process.exit(okRV ? 0 : 1)
