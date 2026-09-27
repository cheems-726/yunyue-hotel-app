// R3 反向验证（W2-3）：摘掉周报的 GOP/净利润显示 ⇒ metrics-w2-3 必须报红 ⇒ 还原后复绿
// 运行：node tests/_rv-w2-3.mjs      （evidence 脚本，不进 run-all）
// ★ 它会临时改写 src/WeeklyReport.jsx 并在结束时还原（锚点找不到就拒绝执行，不会半途留脏）
import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(HERE, '..')
const P = path.join(APP, 'src', 'WeeklyReport.jsx')
const BAK = path.join(HERE, '_rv-wr.bak.jsx')

copyFileSync(P, BAK)
const orig = readFileSync(P, 'utf8')

const block = orig.match(/\n\s*\{\/\* 🔴 W2-3[\s\S]*?\{typeof result\.netProfit === 'number' && \([\s\S]*?\)\}\n/)
if (!block) { console.error('✗ 找不到 W2-3 渲染块，脚本失效（源码已变？）'); unlinkSync(BAK); process.exit(1) }
writeFileSync(P, orig.replace(block[0], '\n'))

const run = () => {
  const r = spawnSync('node', ['tests/metrics-w2-3.test.mjs'], { cwd: APP, encoding: 'utf8', shell: false })
  const out = (r.stdout || '') + (r.stderr || '')
  const m = out.match(/结果: (\d+) 通过 \/ (\d+) 失败/)
  return { code: r.status, pass: m ? +m[1] : null, fail: m ? +m[2] : null, red: out.split('\n').filter(l => l.includes('✗')).slice(0, 6) }
}

const red = run()
console.log('【1】摘掉显示后：exit=' + red.code + '  ' + red.pass + '通过/' + red.fail + '失败')
red.red.forEach(l => console.log('   ' + l.trim()))

copyFileSync(BAK, P)
unlinkSync(BAK)
const green = run()
console.log('【2】还原后：exit=' + green.code + '  ' + green.pass + '通过/' + green.fail + '失败')

const okRV = red.code === 1 && red.fail > 0 && green.code === 0
console.log(okRV ? '\n✅ 反向验证成立：修复前（摘掉显示）必红，还原后复绿' : '\n🔴 反向验证不成立 —— 断言没有真正盯着显示')
process.exit(okRV ? 0 : 1)
