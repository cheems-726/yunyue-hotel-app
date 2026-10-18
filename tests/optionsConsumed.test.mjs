// V115 §1-⑤ / V118 判据（修正版 · 事件级分类）
//   ① 决策选项：每个 label 必须有消费方
//   ② 决策 id：必须被引用
//   ③ 注入事件：每个有「应对选项」的事件必须落进两类之一——
//        可执行（库里标了 应对可执行 或在 eventResponses 有映射）/ 无应对空间（事件没有 条件）
//      判据：可执行选项 + 无应对空间选项 === 全部选项；**有条件却未接映射的必须为 0**
//   ★ 修正记录（2026-10-18）：上一版把「选项 label」当事件 id 传给 应对可执行Of ⇒ 全部判 0，
//     得出"102 个全不可执行"的错结论。这是**扫描器的参数 bug**，不是产品状态。
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { decisions } from '../src/decisions.js'
import { 注入事件库 } from '../src/teacherEvents.mjs'
import { 应对映射 } from '../src/eventResponses.mjs'

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

// ③ 注入事件（事件级）
let 应对总数 = 0, 可执行选项 = 0, 无空间选项 = 0, 待映射选项 = 0
const 待映射 = [], 无空间事件 = [], 可执行事件 = []
for (const e of 注入事件库 || []) {
  const 选 = e.应对选项 || []
  if (!选.length) continue
  const 可执行 = !!e.应对可执行 || !!应对映射[e.id]
  const 无条件 = !e.条件
  if (可执行) 可执行事件.push(e.id)
  else if (无条件) 无空间事件.push(e.id)
  else if (!待映射.includes(e.id)) 待映射.push(e.id)
  for (const o of 选) {
    应对总数++
    if (可执行) 可执行选项++
    else if (无条件) 无空间选项++
    else 待映射选项++
  }
}
ok(待映射选项 === 0, '有条件却未接映射的选项必须为 0（实得 ' + 待映射选项 + ' · 事件 ' + 待映射.join(',') + '）')
ok(可执行选项 + 无空间选项 === 应对总数, '可执行 ' + 可执行选项 + ' + 无应对空间 ' + 无空间选项 + ' = 全部 ' + 应对总数)
ok(可执行选项 > 0, '可执行选项必须 > 0（E8 的危机分支至少能让一类真生效）')

console.log('══ V115 §1-⑤ / V118 应对分类 ══')
console.log('  决策 ' + (decisions || []).length + ' 条 / 选项 ' + 选项数 + ' 个')
console.log('  注入事件 · 应对选项 ' + 应对总数 + ' 个 ⇒ 可执行 ' + 可执行选项 + '（事件 ' + 可执行事件.join('/') + '）'
  + ' + 无应对空间 ' + 无空间选项 + '（' + 无空间事件.length + ' 个纯环境事件）· 待映射 ' + 待映射选项)
// ★ 可执行还要分两半：引擎**真吃得到**的 vs **映射已定义但需扩引擎**
{
  const 需扩 = 可执行事件.filter(id => (应对映射[id] || {}).通道 === '需扩引擎')
  const 需扩选项 = 需扩.reduce((a, id) => a + ((注入事件库.find(e => e.id === id) || {}).应对选项 || []).length, 0)
  console.log('  ├─ 引擎真吃得到：' + (可执行选项 - 需扩选项) + ' 个（事件 ' + 可执行事件.filter(id => !需扩.includes(id)).join('/') + ' · 走已有危机分支）')
  console.log('  └─ 映射已定义但需扩引擎：' + 需扩选项 + ' 个（事件 ' + 需扩.join('/') + ' · 士气/定额成本/属性 无出口）')
}
for (const b of 坏.slice(0, 8)) console.log('  ✗ ' + b)
console.log('结果: ' + (检查数 - 坏.length) + ' 通过 / ' + 坏.length + ' 失败')
process.exit(坏.length === 0 ? 0 : 1)
