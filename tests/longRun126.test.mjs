// ★★ §23.1(a) 正名（D65）：本套件 = 【引擎长稳压力测试（18 周 · 非学期口径）】——
//   它跑的是学生永远玩不到的时长（学期 = 12 周，semester.mjs 单源），
//   其"期末资金"是【18 周后的资金】，**不是学期末成绩**，不许被当作"期末"引用。
//   学期口径的六组数字在 tests/semesterRun12.test.mjs（12 周，同源 TOTAL_WEEKS）。
//   ★ 口径守卫：若产品学期被改成 18 周 ⇒ 本套件红（长稳压测与学期同长 = 失去意义，需人工复核）。
// 批次 B2-1 · 126 天长跑（18 周）+ 故障注入
// 运行：node tests/longRun126.test.mjs [--report]   （--report 额外打印落文档用的表格）
//
// 判据（§二十一·五 批次 B2-1）：
//   ① 无崩溃 / 无 NaN
//   ② 中途接入组与全程在线组【终值一致】
//   ③ 补算 === 连续运行
//   ④ 全学期 资金 / 口碑 / 属性 不出界
//   ⑤ 18 项决策所有周都能结算
//   ⑥ Σ7天 === 周值（新口径下重验）
//   ★ 越界逐条列出，【不许调阈值】
import { settle } from '../src/settlement.js'
import { SCALE } from '../src/stateMigration.mjs'   // W5-1：预警线单源（原写死 100.4 万 = W2-2 之前的旧口径）
import { decisions as DECISIONS } from '../src/decisions.js'
import { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } from '../src/attrs.js'
import { TOTAL_WEEKS } from '../src/semester.mjs'

const WEEKS = 18
const DAYS = 7
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const WANT_REPORT = process.argv.includes('--report')

// 🔴 2026-09-28（N-6）：长跑必须走【真实链路】—— 原 SITE 只有六维、没有 district，
//   于是竞品表/客群表永远命中空键（竞品压力恒 0），长跑验的是一条【不存在的路径】。
const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2, district: '锦江区' }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }

// ── 全 18 项决策（取每项第一个选项；用于判据⑤"18 项决策所有周都能结算"）──
const FULL18 = Object.fromEntries(DECISIONS.map(d => [d.id, d.options ? d.options[0].label : (d.type === 'slider' ? d.min ?? 22 : '是')]))
// 数值型的那几项用合理值覆盖（取每项第一个选项会在 energy/overbook/member-threshold 上得到字符串）
const NUMERIC = { energy: 23, overbook: 2, 'member-threshold': 5 }

