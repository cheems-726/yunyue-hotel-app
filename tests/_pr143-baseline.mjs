// §14.3 G3 第二步 · 【改动前】基线冻结（一次性工具，不进套件）
//
// 为什么必须先跑：零变化断言「自营/未接入路径逐字节不变」只有在改动【之前】把输出冻成 fixture
// 才成立。改动之后再造基线 = 自己给自己发合格证（BL-15 机制存在≠生效的同族陷阱）。
//
// 运行：node tests/_pr143-baseline.mjs   ⇒ 写 tests/fixtures/settle-baseline-14.3.json
import { writeFileSync, mkdirSync } from 'node:fs'
import { settle } from '../src/settlement.js'

const 决策 = {
  pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗',
  'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿',
}
const 属性 = { quality: 60, reputation: 70, morale: 65 }
const 场地 = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }

const 品牌 = {
  汉庭: { name: '汉庭', price: '180-280元', standard: '客房70间起', level: '经济型 · 国民' },
  全季: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' },
  海友: { name: '海友', price: '120-180元', standard: '客房50间起', level: '经济型 · 国民' },
  汉庭快捷: { name: '汉庭快捷', price: '160-240元', standard: '客房60间起', level: '经济型（轻改/特许）' },
  你好: { name: '你好', price: '150-220元', standard: '客房60间起', level: '经济型 · 国民' },
  桔子: { name: '桔子', price: '260-380元', standard: '客房70间起', level: '中档' },
  无品牌: null,
}

const 用例 = {}
for (const [名, brand] of Object.entries(品牌)) {
  for (const bizMode of ['direct', 'ota']) {
    用例[`${名}|${bizMode}|w1`] = settle({ site: { ...场地 }, brand, decisions: { ...决策 }, week: 1, attrs: { ...属性 }, bizMode })
  }
}
// 多周链（未接入品牌 + 无品牌）：资金会累积 ⇒ 更能抓出"悄悄扣费"
for (const 名 of ['你好', '无品牌', '汉庭']) {
  let cap = null
  const 链 = []
  for (let w = 1; w <= 3; w++) {
    const r = settle({ site: { ...场地 }, brand: 品牌[名], decisions: { ...决策 }, week: w, attrs: { ...属性 }, prevCapital: cap })
    链.push(r)   // ★ 存【整对象】：零变化要证到逐字节，不能只证 5 个数字
    cap = r.capital
  }
  用例[`${名}|链3周`] = 链
}

const out = { 生成时间: '2026-09-28（§14.3 接线前）', 说明: 'settle() 逐用例输出；接入品牌将在 §14.3 后变化，未接入/无品牌必须逐字节不变', 用例 }
mkdirSync(new URL('./fixtures/', import.meta.url), { recursive: true })
writeFileSync(new URL('./fixtures/settle-baseline-14.3.json', import.meta.url), JSON.stringify(out, null, 1) + '\n')
console.log('已冻结基线：tests/fixtures/settle-baseline-14.3.json')
console.log('用例数：', Object.keys(用例).length)
for (const k of Object.keys(用例)) {
  const v = 用例[k]
  if (Array.isArray(v)) { console.log(` ${k}: 末周 capital=${v[v.length - 1].capital}`); continue }
  console.log(` ${k}: revenue=${v.revenue} totalCost=${v.totalCost} netProfit=${v.netProfit} capital=${v.capital} hasFeeKey=${'franchiseFees' in v}`)
}
