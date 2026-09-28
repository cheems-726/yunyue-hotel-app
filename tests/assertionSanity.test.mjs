// §14.1 元断言 · 断言不得恒真/恒假（BL 同族：「断言恒真」= 看起来有断言、跑必过、不判任何东西）
// 运行：node tests/assertionSanity.test.mjs   （挂 run-all fast）
//
// ── 背景 ────────────────────────────────────────────────────────
//   §13 批次的 labelCoverage[4] 曾写 `ok(X === 0 || true, ...)` —— 注释说"白名单外为 0 才算红"，
//   但 `|| true` 把判据**短路掉了** ⇒ 恒真、永不失败（决策端抽查抓到）。
//   本套件把"这类写法不得再出现"变成常驻守门：全库扫 tests/** 的断言第一参数。
//
// ── 判据（只抓【能判死】的写法，宁漏勿误）────────────────────────
//   对每个 ok(...)/expect(...)/gok(...) 调用的第一参数文本做检查：
//     A1  `|| true`  /  `|| 1`）收尾或独立子句 —— 恒真
//     A2  `&& false` / `&& 0`                       —— 恒假（若有"必须失败"的断言应显式写 expect）
//     A3  `!= null` 类恒真写法出现在【断言条件】里且无其他条件 —— 只提示不算红（低置信，避免误伤合法写法）
//   白名单：逐条给理由（如"故意演示恒真给 RV 用"—— 但**门禁套件里不许有**）。
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const DIR = path.dirname(fileURLToPath(import.meta.url))
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

// 断言函数名（本仓库全部用 ok / gok；将来加 expect 一并覆盖）
const FN = /\b(?:ok|gok|expect|t|it)\s*\(/g
// 恒真/恒假片段（A1/A2）
// ⚠️ 必须加 (?![\d.])：否则 `|| 1.5` / `&& 0.08` 这类【正常数值比较】会被误判为恒真/恒假
//    （本批实测踩到：`封顶是否触发 === false && 0.08 * 占比 <= 封顶` 被当成"恒假"）
const ALWAYS_TRUE = /\|\|\s*(true|1)(?![\d.])/
const ALWAYS_FALSE = /&&\s*(false|0)(?![\d.])/

// ── §16.2-B8（D57 已拍）· A4：比较式恒真（**有限扩展 + 误伤保护**）──────────
// 背景：repoHygiene 曾写 `ok(citedByDoc.length === pngs.length || citedByDoc.length >= 0, …)` ——
//   右侧 `>= 0` 恒真 ⇒ 整条断言从不判任何东西；而 A1 只认 `|| true` 字面量 ⇒ 漏网。
// 做法（**枚举式白名单，不许泛化**）：只抓"对【必然非负】的量做必然成立的下界比较"：
//   · `X.length >= 0` · `X.length > -N`（N>0）· `X.length !== -N` · `X.length != -N`
//   ★ 为什么只认 `.length`：数组/字符串长度**在语言层就 ≥ 0** ⇒ 静态可判定恒真。
//   ★ 为什么不认普通变量（如 `n >= 0`、`count >= 0`）：变量**可能是负的** ⇒ 那是正常判据，
//     报它就是误伤。D57 裁定原文："泛化会误伤合法析取式 ⇒ 宁可漏，不可误伤"。
//   扩展新形态时的规矩：**必须是"语言层保证"的非负量**，且要同时补命中/不误伤两组自检样例。
const ALWAYS_TRUE_CMP = /\.length\s*(?:>=\s*0|>\s*-\s*\d+|!==?\s*-\s*\d+)(?![\d.])/

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (e.name.endsWith('.mjs') && !e.name.startsWith('_')) yield p   // 只扫正式套件（_*.mjs 是一次性工具）
  }
}

console.log('▶ §14.1 元断言 · 断言不得恒真/恒假（tests/** 正式套件）')

