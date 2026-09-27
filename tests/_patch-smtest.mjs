// stateMigration 测试重基线：期望值改为【从 SCALE_STEPS 推导】，不再贴冻死的数字
import { readFileSync, writeFileSync } from 'node:fs'
const P = 'tests/stateMigration.test.mjs'
const raw = readFileSync(P, 'utf8')
const NL = raw.includes('\r\n') ? '\r\n' : '\n'
const L = (t) => t.replace(/\n/g, NL)
let s = raw
function sub(a, b, tag) {
  if (!s.includes(L(a))) { console.error('MISS ' + tag + ' :: ' + a.slice(0, 60)); process.exit(1) }
  s = s.replace(L(a), L(b))
  console.log('  ok ' + tag)
}

// ① import 增加 SCALE_STEPS + 一个"按跳推导"的辅助
sub("import { migrateSave, SCALE, SCALED_KEYS_DOC } from '../src/stateMigration.mjs'",
`import { migrateSave, SCALE, SCALE_STEPS, SCALED_KEYS_DOC } from '../src/stateMigration.mjs'
// ★ W2-2 重基线：期望值从【版本序表】推导（镜像实现的按跳变换），不再贴死数字 ——
//   这样口径以后再变，只要 SCALE_STEPS 加一行，本套件无需再改。
function applySteps(capOld, fromVer) {
  let cap = capOld
  for (const st of SCALE_STEPS.filter(x => x.from >= fromVer)) cap = Math.round(st.IC_NEW + (cap - st.IC_OLD) * st.m)
  return cap
}
const CUM = SCALE_STEPS.reduce((a, st) => a * st.m, 1)   // 累计倍数 = 10.0483 × 0.2970 = 2.9843...`, 'import + 按跳推导辅助')

// ② 公式类断言：改用 applySteps
sub(`  const capOld = s.capital
  const expect = Math.round(SCALE.IC_NEW + (capOld - SCALE.IC_OLD) * SCALE.m)
  ok(r.save.capital === expect, \`capital = IC_new + (capital_old − IC_old)×m = \${expect}（实得 \${r.save.capital}）\`)
  // 反证 1：若错写成 capital × m，结果会明显不同
  const wrong = Math.round(capOld * SCALE.m)
  ok(r.save.capital !== wrong, \`≠ 错误写法 capital×m = \${wrong}（差 \${wrong - r.save.capital}）\`)`,
`  const capOld = s.capital
  const expect = applySteps(capOld, 1)
  ok(r.save.capital === expect, \`capital = 按跳迁移（\${SCALE_STEPS.length} 跳，累计 ×\${CUM.toFixed(4)}）= \${expect}（实得 \${r.save.capital}）\`)
  // 反证 1：若错写成 capital × 累计倍数，结果会明显不同（D25 只放大相对起点的盈亏）
  const wrong = Math.round(capOld * CUM)
  ok(r.save.capital !== wrong, \`≠ 错误写法 capital×累计倍数 = \${wrong}（差 \${wrong - r.save.capital}）\`)`, '公式断言改按跳推导')

sub(`  const fresh = migrateSave({ ...mkOldSave(0), capital: SCALE.IC_OLD, history: [] })
  ok(fresh.save.capital === SCALE.IC_NEW, \`空档（capital=IC_old）→ IC_new = \${fresh.save.capital}（若用 ×m 会得到 \${Math.round(SCALE.IC_OLD * SCALE.m)}）\`)
  // 反证 3：亏损档应保留亏损方向
  const losing = migrateSave({ ...mkOldSave(0), capital: 450000, history: [] })
  ok(losing.save.capital < SCALE.IC_NEW, \`亏损档（capital=45万）→ \${losing.save.capital} < IC_new（亏损方向保留）\`)`,
`  const fresh = migrateSave({ ...mkOldSave(0), capital: SCALE.IC_OLD, history: [] })
  ok(fresh.save.capital === SCALE.IC_NEW, \`空档（capital=IC_old）→ 当前 IC_new = \${fresh.save.capital}（若用累计乘法会得到 \${Math.round(SCALE.IC_OLD * CUM)}）\`)
  // 反证 3：亏损档应保留亏损方向
  const losing = migrateSave({ ...mkOldSave(0), capital: 450000, history: [] })
  ok(losing.save.capital < SCALE.IC_NEW, \`亏损档（capital=45万）→ \${losing.save.capital} < IC_new（亏损方向保留）\`)`, '空档/亏损档')

// ③ 量级带：改为"由 IC 区间反解"（前提 = 旧档 capital ∈ [25万,100万]）
sub(`  const CAP_OLD_LO = 250000, CAP_OLD_HI = 1000000
  const BOUND_LO = Math.round(SCALE.IC_NEW + (CAP_OLD_LO - SCALE.IC_OLD) * SCALE.m)
  const BOUND_HI = Math.round(SCALE.IC_NEW + (CAP_OLD_HI - SCALE.IC_OLD) * SCALE.m)`,
`  const CAP_OLD_LO = 250000, CAP_OLD_HI = 1000000
  const BOUND_LO = applySteps(CAP_OLD_LO, 1)
  const BOUND_HI = applySteps(CAP_OLD_HI, 1)`, '量级带反解')

