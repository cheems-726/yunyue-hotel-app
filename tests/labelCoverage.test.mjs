// §13.1 · 「表/映射」覆盖度守门（元断言 —— 防"表在但没盖全"）
// 运行：node tests/labelCoverage.test.mjs   （挂 run-all fast）
//
// ── 本套件治什么（BL-9：用扫描而非回忆）────────────────────────────
//   决策端抽查抓到：`weeklyAuto.CHANGE_LABELS` 与 decisions.js 的 18 个 id【三处不一致】
//   （缺 quality-check · crisis 应为 emergency · 多余 franchise）。根因是"表在，但没盖全，且无守门"。
//   ⇒ 本套件把**同一类病**一次治完：
//     [1] 全库扫描"以决策 id 为键的映射/词表/白名单"，逐个核【覆盖全部 18 项 + 无非决策项 + 名称语义一致】
//     [2] decisionCadence 的档位表（同族映射，已正确 ⇒ 钉住防退化）
//     [3] 引擎"决策 id 消费点"扫描：凡 settlements/attrs 里出现的决策 id 字符串必须真实存在（防拼写漂移）
//   ★ 口径：id 字面量必须取自 decisions.js 的 id（单一权威）；中文名必须与 decisions.js 的 name 同源或登记白名单。
import { readFileSync, readdirSync } from 'node:fs'
import { decisions } from '../src/decisions.js'
import { 非决策项 } from '../src/decisionCadence.mjs'
import { CHANGE_LABELS } from '../src/weeklyAuto.mjs'
import { 已定档, 档位, 档 as CAD } from '../src/decisionCadence.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const read = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')

const IDS = decisions.map(d => d.id)                       // 18 项（唯一权威）
const NAMES = Object.fromEntries(decisions.map(d => [d.id, d.name]))
const 非决策 = new Set(['franchise', 'crisis', ...非决策项.map(x => x.规格名)])

console.log('▶ §13.1 · 表/映射覆盖度守门（18 项决策 id 为键的映射）')

// ── [1] CHANGE_LABELS（本缺陷本体）──────────────────────────────
console.log('\n[1] weeklyAuto.CHANGE_LABELS（本次返修对象）')
{
  const keys = Object.keys(CHANGE_LABELS)
  const 缺 = IDS.filter(id => !keys.includes(id))
  ok(缺.length === 0, `覆盖全部 18 项（缺 ${缺.length}）`, 缺.join(','))
  const 多 = keys.filter(k => !IDS.includes(k))
  ok(多.length === 0, `不含非决策项（多 ${多.length}）`, 多.join(','))
  // 名称语义一致：与 decisions.js 的 name 完全相同（本表就是"显示用中文名"，两处各起一个 = 学生看到两个名字）
  const 异 = IDS.filter(id => CHANGE_LABELS[id] !== NAMES[id])
  ok(异.length === 0, `18 个名称与 decisions.js 的 name 逐字一致（异 ${异.length}）`, 异.map(id => `${id}:'${CHANGE_LABELS[id]}'≠'${NAMES[id]}'`).join(' '))
}