const hits = []
for (const f of walk(DIR)) {
  const src = readFileSync(f, 'utf8')
  const lines = src.split(/\r?\n/)
  // 逐行找断言调用起点；断言可能跨行 ⇒ 从该行取到调用结束的近似文本（最多向后并 6 行）
  for (let i = 0; i < lines.length; i++) {
    if (!/\b(?:ok|gok|expect)\s*\(/.test(lines[i])) continue
    let text = lines[i]
    for (let k = 1; k <= 6 && i + k < lines.length && !/\)\s*;?\s*$/.test(text); k++) text += ' ' + lines[i + k]
    // 剥掉字符串字面量（消息里的 "|| true" 字样不算）—— 粗剥：成对单/反引号内容置空
    const cond = text.replace(/`[^`]*`/g, '').replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '')
    const first = cond.slice(cond.search(/\b(?:ok|gok|expect)\s*\(/) )
    const arg1 = first.slice(first.indexOf('(') + 1)
    if (ALWAYS_TRUE.test(arg1)) hits.push({ f: path.basename(f), line: i + 1, kind: '恒真(`|| true`)', text: lines[i].trim().slice(0, 90) })
    else if (ALWAYS_FALSE.test(arg1)) hits.push({ f: path.basename(f), line: i + 1, kind: '恒假(`&& false`)', text: lines[i].trim().slice(0, 90) })
    // §16.2-B8 · A4：比较式恒真（`.length >= 0` 一类）
    else if (ALWAYS_TRUE_CMP.test(arg1)) hits.push({ f: path.basename(f), line: i + 1, kind: '恒真(比较式 `.length >= 0`)', text: lines[i].trim().slice(0, 90) })
  }
}

// 白名单：断言恒真写法的合法用途（逐条理由）。★ 门禁套件里应为空——若有，说明有人又写了死断言
const ALLOW = [
  // { file: 'xxx.test.mjs', why: '...' },
]
const 真 = hits.filter(h => !ALLOW.some(a => a.file === h.f))

ok(真.length === 0, `tests/** 正式套件无恒真/恒假断言（命中 ${hits.length} · 白名单 ${hits.length - 真.length}）`,
  真.map(h => `${h.f}:${h.line} ${h.kind}`).join(' | '))
真.slice(0, 8).forEach(h => console.error(`     ✗ [${h.kind}] ${h.f}:${h.line}  ${h.text}`))

// 自检：本套件的判据真的能抓（拿内置样例验证，不依赖"未来有人犯错"）
{
  const 样本恒真 = "ok(可疑.length === 0 || true, 'msg')"
  const 样本正常 = "ok(可疑.length === 0, 'msg')"
  const 剥 = (t) => t.replace(/`[^`]*`/g, '').replace(/'[^']*'/g, '')
  // 误伤样例（本批实测）：`=== false && 0.08 * x` 是正常合取、不是恒假
  const 样本数值 = "ok(a === false && 0.08 * b <= c, 'msg')"
  ok(!ALWAYS_FALSE.test(剥(样本数值).slice(样本数值.indexOf('(') + 1)), '判据自检：`=== false && 0.08 * x` 不被误判为恒假（数值合取合法）')
  ok(ALWAYS_TRUE.test(剥(样本恒真).slice(样本恒真.indexOf('(') + 1)) && !ALWAYS_TRUE.test(剥(样本正常).slice(样本正常.indexOf('(') + 1)),
    '判据自检：恒真样本命中、正常样本不命中（非恒真守门）')

  // ── §16.2-B8：比较式恒真的【命中样例】与【不误伤样例】—— 两组都必须验（D57 明确要求）──
  const 取arg1 = (t) => 剥(t).slice(t.indexOf('(') + 1)
  const 命中样例 = [
    "ok(a.length === b.length || a.length >= 0, 'msg')",   // repoHygiene 原来那条的同构写法
    "ok(xs.length >= 0, 'msg')",
    "ok(xs.length > -1, 'msg')",
    "ok(xs.length !== -1, 'msg')",
    "ok(xs.length != -5, 'msg')",
  ]
  const 不误伤样例 = [
    "ok(n >= 0, 'msg')",                 // ★ 普通变量：可能是负的 ⇒ 正常判据，不许报
    "ok(count >= 0, 'msg')",
    "ok(a > 0 || b > 0, 'msg')",         // ★ 合法析取式，不许报
    "ok(xs.length >= 1, 'msg')",         // 空数组时为假 ⇒ 真判据
    "ok(xs.length === 0, 'msg')",        // 正常判据
    "ok(xs.length !== 0, 'msg')",
    "ok(xs.length > -0.5, 'msg')",       // 小数 ⇒ 不是"必然成立的整数下界"写法，宁漏不误伤
  ]
  const 漏报 = 命中样例.filter(t => !ALWAYS_TRUE_CMP.test(取arg1(t)))
  const 误伤 = 不误伤样例.filter(t => ALWAYS_TRUE_CMP.test(取arg1(t)))
  ok(漏报.length === 0, `判据自检：比较式恒真 ${命中样例.length} 条样例全部命中`, 漏报.join(' | '))
  ok(误伤.length === 0, `判据自检：${不误伤样例.length} 条合法写法【一条都不误报】`, 误伤.join(' | '))
  // 这条自检本身也不许恒真：两组样例都必须非空（否则"全过"是空集合的假象）
  ok(命中样例.length >= 5 && 不误伤样例.length >= 6, '自检样例数量足够（命中 ≥5 · 不误伤 ≥6）')
}

// 反向验证靶子（报告引用）：往任意套件塞 `ok(false || true, 'RV')` ⇒ 本套件必红
console.log('     RV 方法：往任一套件加一行 ok(false || true, \'RV 临时\') ⇒ node tests/assertionSanity.test.mjs ⇒ 红 ⇒ 删除复绿')

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：谁再写 `|| true` / `&& false` 类死断言，本套件即红（§14.5 纪律②的机器化）')
process.exit(fail ? 1 : 0)
