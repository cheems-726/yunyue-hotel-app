// W2-3 · W10 正名：GOP / 净利润 —— 口径、单源、三处界面显示
// 运行：node tests/metrics-w2-3.test.mjs   （挂 run-all 门禁）
//
// 分四层断言（★ 反向可验证：删掉任一处界面显示 ⇒ 本套件报红）：
//   ① 引擎层：净利润恒等式 / GOP 不含租金 / netProfit === profit（正名不改数值语义）
//   ② 单源层：metricDefs 的定义文本与累加语义（缺字段的周【不按 0 计入】；旧档回退读 profit）
//   ③ 界面层：三处界面真的显示两个指标，且标签/定义来自同一处（静态扫源码，先剥注释）
//   ④ 评分基准：40% 维度 = 净利润，且分段阈值与 W2-2 落值一致（数值零变化）
import { readFileSync } from 'node:fs'
import {
  GOP_LABEL, GOP_SHORT, GOP_DEF, NET_LABEL, NET_DEF,
  gopOf, netOf, sumGop, sumNet, pct, wan2, yuanFmt,
} from '../src/metricDefs.mjs'
import { runSeason6 } from './_season6.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
const readSrc = (f) => strip(readFileSync(new URL('../src/' + f, import.meta.url), 'utf8'))

console.log('▶ W2-3 · GOP / 净利润 口径与界面显示')

// ── ① 引擎层 ──────────────────────────────────────────────────────────
console.log('\n[1] 引擎层：恒等式（六组 × 12 周 = 72 周）')
{
  const { perGroup } = runSeason6()
  let idBad = [], rateBad = [], sepBad = [], proNameBad = [], basisBad = []
  for (const g of perGroup) {
    for (const r of g.weeksList) {
      const expectNet = r.gop - r.rentCost - (r.overbookCompensation || 0) - (r.renovationCost || 0) - (r.eventFine || 0)
      if (r.netProfit !== expectNet) idBad.push(`${g.name} w${r.week}`)
      if (Math.abs(r.gopRate - (r.revenue > 0 ? r.gop / r.revenue : 0)) > 1e-12) rateBad.push(`${g.name} w${r.week}`)
      if (Math.abs(r.netProfitRate - (r.revenue > 0 ? r.netProfit / r.revenue : 0)) > 1e-12) rateBad.push(`${g.name} w${r.week} net`)
      // 两个指标必须真的分开：GOP 不含租金 ⇒ 租金 > 0 时 GOP > 净利润
      if (!(r.gop > r.netProfit)) sepBad.push(`${g.name} w${r.week} gop=${r.gop} net=${r.netProfit}`)
    }
    // ★ 正名不改数值语义：净利润 === 既有 profit（★ 这条是"零变化"的根）
    if (g.weeksList.some(r => r.netProfit !== r.profit)) proNameBad.push(g.name)
    // ★ 评分基准零变化：ΣnetProfit === Σprofit（逐组）
    const sn = g.weeksList.reduce((a, r) => a + r.netProfit, 0)
    const sp = g.weeksList.reduce((a, r) => a + r.profit, 0)
    if (sn !== sp || sn !== g.profit) basisBad.push(`${g.name} Σnet=${sn} Σprofit=${sp} acc=${g.profit}`)
  }
  ok(idBad.length === 0, `净利润恒等式 72/72 成立（净利润 = GOP − 租金 − 超售 − 改造 − 罚款）`, idBad.slice(0, 3).join(', '))
  ok(rateBad.length === 0, 'netProfitRate === netProfit/revenue，且 gopRate === gop/revenue（72/72）', rateBad.slice(0, 3).join(', '))
  ok(sepBad.length === 0, '两指标确实分开：租金 > 0 ⇒ GOP > 净利润（72/72）', sepBad.slice(0, 3).join(', '))
  ok(proNameBad.length === 0, '★ netProfit === profit（正名不改数值语义，6/6 组 72/72 周）', proNameBad.join(', '))
  ok(basisBad.length === 0, '★ 评分基准零变化：Σ净利润 === Σ利润（逐组）', basisBad.join(', '))
}

