// P3-5 · 全库旧口径残留扫描（可复用守门脚本）
//
// 用途：T1.1 把金额量级改了约 m 倍（m=10.0483）之后，扫 src/ 找【旧口径残留】——
//       旧阈值、旧量级字面量、"万"为单位的资金文案、预警 UI 变量、金额→万换算处。
// 运行：node tests/_scan-stale-scale.mjs           报告模式（有未豁免命中 → 退出码 1）
//       node tests/_scan-stale-scale.mjs --list    只列白名单（便于人工复核理由）
//
// ★ 判据（§十九 P3-5）：报告必须是【0 残留】或【逐条列出剩余项 + 为什么可留】
//   ⇒ 本脚本把"可留"写成带理由的白名单，命中数 - 白名单数 = 真残留。
import { readFileSync, readdirSync } from 'node:fs'

const SRC = new URL('../src/', import.meta.url)
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
  { rule: 'R4', file: 'src/decisions.js', allow: /150万/, why: '「投150万改造」是决策文案（改造费按每周 2000 元计），属每周/单次科目，不参与 ×m' },
  { rule: 'R4', file: 'src/attrs.js', allow: /150万/, why: '同上：决策 ID 字符串「投150万改造」的属性表键名，不可改（改了属性映射就断）' },
  { rule: 'R4', file: 'src/settlement.js', allow: /150万/, why: '同上：决策 ID 字符串比较（decisions.renovation === \'投150万改造\'），改名会破坏决策映射' },
  { rule: 'R4', file: 'src/Establishment.jsx', allow: /150万/, why: '筹建期教学文案（改造 150万/进度天数话术）—— 属叙述层，不进结算数值' },
  { rule: 'R6', file: 'src/App.jsx', why: '资金卡 (cap/10000).toFixed(1) 显示为"万" —— 纯展示换算，量级已随口径更新' },
  { rule: 'R6', file: 'src/WeeklyReport.jsx', why: '资金/营收显示为"万" —— 纯展示换算（预警线金额亦由 SCALE.变黄线 / 10000 推导，非写死）' },
  { rule: 'R6', file: 'src/TeacherDashboard.jsx', why: '教师端金额显示为"万" —— 纯展示换算' },
  { rule: 'R6', file: 'src/FinalResult.jsx', why: '成绩单金额显示为"万" —— 纯展示换算' },
  { rule: 'R6', file: 'src/HotelStatus.jsx', why: '经营页金额显示为"万" —— 纯展示换算' },
  { rule: 'R6', file: 'src/BrandSelection.jsx', why: '启动资金文案 SCALE.IC_NEW / 10000 显示为"万" —— 纯展示换算（值来自单源常量，不是写死数字）' },
  { rule: 'R6', file: 'src/metricDefs.mjs', why: 'wan2() 是【金额→万】的展示换算工具函数本身（GOP/净利润显示用）—— 它就是要 /10000' },
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

const hits = []
for (const f of files) {
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

console.log('▶ P3-5 全库旧口径残留扫描')
console.log(`  扫描范围：src/ 共 ${files.length} 个模块（已排除 settle-old-* 快照、已剥注释）`)
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
console.log(`\n========== 扫描结果：真残留 ${真.length} 处 ==========`)
process.exit(真.length ? 1 : 0)
