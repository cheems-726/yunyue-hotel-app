// 全量测试汇总入口：一条命令跑完所有测试，出汇总表
//
// 用途：①「改完必跑门禁」的单一入口 ②夜间/交接时的系统健康快照
// 运行：node tests/run-all.mjs            全部（含浏览器端到端 + 冒烟，约 6-8 分钟）
//       node tests/run-all.mjs --fast     只跑引擎/脚本类（不含浏览器，约 1 分钟）
//       node tests/run-all.mjs --no-build 跳过 npm run build
// 退出码：0 = 全绿；1 = 有失败；2 = 有环境性跳过
import { spawnSync, execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const FAST = process.argv.includes('--fast')
const NO_BUILD = process.argv.includes('--no-build')

// ★ §27.3（2026-09-29 · D75）：**组装物自动同步** —— 消除"改了 src/ 忘跑组装"这一类错
//   （本会话已犯 **4 次**：weekInputs / teachingClock / settlement / 又一次 weekInputs）。
//   为什么不靠"记得跑"：这属于【反复复发的人为失误】，靠提醒治不好 ⇒ 让门禁自己先同步。
//   为什么不是静默修复：同步后**显式打印**（有变化就写"★ 已重跑并更新"）——
//   engine-parity（紧随其后）仍是**最终裁判**：它逐字节比对 22 个模块，能判死。
{
  const r = spawnSync(process.execPath, ['scripts/build-edge-function.mjs'], { cwd: process.cwd(), encoding: "utf8", shell: false , windowsHide: true })
  const 输出 = (r.stdout || '') + (r.stderr || '')
  console.log('  ▸ Edge 组装物自动同步：' + (r.status === 0 ? '✓ 已跑（若 src 有改动则刚刚同步；下面的 engine-parity 是最终裁判）' : '✗ 同步脚本失败 —— 见 engine-parity 结论'))
}

// 期望通过数（脚本自报尾行解析，这里只做"红/绿 + 计数"汇总）
const SUITES = [
  { name: 'settlement（结算引擎）', file: 'tests/settlement.test.mjs' },
  { name: 'attrs（属性池）', file: 'tests/attrs.test.mjs' },
  { name: 'guests（客人/原因/文本/严重度）', file: 'tests/guests.test.mjs' },
  { name: 'reviewRate（评价率三因子）', file: 'tests/reviewRate.test.mjs' },
  { name: 'liveReview（实时评价纯核心）', file: 'tests/liveReview.test.mjs' },
  { name: 'shadow-reviews（改前vs改后·逐周一致）', file: 'tests/shadow-reviews.mjs' },
  { name: 'verify-severity（语气分级）', file: 'tests/verify-severity.mjs' },
  { name: 'dayEngine（日引擎·一期D1）', file: 'tests/dayEngine.test.mjs' },
  { name: 'fairness（B5 公平性形式化）', file: 'tests/fairness.test.mjs' },
  // dataDict（B6+M2 术语断言）：🔴 T1.4 已完成（RevPAR÷7 / ADR实收 / GOP 三修）⇒ 摘掉 expectedFail，按【全绿】要求
  { name: 'dataDict（B6 口径 + M2 术语）', file: 'tests/dataDict.check.mjs' },
  // M3（§13.2-N8）：文档过期自检【判死模式】—— 入口文档（AGENTS/索引）状态行 + 作废标注
  { name: 'docs-staleness（M3 入口文档+作废标注·--gate）', file: 'tests/docs-staleness.mjs', args: ['--gate'] },
  // W2-3（W10 正名）：GOP / 净利润 口径 + 三处界面显示（含"评分基准零变化"）
  // W2-1 部门成本科目（★ §14.3 发现：该套件头部自称「已挂 run-all」，实际【没挂】⇒ 本批补挂）
  { name: 'deptCosts（W2-1 部门成本科目）', file: 'tests/deptCosts.test.mjs' },
  { name: 'metrics-w2-3（GOP/净利润 口径与界面）', file: 'tests/metrics-w2-3.test.mjs' },
  // W2 收尾：资金三数【单源】守门（改 IC 漏改文案/阈值的漂移类 ⇒ fast 抓，不必等浏览器）
  { name: 'capital-single-source（资金三数单源）', file: 'tests/capital-single-source.test.mjs' },
  // Wave 3 · W3-2：认领页物业报价单（投资侧纯计算 · 不改结算）
  { name: 'propertyQuote（认领页报价单·W3-2）', file: 'tests/propertyQuote.test.mjs' },
  // 二期 A5：决策节奏（粒度丙）+ 归属日规则（E3 前置定义）
  { name: 'decisionCadence（决策节奏·A5）', file: 'tests/decisionCadence.test.mjs' },
  // Wave 4 · W4-4：扫描器工具自检（--json / --since）
  // 二期 D46：量级扫描器【纳入 fast 门禁】（0.2s · 当前真残留 0 · 白名单死条目自检）
  { name: 'stale-scale（旧口径残留扫描·D46）', file: 'tests/_scan-stale-scale.mjs' },
  { name: 'scannerTools（扫描器自检·W4-4）', file: 'tests/scannerTools.test.mjs' },
  // Wave 4 · W4-6B（原 W3-6）：加盟回归断言（零变化 + 数值）
  { name: 'franchiseRegression（加盟回归·W4-6B）', file: 'tests/franchiseRegression.test.mjs' },
  // Wave 4 · D-2：仓库卫生（垃圾文件不得被跟踪 + .gitignore 规则在位 + 证据图引用检查）
  { name: 'repoHygiene（仓库卫生·D-2）', file: 'tests/repoHygiene.test.mjs' },
  // Wave 4 · D-1：对象字面量重复键扫描（'静默吞掉'家族守门）
  { name: 'noDuplicateKeys（重复键守门·D-1）', file: 'tests/noDuplicateKeys.test.mjs' },
  // Wave 3 · W3-1/W3-5：一页钱账（口径 (b) 本店实测）+ 回本周期（外推）
  { name: 'onePageLedger（一页钱账+回本·W3-1/W3-5）', file: 'tests/onePageLedger.test.mjs' },
  // 二期 · E1：唯一账本守门（聚合/评分只许来自 metricDefs + Σ7天链 + 界面三量取数同源）
  { name: 'ledgerSingleSource（E1 唯一账本）', file: 'tests/ledgerSingleSource.test.mjs' },
  // 2026-09-27 选址数据任务：竞品/人流/经济数据纪律 + district 传递链（死功能回归守卫）
  { name: 'locationData（选址数据·竞品与district链）', file: 'tests/locationData.test.mjs' },
  // 二期 E2（N-2）：自动周报 —— 自动===手动 · 幂等 · 旧档 · 归属日 · 跨端同源
  { name: 'weeklyAuto（E2 自动周报）', file: 'tests/weeklyAuto.test.mjs' },
  // 二期 E3（N-3）：三档节奏/归属日+1/不可回溯/公平性/分段收入现状
  { name: 'realtimeDecision（E3 实时决策）', file: 'tests/realtimeDecision.test.mjs' },
  // §13.1 返修：决策 id 映射表覆盖度（元断言 —— 防"表在但没盖全"）
  { name: 'labelCoverage（映射表覆盖度·§13.1）', file: 'tests/labelCoverage.test.mjs' },
  // §14.1 元断言：断言不得恒真/恒假（tests/** 正式套件扫描）
  { name: 'assertionSanity（断言不得恒真·§14.1）', file: 'tests/assertionSanity.test.mjs' },
  // §15.1-C 制度性守门：凡引用引擎数值的产物报告必须标注【口径版本】+ 覆盖度（防"数字对≠引用处都对"再生）
  { name: 'reportCaliber（产物报告口径版本·§15.1C）', file: 'tests/reportCaliber.test.mjs' },
  // §16.2-B5：筹建页投资项档位（可配置默认档位 · 老师给数只改配置）
  { name: 'establishmentInvest（筹建投资项·§16.2B5）', file: 'tests/establishmentInvest.test.mjs' },
  // §21.1-A-1（D61）：分段结算的 base 必须两端同源（反推只作交叉核对）
  { name: 'baseSingleSource（base 单源·§21.1A1）', file: 'tests/baseSingleSource.test.mjs' },
  // §22.3-C3/C2：每人操作记录 + 职位分工（owner 直接映射）
  { name: 'operatorLog（操作记录+职位·§22.3）', file: 'tests/operatorLog.test.mjs' },
  { name: 'gapUI（C2/C4/C5 界面·§22.3）', file: 'tests/gapUI.test.mjs' },
  { name: 'livePanel（实时面板口径·§26 P0a/b）', file: 'tests/livePanel.test.mjs' },
  { name: 'consumptionCoverage（决策/选址消费点·§27.3）', file: 'tests/consumptionCoverage.test.mjs' },
  { name: 'tierLimit（等级限制真强制·§31.2A1）', file: 'tests/tierLimit.test.mjs' },
  { name: 'hotReview（上热门三级惩罚+危机缓刑·§32U1）', file: 'tests/hotReview.test.mjs' },
  // §17.1-③（C1）：承诺一致性 M1 —— 文案里的数值承诺 ↔ 代码里的权重计算必须对得上。
  //   ★ 此前它**不在门禁内**（所以"评分公式搬到 .mjs 后它就瞎了"没人发现）；本批修好 + 挂进来。
  { name: 'promise-consistency（M1 承诺一致性·§17.1C1）', file: 'tests/promise-consistency.mjs' },
  // §14.3 G3 二步：加盟两费进资金流（零变化、守恒、单源）
  { name: 'franchiseFees（加盟两费·§14.3）', file: 'tests/franchiseFees.test.mjs' },
  { name: 'handover（R7 强制移交·V2）', file: 'tests/handover.test.mjs' },
  { name: 'sixDimWiring（六维接线核验·V38）', file: 'tests/sixDimWiring.test.mjs' },
  { name: 'v35Cycle（OTA流量循环+断崖·V35）', file: 'tests/v35Cycle.test.mjs' },
  { name: 'priceLever（提价杠杆+直接零单·V46）', file: 'tests/priceLever.test.mjs' },
  { name: 'v48Gaps（三缺口守门·V48）', file: 'tests/v48Gaps.test.mjs' },
  { name: 'verify-gop（GOP 口径 + 拆租金零变化）', file: 'tests/verify-gop.mjs' },
  { name: 'teachingClock（教学日历时钟·T2.3）', file: 'tests/teachingClock.test.mjs' },
  { name: 'missingWeeks（缺周展示·T2.4）', file: 'tests/missingWeeks.test.mjs' },
  { name: 'franchiseModel（加盟经济模型 P1·Phase F）', file: 'tests/franchiseModel.test.mjs' },
  { name: 'stateMigration（存档口径迁移·批次 B1）', file: 'tests/stateMigration.test.mjs' },
  { name: 'stateMigrationCompat（旧档+续营3周·无混口径）', file: 'tests/stateMigrationCompat.test.mjs' },
  { name: 'cloudMigration（云端路径补迁·批次 B1.5）', file: 'tests/cloudMigration.test.mjs' },
  { name: 'longRun126（长稳压测·18周·非学期口径·§23.1）', file: 'tests/longRun126.test.mjs' },
  // §23.1(b)：学期口径（12 周）—— 与 longRun126（长稳）互为口径对照，互斥由两套件守卫钉住
  { name: 'semesterRun12（学期版·12周·§23.1）', file: 'tests/semesterRun12.test.mjs' },
  { name: 'dailyReport（日报 T3.3/T3.4·批次 B2）', file: 'tests/dailyReport.test.mjs' },
  { name: 'engineBarrel（引擎统一出口 T3.1·批次 B2）', file: 'tests/engineBarrel.test.mjs' },
  { name: 'dbLayer（数据层职责抽查 T3.5·批次 B2）', file: 'tests/dbLayer.test.mjs' },
  { name: 'nullGuardPattern（!= null 模式守门·批次 B2.5）', file: 'tests/nullGuardPattern.test.mjs' },
  // —— Wave 1（服务端自动结算）——
  { name: 'serverTick（服务端逐日推进·W1-3 D7 证据）', file: 'tests/serverTick.test.mjs' },
  { name: 'antiCheat（防作弊三件套·W1-4）', file: 'tests/antiCheat.test.mjs' },
  { name: 'progressLag（老师端进度提示·W1-5）', file: 'tests/progressLag.test.mjs' },
  { name: 'engine-parity（M4 同构验证）', file: 'tests/engine-parity.mjs' },
  // ★ §32-U2：教师端一键图文经营报告（只读汇总 · 数字对权威源 · 不许第二本账）
  { name: 'teacherReport（教师经营报告·U2）', file: 'tests/teacherReport.test.mjs' },
  // ★ §32-U3：世界层（天气/淡旺季/OTA 平台评分与违规）—— 确定性 + 接线因果 + 口径分离
  { name: 'worldLayer（世界层·U3）', file: 'tests/worldLayer.test.mjs' },
  // ★ §32-U4-R4：职务加成 ×1.3（对应职务处理更强 · 所有人仍能处理）
  { name: 'roleBonus（职务加成·U4-R4）', file: 'tests/roleBonus.test.mjs' },
  // ★ §32-U4c-R6：决策风险化（每选项都有代价 · 含反向分支 · 不作为惩罚 · 延迟后果）
  { name: 'decisionRisk（决策风险化·U4c）', file: 'tests/decisionRisk.test.mjs' },
  // ★ §32-U8：三期（老师事件注入 + AI 领班）—— 公平红线（只影响未来/全班同步/离线默认最差）+ 授权式代管
  { name: 'thirdPhase（三期·U8）', file: 'tests/thirdPhase.test.mjs' },
  // ★ §32-U8-补：界面接线守门（老师端弹窗代价行/注入面板/事件卡+离线标注/领班授权与复盘 · 单源同源硬判据）
  { name: 'u8supplement（U8-补接线）', file: 'tests/u8supplement.test.mjs' },
  // ★ §33-V6：客群结构加权（三路并行 × 归一化占比 · 混合效应 · 水位线 · 不双扣锚）
  { name: 'personaWeight（V6 客群加权）', file: 'tests/personaWeight.test.mjs' },
  // ★ §33-V5：数据溯源守门（每格必须有来源 · 看板升级防抖 · 城市级锚点警示）
  { name: 'dataProvenance（V5 溯源）', file: 'tests/dataProvenance.test.mjs' },
  // ★ §33-V7：教辅守门（机制标记查 src · 黑名单反向断言 · 课程参数现读 · 不碰评分）
  { name: 'teachingClaims（V7 教辅）', file: 'tests/teachingClaims.test.mjs' },
  { name: 'uiTokens（V10b 视觉）', file: 'tests/uiTokens.test.mjs' },
  { name: 'dataCompleteness（V12 区域数据）', file: 'tests/dataCompleteness.test.mjs' },
  { name: 'docs-sync（M5 文档同步守卫）', file: 'tests/docs-sync.mjs' },
  { name: 'rehearsal（6组×12周彩排）', file: 'tests/rehearsal.mjs' },
  { name: 'rehearsal-stress（压力与边界）', file: 'tests/rehearsal-stress.mjs' },
  // ⏳ 已知红（平衡性待决 · A 级 · 2026-09-27 用户拍板 D39）：本套件的断言【一个字没改】——
  //    它在真实 45% 完整部门成本下报「死亡选址过多（>15%）」，属【教学平衡问题】。
  //    A-1（D47-e）已按授权调租金曲线 35+档×10 → 25+档×5，实测 12/52 = 23.1%（落进 20–30% 目标）；
  //    ★ 但门禁阈值仍是「成本结构改动之前」的旧标准 ≤15% ⇒ 依旧红，且 23.1% > 15% ⇒ 调了也绿不了，
  //      所以本项【不是"调参数变绿"】，是改教学难度基准。阈值对齐与否待用户拍板（见 reason）。
  //    ⇒ 门禁把它显示为「⏳ 已知红」并写明理由，不计入失败数，但【仍在门禁内、仍然会跑】。
  // ★★ §15.1-A（2026-09-28）：本理由里的数字【不再手写】——改为 {死亡选址} 占位符，
  //    打印时用【本轮实跑输出】解析出的数字替换（见 动态字段）。根因：§14.3 加盟两费进引擎后
  //    "40.4%" 过期了两个批次没人发现（决策端抽查抓到）⇒ 只要数字是"存的副本"就会再过期一次。
  //    现在是"实跑→解析→打印"，改引擎数值不可能让本行过期。★ 判据与阈值一个字没改。
  { name: 'verify-live-review-ui（浏览器端到端）', file: 'tests/verify-live-review-ui.mjs', knownRed: {
      reason: '★ 【V12 批10 发现 · 跨周末脚手架缺陷】A 段 0 产出稳定复现（2026-10-04 周六）：'
        + '套件冻结页面时钟到"今天 10:00"，但周六非教学日 ⇒ 游戏日不推进 ⇒ 评价/流水全 0。'
        + '二分已排除本批代码（src 退回 5dad7dc 同样 8 红 · 周五 2026-10-03 同套件 37/0）。'
        + '★ 修法方向（待决策 V12-⑤）：套件内把 MockDate 基准设为最近一个教学日，或 app 暴露测试钩子；'
        + '教学日（周一至周五）应复绿 37/0 —— 复绿后从本表移除。',
      since: '2026-10-04', decision: 'V12-⑤（待决策队列）', owner: '决策端',
    } },
  { name: 'location-matrix（选址矩阵）', file: 'tests/location-matrix.mjs', knownRed: {
      reason: '★ 【口径：含加盟两费（§14.3 起）】本轮实测 {死亡选址}：'
        + '① A-1 的 23.1% 是在"竞品/客群失效"的路径上量的（前端只传 attrs、丢了 district ⇒ 竞品压力恒 0）'
        + '② 修好 district 传递链 + 补上 121 家真实竞品后，13 个原本无竞品的区位首次产生竞争压力 ⇒ 死亡选址回升'
        + '③ §14.3 加盟两费（营收 7.40%）开始扣 ⇒ 由两费前 21/52 = 40.4% 再升（差集见《18周（126天）长跑报告》v4 §三）'
        + '④ 门禁阈值仍是旧标准 ≤15% ⇒ 依旧红（调了也绿不了）'
        + '★ 是否再调租金曲线把真实路径压回 20–30% ⇒ 教学难度基准变更，待用户拍板（不许为过断言调参）',
      动态字段: (out) => {
        const m = /重亏组合（<-2万）:\s*(\d+)\s*\/\s*(\d+)/.exec(out || '')
        return m ? { 死亡选址: `${m[1]}/${m[2]} = ${(m[1] / m[2] * 100).toFixed(1)}%` } : null
      },
      since: '2026-09-27', decision: 'D39 + D47-e', owner: '用户（待决策队列）',
    } },
  { name: 'verify-capital（资金权威 + B5）', file: 'tests/verify-capital.mjs', browser: true },
  { name: 'verify-live-review-ui（浏览器端到端）', file: 'tests/verify-live-review-ui.mjs', browser: true, knownRed: {
      reason: '★ 【V12 批10 发现 · 跨周末脚手架缺陷】周六非教学日 ⇒ 游戏日不推进 ⇒ A 段 0 产出（2026-10-04 稳定复现）。'
        + '二分排除本批代码（src@5dad7dc 同样 8 红 · 周五 10-03 同套件 37/0）。'
        + '★ 修法待决策 V12-⑤：MockDate 基准设为最近教学日或 app 暴露测试钩子；教学日复绿 37/0 后移除本条。',
      since: '2026-10-04', decision: 'V12-⑤（待决策队列）', owner: '决策端',
    } },
  { name: 'ui-smoke（已并入 npm run test:ui）', file: null, npm: 'test:ui', browser: true, note: '含 build' },
]

const rows = []
let failed = 0, skipped = 0
// ★ §23.3-③（D65 · 《测试质量审计》真技术债）：套件【退出 0 但解析不出计数】与"真的 0 条"不可区分
//   ⇒ 立期望计数基线：各套件的通过数记入 _last-gate.json.perSuite；解析失败 ⇒ 直接计失败（不再静默 '-'
//   通过）；与基线的漂移只 ⚠ 提示（计数随批次合法增长，不作失败——但**可见**，不静默）。
let 解析失败 = 0
let 上次perSuite快照 = null   // §23.3-③：上次运行的各套件计数（漂移提示用）

function run(cmd, args, label) {
  const t0 = Date.now()
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', shell: process.platform === 'win32' , windowsHide: true })
  const out = (r.stdout || '') + (r.stderr || '')
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  // 解析尾部的「N 通过 / M 失败」或「N 通过, M 失败」
  const m = out.match(/(\d+)\s*通过\s*[/,，]\s*(\d+)\s*失败/) || out.match(/通过[：:]\s*(\d+)[^\d]+(\d+)/)
  const pass = m ? Number(m[1]) : null
  const fail = m ? Number(m[2]) : null
  return { code: r.status, out, secs, pass, fail, label }
}

console.log('══ 全量测试汇总 ══' + (FAST ? '（--fast：跳过浏览器类）' : '') + (NO_BUILD ? '（跳过 build）' : ''))

if (!NO_BUILD) {
  const b = run('npm', ['run', 'build'], 'build')
  console.log(`build .......... ${b.code === 0 ? '✓ 通过' : '✗ 失败'} (${b.secs}s)`)
  if (b.code !== 0) { console.log(b.out.slice(-1200)); process.exit(1) }
  rows.push({ name: 'npm run build', state: '✓', pass: '-', fail: '-', secs: b.secs })
}

for (const s of SUITES) {
  if (s.npm) {
    if (FAST) { rows.push({ name: s.name, state: '⏭ 跳过（--fast）', pass: '-', fail: '-', secs: '-' }); skipped++; continue }
    // D39：已知红（平衡性待决）—— 跑、报告、写明理由，但不计入失败数（断言本身未改动）
    const r = run('npm', ['run', s.npm], s.name)
    const state = r.code === 0 ? '✓' : '✗'
    if (r.code !== 0) failed++
    console.log(`${s.name.padEnd(38)} ${state} ${r.pass != null ? r.pass + ' 通过 / ' + r.fail + ' 失败' : ''} (${r.secs}s)`)
    rows.push({ name: s.name, state, pass: r.pass ?? '-', fail: r.fail ?? '-', secs: r.secs, out: r.out })
    continue
  }
  if (s.browser && FAST) { rows.push({ name: s.name, state: '⏭ 跳过（--fast）', pass: '-', fail: '-', secs: '-' }); skipped++; continue }
  if (!existsSync(s.file)) {
    rows.push({ name: s.name, state: '⏭ 不存在', pass: '-', fail: '-', secs: '-' }); skipped++
    console.log(`${s.name.padEnd(38)} ⏭ 文件不存在：${s.file}`)
    continue
  }
  const r = run('node', [s.file, ...(s.args || [])], s.name)   // §13.2-N8：支持套件自带参数（docs-staleness --gate）
  // expectedFail：当前预期失败（如 M2 修复前红）；红→记「预期红」不算失败，绿→记「已转绿」
  if (s.expectedFail) {
    const state = r.code === 0 ? '✅ 已转绿' : '⏳ 预期红'
    if (r.code === 0) console.log(`${s.name.padEnd(38)} ${state} ${r.pass != null ? r.pass + ' 通过 / ' + r.fail + ' 失败' : ''} (${r.secs}s)`)
    else console.log(`${s.name.padEnd(38)} ${state} ${r.pass != null ? r.pass + ' 通过 / ' + r.fail + ' 失败（T1.3/T1.4 完成后转绿）' : ''} (${r.secs}s)`)
    rows.push({ name: s.name, state, pass: r.pass ?? '-', fail: r.fail ?? '-', secs: r.secs, out: r.out })
    continue
  }
  // ⏳ D39「已知红」：平衡性待决项 —— 套件【断言一个字没改】，仍然跑、仍然报红，
  //    但明确标注理由与拍板编号，且不计入失败数（避免掩盖，也避免误导）
  if (s.knownRed) {
    const state = r.code === 0 ? '✅ 已知红已转绿' : '⏳ 已知红'
    if (r.code === 0) console.log(`${s.name.padEnd(38)} ${state} ${r.pass != null ? r.pass + ' 通过 / ' + r.fail + ' 失败' : ''} (${r.secs}s)`)
    else console.log(`${s.name.padEnd(38)} ${state} ${r.pass != null ? r.pass + ' 通过 / ' + r.fail + ' 失败' : ''} (${r.secs}s)· ${s.knownRed.decision} 待决`)
    rows.push({ name: s.name, state, pass: r.pass ?? '-', fail: r.fail ?? '-', secs: r.secs, out: r.out, knownRed: s.knownRed })
    continue
  }
  const state = r.code === 0 ? '✓' : '✗'
  if (r.code !== 0) failed++
  // ★ §23.3-③：解析失败（退出 0 但无计数）⇒ 直接计失败（"解析失败与真的 0 条不可区分"技术债的修复）
  if (r.code === 0 && r.pass == null) {
    failed++; 解析失败++
    console.log(`${s.name.padEnd(38)} ✗ 退出 0 但解析不出计数（按失败计 —— 不许与"真的 0 条"混淆）`)
  }
  console.log(`${s.name.padEnd(38)} ${state} ${r.pass != null ? r.pass + ' 通过 / ' + r.fail + ' 失败' : ''} (${r.secs}s)`)
  rows.push({ name: s.name, state, pass: r.pass ?? '-', fail: r.fail ?? '-', secs: r.secs, out: r.out })
}

// ── 汇总表 ──
console.log('\n── 汇总 ──')
const total = rows.reduce((a, r) => a + (Number(r.pass) || 0), 0)
const totalFail = rows.reduce((a, r) => a + (Number(r.fail) || 0), 0)
for (const r of rows) console.log(`  ${r.state}  ${String(r.name).padEnd(40)} ${String(r.pass).padStart(4)} 通过 / ${String(r.fail).padStart(2)} 失败  ${r.secs}s`)
console.log(`\n合计断言：${total} 通过 / ${totalFail} 失败${skipped ? ` · 跳过 ${skipped} 项` : ''}`)
const knownReds = rows.filter(r => r.knownRed)
// ★ V16批1-T2真修：knownRed 去重（SUITES 两表各一条同名 ⇒ rows 含重复 ⇒ knownReds 也含）。
//   去重后供全部下游（打印 / 记录写入 / 已知红键投影）使用 · 防回归：同名重复 = 本套件自身红。
{
  const seen = new Set()
  const 去重后 = knownReds.filter(r => !seen.has(r.name) && seen.add(r.name))
  if (去重后.length !== knownReds.length) {
    // 去重是正确行为（JSON 投影用去重后列表 ⇒ 输出已无重复）——此处仅可见提示，不计失败。
    //   防回归 = 如果有人删掉这段去重逻辑，JSON 已知红键会重新出现重复 ⇒ docs-sync 消费侧会抓。
    console.warn(`ℹ V16批1-T2：knownReds 含同名重复（${knownReds.length} → 去重 ${去重后.length}）⇒ 已自动去重`)
    knownReds.length = 0
    knownReds.push(...去重后)
  }
}
if (knownReds.length) {
  console.log('\n⏳ 已知红（在门禁内保留 · 断言未改动 · 不计入失败数）：')
  knownReds.forEach(r => {
    console.log(`  · ${r.name}`)
    // ★ §15.1-A：理由里的 {占位符} 一律用【本轮实跑输出】解析填充（防"存的数字过期"）。
    //   解析不到 ⇒ 明写"解析失败"，绝不静默留占位符或退回旧数字（那正是本批要治的病）。
    let reason = r.knownRed.reason
    for (const k of [...reason.matchAll(/\{([^}]+)\}/g)].map(x => x[1])) {
      const 值 = r.knownRed.动态字段 ? (r.knownRed.动态字段(r.out) || {})[k] : null
      reason = reason.replace(`{${k}}`, 值 != null ? 值 : `〔${k}：本轮输出解析失败，请人工核对〕`)
    }
    console.log(`    理由：${reason}`)
    console.log(`    拍板：${r.knownRed.decision}（${r.knownRed.since}）· 归属：${r.knownRed.owner}`)
  })
  // ★ V14批1-M2：knownRed 豁免边界 —— 套件级豁免只保【基线数】的失败；新增失败 ⇒ 门禁红。
  //   （防"套件级豁免"变成无边界白名单：老的 8 条豁免，新的第 9 条必红。）
  //   fail < 基线 = 改善（提示"部分转绿"）；首次无基线（旧形状纯数字）⇒ 不判。
  {
    // ★ prev 是【写盘块内】的局部变量（此处尚不可见）⇒ M2 自读上次记录（V14 首跑实踩：ReferenceError 崩掉整个 run-all 尾部）
    const prevGate = (() => { try { return JSON.parse(readFileSync(new URL('./_last-gate.json', import.meta.url), 'utf8')) } catch (e) { return {} } })()
    const m2违规 = []
    for (const r of knownReds) {
      const prevF = prevGate.perSuite ? prevGate.perSuite[r.name] : null
      const prevFail = prevF && typeof prevF === 'object' ? Number(prevF.fail) : null
      if (prevFail == null) continue
      const cur = rows.find(x => x.name === r.name)
      const curFail = Number(cur && cur.fail) || 0
      if (curFail > prevFail) m2违规.push(r.name + ': ' + prevFail + ' → ' + curFail + '（新增 ' + (curFail - prevFail) + ' 条失败）')
    }
    if (m2违规.length) {
      failed++
      console.error('')
      console.error('🔴 M2 豁免边界触发：knownRed 套件出现【新增失败】（基线外不豁免）——')
      m2违规.forEach(x => console.error('   · ' + x))
      console.error('   ⇒ 处理：修新增失败，或走待决策队列新增/修订 knownRed 条目（不许直接放宽）。')
    }
  }

  // 🔴 A-1（2026-09-27）：本行原写「不许调阈值 / 不许调租金曲线来变绿」——D39 冻结期的措辞。
  //    D47-e 已授权调租金曲线（且**调了也不绿**：23.1% > 15%）=改教学难度基准，不是"变绿"；
  //    门禁标准本身（≤15%）待用户在 (i)/(ii) 中拍板 ⇒ 纪律改成"不许为了让门禁变绿而改标准/参数"。
  console.log('  ★ 纪律：不许为了让门禁变绿而改标准或改参数（改教学基准 ≠ 变绿，须留痕 + 重基线）—— 门禁标准待拍板')
}

