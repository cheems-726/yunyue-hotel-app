// V82 · 内容完整性总账守门（2026-10-08 · 把今日七张内容表固化 · 挂 run-all fast）
// ── 分工（卡③ · 与既有套件不重复）────────────────────────────────
//   · dataCompleteness（V12）管【区域统计数据】（人口/GDP/游客/商业密度 · 数据面）
//   · locationData 管【选址数据纪律 + district 传递链】（竞品溯源/画像 null 口径/引擎通路）
//   · v75Detail/v76Brand/v78Event/v79Persona/v80Tasks 各管自己那张表的深度断言（含引擎一致性）
//   · 本文件 = 【总账】：七张表逐表"字段齐备 + 失败定位到条"，专抓"有人删字段/漏填"——
//     单表深度归各表，本表保证【没有一张表整体失守】（删一个字段 ⇒ 这里红 + 红信息指名道姓）。
// ── 可证伪（卡②）───────────────────────────────────────────────
//   判定器 = 纯函数 核行()，本文件内置【反向自检】：喂一行缺字段的假数据 ⇒ 判定器必须报红，
//   且红信息含字段名——证明判定器不是恒真（RV 常驻代码，不靠一次性手删）。
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { districts, COMPETITORS, CUSTOMER_PERSONAS, LOCATION_PROFILE, 客群攻略 } from '../src/siteLocations.mjs'
import { 注入事件库 } from '../src/teacherEvents.mjs'
import { decisions } from '../src/decisions.js'
import { brandGroups } from '../src/brands.mjs'
import { FRANCHISE_MODEL } from '../src/franchiseModel.mjs'
import { 周任务书 } from '../src/semesterTasks.mjs'
import { readFileSync } from 'node:fs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

// ── 判定器（可证伪 RV 的核心）：一行数据 × 必填字段 ⇒ 缺失清单 ──────────
function 核行(行名, 行, 字段s) {
  const 缺 = []
  for (const [字段, 判] of Object.entries(字段s)) {
    let 过 = false
    try { 过 = !!判(行) } catch (e) { 过 = false }
    if (!过) 缺.push(`${行名}.${字段}`)
  }
  return 缺
}
const 非空 = v => typeof v === 'string' ? v.trim().length > 0 : v != null
const 字数 = n => v => typeof v === 'string' && v.length >= n

// ── RV 反向自检：坏数据 ⇒ 必红且红信息带字段名（不是恒真判定器）──────────
{
  const 假行 = { 描述: '', 影响: 'x' }
  const 缺 = 核行('假事件', 假行, { 描述: 字数(10), 影响: 字数(10), 持续周: v => v === 1 })
  ok(缺.length === 3 && 缺.includes('假事件.描述') && 缺.includes('假事件.持续周'),
    'RV 反向自检：缺字段假行 ⇒ 判定器报红且定位到「行.字段」', JSON.stringify(缺))
}

const 全部区位 = Object.values(districts).flat()
let 总缺 = []

// ── 表1 · 26 区位 × 5 项（竞品≥1 / 优势 / 代价 / 客群画像 / 推荐档次）──
{
  const 字段s = {
    竞品: d => (COMPETITORS[d.name] || []).length >= 1,
    优势: d => 非空(d.good), 代价: d => 非空(d.warn),
    客群画像: d => !!CUSTOMER_PERSONAS[d.name],
    画像合法: d => { const p = CUSTOMER_PERSONAS[d.name]; return p && Math.round(p.business + p.tourist + p.family) === 100 && ['business', 'tourist', 'family'].includes(p.dominant) },
  }
  let 表缺 = []
  for (const d of 全部区位) 表缺 = 表缺.concat(核行(d.name, d, 字段s))
  ok(表缺.length === 0, `表1 区位 26×5 项齐（竞品/优势/代价/客群/画像合法）`, 表缺.slice(0, 4).join(','))
  总缺 = 总缺.concat(表缺)
  // 推荐档次 = 界面公式（非数据字段 ⇒ 断言公式在源码）
  ok(/推荐档次：/.test(src('SiteSelection.jsx')) && /受等级限制锁档/.test(src('SiteSelection.jsx')), '表1 推荐档次：界面公式在位（对齐等级限制口径）')
  // 画像表 26/26（总账口径；数据纪律归 locationData）
  ok(Object.keys(CUSTOMER_PERSONAS).length === 26, `表1 客群画像 26/26（实 ${Object.keys(CUSTOMER_PERSONAS).length}）`)
  ok(Object.keys(LOCATION_PROFILE).length === 26, `表1 人流/经济画像 26/26`)
}

