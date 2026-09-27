// R3 反向验证（A1 / BL-13 对策）：三处篡改，验证「状态行一致性」三条断言各有牙齿
//   (a) 卡里全量数字改成 9999（过期数字）
//   (b) 卡里「未推 0」改成「未推 5」（与实际不符）
//   (c) 卡里再插一段「## ③ 下一步」（重复段）
// 运行：node tests/_rv-a1.mjs      （evidence 脚本，不进 run-all）
// ★ 临时改写【文档仓库】的 会话交接卡.md，finally 兜底还原
import { readFileSync, writeFileSync, copyFileSync, unlinkSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(APP, '..')
const P = path.join(ROOT, '4-审计与报告', '会话交接卡.md')
const BAK = path.join(APP, 'tests', '_rv-card-a1.bak.md')

const run = () => {
  const r = spawnSync('node', ['tests/docs-sync.mjs'], { cwd: APP, encoding: 'utf8', shell: false })
  const out = (r.stdout || '') + (r.stderr || '')
  const m = out.match(/(\d+) 通过 \/ (\d+) 失败/)
  return { code: r.status, pass: m ? +m[1] : null, fail: m ? +m[2] : null, red: out.split('\n').filter(l => /✗ /.test(l)).slice(0, 6) }
}

const orig = readFileSync(P, 'utf8')
const cases = [
  ['(a) 全量数字改 9999', (s) => s.replace(/(→ )(\d{3,})( 通过 \/ 0 失败)/, '$19999$3')],
  ['(b) 未推改 5', (s) => s.replace(/干净 \/ 未推 0/, '干净 / 未推 5')],
  ['(c) 插入重复的③段', (s) => s.replace('## ④ ', '## ③ 下一步（重复段·RV 注入）\n占位\n\n## ④ ')],
]
let 全抓到 = true
try {
  for (const [name, tamper] of cases) {
    const t = tamper(orig)
    if (t === orig) { console.log('⚠ ' + name + '：篡改未生效（锚点没匹配）—— 该用例无效'); 全抓到 = false; continue }
    writeFileSync(P, t)
    const r = run()
    const 红 = r.code === 1
    if (!红) 全抓到 = false
    console.log('  ' + (红 ? '✅' : '🔴') + ' ' + name + ' ⇒ exit=' + r.code + '  ' + r.pass + '通过/' + r.fail + '失败')
    r.red.forEach(l => console.log('       ' + l.trim().slice(0, 110)))
  }
} finally {
  writeFileSync(P, orig)
  if (existsSync(BAK)) unlinkSync(BAK)
}
const green = run()
console.log('  还原后 ⇒ exit=' + green.code + '  ' + green.pass + '通过/' + green.fail + '失败')
const okRV = 全抓到 && green.code === 0
console.log(okRV ? '\n✅ 反向验证成立：三类"状态行不一致"各自被抓，还原后复绿' : '\n🔴 反向验证不成立')
process.exit(okRV ? 0 : 1)
