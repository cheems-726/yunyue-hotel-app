// V131 §1-E · 思维看板：押注偏差排序（讲评顺序，不是排名）+ 理由/复盘派生
// 运行：node tests/thinkingBoard.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
import { 思维行, 排序思维行 } from '../src/thinkingBoard.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const 组 = (i, extra = {}) => ({ 组: `第${i}组`, week: 2, state: { 本周押注: { week: 2, 出租率: 60 + i, 净利方向: '小幅盈利' }, 押注历史: [{ week: 2, 出租率: 60 + i, 实际出租率: 70, 实际方向: '小幅盈利', 误差: Math.abs(60 + i - 70), 总分: 10 }], 决策理由: { renovation: { week: 2, 文本: '理由A' } }, 复盘: [{ week: 2, 三问: ['a'.repeat(20), 'b'.repeat(20), 'c'.repeat(20)] }], ...extra } })

console.log('▶ V131 §1-E · 思维看板')

console.log('\n[①] 单行派生：押注/实际/得分/偏差/理由/复盘')
{
  const r = 思维行(组(1))
  ok(r.押注 && r.押注.出租率 === 61, '押注值带出')
  ok(r.实际出租率 === 70 && r.实际方向 === '小幅盈利', '实际值与方向带出')
  ok(r.得分 === 10 && r.偏差 === 9, `得分/偏差（实得 ${r.得分}/${r.偏差}）`)
  ok(r.理由条数 === 1 && r.理由s.find(x => x.id === 'renovation').文本 === '理由A', '关键理由原文 + 条数')
  ok(Array.isArray(r.复盘) && r.复盘.length === 3, '三问复盘带出')
  ok(Array.isArray(r.开局) && r.开局.length === 6, '开局 6 步取舍都在（V132 §2 上桌）')
  const 有开局 = 思维行(组(2, { 认领取舍: { apply: '只报这 1 个（2 天）', decision: '中投入 · 平衡' }, 认领取舍理由: { decision: '现金紧，先保开业' } }))
  const 意向 = 有开局.开局.find(x => x.key === 'apply')
  ok(意向.选 === '只报这 1 个（2 天）' && 意向.放弃.includes('同时报 3 个（多花 50000 元调研费）'), '开局：选了什么 + 放弃了什么')
  const 决策 = 有开局.开局.find(x => x.key === 'decision')
  ok(决策.理由 === '现金紧，先保开业', '开局：需理由的步骤带出理由原文')
  const 未押 = 思维行({ 组: '第9组', state: {}, week: 2 })
  ok(未押.押注 === null && 未押.偏差 === -1, '未押注 ⇒ null / 偏差 -1（排最后）')
}

console.log('\n[②] 排序 = 按偏差从大到小（不排名）')
{
  const rows = [
    思维行(组(1)),   // 偏差 9
    思维行(组(3)),   // 偏差 7
    思维行({ 组: '第5组', state: { 本周押注: { week: 2, 出租率: 70, 净利方向: '小幅盈利' } }, week: 2 }),  // 待结算 ⇒ null
    思维行({ 组: '第6组', state: {}, week: 2 }),  // 未押 ⇒ -1
    思维行(组(2)),   // 偏差 8
  ]
  const 排 = 排序思维行(rows)
  const 偏差s = 排.map(r => r.偏差)
  ok(偏差s[0] === 9 && 偏差s[1] === 8 && 偏差s[2] === 7, `前 3 = 9/8/7（实得 ${偏差s.join('/')}）`)
  ok(偏差s.slice(-2).every(x => x === null || x === -1), '未结算/未押注排最后')
  ok(排.findIndex(r => r.组 === '第6组') > 排.findIndex(r => r.组 === '第1组'), '未押注不排在有数据的组前面')
  ok(排序思维行(rows).length === rows.length, '排序不丢行（六组齐全）')
}

console.log('\n[③] 教师端接线（静态）：可展开 · 标明不排名')
{
  const td = readFileSync('src/TeacherDashboard.jsx', 'utf8')
  ok(/思维看板（押注 \/ 理由 \/ 三问复盘/.test(td), '折叠块标题在位')
  ok(/按押注偏差排序/.test(td) && /不是排名/.test(td), '标明按偏差排序、不是排名')
  ok(/排序思维行\(/.test(td) && /思维行\(/.test(td), '使用纯派生/排序函数（界面不自算）')
  ok(/关键理由：/.test(td) && /三问复盘：/.test(td), '理由原文与三问复盘都能展开看')
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