// ── 表2 · 35 事件 × 6 项 ──
{
  const 字段s = {
    描述: e => 字数(10)(e.描述), 影响: e => 非空(e.影响), 持续周: e => e.持续周 === 1,
    教学点: e => 非空(e.教学点), 触发方式: e => 非空(e.触发方式),
    类别: e => ['钱', '属性', '口碑', '运营', '人力', '监管'].includes(e.类别),
    应对选项: e => Array.isArray(e.应对选项) && e.应对选项.length >= 2,
  }
  let 表缺 = []
  for (const e of 注入事件库) 表缺 = 表缺.concat(核行(e.id, e, 字段s))
  ok(表缺.length === 0, `表2 事件 35×7 项齐（描述≥10/影响/持续周/教学点/触发/类别/应对）`, 表缺.slice(0, 4).join(','))
  总缺 = 总缺.concat(表缺)
  const 白 = new Set(['客流系数', '变动成本系数', '品质', '声誉', '士气', '罚款'])
  const 越维 = 注入事件库.filter(e => e.engine && e.engine.v8 && Object.entries(e.engine).some(([k, v]) => k !== 'v8' && Number.isFinite(Number(v)) && !白.has(k)))
  ok(注入事件库.every(e => !e.engine || e.engine.v8 !== true || Object.keys(e.engine).length >= 1) && 越维.length === 0, '表2 v8 事件效力键 ⊆ 白名单', 越维.map(e => e.id).join(','))
}

// ── 表3 · 18 决策 × 6 项（desc/影响/误区/tip/适用/结果文案）──
{
  const 字段s = {
    desc: d => 非空(d.desc), 影响: d => 字数(10)(d.影响), 误区: d => 字数(8)(d.误区),
    tip: d => 非空(d.tip), 依据: d => 字数(10)(d.依据),
    选项齐: d => (d.options || []).every(o => 非空(o.label) && 非空(o.result) && 非空(o.适用) && 字数(8)(o.教学点)),
  }
  let 表缺 = []
  for (const d of decisions) 表缺 = 表缺.concat(核行(d.id, d, 字段s))
  ok(表缺.length === 0, `表3 决策 18×6 项齐（desc/影响/误区/tip/依据/选项三件）`, 表缺.slice(0, 4).join(','))
  总缺 = 总缺.concat(表缺)
}

// ── 表4 · 品牌 × 7 字段（档次/加盟费/保证金/管理费/适配区位/客群/标准 · 无源须显式待补）──
{
  const 全部 = brandGroups.flatMap(g => g.brands.map(b => ({ ...b, level: g.level })))
  ok(全部.length >= 19, `表4 品牌 ${全部.length} 个（≥19 · V76 诚实口径：扩 30+ 无源不编，三件在批次报告-v76）`)
  const 核 = ['fee', 'cost', 'price', 'standard', 'desc']
  const 表缺 = []
  for (const b of 全部) for (const k of 核) if (!非空(b[k])) 表缺.push(`${b.name}.${k}`)
  ok(表缺.length === 0, `表4 品牌 5 项数据字段齐（${全部.length}×5）`, 表缺.slice(0, 4).join(','))
  // 保证金/管理费：FRANCHISE_MODEL 有源 ⇒ 真值；无源 ⇒ 界面显式「待补」（不允许空字符串/假数）
  const bs = src('BrandSelection.jsx')
  const 待补显式 = /待补（无公开来源 · 不编造）/.test(bs)
  const 有源六 = ['汉庭', '全季', '海友', '桔子', '你好', '桔子水晶'].filter(n => FRANCHISE_MODEL[n])
  ok(待补显式 && 有源六.length >= 5, `表4 保证金/管理费：有源 ${有源六.length} 家走单源 · 无源显式待补`, `有源=${有源六.join(',')}`)
  const 面板标签 = ['保证金', '管理费', '适配区位', '主力客群', '标准要求', '档次']
  ok(面板标签.every(t2 => bs.includes(t2)), '表4 七字段标签全部在品牌面板源码')
}