// ── ② 单源层（metricDefs）────────────────────────────────────────────
console.log('\n[2] 单源层：定义文本 + 累加语义')
{
  ok(GOP_DEF.includes('不含租金') && GOP_DEF.includes('营收'), 'GOP 定义写明"不含租金/加盟费/利息"与构成', GOP_DEF)
  ok(NET_DEF.includes('租金') && NET_DEF.includes('评分基准'), '净利润定义写明构成 + "评分基准"', NET_DEF)
  ok(NET_LABEL.includes('利润') && GOP_SHORT === 'GOP', '标签：净利润含"利润"二字（兼容门禁既有文案解析）/ GOP 短式为 GOP')

  // 缺 gop 的旧档周：不计入累加、complete=false（★ 不许按 0 计入 —— 那会把总额静默低估）
  const mixed = [{ gop: 100, netProfit: 60, profit: 60 }, { netProfit: 40, profit: 40 }]
  const sg = sumGop(mixed)
  ok(sg.value === 100 && sg.weeks === 1 && sg.total === 2 && sg.complete === false,
    '旧档周（无 gop）不计入累加且覆盖度如实回报', JSON.stringify(sg))
  // 旧档周无 netProfit → 回退读 profit（引擎恒等式保证同值，不算编造）
  const sn = sumNet(mixed)
  ok(sn.value === 100 && sn.complete === true, '旧档无 netProfit 时回退读 profit（累加完整）', JSON.stringify(sn))
  // 脏数据：profit 非有限 → 跳过（对比旧写法 s + undefined ⇒ NaN）
  const dirty = [{ profit: 10, netProfit: 10 }, { profit: undefined }, {}]
  const sd = sumNet(dirty)
  ok(sd.value === 10 && Number.isFinite(sd.value) && sd.complete === false, '脏历史不产生 NaN（跳过缺字段周并回报覆盖度）', JSON.stringify(sd))
  ok(sumNet([]).complete === false && sumGop(null).value === 0, '空历史/非数组入参：零值且 complete=false（不抛异常）')
  ok(gopOf({ gop: NaN }) === null && netOf({ profit: Infinity }) === null, 'NaN/Infinity 视同缺字段（!= null 拦不住 NaN 的教训）')
  ok(pct(0.5123) === '51.2%' && wan2(123456) === '12.35万' && yuanFmt(-5000) === '-5,000 元', '格式化函数：pct / wan2 / yuanFmt')

  // 六组赛季口径（W2-4 引用同一份场景 ⇒ 这里钉"单源没被改岔"）。
  // ★ 期望值【从源头推导】，不贴死数字（口径改动时无需重挂）：目标带 + 恒等式。
  const { weighted: w } = runSeason6()
  const 渠道率 = 1 - w.deptRate - w.gopRate
  ok(w.deptRate >= 0.42 && w.deptRate <= 0.48,
    `六组赛季部门成本率落 W14 目标带 42–48%（实测 ${(w.deptRate * 100).toFixed(2)}%）`, String(w.deptRate))
  ok(Math.abs(w.gopRate - (1 - w.deptRate - 渠道率)) < 1e-12 && Math.abs(w.netRate - w.profit / w.rev) < 1e-12,
    `GOP/净利润与营收比恒等（GOP ${(w.gopRate * 100).toFixed(1)}% = 1 − 部门成本 ${(w.deptRate * 100).toFixed(1)}% − 渠道营销 ${(渠道率 * 100).toFixed(1)}%）`,
    `${w.gopRate} ${w.deptRate} ${渠道率}`)
}

