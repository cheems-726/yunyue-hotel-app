// 生成"第12周大存档"fixture（真实 settle 引擎产出，非手造数字）
// 输出 tests/_fixture12w.json —— 形状与 App 存进 localStorage['hotel-sim-state'] 完全一致
import { settle } from '../src/settlement.js'
import { writeFileSync } from 'node:fs'

const location = { city: '成都', district: '锦江区', attrs: { 客流: 5, 房价: 5, 租金: 5, 竞争: 5, 人力: 4, 波动: 2 } }
const brand = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const property = { name: '商务区物业', type: '商圈型', area: '2800㎡', rooms: '75间', rent: '高', match: '中' }
const user = { role: 'student', id: 'demo12', name: '演示同学', cloud: false, groupNo: null, className: null, groupRole: null }

// 每周决策集（贴近真实学生：第 1-6 周谨慎，7 周起加码）
const baseDecisions = {
  pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗',
  'member-convert': '强调品质', corporate: '让利签约', 'member-threshold': 5,
  energy: 23, overbook: 2, ota: {}, reputation: '道歉+赔偿', 'hr-optimize': '全员培训',
}

const history = []
let prevGood = null
for (let w = 1; w <= 12; w++) {
  const r = settle({ site: location.attrs, brand, decisions: baseDecisions, week: w, prevGoodRate: prevGood, resolvedCount: 2 })
  prevGood = r.finalGoodRate
  history.push(r)
}
// 经营页真实形态：report=null（结算后才进周报页），history=已完成的 1..11 周，week=12
const state = {
  user, location, brand, property,
  established: true,
  estChoices: { invest: '标准投资', supplier: '本地供应商', tasks: ['证照办理', '物资采购', '人员招聘'] },
  doneDecisions: baseDecisions,
  report: null,
  week: 12,
  history: history.slice(0, 11),
  finished: false,
  welcomed: true,
}
const json = JSON.stringify(state)
writeFileSync(new URL('./_fixture12w.json', import.meta.url), json)
const r12 = history[11]
console.log('✅ fixture 已生成 tests/_fixture12w.json（经营页形态：report=null / week=12）')
console.log('   末周(W11)出租率', history[10].occupancy + '%', '| 出租间数', history[10].occupiedRooms, '| 累计利润', history.reduce((s, h) => s + h.profit, 0))
console.log('   history 条数', state.history.length, '| 存档体积', (json.length / 1024).toFixed(1) + ' KB')
console.log('   W1 keys:', Object.keys(history[0]).join(','))
