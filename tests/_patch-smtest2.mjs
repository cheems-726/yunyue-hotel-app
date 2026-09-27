// stateMigration 测试重基线（单行锚点版；替换串一律用单/双引号，不用模板字面量）
import { readFileSync, writeFileSync } from 'node:fs'
const P = 'tests/stateMigration.test.mjs'
const raw = readFileSync(P, 'utf8')
const NL = raw.includes('\r\n') ? '\r\n' : '\n'
let lines = raw.split(NL)
let hit = 0
function subLine(needle, repl, tag) {
  const idx = lines.findIndex(l => l.includes(needle))
  if (idx < 0) { console.error('MISS ' + tag + ' :: ' + needle); process.exit(1) }
  lines[idx] = repl
  hit++
  console.log('  ok ' + tag)
}

// ① import + 累计倍数 + 按跳推导辅助
subLine("import { migrateSave, SCALE, SCALED_KEYS_DOC } from '../src/stateMigration.mjs'",
  "import { migrateSave, SCALE, SCALE_STEPS, SCALED_KEYS_DOC } from '../src/stateMigration.mjs'" + NL +
  "// ★ W2-2 重基线：期望从【版本序表】推导（镜像实现的按跳变换），不再贴死数字 ——" + NL +
  "//   口径以后再变，只要 SCALE_STEPS 加一行，本套件无需再改。" + NL +
  "const CUM = SCALE_STEPS.reduce((a, st) => a * st.m, 1)   // 累计倍数 = 10.0483 × 0.2970" + NL +
  "function applySteps(capOld, fromVer) {" + NL +
  "  let cap = capOld" + NL +
  "  for (const st of SCALE_STEPS.filter(x => x.from >= fromVer)) cap = Math.round(st.IC_NEW + (cap - st.IC_OLD) * st.m)" + NL +
  "  return cap" + NL +
  "}", 'import + CUM + applySteps')

// ② capital 期望：两跳各取整一次 ⇒ 容差 2 元；并给出按跳推导值
subLine("  const expect = Math.round(SCALE.IC_NEW + (capOld - SCALE.IC_OLD) * SCALE.m)",
  "  const expect = applySteps(capOld, 1)   // 按跳推导（两跳各取整一次 ⇒ 与单式相差 ≤2 元）", 'capital 期望改按跳')
subLine("  ok(r.save.capital === expect,",
  "  ok(Math.abs(r.save.capital - expect) <= 2,   // 两跳各取整一次 ⇒ 容差 2 元", 'capital 容差 2')

// ③ 量级带：单式 → 累计
subLine("  const BOUND_LO = Math.round(SCALE.IC_NEW + (CAP_OLD_LO - SCALE.IC_OLD) * SCALE.m)",
  "  const BOUND_LO = Math.round(SCALE.IC_NEW + (CAP_OLD_LO - SCALE.IC_OLD) * CUM)", 'BOUND_LO 累计')
subLine("  const BOUND_HI = Math.round(SCALE.IC_NEW + (CAP_OLD_HI - SCALE.IC_OLD) * SCALE.m)",
  "  const BOUND_HI = Math.round(SCALE.IC_NEW + (CAP_OLD_HI - SCALE.IC_OLD) * CUM)", 'BOUND_HI 累计')
subLine("  const capOldAtLower = Math.round((2510000 - SCALE.IC_NEW) / SCALE.m + SCALE.IC_OLD)",
  "  const capOldAtLower = Math.round((BOUND_LO - SCALE.IC_NEW) / CUM + SCALE.IC_OLD)", '反解改当前界')
subLine("  ok(Math.abs(capOldAtLower - CAP_OLD_LO) <= 1000,",
  "  ok(Math.abs(capOldAtLower - CAP_OLD_LO) <= 20000,   // 累计倍数下界反解的容差", '反解容差')
subLine("    if (!(out >= 2510000 && out <= 10040000)) bad.push(",
  "    if (!(out >= BOUND_LO && out <= BOUND_HI)) bad.push(", '代表点判据改当前界')
subLine("  ok(far > BOUND_HI,", "  ok(far > BOUND_HI,   // 前提之外（旧档 120万）越界属预期", 'far 断言说明')

// ④ 缩放边界 ×m → ×CUM（revenue / rentCost / gop）
subLine("  ok(m0.revenue === Math.round(h0.revenue * SCALE.m),", "  ok(m0.revenue === Math.round(h0.revenue * CUM),", 'revenue ×累计')
subLine("  ok(m0.rentCost === Math.round(h0.rentCost * SCALE.m),", "  ok(m0.rentCost === Math.round(h0.rentCost * CUM),", 'rentCost ×累计')
subLine("  ok(m0.gop === Math.round(h0.gop * SCALE.m),", "  ok(m0.gop === Math.round(h0.gop * CUM),", 'gop ×累计')

// ⑤ "已是 v2" → "已是当前版本"（v3）；并留 v2 档要迁的断言
subLine("  const v2 = migrateSave({ scaleVersion: 2, capital: 999 }).save",
  "  const vCur = migrateSave({ scaleVersion: SCALE.VERSION_CURRENT, capital: 999 }).save", '当前版本变量名')
subLine("  ok(v2.capital === 999, 'scaleVersion=2 → 数值一动不动')",
  "  ok(vCur.capital === 999, '已是当前版本 → 数值一动不动')" + NL +
  "  // ★ 版本序表的关键能力：v2 档（T1.1 期）也能迁到当前版本" + NL +
  "  const v2r = migrateSave({ scaleVersion: 2, capital: 5020000, history: [] })" + NL +
  "  ok(v2r.migrated === true && v2r.save.scaleVersion === SCALE.VERSION_CURRENT, 'v2 档被迁到当前版本（' + v2r.reason + '）')" + NL +
  "  ok(v2r.save.capital === applySteps(5020000, 2), 'v2 档 capital 按跳迁移：5020000 → ' + v2r.save.capital)", '当前版本 + v2 档断言')
subLine("  const v3 = migrateSave({ scaleVersion: 3, capital: 999 })",
  "  const v3 = migrateSave({ scaleVersion: SCALE.VERSION_CURRENT + 1, capital: 999 })", '未来版本变量')

// ⑥ 反证倍数：10× → 累计倍数
subLine("  ok(migrateSave(bad).migrated === true && re > SCALE.IC_NEW * 9,",
  "  ok(migrateSave(bad).migrated === true && re > SCALE.IC_NEW * (CUM - 0.2) && re < SCALE.IC_NEW * (CUM + 0.2),", '反证倍数区间')

writeFileSync(P, lines.join(NL), 'utf8')
console.log('OK stateMigration 测试重基线（' + hit + ' 处）')
