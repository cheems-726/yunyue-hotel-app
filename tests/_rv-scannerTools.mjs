// R3 反向验证（W4-4 扫描器工具）· 两层
//   ① 语义层：新注入一个含残留的文件 ⇒ 全量扫得到、--since（不含它）扫不到 ⇒ 证明 --since 真过滤
//   ② 断言层：把 --since 的过滤逻辑改坏（忽略过滤、扫全量）⇒ 自检套件必须报红
// 运行：node tests/_rv-scannerTools.mjs      （evidence 脚本，不进 run-all）
// ★ 全程 finally 兜底清理（probe 文件 + 被改的扫描器）
import { writeFileSync, unlinkSync, existsSync, readFileSync, copyFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PROBE = path.join(APP, 'src', '_rvProbe.mjs')
const SCANNER = path.join(APP, 'tests', '_scan-stale-scale.mjs')
const BAK = path.join(APP, 'tests', '_rv-scanner.bak.mjs')

const runScanner = (args) => {
  const r = spawnSync('node', ['tests/_scan-stale-scale.mjs', ...args], { cwd: APP, encoding: 'utf8', shell: false, maxBuffer: 1 << 24 })
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' }
}
const runSelfCheck = () => {
  const r = spawnSync('node', ['tests/scannerTools.test.mjs'], { cwd: APP, encoding: 'utf8', shell: false })
  const out = (r.stdout || '') + (r.stderr || '')
  const m = out.match(/结果: (\d+) 通过 \/ (\d+) 失败/)
  return { code: r.status, pass: m ? +m[1] : null, fail: m ? +m[2] : null, red: out.split('\n').filter(l => l.includes('✗')).slice(0, 4) }
}

let ok1 = false, ok2 = false
try {
  // ── ① 语义层：注入残留（未跟踪新文件 ⇒ 不在 --since 的 diff 名单里）──
  //   探针内容必须【真匹配某条规则】：用 R6「金额→万 的展示换算」形态（/ 10000）
  writeFileSync(PROBE, '// RV 探针：故意写一处未登记的展示换算（应被 R6 抓到）\nexport const 元转万 = (v) => v / 10000\n', 'utf8')
  const full = JSON.parse(runScanner(['--json']).out)
  const since = JSON.parse(runScanner(['--since', 'HEAD', '--json']).out)
  const fullHas = full.residual.some(h => h.file.includes('_rvProbe'))
  const sinceHas = since.residual.some(h => h.file.includes('_rvProbe'))
  ok1 = fullHas && !sinceHas
  console.log('① 语义：全量扫到探针残留 =', fullHas, '｜ --since HEAD 扫到 =', sinceHas, ok1 ? '✅（过滤生效）' : '🔴')

  // ── ② 断言层：把 --since 过滤改坏 ⇒ 自检必须红 ──
  copyFileSync(SCANNER, BAK)
  const s = readFileSync(SCANNER, 'utf8')
  const anchor = 'scanned = files.filter(f => sinceList.includes(f))'
  if (!s.includes(anchor)) { console.error('✗ 找不到过滤锚点'); process.exit(1) }
  writeFileSync(SCANNER, s.replace(anchor, 'scanned = files   // ← RV：故意忽略过滤'))
  const red = runSelfCheck()
  console.log('② 断言：改坏过滤后自检 exit=' + red.code + '  ' + red.pass + '通过/' + red.fail + '失败')
  red.red.forEach(l => console.log('   ' + l.trim()))
  ok2 = red.code === 1 && red.fail > 0
} finally {
  if (existsSync(BAK)) { copyFileSync(BAK, SCANNER); unlinkSync(BAK) }
  if (existsSync(PROBE)) unlinkSync(PROBE)
}

const green = runSelfCheck()
console.log('③ 还原后自检：exit=' + green.code + '  ' + green.pass + '通过/' + green.fail + '失败')
const okAll = ok1 && ok2 && green.code === 0
console.log(okAll ? '\n✅ 反向验证成立：--since 真过滤（注入残留可分辨）+ 自检能抓坏实现 + 还原后全绿'
                  : '\n🔴 反向验证不成立')
process.exit(okAll ? 0 : 1)
