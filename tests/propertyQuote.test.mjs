// W3-2 · 认领页「物业报价单」断言（P2 交互层 · ★ 硬约束：不改任何结算数值）
// 运行：node tests/propertyQuote.test.mjs   （挂 run-all）
//
// 分四层：
//   ① 口径层：报价单每个数字都从【已有口径】推导（房量=parseRooms / 年租金=引擎租金公式 / 费率=franchiseModel）
//   ② 不编造层：缺来源的字段必须是"待补"（汉庭以外品牌 / 面积缺失 / 汉庭快捷缺保证金）
//   ③ 一致性层：物料数据的两份表示（字符串 area 与数字 areaNum）必须一致（防漂移）
//   ④ 零影响层：模块是纯函数 + settlement.js 不引用它 ⇒ 结算输出在构造上不可能变
import { readFileSync, readdirSync } from 'node:fs'
import { propertyQuote, quoteSummary, brandTerms, rentPerRoomDay, STATUS } from '../src/propertyQuote.mjs'
import { FRANCHISE_MODEL } from '../src/franchiseModel.mjs'
import { parseRooms, settle } from '../src/settlement.js'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

const 汉庭 = { name: '汉庭', level: '经济型 · 国民', standard: '客房70间起' }
const 全季 = { name: '全季', level: '中档', standard: '客房80间起' }
const 物业 = { name: '社区旁物业', type: '社区型', area: '2600㎡', areaNum: 2600, rent: '中等' }
const 区县 = { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3 }

console.log('▶ W3-2 · 物业报价单（纯计算 · 不改结算）')

// ── ① 口径层 ──────────────────────────────────────────────────────────
console.log('\n[1] 口径层：每个数字都能追到已有口径')
{
  const q = propertyQuote(汉庭, 物业, 区县)
  const rooms = parseRooms(汉庭.standard)
  ok(q.rooms === rooms && rooms > 0, `房量 = parseRooms(品牌标准) = ${rooms}（与结算同源）`)
  const 年租金 = rooms * rentPerRoomDay(区县.租金) * 365
  ok(q.lines.find(l => l.label === '年租金').value === 年租金,
    `年租金 = 房量 × (35+租金档×10) × 365 = ${年租金}（引擎租金口径，settlement.js:202 同式）`)
  const 单价 = 年租金 / 2600 / 365
  const line单价 = q.lines.find(l => l.label === '租金单价')
  ok(Math.abs(line单价.value - 单价) < 1e-9 && line单价.status === STATUS.DERIVED,
    `租金单价 = 年租金 ÷ 面积 ÷ 365 = ${单价.toFixed(3)} 元/㎡·天（标注 derived：反推值，非独立数据源）`)
  const t = FRANCHISE_MODEL['汉庭']
  const 加盟费应 = Math.max(rooms * t.加盟费.单价.值, t.加盟费.下限.值)
  ok(q.lines.find(l => l.label === '加盟费').value === 加盟费应,
    `加盟费 = max(元/间 × 房量, 下限) = ${加盟费应}（含下限守卫）`)
  const 总投应 = rooms * t.单房造价.新建.值 + 加盟费应 + t.保证金.值 + t.筹备费.值
  ok(q.lines.find(l => l.label === '总投资（估算）').value === 总投应,
    `总投资 = 单房造价×房量 + 加盟费 + 保证金 + 筹备费 = ${总投应}`)
  ok(!!q.sources && !!q.sources.来源 && !!q.sources.置信度, '三件套随行（来源/取数日期/置信度）可 hover 追溯',
    JSON.stringify(q.sources))
  ok(brandTerms('汉庭') !== null && brandTerms('全季') === null, 'brandTerms：汉庭有条款、全季（无来源数据）返回 null')
}

// ── ② 不编造层 ────────────────────────────────────────────────────────
console.log('\n[2] 不编造层：缺来源 ⇒ 必须是"待补"')
{
  const q = propertyQuote(全季, 物业, 区县)
  const s = quoteSummary(q)
  ok(s.待补字段.includes('单房造价') && s.待补字段.includes('加盟费') && s.待补字段.includes('保证金') && s.待补字段.includes('筹备费'),
    '汉庭以外的品牌：经济条款四项全部标"待补"（不拿别家费率冒充）', s.待补字段.join(','))
  ok(s.房量 > 0 && s.年租金 > 0 && s.总投资 === null,
    '但房量/年租金仍有值（来自引擎口径），总投资因缺造价而为空 —— 该有的不该误标待补', JSON.stringify(s))
  const 快捷 = propertyQuote({ name: '汉庭快捷', standard: '客房60间起' }, 物业, 区县)
  ok(quoteSummary(快捷).待补字段.includes('保证金'), '汉庭快捷：franchiseModel 无保证金 ⇒ 标"待补"')
  const 无面积 = propertyQuote(汉庭, { name: '无面积物业', areaNum: null }, 区县)
  const 待补2 = quoteSummary(无面积).待补字段
  ok(待补2.includes('租金单价') && !待补2.includes('年租金'),
    '缺面积 ⇒ 只有"租金单价"待补（年租金不依赖面积，不该被牵连）', 待补2.join(','))
}

