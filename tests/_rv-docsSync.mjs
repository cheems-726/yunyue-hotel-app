// R3 反向验证（W4-6）：把交接卡的起点校验改成【旧提交号】⇒ docs-sync 必须报红 ⇒ 还原后复绿
// 运行：node tests/_rv-docsSync.mjs      （evidence 脚本，不进 run-all）
// ★ 临时改写【文档仓库】里的 会话交接卡.md，脚本内保证还原
import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(APP, '..')
const P = path.join(ROOT, '4-审计与报告', '会话交接卡.md')
const BAK = path.join(APP, 'tests', '_rv-card.bak.md')

copyFileSync(P, BAK)
const orig = readFileSync(P, 'utf8')

const head = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: APP, encoding: 'utf8', shell: false }).stdout.trim()
if (!orig.includes(head)) { console.error('✗ 交接卡里找不到当前 HEAD（' + head + '），脚本失效'); unlinkSync(BAK); process.exit(1) }
// 注入：把 HEAD 换成一个不存在的旧哈希（模拟"卡落后于最新提交"）
writeFileSync(P, orig.replaceAll(head, 'deadbee'))

const run = () => {
  const r = spawnSync('node', ['tests/docs-sync.mjs'], { cwd: APP, encoding: 'utf8', shell: false })
  const out = (r.stdout || '') + (r.stderr || '')
  const m = out.match(/(\d+) 通过 \/ (\d+) 失败/)
  return { code: r.status, pass: m ? +m[1] : null, fail: m ? +m[2] : null, red: out.split('\n').filter(l => /✗|⚠️ 发现/.test(l)).slice(0, 5) }
}

const red = run()
console.log('【1】交接卡改回旧提交号后：exit=' + red.code + '  ' + red.pass + '通过/' + red.fail + '失败')
red.red.forEach(l => console.log('   ' + l.trim()))

copyFileSync(BAK, P)
unlinkSync(BAK)
const green = run()
console.log('【2】还原后：exit=' + green.code + '  ' + green.pass + '通过/' + green.fail + '失败')

const okRV = red.code === 1 && red.fail > 0 && green.code === 0
console.log(okRV ? '\n✅ 反向验证成立：交接卡落后于提交必红（补上了原先的覆盖缺口），还原后复绿' : '\n🔴 反向验证不成立')
process.exit(okRV ? 0 : 1)
