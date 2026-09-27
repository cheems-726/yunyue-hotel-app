// R3 反向验证（Wave 4 · D-2）：把一个垃圾文件【强制加进跟踪清单】⇒ 卫生守门必须报红 ⇒ 清理后复绿
// 运行：node tests/_rv-repoHygiene.mjs      （evidence 脚本，不进 run-all）
// ★ 它会临时 git add -f 一个文件再撤销（脚本内保证清理，finally 兜底）
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const JUNK = path.join(APP, '_rv_junk.txt')
const git = (args) => spawnSync('git', args, { cwd: APP, encoding: 'utf8', shell: false })

const run = () => {
  const r = spawnSync('node', ['tests/repoHygiene.test.mjs'], { cwd: APP, encoding: 'utf8', shell: false })
  const out = (r.stdout || '') + (r.stderr || '')
  const m = out.match(/结果: (\d+) 通过 \/ (\d+) 失败/)
  return { code: r.status, pass: m ? +m[1] : null, fail: m ? +m[2] : null, red: out.split('\n').filter(l => l.includes('✗')).slice(0, 4) }
}

let result
try {
  writeFileSync(JUNK, '# 反向验证用垃圾文件\n', 'utf8')
  git(['add', '-f', '_rv_junk.txt'])          // 强制加进跟踪（模拟"误提交垃圾文件"）
  const red = run()
  console.log('【1】垃圾文件被跟踪后：exit=' + red.code + '  ' + red.pass + '通过/' + red.fail + '失败')
  red.red.forEach(l => console.log('   ' + l.trim()))
  result = { red }
} finally {
  git(['rm', '--cached', '-f', '_rv_junk.txt'])
  if (existsSync(JUNK)) unlinkSync(JUNK)
}

const green = run()
console.log('【2】清理后：exit=' + green.code + '  ' + green.pass + '通过/' + green.fail + '失败')

const okRV = result.red.code === 1 && result.red.fail > 0 && green.code === 0
console.log(okRV ? '\n✅ 反向验证成立：垃圾文件进跟踪清单必红（守门有效），清理后复绿' : '\n🔴 反向验证不成立')
process.exit(okRV ? 0 : 1)