// ── ③ 一致性层 ────────────────────────────────────────────────────────
console.log('\n[3] 一致性层：物业数据的两份表示必须一致（防漂移）')
{
  const claim = src('Claim.jsx')
  // 从源码里抓 area/areaNum 成对值（按写法扫，不按"想到的位置"探）
  const pairs = [...claim.matchAll(/area:\s*'(\d+)㎡',\s*areaNum:\s*(\d+)/g)].map(m => ({ area: +m[1], areaNum: +m[2] }))
  ok(pairs.length >= 8, `抓到 ${pairs.length} 组 area/areaNum（覆盖各档次物业）`)
  const bad = pairs.filter(p => p.area !== p.areaNum)
  ok(bad.length === 0, '每组的 areaNum 与 area 字符串一致', bad.map(b => JSON.stringify(b)).join(' '))
  ok(/rooms:\s*'\d+间'/.test(claim) && !/roomsNum/.test(claim), '房量仍只以字符串展示（真值走 parseRooms，不另设数字字段防两套）')

  // ── 界面层（静态）：认领页必须真的渲染报价单（R3 反向验证：删块即红）──
  ok(/from '\.\/propertyQuote\.mjs'/.test(claim) && /propertyQuote\(brand, selectedProperty, location\?\.attrs\)/.test(claim),
    'Claim.jsx：引入并调用 propertyQuote（品牌 + 选中物业 + 区县属性）')
  ok(/\{step === 3 && quote &&/.test(claim) && /quote\.lines\.map/.test(claim),
    'Claim.jsx：第 3 步「项目决策」渲染报价单（条件渲染 + 逐行输出）')
  ok(/STATUS\.MISSING/.test(claim) && /待补 · 无来源数据/.test(claim), 'Claim.jsx：缺来源字段显示"待补"，不是空白或 0')
  ok(/收益侧/.test(claim) && /待决策队列/.test(claim), 'Claim.jsx：收益侧（出租率/回本周期）明示"待拍板口径"，此处不编造')
}

// ── ④ 零影响层 ────────────────────────────────────────────────────────
console.log('\n[4] 零影响层：结算输出不可能被本模块影响')
{
  ok(!/propertyQuote/.test(strip(src('settlement.js'))), 'settlement.js 不引用 propertyQuote（静态证明：改动不进结算路径）')
  const files = readdirSync(new URL('../src/', import.meta.url)).filter(f => /\.(js|jsx|mjs)$/.test(f) && !f.startsWith('settle-old'))
  const importers = files.filter(f => f !== 'propertyQuote.mjs' && /propertyQuote/.test(strip(src(f))))
  // 🔴 W3-1 重基线（D38-B）：引用方从"仅 Claim.jsx"扩为【交互层白名单】——
  //   onePageLedger（W3-1 钱账）需要报价单的"总投资"来算回本周期，属同一交互层；意图不变：不进结算路径
  const ALLOWED = ['Claim.jsx', 'onePageLedger.mjs']
  ok(importers.every(f => ALLOWED.includes(f)) && importers.includes('Claim.jsx'),
    `引用方限于交互层白名单（${importers.join(',')}）`, importers.join(','))
  // 纯函数：同输入同输出 + 不改入参
  const a1 = propertyQuote(汉庭, 物业, 区县), a2 = propertyQuote(汉庭, 物业, 区县)
  ok(JSON.stringify(a1) === JSON.stringify(a2), '纯函数：同输入两次调用结果逐字节相同')
  const frozen = JSON.stringify(物业)
  propertyQuote(汉庭, 物业, 区县)
  ok(JSON.stringify(物业) === frozen, '不改动入参对象（无副作用）')
  // 引擎锚点：确定性单配置（与批次报告一致）—— 若有人把报价单接进结算，这里会红
  const r = settle({ site: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }, brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }, decisions: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } })
  ok(r.revenue === 126140 && r.totalCost === 85753 && r.netProfit === 40387,
    '引擎锚点未变：单配置 revenue 126140 / totalCost 85753 / netProfit 40387', `${r.revenue}/${r.totalCost}/${r.netProfit}`)
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：报价单只做投资侧加减乘除，且每个数字可追溯 / 无来源一律待补')
process.exit(fail ? 1 : 0)
