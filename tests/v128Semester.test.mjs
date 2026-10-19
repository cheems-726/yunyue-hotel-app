// V128-#3 批3 · 六组 × 84 天全学期跑测（逐日 tick · 每日委托完成率 · 教师端缺做名单）
// 运行：node tests/v128Semester.test.mjs   （挂 run-all fast）
//
// 判据（卡 §3 批3）：
//   ① 6 组 history 逐周 +1（12 条，无断档）· tick 违规 0
//   ② 每日委托完成率按天统计；教师端能指出"今天谁没做"（不排名）
//   ③ 委托只记录：做与不做，结算结果逐字节相同（零变化）
import { advanceGroupOneDay } from '../src/serverTick.mjs'
import { dayToWeekDay } from '../src/weeklyAuto.mjs'
import { decisions } from '../src/decisions.js'
import { 生成当日委托 } from '../src/dailyQuests.mjs'
import { 今日缺做, 今日天数 } from '../src/dailyQuestTeacher.mjs'
import { 委托完成率 } from '../src/dailyQuestLog.mjs'
import { readFileSync } from 'node:fs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const DEC18 = (() => {
  const o = {}
  for (const d of decisions) {
    if (d.type === 'option' || d.type === 'timer') o[d.id] = d.options[0].label
    else if (d.type === 'slider') o[d.id] = d.min ?? 0
    else if (d.type === 'budget') {
      const a = Math.floor(d.total / d.items.length)
      o[d.id] = Object.fromEntries(d.items.map((it, i) => [it, a + (i === 0 ? d.total - a * d.items.length : 0)]))
    } else if (d.type === 'sort') o[d.id] = [...d.items]
  }
  return o
})()
const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2, district: '锦江区' }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const 新档 = (gk) => ({ __groupKey: gk, week: 1, location: SITE, brand: BRAND, attrs: { quality: 60, reputation: 70, morale: 65 }, capital: 1490000, history: [], doneDecisions: {}, bizMode: 'direct' })

console.log('▶ V128-#3 批3 · 六组 × 84 天')

console.log('\n[①] 84 天逐日 tick：6 组 history=12 · 违规 0 · 无断档')
{
  const 组们 = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].map(gk => ({ gk, save: 新档(gk), 记录: [], 缺日: false }))
  for (const g of 组们) {
    for (let d = 1; d <= 84; d++) {
      const { dayIndex, week } = dayToWeekDay(d)
      // 每周第一天：学生确认进入下一周（week+1）并提交 18 项决策（模拟真实节奏）
      if (dayIndex === 1) g.save = { ...g.save, week, doneDecisions: { ...DEC18 }, weekBase: { 版本: 1, week, decisions: {} } }
      // 每日委托：g6 故意天天不做（用于教师端缺做名单）
      if (g.gk !== 'g6') {
        const q = 生成当日委托({ 种子: g.gk, 组: g.gk, 天: dayIndex, 待处理差评: 1, 天气: '晴', 注入事件: null })[0]
        g.记录.push({ 天: dayIndex, 类: q.类, 选项: q.选项[0].label, 时刻: new Date().toISOString() })
      }
      const r = advanceGroupOneDay(g.save, d, { groupKey: g.gk })
      g.save = r.save
      if (r.violations.length) g.违规 = (g.违规 || 0) + r.violations.length
    }
  }
  ok(组们.every(g => (g.违规 || 0) === 0), '6 组 tick 违规 0', 组们.map(g => `${g.gk}:${g.违规 || 0}`).join(','))
  ok(组们.every(g => g.save.history.length === 12), `6 组 history 各 12 条（${组们.map(g => g.save.history.length).join(',')}）`)
  ok(组们.every(g => { const ws = g.save.history.map(h => h.week); return ws.every((w, i) => w === i + 1) }), '周次逐周 +1（1..12，无断档）')
  ok(组们.every(g => g.save.history.every(h => h.决策数 === 18)), '每周结算都记 决策数=18（没有沿用空周）')

  console.log('\n[②] 每日委托完成率 + 教师端缺做名单（不排名）')
  const g6 = 组们.find(g => g.gk === 'g6')
  ok(委托完成率(g6.记录, 7).文案 === '0/7', 'g6 天天不做 ⇒ 本周 0/7')
  ok(委托完成率(组们[0].记录, 7).文案 === '7/7', 'g1 天天做 ⇒ 本周 7/7')
  const 最后一天 = 今日天数(84)
  ok(最后一天 === 7, `classDay=84 ⇒ 本周第 7 天（实得 ${最后一天}）`)
  const 组s = 组们.map(g => ({
    组: g.gk === 'g6' ? '第6组' : `第${g.gk.slice(1)}组`,
    每日委托: g.记录.filter(r => r.天 === 7),   // 只留本周最后一天（模拟云端只带本周）
  }))
  const r = 今日缺做({ 组s, classDay: 84 })
  ok(r.可判 && r.天 === 7, '教师端可判定：第 7 天')
  ok(r.缺做.length === 1 && r.缺做[0].组 === '第6组', `缺做名单只点名第 6 组（实得 ${r.缺做.map(x => x.组).join(',')}）`)
  ok(今日缺做({ 组s, classDay: 0 }).可判 === false, 'classDay=0 ⇒ 不判定（不误报）')

  console.log('\n[②b] 教师端卡片接线（静态）')
  {
    const td = readFileSync('src/TeacherDashboard.jsx', 'utf8')
    ok(/import \{ 今日缺做 \}/.test(td), '教师端引用 今日缺做 纯函数')
    ok(/今日委托（谁没做）/.test(td), '大屏有「今日委托（谁没做）」卡')
    ok(/缺做 \$\{r\.缺做\.length\} 组/.test(td), '点名缺做组（标红）')
    ok(/只提示缺做，不排名、不计分/.test(td), '明示不排名、不计分')
    const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
    ok(!/\.sort\(/.test(strip(readFileSync('src/dailyQuestTeacher.mjs', 'utf8'))), '缺做名单不排序（不排名）')
  }

  console.log('\n[③] 零变化：做与不做，结算逐字节相同')
  const A = 新档('a'); const B = 新档('b')
  const rec = [{ 天: 1, 类: '差评处理', 选项: '道歉 + 补偿', 时刻: 't' }]
  const ra = advanceGroupOneDay({ ...A, doneDecisions: { ...DEC18 }, weekInputs: { 版本: 1, week: 1, 每日委托: rec } }, 1)
  const rb = advanceGroupOneDay({ ...B, doneDecisions: { ...DEC18 }, weekInputs: { 版本: 1, week: 1, 每日委托: [] } }, 1)
  ok(JSON.stringify(ra.save.history) === JSON.stringify(rb.save.history), '同决策的两组 ⇒ 结算结果逐字节相同（委托记录不在引擎输入里）')
  ok(JSON.stringify(ra.save.history[0]).length > 100, '（对照非空，避免恒真）')
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
