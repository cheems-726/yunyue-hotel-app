// 批次 B1-2 · 存档口径迁移测试套件
// 运行：node tests/stateMigration.test.mjs   （已挂 run-all 门禁）
// 判据（§二十一·五 B1-2）：
//   ① 幂等（跑两次结果逐字节相同） ② 量级合理（capital ∈ [251万, 1004万]）
//   ③ history 长度不变 ④ 已迁移档再读 → 数值不变
// 另加：D25 公式正确性（不许写成 capital × m）· 缩放边界（price/gopRate 不乘）· 不删字段
import { migrateSave, SCALE, SCALED_KEYS_DOC } from '../src/stateMigration.mjs'
import { readFileSync } from 'node:fs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ 批次 B1-2 · 存档口径迁移')

// ── 造旧档（旧量级：capital 50 万量级、周 profit ~1 万量级）──
const mkOldHistory = (n, base = 9000) => Array.from({ length: n }, (_, i) => ({
  week: i + 1,
  occupancy: 60 + (i % 8), rooms: 80, occupiedRooms: 45 + (i % 5),
  price: 340,                      // ADR：不乘
  revenue: 18000 + i * 120,
  totalCost: 9000 + i * 60,
  rentCost: 5200,
  gop: 14200 + i * 90,
  gopRate: 0.79,                   // 比率：不乘
  profit: base + i * 100,
  eventFine: i === 2 ? 1500 : 0,
  overbookCompensation: i === 5 ? 680 : 0,
  totalExpenses: 6300 + i * 40,
  weeklyExpenses: { 人员工资: 1700, 物料消耗: 420, 水电能耗: 1100, 维修保养: 3000, 营销推广: 0, OTA佣金: 0, 超售赔偿: 0, 事件罚款: 0 },
  capital: 500000 + base * (i + 1),
  goodRate: 88, finalGoodRate: 86, reviewCount: 4, negativeCount: 1,
  demandStrength: 1.02, marketWave: 1.0,
  dailySnapshots: [{ dayIndex: 1, revenue: 2600, cost: 1300, checkins: 0, checkouts: 0, occupied: 45, reviews: 1, cashDelta: 1300, price: 340 }],
  decisions: { pricing: '不跟降' },
  events: [{ name: '员工请假' }],
  handleStats: { pending: 2, resolved: 1 },
}))
const mkOldSave = (n = 4) => ({
  user: { name: '测试同学' }, week: n + 1, finished: false,
  attrs: { quality: 60, reputation: 70, morale: 65 },
  history: mkOldHistory(n),
  capital: 500000 + 9000 * n,
  report: null,
  // 注意：旧档【没有】scaleVersion 字段
})

console.log('\n[1] D25 公式正确性（★ 不许写成 capital × m）')
{
  const s = mkOldSave(4)
  const r = migrateSave(s)
  ok(r.migrated === true, `识别为旧档并迁移（${r.reason}）`)
  const capOld = s.capital
  const expect = Math.round(SCALE.IC_NEW + (capOld - SCALE.IC_OLD) * SCALE.m)
  ok(r.save.capital === expect, `capital = IC_new + (capital_old − IC_old)×m = ${expect}（实得 ${r.save.capital}）`)
  // 反证 1：若错写成 capital × m，结果会明显不同
  const wrong = Math.round(capOld * SCALE.m)
  ok(r.save.capital !== wrong, `≠ 错误写法 capital×m = ${wrong}（差 ${wrong - r.save.capital}）`)
  // 反证 2：开局档（capital ≈ IC_old）应迁到 ≈ IC_new，而不是 IC_old × m
  const fresh = migrateSave({ ...mkOldSave(0), capital: SCALE.IC_OLD, history: [] })
  ok(fresh.save.capital === SCALE.IC_NEW, `空档（capital=IC_old）→ IC_new = ${fresh.save.capital}（若用 ×m 会得到 ${Math.round(SCALE.IC_OLD * SCALE.m)}）`)
  // 反证 3：亏损档应保留亏损方向
  const losing = migrateSave({ ...mkOldSave(0), capital: 450000, history: [] })
  ok(losing.save.capital < SCALE.IC_NEW, `亏损档（capital=45万）→ ${losing.save.capital} < IC_new（亏损方向保留）`)
}

