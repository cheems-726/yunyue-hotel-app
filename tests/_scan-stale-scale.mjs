// P3-5 · 全库旧口径残留扫描（可复用守门脚本）
//
// 用途：T1.1 把金额量级改了约 m 倍（m=10.0483）之后，扫 src/ 找【旧口径残留】——
//       旧阈值、旧量级字面量、"万"为单位的资金文案、预警 UI 变量、金额→万换算处。
// 运行：node tests/_scan-stale-scale.mjs           报告模式（有未豁免命中 → 退出码 1）
//       node tests/_scan-stale-scale.mjs --list    只列白名单（便于人工复核理由）
//       node tests/_scan-stale-scale.mjs --json    机器可读输出（W4-4 新增）
//       node tests/_scan-stale-scale.mjs --since <ref>  只扫该 ref 之后改动过的 src 文件（W4-4 新增）
//
// ★ 判据（§十九 P3-5）：报告必须是【0 残留】或【逐条列出剩余项 + 为什么可留】
//   ⇒ 本脚本把"可留"写成带理由的白名单，命中数 - 白名单数 = 真残留。
import { readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SRC = new URL('../src/', import.meta.url)
const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RULES = [
  { id: 'R1', desc: '资金阈值 · 旧一晚口径（<100000 / <50000）', re: /<\s*(100000|50000)\b/g },
  { id: 'R2', desc: '资金阈值 · 镜像（>100000 / >50000）', re: />\s*(100000|50000)\b/g },
  // R3 带语境守卫：500000 也是【新 profitScore 分段】的合法值 ⇒ 含 totalProfit/pProfit/profitScore
  // 的行一律跳过，只抓"当作资金量级用"的 500000
  { id: 'R3', desc: '旧起始资金字面量 500000（非 profitScore 分段）', re: /\b500000\b/g, guard: /(totalProfit|pProfit|profitScore)/ },
  { id: 'R4', desc: '"万"为单位的金额文案（含旧档位 30/50/80/150/200 万）', re: /\d+(\.\d+)?\s*万/g },
  { id: 'R5', desc: '资金预警 UI 阈值变量（isLow / isCritical）', re: /\b(isLow|isCritical)\b\s*=/g },
  { id: 'R6', desc: '金额 → 万 的展示换算（/10000）', re: /\/\s*10000\b/g },
]

// 白名单：【理由必须是"为什么这条可以留"，不是"我改不动"】
const WHITELIST = [
  // allow = 允许保留的【命中文本】模式（不是整文件放行 —— 这样同文件将来出现新残留仍会被抓）
  { rule: 'R4', file: 'src/BrandSelection.jsx', allow: /万[+]?[\/]间|元[\/]间|b\.cost\.includes/, why: '品牌单房造价/加盟费（N万[+]/间、约N元/间）属参考资料口径，不是资金量级。★ 本项按【结构】放行（每间造价 + cost 档位判定）—— 同文件若再现"启动资金约50万/502万"之类仍会被抓。（2026-09-27 W2 收尾：启动资金文案已改为 SCALE.IC_NEW 推导，不再需要白名单）' },
  { rule: 'R4', file: 'src/franchiseModel.mjs', allow: /./, why: '加盟参考资料原值（18万/7.18万/5.6万/10万/3.5-4万/2.5万/6.51万）与差异表文案 —— 该文件整体是参考资料层，不是资金量级；且它不被任何业务代码 import（已断言）' },
  { rule: 'R4', file: 'src/App.jsx', allow: /149 ?万|29\.8 ?万|14\.9 ?万|50万|30万|10万/, why: '「怎么涨分」卡片与成绩单副本的正确分段（≥50万=满分、≥30万=85、≥10万=70）。★ 启动资金/预警线文案已改由 SCALE 推导（不再硬编码 149万/29.8万）；本项只放行正确分段值 —— App.jsx 若再出现旧档位仍会被抓' },
  // ★ §32-U6-B1（2026-09-30）：筹建档位补了**可引用来源**（迈点《酒店投资全成本拆解》等），
  //   来源表里必然出现"3–5 万 / 100–200 万 / 62–68%"这类**引用原值** —— 它们是**参考资料口径**，
  //   不是资金量级文案（本文件同 franchiseModel：整体属参考资料层，且**不被 settlement 引用** —— 有专断言）。
  //   ★ 白名单按【结构】放行：只放行**带来源标记的行**（来源/值:/口径/分歧/边界），裸的资金量级文案照样被抓。
  { rule: 'R4', file: 'src/establishmentInvest.mjs', allow: /来源|值: ?'|口径:|分歧|边界:/, why: '筹建档位的【来源表】与逐项来源标注（引用公开来源原值：迈点档次区间/机电金额/筹建占比）—— 属参考资料口径，非资金量级；结构性放行只认带来源标记的行' },
  { rule: 'R4', file: 'src/decisions.js', allow: /150万/, why: '「投150万改造」是决策文案（改造费按每周 2000 元计），属每周/单次科目，不参与 ×m' },
  { rule: 'R4', file: 'src/attrs.js', allow: /150万/, why: '同上：决策 ID 字符串「投150万改造」的属性表键名，不可改（改了属性映射就断）' },
  { rule: 'R4', file: 'src/settlement.js', allow: /150万/, why: '同上：决策 ID 字符串比较（decisions.renovation === \'投150万改造\'），改名会破坏决策映射' },
  // ★ 返修⑤(a) 死条目自检当场抓到并删除（2026-09-27）：
  //   原条目 `{ file: 'src/Establishment.jsx', allow: /150万/, why: '筹建期教学文案…' }`
  //   实测该文件已【不含任何 N万 文本】（D-1 把投资情景的 note 拆成 摘要/note 后，那段话术已不在）
  //   ⇒ 按扫描器自己的判据「对应写法已消失 ⇒ 删条目」删除。这类"白名单腐烂"正是 BL-11 族。
  { rule: 'R6', file: 'src/App.jsx', why: '资金卡 (cap/10000).toFixed(1) 显示为"万" —— 纯展示换算，量级已随口径更新' },
  { rule: 'R6', file: 'src/WeeklyReport.jsx', why: '资金/营收显示为"万" —— 纯展示换算（预警线金额亦由 SCALE.变黄线 / 10000 推导，非写死）' },
  { rule: 'R6', file: 'src/TeacherDashboard.jsx', why: '教师端金额显示为"万" —— 纯展示换算' },
  { rule: 'R6', file: 'src/FinalResult.jsx', why: '成绩单金额显示为"万" —— 纯展示换算' },
  { rule: 'R6', file: 'src/HotelStatus.jsx', why: '经营页金额显示为"万" —— 纯展示换算' },
  { rule: 'R6', file: 'src/BrandSelection.jsx', why: '启动资金文案 SCALE.IC_NEW / 10000 显示为"万" —— 纯展示换算（值来自单源常量，不是写死数字）' },
  { rule: 'R6', file: 'src/metricDefs.mjs', why: 'wan2() 是【金额→万】的展示换算工具函数本身（GOP/净利润显示用）—— 它就是要 /10000' },
  // W4-4 补登（★ 记账：W3 那批加的两个模块引入了 3 处未登记命中 —— 说明"量级/单位类改动必跑扫描"这条
  //   纪律我当时漏执行了；扫描器不在门禁内是 D26 的既定设计，只能靠这条纪律 + 本白名单）
  { rule: 'R6', file: 'src/Claim.jsx', why: '认领页的万元展示助手（万元()/fmtLine()）—— 纯展示换算（报价单/一页钱账把元转成"万"），值本身来自单源模块' },
  { rule: 'R6', file: 'src/propertyQuote.mjs', why: '报价单"加盟费下限"备注文案里的 元→万 换算（仅为把 18 万这类下限读顺眼）—— 展示用，不参与任何计算' },
  // 2026-09-27 选址数据任务：选址页新增「人流/经济」行 —— 那里的 /10000 是【人口·游客数的万/亿展示换算】，
  //   与酒店资金量级无关（值来自 LOCATION_PROFILE 的统计口径）⇒ 按展示换算放行。
  { rule: 'R6', file: 'src/SiteSelection.jsx', why: '人口/游客数的万·亿展示换算（选址页人流/经济行）—— 不是资金量级' },
  // §16.2-B5（2026-09-28）：筹建页投资项显示为万（合计投资/装修额）—— 纯展示换算，
  //   金额本身来自 establishmentInvest（锚定 franchiseModel 的官方单房造价），不是写死的资金量级。
  { rule: 'R6', file: 'src/Establishment.jsx', why: '筹建页投资项显示为"万"（合计投资/装修额 /10000）—— 纯展示换算，金额锚在官方单房造价上' },
  // §22.2-B2（2026-09-29）：加盟费用条款的万元展示（一次性费用清单金额 /10000）—— 纯展示换算，
  //   金额来自 franchiseModel 三件套（有来源），不是写死的资金量级。
  { rule: 'R6', file: 'src/franchiseFees.mjs', why: '加盟费用条款的万元展示（一次性费用/保证金 /10000）—— 纯展示换算，金额来自 franchiseModel 单源' },
  { rule: 'R5', file: 'src/App.jsx', why: 'isLow/isCritical 的定义行本身；阈值已改引 SCALE.变黄线/变红线（W2 收尾单源）—— 命中是定义处不可免' },
  { rule: 'R3', file: 'src/stateMigration.mjs', allow: /IC_OLD/, why: 'D25 迁移公式自带常量 IC_old = 500,000 —— 它【必须】是旧起始资金本身（公式就是 capital_new = IC_new + (capital_old − IC_old) × m）。这不是"残留的旧口径"，恰恰是用来做换算的基准值' },
  { rule: 'R4', file: 'src/siteLocations.mjs', allow: /./, why: '区县统计文案里的"万"（120万㎡ / 608万游客 / 34万人口 / 3-5万游客 等）—— 与酒店资金量级无关，是区位调研数据的量词' },
  { rule: 'R4', file: 'src/TeacherDashboard.jsx', allow: /50万|30万|10万/, why: 'P3-2 修正后的正确分段文案（≥50万=100分 / ≥30万=85 / ≥10万=70）' },
  // ★ 本条原为「R4/WeeklyReport：allow 100.4 万（P3-1 修正后的正确预警线文案）」——
  //   2026-09-27 W2 收尾发现它是【死条目 + 假理由】：IC 已由 502万 改为 149万，
  //   100.4 万不再是"正确预警线"，且该文案已改由 SCALE.变黄线 推导 ⇒ 删除本条。
  //   防复发：tests/capital-single-source.test.mjs 会抓「写死的资金量级」。
]

const files = readdirSync(SRC).filter(f => /\.(js|jsx|mjs)$/.test(f) && !f.startsWith('settle-old'))
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')

if (process.argv.includes('--list')) {
  console.log('白名单（可复用，人工复核理由用）：')
  WHITELIST.forEach(w => console.log(`  [${w.rule}] ${w.file}\n      ${w.why}`))
  process.exit(0)
}

// ── W4-4 增强：--json（机器消费）+ --since <ref>（限定扫描范围）────────────────
//   用法：node tests/_scan-stale-scale.mjs --json
//         node tests/_scan-stale-scale.mjs --since <commit|HEAD~1>
//   自检（见 tests/scannerTools.test.mjs）：--json 可 JSON.parse；--since 结果 ⊆ 全量结果
const JSON_OUT = process.argv.includes('--json')
const SINCE = (() => { const i = process.argv.indexOf('--since'); return i >= 0 ? (process.argv[i + 1] || null) : null })()
let scanned = files, sinceList = null
if (SINCE) {
  // 只看该 ref 之后【改动过的 src 文件】（git 一律 spawnSync + shell:false，AGENTS.md：shell git 会超时）
  const r = spawnSync('git', ['diff', '--name-only', SINCE, '--', 'src/'], { cwd: APP_DIR, encoding: 'utf8', shell: false })
  if (r.status !== 0) {
    console.error('✗ --since ' + SINCE + ' 无法解析：' + String(r.stderr || '').trim().slice(0, 160))
    process.exit(2)
  }
  sinceList = (r.stdout || '').trim().split(/\r?\n/).filter(Boolean).map(p => p.replace(/^src\//, ''))
  scanned = files.filter(f => sinceList.includes(f))
}

const hits = []
for (const f of scanned) {
  const path = 'src/' + f
  const code = strip(readFileSync(new URL(f, SRC), 'utf8'))
  const lines = code.split('\n')
  for (const rule of RULES) {
    for (let i = 0; i < lines.length; i++) {
      if (rule.guard && rule.guard.test(lines[i])) continue
      const m = lines[i].match(rule.re)
      if (!m) continue
      const full = lines[i].trim()
      hits.push({ rule: rule.id, desc: rule.desc, file: path, line: i + 1, text: full.slice(0, 96), raw: full, n: m.length })
    }
  }
}
// ★ allow 对【完整行】判定（raw），展示才用截断的 text —— 这是扫描器自身的一个 bug 修正：
//   原先拿截断文本去匹配，长行里的白名单字样被切掉 → 误报为"真残留"
const wl = (h) => WHITELIST.some(w => w.rule === h.rule && w.file === h.file && (!w.allow || w.allow.test(h.raw)))
const 留 = hits.filter(wl), 真 = hits.filter(h => !wl(h))

// ★ 返修⑤(a)：白名单【死条目】自检 —— 声明了却从不命中 = 白名单腐烂（BL-11 族）
//   判据：某条白名单在本轮扫描里【一条都没匹配到】⇒ 要么对应写法已消失（该删），
//   要么规则写错（该修）—— 两种都该被人看见，不许静默留着。
const wUsed = WHITELIST.map(() => 0)
hits.forEach(h2 => {
  const i = WHITELIST.findIndex(w => w.rule === h2.rule && w.file === h2.file && (!w.allow || w.allow.test(h2.raw)))
  if (i >= 0) wUsed[i]++
})
const 死条目 = WHITELIST.map((w, i) => ({ w, i, 用次: wUsed[i] })).filter(x => x.用次 === 0)

// ── W4-4：--json 供机器消费（自检要求"可 JSON.parse"；字段与文本模式同源）──
if (JSON_OUT) {
  console.log(JSON.stringify({
    scan: 'P3-5 全库旧口径残留扫描',
    scope: { dir: 'src/', since: SINCE, scannedFiles: scanned.length, totalFiles: files.length, sinceFiles: sinceList },
    rules: RULES.map(r => ({ id: r.id, desc: r.desc })),
    命中: hits.length, 白名单: 留.length, 真残留: 真.length, 死条目: 死条目.map(d => d.w.rule + " " + d.w.file),
    residual: 真.map(h => ({ rule: h.rule, file: h.file, line: h.line, text: h.text })),
    whitelisted: 留.map(h => ({ rule: h.rule, file: h.file, line: h.line })),
  }, null, 2))
  process.exit(真.length ? 1 : 0)
}

console.log('▶ P3-5 全库旧口径残留扫描')
console.log(`  扫描范围：src/ 共 ${scanned.length} 个模块${SINCE ? `（--since ${SINCE} ⇒ 只扫改动过的 ${sinceList.length} 个）` : '（全量）'}（已排除 settle-old-* 快照、已剥注释）`)
console.log(`  规则 ${RULES.length} 条：${RULES.map(r => r.id).join(' ')}`)
console.log(`  命中 ${hits.length} 处 → 白名单（可留，带理由）${留.length} 处 · 【真残留 ${真.length} 处】\n`)

if (留.length) {
  const byFile = {}
  留.forEach(h => { const k = h.rule + ' ' + h.file; (byFile[k] = byFile[k] || []).push(h) })
  console.log('── 白名单命中（可留）──')
  for (const [k, arr] of Object.entries(byFile)) {
    const w = WHITELIST.find(x => x.rule === arr[0].rule && x.file === arr[0].file)
    console.log(`  ✅ [${arr[0].rule}] ${arr[0].file} × ${arr.length}`)
    console.log(`     理由：${w.why}`)
  }
  console.log('')
}

if (真.length) {
  console.log('── 🔴 真残留（需修）──')
  真.forEach(h => console.log(`  ✗ [${h.rule}] ${h.file}:${h.line}  ${h.text}\n     规则：${h.desc}`))
} else {
  console.log('── ✅ 真残留 0 处 —— 旧口径已全部清除 ──')
}
// ★ 返修⑤(a)：白名单【死条目】明示（声明了却从不命中 ⇒ 白名单腐烂 = BL-11 族）
if (死条目.length) {
  console.log('── ⚠️ 白名单死条目（本轮 0 次命中 ⇒ 该删或该修）──')
  死条目.forEach(d => console.log(`  ⚠ [${d.w.rule}] ${d.w.file} —— ${d.用次} 次命中`))
  console.log('  ⇒ 对应写法若已消失，删条目；若是规则写错，修条目（不许静默留着）')
}
console.log(`\n========== 扫描结果：真残留 ${真.length} 处${死条目.length ? ` · 死条目 ${死条目.length} 条` : ''} ==========`)
// ★ 返修⑤：给 run-all 可解析的计数（已登记命中 + 用上的白名单 = 通过；未登记残留 + 死条目 = 失败）
console.log(`${留.length} 通过 / ${真.length + 死条目.length} 失败`)
process.exit((真.length + 死条目.length) ? 1 : 0)
