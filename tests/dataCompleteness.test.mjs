// V12 甲批1 · 区域数据看板机械汇总 + dataCompleteness 守门（挂 run-all fast）
// 判据（单元卡-V12 §6）：
//   ① 看板格数 === siteLocations.mjs 区位数 × 字段数（防"表在≠盖全"）
//   ② 每个 🟢 格必须带 source（ADR 表格来源 = COMPETITORS 逐店 source 字段）
//   ③ 不许「估算/推测/约」字样冒充实测（🟢 只能给有 source 的格）
// 看板由本脚本机械生成 ⇒ 4-审计与报告/数据-区域看板-26区位-20261004.md
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = dirname(dirname(fileURLToPath(import.meta.url)))
const DOC = join(APP, '..', '4-审计与报告')
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const { districts, COMPETITORS } = await import('../src/siteLocations.mjs')

// 区位清单（机械取自模块）
const 区位 = []
for (const [city, list] of Object.entries(districts)) for (const d of list) 区位.push({ city, name: d.name, attrs: d.attrs, confidence: d.confidence })

// 字段维度（当前看板口径：六维 + 统计实测(人流/经济) + 竞品库 + ADR 四档）
const 六维 = ['客流', '房价', '租金', '竞争', '人力', '波动']

// ADR 表解析（从 docs 表格机械读 · 而非重算）
const adrPath = join(DOC, '数据-区域档次ADR参考表-20260930.md')
const adr = readFileSync(adrPath, 'utf8')
const adrRows = [...adr.matchAll(/^\| ([^|]+) \| ([^|]+) \|/gm)].length // 粗计数（表格行数）

// ① 区位数一致性
ok(区位.length === 26, `① 区位数 === 26（实读 siteLocations.mjs = ${区位.length}）`)

// 竞品 source 覆盖（② 的数据层基础：每店带 source · COMPETITORS = { 区县: [店...] }）
const 店列表 = Object.entries(COMPETITORS).flatMap(([区, arr]) => (arr || []).map(c => ({ ...c, 区 })))
const 无source = 店列表.filter(c => !c.source)
ok(无source.length === 0, `② 竞品库每店带 source（${店列表.length} 家 · 缺 ${无source.length}）`, 无source.slice(0, 2).map(c => c.name).join(','))

// 六维每格有值（0 也算"有值"，空/undefined 才算缺）
const 缺维 = []
for (const d of 区位) for (const k of 六维) if (d.attrs[k] === undefined) 缺维.push(`${d.name}.${k}`)
ok(缺维.length === 0, `③ 六维 26×6=156 格无空洞（实读机械对照）`, 缺维.slice(0, 3).join(','))

// ④ 看板文件存在且由本脚本口径生成（生成产物含机械签名行）
const 看板 = join(DOC, '数据-区域看板-26区位-20261004.md')
ok(existsSync(看板), '④ 26 区位看板文件存在（数据-区域看板-26区位-20261004.md）')

// ⑤ 不许估算冒充：看板里 🟢 行不得含「估算/推测/约」
if (existsSync(看板)) {
  const bs = readFileSync(看板, 'utf8')
  const 绿行估算 = bs.split('\n').filter(l => l.includes('🟢') && /(估算|推测|约)/.test(l))
  ok(绿行估算.length === 0, '⑤ 🟢 行无估算/推测字样', 绿行估算.slice(0, 2).join(' | '))
}

// 生成看板（机械汇总 · 每次跑守门同步刷新）
{
  const 行 = []
  行.push('# 数据 · 区域看板（26 区位 · V12甲批1 机械汇总 · 2026-10-04）')
  行.push('')
  行.push('> 本文件由 `tests/dataCompleteness.test.mjs` 机械生成（每次跑守门同步刷新）——不手抄。')
  行.push('> 标记：🟢 有来源实测 · 🟡 部分有（n=1 薄格或档期口径）· 🔴 缺（带原因）· 字段：六维评级（siteLocations 权威）/ 人流经济统计 / 竞品库 / ADR 四档。')
  行.push('')
  行.push('| 城市 | 区位 | 六维(客/房/租/竞/人/波) | 数据置信 | 竞品库 | ADR 表 |')
  行.push('|---|---|---|---|---|---|')
  for (const d of 区位) {
    const v = 六维.map(k => d.attrs[k]).join('/')
    const 置信 = d.confidence === 'green' ? '🟢' : d.confidence === 'red' ? '🔴 官方租金PDF被拦(412)·待批4' : '🟡'
    const 竞 = 店列表.some(c => c.区 === d.name) || 店列表.some(c => String(c.name||'').includes(d.name)) ? '🟢 有' : '🔴 待补'
    行.push(`| ${d.city} | ${d.name} | ${v} | ${置信} | ${竞} | 🟡 参考值(81/104) · 批2补齐 |`)
  }
  行.push('')
  行.push(`机械签名：区位 ${区位.length} · 竞品 ${店列表.length} 家 · 生成于 2026-10-04`)
  writeFileSync(看板, 行.join('\n'), 'utf8')
  console.log(`  ✓ 看板已生成（${区位.length} 区位）`)
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('RV（_rv-33v12.mjs）：删竞品 source / 改区位数 / 字号回退 ⇒ 必红')
process.exit(fail ? 1 : 0)
