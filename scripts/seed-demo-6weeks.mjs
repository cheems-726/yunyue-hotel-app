import { settleWeekSegmented } from './src/weekSegments.mjs'
import { settleInputsFrom } from './src/weekInputs.mjs'
import { decisionsByDayFrom } from './src/weeklyAuto.mjs'
import { districts } from './src/siteLocations.mjs'
import { brandGroups } from './src/brands.mjs'
import { writeFileSync } from 'node:fs'

const KEY = process.env.SK
const REST = 'https://test.2026911301.xyz/rest/v1'
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }
const rows = await (await fetch(`${REST}/game_states?select=user_id,state`, { headers: H })).json()
if (rows.length !== 1) { console.error('预期 1 行，实际', rows.length); process.exit(1) }
const { user_id, state } = rows[0]
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
writeFileSync(`D:/教学app/4-审计与报告/备份-game-state-${stamp}.json`, JSON.stringify({ user_id, state }, null, 1))
console.log('已备份到 备份-game-state-' + stamp + '.json · 原 week=' + state.week + ' hist=' + (state.history || []).length + ' cap=' + state.capital)

const 规则 = {
  pricing: '不跟降', shifts: '满编保服务', overbook: 2,
  'member-convert': '强调品质', linen: '自洗', hygiene: '停房深清洁',
  ota: { 携程: 30, 美团: 40, 飞猪: 30 }, campaign: { 线上广告: 1200, 门店物料: 1200, 员工激励: 1200, 会员礼包: 800 },
  corporate: '坚守价格', reputation: '道歉+赔偿',
  'member-threshold': 8, 'report-diagnosis': '解决口碑相关', 'revenue-mgmt': '组合套餐',
  'hr-optimize': '全员培训', energy: 24, renovation: '不投', emergency: '立即送医+道歉',
  'quality-check': ['卫生', '床品', '隔音', '卫生间', '热水', '空调'],
}
const site = districts['成都'].find(d => d.name === (state.location?.district || '高新区'))
const brand = brandGroups.flatMap(g => g.brands).find(b => b.name === (state.brand?.name || '全季'))
if (!site || !brand) { console.error('站点/品牌取不到'); process.exit(1) }

let capital = 1490000, attrs = { quality: 76, reputation: 80, morale: 74 }, prevGoodRate = null
const hist = []
for (let w = 1; w <= 6; w++) {
  const 输入 = settleInputsFrom({ reviews: [], week: w, crisis: null, eventResponse: null, decisions: 规则, dailyQuests: [] })
  const byDay = decisionsByDayFrom({ base: 规则, changes: [], week: w })
  const r = settleWeekSegmented({ site, brand, decisions: 规则, decisionsByDay: byDay, week: w, pendingNegatives: 输入.pendingNegatives, resolvedCount: 输入.resolvedCount, liveNegCount: 输入.liveNegCount, livePosCount: 输入.livePosCount, prevGoodRate, prevCapital: capital, attrs })
  capital = r.capital != null ? r.capital : capital + (r.netProfit || 0)
  attrs = r.attrsAfter || attrs; prevGoodRate = r.finalGoodRate
  hist.push(r)
}
const next = {
  ...state,
  history: hist,
  week: 6,
  capital: Math.round(capital),
  attrs,
  doneDecisions: {},
  decisionChanges: {},
  本周押注: null,
  押注历史: [],
  weekInputs: null,
  weekBase: null,
  report: hist[hist.length - 1],
  finished: false,
  __autoSettled: {},
}
const res = await fetch(`${REST}/game_states?user_id=eq.${user_id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ state: next }) })
console.log('PATCH', res.status, await res.text())
for (const h of hist) console.log(`W${h.week} 出租${h.occupancy}% 好评${h.finalGoodRate}% 营收${Math.round(h.revenue)} 净利${Math.round(h.netProfit)} 资金${Math.round(h.capital)}`)
console.log('期末资金', Math.round(capital), 'attrs', attrs)
