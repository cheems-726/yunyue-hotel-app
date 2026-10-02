// E2 · 自动周报守门（N-2 · fast 套件）
// 运行：node tests/weeklyAuto.test.mjs
//
// ── 本套件治什么 ────────────────────────────────────────────────
//   E2 把「点按钮出周报」改成「7 个游戏日满 ⇒ 自动出周报」。风险点有三个，逐个钉：
//     ① 自动路径与旧手动路径【结果必须一样】（同一状态同决策 ⇒ 逐字节）—— 靠"单一入口"保证，测试来证
//     ② 幂等：同一天/同一周重复触发 ⇒ 结果不变、不重复成报（防"刷新一下多出一周"）
//     ③ 旧档兼容：无 classDay / 无开学日基准 ⇒ 不 NaN、不白屏、按本地日期起算
//   另附：与服务端逐日推进（serverTick）的【同源对拍】—— 同一份输入两端必须同结果（D8）；
//         以及"本周变更记录"的归属日口径（提交日 + 1 = 生效日，T11）
import { readFileSync } from 'node:fs'
import { dayToWeekDay, shouldAutoSettle, autoSettleKey, classDayFromLocal, diffDecisions, changeLogLines, shapeWeeklyReport, revenueSegments, DAYS_PER_WEEK } from '../src/weeklyAuto.mjs'
import { decisions as DEC_ALL } from '../src/decisions.js'
const NAMES = Object.fromEntries(DEC_ALL.map(d => [d.id, d.name]))
import { advanceGroupOneDay, tickKey } from '../src/serverTick.mjs'
import { WEEK_INPUTS_VERSION, settleInputsFrom, weekInputsOf } from '../src/weekInputs.mjs'
import { settle } from '../src/settlement.js'
import { ATTR_INIT } from '../src/attrs.js'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2, district: '锦江区' }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const DEC = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }
const 存档 = { brand: BRAND, location: SITE, history: [], capital: 1490000, attrs: { ...ATTR_INIT }, __groupKey: 'demo|1' }

console.log('▶ E2 · 自动周报守门')

// ── [1] 周↔天口径：唯一来源 + 边界 ─────────────────────────────
console.log('\n[1] 周↔天换算（客户端与服务端同源）')
{
  ok(DAYS_PER_WEEK === 7, '一游戏周 = 7 游戏日')
  const 表 = [[1, 1, 1], [6, 1, 6], [7, 1, 7], [8, 2, 1], [14, 2, 7], [15, 3, 1]]
  const bad = 表.filter(([d, w, i]) => { const r = dayToWeekDay(d); return r.week !== w || r.dayIndex !== i })
  ok(bad.length === 0, `6 个边界（含跨周/跨月边界）全部正确：${表.map(([d]) => d).join('/')}`, JSON.stringify(bad))
  // 与 serverTick 的公开面同源（它是 re-export）—— 防"两端各写一份"
  const st = src('serverTick.mjs')
  ok(/export \{ dayToWeekDay \} from '\.\/weeklyAuto\.mjs'/.test(st),
    'serverTick 的 dayToWeekDay 是 weeklyAuto 的 re-export（不各自实现）')
  ok(!/Math\.ceil\(d \/ DAYS_PER_WEEK\)/.test(st), 'serverTick 里已无第二份周↔天实现')
  // 非法输入不炸
  ok(dayToWeekDay(0).week === 1 && dayToWeekDay(NaN).dayIndex === 1 && dayToWeekDay(-5).week === 1,
    '非法 classDay（0 / NaN / 负数）一律归到第 1 周第 1 天（不 NaN）')
}

