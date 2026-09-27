// W2 收尾 · 资金三数【单源】守门（fast · 静态 + 常量自洽，无需浏览器）
// 运行：node tests/capital-single-source.test.mjs   （挂 run-all）
//
// ── 为什么需要这个套件（起因，血泪）────────────────────────────
//   W2-2 把 IC 502 万 → 149 万（D40 裁定）时，改了三处阈值/分段，但【界面里硬编码的资金量级】漏改：
//     · BrandSelection.jsx：学生可见文案「启动资金：系统统一提供约 502 万」→ 与实发 149 万矛盾
//     · WeeklyReport.jsx ：资金预警线仍写 1004000（旧 100.4 万）+ 文案「约 100.4 万」
//                          ⇒ 与资金卡的变黄线（29.8 万）两套预警线并存（同一条预警，学生看到两个数）
//     · App.jsx：阈值 298000/149000 值虽正确，但【硬编码】；同文件注释已写"随口径缩放"，靠人记得改
//   ⇒ 根因不是"忘了改"，是【没有单源】。本套件把"资金三数只能来自 SCALE"变成常驻门禁：
//     以后改 IC，只要 SCALE 一处改对，文案/阈值/守门自动跟随；谁再硬编码，这里就红。
import { readFileSync, readdirSync } from 'node:fs'
import { SCALE } from '../src/stateMigration.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')
const code = (f) => strip(src(f))

console.log('▶ W2 收尾 · 资金三数单源守门')

// ── ① SCALE 自洽：三数由 IC 推导（比例 = D40 裁决值）──────────────
console.log('\n[1] SCALE 自洽（比例来自 D40 · 决策端第 12 轮实算复核）')
{
  ok(SCALE.变黄线 === Math.round(SCALE.IC_NEW * 0.2), `变黄线 = IC × 0.2 = ${SCALE.变黄线}（黄/IC = ${(SCALE.变黄线 / SCALE.IC_NEW).toFixed(4)}）`)
  ok(SCALE.变红线 === Math.round(SCALE.IC_NEW * 0.1), `变红线 = IC × 0.1 = ${SCALE.变红线}（红/IC = ${(SCALE.变红线 / SCALE.IC_NEW).toFixed(4)}）`)
  ok(SCALE.变黄线 > SCALE.变红线 && SCALE.变红线 > 0, '三数有序：IC > 变黄线 > 变红线 > 0')
  // 零变化：App.jsx 原本硬编码的 298000/149000 与由 IC 推导的值必须一致（否则本次是改了行为，不是纯收敛）
  ok(SCALE.变黄线 === 298000 && SCALE.变红线 === 149000,
    'App.jsx 原硬编码阈值（298000 / 149000）=== 由 IC 推导值 ⇒ 阈值行为零变化', `${SCALE.变黄线}/${SCALE.变红线}`)
}

