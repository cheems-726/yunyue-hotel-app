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
import { settle } from '../src/settlement.js'   // A-2：行为边界断言（资金起点/预警线）

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
  // 🔴 A-2（2026-09-27 · D47-f）：原第 2 条（豁免 settlement.js 的 `initialCapital = 5020000`）已【删除】——
  //   该写法已随 A-2 单源化消失。留着它就是"白名单腐烂"（BL-11 族），故本套件同时加【死条目自检】。
  const ALLOW = [
    { file: 'stateMigration.mjs', re: /IC_NEW: 5020000|IC_OLD: 5020000/, why: 'v1→v2 跳的历史基准值（D25 公式要它做换算），不是"残留旧口径"' },
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
  // ★ 死条目自检（与 _scan-stale-scale 同族）：声明了却一次都没命中 = 白名单腐烂，必须有人看见
  const 死 = ALLOW.map(a => ({ a, n: hits.filter(h => h.allowed && h.file === a.file).length })).filter(x => x.n === 0)
  ok(死.length === 0, `白名单无死条目（每条都至少命中一次）`, 死.map(x => x.a.file).join(','))
}

// ── ④ A-2：引擎资金三数单源 —— 静态 + 【行为】双证（BL-13 通则在资金侧的落点）──
console.log('\n[4] A-2 引擎侧：initialCapital / isWarning 真的取自 SCALE（不是"看起来像"）')
{
  const s = code('settlement.js')
  ok(/import \{ SCALE \} from '\.\/stateMigration\.mjs'/.test(s) && /const initialCapital = SCALE\.IC_NEW/.test(s),
    'settlement.js：initialCapital === SCALE.IC_NEW（单源；不再自带一份副本）')
  ok(/const isWarning = !isBankrupt && capital < SCALE\.变红线/.test(s),
    'settlement.js：isWarning 线 === SCALE.变红线（旧写法 `capital < 502000` 已消失）')
  // 行为证：不带 prevCapital 跑一周 ⇒ 资金必须以 IC 为起点（写死旧值则此断言必红）
  const 站点 = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
  const 品牌 = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
  const 决策 = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }
  const 属性 = { quality: 60, reputation: 70, morale: 65 }
  const mk = (extra) => settle({ site: 站点, brand: 品牌, decisions: 决策, week: 1, attrs: 属性, ...extra })
  const 基线 = mk({})
  ok(基线.capital === SCALE.IC_NEW + 基线.profit,
    `行为锚点：无 prevCapital ⇒ capital ${基线.capital} === IC ${SCALE.IC_NEW} + 本周利润 ${基线.profit}`)
  // 预警线【边界】：<变红线 才算预警（严格小于，含等于时不预警）
  const 等于 = mk({ prevCapital: SCALE.变红线 - 基线.profit })          // capital === 变红线
  const 低一 = mk({ prevCapital: SCALE.变红线 - 基线.profit - 1 })      // capital === 变红线 − 1
  ok(等于.capital === SCALE.变红线 && 等于.isWarning === false,
    `边界：capital === 变红线(${SCALE.变红线}) ⇒ 不预警（严格小于）`)
  ok(低一.capital === SCALE.变红线 - 1 && 低一.isWarning === true,
    `边界：capital === 变红线−1 ⇒ 预警（线和 SCALE 同一处，写死旧值必红）`)
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：谁把资金量级写回硬编码，本套件即红（fast，不用跑浏览器）')
process.exit(fail ? 1 : 0)
