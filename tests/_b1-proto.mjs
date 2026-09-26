// B1 验证原型：确定性架构 —— 三种在线模式终值必须完全一致（公平性核心断言）
//
// 被验证的设计（用户给的判断）：
//   decisionLog = [{ day, item, to, at }]（只追加）
//   snapshotAt(D) = 每个 item "day <= D 的最后一条"
//   seedOf(D) = hash(classId, D)（与"什么时候算"无关）
//   state(D) = state(D-1) + simulateDay 结果（链式）
//   次日生效：游戏日 D 提交 → day = D+1 ⇒ snapshotAt(D) 不含当天变更 ⇒ 无竞态
//
// 本脚本用【真实引擎】当 simulateDay 的替身（因为一期日引擎还是"周拆天"），
// 但架构断言与引擎实现无关：只要 simulateDay 是纯函数，三种模式终值就必然相同。
// 运行：node tests/_b1-proto.mjs
import { settle } from '../src/settlement.js'
import { ATTR_INIT, applyDecisionToAttrs, normalizeAttrs } from '../src/attrs.js'

// ── 架构层（将来放 src/ 的最小实现，先在原型里验证） ──
// hash：FNV-1a 32 位（确定性，跨设备一致 —— 不用 Math.random、不用 Date）
export function hash32(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h >>> 0
}
export const seedOf = (classId, day) => hash32(classId + '|' + day)

// decisionLog → 第 D 天生效的快照（day <= D 的最后一条）
export function snapshotAt(log, D) {
  const snap = {}
  for (const e of log) if (e.day <= D) snap[e.item] = e.to
  return snap
}

// 天引擎替身：一期用"周结算 + 天序号"近似（纯函数即可，架构断言与其实现无关）
function simulateDay({ dayIndex, decisions, state, seed }) {
  const week = Math.ceil(dayIndex / 7)
  // 同周 7 天共享一次 settle（真实引擎按周触发）；用 seed 只决定"这一天的实现细节"占位
  const r = settle({ site: state.site, brand: state.brand, decisions, week, attrs: state.attrs, prevGoodRate: state.prevGoodRate, prevCapital: state.capital, pendingNegatives: state.pending, resolvedCount: state.resolved })
  return { result: r, isWeekEnd: dayIndex % 7 === 0 }
}

// ── 三种在线模式（同一 decisionLog，只是"什么时候算"不同） ──
function runMode({ log, classId, mode, DAYS = 28 }) {
  let state = { site: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }, brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }, attrs: { ...ATTR_INIT }, prevGoodRate: null, capital: null, pending: 0, resolved: 0 }
  const weekResults = []
  let lastComputedDay = 0
  // "打开 App"的时刻由 mode 决定；每次打开 → 补算 (lastComputedDay, classDay] 的所有天
  const openDays = mode === 'always' ? Array.from({ length: DAYS }, (_, i) => i + 1)
    : mode === 'every2' ? [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28]
    : [28]                                   // 'final'：期末才打开一次
  for (const classDay of openDays) {
    for (let D = lastComputedDay + 1; D <= classDay; D++) {
      const snap = snapshotAt(log, D)
      const day = simulateDay({ dayIndex: D, decisions: snap, state, seed: seedOf(classId, D) })
      if (day.isWeekEnd) {
        state.prevGoodRate = day.result.finalGoodRate
        state.capital = day.result.capital
        state.attrs = normalizeAttrs(day.result.attrsAfter)
        const negCards = day.result.generatedReviews.filter(x => Number(x.stars) <= 3).length
        state.resolved = Math.ceil(negCards * 0.5)
        state.pending = Math.max(0, state.pending + negCards - state.resolved)
        weekResults.push(day.result)
      }
      lastComputedDay = D
    }
  }
  return { weeks: weekResults.map(r => [r.occupancy, r.finalGoodRate, r.negativeCount, r.profit, r.capital]), lastComputedDay }
}

// 决策日志：同一份（三种模式都用它）；次日生效语义 = 学生在游戏日 D 提交 → day = D+1
const LOG = [
  { day: 2, item: 'pricing', to: '不跟降' },
  { day: 4, item: 'shifts', to: '满编保服务' },
  { day: 6, item: 'hygiene', to: '停房深清洁' },
  { day: 9, item: 'pricing', to: '跟降 10%' },      // 第 9 天改变主意
  { day: 15, item: 'linen', to: '自洗' },
  { day: 20, item: 'reputation', to: '道歉+赔偿' },
]

export function runDemo() {
console.log('▶ B1 原型：三种在线模式终值一致性（28 天 = 4 周）')
const a = runMode({ log: LOG, classId: 'CLASS-A', mode: 'always' })
const b = runMode({ log: LOG, classId: 'CLASS-A', mode: 'every2' })
const c = runMode({ log: LOG, classId: 'CLASS-A', mode: 'final' })
const sig = (x) => JSON.stringify(x.weeks)
console.log('  全程在线 ：', sig(a).slice(0, 60) + '…')
console.log('  隔天打开 ：', sig(b).slice(0, 60) + '…')
console.log('  期末一次 ：', sig(c).slice(0, 60) + '…')
console.log(sig(a) === sig(b) && sig(b) === sig(c)
  ? '  ✅ 三种模式终值完全一致（F1 公平性成立：结果只依赖决策与天，不依赖在线行为）'
  : '  ❌ 不一致 —— 设计被证伪，需要排查')
console.log('  补算游标 lastComputedDay：', a.lastComputedDay, b.lastComputedDay, c.lastComputedDay)
console.log('\n  附加断言：seedOf 确定性 & 天间独立性')
console.log('  seedOf(CLASS-A, 5) 两次：', seedOf('CLASS-A', 5), seedOf('CLASS-A', 5), seedOf('CLASS-A', 5) === seedOf('CLASS-A', 5) ? '相同 ✓' : '不同 ✗')
console.log('  不同天 seed 不同：', seedOf('CLASS-A', 5) !== seedOf('CLASS-A', 6) ? '✓' : '✗')
console.log('  不同班 seed 不同：', seedOf('CLASS-A', 5) !== seedOf('CLASS-B', 5) ? '✓' : '✗')
}
// 直接运行本文件时执行演示；被 import 时只导出纯函数
if (import.meta.url === 'file://' + process.argv[1].split('\\').pop()) runDemo()
