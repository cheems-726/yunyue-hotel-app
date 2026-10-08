// V75 · 可点击项详情全覆盖守门（2026-10-08 · 挂 run-all fast）
// 判据（对着卡④「每类抽 3 条写进断言 · 点开必须有内容」的常驻化）：
//   [1] 数据完整性：18 项决策全有「依据」（引擎机制名）；32 个选项全有「适用场景/教学点」（四段式的后两段）
//   [2] 渲染接线：DecisionPanel 反馈面板必须渲染「适用场景（怎么办）/教学点/引擎依据」三行 + slider/budget/sort 的「引擎依据」行
//   [3] 文案承诺 ↔ 引擎一致（M1 同族）：「依据」里引用的关键数字必须在 settlement.js 现值中存在
//       （引擎改数 ⇒ 本套件红 ⇒ 强制同步依据文案 —— 防止"文案说的和引擎做的不一样"）
// 运行：node tests/v75Detail.test.mjs
import { readFileSync } from 'node:fs'
import { decisions } from '../src/decisions.js'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ V75 决策详情全覆盖（四段式 + 引擎依据）')

// ── [1] 数据完整性 ──
{
  const 缺依据 = decisions.filter(d => !(typeof d.依据 === 'string' && d.依据.length >= 10))
  ok(缺依据.length === 0, `18 项决策全有「依据」（机制名 ≥10 字）`, 缺依据.map(d => d.id).join(','))
  let 选项数 = 0
  const 缺段 = []
  for (const d of decisions) for (const o of (d.options || [])) {
    选项数++
    if (!(typeof o.适用 === 'string' && o.适用.length >= 1)) 缺段.push(`${d.id}/${o.label}:适用`)
    if (!(typeof o.教学点 === 'string' && o.教学点.length >= 8)) 缺段.push(`${d.id}/${o.label}:教学点`)
  }
  ok(选项数 === 32, `选项总数 32（18 项中 option/timer 型 13 项）`, String(选项数))
  ok(缺段.length === 0, `32 个选项全有「适用场景 + 教学点」且教学点成句（≥8 字）`, 缺段.slice(0, 3).join(','))
  // 依据必须指向真实模块（不许"待补"占位混进来）
  const 占位 = decisions.filter(d => /待补|TODO|占位/.test(d.依据 || ''))
  ok(占位.length === 0, '依据无「待补/TODO/占位」占位句（不编不糊）', 占位.map(d => d.id).join(','))
}

// ── [2] 渲染接线（源码断言 · 剥注释后判）──
{
  const 剥 = f => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')
    .split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
  const dp = 剥('DecisionPanel.jsx')
  ok(/适用场景（怎么办）/.test(dp), '反馈面板渲染「适用场景（怎么办）」行')
  ok(/教学点/.test(dp), '反馈面板渲染「教学点」行')
  ok(/引擎依据/.test(dp), '反馈面板渲染「引擎依据」行')
  const 依据行 = (dp.match(/decision\.依据/g) || []).length
  ok(依据行 >= 4, `引擎依据渲染点 ≥4（选项反馈 1 + slider/budget/sort 各 1）`, String(依据行))
}

// ── [3] 依据引用的引擎数字必须真实存在（M1 承诺一致性同族 · 防"文案与引擎漂移"）──
{
  const eng = readFileSync(new URL('../src/settlement.js', import.meta.url), 'utf8')
    + readFileSync(new URL('../src/deptCosts.mjs', import.meta.url), 'utf8')
  const 样本 = [
    ['布草自洗 52 元/间', /perRoomVariable = 52/],
    ['布草外包 66 元/间', /perRoomVariable = 66/],
    ['精简排班出租率 ×0.94', /occupancy \*= 0\.94/],
    ['满编 +18 元/间', /perRoomVariable \+= 18/],
    ['模板回复 −0.03', /模板回复'\) goodRate -= 0\.03/],
    ['活动营销 +0.15', /marketingBonus \+= 0\.15/],
    ['OTA 佣金 11%', /revenue \* 0\.11/],
    ['协议让利 ×0.95', /price \*= 0\.95/],
    ['培训好评 +0.02', /全员培训'\) goodRate \+= 0\.02/],
    ['裁员人力 ×0.92', /'裁员1人' \? 0\.92 : 1/],
  ]
  for (const [名, re] of 样本) ok(re.test(eng), `依据数字与引擎一致：${名}`)
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：学生点开的每个选项必须四段式齐全；依据文案引用的数字必须能在引擎里找到')
process.exit(fail ? 1 : 0)
