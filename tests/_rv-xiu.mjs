// R3 反向验证（二期返修 ③ / ② / ⑤）—— 三条一次跑
//   ⑤ 注入一条未登记残留（新 src 文件）⇒ 扫描器在 fast 门禁内 ⇒ 门禁必红
//   ③ 删掉 .gitignore 的 _last-gate.json 规则 ⇒ repoHygiene 的"生成物"检查必红
//   ② 把交接卡 ⑥ 的数字改成"真值 − 24" ⇒ docs-sync 的精确比对必红
// 运行：node tests/_rv-xiu.mjs      （evidence 脚本，不进 run-all）
// ★ 全程 finally 兜底还原（探针文件 / .gitignore / 交接卡）
import { readFileSync, writeFileSync, copyFileSync, unlinkSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(APP, '..')
const PROBE = path.join(APP, 'src', '_rvResidualProbe.mjs')
const GI = path.join(APP, '.gitignore')
const GIBAK = path.join(APP, 'tests', '_rv-gitignore.bak')
const CARD = path.join(ROOT, '4-审计与报告', '会话交接卡.md')
const CARDBAB = path.join(APP, 'tests', '_rv-card-xiu.bak.md')

const sh = (cmd, args, cwd = APP) => spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: false })
const runSuite = (file) => {
  const r = sh('node', [file])
  const out = (r.stdout || '') + (r.stderr || '')
  const m = out.match(/(\d+) 通过 \/ (\d+) 失败/)
  return { code: r.status, pass: m ? +m[1] : null, fail: m ? +m[2] : null, out }
}
const runFastGate = () => {
  const r = sh('node', ['tests/run-all.mjs', '--fast', '--no-build'])
  const out = (r.stdout || '') + (r.stderr || '')
  const 行 = out.split('\n').find(l => /stale-scale/.test(l)) || ''
  return { code: r.status, 行: 行.trim().slice(0, 120) }
}

const 结果 = []
try {
  // ── ⑤ 注入未登记残留 ──────────────────────────────────────
  writeFileSync(PROBE, '// RV 探针：未登记的展示换算（扫描器应抓）\nexport const 元转万 = (v) => v / 10000\n', 'utf8')
  const g5 = runFastGate()
  const 红5 = g5.code === 1 && /✗/.test(g5.行)
  结果.push(['⑤ 注入未登记残留 ⇒ 门禁红', 红5, 'gate exit=' + g5.code + ' · 行: ' + g5.行])
  unlinkSync(PROBE)

  // ── ③ 删 .gitignore 规则 ⇒ repoHygiene 必红 ────────────────
  copyFileSync(GI, GIBAK)
  writeFileSync(GI, readFileSync(GI, 'utf8').replace(/\n# 门禁自述记录[\s\S]*?\ntests\/_last-gate\.json\n/, '\n'), 'utf8')
  const r3 = runSuite('tests/repoHygiene.test.mjs')
  const 红3 = r3.code === 1 && /生成物/.test(r3.out)
  结果.push(['③ 删 .gitignore 规则 ⇒ repoHygiene 红', 红3, 'exit=' + r3.code + ' ' + r3.pass + '/' + r3.fail])
  copyFileSync(GIBAK, GI); unlinkSync(GIBAK)

  // ── ② 卡数字改成"真值 − 24" ⇒ docs-sync 精确比对必红 ────────
  const rec = JSON.parse(readFileSync(path.join(APP, 'tests', '_last-gate.json'), 'utf8'))
  const 真值 = rec.full && rec.full.通过
  const card = readFileSync(CARD, 'utf8')
  const tampered = card.replace(new RegExp('→ ' + 真值 + ' 通过'), '→ ' + (真值 - 24) + ' 通过')
  const 篡改生效 = tampered !== card
  copyFileSync(CARD, CARDBAB)
  writeFileSync(CARD, tampered)
  const r2 = runSuite('tests/docs-sync.mjs')
  const 红2 = 篡改生效 && r2.code === 1 && /精确相等/.test(r2.out)
  结果.push(['② 卡数字差 24 ⇒ docs-sync 红', 红2, '真值=' + 真值 + ' 写入=' + (真值 - 24) + ' · exit=' + r2.code + ' ' + r2.pass + '/' + r2.fail])
  copyFileSync(CARDBAB, CARD); unlinkSync(CARDBAB)
} finally {
  if (existsSync(PROBE)) unlinkSync(PROBE)
  if (existsSync(GIBAK)) { copyFileSync(GIBAK, GI); unlinkSync(GIBAK) }
  if (existsSync(CARDBAB)) { copyFileSync(CARDBAB, CARD); unlinkSync(CARDBAB) }
}

// ── 还原后复绿 ────────────────────────────────────────────────
const g = runSuite('tests/docs-sync.mjs')
const h = runSuite('tests/repoHygiene.test.mjs')
const s = runSuite('tests/_scan-stale-scale.mjs')
console.log('还原后：docs-sync ' + g.pass + '/' + g.fail + ' · repoHygiene ' + h.pass + '/' + h.fail + ' · 扫描器 ' + s.pass + '/' + s.fail)
let 全过 = true
for (const [名, ok, 备] of 结果) { console.log('  ' + (ok ? '✅' : '🔴') + ' ' + 名 + '  [' + 备 + ']'); if (!ok) 全过 = false }
const 复绿 = g.code === 0 && h.code === 0 && s.code === 0
console.log(复绿 ? '  ✅ 三套件还原后全绿' : '  🔴 还原后未全绿')
console.log((全过 && 复绿) ? '\n✅ 反向验证成立（③/②/⑤ 三条各自能红，还原后复绿）' : '\n🔴 反向验证不成立')
process.exit((全过 && 复绿) ? 0 : 1)
