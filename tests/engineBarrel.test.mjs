// 批次 B2-3 · 引擎统一出口（T3.1）验收
// 运行：node tests/engineBarrel.test.mjs   （已挂 run-all）
// 判据：① 出口能取到全部引擎符号 ② 与直接 import 的结果【一模一样】（不是另一份实现）
//       ③ 无重名覆盖（export * 静默覆盖会让"取到的不是你以为的那个"）
//       ④ 出口本身零 DOM 依赖（Node 端可直接 import）
import * as barrel from '../src/engine/index.js'
import { settle as settleDirect } from '../src/settlement.js'
import { simulateWeek as simulateWeekDirect } from '../src/dayEngine.js'
import { migrateSave as migrateSaveDirect } from '../src/stateMigration.mjs'
import { buildDailyReport as buildDailyReportDirect } from '../src/dailyReport.mjs'
import { readFileSync, readdirSync } from 'node:fs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ 批次 B2-3 · 引擎统一出口（T3.1）')

// 期望从出口可见的关键符号（分层抽样）
const EXPECT = [
  // 核心计算
  'settle', 'simulateDay', 'simulateWeek', 'splitExact', 'DAYS_PER_WEEK',
  'ATTR_INIT', 'applyDecisionToAttrs', 'applyWeeklyDecay', 'normalizeAttrs', 'qualityOf',
  'guestOf', 'makeReviewText', 'reviewSeverityOf', 'pickCause',
  'rollLiveReview', 'CAP_WEEK',
  // 派生展示
  'buildDailyReport', 'reconcileWithWeek', 'missingWeeks', 'missingLabel',
  'teachingDayKey', 'inTeachingHours', 'getTitle',
  // 存档口径
  'migrateSave', 'restoreFromCloud', 'withScaleVersion', 'SCALE',
  // 参考资料
  'FRANCHISE_MODEL', 'reproduceHuazhuChain',
  // 站点数据
  'COMPETITORS', 'CUSTOMER_PERSONAS',
]

console.log('\n[1] ① 出口可见性')
{
  const missing = EXPECT.filter(n => !(n in barrel))
  ok(missing.length === 0, `${EXPECT.length} 个关键符号全部可从出口取到${missing.length ? ' → 缺 ' + missing.join(',') : ''}`)
  const total = Object.keys(barrel).length
  ok(total >= 70, `出口共暴露 ${total} 个符号（≥70）`)
}

console.log('\n[2] ② 同一实现：出口取到的函数 === 直接 import 的（引用相等）')
{
  ok(barrel.settle === settleDirect, 'settle：出口与直接 import 是【同一个函数对象】')
  ok(barrel.simulateWeek === simulateWeekDirect, 'simulateWeek：同一个')
  ok(barrel.migrateSave === migrateSaveDirect, 'migrateSave：同一个')
  ok(barrel.buildDailyReport === buildDailyReportDirect, 'buildDailyReport：同一个')
  // 🔴 W2-2 重基线：不再贴死数字 —— 校验【内部自洽】（累计倍数 === 各跳之积）
  const cum = barrel.SCALE_STEPS.reduce((a, st) => a * st.m, 1)
  ok(Math.abs(barrel.SCALE.m - cum) < 1e-6 && barrel.SCALE.IC_NEW > 0 && barrel.SCALE.VERSION_CURRENT === barrel.SCALE_STEPS[barrel.SCALE_STEPS.length - 1].to,
    'SCALE 自洽：m === 各跳之积（' + cum.toFixed(4) + '）· IC_new=' + barrel.SCALE.IC_NEW + ' · 当前版本 v' + barrel.SCALE.VERSION_CURRENT)
}

console.log('\n[3] ② 行为一致：用出口与直接 import 各跑一次，结果逐字节相同')
{
  const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
  const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
  const DEC = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗' }
  const a = settleDirect({ site: SITE, brand: BRAND, decisions: DEC, week: 5, attrs: { quality: 60, reputation: 70, morale: 65 } })
  const b = barrel.settle({ site: SITE, brand: BRAND, decisions: DEC, week: 5, attrs: { quality: 60, reputation: 70, morale: 65 } })
  ok(JSON.stringify(a) === JSON.stringify(b), '同一输入 → 出口版与直连版输出【逐字节相同】')
  // 跨模块协作也走一遍：结算 → 日报 → 迁移
  const daily = barrel.buildDailyReport(b)
  ok(daily.length === 7 && barrel.sumDaily(daily).revenue === b.revenue, '出口版 日报 Σ7天 === 周营收')
  const mig = barrel.restoreFromCloud({ capital: 500000, history: [] })
  ok(mig.state.capital === barrel.SCALE.IC_NEW, '出口版 迁移走 D25（空档 → IC_new）')
}

console.log('\n[4] ③ 无重名覆盖：逐模块核对导出名，冲突必须为 0')
{
  const SRC = new URL('../src/', import.meta.url)
  const files = readdirSync(SRC).filter(f => /\.(js|jsx|mjs)$/.test(f) && !f.startsWith('settle-old') && !f.endsWith('.jsx'))
  const seen = {}
  const dup = {}
  for (const f of files) {
    // 只统计静态 export 名（不动态 import，避免把 jsx 拉进来）
    const src = readFileSync(new URL(f, SRC), 'utf8')
    const names = new Set()
    for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1])
    for (const m of src.matchAll(/export\s+(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1])
    for (const n of names) (seen[n] = seen[n] || []).push(f)
  }
  for (const [n, arr] of Object.entries(seen)) if (arr.length > 1) dup[n] = arr
  const dupNames = Object.keys(dup)
  ok(dupNames.length === 0, `12 类模块的导出名零冲突（冲突 ${dupNames.length} 个）${dupNames.length ? ' → ' + dupNames.map(n => n + '(' + dup[n].join('/') + ')').join(' ') : ''}`)
}

console.log('\n[5] ④ 出口零 DOM 依赖（Node 端可直接 import ⇒ 两端同构前提）')
{
  const src = readFileSync(new URL('../src/engine/index.js', import.meta.url), 'utf8')
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
  ok(!/\b(window\.|document\.|localStorage|sessionStorage|navigator\.|fetch\()/.test(code),
    'engine/index.js 自身零浏览器 API')
  ok(/^export \* from/m.test(code), '纯 re-export（不含逻辑）')
  // 出口能列举出的所有符号，其来源模块都不含浏览器 API（抽样验 3 个核心）
  const core = ['settlement.js', 'dayEngine.js', 'stateMigration.mjs']
  let dirty = []
  for (const f of core) {
    const c = readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
    if (/\b(window\.|document\.|localStorage|sessionStorage|navigator\.)/.test(c)) dirty.push(f)
  }
  ok(dirty.length === 0, `核心模块（${core.join('/')}）零浏览器 API ⇒ 出口可被 Node 直接 import${dirty.length ? ' → ' + dirty.join(',') : ''}`)
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
