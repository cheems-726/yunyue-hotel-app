// 批次 B2.5 · `!= null` 模式守门（★ 方法学修正：按【写法】扫，不按【想到的输入】探）
// 运行：node tests/nullGuardPattern.test.mjs   （已挂 run-all）
//
// ── 为什么要这个套件 ────────────────────────────────────────────
// B2-1 我用"逐个探想到的输入"来判"同类是否只有一处漏网"，结论是错的：
//   · 漏掉了 settlement.js:227（prevGoodRate != null → 除法）
//   · 也漏掉了 settlement.js:471（decisions.energy != null → 加减乘）
// 根因不在"探得不认真"，而在【探测方式】：我探的是输入，不是写法。
// ⇒ 本套件改为【扫全库的这种写法】，逐处判定：
//     · 被守卫的值流入【算术】（+ - * /）→ 必须是【有限性守卫】（Number.isFinite），否则报错
//     · 只用于【比较 / 存在性判断 / 格式化】→ 安全（NaN 比较恒 false，不会污染）
//   白名单只放"确属安全"的，且每条必须写理由。
//
// ★ 附带教训：`!= null` 拦不住 NaN/Infinity —— 因为 typeof NaN === 'number'。
import { readFileSync, readdirSync } from 'node:fs'

const SRC = new URL('../src/', import.meta.url)
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const files = readdirSync(SRC).filter(f => /\.(js|jsx|mjs)$/.test(f) && !f.startsWith('settle-old'))
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, ''))

// 找出所有 `X != null` / `X !== null`，并判断该行的【守卫值】是否流入算术
const GUARD_RE = /\b([A-Za-z_$][\w$.]*(?:\[[^\]]+\])?)\s*(!=|!==)\s*null\b/g
// 算术判定：/ * - 一律算算术；`+` 需排除【字符串拼接】（相邻引号/反引号/模板串）
//   —— 修掉上一版的两个假阳性：`satisfaction + '%'`、`' · 综合' + comp + '分'` 是拼串，不是加法
const QUOTE = "[\u0027\u0022\u0060]"
const ARITH_RE = (v) => {
  const esc = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(
    '(?<!Number\\.isFinite\\()\\b' + esc + '\\b\\s*[-*/]' +     // X 后跟 - * /
    '|[-*/]\\s*' + esc + '\\b' +                                       // - * / 后跟 X
    '|\\b' + esc + '\\b\\s*\\+(?!\\s*' + QUOTE + ')' +               // X + 非字符串
    '|(?<!' + QUOTE + ')\\+\\s*' + esc + '\\b'                        // 非字符串 + X
  )
}

const hits = []
for (const f of files) {
  const lines = strip(readFileSync(new URL(f, SRC), 'utf8'))
  lines.forEach((line, i) => {
    let m
    GUARD_RE.lastIndex = 0
    while ((m = GUARD_RE.exec(line))) {
      const v = m[1]
      // 排除 DOM/存储类（本项目在 UI 里用 null 表示"未加载"，与数值无关）
      if (/^(localStorage|document|window)\./.test(v)) continue
      hits.push({ file: f, line: i + 1, v, text: line.trim(), arith: ARITH_RE(v).test(line) })
    }
  })
}

// 白名单：确属安全 + 理由（每条必须写清"为什么安全"）
// 白名单 = 【逐处】声明：file + 行匹配 + 理由。★ 不再整文件放行 ——
//   整文件放行会让"同文件将来新增的危险写法"被一起放掉（B1.5 那次教训同款：白名单要按结构/具体位置放行）
const SAFE_WHY = [
  {
    file: 'App.jsx', match: /prevV != null && prevV > 0/,
    why: '有额外的 `prevV > 0` 兜底：NaN > 0 恒为 false ⇒ 走 else 返回 null，除法不会执行。且属 UI 环比展示，不回流结算',
  },
  {
    file: 'settlement.js', match: /energy != null\) perRoomVariable/,
    why: 'energy 已在 settle() 入口归一化（非有限 → null）⇒ 此处 `energy != null` 为假时整段不执行，NaN 进不来。本批已实测：energy = NaN/Infinity/"abc" 三种输入下 totalCost/profit/capital/gop 全部有限',
  },
  {
    file: 'settlement.js', match: /energy != null \? \(energy - 21\)/,
    why: '同上（weeklyExpenses 水电网展示项）；入口归一化后 energy 只可能是有限数或 null',
  },
  {
    file: 'TeacherDashboard.jsx', match: /' · 综合' \+ comp/,
    why: '模板串内的【字符串拼接】而非数字加法；即使 comp 为 NaN 也只是显示 "综合NaN分"，不参与任何计算',
  },
]

// 逐处匹配：命中行必须能被某条白名单的 match 命中
const whitelisted = (h) => SAFE_WHY.some(w => h.file === w.file && w.match.test(h.text))

const unguarded = hits.filter(h => h.arith)

console.log('▶ 批次 B2.5 · `!= null` 模式守门（按写法扫，不按输入探）')
console.log(`  扫描 ${files.length} 个模块（含 .jsx）· 命中 \`!= null\` / \`!== null\` 共 ${hits.length} 处`)
console.log(`  其中【被守卫值流入算术】的 ${unguarded.length} 处 —— 这类才是危险写法\n`)

console.log('[1] 危险写法：算术类必须用有限性守卫（或整文件在白名单并写明理由）')
{
  const bad = unguarded.filter(h => !whitelisted(h))
  for (const h of unguarded) {
    const tag = whitelisted(h) ? '✅ 白名单' : '🔴 需修'
    console.log(`     ${tag}  ${h.file}:${h.line}  ${h.text.slice(0, 88)}`)
  }
  ok(bad.length === 0, `算术类命中 ${unguarded.length} 处，全部已守（未守 ${bad.length} 处）${bad.length ? ' → ' + bad.map(b => b.file + ':' + b.line).join(', ') : ''}`)
}

