// Wave 4 · D-1 守门：对象字面量【重复键】扫描（含自检 —— 扫描器必须能抓住真样例）
// 运行：node tests/noDuplicateKeys.test.mjs   （挂 run-all）
//
// 起因（D-1）：Establishment.jsx 的投资情景对象里 `note` 写了两次（短结论在前、长说明在后）
//   ⇒ JS 静默保留最后一个（短结论【从未显示】），且 vite 构建打 3 条 "Duplicate key" 警告。
//   这类缺陷属于"静默吞掉"家族（同 BL-10）：**不报错、功能少一半**。
//   ⇒ 立常驻守门：扫 src 里"同一对象字面量内的重复键"，不看构建输出也能抓。
//
// 判据（保守，宁少报不误报）：把键限定为"前面紧邻 `{` 或 `,` 的 标识符/字符串 + 冒号"形态
//   —— 这样三元 `a ? b : c`、`case 'x':`、语句标签都不会被当成键。
import { readFileSync, readdirSync } from 'node:fs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')

// 扫描器：字符级游走，按 {} / [] 维护作用域栈，逐层统计键名
export function findDuplicateKeys(code) {
  const hits = []
  const stack = []
  const lineOf = (pos) => code.slice(0, pos).split('\n').length
  let i = 0
  while (i < code.length) {
    const c = code[i]
    if (c === '{' || c === '[') { stack.push({ kind: c, keys: new Map() }); i++; continue }
    if (c === '}' || c === ']') { stack.pop(); i++; continue }
    // 键判定：前面（跳过空白）必须是 { 或 , —— 排掉三元/标签/case
    const prev = code.slice(0, i).match(/(\S)\s*$/)?.[1]
    if (stack.length && (prev === '{' || prev === ',')) {
      const m = /^(?:(\w+)|'([^']+)'|"([^"]+)")\s*:/.exec(code.slice(i, i + 80))
      if (m) {
        const name = m[1] ?? m[2] ?? m[3]
        const top = stack[stack.length - 1]
        if (top.keys.has(name)) hits.push({ line: lineOf(i), name, firstLine: top.keys.get(name), scope: top.kind })
        else top.keys.set(name, lineOf(i))
        i += m[0].length
        continue
      }
    }
    i++
  }
  return hits
}

console.log('▶ Wave 4 · D-1 守门：对象字面量重复键扫描')

// ── ① 自检：扫描器必须抓住真样例（否则是假绿）──────────────────────
console.log('\n[1] 扫描器自检（先证明它抓得住，再拿它扫全库）')
{
  const real = `const x = { key: 'inv-opt', note: '短结论', advise: 'x', changes: [{ label: 'a', value: 'b' }], note: '长说明' }`
  const h = findDuplicateKeys(real)
  ok(h.length === 1 && h[0].name === 'note', 'D-1 真样例（同对象 note 两次）被抓住', JSON.stringify(h))
  ok(findDuplicateKeys(`const y = { a: 1, b: 2 }`).length === 0, '正常对象（无重复键）不误报')
  ok(findDuplicateKeys(`const z = a ? b : c`).length === 0, '三元表达式不误报')
  ok(findDuplicateKeys(`switch (x) { case 'a': break }`).length === 0, "'case' 不误报")
  ok(findDuplicateKeys(`const q = [{ a: 1 }, { a: 2 }]`).length === 0, '两个不同对象里的同名键不误报（作用域按层）')
  ok(findDuplicateKeys(`const r = { 摘要: 's', note: 'l' }`).length === 0, '拆开命名后（摘要 + note）不误报')
}

// ── ② 全库扫 ──────────────────────────────────────────────────────────
console.log('\n[2] 全库扫：src/ 无重复键')
{
  const files = readdirSync(new URL('../src/', import.meta.url)).filter(f => /\.(js|jsx|mjs)$/.test(f) && !f.startsWith('settle-old'))
  const bad = []
  for (const f of files) {
    for (const h of findDuplicateKeys(strip(readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')))) {
      bad.push(`src/${f}:${h.line} 重复键 "${h.name}"（首次在 :${h.firstLine}）`)
    }
  }
  ok(bad.length === 0, `${files.length} 个模块全部无重复键`, bad.slice(0, 5).join(' | '))
  bad.forEach(b => console.log('     · ' + b))
}

// ── ③ 具体回归：D-1 三处必须已拆成不同名字 ───────────────────────────
console.log('\n[3] 具体回归（D-1）：投资情景三处')
{
  const est = strip(readFileSync(new URL('../src/Establishment.jsx', import.meta.url), 'utf8'))
  const 摘要数 = (est.match(/摘要:/g) || []).length
  ok(摘要数 === 3, `Establishment.jsx：三处情景各有"摘要"（短结论）= ${摘要数} 处`)
  ok(/note:\s*'乐观情景下市场承接得住/.test(est) && /note:\s*'基准情景是行业最常见假设/.test(est),
    '长说明仍保留在 note（浮层用）—— 短结论与长说明各自都有去处')
  ok(/\{s\.摘要\}/.test(est), '卡片渲染的是 摘要（原先被长文静默覆盖，从未显示）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：扫描器自检通过 + 全库 0 重复键 + D-1 三处已拆名（短结论重新可见）')
process.exit(fail ? 1 : 0)
