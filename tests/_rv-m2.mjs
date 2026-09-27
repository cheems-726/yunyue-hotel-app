// R3 反向验证（W4-4 · M2 术语断言扩展）：三处注入，验证新断言真能抓
//   (a) OTA 佣金率 11% → 10%（E3）
//   (b) 引擎里混入"管理费"字样（E4：与"P3 未实装"状态不符）
//   (c) paybackText 公式 ×1.1（E5 回本口径）
// 运行：node tests/_rv-m2.mjs      （evidence 脚本，不进 run-all）
// ★ 全程 finally 兜底还原
import { readFileSync, writeFileSync, copyFileSync, unlinkSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILES = {
  settle: path.join(APP, 'src', 'settlement.js'),
  ledger: path.join(APP, 'src', 'onePageLedger.mjs'),
}
const BAKS = { settle: path.join(APP, 'tests', '_rv-m2-settle.bak.js'), ledger: path.join(APP, 'tests', '_rv-m2-ledger.bak.mjs') }

const runDataDict = () => {
  const r = spawnSync('node', ['tests/dataDict.check.mjs'], { cwd: APP, encoding: 'utf8', shell: false })
  const out = (r.stdout || '') + (r.stderr || '')
  return { code: r.status, rules: (out.match(/\[E\d\([^\]]+\)\]/g) || []), out }
}

let redRules = []
try {
  copyFileSync(FILES.settle, BAKS.settle)
  copyFileSync(FILES.ledger, BAKS.ledger)
  let s = readFileSync(FILES.settle, 'utf8')
  const anchor = 'let otaCommissionRate = 0'
  if (!s.includes(anchor)) { console.error('✗ E4 注入锚点未命中（源码是 let otaCommissionRate）'); process.exit(1) }
  s = s.replace('revenue * 0.11', 'revenue * 0.10')                      // (a)
      .replace(anchor, 'const 管理费占位 = 0   // RV 注入：模拟"引擎里混入加盟费率字样"\n  ' + anchor)  // (b)
  writeFileSync(FILES.settle, s)
  let l = readFileSync(FILES.ledger, 'utf8')
  l = l.replace('const y = 总投资 / 现金流', 'const y = (总投资 / 现金流) * 1.1')   // (c)
  writeFileSync(FILES.ledger, l)

  const red = runDataDict()
  redRules = [...new Set(red.rules)]
  console.log('【1】三处注入后：exit=' + red.code + ' · 触发的 E 类断言：' + (redRules.join(' ') || '（无）'))
} finally {
  for (const k of ['settle', 'ledger']) if (existsSync(BAKS[k])) { copyFileSync(BAKS[k], FILES[k]); unlinkSync(BAKS[k]) }
}

const green = runDataDict()
console.log('【2】还原后：exit=' + green.code + ' · 触发的 E 类断言：' + (green.rules.join(' ') || '（无）'))

const 期望 = ['E3(OTA佣金率)', 'E4(未实装状态)', 'E5(回本口径)'].every(r => redRules.some(x => x.includes(r)))
const okRV = green.code === 0 && 期望
console.log(okRV ? '\n✅ 反向验证成立：E3/E4/E5 三条新断言各自能抓（注入即红），还原后全绿'
                 : '\n🔴 反向验证不成立（期望抓到 E3/E4/E5）')
process.exit(okRV ? 0 : 1)
