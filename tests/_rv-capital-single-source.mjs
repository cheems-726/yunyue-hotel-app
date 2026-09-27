// R3 反向验证（资金三数单源）：把 App.jsx 的阈值改回硬编码 ⇒ 守门必须报红 ⇒ 还原后复绿
// 运行：node tests/_rv-capital-single-source.mjs      （evidence 脚本，不进 run-all）
// ★ 临时改写 src/App.jsx 并在结束时还原（锚点找不到即拒绝执行，不会半途留脏）
import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(HERE, '..')
const P = path.join(APP, 'src', 'App.jsx')
const BAK = path.join(HERE, '_rv-app.bak.jsx')

copyFileSync(P, BAK)
const orig = readFileSync(P, 'utf8')

const anchor = 'const isLow = cap < SCALE.变黄线'
if (!orig.includes(anchor)) { console.error('✗ 找不到锚点，脚本失效（源码已变？）'); unlinkSync(BAK); process.exit(1) }
// 注入：退回"硬编码资金量级"的旧写法
writeFileSync(P, orig.replace(anchor, 'const isLow = cap < 298000').replace('const isCritical = cap < SCALE.变红线', 'const isCritical = cap < 149000'))

const run = () => {
  const r = spawnSync('node', ['tests/capital-single-source.test.mjs'], { cwd: APP, encoding: 'utf8', shell: false })
  const out = (r.stdout || '') + (r.stderr || '')
  const m = out.match(/结果: (\d+) 通过 \/ (\d+) 失败/)
  return { code: r.status, pass: m ? +m[1] : null, fail: m ? +m[2] : null, red: out.split('\n').filter(l => l.includes('✗')).slice(0, 6) }
}

const red = run()
console.log('【1】写回硬编码后：exit=' + red.code + '  ' + red.pass + '通过/' + red.fail + '失败')
red.red.forEach(l => console.log('   ' + l.trim()))

copyFileSync(BAK, P)
unlinkSync(BAK)
const green = run()
console.log('【2】还原后：exit=' + green.code + '  ' + green.pass + '通过/' + green.fail + '失败')

const okRV = red.code === 1 && red.fail > 0 && green.code === 0
console.log(okRV ? '\n✅ 反向验证成立：硬编码资金量级必红（防"改 IC 漏改文案"复发），还原后复绿' : '\n🔴 反向验证不成立')
process.exit(okRV ? 0 : 1)
