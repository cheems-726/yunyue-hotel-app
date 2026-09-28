// Phase F · 加盟经济模型 P1 数据层验收
// 运行：node tests/franchiseModel.test.mjs
// 判据（§十七·七）：① 字段齐全 + 每条带三件套 ② 能复现华住五数字链
//                   ③ 未碰任何业务代码（结算输出零变化）
import { FRANCHISE_MODEL, HUAZHU_SAMPLE, reproduceHuazhuChain, GAP_VS_CODE } from '../src/franchiseModel.mjs'
import { settle } from '../src/settlement.js'
// 🔴 W2 重基线（D38-B）：基准改为「W2 前」，断言改为结构不变量 + 差额恒等式
import { settle as settleOld } from '../src/settle-old-w2.mjs'
import { readFileSync, readdirSync } from 'node:fs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ Phase F · 加盟经济模型 P1 数据层')

console.log('\n[1] 结构：每片叶子都是三件套 { 值, 来源, 取数日期, 置信度 }')
{
  const leaves = []
  const walk = (o, path) => {
    if (o && typeof o === 'object' && !Array.isArray(o) && '值' in o && '来源' in o) { leaves.push([path, o]); return }
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, path + '/' + k)
  }
  walk(FRANCHISE_MODEL, 'FRANCHISE_MODEL')
  walk(HUAZHU_SAMPLE, 'HUAZHU_SAMPLE')
  ok(leaves.length >= 25, `三件套叶子共 ${leaves.length} 条（≥25）`)
  const bad = leaves.filter(([, v]) => !v.来源 || !v.取数日期 || !v.置信度 || v.值 === undefined)
  ok(bad.length === 0, `全部四字段齐全${bad.length ? ' → 缺：' + bad.slice(0, 3).map(x => x[0]).join(', ') : ''}`)
  const conf = {}
  leaves.forEach(([, v]) => { conf[v.置信度] = (conf[v.置信度] || 0) + 1 })
  ok(['高', '中', '低'].some(k => conf[k] > 0), `置信度分布：${JSON.stringify(conf)}`)
  ok(!leaves.some(([, v]) => v.置信度 === '高' && /转述/.test(v.来源)), '未把"转述来源"标成高置信度')
}

console.log('\n[2] 字段齐全：汉庭 / 汉庭快捷 的关键科目都在')
{
  const need = ['加盟费', '保证金', '筹备费', '筹备保证金', '管理费', '中央预订系统_CRS', '物业门槛', '单房造价', 'PMS', '加盟期限年']
  const miss = need.filter(k => !(k in FRANCHISE_MODEL.汉庭))
  ok(miss.length === 0, `汉庭科目齐全（${need.length} 项）${miss.length ? ' → 缺 ' + miss.join(',') : ''}`)
  const need2 = ['加盟费', '物业门槛', '单房造价']
  const miss2 = need2.filter(k => !(k in FRANCHISE_MODEL.汉庭快捷))
  ok(miss2.length === 0, `汉庭快捷科目齐全（${need2.length} 项）${miss2.length ? ' → 缺 ' + miss2.join(',') : ''}`)
}

console.log('\n[3] ★ 复现华住五数字链（纯函数自洽）')
{
  const r = reproduceHuazhuChain()
  const C = HUAZHU_SAMPLE.五数字链
  ok(r.年收入 === C.年收入.值, `年收入 ${r.年收入} === ${C.年收入.值}（657 万）`)
  // 浮点：6570000 × 0.55 = 3613500.0000000005 ⇒ 取整比较（不是放宽，是消除 IEEE754 误差）
  ok(Math.round(r.毛利) === C.毛利.值, `毛利 ${Math.round(r.毛利)} === ${C.毛利.值}（361.35 万）`)
  ok(r.年租金 === C.年租金.值, `年租金 ${r.年租金} === ${C.年租金.值}（191.625 万）`)
  ok(r.特许费 === C.特许费.值, `特许费 ${r.特许费} === ${C.特许费.值}（32.85 万）`)
  ok(Math.round(r.现金流) === Math.round(C.现金流.值), `现金流 ${Math.round(r.现金流)} === ${C.现金流.值}（136.875 万）`)
  ok(Math.abs(r.现金流率 - C.现金流率.值) < 1e-4, `现金流率 ${(r.现金流率 * 100).toFixed(2)}% === ${(C.现金流率.值 * 100).toFixed(2)}%（20.83%）`)
  // ★ 明确登记：20.8% 不可对拍（缺部门成本），不许调参凑
  ok(GAP_VS_CODE.some(g => g.科目 === '部门成本' && /不可对拍/.test(g.影响)),
    '差异表已登记"部门成本缺失 ⇒ 毛利率/现金流率不可对拍"')
}