// ── ③ 界面层（静态：剥注释后扫源码）──────────────────────────────────
console.log('\n[3] 界面层：三处界面显示两个指标（静态断言）')
{
  const wr = readSrc('WeeklyReport.jsx')
  ok(/from '\.\/metricDefs\.mjs'/.test(wr), '周报：从 metricDefs.mjs 取标签/定义（单源）')
  ok(/\{NET_LABEL\}/.test(wr) && /result\.netProfit/.test(wr), '周报：核心指标显示净利润（result.netProfit）')
  ok(/const netP = Number\.isFinite\(result\.netProfit\)/.test(wr) && /CountNum n=\{netP\}/.test(wr),
    '周报：净利润牌位的【值】也读权威字段（netProfit；旧档回退 profit）—— 名与实同源')
  ok(/\{GOP_LABEL\}/.test(wr) && /result\.gop\b/.test(wr) && /pct\(result\.gopRate\)/.test(wr), '周报：经营明细显示 GOP 绝对值 + GOP 率')
  ok(/title=\{NET_DEF\}/.test(wr) && /title=\{GOP_DEF\}/.test(wr), '周报：两个指标都带口径定义（hover 可见）')
  // 门禁兼容（verify-capital 用 /利润[^\d-]*(-?[\d,]+)\s*元/ 解析周报）：净利润 tile 仍在【核心指标】块内、且在经营明细之前
  const iCore = wr.indexOf('本周经营数据'), iTile = wr.indexOf('{NET_LABEL}'), iDetail = wr.indexOf('经营明细')
  ok(iCore >= 0 && iTile > iCore && iTile < iDetail, '周报：净利润牌位仍在【核心指标】块内、先于经营明细（既有解析不破）')

  const fr = readSrc('FinalResult.jsx')
  ok(/from '\.\/metricDefs\.mjs'/.test(fr), '期末：从 metricDefs.mjs 取标签/定义（单源）')
  ok(/累计净利润/.test(fr) && /\{NET_LABEL\}/.test(fr), '期末：累计净利润（正名后）')
  ok(/sumGop\(history\)/.test(fr) && /\{GOP_LABEL\}/.test(fr), '期末：累计 GOP 与净利润分列（sumGop + GOP_LABEL）')
  ok(/gopTotal\.complete/.test(fr), '期末：旧档 GOP 不完整时写明覆盖度（不编造、不按 0 补）')

  const td = readSrc('TeacherDashboard.jsx')
  ok(/from '\.\/metricDefs\.mjs'/.test(td), '教师端：从 metricDefs.mjs 取标签/定义（单源）')
  ok(/\{NET_LABEL\}/.test(td) && /\{GOP_SHORT\}/.test(td), '教师端：组卡分列显示 净利润 / GOP')
  ok(/sumNet\(history\)/.test(td) && /sumGop\(history\)/.test(td), '教师端：组汇总走同一单源累加（与学生端同口径）')
  ok(/netOf\(h\)/.test(td) && /Number\.isFinite\(h\.gop\)/.test(td), '教师端：周明细读净利润权威字段 + GOP 缺字段时不显示')
  ok(!/\{GOP_SHORT\}\(万\)/.test(td), '教师端：CSV 表头是字面量列名（不把 JSX 常量插值进 CSV 表头）')
  ok(/净利润\(万\),GOP\(万\)/.test(td) && /净利润\(元\),GOP\(元\)/.test(td), '教师端：导出 CSV 两个表头都加了 GOP 列')
}

// ── ④ 评分基准 = 净利润（且分段未改）────────────────────────────────
console.log('\n[4] 评分基准：净利润（W2-2 分段不动）')
{
  const SEG = /totalProfit >= 150000 \? 100 : totalProfit >= 90000 \? 85 : totalProfit >= 30000 \? 70 : totalProfit >= 0 \? 55 : 40/
  const fr = readSrc('FinalResult.jsx'), td = readSrc('TeacherDashboard.jsx'), app = readSrc('App.jsx')
  ok(SEG.test(fr), '期末：40% 维度分段 = 150000/90000/30000/0（W2-2 落值未动）')
  ok(SEG.test(td), '教师端：分段与学生端同式（两处同口径）')
  ok(SEG.test(app), 'App：分段同式（第三处副本仍在）')
  ok(/sumNet\(history\)/.test(fr) && /netTotal\.value/.test(fr), '期末：分段输入 = Σ净利润（单源累加，不再裸 reduce）')
  ok(/sumNet\(history\)\.value/.test(td), '教师端：分段输入 = Σ净利润（单源累加）')
  // 零变化证明：新旧取数在引擎产出上逐组同值
  const { perGroup } = runSeason6()
  const oldWay = perGroup.map(g => g.weeksList.reduce((a, r) => a + (r.profit || 0), 0))
  const newWay = perGroup.map(g => sumNet(g.weeksList).value)
  ok(oldWay.every((v, i) => v === newWay[i]), '取数改造零变化：旧写法 Σ(profit||0) === 新写法 sumNet 逐组同值', `${oldWay.join(',')} vs ${newWay.join(',')}`)
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log(`验收口径：三处界面各有一条"显示 + 定义 + 单源"的断言；★ 反向验证 = 删任一处显示即报红`)
process.exit(fail ? 1 : 0)
