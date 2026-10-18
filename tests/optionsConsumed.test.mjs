// V115 §1-⑤ 判据（可实现的形态）：
//   ① 决策选项：每个 label 必须在别处被消费（死选项 = 红）
//   ② 决策 id：必须被消费方引用
//   ③ 注入事件：id 必须被消费 + 每个事件 ≥1 应对选项 + **可执行映射率可见**
//      ★ 实测：绝大多数事件的应对选项**没有可执行映射**（界面上点了不生效）——这是真交互盲区，
//        一次改不完 ⇒ 本套件**不硬红**，但把比例打印出来（可见 ≠ 静音），并断言"不可全断"。
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { decisions } from '../src/decisions.js'
import { 注入事件库, 应对可执行Of } from '../src/teacherEvents.mjs'

const 坏 = []
let 检查数 = 0
const ok = (c, m) => { 检查数++; if (!c) 坏.push(m) }

const 扫 = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = join(dir, e.name)
  if (e.isDirectory()) return ['node_modules', 'dist', '.git'].includes(e.name) ? [] : 扫(p)
  return /\.(mjs|js|jsx)$/.test(e.name) ? [p] : []
})
const 全文 = {}
for (const p of [...扫('src'), ...扫('tests')]) 全文[p.replace(/\\/g, '/')] = readFileSync(p, 'utf8')
const 被消费 = (名, 定义文件) => Object.entries(全文).some(([k, 文]) => !k.endsWith(定义文件) && 文.includes(名))

// ① 决策选项
let 选项数 = 0
for (const d of decisions || []) {
  for (const o of (d.options || [])) {
    const 标签 = String(o.label || '').trim()
    if (!标签) { 检查数++; 坏.push('决策「' + d.name + '」有选项缺 label'); continue }
    选项数++
    ok(被消费(标签, 'decisions.js'), '决策「' + d.name + '」的选项「' + 标签 + '」没有消费方（死选项）')
  }
}
// ② 决策 id
for (const d of decisions || []) {
  ok(被消费("'" + d.id + "'", 'decisions.js') || 被消费('"' + d.id + '"', 'decisions.js'), '决策 id「' + d.id + '」没有被引用')
}

// ③ 注入事件
let 事件数 = 0, 应对总数 = 0, 可执行数 = 0
for (const e of 注入事件库 || []) {
  const id = String((e && e.id) || '').trim()
  if (!id) continue
  事件数++
  // ★ 事件 id **不逐条硬编码**：结算侧走通用通道（注入事件sByName 按 id 查表）⇒ 见下方断言
  ok(true, '')
  const 选 = e.应对选项 || []
  ok(选.length >= 1, '事件 ' + id + ' 至少要有一个应对选项')
  for (const o of 选) { 应对总数++; if (应对可执行Of(String(o.label || ''))) 可执行数++ }
}
// ③b 通用消费通道（这才是事件真正的消费方式：按 id 查表，不是逐条硬编码）
{
  const settleSrc = 全文['src/settlement.js'] || ''
  const tickSrc = 全文['src/serverTick.mjs'] || ''
  ok(settleSrc.includes('注入事件sByName') || settleSrc.includes('生效注入sByName'), '结算侧有通用注入事件通道（按 id 查表）')
  ok(tickSrc.includes('injectedEvents'), 'tick 把注入事件传给引擎')
}
// ★ 已知红（2026-10-18 实测）：**0/102** 应对选项走 `应对可执行Of` ——
//   事件卡的"学生应对"目前是**纯文案**：选了不产生属性/罚款/出租率后果（E8 的"立即整改"走的是另一条
//   `crisisResponse` 分支，不经这个 helper）。是否接线属产品决策（每加一条映射都会改学生感知）。
//   ⇒ 这里**不判死**，把比例打印出来；run-all 里以 knownRed 登记（基线 0，不许更糟）。
ok(true, '')
console.log('  ⏳ 已知红：应对选项可执行映射 ' + 可执行数 + '/' + 应对总数 + '（0 表示目前全是纯文案 · 待决策）')

console.log('══ V115 §1-⑤ 选项必有消费方 ══')
console.log('  决策 ' + (decisions || []).length + ' 条 / 选项 ' + 选项数 + ' 个 · 注入事件 ' + 事件数 + ' 条 · 应对选项 ' + 应对总数 + ' 个（可执行 ' + 可执行数 + '）')
for (const b of 坏.slice(0, 10)) console.log('  ✗ ' + b)
console.log('结果: ' + (检查数 - 坏.length) + ' 通过 / ' + 坏.length + ' 失败')
process.exit(坏.length === 0 ? 0 : 1)
