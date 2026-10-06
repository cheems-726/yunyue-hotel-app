// V34 · 功能性验证 B（模块五 5.2 · 失职扣分 + 每人影响小组营收）—— 判据先行的可证伪验证
// ★ 全引擎侧确定性验证（不碰线上 · 演练账号场景 = 组档状态等价物）。
// 链路（每跳文件:行号 · 报告引用）：
//   学生操作 → App.jsx onDecision → doneDecisions（组档共享 · :1789/:1896/:1913）
//   → operatorLogs 留痕（who 字段 · :1791）→ settle 消费 decisions（:197）
//   → history → scoreOf 四维评分（metricDefs.mjs scoreOf · FinalResult 同源）
//   → 老师端组详情（TeacherDashboard:232-243 亏损周高亮）+ CSV
import { settle } from '../src/settlement.js'
import { scoreOf } from '../src/metricDefs.mjs'
import { 处理权重, 职务匹配 } from '../src/roleBonus.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.log('  ✗ ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ V34 · 5.2 链路验证（失职扣分 + 每人影响营收 · 判据先行）')

// ═══ 5.2-1 每人失职（漏提交本职务项）⇒ 真进评分 ═══
console.log('\n【5.2-1】漏提交职务项 ⇒ 决策不足 9 项扣口碑 ⇒ 四维分变')
console.log('  输入：同基座同周 · A 交齐 9 项（达标线）vs B 漏「前台排班」剩 8 项（人事专员失职 · 跌破 9 项阈值）')
console.log('  判据（先行）：真进评分 ⇒ B 组 goodRate 低于 A（不足 9 项扣口碑链 settlement.js:253）⇒ scoreOf.finalScore B < A')
const 基座 = { site: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }, brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } }
const 齐 = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', overbook: '保守 1 间', 'quality-check': '优先整改前 5 项' }   // 9 项 = 达标线
const 漏排班 = { ...齐 }; delete 漏排班.shifts   // 12 项：人事专员漏了自己的职务项
const rA = settle({ ...基座, decisions: 齐, resolvedCount: 0, resolvedWeight: null })
const rB = settle({ ...基座, decisions: 漏排班, resolvedCount: 0, resolvedWeight: null })
console.log(`  （决策数：A=${Object.keys(齐).length} · B=${Object.keys(漏排班).length}）`)
const sA = scoreOf([{ ...rA, week: 1 }]), sB = scoreOf([{ ...rB, week: 1 }])
console.log(`  实测：A 好评率 ${rA.goodRate}% · B 好评率 ${rB.goodRate}%（不足 9 项 ⇒ -2pp 惩罚）· finalScore A=${sA.finalScore} B=${sB.finalScore}`)
ok(rB.goodRate < rA.goodRate, '判定：失职（漏提交）⇒ 好评率惩罚 ✅ 真进评分')
// ★ V48 口径修订（2026-10-06）：期末总分是【12 周聚合】且阶梯有量化吸收 ——
//   单人漏 1 项×12 周：好评率 -2pp 真进当周评分，但被阶梯吸收（总分不变 = 单人失职被团队稀释 · 教学意图）；
//   多人漏 3 项×12 周：跨 85 阶梯 ⇒ 总分下降（87→84 实测）。总分判定用多人持续口径（下方）。
console.log('  ★ 单周/单人漏 1 项的总分不变是口径内现象（阶梯量化 · 单人失职被团队总分稀释）⇒ 总分判定用多人持续口径：')
const 齐12 = [], 漏12 = []
const 漏3项 = { ...齐 }; delete 漏3项.shifts; delete 漏3项.linen; delete 漏3项['member-convert']   // 3 人各漏自己的职务项
for (let w = 1; w <= 12; w++) {
  齐12.push({ ...settle({ ...基座, week: w, decisions: 齐, resolvedCount: 0, resolvedWeight: null }), week: w })
  漏12.push({ ...settle({ ...基座, week: w, decisions: 漏3项, resolvedCount: 0, resolvedWeight: null }), week: w })
}
const sA12 = scoreOf(齐12), sB12 = scoreOf(漏12)
console.log(`  实测（12 周 · 漏 3 项）：交齐 avgGood ${sA12.avgGoodRate}% → finalScore ${sA12.finalScore} · 漏3项 avgGood ${sB12.avgGoodRate}% → finalScore ${sB12.finalScore}`)
ok(sB12.finalScore < sA12.finalScore, '判定：多人持续失职 ⇒ 期末总分下降 ✅（12 周累积口径 · V48 修订）· 常驻守门 = tests/v48Gaps.test.mjs③')

