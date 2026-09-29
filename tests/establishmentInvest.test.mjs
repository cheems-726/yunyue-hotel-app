// §16.2-B5 · 筹建页投资项档位（W3-3 铺满版）断言
// 运行：node tests/establishmentInvest.test.mjs   （挂 run-all fast）
//
// 分五层：
//   ① 锚定层：装修档锚在【已有官方来源】的单房造价上（不是凭空写的市场价）
//   ② 档位层：低/中/高 可选 · 金额单调 · 品质联动方向正确
//   ③ 不编造层：无来源品牌 ⇒ 待补（不落数字）
//   ④ 可配置层：一处可调（老师给数只改配置）· 坏配置被拒 · 重置复原
//   ⑤ 不越界层：纯计算 · 不被 settlement 引用 · 品质系数不复制第二份
import { readFileSync, readdirSync } from 'node:fs'
import { 投资测算, 投资档位配置, 设置投资档位配置, 重置投资档位配置, 口径, 待老师确认文案, 装修系数, 附加项, 品质系数, 档位名 } from '../src/establishmentInvest.mjs'
import { FRANCHISE_MODEL } from '../src/franchiseModel.mjs'
import { parseRooms, settle } from '../src/settlement.js'
import { applyDecisionToAttrs, ATTR_INIT } from '../src/attrs.js'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

const 全季 = { name: '全季', standard: '客房80间起' }
const 桔子 = { name: '桔子', standard: '客房80间起' }
const 星程 = { name: '星程', standard: '客房70间起' }   // 无单房造价来源

console.log('▶ §16.2-B5 · 筹建页投资项档位（可配置默认档位）')

// ── ① 锚定层 ──────────────────────────────────────────────────────────
console.log('\n[1] 锚定层：装修"中档"= 房量 × 品牌官方单房造价')
{
  for (const b of [全季, 桔子]) {
    const r = 投资测算({ brand: b })
    const 房量 = parseRooms(b.standard)
    const 造价 = FRANCHISE_MODEL[b.name].单房造价.新建.值
    ok(r.单房造价 === 造价, `${b.name}：取到官方单房造价 ${造价}（franchiseModel 三件套）`)
    ok(r.明细[0].金额 === Math.round(房量 * 造价 * 装修系数.中),
      `${b.name}：装修(中) = ${房量} × ${造价} × ${装修系数.中} = ${r.明细[0].金额}（★ 锚在官方值上，不是编的市场价）`)
  }
  ok(口径.待老师确认 === true && 口径.置信度 === '低', '口径如实标注：待老师确认 + 置信度低')
  ok(/官方单房造价/.test(口径.来源) && /教学默认档位/.test(口径.来源), '口径写明"锚定官方造价 + 其余为教学默认档位"', 口径.来源)
  ok(/待老师确认/.test(待老师确认文案), '界面文案含「待老师确认」')
}

// ── ② 档位层 ──────────────────────────────────────────────────────────
console.log('\n[2] 档位层：低/中/高 可选 · 金额单调 · 品质方向正确')
{
  const 全低 = 投资测算({ brand: 全季, 选择: Object.fromEntries(['装修', ...附加项.map(x => x.key)].map(k => [k, '低'])) })
  const 全中 = 投资测算({ brand: 全季 })
  const 全高 = 投资测算({ brand: 全季, 选择: Object.fromEntries(['装修', ...附加项.map(x => x.key)].map(k => [k, '高'])) })
  ok(全低.合计 < 全中.合计 && 全中.合计 < 全高.合计, `总投资随档位单调上升（${(全低.合计 / 1e4).toFixed(0)}万 < ${(全中.合计 / 1e4).toFixed(0)}万 < ${(全高.合计 / 1e4).toFixed(0)}万）`)
  ok(全低.品质分 < 0 && 全中.品质分 === 0 && 全高.品质分 > 0, `品质联动方向正确（${全低.品质分} / ${全中.品质分} / ${全高.品质分}）`)
  ok(档位名.join() === '低,中,高', '档位词表 = 低/中/高（界面按它渲染）')
  ok(附加项.length === 4 && 附加项.every(x => x.说明 && x.比例), `附加项 4 项（软装/IT/布草/开办费）且每项带说明与比例：${附加项.map(x => x.key).join('、')}`)
  ok(全中.明细.length === 5 && 全中.合计 === 全中.明细.reduce((s, x) => s + x.金额, 0), '合计 = 五项之和（不重不漏）')
  // 单项切换只影响该项（改一处只动一处）
  const 只改软装 = 投资测算({ brand: 全季, 选择: { 软装: '高' } })
  ok(只改软装.明细.find(x => x.key === '装修').金额 === 全中.明细.find(x => x.key === '装修').金额,
    '只改「软装」档 ⇒ 装修金额不变（改一处只影响一处）')
}

// ── ③ 不编造层 ────────────────────────────────────────────────────────
console.log('\n[3] 不编造层：无来源品牌 ⇒ 待补')
{
  const r = 投资测算({ brand: 星程 })
  ok(r.合计 === null && r.明细.every(x => x.金额 === null), '无单房造价来源 ⇒ 合计与各项金额全部 null（不是 0、不是估一个）')
  ok(r.待补.length > 0 && /单房造价/.test(r.待补[0]), '并明确说"缺什么"', r.待补.join(','))
  ok(投资测算({ brand: null }).合计 === null, '连品牌都没有 ⇒ 同样待补（不炸）')
}

