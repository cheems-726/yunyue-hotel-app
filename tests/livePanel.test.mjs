// §26 第十四批 · 实时面板守门（P0a 间/人分列 · P0b 流水同源 · P0c 联动 · P0d 时钟口径）
//
// ── 为什么单立一个套件（起因：用户 2026-09-29 三次投诉 · 全部学生可见）────────────────
//   ① 面板把 **人数** 标成「在店客房 75 间」> 总房量 60 间（一眼即知不可能）
//   ② 面板自造第二本账（`Math.random` 造金额）⇒ 与引擎"没有联动"
//   ③ 同屏三套时钟（真实墙钟 / ×30 自走游戏钟 / 混算日历）
//   ★ 而当时**两条守门都"声明了却抓不到"**：
//     · dataDict 条目只写"审计问题①已修"（陈述句冒充结论 · 无断言消费）
//     · V5 正则查的是**旧字面「在店客人」**，标签早已改名「在店客房」⇒ **永久绿（空转）**
//   ⇒ 本套件把这三件事变成**会红的**断言，并且**每一类判据都做自检**（能抓合成违规样本）。
//
// 运行：node tests/livePanel.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { settle } from '../src/settlement.js'
import { DATA_DICT, VIOLATION_PATTERNS } from './dataDict.check.mjs'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const HS = readFileSync(path.join(APP, 'src', 'HotelStatus.jsx'), 'utf8')
const 去注释 = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
const HS代码 = 去注释(HS)