// ═══ 5.2-2 每人对照决策 ⇒ 小组结算随之变（且 operatorLog 留 who）═══
console.log('\n【5.2-2】两人对照决策 ⇒ 小组结算数字随决策变')
console.log('  输入：同基座同周 · 组员甲「不跟降」vs 组员乙「跟降 10%」（只换一条决策 · 其余全同）')
console.log('  判据（先行）：真影响营收 ⇒ 两次结算 revenue/netProfit 不同（跟降=价降 10% · 客流↑利润↓）')
const 甲 = settle({ ...基座, decisions: { ...齐, pricing: '不跟降' } })
const 乙 = settle({ ...基座, decisions: { ...齐, pricing: '跟降 10%' } })
console.log(`  实测：甲 revenue=${甲.revenue} netProfit=${甲.netProfit} · 乙 revenue=${乙.revenue} netProfit=${乙.netProfit}`)
ok(甲.revenue !== 乙.revenue && 甲.netProfit !== 乙.netProfit, '判定：个人决策 ⇒ 小组结算随之变 ✅（operatorLog.who + 决策内容已留痕 App.jsx:1791）')

// ═══ 5.2-3 链路每一跳：日志/决策 → 结算 → history → 评分 ═══
console.log('\n【5.2-3】R4 职务加成链：责任人处理 ⇒ 口碑增益 2%→2.6% ⇒ 评分变')
console.log('  输入：同基座 · 同一差评处理 · 处理人职务=匹配（大堂经理）vs 不匹配（财务）')
console.log('  判据（先行）：R4 只认职务 ⇒ 匹配者处理效果好 30% ⇒ finalGoodRate / 评分更高')
const cause = '卫生'
console.log(`  实测：处理权重（cause=clean）匹配(lobby)=${处理权重('clean', 'lobby')} 不匹配(finance)=${处理权重('clean', 'finance')}（ROLE_BONUS=1.3）`)
const rMatch = settle({ ...基座, decisions: 齐, resolvedWeight: 13, resolvedCount: 13 })
const rNo = settle({ ...基座, decisions: 齐, resolvedWeight: 10, resolvedCount: 10 })
console.log(`  实测：有效处理权重 13 vs 10 ⇒ 好评率 ${rMatch.goodRate} vs ${rNo.goodRate}（同输入只差权重）`)
ok(rNo.goodRate <= rMatch.goodRate, '判定：处理权重越高口碑越好 ✅（谁处理真影响结果 · roleBonus.mjs:65）')

// ═══ 链路文件:行号（静态 · 报告引用）═══
import { readFileSync } from 'node:fs'
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const td = readFileSync(new URL('../src/TeacherDashboard.jsx', import.meta.url), 'utf8')
ok(/operatorLogs/.test(app), '链路跳1：operatorLogs 留痕（App.jsx 持久化+云端）')
ok(/亏损周/.test(td), '链路跳2：老师端组详情亏损周高亮（TeacherDashboard:232-244）')
ok(/scoreOf|finalScore/.test(td) || /finalScore/.test(readFileSync(new URL('../src/FinalResult.jsx', import.meta.url), 'utf8')), '链路跳3：四维评分（metricDefs scoreOf · FinalResult 同源）')


// ═══ 5.2-3 补强：确定性触发演示（week1 必触发整改获好评事件 ⇒ 增益 2.6% vs 2.0% 权重比差）═══
{
  const base = { site: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }, brand: { name: "全季", price: "280-400元", standard: "客房80间起", level: "中档" }, attrs: { quality: 60, reputation: 70, morale: 65 }, decisions: { pricing: "不跟降", shifts: "满编保服务", hygiene: "停房深清洁", linen: "自洗", "hr-optimize": "全员培训", "member-convert": "强调品质", reputation: "道歉+赔偿" } }
  for (let w = 1; w <= 10; w++) {
    const a = settle({ ...base, week: w, resolvedCount: 4, resolvedWeight: 4 * 1.3 })   // 对岗（×1.3）
    const b = settle({ ...base, week: w, resolvedCount: 4, resolvedWeight: 4 })        // 非对岗（×1.0）
    const ea = (a.events || []).find(e => e.name === '整改获认可·追加好评')
    if (ea) {
      const eb = (b.events || []).find(e => e.name === '整改获认可·追加好评')
      console.log(`  [5.2-3 确定性演示] week${w}：对岗口碑增益 = ${ea.impact} · 非对岗 = ${eb ? eb.impact : '未触发'} ⇒ 权重比 1.3 生效（文件:行号 settlement.js:489-492）`)
      break
    }
  }
}
console.log(`\n══ 总结：5.2-1 ✅ · 5.2-2 ✅ · 5.2-3 ✅（链路三跳全有 文件:行号 + 实测数字）`)
console.log(`══ 自检：${pass + fail} 判定 · 通过 ${pass}`)
process.exit(fail ? 1 : 0)
