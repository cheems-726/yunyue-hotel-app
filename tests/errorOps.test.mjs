// V39 · 错误操作高亮守门（可证伪 · 挂 run-all fast）
// 判据（批1 先行写死 · src/errorOps.mjs 单源）：
//   乱定价 = 提价 且 有效价÷消费力代理(150+房价档×30) ≥ 2（V46 零单同源）
//   乱招人 = 满编保服务 且 出租率 < 45（四维阶梯最低带 · 反向≥85%精简已由引擎事件管辖）
//   乱选址 = 品牌基准价 ≥ 260 且 房价档 ≤ 2（需求 1.2-6 灰区 · 硬禁归 tierLimit）
// 可证伪：正例必标 · 反例必不标 · UI 必须消费本模块（去掉 import ⇒ 接线断言红）
import { settle } from '../src/settlement.js'
import { 错误操作标记, 扫描错误操作, parseBrandBase } from '../src/errorOps.mjs'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ V39 · 错误操作高亮（乱定价/乱招人/乱选址）')

// ① 乱定价正例：全季提价50% 落 房价档2（510÷210=2.43 ⇒ 零单）· 反例：不跟降
const S = { 客流: 4, 房价: 2, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const 品牌 = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const mk = (decisions) => settle({ site: S, brand: 品牌, decisions: { shifts: '满编保服务', hygiene: '停房深清洁', reputation: '道歉+赔偿', ...decisions }, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } })
const 坏价 = mk({ pricing: '提价 50%' })
const 好价 = mk({ pricing: '不跟降' })
const f定价 = 错误操作标记({ pricing: '提价 50%', price: 坏价.price, 房价档: 2, shifts: '满编保服务', occupancy: 坏价.occupancy, brandBasePrice: 280 })
ok(f定价.some(f => f.类别 === '乱定价'), `① 正例必标：提价50%@档2（价 ${坏价.price}）⇒ 乱定价`)
ok(!错误操作标记({ pricing: '不跟降', price: 好价.price, 房价档: 2, shifts: '满编保服务', occupancy: 好价.occupancy, brandBasePrice: 280 }).some(f => f.类别 === '乱定价'), '① 反例不标：不跟降 ⇒ 无乱定价')

// ② 乱招人正例：满编 @ 出租率 38% · 反例：满编 @ 66%
ok(错误操作标记({ shifts: '满编保服务', occupancy: 38, 房价档: 3 }).some(f => f.类别 === '乱招人'), '② 正例必标：满编@38% ⇒ 乱招人')
ok(!错误操作标记({ shifts: '满编保服务', occupancy: 66, 房价档: 3 }).some(f => f.类别 === '乱招人'), '② 反例不标：满编@66% ⇒ 无乱招人')

// ③ 乱选址正例：全季(280) @ 档2 · 反例：海友(120) @ 档2 · 反例2：全季 @ 档4
ok(错误操作标记({ brandBasePrice: 280, 房价档: 2 }).some(f => f.类别 === '乱选址'), '③ 正例必标：基准价280@档2 ⇒ 乱选址')
ok(!错误操作标记({ brandBasePrice: 120, 房价档: 2 }).some(f => f.类别 === '乱选址'), '③ 反例不标：海友120@档2（低配低消=合法）')
ok(!错误操作标记({ brandBasePrice: 280, 房价档: 4 }).some(f => f.类别 === '乱选址'), '③ 反例不标：全季@档4（高消区合法）')

// ④ 逐周扫描（含真实 settle 轨迹 · 一条注入错误定价 ⇒ 扫描器标出该周）
const hist = [1, 2].map(w => {
  const r = w === 1 ? 坏价 : 好价
  return { week: w, occupancy: r.occupancy, price: r.price, netProfit: r.netProfit, decisions: { pricing: r.decisions.pricing, shifts: r.decisions.shifts } }
})
const scan = 扫描错误操作(hist, { 房价档: 2, brandBasePrice: parseBrandBase(品牌.price) })
ok(scan.some(f => f.week === 1 && f.类别 === '乱定价') && !scan.some(f => f.week === 2 && f.类别 === '乱定价'), `④ 扫描器逐周定位：仅 W1 标乱定价（实得 ${scan.map(f => 'W' + f.week + f.类别).join('·') || '无'}）`)

// ⑤ UI 接线：TeacherDashboard 必须消费本模块（去掉 import ⇒ 红）
const td = readFileSync(join(fileURLToPath(new URL('..', import.meta.url)), 'src', 'TeacherDashboard.jsx'), 'utf8')
ok(td.includes("from './errorOps.mjs'") && td.includes('扫描错误操作'), '⑤ TeacherDashboard 已消费规则单源（import + 扫描调用）')

// ⑥ 依据随行：每条标记都带依据文本（UI 悬停可读 · 卡内批2"为什么判为错误"）
ok(f定价.every(f => f.依据 && f.依据.length >= 10), '⑥ 每条标记带依据文本（悬停可读）')

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
