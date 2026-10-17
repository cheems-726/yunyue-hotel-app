// V113-0.3 判据：行业参照系**每格四件套**（值/来源/取数日/置信度）+ 内部自洽（RevPAR ≈ ADR × OCC）
//   反例 RV（可证伪）：删掉任一格的 `来源` ⇒ 四件套红；
//                  把 RevPAR 改成与 ADR×OCC 差 >0.5% ⇒ 自洽红（防手抄/编造）。
import { 行业参照, 参照, 对照, 参照口径 } from '../src/industryBench.mjs'

const bad = []
let 检查数 = 0
const ok = (cond, msg) => { 检查数++; if (!cond) bad.push(msg) }

const 档s = ['经济型', '中档', '中高档', '高档']
ok(Object.keys(行业参照).length === 4, `参照系应覆盖四档（实得 ${Object.keys(行业参照).length}）`)
ok(!!参照口径 && /二星级/.test(参照口径.说明), '必须写明四档→星级的映射口径')

for (const 档 of 档s) {
  const b = 行业参照[档]
  ok(!!b, `${档} 缺参照`)
  if (!b) continue
  for (const 名 of ['OCC', 'ADR', 'RevPAR']) {
    const c = b[名]
    ok(!!c, `${档}.${名} 缺`)
    if (!c) continue
    ok(Number.isFinite(c.值) && c.值 > 0, `${档}.${名} 值应为正数（实得 ${c.值}）`)
    ok(!!c.来源 && c.来源.length > 10, `${档}.${名} 缺来源`)
    ok(/^\d{4}-\d{2}-\d{2}$/.test(String(c.取数日)), `${档}.${名} 取数日格式应为 YYYY-MM-DD`)
    ok(!!c.置信度, `${档}.${名} 缺置信度`)
    ok(!!c.追溯, `${档}.${名} 缺追溯性说明`)
  }
  // 内部自洽：RevPAR 必须 ≈ ADR × OCC（±0.5%）—— 手抄错一格/编数都会在这里露出来
  const 应 = b.ADR.值 * b.OCC.值
  const 差率 = Math.abs(b.RevPAR.值 - 应) / 应
  ok(差率 <= 0.005, `${档} RevPAR 与 ADR×OCC 不自洽（${b.RevPAR.值} vs ${应.toFixed(2)} · 差 ${(差率 * 100).toFixed(2)}%）`)
  // 单调性（同一来源同一季度 ⇒ 档越高，三个指标都应更高）
}
{
  const seq = 档s.map(d => 行业参照[d])
  for (const 名 of ['OCC', 'ADR', 'RevPAR']) {
    const 值s = seq.map(b => b[名].值)
    ok(值s.every((v, i) => i === 0 || v > 值s[i - 1]), `${名} 应随档次递增（${值s.join(' / ')}）`)
  }
}

// 取用接口
ok(参照('中档') === 行业参照['中档'], '参照(档) 应返回该档')
ok(参照('豪华') === null, '未覆盖的档应返回 null（不猜）')
{
  const c = 对照('中档', { occ: 0.5, adr: 240, revpar: 120 })
  ok(c && c.项.length === 3, '对照应给出三项差值')
  const rp = c.项.find(x => x.名 === 'RevPAR')
  ok(rp && Math.abs(rp.差率 - (120 - 101.82) / 101.82) < 1e-9, '对照的差率计算应正确')
  ok(对照('不存在', {}) === null, '未覆盖档的对照应返回 null')
  ok(对照('中档', {}) .项.length === 0, '无实测值时不给差值（不编）')
}

console.log('══ V113-0.3 行业参照系（OCC/ADR/RevPAR × 四档）══')
for (const 档 of 档s) {
  const b = 行业参照[档]
  console.log(`  ${档}（${b.星级}）：OCC ${(b.OCC.值 * 100).toFixed(1)}% · ADR ${b.ADR.值} · RevPAR ${b.RevPAR.值} · 置信度 ${b.OCC.置信度}`)
}
console.log(`  来源：${行业参照['中档'].OCC.来源}`)
console.log(`  追溯：${行业参照['中档'].OCC.追溯}`)
for (const b of bad.slice(0, 8)) console.log('  ✗ ' + b)
console.log(`结果: ${检查数 - bad.length} 通过 / ${bad.length} 失败`)
process.exit(bad.length === 0 ? 0 : 1)
