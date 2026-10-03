// V12 批10 v2：对准机制触发前提的单因素扰动（结果如实进报告；缺陷只记录不改）
import { settle } from '../src/settlement.js'

const 品牌 = { name: '汉庭', price: '180-280元', standard: '客房60间起', level: '经济型 · 国民' }
const 属性 = { quality: 60, reputation: 70, morale: 65 }
const 基准 = {
  pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗',
  'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿',
}
const 跑 = (决策, 场地, 周 = 2, prev = null) =>
  settle({ site: { ...场地 }, brand: 品牌, decisions: { ...基准, ...决策 }, week: 周, attrs: { ...属性 }, prevCapital: prev, bizMode: 'direct' })
const fmt = r => `入住率 ${r.occupancy}% · 好评 ${r.finalGoodRate}% · 利润 ${r.profit} · 事件 ${JSON.stringify((r.events || []).map(e => e.name))}`

console.log('══ 批10 v2 · 对准触发前提 ══\n')

// 3.2-2 人员不足：机制 =「出租率≥85% 且 排班精简 → 满负荷·响应慢」⇒ 用高客流场地
{
  const 高场地 = { 客流: 5, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
  const a = 跑({ shifts: '满编保服务' }, 高场地)
  const b = 跑({ shifts: '精简省成本' }, 高场地)
  console.log(`【3.2-2 人员不足 · 高客流场地（入住≥85% 前提）】`)
  console.log(`  满编：${fmt(a)}`)
  console.log(`  精简：${fmt(b)}`)
  console.log(`  判定：${(b.events || []).some(e => String(e.name).includes('响应慢')) || b.finalGoodRate < a.finalGoodRate || b.occupancy < a.occupancy ? '真生效' : '零消费'}\n`)
}

// 3.2-3 不维护：机制 =「第4周起未做深清洁 → 卫生敷衍/整改事件」⇒ 跑 6 周
{
  const run6 = (hyg) => {
    let cap = null; const out = []
    for (let w = 1; w <= 6; w++) {
      const r = settle({ site: { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }, brand: 品牌, decisions: { ...基准, hygiene: hyg }, week: w, attrs: { ...属性 }, prevCapital: cap, bizMode: 'direct' })
      out.push(`w${w}:营收${(r.revenue / 1000).toFixed(0)}k 好评${r.finalGoodRate}% 事件[${(r.events || []).map(e => e.name).join('/')}]`)
      cap = r.capital
    }
    return out
  }
  console.log('【3.2-3 不维护 · 6周】')
  console.log('  深清洁：' + run6('停房深清洁').join('\n          '))
  console.log('  不做的：' + run6('日常打扫').join('\n          ') + '\n')
}

// 3.2-4 纯躺平：跑 6 周资金轨迹
{
  const run6 = (决策) => {
    let cap = 1490000; const out = []
    for (let w = 1; w <= 6; w++) {
      const r = settle({ site: { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }, brand: 品牌, decisions: { ...基准, ...决策 }, week: w, attrs: { ...属性 }, prevCapital: cap, bizMode: 'direct' })
      out.push(`w${w}:${r.capital}`)
      cap = r.capital
    }
    return out.join(' → ')
  }
  const 躺 = { pricing: '维持原价', shifts: '精简省成本', hygiene: '日常打扫', 'hr-optimize': '维持现状', 'member-convert': '不做活动', reputation: '不处理', linen: '外包', corporate: '不签约', campaign: '不做', ota: '不投放', energy: 24, renovation: '暂不投资', overbook: '不超售', 'quality-check': '抽检10%', 'member-threshold': '500分' }
  console.log('【3.2-4 纯躺平 · 6周资金】')
  console.log('  躺平：' + run6(躺))
  console.log('  尽责：' + run6({}) + '\n')
}

// 3.2-5 定价高于区域消费：三档 × 3 周平均（排 RNG 单周噪声）
{
  const 场 = { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
  const avg = (决策) => {
    let occ = 0, prof = 0, n = 0
    for (let w = 1; w <= 3; w++) {
      const r = 跑(决策, 场, w)
      occ += r.occupancy; prof += r.profit; n++
    }
    return `平均入住率 ${(occ / n).toFixed(0)}% · 周均利润 ${Math.round(prof / n)}`
  }
  console.log('【3.2-5 定价 · 3周均】')
  console.log('  降价20%：' + avg({ pricing: '降价 20% 抢客' }))
  console.log('  不跟降：' + avg({ pricing: '不跟降' }))
  console.log('  涨价15%：' + avg({ pricing: '涨价 15% 试水' }) + '\n')
}

// 5.2 失职扣分：缺一项职责决策 × 多周（未做 ⇒ 不作为惩罚/口碑权重衰减）
{
  const 场 = { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
  const run6 = (决策) => {
    let cap = 1490000; const out = []
    for (let w = 1; w <= 6; w++) {
      const r = settle({ site: { ...场 }, brand: 品牌, decisions: { ...基准, ...决策 }, week: w, attrs: { ...属性 }, prevCapital: cap, bizMode: 'direct' })
      out.push(`w${w}:${r.capital}`)
      cap = r.capital
    }
    return out.join(' → ')
  }
  console.log('【5.2 失职（缺口碑管理）· 6周资金】')
  console.log('  全职责：' + run6({}))
  console.log('  缺口碑：' + run6({ reputation: null }) + '\n')
}