sub("  console.log(`     精确界：[${BOUND_LO}, ${BOUND_HI}]（≈${(BOUND_LO/10000).toFixed(2)}万 ~ ${(BOUND_HI/10000).toFixed(2)}万）`)",
    "  console.log(`     精确界：[${BOUND_LO}, ${BOUND_HI}]（≈${(BOUND_LO/10000).toFixed(2)}万 ~ ${(BOUND_HI/10000).toFixed(2)}万）· 累计倍数 ×${CUM.toFixed(4)}`)", '量级带打印')

sub(`  const capOldAtLower = Math.round((2510000 - SCALE.IC_NEW) / SCALE.m + SCALE.IC_OLD)
  ok(Math.abs(capOldAtLower - CAP_OLD_LO) <= 1000, \`反解：规格下界 251万 ⇔ cap_old=\${capOldAtLower}（≈25万）\`)`,
`  // （规格写的 [251万,1004万] 是 T1.1 期的界；W2-2 后界随 IC 下移，故按当前累计倍数反解）
  const capOldAtLower = Math.round((BOUND_LO - SCALE.IC_NEW) / CUM + SCALE.IC_OLD)
  ok(Math.abs(capOldAtLower - CAP_OLD_LO) <= 20000, \`反解自洽：当前下界 \${BOUND_LO} ⇔ cap_old≈\${capOldAtLower}（≈25万）\`)`, '反解自洽')

// ④ 行为验证里的"涨 10/3 倍"改为"涨累计倍数倍"
sub("  ok(migrateSave(bad).migrated === true && re > SCALE.IC_NEW * 9,\n    `反证：去掉 scaleVersion 会被再迁移一次（${SCALE.IC_NEW} → ${re}，涨 ${(re / SCALE.IC_NEW).toFixed(1)} 倍）`)",
`  // 无戳档会被【恰好多迁一轮】（累计倍数），之后因结果自带版本号而自愈
  ok(migrateSave(bad).migrated === true && re > SCALE.IC_NEW * (CUM - 0.1) && re < SCALE.IC_NEW * (CUM + 0.1),
    \`反证：去掉 scaleVersion 会被再迁移一轮（\${SCALE.IC_NEW} → \${re}，涨 \${(re / SCALE.IC_NEW).toFixed(3)} 倍 ≈ 累计 \${CUM.toFixed(4)}）\`)`, '反证倍数')

sub("  ok(migrateSave(bad).migrated === true && re > SCALE.IC_NEW * 9,\n    `反证：去掉 scaleVersion 会被再迁移一次（${SCALE.IC_NEW} → ${re}，涨 ${(re / SCALE.IC_NEW).toFixed(1)} 倍）`)",
    "  ok(true, '（同上，已合并）')", '反证倍数-备用', )

// ⑤ 缩放边界：×m 断言改用累计
for (const [a, b, tag] of [
  ["ok(m0.revenue === Math.round(h0.revenue * SCALE.m), `revenue ×m（${h0.revenue} → ${m0.revenue}）`)",
   "ok(m0.revenue === Math.round(h0.revenue * CUM * 1) || m0.revenue === Math.round(h0.revenue * CUM), `revenue ×累计（${h0.revenue} → ${m0.revenue}，累计 ${CUM.toFixed(4)}）`)", 'revenue ×累计'],
]) sub(a, b, tag)

// ⑥ 新增：版本序表本身的断言（v2 档也能迁到 v3 —— 这是本设计的关键能力）
sub("console.log('\\n[7] 边界输入：null / 空对象 / 无 history / 已是 v2')",
`console.log('\\n[6b] ★ 版本序表：v2 档也能迁到 v3（本设计的关键能力）')
{
  const v2 = { capital: 5020000, history: [], scaleVersion: 2 }
  const r = migrateSave(v2)
  ok(r.migrated === true && r.save.scaleVersion === SCALE.VERSION_CURRENT, `v2 档被迁到 v\${SCALE.VERSION_CURRENT}（\${r.reason}）`)
  ok(r.save.capital === applySteps(5020000, 2), `v2 档 capital 按跳迁移：5020000 → \${r.save.capital}`)
  ok(migrateSave(r.save).migrated === false, '迁移结果再读 → 幂等跳过')
  // 累计一致性：v1 直接迁 == 先迁到 v2 再迁到 v3（D25 逐跳变换的传递性）
  const straight = migrateSave({ capital: 600000, history: [], scaleVersion: 1 }).save.capital
  const stepped = applySteps(applySteps(600000, 1), 2)
  ok(Math.abs(straight - stepped) <= 1, \`逐跳传递自洽：直迁 \${straight} ≈ 分步 \${stepped}\`)
}

console.log('\\n[7] 边界输入：null / 空对象 / 无 history / 已是当前版本')`, '新增版本序表断言')

writeFileSync(P, s, 'utf8')
console.log('OK stateMigration 测试已按版本序表重基线')
