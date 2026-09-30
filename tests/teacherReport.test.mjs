// §32-U2 · 一键图文经营报告 —— 守门
//
// 判据（单元卡 §4）：报告里**每个数字都能对上权威源**（至少 3 处逐值比对）+ 未开业友好 +
//   结构扫描（报告模型不含自算 —— 不许出现"营收 = Σ…"式的第二本账）
// 运行：node tests/teacherReport.test.mjs   （挂 run-all fast）
import { settle } from '../src/settlement.js'
import { 构建经营报告, 周序列 } from '../src/teacherReport.mjs'
import { totalRevenue, sumNet, sumOpNet, 累计净利率, scoreOf, avgOccupancy, avgGoodRate, totalNegative, netOf, opNetOf, SCORE_WEIGHTS } from '../src/metricDefs.mjs'
import { SCALE } from '../src/stateMigration.mjs'
import { normalizeAttrs } from '../src/attrs.js'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rd = (p) => { try { return readFileSync(path.join(APP, p), 'utf8') } catch (e) { return null } }
const 源 = rd('src/teacherReport.mjs')
const 视图源 = rd('src/TeacherReport.jsx')
const 面板源 = rd('src/TeacherDashboard.jsx')
// 剥注释后的报告模型源码（静态扫描用 —— 注释里的例子不算违规，但注释也帮不了忙）
const 码 = (源 || '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

// ── 造一个真组：真引擎跑 4 周（含开业一次性费用 ⇒ 两个口径必然不同）────────────────
const 品牌 = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const 场 = { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3, city: '成都', district: '春熙路' }
const 决策 = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }
const 造组 = (周数 = 4) => {
  const history = []
  let attrs = { quality: 60, reputation: 70, morale: 65 }, capital = null
  for (let w = 1; w <= 周数; w++) {
    const r = settle({ site: 场, brand: 品牌, decisions: 决策, week: w, attrs: { ...attrs }, prevCapital: capital })
    history.push(r); capital = r.capital; attrs = r.attrsAfter
  }
  return { state: { brand: 品牌, property: { name: '春熙店' }, location: { city: '成都', district: '春熙路' }, bizMode: 'direct', week: 周数, history, attrs, capital, finished: false } }
}
const gs = 造组(4)
const history = gs.state.history
const 报告 = 构建经营报告(gs, { 组名: '第 3 组', 批注: [{ week: 2, note: '定价偏保守', score: 82, updated_at: '2026-09-30T10:00:00Z' }] })

console.log('▶ §32-U2 一键图文经营报告（只读汇总 · 数字对权威源）')

console.log('\n[1] 关键数逐值比对（★ 单元卡要求"至少 3 处"，此处 9 处）')
{
  ok(报告.关键.当前资金 === gs.state.capital, `当前资金 === 存档 capital（${报告.关键.当前资金}）`)
  ok(报告.关键.累计营收 === totalRevenue(history), `累计营收 === metricDefs.totalRevenue（${报告.关键.累计营收}）`)
  ok(报告.关键.累计净利_资金口径 === sumNet(history).value, `累计净利(资金) === sumNet（${报告.关键.累计净利_资金口径}）`)
  ok(报告.关键.累计净利_经营口径 === sumOpNet(history).value, `累计净利(经营) === sumOpNet（${报告.关键.累计净利_经营口径}）`)
  ok(报告.关键.净利率_资金口径 === 累计净利率(history, '资金') && 报告.关键.净利率_经营口径 === 累计净利率(history, '经营'), `两条净利率 === metricDefs.累计净利率（${报告.关键.净利率_资金口径} / ${报告.关键.净利率_经营口径}）`)
  ok(报告.关键.出租率 === avgOccupancy(history) && 报告.关键.好评率 === avgGoodRate(history), `出租率/好评率 === metricDefs.avg*（${报告.关键.出租率}% / ${报告.关键.好评率}%）`)
  ok(报告.关键.差评总数 === totalNegative(history), `差评总数 === metricDefs.totalNegative（${报告.关键.差评总数}）`)
  ok(报告.关键.运营启动资金 === SCALE.IC_NEW, `运营启动资金 === SCALE.IC_NEW（${报告.关键.运营启动资金}）`)
  const at = normalizeAttrs(gs.state.attrs)
  ok(报告.关键.品质 === at.quality && 报告.关键.声誉 === at.reputation && 报告.关键.士气 === at.morale, `品质/声誉/士气 === normalizeAttrs（${报告.关键.品质}/${报告.关键.声誉}/${报告.关键.士气}）`)
  ok(报告.期末评分.分 === scoreOf(history).finalScore && 报告.期末评分.等级 === scoreOf(history).grade, `期末评分 === metricDefs.scoreOf（${报告.期末评分.分} · ${报告.期末评分.等级}）`)
}