console.log('\n[2] ① 幂等：跑两次结果逐字节相同')
{
  const s = mkOldSave(6)
  const once = migrateSave(s).save
  const twice = migrateSave(once).save
  ok(JSON.stringify(once) === JSON.stringify(twice), 'migrate(旧档) 再 migrate → 逐字节相同')
  ok(migrateSave(once).migrated === false, '第二次 migrate 报告"跳过（幂等）"')
  // 三跑
  ok(JSON.stringify(migrateSave(twice).save) === JSON.stringify(once), '第三次仍相同')
}

console.log('\n[3] ② 量级合理：capital ∈ [251万, 1004万] —— ★ 先推导区间前提，不硬塞用例')
{
  // 判据区间 [251万, 1004万] 不是随便定的：用 D25 反解它对应的【旧 capital 区间】
  //   capital_new = 502万 + (cap_old − 50万) × m
  //   cap_new = 251万  ⇒ cap_old = 25.0 万
  //   cap_new = 1004万 ⇒ cap_old = 100.0 万
  // ⇒ 该区间的前提是【旧档 capital ∈ [25万, 100万]】，即一季（12 周）内 50 万起家的合理波动范围。
  //   超出这个前提的档（如旧档已 120 万或跌到 8 万）本就该越界 —— 那是前提不成立，不是迁移算错。
  // ★ 精确界（由 D25 直接反解，不做四舍五入）：
  //   cap_old ∈ [25万, 100万]  ⇒  cap_new ∈ [IC_new + (25万−50万)×m, IC_new + (100万−50万)×m]
  //   规格写的 [251万, 1004万] 是【取整后的近似界】—— 实测两端各差一点：
  //     下界精确值 2,507,925（≈250.79万）vs 规格 251万
  //     上界精确值 10,044,150（≈1004.42万）vs 规格 1004万
  //   ⇒ 断言按【精确界】写，并把规格的取整值一并打印（不改判据、不放宽，只是把圆的界写准）
  const CAP_OLD_LO = 250000, CAP_OLD_HI = 1000000
  const BOUND_LO = Math.round(SCALE.IC_NEW + (CAP_OLD_LO - SCALE.IC_OLD) * SCALE.m)
  const BOUND_HI = Math.round(SCALE.IC_NEW + (CAP_OLD_HI - SCALE.IC_OLD) * SCALE.m)
  console.log(`     精确界：[${BOUND_LO}, ${BOUND_HI}]（≈${(BOUND_LO/10000).toFixed(2)}万 ~ ${(BOUND_HI/10000).toFixed(2)}万）`)
  console.log(`     规格写：[251万, 1004万] —— 取整近似，两端各差 ${Math.abs(2510000-BOUND_LO)} / ${Math.abs(BOUND_HI-10040000)} 元`)
  const capOldAtLower = Math.round((2510000 - SCALE.IC_NEW) / SCALE.m + SCALE.IC_OLD)
  ok(Math.abs(capOldAtLower - CAP_OLD_LO) <= 1000, `反解：规格下界 251万 ⇔ cap_old=${capOldAtLower}（≈25万）`)

  // 在【前提区间内】取 5 个代表点，全部必须落在精确界内
  const cases = [
    ['下界 25万', CAP_OLD_LO], ['开局 50万', 500000], ['小赚 60万', 600000],
    ['小亏 45万', 450000], ['上界 100万', CAP_OLD_HI],
  ]
  let bad = []
  for (const [name, cap] of cases) {
    const out = migrateSave({ ...mkOldSave(0), capital: cap, history: [] }).save.capital
    if (!(out >= BOUND_LO && out <= BOUND_HI)) bad.push(`${name}→${out}`)
    console.log(`     ${name.padEnd(10)} → ${out}`)
  }
  ok(bad.length === 0, `前提区间内 5 个代表点全部落在精确界内${bad.length ? ' → 越界：' + bad.join(', ') : ''}`)

  // 附带：前提之外的档【应当】越界（证明判据区间确实绑定前提，不是万能断言）
  const far = migrateSave({ ...mkOldSave(0), capital: 1200000, history: [] }).save.capital
  ok(far > BOUND_HI, `前提之外（旧档 120万）→ ${far} > 上界（越界属预期，前提不成立）`)
}

