// R3 反向验证（W3-2）：把报价单的渲染条件改死 ⇒ 界面层断言必须报红 ⇒ 还原后复绿
// 运行：node tests/_rv-propertyQuote.mjs      （evidence 脚本，不进 run-all）
import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(HERE, '..')
const P = path.join(APP, 'src', 'Claim.jsx')
const BAK = path.join(HERE, '_rv-claim.bak.jsx')

copyFileSync(P, BAK)
const orig = readFileSync(P, 'utf8')

const anchor = '{step === 3 && quote && ('
if (!orig.includes(anchor)) { console.error('✗ 找不到锚点，脚本失效（源码已变？）'); unlinkSync(BAK); process.exit(1) }
// 注入：报价单永远不渲染（模拟"没做 W3-2"）
writeFileSync(P, orig.replace(anchor, '{false && ('))

const run = () => {
  const r = spawnSync('node', ['tests/propertyQuote.test.mjs'], { cwd: APP, encoding: 'utf8', shell: false })
  const out = (r.stdout || '') + (r.stderr || '')
  const m = out.match(/结果: (\d+) 通过 \/ (\d+) 失败/)
  return { code: r.status, pass: m ? +m[1] : null, fail: m ? +m[2] : null, red: out.split('\n').filter(l => l.includes('✗')).slice(0, 6) }
}

const red = run()
console.log('【1】报价单不渲染后：exit=' + red.code + '  ' + red.pass + '通过/' + red.fail + '失败')
red.red.forEach(l => console.log('   ' + l.trim()))

copyFileSync(BAK, P)
unlinkSync(BAK)
const green = run()
console.log('【2】还原后：exit=' + green.code + '  ' + green.pass + '通过/' + green.fail + '失败')

const okRV = red.code === 1 && red.fail > 0 && green.code === 0
console.log(okRV ? '\n✅ 反向验证成立：报价单不渲染必红（界面层断言有效），还原后复绿' : '\n🔴 反向验证不成立')
process.exit(okRV ? 0 : 1)
