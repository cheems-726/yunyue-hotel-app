// V94 · 区位数据「界面露出」守门（2026-10-09）
// ── 分工：dataCompleteness 管数据齐备 · locationData 管数据纪律 · 本文件管【数据 → 界面】这一段
//   三条断言 + 常驻反向自检（RV）：
//   ① 有值 ⇒ 文案/来源/取数齐；无值 ⇒ 必为「待补（无公开来源）」——**绝不允许 0 / — / 空白**
//   ② 渲染条数 === 有值区位数（**随实际算，不写死**）
//   ③ 界面接线：SiteSelection.jsx 必须**调用 区位消费行()**（单源）且**不自写**消费文案
import { LOCATION_PROFILE, 区位消费行, 格式化消费水平 } from '../src/siteLocations.mjs'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

let pass = 0, fail = 0
const ok = (c, msg, extra) => { c ? (pass++, console.log('  ✓ ' + msg)) : (fail++, console.log('  ✗ ' + msg + (extra !== undefined ? '  ← ' + extra : ''))) }

const 键 = Object.keys(LOCATION_PROFILE)
const 有值 = (o) => !!(o && Number.isFinite(Number(o.值)))

// ① 有值/无值两态文案
const 坏有值 = [], 坏无值 = []
for (const k of 键) {
  const c = 区位消费行(k), d = LOCATION_PROFILE[k]
  if (有值(d.社零) || 有值(d.人均可支配)) {
    const 齐 = c.有值 && (c.收入文本 || c.社零文本) && c.来源串 && c.取数 && !c.来源缺失
    if (!齐) 坏有值.push(k)
  } else {
    const 好 = !c.有值 && !c.收入文本 && !c.社零文本 && /待补/.test(c.待补文本) && !/^(0|—|-|\s*)$/.test(c.待补文本)
    if (!好) 坏无值.push(k)
  }
}
ok(坏有值.length === 0, '① 有值区：文案 + 来源 + 取数 齐备（缺一即红）', 坏有值.join(','))
ok(坏无值.length === 0, '① 无值区：必为「待补（无公开来源）」，不许 0 / — / 空白', 坏无值.join(','))

// ② 渲染条数 === 有值区位数（两侧各自独立算 ⇒ 不写死数字）
const 数据侧有值 = 键.filter(k => 有值(LOCATION_PROFILE[k].社零) || 有值(LOCATION_PROFILE[k].人均可支配)).length
const 文案侧有值 = 键.filter(k => 区位消费行(k).有值).length
ok(文案侧有值 === 数据侧有值, `② 渲染条数 === 有值区位数（文案侧 ${文案侧有值} · 数据侧 ${数据侧有值} · 随实际）`)

// ③ 界面接线（单源 · 防漂移）
const APP = dirname(dirname(fileURLToPath(import.meta.url)))
const jsx = readFileSync(join(APP, 'src', 'SiteSelection.jsx'), 'utf8')
const jsx无注释 = jsx.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
ok(/区位消费行\s*\(/.test(jsx无注释), '③ 界面确实调用 区位消费行()（单源出口 · 不许 JSX 另写口径/来源）')
ok(!/元\/年/.test(jsx), '③ 界面**未自写**消费文案（「元/年」字样只应出现在数据层出口里）', (jsx.match(/[^\n]*元\/年[^\n]*/) || [''])[0].slice(0, 60))
ok(/待补文本/.test(jsx), '③ 界面渲染的是数据层给出的待补文案（不是自造）')

// ④ 常驻反向自检（RV）：判定器不是恒真
const rv1 = 格式化消费水平({ 社零: { 值: 'abc', 年: 2024, 来源: 'x' } })
const rv2 = 格式化消费水平({ 社零: { 值: 100, 年: 2024, 来源: '' } })
const rv3 = 格式化消费水平({})
ok(rv1.有值 === false, '④ RV-1 非数值 ⇒ 判无值（不冒充当有值）')
ok(rv2.有值 === true && rv2.来源缺失 === true, '④ RV-2 有值但来源空 ⇒ 明确标 来源缺失（供 ① 判红）')
ok(rv3.有值 === false && /待补/.test(rv3.待补文本), '④ RV-3 空对象 ⇒ 待补）')

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：漏渲染 1 个有值区 / 把待补抹没 / 清空来源 / JSX 自写文案 ⇒ 本套件红')
process.exit(fail ? 1 : 0)
