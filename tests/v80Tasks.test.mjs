// V80 · 学生端 12 周任务书守门（2026-10-08 · 挂 run-all fast）
// 判据（卡①②③④）：
//   [1] 结构：12 周连续 · 每周五字段（任务/决策/知识点/交付物/常见错误）齐且成句
//   [2] 数据接地：决策 id ⊆ decisions.js 实表 · 18/18 全覆盖 · 三档口径与 decisionCadence 一致
//   [3] 界面接线：学生端（玩法说明入口 → SemesterTasks 覆盖层）· 教师端（打印版按钮）· 打印可用
//   [4] 数字来源守门：任务书里每个关键数字都能在引擎文件定位（不许"文案有数、引擎无线"）
import { readFileSync } from 'node:fs'
import { 周任务书 } from '../src/semesterTasks.mjs'
import { decisions } from '../src/decisions.js'
import { 档位 as cadenceOf } from '../src/decisionCadence.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

console.log('▶ V80 学生端 12 周任务书')
{
  // [1] 结构
  ok(周任务书.length === 12, '12 周全（不缺周）', String(周任务书.length))
  ok(周任务书.every((w, i) => w.周 === i + 1), '周号 1-12 连续')
  const 缺字段 = 周任务书.filter(w => !w.主题 || !w.任务 || !w.知识点 || !w.交付物 || !w.常见错误 || !Array.isArray(w.决策) || !w.决策.length)
  ok(缺字段.length === 0, '每周五字段齐（主题/任务/决策/知识点/交付物/常见错误）', 缺字段.map(w => w.周).join(','))
  ok(周任务书.every(w => w.任务.length >= 15 && w.知识点.length >= 15 && w.交付物.length >= 5 && w.常见错误.length >= 10), '各字段成句（任务/知识点≥15字 · 交付物≥5 · 常见错误≥10）')

  // [2] 数据接地
  const 实表 = new Set(decisions.map(d => d.id))
  const 野id = 周任务书.flatMap(w => w.决策).filter(id => !实表.has(id))
  ok(野id.length === 0, '决策 id 全在 decisions.js 实表（零野 id）', [...new Set(野id)].join(','))
  const 并集 = new Set(周任务书.flatMap(w => w.决策))
  ok(并集.size === 18, '18/18 决策全被任务书覆盖', `实际 ${并集.size}`)
  const 实时9 = decisions.filter(d => cadenceOf(d.id) === 'realtime').map(d => d.id)
  ok(实时9.length === 9, '实时档实测 9 项（decisionCadence 单源）', String(实时9.length))
  const w1缺 = 实时9.filter(id => !周任务书[0].决策.includes(id))
  const w12缺 = 实时9.filter(id => !周任务书[11].决策.includes(id))
  ok(w1缺.length === 0 && w12缺.length === 0, '开局周与收官周都含全部 9 项实时档（W1「全做一遍」不是空话）', (w1缺.join(',') + '/' + w12缺.join(',')))
  const 一次性出现 = decisions.filter(d => cadenceOf(d.id) === 'onetime').map(d => ({ id: d.id, 周: 周任务书.filter(w => w.决策.includes(d.id)).map(w => w.周) }))
  ok(一次性出现.every(x => x.周.length === 1), '一次性决策各只出现一次（全学期仅此一次的说法与数据一致）', JSON.stringify(一次性出现))
  ok(一次性出现[0]?.周[0] === 3 && 一次性出现[1]?.周[0] === 9, '人力优化=第3周 · 改造投资=第9周（与文案「期中前盘点/投资决策」对应）')

  // [3] 界面接线
  const app = src('App.jsx')
  for (const 标 of ['SemesterTasks', '12 周任务书', 'setTasksOpen']) ok(app.includes(标), `学生端玩法说明页含「${标}」接线`)
  const td = src('TeacherDashboard.jsx')
  for (const 标 of ['SemesterTasks', '12 周任务书（打印版）']) ok(td.includes(标), `教师端含「${标}」`)
  const st = src('SemesterTasks.jsx')
  ok(st.includes("from './semesterTasks.mjs'") && st.includes('周任务书'), '覆盖层数据单源 semesterTasks.mjs（不在界面自拼）')
  ok(st.includes("from './decisions.js'") && st.includes('名称Of'), '决策 id → 名称走 decisions.js 实表')
  ok(st.includes('打印 / 另存 PDF') && st.includes('@media print'), '打印版可用（打印按钮 + @media print）')

  // [4] 数字来源守门（每个数字 → 引擎定位；字面取自引擎原文）
  const 全文 = 周任务书.map(w => [w.任务, w.知识点, w.交付物, w.常见错误].join('；')).join('\n')
  const 引擎 = {
    'decisions.js': src('decisions.js'),
    'settlement.js': src('settlement.js'),
    'teacherEvents.mjs': src('teacherEvents.mjs'),
    'decisionRisk.mjs': src('decisionRisk.mjs'),
    'stateMigration.mjs': src('stateMigration.mjs'),
  }
  const 数字溯源 = [
    ['人力 ×0.92', '×0.92', ['decisions.js']],
    ['单间 52/66 元', '自洗 52 / 外包 66', ['decisions.js']],
    ['裁员口碑 −0.02', '−0.02', ['decisions.js']],
    ['诊断口碑 +0.015', '解决口碑相关 → 好评率 +0.015', ['decisions.js']],
    ['诊断成本 ×0.95', '解决成本相关 → 租金/行政/维护 ×0.95', ['decisions.js']],
    ['活动 +0.15', '营销加成（+0.15', ['decisions.js']],
    ['活动 5000 元', '5000 元×系数', ['decisions.js']],
    ['活动四渠道', '线上广告', ['decisions.js']],
    ['改造 ×1.08', '房价（×1.08）', ['decisions.js']],
    ['改造摊销 2000', '每周摊销（2000 元）', ['decisions.js']],
    ['改造 150 万', '150万改造', ['decisions.js']],
    ['会员门槛 3-10 晚', '区间 3-10 晚', ['decisions.js']],
    ['模板回复 −3%', '扣好评率 3%', ['decisions.js']],
    ['道歉/解释减半', '道歉/解释减半', ['decisions.js']],
    ['维护下沉至 −10%', '触底 -10%', ['settlement.js']],
    ['消防整改 800', '整改费: 800', ['teacherEvents.mjs']],
    ['消防罚 5000+停业 2 天', '罚款 5000 + 停业 2 天', ['teacherEvents.mjs']],
    ['OTA 佣金 11%', '11%佣金', ['settlement.js']],
    ['极端提价零单', '零单', ['decisionRisk.mjs']],
    ['资金预警变黄', '变黄', ['stateMigration.mjs']],
    ['质检前 5 项进预算', '.slice(0, 5)', ['settlement.js']],
  ]
  const 缺源 = 数字溯源.filter(([名, 字面, 文件s]) => !文件s.some(f => 引擎[f].includes(字面)))
  ok(缺源.length === 0, '任务书全部关键数字在引擎定位（21 项溯源）', 缺源.map(x => x[0]).join(','))
  const 任务书提数 = [
    ['0.92', '×0.92'], ['52/66', '52'], ['0.02', '0.02'], ['0.015', '0.015'], ['0.95', '0.95'],
    ['0.15', '0.15'], ['1.08', '1.08'], ['2000', '2000'], ['800', '800'], ['5000', '5000'],
    ['11%', '11%'], ['3%', '3%'], ['10%', '10%'], ['3-10', '3-10'], ['150', '150'],
  ]
  const 缺引用 = 任务书提数.filter(([, 字面]) => !全文.includes(字面))
  ok(缺引用.length === 0, '溯源清单与任务书实际用数对齐（清单不许漏任务书里出现的数）', 缺引用.map(x => x[0]).join(','))
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：12 周五字段齐 · 决策全对齐实表与三档 · 学生/教师两端界面接线 · 关键数字 21 项全溯源引擎')
process.exit(fail ? 1 : 0)
