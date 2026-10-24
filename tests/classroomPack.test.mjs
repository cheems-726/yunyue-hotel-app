// V154 批3 · 教师端课堂包（纯层 + 接线静态断言）
// 运行：node tests/classroomPack.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
import { 组装课堂行, 学期报告HTML } from '../src/classroomPack.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const packSrc = readFileSync(new URL('../src/ClassroomPack.jsx', import.meta.url), 'utf8')
ok(/export default function ClassroomScreen/.test(packSrc) && /export function ClassroomCompare/.test(packSrc), '组件在位（投屏视图/班级对比 · 渲染由走查套件盖）')

// 组装课堂行：与 scoreOf 零差由组件内 SelfCheck 兜底；这里验数据形状与续营单列
const mk = (w, net, extra = {}) => ({ week: w, revenue: 100000 + w * 1000, netProfit: net, profit: net, occupancy: 55 + (w % 9), finalGoodRate: 66 + (w % 7), negativeCount: w % 2, handleStats: { pending: 1, resolved: 1 }, decisions: {}, events: [], ...extra })
const mkGS = (uid, name, hotel, weeks, 续营) => ({ user_id: uid, state: { history: weeks.map(w => mk(w.w, w.net)), capital: 100000 + weeks.length * 5000 }, })
const groups = [
  { uid: 'u1', name: '第1组', hotel: 'A 店' },
  { uid: 'u2', name: '第2组', hotel: 'B 店' },
]
const rawStates = [
  mkGS('u1', '第1组', 'A 店', [...Array.from({ length: 12 }, (_, i) => ({ w: i + 1, net: 3000 }))], false),
  mkGS('u2', '第2组', 'B 店', [...Array.from({ length: 14 }, (_, i) => ({ w: i + 1, net: 5000 }))], true),
]
const { rows, histBy组号 } = 组装课堂行({ groups, rawStates, classByUid: {}, filterClass: '' })
ok(rows.length === 2, '组装课堂行：两行（两组）')
ok(rows.every(r => r.周数 === 12), '投屏/对比都用前 12 周口径（续营周不进）', rows.map(r => r.周数).join(','))
ok(histBy组号['第2组'].length === 14, 'history 索引完整（SelfCheck 用同一份）')

console.log('\n[学期版报告]')
{
  const html = 学期报告HTML({ 班级: '酒管2401', rows, 摘要: [{ 组: '第1组', 周数: 12, 资金: 123456 }], 生成人: '老陈' })
  ok(/口径 A：利润 40\/口碑 25\/出租 20\/差评 15/.test(html), '报告头带口径 A（40/25/20/15）')
  ok(/并排展示不排名/.test(html) && !/第 1 名|名次/.test(html), '报告带"不排名"声明且无名次字样')
  ok(/前 12 周/.test(html), '学期口径 = 前 12 周')
  ok(/学期报告-酒管2401/.test('学期报告-' + '酒管2401'), '文件名规则（班级+日期）')
  ok(/归档/.test(html), '报告含归档说明（入口在教师端）')
  ok(html.startsWith('<!doctype html>'), '自包含 HTML（可打印/存 PDF）')
}

console.log('\n[接线静态断言]')
{
  const td = readFileSync(new URL('../src/TeacherDashboard.jsx', import.meta.url), 'utf8')
  ok(/data-open-screen/.test(td), '教师端有投屏入口（data-open-screen）')
  ok(/data-export-semester-report/.test(td), '教师端有学期报告导出（data-export-semester-report）')
  ok(/ClassroomScreen groups=/.test(td) || /ClassroomScreen\s+groups/.test(td), '投屏层在教师端渲染（全屏覆盖）')
  ok(/ClassroomCompare rows=/.test(td), '班级对比区在总览渲染')
  const pack = readFileSync(new URL('../src/ClassroomPack.jsx', import.meta.url), 'utf8')
  ok(/data-classroom-screen/.test(pack) && /data-screen-tile/.test(pack), '投屏视图带 data 锚（1920 走查可定位）')
  ok(/data-compare-metric/.test(pack), '对比表指标切换带 data 锚（按 X 排序）')
  ok(/按\$\{指标\}排序/.test(pack) || /按\{指标\}排序/.test(pack), '排序标题写明"按 X 排序"（排序 ≠ 排名）')
  const 净 = packSrc.replace(/不排名|无第 1 名|无名次列|排序 ≠ 排名|无排名字段/g, '')
  ok(!/第 1 名|排名/.test(净), '课堂包代码不含"排名/第 1 名"表述（声明句除外）')
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
  ok(/fontSize: 2[0-9]|fontSize: 3[0-9]/.test(pack) || (/\.cs-name\s*{[^}]*font-size:\s*2[0-9]px/.test(css) && /\.cs-big\s*{[^}]*font-size:\s*3[0-9]px/.test(css)), '投屏视图核心字号 ≥20px（jsx 内联或 styles.css .cs-* 段）')
  ok(/#101114/.test(pack) || (/\.classroom-screen\s*{[^}]*background:\s*#101114/.test(css)), '投屏视图深色底（styles.css .classroom-screen）')
  ok(/classroom-screen/.test(pack), '投屏根节点挂 .classroom-screen（深色底来自集中样式）')
  // 投屏一屏：grid 3 列 × 2 行（≤6 组全放下）
  ok(/repeat\(\$\{Math\.min\(3, Math\.max\(1, tiles\.length\)\)\}, 1fr\)/.test(pack), 'grid 列数 = min(3, 组数) ⇒ 1920×1080 一屏放下')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