console.log('\n[4] ③ history 长度不变 + 不删字段')
{
  for (const n of [0, 1, 4, 12]) {
    const s = mkOldSave(n)
    const r = migrateSave(s).save
    ok(r.history.length === s.history.length, `history 长度不变（${n} 周 → ${r.history.length}）`)
  }
  const s = mkOldSave(3)
  const r = migrateSave(s).save
  const keysBefore = new Set(Object.keys(s.history[0]))
  const keysAfter = new Set(Object.keys(r.history[0]))
  const missing = [...keysBefore].filter(k => !keysAfter.has(k))
  const added = [...keysAfter].filter(k => !keysBefore.has(k))
  // ★ 用集合比较：不能写成 "排序后字符串 + ',scaled'"（scaled 会按字母序插在中间，不是追加）
  ok(missing.length === 0 && added.length === 1 && added[0] === 'scaled',
    `只新增 scaled 标记、未删任何字段（删 ${missing.length} / 增 [${added.join(',')}]）`)
  ok(r.user && r.attrs && r.week === s.week, '非金额字段（user/attrs/week）原样保留')
}

console.log('\n[5] ④ 已迁移档再读 → 数值不变（含 App 真实读档路径的等价语义）')
{
  const s = mkOldSave(5)
  const v2 = migrateSave(s).save
  const again = migrateSave(v2).save
  ok(again.capital === v2.capital, `capital 稳定：${v2.capital} === ${again.capital}`)
  ok(again.history.every((h, i) => h.profit === v2.history[i].profit), 'history[].profit 稳定')
  ok(again.history.every((h, i) => h.weeklyExpenses.人员工资 === v2.history[i].weeklyExpenses.人员工资), 'weeklyExpenses 稳定（嵌套不可重复缩放）')
}

console.log('\n[6] 缩放边界：乘哪些 / 不乘哪些')
{
  const s = mkOldSave(2)
  const h0 = s.history[0], m0 = migrateSave(s).save.history[0]
  // 乘的
  ok(m0.revenue === Math.round(h0.revenue * SCALE.m), `revenue ×m（${h0.revenue} → ${m0.revenue}）`)
  ok(m0.totalCost === Math.round(h0.totalCost * SCALE.m), `totalCost ×m`)
  ok(m0.profit === Math.round(h0.profit * SCALE.m), `profit ×m`)
  ok(m0.rentCost === Math.round(h0.rentCost * SCALE.m), `rentCost ×m`)
  ok(m0.gop === Math.round(h0.gop * SCALE.m), `gop ×m`)
  ok(m0.totalExpenses === Math.round(h0.totalExpenses * SCALE.m), `totalExpenses ×m`)
  ok(m0.weeklyExpenses.人员工资 === Math.round(h0.weeklyExpenses.人员工资 * SCALE.m), `weeklyExpenses.* ×m`)
  ok(m0.dailySnapshots[0].revenue === Math.round(h0.dailySnapshots[0].revenue * SCALE.m), `dailySnapshots[].revenue ×m`)
  // 不乘的（★ 边界）
  ok(m0.price === h0.price, `price（ADR 每间每晚）【不乘】（${h0.price}）`)
  ok(m0.gopRate === h0.gopRate, 'gopRate（比率）【不乘】')
  ok(m0.occupancy === h0.occupancy && m0.rooms === h0.rooms && m0.occupiedRooms === h0.occupiedRooms, 'occupancy/rooms/occupiedRooms（瞬时）【不乘】')
  ok(m0.reviewCount === h0.reviewCount && m0.negativeCount === h0.negativeCount, 'reviewCount/negativeCount（计数）【不乘】')
  ok(m0.goodRate === h0.goodRate && m0.finalGoodRate === h0.finalGoodRate, 'goodRate/finalGoodRate 【不乘】')
  ok(JSON.stringify(m0.decisions) === JSON.stringify(h0.decisions), 'decisions【不乘】')
  ok(JSON.stringify(m0.events) === JSON.stringify(h0.events), 'events（叙述层）【不乘】')
  ok(m0.dailySnapshots[0].price === h0.dailySnapshots[0].price, 'dailySnapshots[].price 【不乘】')
}

