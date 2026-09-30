// §31.2-A1 · 等级限制【真强制】守门 + RV
// 判据：① 引擎侧 —— 超档组合 settle 必须 throw；合规组合必须照常出数
//       ② 前端侧 —— 超档卡片 disabled + 点击拒绝（源码断言）
//       ③ 判据自检 —— 上限公式与 BrandSelection.maxTier 同源（不许两处各写一份）
// 运行：node tests/tierLimit.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { settle } from '../src/settlement.js'
import { 区域档次上限, 品牌档次序号, 校验等级限制 } from '../src/tierLimit.mjs'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const 属性 = { quality: 60, reputation: 70, morale: 65 }
const 品牌 = (name, level) => ({ name, level, price: '200-300元', standard: '客房60间起' })
const 试 = (site, brand) => { try { settle({ site, brand, decisions: {}, week: 1, attrs: 属性 }); return null } catch (e) { return e } }

console.log('▶ §31.2-A1 等级限制【真强制】（前端禁选 + 点击拒绝 + 引擎 throw）')

console.log('\n[1] 上限公式与品牌档位映射（与 BrandSelection.maxTier 同一公式）')
{
  ok(区域档次上限(1) === 1 && 区域档次上限(2) === 1, '客流 1/2 档 ⇒ 上限 1（仅经济型）')
  ok(区域档次上限(3) === 2, '客流 3 档 ⇒ 上限 2（经济～中端）')
  ok(区域档次上限(4) === 5 && 区域档次上限(5) === 5, '客流 4/5 档 ⇒ 上限 5（全档次）')
  ok(品牌档次序号(品牌('汉庭', '经济型 · 国民')) === 1, '汉庭 = 档 1')
  ok(品牌档次序号(品牌('全季', '中档')) === 2, '全季 = 档 2')
  ok(品牌档次序号(品牌('桔子水晶', '精选 · 中高档')) === 3, '桔子水晶 = 档 3')
  ok(品牌档次序号(品牌('美居', '高档')) === 4, '美居 = 档 4')
  ok(品牌档次序号(品牌('施柏阁', '奢华')) === 5, '施柏阁 = 档 5')
  ok(品牌档次序号(null) === null && 品牌档次序号(品牌('无名', '')) === null, '未知档位 ⇒ null（不校验 · 不臆造）')
  // 判据自检：上限公式必须与 BrandSelection 的 maxTier 字面公式一致（防两处漂移）
  const bs = readFileSync(path.join(APP, 'src', 'BrandSelection.jsx'), 'utf8')
  const m = /maxTier = flow >= 4 \? 5 : \(flow >= 3 \? 2 : 1\)/.test(bs)
  ok(m, '判据自检：BrandSelection 的 maxTier 公式仍与本模块一致（防两处各写一份漂移）')
}

console.log('\n[2] 引擎侧：超档 ⇒ settle 必 throw；合规 ⇒ 照常出数')
{
  const 决策 = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }
  const 错误1 = 试({ 客流: 2, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3, district: '某低消费区' }, 品牌('全季', '中档'))
  ok(!!错误1 && /等级限制/.test(错误1.message), '★ 客流 2 档区 × 中档品牌 ⇒ settle **抛错**（上限 1 < 档 2）', 错误1 ? '' : '未抛错 = 校验没生效')
  const 错误4 = 试({ 客流: 3, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3, district: '某中档区' }, 品牌('施柏阁', '奢华'))
  ok(!!错误4 && /等级限制/.test(错误4.message), '★ 客流 3 档区 × 奢华品牌 ⇒ settle **抛错**（上限 2 < 档 5）')
  const 合规 = 试({ 客流: 3, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3 }, 品牌('全季', '中档'))
  ok(合规 === null, '客流 3 档区 × 中档品牌（= 上限内）⇒ 照常结算（不误伤）')
  const 高客流 = 试({ 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3 }, 品牌('施柏阁', '奢华'))
  ok(高客流 === null, '客流 4 档区 × 奢华品牌（上限 5）⇒ 照常结算')
  const 缺客流 = 试({ 房价: 3, 租金: 3, 竞争: 3, 人力: 3 }, 品牌('施柏阁', '奢华'))
  ok(缺客流 === null, '缺客流数据 ⇒ 不判（不臆造 · 与 BrandSelection 兜底一致由 UI 层管）')
  // 既有锚点不回归：守门常用用例（客流4 · 全季）仍可结算
  const 锚点 = 试({ 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3 }, 品牌('全季', '中档'))
  ok(锚点 === null, '守门锚点用例（客流4 · 全季）不受影响')
}

console.log('\n[3] 前端侧：超档卡片 disabled + 点击拒绝（源码断言）')
{
  const bs = readFileSync(path.join(APP, 'src', 'BrandSelection.jsx'), 'utf8')
  const 去注释 = (x) => x.split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
  const code = 去注释(bs)
  ok(/超档 \? \{ opacity: 0\.45/.test(code), '★ 超档卡片 disabled（降透明度 + 禁用光标）')
  ok(/⛔ 超出本区档次上限/.test(code), '★ 超档卡片**写明不可选**（学生看得见为什么）')
  ok(/if \(gi \+ 1 > maxTier\) \{[\s\S]{0,600}?return[\s\S]{0,600}?\}/.test(code), '★ handleBrandClick 超档直接 return（双保险 · 不进反馈/确认流）')
  ok(/handleBrandClick\(b, g\.level, gi\)/.test(code), '★ 档次序号 gi 已传入点击处理（否则校验无从判）')
  // RV 靶子：把 :81 的校验去掉 ⇒ [3] 必红（注释里写明）
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('RV：删掉 handleBrandClick 里「if (gi + 1 > maxTier) return」⇒ [3] 必红；删掉 settle 的 校验等级限制 ⇒ [2] 必红')
process.exit(fail ? 1 : 0)
