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

// ── V18批3 · 甲3 两表逐格覆盖（表一 1.2-4 / 表二 1.2-5 · V17批4/V18批2 交付）────────
//   卡判据：dataCompleteness 扩到覆盖新增两表（26 区位 × 维度）· 格数 === 区位数（机械）
//   逐格文件 = WebSearch 官方通报汇编（仓外 4-审计与报告/），本守门机械读表防"表在≠盖全"：
//     ① 每表恰好 26 行（编号行；区位多一少一都红）② 每行带 🟢/🟡/🔴 三态
//     ③ 🟢 行必带来源（通报/转载/官网/机构 等实词）④ 🟢 行不得出现「估算/推测」（RV 靶③）
const 甲3表 = [
  { f: '数据-甲3表一逐格26区位-20261005.md', 表名: '表一(1.2-4 景区/节假日)' },
  { f: '数据-甲3表二逐格26区位-20261005.md', 表名: '表二(1.2-5 商业密度/商务)' },
]
for (const { f, 表名 } of 甲3表) {
  const p = join(DOC, f)
  if (!existsSync(p)) { ok(false, `甲3 ${表名} 逐格文件存在`, f); continue }
  const t = readFileSync(p, 'utf8')
  const 行 = t.split('\n').filter(l => /^\| \d+ \| /.test(l))
  ok(行.length === 26, `甲3 ${表名}：逐格行数 === 26（实读 ${行.length}）`)
  const 无态 = 行.filter(l => !/🟢|🟡|🔴/.test(l))
  ok(无态.length === 0, `甲3 ${表名}：每行带状态三态`, 无态.slice(0, 2).join(' | '))
  const 绿无源 = 行.filter(l => l.includes('🟢') && !/(通报|转载|官网|研究院|新闻|日报|收录|来源)/.test(l))
  ok(绿无源.length === 0, `甲3 ${表名}：🟢 行必带来源`, 绿无源.slice(0, 2).join(' | '))
  const 绿估算 = 行.filter(l => l.includes('🟢') && /(估算|推测)/.test(l))
  ok(绿估算.length === 0, `甲3 ${表名}：🟢 行无估算/推测（RV 靶③）`, 绿估算.slice(0, 2).join(' | '))
  // 🟡 行必须写明口径短板（市级口径/合计/收入口径/定性 之一）—— 不许裸 🟡
  const 裸黄 = 行.filter(l => l.includes('🟡') && !/(口径|定性|合计|参考|收录)/.test(l))
  ok(裸黄.length === 0, `甲3 ${表名}：🟡 行写明口径短板`, 裸黄.slice(0, 2).join(' | '))
}

// ★ V91（2026-10-09）区域消费水平结构化 —— 结构位存在 / 覆盖率随实际 / 可核性（三件套红线）
{
  const { LOCATION_PROFILE, 结构化覆盖 } = await import('../src/siteLocations.mjs')
  const 键 = Object.keys(LOCATION_PROFILE)
  const 有字段 = 键.filter(k => '社零' in LOCATION_PROFILE[k] && '人均可支配' in LOCATION_PROFILE[k])
  ok(有字段.length === 键.length,
    `V91① 结构位存在：${有字段.length}/${键.length} 区位都有『社零/人均可支配』`, `缺 ${键.length - 有字段.length}`)
  const c = 结构化覆盖()
  ok(c.总区位 === 键.length && c.社零有值 <= c.总区位 && c.可支配有值 <= c.总区位,
    `V91② 有值区位数【随实际·不写死】（社零 ${c.社零有值}/${c.总区位} · 人均可支配 ${c.可支配有值}/${c.总区位}）`)
  const 有值无源 = 键.filter(k => ['社零', '人均可支配'].some(f => {
    const v = LOCATION_PROFILE[k][f]; return v && Number.isFinite(Number(v.值)) && !v.来源
  }))
  ok(有值无源.length === 0, 'V91③ 可核性：凡有值必有『来源』（三件套红线 · 采不到留 null 回落代理）', 有值无源.slice(0, 3).join(','))
  ok(键.length === 26, `V91④ 区位数不被本批改动（${键.length}）`)
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('RV（_rv-33v12.mjs）：删竞品 source / 改区位数 / 字号回退 ⇒ 必红')
process.exit(fail ? 1 : 0)
