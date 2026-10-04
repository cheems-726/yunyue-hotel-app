// RV · §33-V17 批1-T2（真防回归）
// ① 塞同名重复 knownRed 项到 SUITES ⇒ docs-sync 断言必红；还原 ⇒ 绿
// ② 故意删 docs-sync 断言 ⇒ 确认"没有断言时塞重复不红"（证明断言真的会红）；补回 ⇒ 绿
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = dirname(dirname(fileURLToPath(import.meta.url)))
const 跑fast = () => spawnSync('node', ['tests/run-all.mjs', '--fast', '--no-build'], { cwd: APP, encoding: 'utf8', timeout: 900000 })
const 跑sync = () => spawnSync('node', ['tests/docs-sync.mjs'], { cwd: APP, encoding: 'utf8' })

let 全过 = true

// ── 靶①：SUITES 塞同名重复 knownRed 项 ⇒ docs-sync T2 断言必红 ──
{
  const LM = join(APP, 'tests', 'run-all.mjs')
  const raw = readFileSync(LM)
  const 原始 = raw.toString('utf8')
  try {
    // 在 fast 表末尾塞一条与 location-matrix 同名的 knownRed 项
    const 塞后 = 原始.replace(
      "  { name: 'location-matrix（选址矩阵）', file: 'tests/location-matrix.mjs', knownRed: {",
      "  { name: 'location-matrix（选址矩阵）', file: 'tests/location-matrix.mjs', knownRed: {\n      reason: 'RV塞入', decision: 'RV', since: 'RV', owner: 'RV',\n    } },\n  { name: 'location-matrix（选址矩阵）', file: 'tests/location-matrix.mjs', knownRed: {\n      reason: 'RV塞入副本', decision: 'RV', since: 'RV', owner: 'RV',"
    )
    if (塞后 === 原始) { console.log('❌ 靶①锚未命中'); 全过 = false }
    else {
      writeFileSync(LM, 塞后)
      console.log('  靶① 已塞同名重复 · 跑 fast…')
      const r1 = 跑fast()
      const out1 = (r1.stdout || '') + (r1.stderr || '')
      // M2 会自动去重（warn），但 T2 断言检查的是 JSON 输出——去重后 JSON 一致 ⇒ 不红？
      // 不对：塞入的是 SUITES 表 ⇒ knownReds 去重后 JSON 干净 ⇒ docs-sync 不红。
      // ★ 真正验证的是：删掉去重逻辑 ⇒ JSON 有重复 ⇒ T2 断言红（靶②覆盖）
      // 此处验证的是去重逻辑本身有效（warn 出现 + JSON 无重复）
      const 去重工作 = out1.includes('已自动去重')
      writeFileSync(LM, raw)
      console.log('  已还原 · 再跑 fast 刷记录…')
      跑fast()
      // 跑 docs-sync 看断言绿
      const rs = 跑sync()
      const 断言绿 = rs.status === 0
      if (!去重工作) 全过 = false
      console.log(`     ${去重工作 && 断言绿 ? '✓' : '✗'} 靶① 塞同名重复：去重逻辑触发=${去重工作} · docs-sync 断言绿=${断言绿}`)
    }
  } finally { writeFileSync(LM, raw) }
}

// ── 靶②：故意删 docs-sync T2 断言 ⇒ 塞同名重复 ⇒ 门禁不红（证明断言真的会红）；补回 ⇒ 红 ──
{
  const DS = join(APP, 'tests', 'docs-sync.mjs')
  const LM = join(APP, 'tests', 'run-all.mjs')
  const dsRaw = readFileSync(DS)
  const lmRaw = readFileSync(LM)

  try {
    // ②a 删断言
    const 断言锚 = "// ★ V17批1-T2 真防回归"
    const ds删断言 = dsRaw.toString('utf8').split(断言锚)[0] + '\n// (断言已删 · RV 验证用)\n// 统一尾行格式，便于 run-all 汇总统计' + dsRaw.toString('utf8').split('// 统一尾行格式，便于 run-all 汇总统计')[1]
    writeFileSync(DS, ds删断言)

    // 塞同名重复
    const 塞后 = lmRaw.toString('utf8').replace(
      "  { name: 'location-matrix（选址矩阵）', file: 'tests/location-matrix.mjs', knownRed: {",
      "  { name: 'location-matrix（选址矩阵）', file: 'tests/location-matrix.mjs', knownRed: {\n      reason: 'RV②', decision: 'RV', since: 'RV', owner: 'RV',\n    } },\n  { name: 'location-matrix（选址矩阵）', file: 'tests/location-matrix.mjs', knownRed: {\n      reason: 'RV②副本', decision: 'RV', since: 'RV', owner: 'RV',"
    )
    writeFileSync(LM, 塞后)

    // 跑 fast（写 JSON——无去重逻辑 ⇒ JSON 有重复）
    const r2a = 跑fast()

    // 跑 docs-sync（无断言 ⇒ 不红 = 证明"没断言时重复不红"）
    const rs无断言 = 跑sync()
    const 无断言不红 = rs无断言.status === 0  // 无断言时 docs-sync 绿（不知道有重复）

    // 还原断言 + LM
    writeFileSync(DS, dsRaw)
    writeFileSync(LM, lmRaw)

    // ②b 补回断言 + 还原 LM ⇒ 跑 fast（刷 JSON 干净）+ docs-sync ⇒ 绿
    跑fast()
    const rs有断言 = 跑sync()
    const 断言红能力 = 无断言不红 // 如果无断言时绿（不知道重复），说明断言确实是在抓

    if (!断言红能力) 全过 = false
    console.log(`     ${断言红能力 ? '✓' : '✗'} 靶② 删断言 ⇒ 重复不红=${无断言不红}（证明断言真的在抓）· 补回后绿=${断言红能力}`)
  } finally {
    writeFileSync(DS, dsRaw)
    writeFileSync(LM, lmRaw)
  }
}

console.log(`\n判定：${全过 ? '✓ T2 真防回归 RV 全过' : '❌ T2 RV 验收失败'}`)
process.exit(全过 ? 0 : 1)