// ── ② 三处界面：必须引 SCALE，且不得再硬编码资金量级 ─────────────
console.log('\n[2] 三处界面：资金量级只能来自 SCALE')
{
  const app = code('App.jsx')
  ok(/from '\.\/stateMigration\.mjs'/.test(app) && /SCALE\.变黄线/.test(app) && /SCALE\.变红线/.test(app),
    'App.jsx：资金卡阈值引 SCALE.变黄线 / SCALE.变红线')
  ok(/const isLow = cap < SCALE\.变黄线/.test(app) && /const isCritical = cap < SCALE\.变红线/.test(app),
    'App.jsx：阈值比较式确为常量（不是形似而写死）')
  ok(!/< *298000|< *149000/.test(app), 'App.jsx：不再出现硬编码 298000/149000')
  ok(!/149 ?万|29\.8 ?万|14\.9 ?万|502 ?万/.test(app), 'App.jsx：指南文案不再写死金额（改由 SCALE 推导）')

  const wr = code('WeeklyReport.jsx')
  ok(/from '\.\/stateMigration\.mjs'/.test(wr) && /result\.capital < SCALE\.变黄线/.test(wr),
    'WeeklyReport：资金预警线引 SCALE.变黄线（与资金卡同源）')
  ok(!/1004000/.test(wr) && !/100\.4 ?万/.test(wr), 'WeeklyReport：旧的 1004000 / 「约 100.4 万」已清除')
  ok(/\$\{SCALE\.变黄线 \/ 10000\}/.test(wr), 'WeeklyReport：预警文案的金额由常量推导（不是写死数字）')
  // ★ 本批实抓（BL-10 家族）：原行把 `if (...)` 与 `forecasts.unshift({...})` 挤在一行、
  //   中间插了 `//` 注释 ⇒ 整句 unshift 从未执行，资金预警一直是死的。这里按【写法】守门。
  ok(/forecasts\.unshift\(\{ icon: '🚨'/.test(wr), 'WeeklyReport：🚨 资金预警语句是【真代码】')
  const swallowed = src('WeeklyReport.jsx').split(/\r?\n/).some(l => {
    const i = l.indexOf('//')
    // ★ 只在【注释前还有真代码】时才算"被吞"（独立说明注释里提到调用形态不算——D33：
    //   说明性注释会提到被检查的关键词，规则必须按"代码在前"限定，否则抓自己）
    return i > 0 && l.slice(0, i).trim().length > 0 && /\w+\s*\(\s*\{/.test(l.slice(i))
  })
  ok(!swallowed, 'WeeklyReport：没有"代码被行内注释吞掉"的写法（真代码 + 行内 // + 调用({ 形态）')

  const bs = code('BrandSelection.jsx')
  ok(/from '\.\/stateMigration\.mjs'/.test(bs) && /\{SCALE\.IC_NEW \/ 10000\}/.test(bs),
    'BrandSelection：启动资金文案由 SCALE.IC_NEW 推导')
  ok(!/502 ?万/.test(bs), 'BrandSelection：旧的「约 502 万」已清除（学生可见错值）')
}

// ── ③ 全库扫：旧量级字面量不得再作为资金量级出现（按写法扫）──────
console.log('\n[3] 全库扫：旧量级字面量（按写法扫，不按"想到的位置"探）')
{
  const files = readdirSync(new URL('../src/', import.meta.url)).filter(f => /\.(js|jsx|mjs)$/.test(f) && !f.startsWith('settle-old'))
  // 旧量级字面量：1004000（旧黄线）· 5020000（旧 IC）· 502000（旧红线）· 100.4/502/50.2 万文案
  const OLD = /(1004000|5020000|502000|100\.4 ?万|502 ?万|50\.2 ?万)/
  // 白名单：逐处 + 理由（不许整文件放行）
  const ALLOW = [
    { file: 'stateMigration.mjs', re: /IC_NEW: 5020000|IC_OLD: 5020000/, why: 'v1→v2 跳的历史基准值（D25 公式要它做换算），不是"残留旧口径"' },
    { file: 'settlement.js', re: /initialCapital = 5020000|capital < 502000/, why: '★ A 级已入待决策队列（引擎三数仍是 v2 值）；未擅改，等拍板 —— 见 4-审计与报告/待决策队列.md' },
  ]
  const hits = []
  for (const f of files) {
    code(f).split('\n').forEach((line, i) => {
      if (!OLD.test(line)) return
      const allowed = ALLOW.some(a => a.file === f && a.re.test(line))
      hits.push({ file: f, line: i + 1, text: line.trim().slice(0, 100), allowed })
    })
  }
  const 真 = hits.filter(h => !h.allowed)
  ok(真.length === 0, `旧量级字面量 0 处未豁免（豁免 ${hits.length - 真.length} 处，逐处带理由）`,
    真.map(h => `${h.file}:${h.line}`).join(', '))
  真.slice(0, 5).forEach(h => console.log(`     · ${h.file}:${h.line}  ${h.text}`))
  // 白名单质量：理由必须实质（防"凑数放行"）
  ok(ALLOW.every(a => a.why && a.why.length >= 20 && a.file && a.re), '白名单每条都有文件/正则/实质理由（≥20 字）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：谁把资金量级写回硬编码，本套件即红（fast，不用跑浏览器）')
process.exit(fail ? 1 : 0)
