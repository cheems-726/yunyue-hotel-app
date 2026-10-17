// V113-2.5 判据：归因不卡关 · 填了就有过程分 · 答对再加 · 真值按 ΔRevPAR 分解
import { 设置存储, 写归因, 读归因, 真值, 判分, 过程分合计, 清空归因, 归因选项 } from '../src/attribution.mjs'

const map = new Map()
设置存储({ getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) })

const bad = []
let 检查数 = 0
const ok = (cond, msg) => { 检查数++; if (!cond) bad.push(msg) }

// 夹具：上周→本周
const 前 = { week: 2, occupancy: 50, price: 300 }
const OCC驱动 = { week: 3, occupancy: 70, price: 300 }   // 出租率 +20pt，房价不动
const ADR驱动 = { week: 3, occupancy: 50, price: 420 }   // 房价 +120，出租率不动
const 都不主要 = { week: 3, occupancy: 51, price: 303 }  // 都很小

ok(真值(前, OCC驱动) === 'OCC', `出租率驱动应判 OCC（实得 ${真值(前, OCC驱动)}）`)
ok(真值(前, ADR驱动) === 'ADR', `房价驱动应判 ADR（实得 ${真值(前, ADR驱动)}）`)
ok(真值(前, 都不主要) === '都不主要', `微小变化应判"都不主要"（实得 ${真值(前, 都不主要)}）`)
ok(真值(null, ADR驱动) === null, '缺上一周 ⇒ 真值 null（不猜）')

// 未填：0 分，且不抛（= 不卡关 · 模块本身没有"必须填"的闸）
{
  const r = 判分(3, 前, OCC驱动)
  ok(r.填了 === false && r.过程分 === 0, '未填 ⇒ 过程分 0（但不是错误）')
  ok(读归因(3) === null, '未填 ⇒ 无记录（不补）')
}

// 填错：1 分（填了本身有分）
写归因(3, 'ADR')
{
  const r = 判分(3, 前, OCC驱动)
  ok(r.填了 === true && r.命中 === false && r.过程分 === 1, `填错 ⇒ 1 分（实得 ${JSON.stringify(r)}）`)
}

// 填对：2 分
清空归因()
写归因(3, 'OCC')
{
  const r = 判分(3, 前, OCC驱动)
  ok(r.命中 === true && r.过程分 === 2, `填对 ⇒ 2 分（实得 ${JSON.stringify(r)}）`)
  ok(!!(读归因(3) || {}).at, '归因应带时间戳')
}

// 非法选项
ok(写归因(4, '随便') === null && 读归因(4) === null, '非法选项不得写入')

// 合计：两周（W2 无前序 ⇒ 0；W3 已填对 ⇒ 2）
{
  const h = [{ week: 1, occupancy: 50, price: 300 }, { week: 2, occupancy: 52, price: 300 }, { week: 3, occupancy: 70, price: 300 }]
  const 合 = 过程分合计(h)
  ok(合 === 2, `过程分合计应为 2（W3 作答）· 实得 ${合}`)
}

ok(归因选项.length === 3 && 归因选项.map(x => x.k).includes('都不主要'), '三个选项齐全（含"都不主要"）')

console.log('══ V113-2.5 归因题（不卡关 · 过程分）══')
console.log(`  真值：OCC驱动→${真值(前, OCC驱动)} · ADR驱动→${真值(前, ADR驱动)} · 微小→${真值(前, 都不主要)}`)
for (const b of bad.slice(0, 8)) console.log('  ✗ ' + b)
console.log(`结果: ${检查数 - bad.length} 通过 / ${bad.length} 失败`)
process.exit(bad.length === 0 ? 0 : 1)
