// V174 E4 · 六性格 12 周 state 生成（引擎直调 · 与 E2 同一轨迹源）—— 供服务端写入彩排班
// 产出：/tmp/v105-states.json  [{group_key, state}]  · 上传后由服务端脚本经 REST 写入
// state 键形与真实存档一致（week/finished/history/capital/attrs/brand/location/established/...）
import { settleWeekSegmented } from '../src/weekSegments.mjs'
import { settleInputsFrom } from '../src/weekInputs.mjs'
import { decisionsByDayFrom } from '../src/weeklyAuto.mjs'
import { districts } from '../src/siteLocations.mjs'
import { brandGroups } from '../src/brands.mjs'
import { 性格规则, 站点, 品牌 } from './v105-personas.mjs'
import { writeFileSync } from 'node:fs'

const site = districts['锦江区'] || Object.values(districts).flat().find(d => d.name === 站点)
const brand = brandGroups.flatMap(g => g.brands).find(b => b.name === 品牌)

function 组决策(规则, 上周) {
  const shifts = 规则.shifts.startsWith('按出租率')
    ? ((上周 && Number(上周.occupancy) >= 80) ? '满编保服务' : '精简省成本')
    : 规则.shifts
  return { ...规则, shifts }
}

const out = []
for (const { group, 性格, 规则 } of 性格规则) {
  let capital = 1490000
  let attrs = null
  let prevGoodRate = null
  const history = []
  for (let w = 1; w <= 12; w++) {
    const 上周 = history[history.length - 1] || null
    const decisions = 组决策(规则, 上周)
    const 输入 = settleInputsFrom({ reviews: [], week: w, crisis: null, eventResponse: null, decisions, dailyQuests: [] })
    const decisionsByDay = decisionsByDayFrom({ base: decisions, changes: [], week: w })
    const r = settleWeekSegmented({
      site, brand, decisions, decisionsByDay, week: w,
      pendingNegatives: 输入.pendingNegatives, resolvedCount: 输入.resolvedCount,
      liveNegCount: 输入.liveNegCount, livePosCount: 输入.livePosCount,
      prevGoodRate, prevCapital: capital, attrs,
    })
    capital = r.capital != null ? r.capital : capital + (r.netProfit || 0)
    attrs = r.attrsAfter || attrs
    prevGoodRate = r.finalGoodRate
    history.push(r)
  }
  out.push({
    group_key: `彩排-V105|${group}`,
    state: {
      week: 12, finished: false, history, capital, attrs,
      brand: { name: brand.name }, location: 站点, established: true, welcomed: true,
      hotelName: `${性格}·演练店`, doneDecisions: {}, bizMode: 'direct',
      scaleVersion: 2, __autoSettled: true,
    },
  })
  console.log(性格, '→ 彩排-V105|' + group, '· 期末资金', capital.toLocaleString())
}
writeFileSync('/tmp/v105-states.json', JSON.stringify(out))
console.log('产出 /tmp/v105-states.json（' + out.length + ' 组）')