console.log('\n[4] ★ 未碰业务代码：结算输出零变化')
{
  // N3 纪律：不硬编码某个基线数字（易取错配置），改为【与 B3 前快照逐字节比对】——
  // 这同时证明 Phase B/D/E/F 都没改结算数值（剥掉 D 新增的 dailySnapshots 后）
  const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
  const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
  const DEC = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }
  const A = { quality: 60, reputation: 70, morale: 65 }
  const r = settle({ site: SITE, brand: BRAND, decisions: DEC, week: 1, attrs: A })
  // 只比【旧快照里已存在的键】：T1.4 新增了 rentCost/gop/gopRate、Phase D 新增了 dailySnapshots，
  // 它们不影响既有数值 —— 因此判据 = 每个既有键逐字节相同
// 🔴 §14.3 重基线（2026-09-28 · D53）：全季/汉庭/海友 自 §14.3 起按营收计【加盟两费】
//   （管理费 5% + CRS 有效 2.4%；单源 src/franchiseFees.mjs）⇒ 差额恒等式多一项 −两费。
//   未接入品牌返回 null ⇒ 本项恒为 0（null-safe，不写死数字）。
const 两费 = (r) => (r && r.franchiseFees ? r.franchiseFees.合计 : 0)
  const o = settleOld({ site: SITE, brand: BRAND, decisions: DEC, week: 1, attrs: A })
  // B 类：被 W2 有意改动的是成本/利润派生字段；结构字段与租金必须零漂移，成本差额必须恰为 deptCost
  // 🔴 A-1：rentCost 移出结构不变量（租金曲线已按教学口径调整，本就该变）
  const STRUCT = ['revenue', 'price', 'rooms', 'occupancy', 'occupiedRooms', 'reviewCount', 'negativeCount', 'goodRate', 'finalGoodRate']
  const drifted = STRUCT.filter(k => r[k] !== o[k])
  const Δrent = r.rentCost - o.rentCost   // 🔴 A-1：由实测值推导，不写死
  const money = r.totalCost - o.totalCost === r.deptCost + Δrent + 两费(r) && r.profit === o.profit - r.deptCost - Δrent - 两费(r)
  ok(drifted.length === 0 && money,
    `结构字段零漂移（${STRUCT.length} 项）且 Δcost === deptCost（${r.totalCost - o.totalCost} === ${r.deptCost}）（W2 重基线）${drifted.length ? ' → 漂移：' + drifted.join(',') : ''}`)
  // 同时钉住 T1.1 的口径恒等式（收入 = 在店间数 × 房价 × 7）
  ok(r.revenue === Math.round(r.occupiedRooms * r.price) * 7, `收入口径恒等式成立（${r.occupiedRooms} 间 × ${r.price} 元 × 7 = ${r.revenue}）`)
  // ── 零影响保证（🔴 W3-2 重基线 D38-B：从"零引用"升级为"引用也不进结算"）──────
  //   原断言：franchiseModel 不被【任何】业务代码 import（= 零影响的证明方式）。
  //   P2 交互层（报单/钱账）开始合法引用它 ⇒ 该证明方式失效，但【意图】没变：
  //   "加盟数据不得影响结算输出"。新形式更强也更准：
  //     ① 结算路径（settlement.js / 引擎出口）不得引用它
  //     ② 引用方只允许是交互层（白名单 + 理由），且那些模块必须【不被结算引用】（由各自套件守）
  const files = readdirSync(new URL('../src/', import.meta.url)).filter(f => /\.(js|jsx|mjs)$/.test(f) && !f.startsWith('settle-old'))
  const users = files.filter(f => f !== 'franchiseModel.mjs' && /from\s*['"].*franchiseModel/.test(readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')))
  // 🔴 §14.3 重基线：新增 franchiseFees.mjs —— 它是【引擎侧计费单源】（settlement.js 经它取费率），
  //   是 franchiseModel 的合法消费方。旧保证「加盟数据零影响结算」因此升级为三条：
  //     ① 数据只被【单源计费模块】消费（不散落）② 费率改动走《学生感知变化清单》③ settlement.js 不直接引用本数据层
  // 🔴 §16.2-B5（2026-09-28）：新增 establishmentInvest.mjs —— 筹建页投资项**锚定官方单房造价**（B5 的"不编造"设计），
  //   同属交互层；它**不被 settlement 引用**，由 tests/establishmentInvest.test.mjs 的"不越界层"独立守门。
  const INTERACTION_LAYER = ['propertyQuote.mjs', 'onePageLedger.mjs', 'franchiseFees.mjs', 'establishmentInvest.mjs']
  const illegal = users.filter(u => !INTERACTION_LAYER.includes(u))
  ok(illegal.length === 0, `franchiseModel 只被交互层引用（白名单 ${INTERACTION_LAYER.join(',')}）${illegal.length ? ' → 越界：' + illegal.join(',') : ''}`)
  const engineFiles = ['settlement.js', 'serverTick.mjs', 'deptCosts.mjs', 'metricDefs.mjs']
  const engineUsers = users.filter(u => engineFiles.includes(u))
  ok(engineUsers.length === 0, `结算/口径路径不引用 franchiseModel（${engineFiles.join(' / ')} 均无）${engineUsers.length ? ' → ' + engineUsers.join(',') : ''}`)
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
