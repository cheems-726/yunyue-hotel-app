// V149 §4 · 评分口径 A：总评=四维 40/25/20/15；过程分仅课堂记录，不进总评
import { readFileSync } from 'node:fs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
console.log('▶ V149 · 评分口径 A')
const fr = readFileSync('src/FinalResult.jsx', 'utf8'), app = readFileSync('src/App.jsx', 'utf8'), md = readFileSync('src/metricDefs.mjs', 'utf8')
ok(/利润 40% \+ 口碑 25% \+ 出租率 20% \+ 差评处理 15%/.test(fr), '决赛页写明四维 40/25/20/15')
ok(/过程分仅课堂记录，不进入总评/.test(fr), '决赛页写明过程分不进总评')
ok(/过程分.*不进入综合总评/.test(app), '「我的」页过程分台账有“不进总评”说明')
ok(/利润 40% \+ 口碑 25% \+ 出租率 20% \+ 差评处理 15%/.test(app), '帮助页口径一致')
ok(/0\.4.*0\.25.*0\.2.*0\.15|40.*25.*20.*15/s.test(md), 'metricDefs 权重 40/25/20/15')
ok(!/过程分(计入|进入)(总评|总分)/.test(app + fr), '页面没有“过程分计入总评”的暗示')
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
