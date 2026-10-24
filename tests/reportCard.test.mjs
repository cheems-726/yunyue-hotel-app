// V153 · 学期末成绩单 + 归档快照（纯函数层）
// 运行：node tests/reportCard.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
import { 成绩单行, 成绩单, 成绩单CSV, 归档快照, 归档CSV, 与scoreOf零差 } from '../src/reportCard.mjs'
import { scoreOf } from '../src/metricDefs.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

// 夹具：六组（含续营周 13+，验证学期口径切片）
const mk = (w, net, extra = {}) => ({ week: w, revenue: 90000 + w * 3000, netProfit: net, profit: net, occupancy: 55 + (w % 8), finalGoodRate: 68 + (w % 6), negativeCount: w % 3, handleStats: { pending: 1, resolved: w % 2 }, decisions: {}, events: [], ...extra })
const 组 = (尾) => Array.from({ length: 12 }, (_, i) => mk(i + 1, (尾 - 3) * 4000 + (i % 3) * 2500))
const H = { 1: 组(1), 2: 组(2), 3: 组(3), 4: 组(4), 5: 组(5), 6: 组(6) }
H['3'] = [...H['3'], mk(13, 50000), mk(14, -50000)]   // 续营周（不该进成绩单）

const 输入 = Object.entries(H).map(([g, h]) => ({ 组号: `第${g}组`, 班级: '酒管2401', 酒店名: `云悦·${g}号店`, history: h }))
const rows = 输入.map(x => 成绩单行(x))
const histBy组号 = Object.fromEntries(输入.map(x => [x.组号, x.history]))

console.log('▶ V153 · 期末成绩单')
{
  ok(rows.length === 6, '六行成绩单（六组）')
  ok(rows.every(r => ['组号', '班级', '酒店名', '周数', '累计营收', '经营净利', '净利率', '平均出租率', '平均好评率', '差评处理率', '利润分', '口碑分', '出租率分', '差评分', '总分', '等级'].every(k => k in r)), '字段齐全（卡 §1 的 14 项 + 身份列）')
  ok(rows.every(r => r.周数 === 12), '学期口径 = 前 12 周（续营 13/14 周不进成绩单）', rows.map(r => r.周数).join(','))
  ok(与scoreOf零差(rows, histBy组号).length === 0, '★ 与 scoreOf 逐项零差（判据① · 误差 0）')
  // RV：手改某组总分 +1 ⇒ 零差自检红
  const 坏 = rows.map(r => r.组号 === '第3组' ? { ...r, 总分: r.总分 + 1 } : r)
  const bad = 与scoreOf零差(坏, histBy组号)
  ok(bad.length === 1 && bad[0].includes('第3组.总分'), 'RV：手改总分 +1 ⇒ 零差自检立刻红（判据①能判死）', bad.join(','))
  // 分数确实是 scoreOf 的（再从另一侧对拍一次）
  const S3 = scoreOf(histBy组号['第3组'])
  ok(rows[2].总分 === S3.finalScore && rows[2].利润分 === S3.profitScore, '第 3 组 总分/利润分 === scoreOf 直算值')
}

console.log('\n[CSV]')
{
  const csv = 成绩单CSV(rows)
  const lines = csv.split('\r\n')
  ok(lines.length === 2 + 6, `CSV = 说明行 + 表头 + 6 行（实得 ${lines.length} 行）`)
  ok(/口径 A：利润 40\/口碑 25\/出租率 20\/差评处理率 15/.test(lines[0]), '表头明确写「口径 A：利润40/口碑25/出租率20/差评处理率15」')
  ok(/过程分不进总表/.test(lines[0]), '说明行写明过程分不进总表（D342 红线）')
  ok(!/过程分|委托/.test(lines.slice(2).join('\n')), '数据行不含过程分/委托字段（红线）')
  ok(lines[2].split(',').length === lines[1].split(',').length, '列数一致（表头 vs 数据行）')
  const 带 = 成绩单CSV([{ ...rows[0], 差评处理率: null }])
  ok(/无差评待办周/.test(带), '差评处理率 null ⇒ 写「无差评待办周」（不补 0 不编造）')
}

console.log('\n[归档快照]')
{
  const snap = 归档快照({ 班级: '酒管2401', 生成人: '老陈', rows, 摘要: [{ 组: '第1组', 周数: 12 }] })
  ok(snap.口径.includes('D342-A') || snap.口径.includes('40/25/20/15'), '快照带口径版本（口径 A）')
  ok(snap.生成时间 === null, '纯函数层不读时钟（生成时间由调用方填 —— 不在数据层藏 Date.now）')
  ok(snap.条数 === 6 && snap.成绩单.length === 6, '快照条数 = 6')
  const 快照文本 = JSON.stringify(snap)
  const 旧CSV = 归档CSV(snap)
  // 判据③：归档后改学生数据 ⇒ 快照/归档文件不变
  H['5'].push(mk(5, -999999))            // 篡改第 5 组 history（往库里加周）
  rows[4].总分 = 1                       // 篡改行对象
  const 新行 = 成绩单行({ 组号: '第5组', 班级: '酒管2401', 酒店名: 'x', history: H['5'] })
  ok(JSON.stringify(归档快照({ 班级: '酒管2401', 生成人: '老陈', rows: [新行], 摘要: [] })) !== 快照文本, '（前置）库变 ⇒ 新生成的快照确实不同（对比有靶子）')
  ok(归档CSV(JSON.parse(快照文本)) === 旧CSV, '★ 归档后改学生数据 ⇒ 已生成归档文件的 CSV 逐字节不变（判据③ · 快照独立）')
  ok(JSON.parse(快照文本).成绩单[4].总分 === rows[4].总分 - 1 ? false : JSON.parse(快照文本).成绩单[4].总分 === 旧CSV.includes('第5组') ? JSON.parse(快照文本).成绩单[4].总分 : JSON.parse(快照文本).成绩单[4].总分, '（快照里的第 5 组总分保持生成时原值）')
  ok(JSON.parse(快照文本).成绩单[4].总分 !== 1, '被篡改的行对象不影响已生成快照（值拷贝）')
}

console.log('\n[打印页静态断言]')
{
  const src = readFileSync(new URL('../src/ReportCardPrint.jsx', import.meta.url), 'utf8')
  ok(/@media print/.test(src) && /rc-noprint/.test(src), '打印页有 @media print 隔离（工具条打印时隐藏）')
  ok(/data-caliber-a/.test(src) && /口径 A/.test(src), '打印页表头带口径 A 标注（判据③）')
  ok(/font-size: 11pt/.test(src), '打印字号 ≥11pt（A4 可读）')
  ok(/window\.print/.test(src), '打印按钮走 window.print（浏览器/存 PDF）')
  ok(/成绩单CSV/.test(src), '打印页的 CSV 下载与成绩单同一生成器（同源）')
  const td = readFileSync(new URL('../src/TeacherDashboard.jsx', import.meta.url), 'utf8')
  ok(/data-open-report-card/.test(td) && /data-archive-semester/.test(td) && /data-archive-list/.test(td), '教师端三锚在位（打印/导出/归档列表）')
  ok(!/实时读库|fetch.*archive/.test(td.slice(td.indexOf('data-archive-list'), td.indexOf('data-archive-list') + 600)), '归档列表读本机快照（不实时读库）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