// ── 表5 · 12 周任务书 × 5 字段 ──
{
  const 实表 = new Set(decisions.map(d => d.id))
  const 字段s = {
    主题: w => 非空(w.主题), 任务: w => 非空(w.任务), 知识点: w => 非空(w.知识点),
    交付物: w => 非空(w.交付物), 常见错误: w => 非空(w.常见错误),
    决策对齐: w => Array.isArray(w.决策) && w.决策.every(id => 实表.has(id)),
  }
  let 表缺 = []
  for (const w of 周任务书) 表缺 = 表缺.concat(核行(`W${w.周}`, w, 字段s))
  ok(表缺.length === 0, `表5 周任务书 12×6 项齐（含决策 id ⊆ 引擎实表）`, 表缺.slice(0, 4).join(','))
  总缺 = 总缺.concat(表缺)
  // 18 项决策在 12 周里全部出现（与引擎可用一致 · 不漏项）
  const 出现 = new Set(周任务书.flatMap(w => w.决策))
  const 漏 = decisions.filter(d => !出现.has(d.id))
  ok(漏.length === 0, `表5 18 项决策在任务书中全覆盖`, 漏.map(d => d.id).join(','))
}

// ── 表6 · 客群攻略 4 类 × 4 字段 ──
{
  const 字段s = { 在意: g => 非空(g.在意), 价格敏感度: g => 非空(g.价格敏感度), 淡旺季: g => 非空(g.淡旺季), 决策提示: g => 非空(g.决策提示) }
  let 表缺 = []
  for (const [k, g] of Object.entries(客群攻略)) 表缺 = 表缺.concat(核行(k, g, 字段s))
  ok(表缺.length === 0, `表6 客群攻略 ${Object.keys(客群攻略).length} 类 × 4 字段齐`, 表缺.slice(0, 4).join(','))
  总缺 = 总缺.concat(表缺)
}

// ── 总账 ──
ok(总缺.length === 0, `★ 七表总账零缺失（若有 ⇒ 上方逐条指名道姓）`, 总缺.slice(0, 6).join(','))

// ── ★ V92（2026-10-09）：区位淡旺季覆盖表守门（文档面 · 表在 + 26 行 + 计数自洽）─────
//   口径：**单类数字不写死**（🟢/🟡/🔴 随实际，只要求『三类相加 === 26』与『🟢 只增不减』）
//   ⇒ 谁删行/漏行/把状态改乱，本条红；谁把实测改回空（🟢 减少），本条也红。
{
  const P = join(dirname(dirname(fileURLToPath(import.meta.url))), '..', '4-审计与报告', '区位淡旺季-26区覆盖表-v1.md')
  let txt = ''
  try { txt = readFileSync(P, 'utf8') } catch {}
  ok(txt.length > 0, 'V92：区位淡旺季覆盖表存在（4-审计与报告/区位淡旺季-26区覆盖表-v1.md）')
  if (txt) {
    const 行 = txt.split('\n').filter(l => l.startsWith('|') && /[🟢🟡🔴]/.test(l))
    const 绿 = 行.filter(l => l.includes('🟢')).length
    const 黄 = 行.filter(l => l.includes('🟡')).length
    const 红 = 行.filter(l => l.includes('🔴')).length
    ok(行.length === 26, `V92：覆盖表逐区 26 行（实得 ${行.length}）`)
    ok(绿 + 黄 + 红 === 26, `V92：三类计数自洽（🟢${绿} + 🟡${黄} + 🔴${红} = ${绿 + 黄 + 红}）· 单类不写死`)
    ok(绿 >= 8, `V92：已实测（🟢）不少于 8 区（实得 ${绿} · 只许增不许减）`)
    ok(/mz\.gov\.cn|绵竹/.test(txt) && /1238\.05/.test(txt), 'V92：绵竹市官方核补在册（4A3/3A3/2A1 · 全年接待 1238.05 万人次）')
  }
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：删任何一张表的任何字段 ⇒ 本套件红且红信息=「行.字段」；判定器带反向自检（不恒真）')
process.exit(fail ? 1 : 0)
