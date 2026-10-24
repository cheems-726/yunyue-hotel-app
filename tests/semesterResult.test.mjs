// V152 §1 · 学期成果页纯数据层（只重排 history · 前 12 周口径 · 不排名）
// 运行：node tests/semesterResult.test.mjs   （挂 run-all fast）
import {
  学期切片, 学期成果, 最好最差周, 净利曲线, 回本周, 点评生成, 班级并排,
} from '../src/semesterResult.mjs'
import { TOTAL_WEEKS } from '../src/semester.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

// 夹具：8 周真实形状的 history（续营周 13+ 也放两条进来，验证切片）
const mk = (week, net, extra = {}) => ({ week, revenue: 100000 + week * 1000, netProfit: net, profit: net, occupancy: 60 + (week % 5), finalGoodRate: 70 + (week % 4), decisions: { pricing: '不跟降', shifts: week % 2 ? '满编保服务' : '精简省成本' }, events: [], ...extra })
const H8 = [mk(1, -5000), mk(2, 20000), mk(3, 15000), mk(4, -20000), mk(5, 25000), mk(6, 5000), mk(7, 18000), mk(12, -8000)]
const H13 = [...H8, mk(13, 99000), mk(24, 99000)]

console.log('▶ V152 · 学期成果页（纯重排）')
{
  const a = 学期成果(H8), b = 学期成果(H13)
  ok(a.周数 === 8 && b.周数 === 8, `学期切片只取第 1–${TOTAL_WEEKS} 周（续营 13/24 周不进成果：8 === 8）`, `${a.周数}/${b.周数}`)
  ok(JSON.stringify(a) === JSON.stringify(b), 'RV 前置：续营周加入后成果逐字节不变（前 12 周成果不被覆盖）')
  ok(a.经营净利 === H8.reduce((s, h) => s + h.netProfit, 0), '经营净利 = 逐周净利和（未重算引擎）', String(a.经营净利))
  ok(Number.isFinite(a.净利率) && Math.abs(a.净利率 - a.经营净利 / a.营收) < 1e-12, '净利率 = 经营净利 ÷ 营收')
  ok(a.期末出租率 === 62 && a.好评率 === 70, '期末出租率/好评率 = 最后一周的值', `${a.期末出租率}/${a.好评率}`)
}

console.log('\n[最好/最差周 · RV]')
{
  const { 最好, 最差 } = 最好最差周(H8)
  ok(最好.周次 === 5 && 最差.周次 === 4, `最好=第5周(+25000) 最差=第4周(−20000)（实得 ${最好.周次}/${最差.周次}）`)
  ok(Array.isArray(最好.策略) && 最好.策略.length >= 1, '最好周带关键策略（来自 decisions 快照）', 最好.策略.join('、'))
  ok(最好.依据 && 最好.依据.netProfit === 25000, '依据带该周 netProfit 原值（页面可点开）')
  // RV：改 history 某一周 ⇒ 最好/最差跟着变（不许缓存写死）
  const H9 = H8.map(h => h.week === 3 ? { ...h, netProfit: 99999, profit: 99999 } : h)
  const r2 = 最好最差周(H9)
  ok(r2.最好.周次 === 3 && r2.最好.依据.netProfit === 99999, 'RV：改第 3 周净利 ⇒ 最好周跟着变（无缓存）', `第${r2.最好.周次}周 ${r2.最好.依据.netProfit}`)
  const H10 = H8.map(h => h.week === 6 ? { ...h, netProfit: -88888, profit: -88888 } : h)
  ok(最好最差周(H10).最差.周次 === 6, 'RV：改第 6 周净利 ⇒ 最差周跟着变')
  const 曲1 = JSON.stringify(净利曲线(H8)), 曲2 = JSON.stringify(净利曲线(H9))
  ok(曲1 !== 曲2, 'RV：改数据 ⇒ 曲线跟着变（同一套数，非独立缓存）')
}

console.log('\n[点评 · 每个数字带依据]')
{
  const claims = 点评生成(H8)
  ok(claims.length >= 2, `点评至少 2 条（实得 ${claims.length}）`)
  ok(claims.every(c => c.文本 && c.依据), '每条点评都带依据字段（页面可点开）')
  // 文本里出现的每个"第 N 周"都必须真实存在于依据里
  const 周 = claims.flatMap(c => [...String(c.文本).matchAll(/第 (\d+) 周/g)].map(m => Number(m[1])))
  const 依据周 = claims.flatMap(c => [...JSON.stringify(c.依据).matchAll(/"week":\s*(\d+)|"周次":\s*(\d+)/g)]).map(m => Number(m[1] || m[2]))
  ok(周.every(w => 依据周.includes(w)), '点评文本提到的每个周次都能在依据里找到（可溯源）', `文本[${周}] 依据[${依据周}]`)
  const 空 = 点评生成([])
  ok(空.length === 0, '空 history ⇒ 零点评（不编造）')
}

console.log('\n[班级并排 · 不排名]')
{
  const rows = [
    { name: '第2组', hotel: 'B 店', history: H8 },
    { name: '第1组', hotel: 'A 店', history: [mk(1, 50000), mk(2, 50000)] },
    { name: '第3组', hotel: 'C 店', history: [] },
  ]
  const out = 班级并排(rows)
  ok(out.map(r => r.组名).join(',') === '第2组,第1组,第3组', '并排保持输入顺序（不排序 ⇒ 无排名）', out.map(r => r.组名).join(','))
  ok(out.every(r => !('名次' in r) && !('排名' in r) && !('score' in r)), '输出行不含名次/得分字段（D342 口径 A）')
  ok(out[0].续营周数 === 0 && out[0].周数 === 8, '班级行同样是前 12 周口径')
  const out2 = 班级并排([{ name: '第9组', history: H13 }])
  ok(out2[0].续营周数 === 2 && out2[0].经营净利 === 学期成果(H8).经营净利, '续营净利单列，不混进学期经营净利（教师端区分学期内/续营）')
}

console.log('\n[回本周]')
{
  // 投入 = 349000（oneTimeFees.合计）；GOP 逐周累计
  const 投 = 349000
  const Hs = Array.from({ length: 8 }, (_, i) => ({ week: i + 1, gop: 60000, oneTimeFees: i === 0 ? { 合计: 投, 开业费用: 投, 保证金: 100000 } : undefined, revenue: 100000, netProfit: 0, profit: 0, occupancy: 60, finalGoodRate: 70 }))
  const r = 回本周(Hs)
  ok(r && r.周次 === 6, `GOP 6 万/周 × 6 周 = 36 万 ≥ 投入 34.9 万 ⇒ 回本周 = 第 6 周（实得 ${r && r.周次}）`)
  const Hs2 = Hs.map(h => ({ ...h, gop: 40000 }))
  ok(回本周(Hs2) === null, '累计 GOP 到不到投入 ⇒ null（不出数、不编造）')
  ok(回本周([]) === null, '空 history ⇒ null')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