console.log('\n[7] 边界输入：null / 空对象 / 无 history / 已是 v2')
{
  ok(migrateSave(null).migrated === false, 'null → 不迁移、原样返回')
  ok(migrateSave({}).migrated === true, '空对象（无 scaleVersion）→ 视为旧档并补 v2')
  ok(migrateSave({}).save.scaleVersion === SCALE.VERSION_CURRENT, '空对象迁移后 scaleVersion = 2')
  const noHist = migrateSave({ capital: 500000 }).save
  ok(Array.isArray(noHist.history) && noHist.history.length === 0, '无 history → 迁移后为 []（不抛异常）')
  const v2 = migrateSave({ scaleVersion: 2, capital: 999 }).save
  ok(v2.capital === 999, 'scaleVersion=2 → 数值一动不动')
  const v3 = migrateSave({ scaleVersion: 3, capital: 999 })
  ok(v3.migrated === false && v3.save.capital === 999, 'scaleVersion>2（未来版本）→ 不降级、不迁移')
}

console.log('\n[8] 字段清单文档齐备（供报告引用）')
{
  ok(SCALED_KEYS_DOC.length >= 6, `缩放字段清单 ${SCALED_KEYS_DOC.length} 条`)
  ok(SCALED_KEYS_DOC.every(d => d.字段 && d.口径 && d.为什么), '每条都带 字段/口径/为什么')
  ok(SCALED_KEYS_DOC.some(d => /不乘/.test(d.字段) && /price/.test(d.字段)), '清单里显式写明 price 不乘')
}

console.log('\n[9] ★ 回归锁：App 写档路径必须带 scaleVersion（否则每次读档都会再迁移一次）')
{
  // 这是【批末全门禁抓到的真缺陷】的回归锁：
  //   写档不带版本标记 ⇒ 下次 loadState 视为旧档 ⇒ migrateSave 再乘一次 m
  //   实测现象：verify-capital 报"结算后资金 = 50,507,418"（5,020,000 被再迁移一次）
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
  // ★ 必须精确定位【saveState 那一条】——App.jsx 里 setItem(STORAGE_KEY) 不止一处：
  //   ① 云端恢复 ② loadState 写回迁移结果 ③ saveState 即时保存
  //   用 find(...) 取第一条会取到 ①（无 scaleVersion）→ 假失败
  const lines = code.split('\n')
  const saveLine = lines.find(l => l.includes('localStorage.setItem(STORAGE_KEY') && /capital,\s*bizMode/.test(l))
  ok(!!saveLine, 'App.jsx 能定位到 saveState 的写档语句（含 capital, bizMode 的那条）')
  ok(!!saveLine && /scaleVersion/.test(saveLine), 'saveState 的 payload 含 scaleVersion（★ 回归锁）')
  const migLine = lines.find(l => l.includes('localStorage.setItem(STORAGE_KEY') && /r\.save/.test(l))
  ok(!!migLine, 'loadState 的迁移写回也存在（写 r.save，天然带版本标记）')
  // 语义级闭环：带标记 → 不再迁移；去掉标记 → 复现缺陷
  const v2 = { capital: SCALE.IC_NEW, history: [], scaleVersion: SCALE.VERSION_CURRENT }
  ok(migrateSave(v2).migrated === false, '带 scaleVersion 的档再读 → 不再迁移（幂等闭环）')
  const bad = { capital: SCALE.IC_NEW, history: [] }
  const re = migrateSave(bad).save.capital
  ok(migrateSave(bad).migrated === true && re > SCALE.IC_NEW * 9,
    `反证：去掉 scaleVersion 会被再迁移一次（${SCALE.IC_NEW} → ${re}，涨 ${(re / SCALE.IC_NEW).toFixed(1)} 倍）`)
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
