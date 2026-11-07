// V189 · 每周 9 项重点（课堂模式）：主题 6 + 异常 3 —— 纯函数守门
import { 主题六项, 异常三项, 本周重点, 分组 } from '../src/weeklyFocus.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ V189 · 每周 9 项（课堂模式）')

// ① 主题 6：每周 6 项、无重复；12 周并集 = 18 项，每项出现 4 次
{
  const all = []
  for (let w = 1; w <= 12; w++) {
    const six = 主题六项(w)
    ok(six.length === 6 && new Set(six).size === 6, `第 ${w} 周主题 6 项且不重复`)
    all.push(...six)
  }
  const uniq = [...new Set(all)]
  ok(uniq.length === 18, `12 周并集覆盖 18 项（实得 ${uniq.length}）`)
  const 次数 = {}
  for (const id of all) 次数[id] = (次数[id] || 0) + 1
  ok(Object.values(次数).every(n => n === 4), '每项在 12 周里各出现 4 次', JSON.stringify(次数))
  ok(Object.values(分组).flat().length === 18 && new Set(Object.values(分组).flat()).size === 18, '分组表 = 18 项且不重复')
}

// ② 异常 3：按上周结果分支
{
  ok(JSON.stringify(异常三项({ report: null })) === JSON.stringify(['report-diagnosis', 'overbook', 'emergency']), '第 1 周（无报告）→ 看数/超订/应急')
  ok(JSON.stringify(异常三项({ report: { 平均出租率: 0.42 } })) === JSON.stringify(['ota', 'campaign', 'pricing']), '出租率 <55% → 渠道/活动/价格')
  ok(JSON.stringify(异常三项({ report: { 平均出租率: 0.8, 差评数: 3 } })) === JSON.stringify(['quality-check', 'hygiene', 'reputation']), '差评 ≥2 → 质检/卫生/口碑')
  ok(JSON.stringify(异常三项({ report: { 平均出租率: 0.8, 平均好评率: 85 } })) === JSON.stringify(['quality-check', 'hygiene', 'reputation']), '好评率 <88% → 服务三件')
  ok(JSON.stringify(异常三项({ report: { 平均出租率: 0.8, 平均好评率: 95 }, capital: 100000 })) === JSON.stringify(['energy', 'hr-optimize', 'linen']), '资金 <30 万 → 成本三件')
}

// ③ 本周 9 项：长度 9、唯一、必含主题 6
{
  for (let w = 1; w <= 12; w++) {
    const nine = 本周重点({ week: w, report: { 平均出租率: 0.8, 平均好评率: 95 }, capital: 900000 })
    ok(nine.length === 9 && new Set(nine).size === 9, `第 ${w} 周 9 项且不重复`)
    const six = 主题六项(w)
    ok(six.every(id => nine.includes(id)), `第 ${w} 周 9 项包含主题 6 项`)
  }
  // 异常与主题重叠时能补足（第 1 周主题 = 价格+渠道；异常默认含 overbook 与主题重叠）
  const w1 = 本周重点({ week: 1, report: null })
  ok(w1.length === 9 && new Set(w1).size === 9, '重叠时能补足到 9 项且不重复', JSON.stringify(w1))
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