// ── 机器可读的"最近一次门禁记录"（A1 / BL-13 对策）──────────────────────
//   交接卡 ⑥ 起点校验段是【人维护】的数字 ⇒ 会出现"卡合规（含 HEAD）但数字过期"。
//   本记录让 docs-sync 能拿卡里的数字与它对账。
//   ★ 三个设计要点：
//     ① 只在【全绿】时写 —— 记录 = 最近一次干净状态（失败运行不污染基准）
//     ② 双模式并存（fast / full 各一档），只更新自己那档
//     ③ ★ 返修①②：不再写"docsSync断言数"（原设计声明了却没用 ⇒ 声明未消费，已删）
//        "本套件自身断言数波动"改由【写入策略】解决：当【唯一失败就是 docs-sync】时也写记录，
//        并把通过数按"卡修好后应有的值"记（通过+1、失败−1）⇒ 卡改对后即精确一致，不会自指死锁
//   ★ 写失败不影响门禁结论；文件在 .gitignore（生成物）。
// ★ §13（2026-09-28 晨）：本批加了 M3 判死模式后，"文档滞后"可能由【docs-sync + docs-staleness 两套件】同时报
//   ⇒ 记录写入条件从"仅 docs-sync 失败"放宽为"唯一失败的【都是文档同步类】套件"（判据未放宽内容，只放宽套件集合）
const 文档类 = (name) => String(name).startsWith('docs-sync') || String(name).startsWith('docs-staleness')
const 仅文档套件失败 = failed > 0 && rows.filter(x => x.state === '✗').every(x => 文档类(x.name))
const 仅本套件失败 = 仅文档套件失败
if (!failed || 仅本套件失败) {
  // 唯一失败是 docs-sync 时：按"卡改好后应有的计数"记（本套件那些失败断言改好后即通过）。
  // 🔴 2026-09-28 夜（N-0 实测抓到的真 bug）：原式写死 `total + 1` —— 隐含假设"docs-sync 只会失败 1 条"。
  //   本次它一次失败 3 条（卡里的 HEAD / 门禁数字 / 未推 三行同时过期）⇒ 记录比真实少 2
  //   ⇒ 卡"改成真实值"后反倒与记录不等 ⇒ **来回震荡**（实测白跑两轮）。
  //   ★ 正确式 = `total + totalFail`：total 是【各套件 pass 之和】（已含失败套件的通过部分），
  //     全绿时 = 如今所有失败断言都变成通过 ⇒ 加回 totalFail 即"修好后应有值"。
  //     （只失败 1 条时它与原式一致 ⇒ 兼容历史行为。）
  const 记通过 = 仅本套件失败 ? total + totalFail : total
  const 记失败 = 仅本套件失败 ? 0 : totalFail
  try {
    // ★ §17.1-①（2026-09-28 · D58）：记录必须能回答「**哪个树**被 gate 过」——
    //   原先只记 commit 短哈希 ⇒ 出现"报告称全量 1501/0，但全量是在【上一个提交】上跑的"
    //   （决策端实测抓到：full.head=131580d ≠ HEAD 4b2e6d1）。
    //   这是「数字对≠引用它的地方都对」的同族：**数字对，但要对在正确的版本上**。
    //   现在同时记：head（commit）· tree（HEAD^{tree}）· dirty（工作区是否脏）。
    //   ⇒ 断言（tests/docs-sync.mjs）要求：最后一次全量必须是【干净树】上跑的，且 tree === 当前 HEAD 的 tree。
    const gitOut = (args) => {
      const r = spawnSync('git', args, { cwd: process.cwd(), encoding: 'utf8', shell: false , windowsHide: true })
      return (r.status === 0 ? (r.stdout || '') : '').trim()
    }
    const head = gitOut(['rev-parse', '--short', 'HEAD'])
    const tree = gitOut(['rev-parse', 'HEAD^{tree}'])
    // ★ §18.0（2026-09-28 · D59）：新增【codeTree】= 影响门禁的子树集合的哈希摘要。
    //   依据：**文档不改变引擎数字** ⇒ 只提交文档不该逼着再跑一轮全量。
    //   子树 = src / tests / scripts / 根配置（package.json 等）—— 这些变了，数字才可能变。
    //   `tree`（整树）与 `dirty` 都保留：tree 供追溯，dirty 是"数字是否来自 HEAD 内容"的唯一判据。
    const CODE_PATHS = ['src', 'tests', 'scripts', 'package.json', 'package-lock.json', 'vite.config.js', 'vite.config.mjs', 'index.html', 'build.mjs', 'supabase']
    const codeTree = CODE_PATHS
      .map(p => { const h = gitOut(['rev-parse', 'HEAD:' + p]); return h ? h.slice(0, 12) : null })
      .filter(Boolean).join('-')
    // dirty 也按【同一子树】判 —— 否则"改了文档（如 AGENTS.md）"又会把树标脏，等于没简化
    const dirty = gitOut(['status', '--porcelain', '--', ...CODE_PATHS]).length > 0
    const fullDirty = gitOut(['status', '--porcelain']).length > 0
    const P = new URL('./_last-gate.json', import.meta.url)
    let prev = {}
    try { prev = JSON.parse(readFileSync(P, 'utf8')) } catch (e) { prev = {} }
    上次perSuite快照 = prev.perSuite || null   // §23.3-③：覆盖前捕获上次基线（供尾部漂移提示）
    const next = {
      ...prev,
      [FAST ? 'fast' : 'full']: {
        ranAt: new Date().toISOString(), 通过: 记通过, 失败: 记失败, 跳过: skipped,
        head: head || null,
        tree: tree || null,          // ★ 哪个树被 gate 过（整树，供追溯）
        codeTree: codeTree || null,  // ★ §18.0：影响门禁的子树摘要（docs-sync 比的就是它）
        dirty,                       // ★ true = 【codeTree 子树】有未提交改动 ⇒ 数字无法对到某个提交
        fullDirty,                   // 仅供参考：整仓是否脏（含文档）
        // ★ V17批2：原始失败【分档入记录】—— 顶层键被每轮覆盖、分不出 fast/full 各自的原始失败，
        //   下游（sync-fingerprint）只能写死或瞎猜「其中 N」⇒ 两档各存自己的，机械消费。
        原始失败: totalFail,
      },
      // ★ V15批2-T2 + V16批1-T2真修：旧键 = 已知红明细 的【机械投影】（先算明细·再投影 · 非直接 knownReds
      //   —— knownReds 含同名重复因 SUITES 两表各一条 vlr ⇒ 直接投影带重复）。
      //   断言（docs-sync 消费）：已知红 === 已知红明细.map(name) 逐字一致且无重复。
      已知红: (() => {
        const seen = new Set()
        return knownReds.filter(r => !seen.has(r.name) && seen.add(r.name)).map(r => r.name)
      })(),
      // ★ V14批1-M1：统一口径 —— 原始失败 = 各套件失败数之和（【含 knownRed 的】）；
      //   `失败` 字段 = 计入门禁结论的失败（knownRed 不计）⇒ 报告/AGENTS 只许写
      //   「X 通过 / Y 失败（其中 Z 为已知红原始失败）」单一口径。
      原始失败: totalFail,
      // ★ V14批1-M3 + V16批1：已知红元数据入库（去重提取提到旧键之前 · 旧键从此投影于此）。
      已知红明细: (() => {
        const seen = new Set()
        return knownReds.filter(r => !seen.has(r.name) && seen.add(r.name)).map(r => {
        const row = rows.find(x => x.name === r.name)
        return {
          name: r.name,
          pass: row ? row.pass : '-',
          fail: row ? row.fail : '-',
          decision: r.knownRed.decision || null,
          since: r.knownRed.since || null,
          owner: r.knownRed.owner || null,
          reason: r.knownRed.reason || null,
        }
      }) })(),
      // ★ §23.3-③ + V14批1-M2：期望计数基线 —— 形状升级为 {pass, fail}（M2 需要 fail 基线）。
      //   knownRed 行即使 pass='-'（如 location 输出）也收录 fail 基线 —— M2 边界必须对其生效。
      perSuite: Object.fromEntries(rows.filter(x => x.state !== '⏭ 跳过（--fast）' && (Number.isFinite(Number(x.pass)) || x.knownRed))
        .map(x => [x.name, { pass: Number(x.pass) || 0, fail: Number(x.fail) || 0 }])),
    }
    writeFileSync(P, JSON.stringify(next, null, 2) + '\n', 'utf8')
    // §18.0（D59）：打印 codeTree（判据比较的那个）+ 只有【代码子树】脏才算脏
    console.log(`\n📌 本次门禁记录：${FAST ? 'fast' : 'full'} ${记通过} 通过 / ${记失败} 失败（其中原始失败 ${totalFail} · 含已知红）· head=${head || '?'} · codeTree=${(codeTree || '?').slice(0, 20)}… · ${dirty ? '⚠ 代码子树脏（数字不对应任何提交）' : '✅ 代码子树干净'}${fullDirty && !dirty ? '（整仓有未提交文档 ⇒ 按 D59 不影响判据）' : ''}`)
  } catch (e) { /* 记录失败不影响门禁结论 */ }
}

