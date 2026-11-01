// V174 · V105 阶段2 —— 同源入口（segmented+派生链）/ 基线动态取 / 落库脚本在位
import { readFileSync, existsSync } from 'node:fs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
console.log('▶ V174 · V105 阶段2（同源与落库）')
{
  const run = readFileSync(new URL('../scripts/v105-run.mjs', import.meta.url), 'utf8')
  ok(/settleWeekSegmented/.test(run) && /settleInputsFrom/.test(run), '脚本走与 UI 同一入口（segmented + 派生链 · 判据①结构性）')
  ok(!/[^a-zA-Z]settle\(\{/.test(run), 'RV：无「整周 settle 直调」残留（改回 ⇒ 本断言红）')
  ok(/decisionsByDayFrom/.test(run), 'decisionsByDay 走单源派生（weeklyAuto）')
  const per = readFileSync(new URL('../scripts/v105-personas.mjs', import.meta.url), 'utf8')
  ok(/brandGroups/.test(run) && /districts/.test(run), '站点/品牌动态取（§2 · RV：改常量 ⇒ 基线跟着变）')
  ok(existsSync(new URL('../scripts/v105-write-states.mjs', import.meta.url)), 'E4 落库脚本在位')
  ok(existsSync(new URL('../../4-审计与报告/六性格数值对照.md', import.meta.url)), '六性格数值对照.md（§4①）')
  const dz = readFileSync(new URL('../../4-审计与报告/六性格数值对照.md', import.meta.url), 'utf8')
  ok(/待专项校准/.test(dz) && /27.6%/.test(dz), '27.6% 复核在档（§4②）')
}
console.log(`
结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
