// V54批2 · 选项前后逻辑闭环——界面落地守门（挂 run-all fast）
// 判据（状态机表-v1 §四 缺口1/2/3 · 决策端已批准批2 · 全文案/交互级，零结算口径改动）：
//   缺口1 = 筹建/认领「上一步」带「已选内容可回改」提示（学生不知道能回改 ⇒ 不知道就不会用）
//   缺口2 = 证照排序交互真实落地：licOrder 状态 + ↑↓ 按钮 + 延误警告（为什么+怎么改）
//           + 下一步放行与警告同一判据（licOrderCorrect = 营业执照第1 且 消防先于特种证）
//   缺口3 = 选址/品牌确认副文案「本学期不可更改」（不可逆预告 · S1/S2 无反悔入口属设计）
// 可证伪：删 licOrder 状态 / 删 ↑↓ 按钮 / 把 stepSatisfied 的证照门槛改回 true ⇒ 对应断言红。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) }
}
const src = f => readFileSync(join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src', f), 'utf8')

console.log('▶ V54批2 · 前后逻辑闭环界面守门')

const est = src('Establishment.jsx')

// ① 缺口2：排序状态与 ↑↓ 交互真实存在
ok(/const \[licOrder, setLicOrder\] = useState\(\[0, 1, 2, 3, 4, 5\]\)/.test(est), '① licOrder 状态存在（初始=真实顺序）')
ok(/function moveLic\(pos, dir\)/.test(est) && /moveLic\(i, -1\)/.test(est) && /moveLic\(i, 1\)/.test(est), '① ↑↓ 按钮接线 moveLic（上移/下移各一）')
ok(/aria-label=\{`把\$\{l\.name\}上移`\}/.test(est) && /aria-label=\{`把\$\{l\.name\}下移`\}/.test(est), '① ↑↓ 按钮带 aria-label（可访问性）')
ok(/licOrder\.map\(\(li, i\)/.test(est) && !/const key = 'lic-' \+ i\b/.test(est), '① 行按 licOrder 渲染且 key 用证照下标（重排后详情标记不串行）')

// ② 缺口2：判据单源——延误警告文案 与 下一步放行 同一 licOrderCorrect
ok(/const licOrderCorrect = licOrder\[0\] === 0 && licOrder\.indexOf\(2\) < licOrder\.indexOf\(3\)/.test(est), '② 判据：营业执照第1 且 消防(idx2)先于特种证(idx3)')
ok(/if \(currentStep === 1\) return licOrderCorrect/.test(est), '② 下一步放行挂同一判据（排对才许进下一步）')
ok(est.includes('延误警告') && est.includes('把它移回第 1 位') && est.includes('调换这两张证的先后'), '② 延误警告带"为什么+怎么改"（两类排错各有解法）')
ok(est.includes('✓ 顺序合理'), '② 排对给绿色正反馈')

// ③ 判据行为抽查（与组件内联判据同式的独立复算 · 三态）
const 判据 = o => o[0] === 0 && o.indexOf(2) < o.indexOf(3)
ok(判据([0, 1, 2, 3, 4, 5]) === true, '③ 行为：真实顺序 ⇒ 放行')
ok(判据([0, 1, 3, 2, 4, 5]) === false, '③ 行为：特种证排在消防前（经典错） ⇒ 拦下')
ok(判据([1, 0, 2, 3, 4, 5]) === false, '③ 行为：营业执照不在第1位 ⇒ 拦下')

// ④ 缺口1：上一步可回改提示（认领 + 筹建两处）
ok(src('Claim.jsx').includes('（已选内容可回改）'), '④ Claim 上一步带可回改提示')
ok(est.includes('（已选内容可回改）'), '④ Establishment 上一步带可回改提示')

// ⑤ 缺口3：不可逆预告（选址 + 品牌两处）
ok(src('SiteSelection.jsx').includes('选址确认后本学期不可更改'), '⑤ 选址确认副文案：不可更改预告')
ok(src('BrandSelection.jsx').includes('品牌确认后本学期不可更改'), '⑤ 品牌确认副文案：不可更改预告')

// ⑥ 红线：本卡零结算口径改动 —— settlement.js 不得被本卡触碰（证照排序纯 UI，引擎无证照顺序入参）
const settleSrc = src('settlement.js')
ok(!settleSrc.includes('licOrder') && !settleSrc.includes('证照排序'), '⑥ 红线：引擎无证照顺序概念（UI 教学点不越界进结算）')

console.log(`结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
