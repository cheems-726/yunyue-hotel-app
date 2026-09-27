// 批次 B1.5-4 · 云端路径补迁的验收套件
// 运行：node tests/cloudMigration.test.mjs   （已挂 run-all）
//
// 判据（用户 B1 抽查 + B1.5 要求）：
//   ① 写入侧：所有写档 payload 都盖版本戳（本机 + 云端上传）
//   ② 读取侧：云端恢复走 restoreFromCloud（旧云档按 D25 迁移）
//   ③ 回写侧：迁移后立刻落本机 v2（不留"恢复后被再迁一次"的窗口）
//   ④ 教师端读取侧：同样过 restoreFromCloud（只读迁移、不回写云端）
//   ★⑤ 断言必须能复现"修复前失败"：把修复回退掉，本套件必须变红
//   ⑥ D30：dailySnapshots 保持持久化 ⇒ 实测一次存档体积
import { restoreFromCloud, withScaleVersion, migrateSave, SCALE } from '../src/stateMigration.mjs'
import { readFileSync, readdirSync } from 'node:fs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const SRC = new URL('../src/', import.meta.url)
const codeOf = (f) => readFileSync(new URL(f, SRC), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')

console.log('▶ 批次 B1.5-4 · 云端路径补迁')

// ── 旧云档样例（旧量级）──
const legacyCloud = () => ({
  week: 5, established: true, finished: false,
  attrs: { quality: 62, reputation: 71, morale: 66 },
  capital: 548000,
  history: [
    { week: 1, occupancy: 62, price: 340, revenue: 18400, totalCost: 9100, profit: 9300, capital: 509300, weeklyExpenses: { 人员工资: 1700 }, reviewCount: 4, negativeCount: 1 },
    { week: 2, occupancy: 58, price: 340, revenue: 17200, totalCost: 8900, profit: 8300, capital: 517600, weeklyExpenses: { 人员工资: 1650 }, reviewCount: 4, negativeCount: 1 },
  ],
})

console.log('\n[1] ② 读取侧：restoreFromCloud（旧云档按 D25 迁移）')
{
  const raw = legacyCloud()
  const r = restoreFromCloud(raw)
  ok(r.migrated === true, `旧云档被识别并迁移（${r.reason}）`)
  const capOld = raw.capital
  const expectCap = Math.round(SCALE.IC_NEW + (capOld - SCALE.IC_OLD) * SCALE.m)
  ok(Math.abs(r.state.capital - expectCap) <= 2, `capital 按 D25 按跳迁移：${capOld} → ${r.state.capital}（期望 ${expectCap}，两跳各取整 ⇒ 容差 2 元）`)
  ok(r.state.capital !== Math.round(capOld * SCALE.m), `≠ 错误写法 capital×m = ${Math.round(capOld * SCALE.m)}`)
  ok(r.state.history.length === raw.history.length, `history 长度不变（${r.state.history.length}）`)
  ok(r.state.history[0].profit === Math.round(raw.history[0].profit * SCALE.m), `history[].profit ×m（${raw.history[0].profit} → ${r.state.history[0].profit}）`)
  ok(r.state.history[0].weeklyExpenses.人员工资 === Math.round(raw.history[0].weeklyExpenses.人员工资 * SCALE.m), '嵌套 weeklyExpenses 同步 ×m')
  ok(r.state.history[0].price === raw.history[0].price, 'price（ADR）【不乘】')
  ok(r.state.scaleVersion === SCALE.VERSION_CURRENT, '迁移结果带 scaleVersion=2（可直接回写）')
  ok(!!r.state.attrs && r.state.week === raw.week && r.state.established === true, '非金额字段原样保留')
  // 幂等：迁移结果再走一次 restoreFromCloud
  const again = restoreFromCloud(r.state)
  ok(again.migrated === false && again.state.capital === r.state.capital, '迁移结果再恢复 → 不再迁移（幂等）')
}

console.log('\n[2] ② 读取侧边界：null / 空对象 / v2 / 未来版本')
{
  ok(restoreFromCloud(null).state === null, 'null → state=null（云端无档）')
  ok(restoreFromCloud(undefined).state === null, 'undefined → state=null')
  // 🔴 W2-2：v2（T1.1 期）不再是当前版本 —— 它要再迁一跳（v2→v3，×0.2970）
  const v2 = restoreFromCloud({ scaleVersion: 2, capital: 5020000 })
  ok(v2.migrated === true && v2.state.capital !== 5020000, `v2 云档 → 再迁一跳：5020000 → ${v2.state.capital}`)
  const vCur = restoreFromCloud({ scaleVersion: SCALE.VERSION_CURRENT, capital: 5020000 })
  ok(vCur.migrated === false && vCur.state.capital === 5020000, '已是当前版本的云档 → 原样返回')
  const v3 = restoreFromCloud({ scaleVersion: 3, capital: 5020000 })
  ok(v3.state.capital === 5020000, 'v3（未来版本）→ 不降级、不改数值')
}

console.log('\n[3] ① 写入侧：withScaleVersion 盖戳')
{
  const p = { capital: 5020000, history: [] }
  const w = withScaleVersion(p)
  ok(w.scaleVersion === SCALE.VERSION_CURRENT, '盖 scaleVersion=2')
  ok(p.scaleVersion === undefined, '不改入参（纯函数）')
  ok(withScaleVersion(w).scaleVersion === SCALE.VERSION_CURRENT, '已是 v2 再盖仍稳定（幂等）')
  ok(withScaleVersion(null) === null, 'null 原样返回（不抛异常）')
}

console.log('\n[4] ★★ 回归锁：四道云端路径都必须过统一入口（回退任一处 → 本段变红）')
{
  const app = codeOf('App.jsx')
  const tch = codeOf('TeacherDashboard.jsx')
  const lines = app.split('\n')

  // 写入侧 · 本机
  const localSave = lines.find(l => l.includes('localStorage.setItem(STORAGE_KEY') && /capital,\s*bizMode/.test(l))
  ok(!!localSave && /withScaleVersion/.test(localSave), '① 本机 saveState payload 过 withScaleVersion')
  // 写入侧 · 云端上传
  const upload = lines.find(l => l.includes('const cloudState ='))
  ok(!!upload && /withScaleVersion/.test(upload), '② 云端上传 payload 过 withScaleVersion')
  // 读取侧 · 学生端云端恢复
  ok(/restoreFromCloud\(cloudRaw\)/.test(app), '③ 学生端云端恢复走 restoreFromCloud')
  // 回写侧 · 迁移后落本机
  ok(lines.some(l => /localStorage\.setItem\(STORAGE_KEY/.test(l) && /withScaleVersion\(cloudSaved\)/.test(l)),
    '④ 迁移后立刻把 v2 回写本机（withScaleVersion(cloudSaved)）')
  // 教师端读取侧
  ok(/restoreFromCloud\(gs && gs\.state\)/.test(tch), '⑤ 教师端读取侧走 restoreFromCloud（只读迁移）')
  // 兜底：代码里不得再出现"手写 scaleVersion" 的旁路（必须统一走 withScaleVersion）
  const handStamped = lines.filter(l => /scaleVersion:\s*SCALE\.VERSION_CURRENT/.test(l) && !/withScaleVersion/.test(l))
  ok(handStamped.length === 0, `⑥ 无手写 scaleVersion 旁路（发现 ${handStamped.length} 处）`)
}

console.log('\n[5] ★ 复现"修复前失败"：语义闭环验证')
{
  // 把修复【从语义上】回退：写档不带戳 ⇒ 下次恢复把新档当旧档再迁一次
  const savedWithoutStamp = { capital: SCALE.IC_NEW, history: [], attrs: {} }   // ← 这就是"修复前"写出去的档
  const re = restoreFromCloud(savedWithoutStamp)
  // 🔴 W2-2：倍数改为【累计缩放】相对（原写死 9 倍是单跳 ×10 时代的界）
  ok(re.migrated === true && re.state.capital > SCALE.IC_NEW * (SCALE.m - 0.2) && re.state.capital < SCALE.IC_NEW * (SCALE.m + 0.2),
    `无戳档被再迁一次：${SCALE.IC_NEW} → ${re.state.capital}（涨 ${(re.state.capital / SCALE.IC_NEW).toFixed(1)} 倍）`)
  // 正确路径：写（盖戳）→ 读（restore）→ 数值恒定
  let cur = { capital: SCALE.IC_NEW, history: [], attrs: {} }
  for (let i = 0; i < 5; i++) cur = restoreFromCloud(withScaleVersion(cur)).state
  ok(cur.capital === SCALE.IC_NEW, `写→读 循环 5 次，capital 恒定 ${cur.capital}（有戳 ⇒ 不再迁移）`)
  // 对照：不盖戳会【多迁一次】——注意只会多迁一次，不是连乘：
  //   migrateSave 的结果自带 scaleVersion=2 ⇒ 第二次读就被跳过了（"自愈"）
  //   ⇒ 危害是【恰好多一个 m 倍】（这正是 B1 批末门禁抓到的 10.0 倍），不是无限放大
  //   ★ 这个"只多一次"的细节是套件跑出来的，纠正了我原先"循环 5 次会爆到天文数字"的想当然
  let bad = { capital: SCALE.IC_NEW, history: [], attrs: {} }
  let firstMigration = restoreFromCloud(bad)
  bad = firstMigration.state
  for (let i = 0; i < 4; i++) bad = restoreFromCloud(bad).state
  const factor = bad.capital / SCALE.IC_NEW
  ok(firstMigration.migrated === true && factor > SCALE.m - 0.2 && factor < SCALE.m + 0.2,
    `对照：无戳档被【恰好多迁一次】→ ${SCALE.IC_NEW} → ${bad.capital}（${factor.toFixed(2)}×，之后自愈稳定）`)
}

console.log('\n[6] D30：dailySnapshots 保持持久化 —— 实测存档体积')
{
  const H = 12, DAYS = 7
  const mkHist = (withDays) => Array.from({ length: H }, (_, w) => {
    const base = { week: w + 1, occupancy: 62, rooms: 80, occupiedRooms: 50, price: 340, revenue: 126140, totalCost: 62370, profit: 63770, capital: 5020000 + w * 63770, goodRate: 88, finalGoodRate: 86, reviewCount: 4, negativeCount: 1, weeklyExpenses: { 人员工资: 1700, 物料消耗: 420, 水电能耗: 1100, 维修保养: 3000, 营销推广: 0, OTA佣金: 0, 超售赔偿: 0, 事件罚款: 0 } }
    if (withDays) base.dailySnapshots = Array.from({ length: DAYS }, (_, d) => ({ dayIndex: d + 1, revenue: 18020, cost: 8910, checkins: 0, checkouts: 0, occupied: 50, reviews: 1, cashDelta: 9110, price: 340 }))
    return base
  })
  const size = (h) => Buffer.byteLength(JSON.stringify({ capital: 5020000, history: h, attrs: { quality: 60, reputation: 70, morale: 65 } }), 'utf8')
  const a = size(mkHist(false)), b = size(mkHist(true))
  const perWeek = (b - a) / H
  console.log(`     12 周存档（不含日快照）  ：${a.toLocaleString()} 字节（${(a / 1024).toFixed(1)} KB）`)
  console.log(`     12 周存档（含日快照·D30）：${b.toLocaleString()} 字节（${(b / 1024).toFixed(1)} KB）`)
  console.log(`     日快照增量：+${(b - a).toLocaleString()} 字节（+${((b / a - 1) * 100).toFixed(0)}%），约 ${Math.round(perWeek)} 字节/周`)
  ok(b > a, `日快照确实增加体积（+${((b / a - 1) * 100).toFixed(0)}%）`)
  ok(b < 200 * 1024, `含日快照的 12 周存档仍 < 200 KB（实测 ${(b / 1024).toFixed(1)} KB）⇒ 持久化成本可接受（D30 选 a 成立）`)
  // 18 周（长学期）外推
  const size18 = Math.round(a / H * 18 + (b - a) / H * 18)
  ok(size18 < 300 * 1024, `外推 18 周 ≈ ${(size18 / 1024).toFixed(1)} KB（仍 < 300 KB）`)
}

console.log('\n[7] 静态：stateMigration.mjs 不得残留"未导出却内联"的迁移逻辑')
{
  const files = readdirSync(SRC).filter(f => /\.(js|jsx|mjs)$/.test(f) && !f.startsWith('settle-old'))
  const offenders = files.filter(f => {
    const c = codeOf(f)
    // 除 stateMigration 自身外，任何文件不得出现"×10.0483"这类裸换算
    return f !== 'stateMigration.mjs' && /10\.0483/.test(c)
  })
  ok(offenders.length === 0, `除 stateMigration.mjs 外无裸换算系数 10.0483（发现 ${offenders.length} 个：${offenders.join(',')}）`)
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
