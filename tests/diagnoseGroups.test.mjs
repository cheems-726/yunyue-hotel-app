// V113-2.6 判据：诊断组合（三条组合矛盾）· **不做排名** · 归因未填的组能标出
import { 诊断组合, 归因未填的组 } from '../src/diagnoseGroups.mjs'

const bad = []
let 检查数 = 0
const ok = (cond, msg) => { 检查数++; if (!cond) bad.push(msg) }

// 三组：A 健康 · B RevPAR 高但 GOP 率低 · C 满房但低价
const mk = (week, occ, price, gopRate, cost) => ({
  week, occupancy: Math.round((occ / 70) * 100), occupiedRooms: occ, rooms: 70, price,
  revenue: occ * price * 7, gop: Math.round(occ * price * 7 * gopRate),
  totalCost: Math.round(occ * price * 7 * (1 - gopRate / 2)),
  weeklyExpenses: cost,
})
const 健康 = mk(4, 55, 300, 0.42, { 客房变动成本: 20000, 客房部固定: 4000, 人力固定: 9000, 公区能耗: 2000, 行政管理: 3000, 维修保养: 2000, 营销推广: 3000, OTA佣金: 4000 })
const 薄利 = mk(4, 62, 300, 0.15, { 客房变动成本: 22000, 客房部固定: 4000, 人力固定: 9000, 公区能耗: 2000, 行政管理: 3000, 维修保养: 2000, 营销推广: 30000, OTA佣金: 20000 })
const 满房低价 = mk(4, 63, 200, 0.20, { 客房变动成本: 22000, 客房部固定: 4000, 人力固定: 9000, 公区能耗: 2000, 行政管理: 3000, 维修保养: 2000, 营销推广: 3000, OTA佣金: 4000 })
const 组s = [{ 名: 'G1', 行: 健康 }, { 名: 'G2', 行: 薄利 }, { 名: 'G3', 行: 满房低价 }]

const r = 诊断组合(组s)
ok(r.length === 3, '三组都应有一行诊断结果')
ok(r.map(x => x.名).join(',') === 'G1,G2,G3', '输出顺序 = 输入顺序（不做排名/不排序）')
ok(!r.some(x => '排名' in x || '分数' in x || '名次' in x), '输出不得包含排名/名次/分数字段')

const g2 = r.find(x => x.名 === 'G2')
ok(g2.诊断.some(d => d.k === 'revpar-高-gop-低'), `G2 应命中"RevPAR 高但 GOP 率低"（实得 ${g2.诊断.map(d => d.k).join(',')}）`)
ok(g2.诊断.some(d => d.k.startsWith('成本异常:')), 'G2 应同时命中成本异常（营销/OTA 佣金偏高）')
const g3 = r.find(x => x.名 === 'G3')
ok(g3.诊断.some(d => d.k === 'occ-高-adr-低'), `G3 应命中"出租率高但 ADR 低"（实得 ${g3.诊断.map(d => d.k).join(',')}）`)
const g1 = r.find(x => x.名 === 'G1')
ok(g1.诊断.length === 0, `G1 健康 ⇒ 不应有诊断（实得 ${JSON.stringify(g1.诊断)}）`)

// 缺成本明细 ⇒ ③ 跳过（不猜）
{
  const 缺 = { 名: 'G4', 行: { week: 4, occupancy: 60, occupiedRooms: 42, rooms: 70, price: 300, revenue: 88200, gop: 40000 } }
  const x = 诊断组合([缺])[0]
  ok(!x.诊断.some(d => d.k.startsWith('成本异常')), '缺成本明细 ⇒ 不得产出成本异常诊断')
}

// 归因未填的组
{
  const logs = [{ decision_id: '归因-W4', group_key: 'G1:A' }]
  const 未 = 归因未填的组([{ 名: 'G1', groupKey: 'G1:A' }, { 名: 'G2', groupKey: 'G2:B' }], logs, 4)
  ok(未.length === 1 && 未[0].名 === 'G2', `只有未填的组应被标出（实得 ${JSON.stringify(未)}）`)
}

console.log('══ V113-2.6 教师端诊断组合（不做排名）══')
for (const x of r) console.log(`  ${x.名}: ${x.诊断.length ? x.诊断.map(d => '·' + d.文本).join(' ') : '（无异常）'}`)
for (const b of bad.slice(0, 8)) console.log('  ✗ ' + b)
console.log(`结果: ${检查数 - bad.length} 通过 / ${bad.length} 失败`)
process.exit(bad.length === 0 ? 0 : 1)