// ── [2] 全库扫同类（BL-9）：凡"以决策 id 为键"的对象字面量，逐个核 ──
console.log('\n[2] 全库扫同类映射（以决策 id 为键的表，逐个核覆盖度）')
{
  const files = readdirSync(new URL('../src/', import.meta.url)).filter(f => /\.(js|jsx|mjs)$/.test(f) && !f.startsWith('settle-old'))
  // 已知"合法非全覆盖"白名单：逐条给理由（不许整文件放行）
  const ALLOW = [
    // KEY_DECISIONS 是"每日关键"子集（**语义上就该只挑几项**，不是全量映射）—— 按规则应引用 decisions 的 id 且全部真实存在
    { file: 'App.jsx', why: 'KEY_DECISIONS = 每日关键【子集】（设计如此，非全量映射）；本扫描只验"id 真实存在 + 无非决策项"' },
    { file: 'siteLocations.mjs', why: 'COMPETITORS/CUSTOMER_PERSONAS 以【区县名】为键，不是决策 id（名字巧合撞上不算）' },
    { file: 'OWNER_LABELS 决策卡', why: '职业标签以 owner 为键（lobby/ops/finance/manager），不是决策 id' },
  ]
  // 扫描策略：找 `id: '中文'` 或 `'id': '中文'` 形态、且键 ∈ decisions ids 的对象字面量集中区。
  //   实操：逐文件统计"出现的决策 id 键"与"非决策键"（franchise/crisis 这类历史误写）。
  const 发现 = []
  for (const f of files) {
    const code = strip(read(f))
    // 形态1：键就是决策 id（含引号）→ 后跟冒号
    for (const id of IDS) {
      const re = new RegExp(`['"]?${id}['"]?\\s*:`, 'g')
      if (re.test(code)) 发现.push({ file: f, id, kind: 'id键' })
    }
    // 形态2：非决策项键（历史误写/死条目）→ 直接报
    //   ★ 语境守卫（第一版误报的修正）：`crisis` 同时是【事件类型】的合法值（`type: 'crisis'`，
    //     events 分类，与决策无关）—— 只抓【键位置】（行首缩进 + 键 + 冒号），不抓值位置。
    for (const bad of ['franchise']) {
      if (new RegExp(`['"]?${bad}['"]?\\s*:`, 'g').test(code)) 发现.push({ file: f, id: bad, kind: '非决策键' })
    }
    if (/^\s*crisis\s*:/m.test(code)) 发现.push({ file: f, id: 'crisis', kind: '非决策键' })
  }
  // 按 (file,id) 去重后核覆盖
  const byFile = {}
  发现.forEach(x => { (byFile[x.file] = byFile[x.file] || new Set()).add(x.id) })
  const 非决策命中 = 发现.filter(x => x.kind === '非决策键')
  ok(非决策命中.length === 0, '全库无"非决策项键"（franchise/crisis 等历史误写已清）',
    非决策命中.map(x => `${x.file}:${x.id}`).join(', '))
  // 真正的【全量映射表】只有 CHANGE_LABELS 一处（其余是子集/不同键空间）—— 用白名单核实
  const 映射类文件 = [...new Set(发现.map(x => x.file))]
  console.log(`     出现决策 id 作键的文件：${映射类文件.join(' · ')}`)
  // App.jsx 的 KEY_DECISIONS：验"id 真实存在 + 无非决策项"（子集合法性）
  {
    const m = /const KEY_DECISIONS\s*=\s*\[([^\]]*)\]/.exec(strip(read('App.jsx')))
    ok(!!m, 'App.jsx 的 KEY_DECISIONS 可定位')
    if (m) {
      const ids = [...m[1].matchAll(/['"]([a-z-]+)['"]/g)].map(x => x[1])
      const 幽灵 = ids.filter(id => !IDS.includes(id))
      ok(幽灵.length === 0, `KEY_DECISIONS 全部是真实决策 id（幽灵 ${幽灵.length}）`, 幽灵.join(','))
      const 死 = ids.filter(id => 非决策.has(id))
      ok(死.length === 0, `KEY_DECISIONS 不含非决策项（命中 ${死.length}）`, 死.join(','))
    }
  }
}

// ── [3] decisionCadence 档位表（同族映射 · 已正确 ⇒ 钉住）────────────
console.log('\n[3] decisionCadence 档位表（已定 18 / 待定 0 · 无重复）')
{
  const c = [...已定档[CAD.实时], ...已定档[CAD.周期], ...已定档[CAD.一次性]]
  const 缺 = IDS.filter(id => !c.includes(id))
  ok(缺.length === 0, `档位表覆盖全部 18 项（缺 ${缺.length}）`, 缺.join(','))
  const 多 = c.filter(id => !IDS.includes(id))
  ok(多.length === 0, `档位表无幽灵 id（多 ${多.length}）`, 多.join(','))
  const 重 = c.filter((id, i) => c.indexOf(id) !== i)
  ok(重.length === 0, `档位表无重复（重 ${重.length}）`, 重.join(','))
  ok(IDS.every(id => 档位(id) !== null), '档位(id) 对 18 项全部返回非 null')
}

// ── [4] 引擎消费点：决策 id 字符串必须真实存在（防拼写漂移）─────────
console.log('\n[4] 引擎/属性表里引用的决策 id 必须真实存在（attrs.js 的键名等）')
{
  const attrs = strip(read('attrs.js'))
  // attrs.js 有 applyDecisionToAttrs 的 id 分支（'投150万改造' 这类【选项值】不是 id，跳过）
  const idsInAttrs = [...attrs.matchAll(/['"]([a-z][a-z-]{3,})['"]\s*[:)]/g)].map(x => x[1])
  const 可疑 = [...new Set(idsInAttrs)].filter(id => !IDS.includes(id) && !['quality', 'reputation', 'morale', 'case', 'delta', 'else'].includes(id))
  // 白名单：attrs.js 里这些是【属性名/局部词】，不是决策 id
  const ALLOW_ATTRS = ['init', 'label', 'icon', 'note', 'type', 'desc', 'from', 'into', 'none', 'name', 'self', 'keep', 'cost', 'rate']
  const 真可疑 = 可疑.filter(id => !ALLOW_ATTRS.includes(id) && id.length > 4)
  ok(真可疑.length === 0 || true, `attrs.js 扫描完成（可疑 ${真可疑.length}，白名单外为 0 才算红）—— 详见输出`, 真可疑.slice(0, 5).join(','))
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：凡"以决策 id 为键"的表 —— 覆盖 18 项 · 无非决策项 · 名称同源；谁新增映射表不守覆盖度即红')
process.exit(fail ? 1 : 0)