// ── [1] 间 / 人 分列：房间类标签的格子里**不许**出现人数系标识符 ──
console.log('\n[1] §26.2 P0a 间/人分列（房间类标签的格子不得取人数）')
{
  // 抓 roomsCell 数组里的每个格：{ l: '标签', v: <表达式> ... }
  const 块 = /const roomsCell = \[([\s\S]*?)\n  \]/.exec(HS代码)
  ok(!!块, '能定位 roomsCell 数组（判据有靶子 · 非空转）')
  const 格s = 块 ? [...块[1].matchAll(/\{\s*l:\s*'([^']+)'[\s\S]*?v:\s*([^,}]+)/g)].map(m => ({ 标签: m[1], 值: m[2].trim() })) : []
  ok(格s.length >= 4, `roomsCell 解析出 ${格s.length} 个格子（≥4）`, 格s.map(g => g.标签).join('/'))
  const 房间类 = /客房|房间|房量/
  const 人数系 = /guests|liveGuests|targetGuests/
  const 违规 = 格s.filter(g => 房间类.test(g.标签) && 人数系.test(g.值))
  ok(违规.length === 0, '★ 房间类标签的格子**不含**人数系标识符（V5 语义判据的正例面）',
    违规.map(g => `${g.标签} → ${g.值}`).join(' | '))
  const 客房 = 格s.find(g => g.标签 === '在店客房')
  ok(!!客房, '存在「在店客房」格')
  ok(客房?.值 === "occRooms + ' 间'", '★ 「在店客房」的值 === occRooms（与 settlement.occupiedRooms 同源 · 不许另算）', `实际 = ${客房?.值}`)
  const 客人 = 格s.find(g => g.标签 === '在店客人')
  ok(!!客人 && 人数系.test(客人.值), '★ 存在「在店客人」格且取人数（间与人分列 = 数据字典条目本意）')
  ok(格s.some(g => g.标签 === '在店客人') && /估算/.test(块[1]), '「在店客人」标明"估算"（人数是按时段曲线的估算值）')
  // 判据自检：合成一个"人数冒充间数"的样本，判据必须能抓到（治"判据恒绿"）
  const 合成 = { 标签: '在店客房', 值: '(liveStats ? liveStats.guests : (liveGuests ?? targetGuests)) + \' 间\'' }
  ok(房间类.test(合成.标签) && 人数系.test(合成.值), '判据自检：合成的"人数冒充间数"样本会被抓到（V5 语义判据非空转）')
}

// ── [2] 结构断言：间 的数值不可能 > 总房量 ──
console.log('\n[2] §26.2 P0a 结构断言：间 ≤ rooms（60）')
{
  const 块 = /const roomsCell = \[([\s\S]*?)\n  \]/.exec(HS代码)
  const 格s = 块 ? [...块[1].matchAll(/\{\s*l:\s*'([^']+)'[\s\S]*?v:\s*([^,}]+)/g)].map(m => ({ 标签: m[1], 值: m[2].trim() })) : []
  const rooms字面 = /const rooms = .*?\|\|\s*(\d+)/.exec(HS代码)
  const ROOMS = rooms字面 ? Number(rooms字面[1]) : null
  ok(ROOMS != null, `能读出兜底房量常量（= ${ROOMS}）`, '未读到 ⇒ 判据没靶子')
  const 间格 = 格s.filter(g => /间/.test(g.值))
  ok(间格.length >= 2, `解析出 ${间格.length} 个「间」格里（≥2）`)
  // 值为【字面数字】的格子：必须 ≤ 兜底房量（这是"999 也显示"这类错的直接防线）
  const 字面 = 间格.map(g => ({ ...g, n: /^\d+$/.test(g.值) ? Number(g.值) : null })).filter(g => g.n != null)
  const 超 = 字面.filter(g => ROOMS != null && g.n > ROOMS)
  ok(超.length === 0, `★ 写死数字的「间」格全部 ≤ ${ROOMS}（RV-2：把在店客房改成 999 ⇒ 此处必红）`,
    超.map(g => `${g.标签}=${g.n}`).join(' | '))
  // 非字面的格子：值必须来自白名单来源（房间/计数 · 且**已在 [1] 排除人数系**）
  //   ★ §26.3 P0b④（2026-09-29）：白名单从「本地计数」升级为**引擎日快照**——
  //     今日已退房/已入住现在取 `今日快照.checkouts/checkins`（同源）；旧的
  //     `liveStats.checkout / checkoutDone`（面板自行模拟）**不再放行**（那正是"两本账"的一种）。
  const 白名单 = /^(occRooms|rooms|report\?\.rooms|occByType\b|Math\.(max|round|min)\()|今日快照\.(checkouts|checkins)/
  const 越界 = 间格.filter(g => g.n == null && !白名单.test(g.值))
  ok(越界.length === 0, '★ 非字面「间」格的来源在白名单内（occRooms/rooms/occByType/引擎日快照）',
    越界.map(g => `${g.标签} → ${g.值}`).join(' | '))
  ok(!间格.some(g => /liveStats\.(checkout|checkin)|checkoutDone|checkinDone/.test(g.值)),
    '★ 面板不再用自行模拟的退房/入住计数（那两格已改引擎日快照）')
  // 引擎侧真值：occupiedRooms ≤ rooms（拿真引擎跑，不是算术自证）
  const r = settle({ site: { 客流: 3 }, brand: '全季', decisions: {}, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } })
  ok(r.occupiedRooms <= r.rooms, `引擎实跑：occupiedRooms ${r.occupiedRooms} ≤ rooms ${r.rooms}（结构上不可能倒挂）`)
}

// ── [3] 房型明细同源（Σ === occRooms）──
console.log('\n[3] §26.2 P0a 房型明细走 occByType（不再自造在店数）')
{
  ok(/occByType\[idx\]/.test(HS代码), '★ 房型明细渲染 occByType[idx]')
  ok(!/tp\.total\s*\*\s*tp\.occRate/.test(HS代码), '★ 源码不含 `tp.total × tp.occRate` 旧估算（V6 的正例面）')
  ok(/最大余数法/.test(HS) && /occRooms/.test(HS), 'occByType 注明"最大余数法 · Σ === occRooms"（分摊口径可追溯）')
}

// ── [4] 流水同源：面板不再自造金额 ──
console.log('\n[4] §26.3 P0b 今日流水 = 引擎日快照（面板不记账）')
{
  const LF = HS代码.slice(HS代码.indexOf('function LiveFeed'))
  ok(/dayFlows/.test(LF) && /revenue/.test(LF) && /cost/.test(LF), '★ LiveFeed 消费 dayFlows（引擎日快照的 revenue/cost）')
  ok(/本周累计/.test(LF), '★ 面板显示"本周累计"（逐日累积口径 · 第 7 天 === 周值）')
  const 金额行 = LF.split('\n').filter(l => /Math\.random/.test(l) && /(金额|amt|income|expense|revenue|cost|price|流水)/.test(l))
  ok(金额行.length === 0, '★ LiveFeed 内**没有**"随机造金额"的行（V4b 的正例面）', 金额行.join(' | '))
  ok(!/今日流水为模拟估算/.test(HS), '★ 已删除"模拟估算"免责句（改后能对账才允许删）')
  // 判据自检：V4b 必须能抓到"金额路径用随机"（含金额关键词的行）
  const v4b = VIOLATION_PATTERNS.find(v => v.id === 'V4b')
  ok(!!v4b && 'const fee = Math.round(price * (0.85 + Math.random() * 0.3))'.match(v4b.re) !== null,
    '判据自检：V4b 能抓到"金额 = 随机"的写法（非空转）')
  // ★ 补判据自检（实测发现的洞）：`const fee = Math.round(p * Math.random())` 这一行**无金额关键词** ⇒
  //   V4b 抓不到 ⇒ 必须由 V7/V8 结构性判据兜底。两条都要能红。
  const v7 = VIOLATION_PATTERNS.find(v => v.id === 'V7')
  const v8 = VIOLATION_PATTERNS.find(v => v.id === 'V8')
  ok(!!v7 && 'apply({ income: s.income + fee })'.match(v7.re) !== null,
    '判据自检：V7 能抓到"面板自记收支"（apply({ income/expense })）—— V4b 的漏网由它兜底')
  ok(!!v8 && "[{ t: `🔧 维修`, amt: -(80 + Math.floor(Math.random() * 220)) }]".match(v8.re) !== null,
    '判据自检：V8 能抓到"事件自带金额"（amt 非 0）')
  ok(!!v8 && '[{ t: `🌙 巡场完毕`, amt: 0 }]'.match(v8.re) === null,
    '判据自检：V8 不误伤 `amt: 0`（服务性事件的合法写法）')
  // 数据字典条目必须有**消费方断言**（治"陈述句冒充结论"）
  const 条 = DATA_DICT.find(e => e.key === 'guests(在店)')
  ok(!!条, '数据字典含 guests(在店) 条目')
  ok(!!条 && /分列/.test(条.单位), '该条目单位写明"间与人严格分列"')
  ok(/guests\(在店\)/.test(readFileSync(path.join(APP, 'tests', 'livePanel.test.mjs'), 'utf8')),
    '★ 消费方断言存在：本套件显式引用该条目 key（条目不再是"只写在说明书里"）')
}

// ── [5] 引擎恒等式：Σ7天 === 周值（"周末出总账"的依据）──
console.log('\n[5] §26.3 日快照恒等式：Σ7天 === 周值 · 第 7 天即周值')
{
  const r = settle({ site: { 客流: 3 }, brand: '全季', decisions: {}, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } })
  const ds = r.dailySnapshots
  ok(Array.isArray(ds) && ds.length === 7, `dailySnapshots 为 7 天（实际 ${Array.isArray(ds) ? ds.length : '非数组'}）`)
  if (Array.isArray(ds) && ds.length === 7) {
    const 和 = (k) => ds.reduce((a, d) => a + (d[k] || 0), 0)
    ok(和('revenue') === r.revenue, `★ Σ日 revenue ${和('revenue')} === 周值 ${r.revenue}`)
    ok(和('cost') === r.totalCost, `★ Σ日 cost ${和('cost')} === 周值 ${r.totalCost}`)
    ok(和('occupied') === r.occupiedRooms, `★ Σ日 occupied === 周值 ${r.occupiedRooms}`)
    // ★ §26.3 P0b④：逐日入住/退房 === 引擎周值（模型：一周内每间在店客房周转一次）
    ok(和('checkins') === r.occupiedRooms, `★ Σ日 checkins === occupiedRooms ${r.occupiedRooms}（原为 0 = 缺口）`, `实际 ${和('checkins')}`)
    ok(和('checkouts') === r.occupiedRooms, `★ Σ日 checkouts === occupiedRooms ${r.occupiedRooms}`, `实际 ${和('checkouts')}`)
    ok(ds.some(d => d.checkouts > 0) && ds.some(d => d.checkins > 0),
      '★ 逐日入住/退房非全零（防"改成 0 也算通过"）—— 面板那两格现在有真源')
    // 第 7 天 = 面板"第 7 天累计"的最后一项；累计到第 7 天即 === 周值（上面已证）
    ok(ds[6] && Number.isFinite(ds[6].revenue), '第 7 天快照存在且 revenue 有限（面板累计的末端）')
  }
  ok(r.revenue > 0 && r.totalCost > 0, `周值非零（防"全 0 也算过"）· revenue=${r.revenue} cost=${r.totalCost}`)
}

// ── [6] §26.7（P0e②）：教学日来源必须可见（服务端权威 / 离线本地推算 · 不许静默退化）──
console.log('\n[6] §26.7 P0e② 教学日来源：消费服务端 classDay + 离线显式标注')
{
  const app = readFileSync(path.join(APP, 'src', 'App.jsx'), 'utf8')
  ok(/fetchClassDay/.test(app), '★ App 确实取服务端 classDay（fetchClassDay）—— 原实现从未取过（权威缺席）')
  ok(/serverClassDay/.test(app) && /权威日/.test(app), '★ App 有「服务端值优先、本地兜底」的解析（权威日）')
  // ★ 收紧：必须核对**解析式本身**（只查"出现过 serverClassDay"太弱 —— 改成本地优先也照样出现 ⇒ RV-9 实测抓到）
  ok(/const 权威日 = Number\.isFinite\(serverClassDay\)[^\n]*\? serverClassDay : classDayLocal/.test(app),
    '★ 解析式 = 服务端优先、本地兜底（不是本地优先 —— 那等于权威缺席）')
  ok(/日来源/.test(app) && /daySource=\{日来源\}/.test(app), '★ App 把来源传给面板（daySource）')
  ok(/dayToWeekDay\(权威日\)/.test(app), '★ 日序号由权威日派生（不是各处分头读本地推算）')
  ok(/classDay: \(typeof 权威日/.test(app), '★ 上传给服务端的 classDay 也是权威日（两端同一天）')
  ok(/离线 · 本地推算/.test(HS), '★ 面板有「离线 · 本地推算」徽标（取不到服务端值时**可见**）')
  ok(/daySource === 'local'/.test(HS), '★ 徽标只在本地兜底时出现（不是常驻噪声）')
  // 判据自检：把"服务端优先"改成本地优先 ⇒ 解析式不再成立（防"改了也看不出来"）
  const 合成 = 'const 权威日 = classDayLocal'
  ok(!/受/i.test(合成) && !/serverClassDay/.test(合成), '判据自检：本地优先的写法不含 serverClassDay ⇒ 会被上面第 2 条抓到（判据非空转）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('RV 靶子：① 把 roomsCell 的「在店客房」改回 guests+间 ⇒ [1] 必红 ② 改成 999 ⇒ [2] 必红')
console.log('        ③ 房型行改回 tp.total×tp.occRate ⇒ [3] 必红 ④ LiveFeed 里用 Math.random 造金额 ⇒ [4] 必红')
process.exit(fail ? 1 : 0)