const STRATEGIES = {
  '1勤奋型': { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', ...NUMERIC },
  '2省钱型': { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', ...NUMERIC, energy: 20 },
  '3中间型': { pricing: '不跟降', shifts: '满编保服务', hygiene: '不停房', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', ...NUMERIC },
  '4躺平型': { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', reputation: '模板回复', ...NUMERIC, energy: 20 },
  '5激进型': { pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', ...NUMERIC, energy: 25, overbook: 5, campaign: '大促营销', ota: '全渠道上架' },
  '6逆袭型': { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', reputation: '道歉+赔偿', ...NUMERIC },
}
const RESOLVE = { '1勤奋型': 0.9, '2省钱型': 0.2, '3中间型': 0.5, '4躺平型': 0, '5激进型': 0.1, '6逆袭型': 0.5 }

// 深度扫 NaN / undefined（判据①）
function scanNaN(o, path = '$', out = []) {
  if (typeof o === 'number') { if (!Number.isFinite(o)) out.push(`${path} = ${o}`); return out }
  if (o === undefined) { out.push(`${path} = undefined`); return out }
  if (o === null || typeof o !== 'object') return out
  for (const [k, v] of Object.entries(o)) scanNaN(v, `${path}.${k}`, out)
  return out
}
const isNum = (x) => typeof x === 'number' && Number.isFinite(x)

/**
 * 跑一组 18 周。mode:
 *   'straight' 连续运行（基线）
 *   'roundtrip' 每周结算后做一次【存档 JSON 往返】（模拟断线重连 / 中途接入）
 *   'resume'    前 k 周在线、之后从存档恢复继续（模拟"离线冻结后补算"）
 */
function run18(dec, resolve, mode = 'straight', k = 6) {
  let attrs = { ...ATTR_INIT }, pg = null, cap = null, pn = 0, rs = 0
  const weeks = [], issues = []
  for (let w = 1; w <= WEEKS; w++) {
    let a = attrs
    for (const [id, ans] of Object.entries(dec)) a = applyDecisionToAttrs(a, id, ans)
    const r = settle({ site: SITE, brand: BRAND, decisions: dec, week: w, attrs: a, prevGoodRate: pg, prevCapital: cap, pendingNegatives: pn, resolvedCount: rs })
    // 判据⑥ Σ7天 === 周值（逐项）
    const ds = r.dailySnapshots
    if (!Array.isArray(ds) || ds.length !== DAYS) issues.push(`w${w} dailySnapshots 非 7 天`)
    else {
      const pairs = [['revenue', r.revenue], ['cost', r.totalCost], ['occupied', r.occupiedRooms], ['reviews', r.reviewCount], ['cashDelta', r.profit]]
      for (const [key, v] of pairs) {
        const sum = ds.reduce((s2, d) => s2 + (d[key] || 0), 0)
        if (sum !== v) issues.push(`w${w} Σ${key}=${sum} ≠ 周值 ${v}`)
      }
    }
    issues.push(...scanNaN(r, `w${w}`))
    weeks.push({ week: w, occupancy: r.occupancy, profit: r.profit, capital: r.capital, goodRate: r.finalGoodRate, negativeCount: r.negativeCount, attrs: normalizeAttrs(r.attrsAfter) })
    pg = r.finalGoodRate
    // 'roundtrip'：把"存档"序列化再读回（只保留存档里真正会持久化的字段）
    const saveLike = { capital: r.capital, history: [{ week: w, profit: r.profit }], attrs: r.attrsAfter, scaleVersion: 2 }
    cap = mode === 'roundtrip' ? JSON.parse(JSON.stringify(saveLike)).capital : r.capital
    if (mode === 'resume' && w === k) {
      // 模拟"离线冻结"：从存档恢复（值不变，但走一遍序列化路径）
      cap = JSON.parse(JSON.stringify({ capital: cap })).capital
    }
    const negCards = r.generatedReviews.filter(x => Number(x.stars) <= 3).length
    rs = Math.ceil(negCards * resolve); pn = Math.max(0, pn + negCards - rs)
    attrs = normalizeAttrs(r.attrsAfter)
  }
  return { weeks, issues }
}

console.log('▶ 引擎长稳压力测试（18 周 · 非学期口径 · §23.1a 正名）· 126 天 × 6 组 + 故障注入')
console.log(`  规模：${WEEKS} 周 = ${WEEKS * DAYS} 游戏日 · 6 组 · 决策项 ${DECISIONS.length} 项`)
ok(DECISIONS.length === 18, `决策项数 = 18（实测 ${DECISIONS.length}）`)
ok(Object.keys(FULL18).length === 18, `全 18 项答案集齐备（${Object.keys(FULL18).length} 项）`)
// ★ §23.1(a) 口径守卫（跨口径误用检测 · RV 靶子）：本套件是【长稳压测·非学期口径】——
//   与学期长度必须不同（互斥由机器钉住）。若产品学期被改为 18 周 ⇒ 本套件红（长稳压测与学期
//   同长 = 失去意义，需人工复核口径）。学期口径的六组数字在 tests/semesterRun12.test.mjs。
ok(TOTAL_WEEKS !== WEEKS, `★ 口径守卫：学期（${TOTAL_WEEKS} 周）≠ 长稳压测（${WEEKS} 周）⇒ 两口径互斥（D65 正名）`)

// ── 主跑 ──
const runs = {}
for (const [name, dec] of Object.entries(STRATEGIES)) runs[name] = run18(dec, RESOLVE[name], 'straight')

console.log('\n[1] ① 无崩溃 / 无 NaN（18 周 × 6 组 + 逐字段深扫）')
{
  const all = Object.entries(runs).flatMap(([n, r]) => r.issues.map(i => `${n} ${i}`))
  ok(all.length === 0, `126 天 × 6 组全跑通，深扫 NaN/undefined 命中 ${all.length} 处`)
  all.slice(0, 5).forEach(x => console.log('     · ' + x))
}

console.log('\n[2] ⑥ Σ7天 === 周值（新口径下重验，逐周逐项）')
{
  const bad = Object.entries(runs).flatMap(([n, r]) => r.issues.filter(i => i.includes('Σ')).map(i => n + ' ' + i))
  ok(bad.length === 0, `Σ7天 ≡ 周值：18 周 × 6 组 × 5 项 = ${18 * 6 * 5} 个恒等式全部成立`)
}

console.log('\n[3] ⑤ 18 项决策所有周都能结算')
{
  let threw = 0, nan = 0
  for (let w = 1; w <= WEEKS; w++) {
    try {
      const r = settle({ site: SITE, brand: BRAND, decisions: { ...FULL18, ...NUMERIC }, week: w, prevCapital: SCALE.IC_NEW, attrs: { quality: 60, reputation: 70, morale: 65 } })
      if (!isNum(r.profit) || !isNum(r.capital)) nan++
    } catch (e) { threw++; console.log(`     ✗ w${w} 抛异常：${e.message}`) }
  }
  ok(threw === 0 && nan === 0, `18 周逐周用【全 18 项决策】结算：抛异常 ${threw} 次、NaN ${nan} 次`)
}

console.log('\n[4] ②③ 断线重连 / 中途接入：终值必须与连续运行一致')
{
  let diff = 0
  for (const [name, dec] of Object.entries(STRATEGIES)) {
    const a = run18(dec, RESOLVE[name], 'straight')
    const b = run18(dec, RESOLVE[name], 'roundtrip')   // 每周 JSON 往返（= 每次刷新都从存档恢复）
    const c = run18(dec, RESOLVE[name], 'resume', 6)   // 第 6 周后中途恢复
    const same = JSON.stringify(a.weeks) === JSON.stringify(b.weeks) && JSON.stringify(a.weeks) === JSON.stringify(c.weeks)
    if (!same) diff++
    const endA = a.weeks[WEEKS - 1], endB = b.weeks[WEEKS - 1], endC = c.weeks[WEEKS - 1]
    console.log(`     ${name}：连续 capital=${endA.capital} ｜ 每周往返=${endB.capital} ｜ 中途恢复=${endC.capital} ${same ? '✅' : '❌'}`)
  }
  ok(diff === 0, `6 组三模式（连续 / 每周存档往返 / 中途恢复）终值逐字节一致（不一致 ${diff} 组）`)
  // 反证：把 seed 之外的输入改动一处，结果必须变（证明上面的一致不是"恒等假绿"）
  const base = run18(STRATEGIES['1勤奋型'], 0.9, 'straight')
  const tweak = run18({ ...STRATEGIES['1勤奋型'], pricing: '降价 20% 抢客' }, 0.9, 'straight')
  ok(JSON.stringify(base.weeks) !== JSON.stringify(tweak.weeks), '反证：改一项决策 → 结果确实变化（一致性断言非恒真）')
}

console.log('\n[5] ④ 全学期 资金/口碑/属性 不出界（★ 越界逐条列出，不调阈值）')
{
  const oob = []
  for (const [name, r] of Object.entries(runs)) {
    for (const w of r.weeks) {
      if (!(w.occupancy >= 0 && w.occupancy <= 100)) oob.push(`${name} w${w.week} occupancy=${w.occupancy}`)
      if (!(w.goodRate >= 0 && w.goodRate <= 100)) oob.push(`${name} w${w.week} goodRate=${w.goodRate}`)
      if (!(w.negativeCount >= 0)) oob.push(`${name} w${w.week} negativeCount=${w.negativeCount}`)
      if (!(w.capital > -1e9 && w.capital < 1e9)) oob.push(`${name} w${w.week} capital=${w.capital}`)
      for (const [k, v] of Object.entries(w.attrs)) if (!(v >= 0 && v <= 100)) oob.push(`${name} w${w.week} attrs.${k}=${v}`)
    }
    const end = r.weeks[WEEKS - 1]
    console.log(`     ${name}：期末 capital=${end.capital} 好评率=${end.goodRate}% 属性 品质${end.attrs.quality}/声誉${end.attrs.reputation}/士气${end.attrs.morale}`)
  }
  ok(oob.length === 0, `18 周 × 6 组 全部数值在界内（越界 ${oob.length} 处）`)
  oob.slice(0, 8).forEach(x => console.log('     ⚠ 越界：' + x))

  // 资金是否跌破破产线（0）—— 逐条报出
  const bankrupt = Object.entries(runs).filter(([, r]) => r.weeks.some(w => w.capital < 0))
  console.log(`     破产（capital<0）组数：${bankrupt.length}${bankrupt.length ? ' → ' + bankrupt.map(([n]) => n).join('、') : ''}`)
  const warn = Object.entries(runs).filter(([, r]) => r.weeks.some(w => w.capital < SCALE.变黄线))
  console.log(`     触预警（capital<${SCALE.变黄线 / 10000}万 = SCALE.变黄线 单源）组数：${warn.length}${warn.length ? ' → ' + warn.map(([n]) => n).join('、') : ''}`)
}

console.log('\n[6] 故障注入：脏输入不得崩溃、不得污染数值')
{
  const dirty = [
    ['attrs 为 null', { attrs: null }],
    ['attrs 缺字段', { attrs: { quality: 60 } }],
    ['prevCapital = NaN', { prevCapital: NaN }],
    ['prevCapital = Infinity', { prevCapital: Infinity }],
    ['prevCapital = null', { prevCapital: null }],
    ['prevGoodRate 越界', { prevGoodRate: 999 }],
    ['decisions 为空对象', { decisions: {} }],
    ['pendingNegatives 为负', { pendingNegatives: -5 }],
    ['resolvedCount = NaN', { resolvedCount: NaN }],
    ['week 超范围（99）', { week: 99 }],
  ]
  let bad = 0
  for (const [name, patch] of dirty) {
    try {
      const r = settle({ site: SITE, brand: BRAND, decisions: STRATEGIES['1勤奋型'], week: 1, attrs: { quality: 60, reputation: 70, morale: 65 }, ...patch })
      const nanList = scanNaN(r).filter(x => !/dailySnapshots\.price/.test(x))   // price 允许 null（一期不参与计算）
      const kOK = isNum(r.profit) && isNum(r.capital) && isNum(r.revenue)
      if (!kOK || nanList.length) { bad++; console.log(`     ⚠ ${name}：profit=${r.profit} capital=${r.capital} 异常字段 ${nanList.length}`) }
      else console.log(`     ✓ ${name} → profit=${r.profit} capital=${r.capital}（未崩溃、关键数值有限）`)
    } catch (e) { bad++; console.log(`     ✗ ${name}：抛异常 ${e.message}`) }
  }
  ok(bad === 0, `10 种脏输入全部不崩溃且关键数值有限（异常 ${bad} 种）`)
}

// ── --report：打印【落文档用】的表格 ────────────────────────────────
// 🔴 A-2（2026-09-27）：本标志原先【只声明、没实现】（写了 WANT_REPORT 却无人消费 —— BL-13"声明≠实现"），
//    重列期末资金证据时补实现：表格与《18周（126天）长跑报告.md》§二 同列，便于逐格替换。
if (WANT_REPORT) {
  console.log('\n══════ 落文档用表格（--report）══════')
  console.log('| 组别 | 期末资金 | 好评率 | 属性（品质/声誉/士气） |')
  console.log('|---|---|---|---|')
  for (const [name, r] of Object.entries(runs)) {
    const e = r.weeks[WEEKS - 1]
    console.log(`| ${name} | ${e.capital.toLocaleString()} | ${e.goodRate}% | ${e.attrs.quality} / ${e.attrs.reputation} / ${e.attrs.morale} |`)
  }
  console.log(`\n（起始资金 = SCALE.IC_NEW = ${SCALE.IC_NEW.toLocaleString()} 元 · WEEKS=${WEEKS}）`)
}

// ★★ §24.2（P1 口径钉子）：【产物数字断言】—— 18 周长稳六组期末资金钉进测试（值 = 当前实跑）。
//   失败信息指向对应文档（《18周（126天）长跑报告》§二 · 长稳口径 · 不当学期成绩引用）。
//   注意：这些是【压测口径】的钉子；学期口径的钉子在 tests/semesterRun12.test.mjs（互斥口径各钉各的）。
{
  const 钉子 = { '1勤奋型': 1867125, '2省钱型': 1352463, '3中间型': 1283768, '4躺平型': 1269213, '5激进型': 1183351, '6逆袭型': 1300169 }   // ★ §32-U4c-R6 重基线（决策风险化：代价 + 不作为惩罚 + 延迟后果）
  const 钉坏 = Object.entries(钉子).filter(([n, v]) => runs[n].weeks[WEEKS - 1].capital !== v)
  ok(钉坏.length === 0, '★★ 产物数字钉子：18 周长稳六组期末资金 === 钉死值（变了 ⇒ 更新《18周（126天）长跑报告》§二）',
    钉坏.map(([n, v]) => `${n} 实跑 ${runs[n].weeks[WEEKS - 1].capital} ≠ 钉值 ${v}`).join(' | '))
  // ★★ §25.1（2026-09-29 · D68）：【B2 前 = v4】的六组也钉住 —— 起因（决策端实核 + 执行端复核）：
  //   文档里"18 周长稳"的旧列（v4 · B2 前）会被当成现行值读；而 `reportCaliber [7]` 原先只解析每行
  //   **第一个**千分位数字 ⇒ 结构上只能覆盖第一列 ⇒ 该列**从未被任何断言覆盖**（"表在但没盖全"）。
  //   ★ 实测抓到的真缺陷：长跑报告 §二 3中间型 的「B2 前 = v4」格写成 1,622,062（那是 v4 的**两费前**值），
  //     真值 = **1,532,768**（v4 两费后 · 出处 `批次报告-二期§15第六批.md` §三）⇒ 该行与同表「差额 −249,000」自相矛盾。
  //   ★ 钉法：v4 六组用【恒等式】钉 —— ★ §32-U4-§1④：U3 后它已是【历史常量之间的关系】（不再牵连现行引擎），
  //     断言名已如实改成「历史常量一致性」，避免后人误以为它在守护引擎。
  const 旧钉子 = { '1勤奋型': 2191060, '2省钱型': 1593221, '3中间型': 1532768, '4躺平型': 1503382, '5激进型': 1435923, '6逆袭型': 1564594 }
  // ★ §32-U3 改钉（前提修正 · 不是放宽）：原式「v4 === 现行 + 249,000」的前提是"自 v4 起只有 B2 改过数"——
  //   U3 世界层（天气/淡旺季/OTA）真实改变了需求 ⇒ 现行不再等于"B2 后 U3 前"，旧式会年年失真（也会掩盖将来真漂移）。
  //   ⇒ 改钉**两份历史常量之间**的关系（永远为真 · 照样能抓"有人手改历史值"）：
  //       v4（B2 前） === B2后U3前 + 249,000；现行（U3 后）由上面的钉子逐组钉死。
  const B2后U3前 = { '1勤奋型': 1942060, '2省钱型': 1344221, '3中间型': 1283768, '4躺平型': 1254382, '5激进型': 1186923, '6逆袭型': 1315594 }
  const 旧坏 = Object.entries(旧钉子).filter(([n, v]) => B2后U3前[n] + 249000 !== v)
  ok(旧坏.length === 0, '★ 历史常量一致性：v4（B2 前）= B2后U3前 + 249,000（开业费 349,000 − 保证金退还 100,000 · 逐组精确）—— ★ 它守护的是【历史常量没被手改】，不是引擎（引擎由上面的钉子守）',
    旧坏.map(([n, v]) => `${n} B2后U3前 ${B2后U3前[n]} + 249000 = ${B2后U3前[n] + 249000} ≠ 旧钉 ${v}`).join(' | '))
  console.log(`   ★ U3 世界层效应（现行 − B2后U3前 · 六组）：${Object.keys(钉子).map(n => `${n[0]}${钉子[n] - B2后U3前[n]}`).join(' ')}`)
  ok(Object.values(钉子).every(v => v > 0), `钉子自检：六组值均 > 0（防"全 0 也算通过"）· 首组 ${Object.values(钉子)[0]}`)
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