console.log('\n[2] 逐周表：逐格 === history[i] 原值（★ 不重算、不失真）')
{
  ok(报告.逐周.length === history.length, `行数 === history 长度（${报告.逐周.length}）`)
  const 逐格 = 报告.逐周.every((r, i) => r.week === history[i].week && r.营收 === history[i].revenue && r.成本 === history[i].totalCost
    && r.净流 === netOf(history[i]) && r.经营净流 === opNetOf(history[i]) && r.出租率 === history[i].occupancy && r.差评数 === history[i].negativeCount)
  ok(逐格, '每格的 周/营收/成本/净流/经营净流/出租率/差评 全部 === history 原值（逐格比对，非抽查）')
  ok(报告.逐周.every((r, i) => r.资金 === history[i].capital), '每格"期末资金" === history[i].capital')
  const 周0 = 报告.逐周[0]
  ok(周0.日快照.length === 7 && 周0.日快照自证.ok && 周0.日快照自证.rows === 7, `第 1 周 7 天快照 + Σ7天 === 周值（走 dailyReport.reconcileWithWeek 单源 · 差异 ${JSON.stringify(周0.日快照自证.diff)}）`)
  ok(周0.日快照[0].天 === 1 && 周0.日快照[6].天 === 7 && 周0.日快照.every(d => Number.isFinite(d.天)), '天序号 1–7 正确（★ dayIndex 藏在 d.dailySnapshot 里 —— 本模块走单源，不自己取嵌套键）')
}

console.log('\n[3] 双口径与极值周（★ 两个口径都必须给 · 名字带口径）')
{
  const w1 = 报告.逐周[0]
  ok(w1.经营净流 !== w1.净流 && w1.经营净流 === opNetOf(history[0]) && w1.净流 === netOf(history[0]), `第 1 周两口径不同（资金 ${w1.净流} vs 经营 ${w1.经营净流} —— 差 = 开业一次性净额）`)
  const 经营值 = 报告.逐周.map(r => r.经营净流), 资金值 = 报告.逐周.map(r => r.净流)
  ok(报告.最好周_经营.经营净流 === Math.max(...经营值) && 报告.最差周_经营.经营净流 === Math.min(...经营值), `最好/最差周（经营口径）= argmax/argmin（${报告.最好周_经营.week} / ${报告.最差周_经营.week}）`)
  ok(报告.最好周_资金.净流 === Math.max(...资金值) && 报告.最差周_资金.净流 === Math.min(...资金值), `最好/最差周（资金口径）= argmax/argmin（${报告.最好周_资金.week} / ${报告.最差周_资金.week}）`)
  ok(报告.最好周_经营.经营净流 >= 报告.最差周_经营.经营净流 && 报告.最好周_资金.净流 >= 报告.最差周_资金.净流, '方向正确：最好 ≥ 最差（两个口径都成立 —— 防止"最好/最差都取 max"这类方向 bug）')
}

