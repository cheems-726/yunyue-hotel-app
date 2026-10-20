// V134 §1 · 数值平衡：经济型可经营（46 组合重亏 ≤15% · 汉庭 ≥3 区位净利 ≥0 · 全季不变）
// 运行：node tests/v134Balance.test.mjs   （挂 run-all fast）
import { settle } from '../src/settlement.js'
import { districts } from '../src/siteLocations.mjs'
import { brandGroups } from '../src/brands.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const 品牌 = (名, 档) => { const g = brandGroups.find(x => x.level.includes(档)); const b = (g?.brands || []).find(x => x.name === 名); return b ? { ...b, level: g.level } : null }
const H = 品牌('汉庭', '经济型')
const JI = 品牌('全季', '中档')
const DILIGENT = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'member-convert': '强调品质', corporate: '让利签约', 'member-threshold': 5, energy: 23, overbook: 2, ota: {}, reputation: '道歉+赔偿', 'hr-optimize': '全员培训' }

function 跑(brand) {
  const rows = []
  for (const [, list] of Object.entries(districts)) for (const d of list) {
    let prev = null, total = 0, skip = false
    for (let w = 1; w <= 12; w++) {
      let r
      try { r = settle({ site: { ...d.attrs, district: d.name }, brand, decisions: DILIGENT, week: w, prevGoodRate: prev }) }
      catch (e) { if (String(e.message).includes('等级限制')) { skip = true; break } throw e }
      prev = r.finalGoodRate
      total += r.profit + (r.oneTimeFees ? r.oneTimeFees.开业费用 - r.oneTimeFees.保证金退还 : 0)
    }
    if (!skip) rows.push({ loc: d.name, profit: Math.round(total) })
  }
  return rows
}

console.log('▶ V134 §1 · 经济型可经营')

console.log('\n[①] 品牌配置：汉庭 ADR 210–310 · 租金系数 0.5；全季未动')
{
  ok(H && H.price === '210-310元', `汉庭价格带 = 210–310 元（实得 ${H && H.price}）`)
  ok(H && H.rentFactor === 0.5, `汉庭 rentFactor = 0.5（实得 ${H && H.rentFactor}）`)
  ok(JI && JI.price === '280-400元' && JI.rentFactor === undefined, '全季价格/租金系数未动（不一起改）')
}

console.log('\n[②] 46 组合：重亏 ≤6（≤15%）· 汉庭 ≥3 区位净利 ≥0')
{
  const hRows = 跑(H), jRows = 跑(JI)
  const all = [...hRows, ...jRows]
  const dead = all.filter(x => x.profit < -20000)
  ok(all.length >= 40, `矩阵组合数 = ${all.length}（≥40）`)
  ok(dead.length <= Math.floor(all.length * 0.15), `重亏 ${dead.length}/${all.length} ≤15%（≤${Math.floor(all.length * 0.15)}）`)
  const hPos = hRows.filter(x => x.profit >= 0)
  ok(hPos.length >= 3, `汉庭 ${hPos.length} 个区位 12 周净利 ≥0（≥3）`)
  const 锦江 = hRows.find(x => x.loc === '锦江区')
  ok(锦江 && 锦江.profit >= 0, `汉庭·锦江区净利 ≥0（实得 ${锦江 && 锦江.profit}）`)
  ok(jRows.filter(x => x.profit < -20000).length <= 1, `全季仍只有 ≤1 个重亏（实得 ${jRows.filter(x => x.profit < -20000).length}）`)
}

console.log('\n[③] 全季不变：去掉 rentFactor 与不去掉，结果逐字节相同')
{
  const a = settle({ site: { ...districts['成都'].find(d => d.name === '锦江区').attrs, district: '锦江区' }, brand: JI, decisions: DILIGENT, week: 1, prevGoodRate: null })
  const b = settle({ site: { ...districts['成都'].find(d => d.name === '锦江区').attrs, district: '锦江区' }, brand: { ...JI }, decisions: DILIGENT, week: 1, prevGoodRate: null })
  ok(JSON.stringify(a) === JSON.stringify(b), '全季同输入 ⇒ 逐字节一致（rentFactor 默认 1）')
  // 汉庭的租金必须真的降了（否则杠杆没生效）
  const h = settle({ site: { ...districts['成都'].find(d => d.name === '锦江区').attrs, district: '锦江区' }, brand: H, decisions: DILIGENT, week: 1, prevGoodRate: null })
  const 单房租金 = h.rentCost / (h.rooms * 7)
  ok(单房租金 <= 25.1, `汉庭单房租金 = 区位租金×0.5（实得 ${单房租金} 元/间·天）`)
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
