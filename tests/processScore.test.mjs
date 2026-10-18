// V117 判据：过程分台账（三列 · 归因累加 · 缺数据显「—」不补 0 · CSV 行数 = 组数 · 不并入四维）
//   反例 RV：删一条理由 ⇒ ③ 4→3 且合计 −1；清空归因 ⇒ ② null（不是 0）；改四维口径 ⇒ 本套件不负责但 scoreOf 前后一致
import { 过程分台账, 台账CSV, 台账说明, 结构 } from '../src/processScore.mjs'
import { scoreOf } from '../src/metricDefs.mjs'

const 坏 = []
let 检查数 = 0
const ok = (c, m) => { 检查数++; if (!c) 坏.push(m) }

// ── 判据 1：三列都有数
const 全 = 过程分台账({
  承诺书: 6,
  归因: [{ 填了: true, 过程分: 2 }, { 填了: true, 过程分: 1 }, { 填了: true, 过程分: 2 }],
  理由: ['bizMode', 'property', 'brand', 'invest'],
})
ok(全.承诺书 === 6 && 全.归因 === 5 && 全.理由条数 === 4, `三列应分别 6 / 5 / 4（实得 ${全.承诺书}/${全.归因}/${全.理由条数}）`)
ok(全.合计 === 15, `合计 = 6+5+4 = 15（实得 ${全.合计}）`)
ok(全.满分 === 结构.承诺书满分 + 2 * 3 + 结构.理由满分, `满分 = 8+2×3+4 = 18（实得 ${全.满分}）`)
ok(全.缺.length === 0, '数据齐时 缺项 应为空')

// ── 判据 2：归因累加（2 对 1 错 ⇒ 2×2+1 = 5）——已含在上面；单独再验一次边界
{
  const r = 过程分台账({ 承诺书: 0, 归因: [{ 填了: true, 过程分: 2 }, { 填了: true, 过程分: 2 }, { 填了: true, 过程分: 1 }], 理由: ['a'] })
  ok(r.归因 === 5, `2 对 1 错 ⇒ 5（实得 ${r.归因}）`)
}

// ── 判据 3：缺数据显示「—」，不补 0
{
  const 缺归因 = 过程分台账({ 承诺书: 6, 归因: [], 理由: ['a', 'b'] })
  ok(缺归因.归因 === null, `没作答 ⇒ 归因 null（实得 ${缺归因.归因}）`)
  ok(缺归因.合计 === null, '有列缺失 ⇒ 合计 null（不许把缺的当 0 加进去）')
  ok(缺归因.缺.includes('每周归因'), '缺项要点名「每周归因」')
  const 全缺 = 过程分台账({})
  ok(全缺.承诺书 === null && 全缺.归因 === null && 全缺.理由条数 === null && 全缺.合计 === null, '全缺 ⇒ 四列全 null（不补 0）')
}

// ── 判据 1 的 RV：删一条理由 ⇒ 4→3、合计 −1
{
  const 少 = 过程分台账({ 承诺书: 6, 归因: [{ 填了: true, 过程分: 2 }, { 填了: true, 过程分: 1 }, { 填了: true, 过程分: 2 }], 理由: ['bizMode', 'property', 'brand'] })
  ok(少.理由条数 === 3 && 少.合计 === 全.合计 - 1, `少一条理由 ⇒ 3 条 / 合计 14（实得 ${少.理由条数}/${少.合计}）`)
}

// ── 上限夹取（不许出现 >满分的数字）
{
  const r = 过程分台账({ 承诺书: 99, 归因: [{ 填了: true, 过程分: 9 }], 理由: ['a', 'b', 'c', 'd', 'e'] })
  ok(r.承诺书 === 8 && r.理由条数 === 4, `承诺书夹到 8、理由夹到 4（实得 ${r.承诺书}/${r.理由条数}）`)
}

// ── 判据 4：CSV 行数 = 组数（+1 表头）
{
  const rows = Array.from({ length: 6 }, (_, i) => ({ 组: `第${i + 1}组`, 酒店名: `店${i + 1}`, 台账: 过程分台账({ 承诺书: 5, 归因: [{ 填了: true, 过程分: 1 }], 理由: ['a'] }) }))
  const csv = 台账CSV(rows)
  const 行s = csv.split('\n')
  ok(行s.length === 7, `6 组 ⇒ CSV 7 行（表头+6）· 实得 ${行s.length}`)
  ok(行s[0].startsWith('组,酒店名'), 'CSV 表头应从 组,酒店名 开始')
  // 缺数据显示 —（不是 0）
  const 缺 = 台账CSV([{ 组: '第1组', 酒店名: 'X', 台账: 过程分台账({}) }])
  ok(缺.includes('—'), '缺数据在 CSV 里必须是「—」')
}

// ── 判据 5：不改四维评分（同历史 ⇒ 同分）
{
  const h = [{ week: 1, occupancy: 60, occupiedRooms: 42, rooms: 70, price: 300, revenue: 88200, profit: 1000, goodRate: 80, finalGoodRate: 78, negativeCount: 1, reviewCount: 8, totalCost: 87000 }]
  const a = scoreOf(h), b = scoreOf(h.map(x => ({ ...x })))
  ok(JSON.stringify(a) === JSON.stringify(b), '四维评分对同一历史前后一致（本台账不参与）')
}

// ── 判据 6：文案（红线①）
ok(/不并入四维评分/.test(台账说明), '说明文案必须写明「不并入四维评分」')

// ── 判据 6（V117-⑥ 文案断言）：界面必须渲染那句「不并入四维评分」，且教师端块可导出
{
  const { readFileSync } = await import('node:fs')
  const pl = readFileSync('src/ProcessLedger.jsx', 'utf8')
  ok(/{台账说明}/.test(pl), 'ProcessLedger 必须**渲染** {台账说明}（不是只 import）')
  ok(/缺数据显/.test(pl), 'ProcessLedger 必须写明「缺数据显—（没交 ≠ 0 分）」')
  const td = readFileSync('src/TeacherDashboard.jsx', 'utf8')
  ok(/<ProcessLedger/.test(td) && /<details/.test(td), '教师端：折叠块 + ProcessLedger 已接')
  ok(td.includes('台账CSV(rows)') && td.includes('过程分台账.csv'), '教师端：CSV 导出真的拼了台账 CSV')
}

console.log('══ V117 过程分台账 ══')
console.log(`  三列：承诺书 8 + 归因 2/周 + 理由 4 ⇒ 本例满分 ${全.满分} · 合计 ${全.合计}`)
for (const b of 坏.slice(0, 8)) console.log('  ✗ ' + b)
console.log(`结果: ${检查数 - 坏.length} 通过 / ${坏.length} 失败`)
process.exit(坏.length === 0 ? 0 : 1)