console.log('\n[4] 时间线 / 批注 / 序列')
{
  const 事件总数 = history.reduce((s, h) => s + ((h.events && h.events.length) || 0), 0)
  ok(报告.时间线.length === 事件总数, `时间线条数 === Σ history[].events（${报告.时间线.length} vs ${事件总数}）`)
  ok(报告.时间线.every(e => Number.isFinite(e.week)), '每条事件都带周号（可定位到哪一周）')
  ok(报告.批注.length === 1 && 报告.批注[0].note === '定价偏保守' && 报告.批注[0].score === 82, '批注只读透传（原文/评分一致 · 报告不改批注）')
  const s = 周序列(报告)
  ok(s.weeks.length === history.length && s.净流.every((v, i) => v === 报告.逐周[i].净流), '周序列取自报告自身（不第二次读源 · 不会出现两套值）')
}

console.log('\n[5] 未开业 / 脏档：友好提示，不抛错、不 NaN、不编造')
{
  const 空 = 构建经营报告({ state: {} })
  ok(空.未开业 === true && typeof 空.未开业提示 === 'string' && 空.未开业提示.includes('还没有'), `空档 ⇒ 未开业 + 友好提示（不是报错）`)
  ok(空.关键.累计营收 === 0 && 空.关键.当前资金 === null && 空.关键.净利率_经营口径 === null, '空档数字 = 0 / null（不用估算值冒充）')
  const 半档 = 构建经营报告({ state: { history: [{ week: 1, revenue: 100000, occupancy: 60, negativeCount: 2 }] } })
  ok(半档.未开业 === false && 半档.关键.累计营收 === 100000 && 半档.逐周[0].净流 === null && 半档.逐周[0].成本 === null, '旧结构周（无 netProfit/totalCost）⇒ 该格 null 显示"—"，不臆造 0')
  ok(!JSON.stringify(半档).includes('NaN'), '任何脏档都不产生 NaN（JSON 可序列化）')
  ok(构建经营报告(null).未开业 === true, 'gs=null ⇒ 走未开业分支（不抛异常）')
}

console.log('\n[6] 结构扫描：报告模型里【不许有自算】（第二本账防线）')
{
  ok(!/history\s*\.\s*reduce/.test(码), '源码无 history.reduce（聚合必须走 metricDefs 单源）')
  ok(!/(revenue|totalCost|netProfit)\s*[-+*/]/.test(码), '源码无对营收/成本/净利的四则运算（只读取与透传）')
  ok(/from '\.\/metricDefs\.mjs'/.test(源) && /累计净利率/.test(源), '聚合与口径确实来自 metricDefs（不是自己写一份）')
  ok(/SCORE_WEIGHTS/.test(源), '四维权重取自 metricDefs.SCORE_WEIGHTS（不手写 40%/25%… 字符串）')
  // 教师端入口：按钮 + 覆盖层都要在
  ok(/setReportUid\(g\.uid\)/.test(面板源) && /<TeacherReport/.test(面板源), '教师端有「经营报告」按钮且挂了 TeacherReport 覆盖层')
  ok(/e\.stopPropagation\(\);\s*setReportUid/.test(面板源), '按钮 stopPropagation（点报告不会顺带展开/收起卡片）')
  // 打印：必须有 @media print，且工具条在打印时隐藏
  ok(/@media print/.test(视图源) && /tr-noprint/.test(视图源) && /window\.print\(\)/.test(视图源), '视图含 @media print + 工具条打印隐藏 + window.print()')
  ok(/未开业/.test(视图源) && /还没有可报告的经营数据/.test(视图源), '视图对未开业组给友好提示页（非报错/白屏）')
}

console.log('\n[7] 零变化水位线：报告只读 —— 不 import settlement、不写存档')
{
  ok(!/from '\.\/settlement\.js'/.test(源), '报告模型不 import settlement（不可能触发结算/改存档）')
  ok(!/(localStorage|setItem|fetch\(|supabase)\.?/.test(码), '报告模型不碰 localStorage / 网络 / 云端写（纯读）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('RV（可执行 · 已实测）：node tests/_rv-32u2.mjs —— 把报告里的数字改成硬编码错值 ⇒ 本套件必红')
process.exit(fail ? 1 : 0)