// ── [2] 自动 === 手动（逐字节）：单一入口 + 引擎确定性 ──────────
console.log('\n[2] 自动成报 === 手动结算（逐字节）')
{
  const week = 1
  const 输入 = { site: SITE, brand: BRAND, decisions: DEC, week, attrs: { ...ATTR_INIT }, prevCapital: 1490000, prevGoodRate: null }
  const 手动 = settle({ ...输入 })
  const 自动 = settle({ ...输入 })            // 自动路径调用的就是同一个 settle（App 里两条入口合并为一个 doSettle）
  ok(JSON.stringify(手动) === JSON.stringify(自动), `同一状态同决策 ⇒ 引擎输出逐字节相同（week ${week}）`)
  // 自动周报只是"整形"，不改数值：shapeWeeklyReport 后除新增字段外必须逐字节等于引擎输出
  const 整形 = shapeWeeklyReport(手动, { week, changes: [{ key: 'pricing', label: '动态调价', from: 'A', to: 'B', 提交日: 4, 生效日: 5 }] })
  const 数值键 = Object.keys(手动)
  const 差异 = 数值键.filter(k => JSON.stringify(整形[k]) !== JSON.stringify(手动[k]))
  ok(差异.length === 0, `整形不碰任何引擎字段（差异 ${差异.length}）`, 差异.join(','))
  ok(整形.__auto === true && Array.isArray(整形.changeLogLines) && 整形.changeLogLines.length === 1,
    '整形只追加审计标记 __auto 与变更记录（不重算数值）')
  // App 侧结构断言：自动触发调用的是【同一个 doSettle】（不存在第二条结算实现）
  const app = src('App.jsx')
  ok(/doSettle\(\{ auto: true, key: autoInfo\.key \}\)/.test(app), '自动触发调用 doSettle({auto:true})（同一函数）')
  ok((app.match(/function doSettle\(/g) || []).length === 1, 'App 里只有一个 doSettle 定义（无第二套结算路径）')
}

// ── [3] 与服务端逐日推进【同源对拍】（D8）────────────────────────
console.log('\n[3] 跨端同源：服务端 advanceGroupOneDay === 客户端同输入')
{
  const r = advanceGroupOneDay(存档, 7, { decisions: DEC })     // classDay 7 ⇒ 第 1 周满
  const 服务端周报 = r.save.history[0]
  const 客户端周报 = settle({ site: 存档.location, brand: 存档.brand, decisions: DEC, week: 1, attrs: 存档.attrs, prevCapital: 存档.capital, prevGoodRate: null, bizMode: 'direct' })
  const 比 = ['revenue', 'totalCost', 'profit', 'gop', 'netProfit', 'occupancy', 'finalGoodRate', 'capital', 'deptCost', 'rentCost']
  const 不等 = 比.filter(k => 服务端周报[k] !== 客户端周报[k])
  ok(不等.length === 0, `10 个关键字段逐项相等（不同 ${不等.length}）`, 不等.map(k => `${k}:${服务端周报[k]}≠${客户端周报[k]}`).join(' '))
  // ★ §16.2-B7（2026-09-28）：原来这条只是【记账】——"客户端独有入参确实会改变结果 ⇒ 服务端补算复现不了"。
  //   现在改为【真做】的断言：把周内输入随存档带上 ⇒ 服务端补算与在线结算【逐字节一致】。
  const 输入 = { pendingNegatives: 2, resolvedCount: 1, liveNegCount: 1, livePosCount: 2, crisisResponse: '逐条真诚回复' }
  const 在线 = settle({ site: 存档.location, brand: 存档.brand, decisions: DEC, week: 1, attrs: 存档.attrs, prevCapital: 存档.capital, prevGoodRate: null, bizMode: 'direct', ...输入 })
  const 带输入的存档 = { ...存档, weekInputs: { 版本: WEEK_INPUTS_VERSION, week: 1, ...输入 } }
  const 补算 = advanceGroupOneDay(带输入的存档, 7, { decisions: DEC })
  ok(补算.inputsSource === 'save', `服务端确认采用了存档里的周内输入（inputsSource=${补算.inputsSource}）`)
  ok(JSON.stringify(补算.save.history[0]) === JSON.stringify(在线),
    '★ B7：含实时评价/欠账/整改/危机的周，服务端【补算 === 在线】逐字节一致')
  // 反向验证靶子：不带 weekInputs（旧档形态）⇒ 必然不同 ⇒ 证明上面的一致不是"两边都忽略输入"
  const 旧档 = advanceGroupOneDay(存档, 7, { decisions: DEC })
  ok(JSON.stringify(旧档.save.history[0]) !== JSON.stringify(在线),
    '反证：存档不带周内输入 ⇒ 补算 ≠ 在线（说明该断言确实在判东西，不是恒真）')
  // ★★ §33-V4-B7（2026-10-01）：含【危机期 + R6 延迟后果 + 职务加成权重 + 注入事件/应对】的周 —— 全通道逐字节
  //   修前实测差异（本断言的由来）：serverTick 曾丢 hotState/penaltyState/resolvedWeight 三入参 ⇒
  //   危机周的 occupancy 37 vs 51、E8 应对周的罚款 800 vs 5000（同组同决策不同钱 = 公平红线破）。
  //   修法：serverTick 从【存档已有字段】读（hotReviewCrisis / pendingPenalty）+ weekInputs 单源（resolvedWeight）
  //   ⇒ 不新增随机、不新增状态；旧档无这些字段 ⇒ null ⇒ 与改前一致（水位线）。
  {
    const { 构建注入事件 } = await import('../src/teacherEvents.mjs')
    const hotState = { source: '负面舆情', startWeek: 1, weeks: 2, override: null }
    const penaltyState = { 项: [{ 来源: 'quality-check', 文案: '延迟代价' }], startWeek: 1 }
    const 注入 = [构建注入事件({ 事件id: 'E8', 周: 1, injectedBy: 'T001' })]
    const 全输入 = { pendingNegatives: 1, resolvedCount: 2, resolvedWeight: 2.6, liveNegCount: 1, livePosCount: 2, crisisResponse: '逐条真诚回复', 注入应对: { E8: '立即整改' } }
    const 在线全 = settle({ site: 存档.location, brand: 存档.brand, decisions: DEC, week: 1, attrs: 存档.attrs, prevCapital: 存档.capital, prevGoodRate: null, bizMode: 'direct', ...全输入, hotState, penaltyState, injectedEvents: 注入, eventResponses: { E8: '立即整改' } })
    const 带全的存档 = { ...存档, weekInputs: { 版本: WEEK_INPUTS_VERSION, week: 1, ...全输入 }, hotReviewCrisis: hotState, pendingPenalty: penaltyState }
    const 补算全 = advanceGroupOneDay(带全的存档, 7, { decisions: DEC, injectedEvents: 注入 })
    ok(JSON.stringify(补算全.save.history[0]) === JSON.stringify(在线全),
      '★★ B7 全通道：含危机期/R6延迟/职务权重/注入事件+应对的周，【补算 === 在线】逐字节一致',
      `差异键：${Object.keys(在线全).filter(k => JSON.stringify(在线全[k]) !== JSON.stringify(补算全.save.history[0][k])).slice(0, 6).join(',')}`)
    // 反证（防"修好又丢"）：把存档的 hotReviewCrisis 删掉 ⇒ 危机惩罚消失 ⇒ 与在线必然不等
    const 无危机存档 = { ...带全的存档 }
    delete 无危机存档.hotReviewCrisis
    const 补算无危机 = advanceGroupOneDay(无危机存档, 7, { decisions: DEC, injectedEvents: 注入 })
    ok(JSON.stringify(补算无危机.save.history[0]) !== JSON.stringify(在线全),
      '反证：存档丢 hotReviewCrisis ⇒ 补算 ≠ 在线（危机通道真的在判，不是恒真）')
    // ★★ §33-V3（AI 领班二期）：授权领班 + 离线补算 === 一直在线（逐字节）
    //   · 客户端在线：领班代管在 App.doSettle 结算前并入（领班代管 同构函数）
    //   · 服务端补算：serverTick 用【同一个函数】+ opts.supervisorAuth（Edge 传 class_state）+ 存档学生覆盖
    //   · 判据：授权 overbook+energy、学生 energy=26（触发 R6）、上周超售赔偿 8 次（触发 R3）
    //     ⇒ 补算结果与在线【逐字节】相同（B7 教训：动 settle 入参必须同步 serverTick —— 这里钉死）
    {
      const { 领班代管 } = await import('../src/aiSupervisor.mjs')
      // ★ 场景（V3 · 首版场景失效教训）：学生本周【没做 overbook/energy】（键缺失 ⇒ 沿用上周）⇒ R3/R6 都该代管。
      //   首版把 energy:26 写进学生决策 ⇒ 学生优先剔了 R6 ⇒ 代管空 ⇒ "摘 serverTick 也绿" = 场景失效（假绿场景）。
      const 学生决策 = { ...DEC }   // 无 overbook/energy 键（沿用上周）
      const 全班默认 = { overbook: { ok: true }, energy: { ok: true } }
      // 上周：学生超售开满（overbook=8 · 温度 26）⇒ 结算产生赔偿与极端温度 ⇒ 本周领班代管回归
      const 上周学生 = { ...DEC, overbook: 8, energy: 26 }
      // ★ 上周结果要进存档 history（serverTick 从 history 末位取领班快照 —— 与真实存档同构）
      const 上周结算 = settle({ site: 存档.location, brand: 存档.brand, decisions: 上周学生, week: 1, attrs: { ...ATTR_INIT }, prevCapital: 1490000, prevGoodRate: null, bizMode: 'direct' })
      const 带领班的存档 = { ...存档, doneDecisions: 学生决策, supervisorAuthStudent: null, history: [上周结算], capital: 上周结算.capital, attrs: 上周结算.attrsAfter }
      const 在线r = settle({ site: 存档.location, brand: 存档.brand, decisions: { ...代管决策并(上周结算, 学生决策, 全班默认, null) }, week: 2, attrs: 上周结算.attrsAfter, prevCapital: 上周结算.capital, prevGoodRate: 上周结算.finalGoodRate, bizMode: 'direct' })
      const 补算r = advanceGroupOneDay(带领班的存档, 14, { decisions: 学生决策, supervisorAuth: 全班默认 })
      const 补算周报 = 补算r.save.history.find(h => Number(h.week) === 2) || 补算r.save.history[补算r.save.history.length - 1]
      ok(JSON.stringify(补算周报) === JSON.stringify(在线r),
        '★★ V3 全通道：授权领班（R3+R6）+ 离线补算 === 一直在线【逐字节】',
        `差异键：${Object.keys(在线r).filter(k => JSON.stringify(在线r[k]) !== JSON.stringify(补算周报[k])).slice(0, 6).join(',')}`)
      // 反证：摘掉 serverTick 的领班入参（不传 supervisorAuth）⇒ 补算退回无代管 ⇒ 与在线不等
      const 补算无领班 = advanceGroupOneDay(带领班的存档, 7, { decisions: 学生决策 })
      ok(JSON.stringify(补算无领班.save.history[0]) !== JSON.stringify(在线r),
        '反证：补算不带 supervisorAuth ⇒ 无代管 ⇒ ≠ 在线（领班通道真的在判）')
      // 学生优先（局部函数与 aiSupervisor 同式）：
      function 代管决策并(上周, 学生决策, 全班默认, 学生覆盖) {
        const { 代管决策 } = 领班代管({ 上周, 学生决策, 全班默认, 学生覆盖 })
        return { ...代管决策, ...学生决策 }   // ★ 学生已有键不覆盖（Object.assign 语义）
      }
    }
  }
  // ★ 公平性红线（D2）的机器化：实时评价数是【在线时长相关】的输入，
  //   它只决定"哪些卡已在实时里出过"，**不许改变任何业务数字**（实证：只有卡片数变）
  const 业务字段 = ['revenue', 'totalCost', 'profit', 'netProfit', 'gop', 'capital', 'occupancy', 'finalGoodRate', 'negativeCount', 'reviewCount', 'deptCost', 'rentCost']
  const 无实时 = settle({ site: 存档.location, brand: 存档.brand, decisions: DEC, week: 1, attrs: 存档.attrs, prevCapital: 存档.capital, prevGoodRate: null, bizMode: 'direct' })
  const 有实时 = settle({ site: 存档.location, brand: 存档.brand, decisions: DEC, week: 1, attrs: 存档.attrs, prevCapital: 存档.capital, prevGoodRate: null, bizMode: 'direct', liveNegCount: 3, livePosCount: 5 })
  const 被改动 = 业务字段.filter(k => JSON.stringify(无实时[k]) !== JSON.stringify(有实时[k]))
  ok(被改动.length === 0, `★ 公平性：实时评价数（在线时长相关）【不改变任何业务数字】（${业务字段.length} 项全同）`, 被改动.join(','))
  ok(无实时.generatedReviews.length !== 有实时.generatedReviews.length,
    '但它确实减少"结算再出一次"的卡片数（实时已出过的不重复出）⇒ 两件事都要成立')
}

// ── [3b] §16.2-B7：周内输入的【派生规则】本身（从 App.jsx 迁出，口径必须逐字保持不变）──
console.log('\n[3b] §16.2-B7 周内输入派生（单源 src/weekInputs.mjs）')
{
  const 流水 = [
    { id: '1', status: 'pending' },                       // 演示初值（数字 id）——【不算】欠账
    { id: 'w1-n0', status: 'pending' },                   // 结算卡 ⇒ 欠账
    { id: 'w1-n1', status: 'ignored' },                   // 结算卡 ignored ⇒ 也算欠账
    { id: 'w1-n2', status: 'resolved' },                  // 结算卡已整改 ⇒ 算 resolved
    { id: 'w2-n0', status: 'pending' },                   // 往周结算卡 ⇒ 跨周累计
    { id: 'live-a', live: true, liveWeek: 2, stars: 2 },  // 本周实时差评
    { id: 'live-b', live: true, liveWeek: 2, stars: 5 },  // 本周实时好评
    { id: 'live-c', live: true, liveWeek: 1, stars: 1 },  // 往周实时 —— 不该混进本周
  ]
  const r = settleInputsFrom({ reviews: 流水, week: 2, crisis: { week: 1, choice: '不理会' } })
  ok(r.pendingNegatives === 3, `欠账 = 结算卡 pending/ignored（跨周累计）= 3（实测 ${r.pendingNegatives}）`)
  ok(r.resolvedCount === 1, `已整改 = 结算卡 resolved = 1（实测 ${r.resolvedCount}）`)
  ok(r.liveNegCount === 1 && r.livePosCount === 1, `本周实时：差评 1 / 好评 1（往周实时不混入）`)
  ok(r.crisisResponse === '不理会', '危机选择生效（crisis.week === week-1）')
  ok(settleInputsFrom({ reviews: 流水, week: 3, crisis: { week: 1, choice: '不理会' } }).crisisResponse === null,
    '隔了两周的危机选择【不生效】（只在 week-1 用一次）')
  // weekInputsOf：周号/版本对不上 ⇒ 一律视为"没有"（不敢拿来用），而不是拿错周的数据硬套
  const 存档 = { weekInputs: { 版本: WEEK_INPUTS_VERSION, week: 2, pendingNegatives: 5, resolvedCount: 0, liveNegCount: 0, livePosCount: 0, crisisResponse: null } }
  ok(weekInputsOf(存档, 2)?.pendingNegatives === 5, 'weekInputsOf：周号相符 ⇒ 采用')
  ok(weekInputsOf(存档, 3) === null, 'weekInputsOf：周号不符 ⇒ null（不拿别周的输入硬套）')
  ok(weekInputsOf({ weekInputs: { ...存档.weekInputs, 版本: 99 } }, 2) === null, 'weekInputsOf：版本不符 ⇒ null（口径变了不敢用旧派生）')
  ok(weekInputsOf({}, 2) === null, 'weekInputsOf：旧档没有该字段 ⇒ null（服务端走空输入兜底）')
  // 空输入必须全 0：服务端兜底口径 = "什么都没发生"，不能凭空造欠账
  const 空 = settleInputsFrom({ reviews: [], week: 5 })
  ok(空.pendingNegatives === 0 && 空.resolvedCount === 0 && 空.liveNegCount === 0 && 空.livePosCount === 0 && 空.crisisResponse === null,
    '空输入：全 0 / 无危机（服务端兜底口径）')
}

// ── [4] 幂等：同一天/同一周不重复成报 ───────────────────────────
console.log('\n[4] 幂等（重复触发结果相同、不重复成报）')
{
  const a = advanceGroupOneDay(存档, 7, { decisions: DEC })
  const b = advanceGroupOneDay(a.save, 7, { decisions: DEC })      // 同一 classDay 再触发
  ok(b.advanced === false, '第二次触发 advanced=false（幂等命中，不重复结算）')
  ok(JSON.stringify(a.save.history) === JSON.stringify(b.save.history), '第二次不往 history 里追加（结果逐字节相同）')
  // ★ 实测口径（原预期写错，已按实现更正）：服务端在【进入某一周的那一天】就结算该周（第 8 天 ⇒ 结算第 2 周），
  //   而不是等该周第 7 天。数值上同周同决策 ⇒ 同结果；但**周中改的决策它看不到** ⇒ 与 E3「次日生效」冲突。
  //   ⇒ 记为发现（见报告"诚实记录"）：服务端结算时点应由"周首"改为"周末"（属 E3/E4 范围，本项不动结算公式）
  const c = advanceGroupOneDay(a.save, 8, { decisions: DEC })
  ok(c.advanced === true && c.week === 2 && c.dayIndex === 1,
    `进入第 2 周即结算第 2 周（advanced=${c.advanced} · week=${c.week} · day=${c.dayIndex}）—— ★ 该时点问题已记账给 E3/E4`)

  const e = advanceGroupOneDay(a.save, 7, { decisions: DEC })
  ok(e.advanced === false && e.week === 1, '同一周同一天重复触发 ⇒ 不结算（幂等）')
  ok(tickKey(7, 'demo|1') === 'd7|demo|1', 'tickKey 形状稳定（classDay + groupKey）')

  // shouldAutoSettle 的幂等：已有周报 / 已记过键 ⇒ 都不触发
  const 已有 = shouldAutoSettle({ ...存档, history: [a.save.history[0]] }, 7)
  ok(已有.due === false && /已在存档/.test(已有.reason), `有周报 ⇒ 不触发（${已有.reason}）`)
  const 键命中 = shouldAutoSettle({ ...存档, __autoSettled: [autoSettleKey(7, 'demo|1')] }, 7)
  ok(键命中.due === false && /幂等键/.test(键命中.reason), `幂等键命中 ⇒ 不触发（${键命中.reason}）`)
  const 期中 = shouldAutoSettle(存档, 4)
  ok(期中.due === false && 期中.dayIndex === 4, '第 4 天 ⇒ 不触发（要到第 7 天才成报）')
  const 该报 = shouldAutoSettle(存档, 7)
  ok(该报.due === true && 该报.key === autoSettleKey(7, 'demo|1'), '第 7 天 + 无周报 ⇒ 触发（due=true）')
}

// ── [5] 旧档兼容：无 classDay / 无开学日基准 ─────────────────────
console.log('\n[5] 旧档兼容（不 NaN、不白屏、按本地日期起算）')
{
  ok(classDayFromLocal(undefined, 123) === 1 && classDayFromLocal(100, NaN) === 1 && classDayFromLocal(null, null) === 1,
    '缺参数 ⇒ classDay = 1（不 NaN）')
  ok(classDayFromLocal(100, 106) === 7 && classDayFromLocal(100, 99) === 1, '正常换算 7 天；早于开学日 ⇒ 归 1（不倒挂）')
  const 旧档 = { brand: BRAND, history: [{ week: 1 }, { week: 2 }, { week: 3 }] }   // 无 classDay、无 openDayNo
  const 推 = classDayFromLocal(undefined, 200)     // App 里：旧档用 today-(history*7) 反推首个基准
  ok(推 === 1, '旧档反推基准后不炸')
  const d = shouldAutoSettle(旧档, classDayFromLocal(200 - 3 * 7, 200))   // = classDay 22
  ok(typeof d.due === 'boolean' && typeof d.reason === 'string', `旧档也能给出判定（due=${d.due} · ${d.reason}）`)
  const 空档 = shouldAutoSettle(null, null)
  ok(空档.due === false && 空档.dayIndex === 1 && typeof 空档.reason === 'string',
    `null 存档 / null classDay ⇒ 归第 1 周第 1 天且不触发（dayIndex=${空档.dayIndex} · ${空档.reason}）`)
  const 未开业 = shouldAutoSettle({ history: [] }, 7)
  ok(未开业.due === false && /筹建期/.test(未开业.reason), '未开业（无品牌）⇒ 不触发（筹建期没有周报）')
}

// ── [6] 本周变更记录（第几天改了什么 + 次日生效）─────────────────
console.log('\n[6] 「本周变更记录」与归属日口径（T11：次日生效）')
{
  const 前 = { pricing: '不跟降', shifts: '满编保服务' }
  const 后 = { pricing: '降价 20% 抢客', shifts: '满编保服务', energy: 25 }
  const rows = diffDecisions(前, 后, { day: 4 })
  ok(rows.length === 1, `只记【改动】（首次填写的 energy 不算改）：${rows.map(r => r.label).join(',')}`)
  ok(rows[0].key === 'pricing' && rows[0].from === '不跟降' && rows[0].to === '降价 20% 抢客',
    '改动内容齐全（原值 → 新值）')
  ok(rows[0].提交日 === 4 && rows[0].生效日 === 5, '归属日：第 4 天提交 ⇒ 第 5 天生效（T11 次日生效）')
  const lines = changeLogLines(rows)
  ok(lines.length === 1 && /第 4 天提交/.test(lines[0]) && /第 5 天生效/.test(lines[0]) && /动态调价/.test(lines[0]),
    `周报文案含"第 4 天提交 · 第 5 天生效"：${lines[0]}`)
  // 空集不炸 + 未登记决策回退 id
  ok(changeLogLines(diffDecisions({}, {}, {})).length === 0, '无改动 ⇒ 空记录（周报不显示该卡）')
  const 未登记 = diffDecisions({ xyz: 1 }, { xyz: 2 }, { day: 2 })
  ok(未登记[0].label === 'xyz', '未登记的决策 id 回退为 id 本身（不显示 undefined）')
}

// ── [7] 触发开关可关（反向验证的靶子）──────────────────────────
console.log('\n[7] 反向验证靶子：把触发关掉 ⇒ 必须不触发')
{
  const 开 = shouldAutoSettle(存档, 7)
  const 关 = shouldAutoSettle(存档, 7, { enabled: false })
  ok(开.due === true && 关.due === false,
    `同一输入：默认 due=true，开关关掉 due=false（${关.reason}）⇒ 报告里的"改成不触发 ⇒ 必红"由此可复现`)
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
// ── [8] D52-a：分段收入（显示级 · 必标"估算" · 引擎周值零变化）──────
console.log('\n[8] 分段收入（D52-a：显示级 + 显式"估算"）')
{
  const r = settle({ site: SITE, brand: BRAND, decisions: DEC, week: 1, attrs: { ...ATTR_INIT }, prevCapital: 1490000 })
  const 调价 = [{ key: 'pricing', label: NAMES.pricing, from: '不跟降', to: '降价 20% 抢客', 提交日: 3, 生效日: 4 }]
  const seg = revenueSegments(r, 调价, null)
  ok(seg !== null, '有调价记录 ⇒ 产出分段')
  ok(seg.估算 === true, '分段【必须】带 估算:true（D52-a 硬要求：不标 = 让学生误当精算）')
  ok(/估算/.test(seg.标题) && /估算/.test(seg.说明), '标题与说明都含"估算"字样')
  ok(seg.rows.length === 2 && seg.rows[0].天数 + seg.rows[1].天数 === 7, `两段天数合计 7（${seg.rows[0].天数}+${seg.rows[1].天数}）`)
  ok(seg.rows[0].金额估算 + seg.rows[1].金额估算 === r.revenue,
    `分段合计 === 引擎整周实收（${seg.rows[0].金额估算}+${seg.rows[1].金额估算} = ${r.revenue}）—— 只重排、不改总数`)
  const 快照 = JSON.stringify(r)
  revenueSegments(r, 调价, null)
  ok(JSON.stringify(r) === 快照, '纯函数：调用前后引擎输出逐字节不变（不回写）')
  ok(revenueSegments(r, [{ key: 'pricing', 生效日: 1 }], null) !== null, '生效日=1（整周新价）⇒ 分段不炸（前段 0 天）')
  ok(revenueSegments(r, [{ key: 'shifts', label: '排班', 提交日: 2, 生效日: 3 }], null) === null, '非调价改动 ⇒ 无分段卡（只对 pricing）')
  ok(revenueSegments(r, [], null) === null && revenueSegments(null, 调价, null) === null, '无变更 / 空引擎输出 ⇒ null（周报不显示该卡）')
  const wr = src('WeeklyReport.jsx')
  ok(/估算/.test(wr) && /revenueSegments/.test(wr) && /引擎实收为准/.test(wr), 'WeeklyReport 渲染分段卡且带"引擎实收为准"警示')
}

// ── [9] D52-b：服务端结算时点（保持现状 + 观察项已写）──────────────
console.log('\n[9] 服务端结算时点（D52-b：保持现状）')
{
  const 底 = { brand: BRAND, location: SITE, history: [], capital: 1490000, attrs: { ...ATTR_INIT }, __groupKey: 'timing|1' }
  const r8 = advanceGroupOneDay(底, 8, { decisions: DEC })
  ok(r8.advanced === true && r8.week === 2, '现状（保持）：classDay 8 ⇒ 结算第 2 周（周首结算 · 已在队列留观察项）')
  const r9 = advanceGroupOneDay(r8.save, 9, { decisions: DEC })
  ok(r9.advanced === false && r9.week === 2, 'classDay 9（同周第 2 天）⇒ 不重复结算（幂等）')
  const 队列 = src('../../4-审计与报告/待决策队列.md')
  ok(/周中改动|结算时点|周首/.test(队列), '待决策队列已留「服务端结算时点」观察项（D52-b）')
}

console.log('验收口径：自动/手动不同一入口、幂等失效、旧档炸、归属日不是"次日" —— 任一即红')
process.exit(fail ? 1 : 0)