console.log('\n[2] ★ 具体回归：两处已修的历史漏网必须保持有限性守卫')
{
  const rd = (f) => strip(readFileSync(new URL(f, SRC), 'utf8')).join('\n')
  const st = rd('settlement.js')
  ok(/Number\.isFinite\(prevGoodRate\)/.test(st), 'settlement.js：prevGoodRate 用 Number.isFinite 守卫（B2.5 修）')
  ok(/Number\.isFinite\(prevcCapital\)/.test(st) === false && /Number\.isFinite\(prevCapital\)/.test(st),
    'settlement.js：prevCapital 用 Number.isFinite 守卫（B2 修）')
  // ⚠️ 特意【不】写"已无该写法"：`:386` 是纯比较（prevGoodRate >= 阈值）⇒ 按规则【安全】，不该被要求改。
  //    判据只针对【算术用法】——:227 的除法必须已守。
  const arithLines = st.split('\n').filter(l => /prevGoodRate/.test(l) && /prevGoodRate\s*\/|\/\s*prevGoodRate/.test(l))
  ok(arithLines.length > 0 && arithLines.every(l => /Number\.isFinite\(prevGoodRate\)/.test(l)),
    `settlement.js：prevGoodRate 的【算术用法】已守（除法行 ${arithLines.length} 条全部带 Number.isFinite）`)
  ok(!/energy\s*!=\s*null/.test(st) || /Number\.isFinite\(Number\(energy/.test(st) || /const energy = Number\.isFinite/.test(st),
    'settlement.js：decisions.energy 已归一化（非有限 → null，不流入算术）')
  // 反向：不得为了过门禁而"放宽"—— 守卫必须真在，不是换了个名字
  ok(!/Number\.isFinite\(prevGoodRate\)\s*\?\s*Number\.isFinite\(prevGoodRate\)/.test(st), '未出现"守卫套守卫"的凑数写法')
}

console.log('\n[3] 行为验证：非有限入参不得污染任何输出字段（全字段深扫）')
{
  const { settle } = await import('../src/settlement.js')
  const B = { site: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }, brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }, decisions: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗' }, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } }
  const scan = (o, p = '$', out = []) => {
    if (typeof o === 'number') { if (!Number.isFinite(o)) out.push(p); return out }
    if (o === undefined) { out.push(p + '(undefined)'); return out }
    if (o === null || typeof o !== 'object') return out
    for (const [k, v] of Object.entries(o)) scan(v, `${p}.${k}`, out)
    return out
  }
  const CASES = [
    ['prevCapital = NaN/Inf/−Inf', { prevCapital: NaN }, { prevCapital: Infinity }, { prevCapital: -Infinity }],
    ['prevGoodRate = NaN/Inf', { prevGoodRate: NaN }, { prevGoodRate: Infinity }],
    ['energy = NaN/Inf/"abc"', { decisions: { ...B.decisions, energy: NaN } }, { decisions: { ...B.decisions, energy: Infinity } }, { decisions: { ...B.decisions, energy: 'abc' } }],
    ['attrs = NaN', { attrs: { quality: NaN, reputation: NaN, morale: NaN } }],
    ['pendingNegatives/resolvedCount = NaN', { pendingNegatives: NaN }, { resolvedCount: NaN }],
  ]
  let bad = 0
  for (const [name, ...patches] of CASES) {
    for (const p of patches) {
      const r = settle({ ...B, ...p })
      // price 允许 null（一期不参与计算）；dailySnapshots.price 同理
      // 排除项（都不是"污染"，而是本来就允许的）：
      //   · *.price：ADR 一期不参与计算，允许 null
      //   · $.decisions.*：入参被原样回显（`decisions: {...decisions}`），不是计算产物
      const nans = scan(r).filter(x => !/\.price$/.test(x) && !/^\$\.decisions(\.|\[)/.test(x))
      const key = ['revenue', 'totalCost', 'profit', 'capital', 'gop', 'occupancy', 'goodRate', 'finalGoodRate'].filter(k => !Number.isFinite(r[k]))
      if (nans.length || key.length) { bad++; console.log(`     ⚠ ${name} → 深扫命中 ${nans.length} 处；关键字段异常 [${key.join(',')}]`) }
    }
  }
  ok(bad === 0, `${CASES.reduce((a, c) => a + c.length - 1, 0)} 种非有限入参组合：输出全字段深扫 0 命中`)
}

console.log('\n[4] 白名单质量：每条必须写清理由（不许空理由/凑数）')
{
  ok(SAFE_WHY.length > 0, `白名单 ${SAFE_WHY.length} 条`)
  ok(SAFE_WHY.every(w => w.file && w.why && w.why.length >= 20), '每条都有文件与实质理由（≥20 字）')
  // 逐处设计后：每条白名单都必须真的命中至少一处在算命中 —— 否则是死条目（说明代码变了没同步）
  const dead = SAFE_WHY.filter(w => !unguarded.some(h => h.file === w.file && w.match.test(h.text)))
  ok(dead.length === 0, `白名单无死条目（每条都命中真实命中行；死条目 ${dead.length} 条）${dead.length ? ' → ' + dead.map(d => d.file + ':' + d.match).join(' ') : ''}`)
  ok(SAFE_WHY.length === unguarded.length, `白名单条数 === 算术命中数（${SAFE_WHY.length} vs ${unguarded.length}）—— 逐处一一对应`)
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