// ── ④ 可配置层 ────────────────────────────────────────────────────────
console.log('\n[4] 可配置层：一处可调（老师给数只改配置）')
{
  const 基准 = 投资测算({ brand: 全季 })
  ok(投资档位配置().是否已改动 === false, '初始 = 默认配置（未改动）')
  const 设 = 设置投资档位配置({ 装修系数: { 低: 0.5, 中: 0.8, 高: 1.0 }, 附加项, 品质系数 })
  ok(设.成功 === true, '合法新配置被接受（老师给数 ⇒ 只改这一处）')
  const 改后 = 投资测算({ brand: 全季 })
  ok(改后.合计 < 基准.合计, `改配置 ⇒ 总投资随之变化（${(基准.合计 / 1e4).toFixed(0)}万 → ${(改后.合计 / 1e4).toFixed(0)}万）—— 配置真的被读`)
  ok(投资档位配置().是否已改动 === true, '配置状态能看出"已改动"')
  // 坏配置必须整条拒绝（不许半套生效）
  const 坏1 = 设置投资档位配置({ 装修系数: { 低: 0.5 }, 附加项, 品质系数 })
  const 坏2 = 设置投资档位配置({ 装修系数, 附加项: [], 品质系数 })
  const 坏3 = 设置投资档位配置({ 装修系数, 附加项: [{ key: '软装', 比例: { 低: -1, 中: 0, 高: 0 } }], 品质系数 })
  ok(坏1.成功 === false && 坏2.成功 === false && 坏3.成功 === false, '坏配置（缺档位 / 空附加项 / 负比例）一律被拒并说明原因',
    [坏1.原因, 坏2.原因, 坏3.原因].join(' | '))
  ok(投资测算({ brand: 全季 }).合计 === 改后.合计, '被拒的坏配置【没有污染】当前配置（拒绝是整条的）')
  重置投资档位配置()
  ok(投资测算({ brand: 全季 }).合计 === 基准.合计 && 投资档位配置().是否已改动 === false, '重置 ⇒ 逐值回到默认口径')
}

// ── ⑤ 不越界层 ────────────────────────────────────────────────────────
console.log('\n[5] 不越界层：纯计算 · 不进结算 · 系数不复制第二份')
{
  ok(!/establishmentInvest/.test(strip(src('settlement.js'))), 'settlement.js 不引用 establishmentInvest（静态证明：不进结算路径）')
  const files = readdirSync(new URL('../src/', import.meta.url)).filter(f => /\.(js|jsx|mjs)$/.test(f) && !f.startsWith('settle-old'))
  const importers = files.filter(f => f !== 'establishmentInvest.mjs' && /establishmentInvest/.test(strip(src(f))))
  const ALLOWED = ['Establishment.jsx', 'App.jsx']
  ok(importers.every(f => ALLOWED.includes(f)), `引用方限于交互层白名单（${importers.join(',')}）`, importers.join(','))
  // 纯函数：同输入同输出 + 不改入参
  const a1 = 投资测算({ brand: 全季 }), a2 = 投资测算({ brand: 全季 })
  ok(JSON.stringify(a1) === JSON.stringify(a2), '纯函数：同输入两次结果逐字节相同')
  // 品质联动走【既有属性机制】，且系数不在 attrs.js 复制一份（BL-7 两套算法两个数的对策）
  const attrs = strip(src('attrs.js'))
  ok(/'est-invest'/.test(attrs), 'attrs.js 有 est-invest 伪 id（品质联动的落点）')
  ok(!/装修系数|品质系数/.test(attrs), 'attrs.js 里【没有】复制装修/品质系数表（系数单源在 establishmentInvest）')
  const 加 = applyDecisionToAttrs({ ...ATTR_INIT }, 'est-invest', 3)
  const 零 = applyDecisionToAttrs({ ...ATTR_INIT }, 'est-invest', 0)
  ok(加.quality === ATTR_INIT.quality + 3, `est-invest 按【传入数值】加品质（${ATTR_INIT.quality} → ${加.quality}）`)
  ok(零.quality === ATTR_INIT.quality, '品质分为 0 ⇒ 属性不变（不产生噪声）')
  ok(applyDecisionToAttrs({ ...ATTR_INIT }, 'est-invest', '不是数字').quality === ATTR_INIT.quality, '脏输入（非数字）⇒ 不加分且不炸')
  // 界面：档位可点 + 待老师确认标注在位（剥注释后判定）
  const est = strip(src('Establishment.jsx'))
  ok(/chooseTier/.test(est) && /investTiers/.test(est), '筹建页：档位可点（chooseTier + investTiers 落档）')
  ok(/待老师确认文案/.test(est) && /\['低', '中', '高'\]/.test(est), '筹建页：三档按钮 + 显式标「待老师确认」')
  // 引擎锚点不受影响（本模块不参与结算 ⇒ 单配置锚点应当没变）
  const r = settle({ site: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }, brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }, decisions: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } })
  // 🔴 §22.2 重基线（B2）：week1 含开业一次性费用 349,000 ⇒ 81087+349000=430087 · 45053−349000=−303947
  ok(r.revenue === 126140 && r.totalCost === 430087 && r.netProfit === -303947,
    '引擎锚点（§22.2 重基线：B2 开业一次性费用计入 week-1；营收/GOP 不变）', `${r.revenue}/${r.totalCost}/${r.netProfit}`)
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：各档可选 · 联动总投与品质 · 每档标"待老师确认" · 老师给数只改配置不动代码')
process.exit(fail ? 1 : 0)