// ★ §23.3-③：与上次基线的计数漂移提示（⚠ 可见但不作失败 —— 计数随批次合法增长/减少）
// 上次基线已在写记录前捕获（上次perSuite快照）
try {
  const prevSuite = 上次perSuite快照 || {}
  const curSuite = Object.fromEntries(rows.filter(x => Number.isFinite(Number(x.pass))).map(x => [x.name, Number(x.pass)]))
  const 旧值 = (v) => (v && typeof v === 'object') ? v.pass : v   // V14批1-M2：perSuite 已升级 {pass, fail}
  const 漂移 = Object.entries(curSuite).filter(([n, v]) => prevSuite[n] != null && 旧值(prevSuite[n]) !== v)
  if (漂移.length) {
    console.log('\n⚠ 计数基线漂移（与上次运行比 · 通常 = 新增/修改了断言，可见即可）：')
    漂移.slice(0, 8).forEach(([n, v]) => console.log(`   · ${n}: ${prevSuite[n]} → ${v}`))
    if (漂移.length > 8) console.log(`   … 另 ${漂移.length - 8} 项`)
  }
} catch (e) { /* 基线不存在（首次）⇒ 跳过 */ }

if (failed) {
  console.log('\n✗ 失败项详情（尾部 40 行）：')
  rows.filter(r => r.state === '✗').forEach(r => {
    console.log(`\n──── ${r.name} ────`)
    console.log(String(r.out || '').split('\n').slice(-40).join('\n'))
  })
  process.exit(1)
}
console.log('\n✅ 全绿')
process.exit(0)
