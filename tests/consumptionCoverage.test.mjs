// ★ §27.3-②c（2026-09-29 · D75）：决策项【消费点】守门 —— "选项必须落到实处"（铁律 12）
//
// ── 为什么需要它（起因：决策端 D74 实核）────────────────────────────────
//   用户问「功能选项都落实到实处了吗」⇒ 实核发现 **1 项决策 + 2 维选址是"装饰品"**：
//   学生在面板上作答，而**没有任何代码消费这个答案** ⇒ 答了等于没答（教学上是"骗学生"）。
//   本项目此前已经有过同族问题（BL-14「链路式声明未消费」/ D1「声明未消费」），
//   但那些是**对着源码查关键词**；本套件换一种更强的方式：**行为式扰动**——
//   改一个答案 ⇒ 输出**必须**变；不变 ⇒ 这个选项就没有消费点。
//
// ── 判据（三条）──────────────────────────────────────────────────────
//   ① 每个决策项：把它从基线答案改到**任一**其他选项 ⇒ `settle` 的**业务输出**必须至少有一处变化
//   ② 每个选址维度：把该维从 3 改到 5 ⇒ 同上（选址六维全查，不只查"看起来在用"的那几维）
//   ③ 未接线项**必须显式登记**（白名单 = 登记表：项 / 原因 / 归属批次）；且：
//      · 未登记又没消费 ⇒ 红（新出现的"装饰品"当场被抓）
//      · **登记了却又有消费** ⇒ 也红（登记表会腐烂 ⇒ 治"白名单越用越宽"）
//
// 运行：node tests/consumptionCoverage.test.mjs   （挂 run-all fast · 纯 node · 秒级）
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { settle } from '../src/settlement.js'
import { decisions as 全部决策 } from '../src/decisions.js'
import { settleInputsFrom } from '../src/weekInputs.mjs'   // ★ 真实链路：决策 → 周内输入（emergency→危机应对的映射在这里）

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

// ── 登记表：**明确知道**暂未接线、且**不许假装接了**的项（每条必须有原因 + 归属）──────
const 未接线登记 = [
  { 项: '选址.房价', 原因: '选址六维里"房价"未进入定价/营收路径（引擎按品牌与决策定价）', 归属: '待决策端拍板：接线（= 重基线）或永久移除该维 · §27.3-②b' },
  { 项: '选址.人力', 原因: '选址六维里"人力"未进入人力成本路径（部门成本按标准比例）', 归属: '待决策端拍板：接线（= 重基线）或永久移除该维 · §27.3-②b' },
  // 🔴 §28.1-① 返修（2026-09-29 · D76）：**删除「选址.波动」登记项** —— 它**确实进入结算**
  //   （`settlement.js:319` volatility → `:320` marketWave → `:324` demandStrength → 出租率 → 营收；
  //   实跑：波动 1→5 ⇒ 营收 123,760→133,280）。此前登记系**守门假阳性**所致（见下面 [2] 的注释），
  //   而那个假阳性**驱动了产品改动**（学生在界面上看到"波动 暂不影响结算"的假话）⇒ 本条是教训的实物。
  //   ★ 教训（D76 / 教训家族第 15 条）：**守门假阳性 ≠ 无事发生** —— 「说没影响，其实影响」。
]

const 场地 = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const 属性 = { quality: 60, reputation: 70, morale: 65 }
const 品牌 = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
// 基线决策 = 每个决策项取它的**第一个选项**（不依赖 UI 默认，纯由 decisions.js 决定）
const 基线 = {}
for (const d of 全部决策) {
  const o = Array.isArray(d.options) && d.options.length ? d.options[0] : null
  基线[d.id] = o ? (typeof o === 'string' ? o : o.label) : (d.type === 'slider' ? (d.min ?? 0) : (d.type === 'budget' ? 100 : null))
}
// ★ 走【真实链路】：decisions → weekInputs.settleInputsFrom（它负责把 emergency 映射成危机应对）
//   → settle。只测 settle 本体是不够的 —— 那样会漏掉"在 App 层接线"的选项（emergency 就是这种）。
const 跑 = (dec, site = 场地, week = 1, attrs = 属性) => {
  const 输入 = settleInputsFrom({ reviews: [], week, crisis: null, decisions: dec })
  const r = settle({ site: { ...site }, brand: 品牌, decisions: { ...dec }, week, attrs: { ...attrs }, crisisResponse: 输入.crisisResponse })
  // 业务输出（吃口径变化的那几项）：钱 / 口碑 / 出租 / 属性 / 差评数 / 成本构成
  return JSON.stringify({
    revenue: r.revenue, totalCost: r.totalCost, deptCost: r.deptCost, rentCost: r.rentCost,
    gop: r.gop, profit: r.profit, netProfit: r.netProfit, capital: r.capital,
    occupancy: r.occupancy, occupiedRooms: r.occupiedRooms, finalGoodRate: r.finalGoodRate,
    negativeCount: r.negativeCount, reviewCount: r.reviewCount,
    attrs: r.attrsAfter, gopRate: r.gopRate,
  })
}

console.log('▶ §27.3/§28.1 决策项/选址维【消费点】守门（改答案 ⇒ 输出必须变 · 多配置 + 阳性对照）')

// ── ① 决策项逐项扰动 ────────────────────────────────────────────────
console.log('\n[1] 决策项：改到任一其他选项 ⇒ 业务输出必须至少变一处')
{
  const 基准输出 = 跑(基线)
  ok(基准输出.length > 100, '基线 settle 可跑且有业务输出（判据有靶子 · 非空转）')
  const 无消费 = []
  let 查过 = 0, 选项总数 = 0
  for (const d of 全部决策) {
    const 可选 = Array.isArray(d.options) ? d.options.map(o => (typeof o === 'string' ? o : o.label)).filter(x => x != null && x !== 基线[d.id]) : []
    if (!可选.length) continue
    查过++; 选项总数 += 可选.length
    const 有反应 = 可选.some(v => 跑({ ...基线, [d.id]: v }) !== 基准输出)
    if (!有反应) 无消费.push(d.id)
  }
  ok(查过 >= 12, `覆盖到 ${查过} 个多选项决策项（共 ${选项总数} 个备选答案）`)
  const 未登记 = 无消费.filter(id => !未接线登记.some(e => e.项 === id || e.项 === ('决策.' + id)))
  ok(未登记.length === 0, `★ 每个决策项都至少有一个消费点（改答案 ⇒ 输出必变）· 未接线项已登记`,
    未登记.length ? '未登记且零消费：' + 未登记.join(', ') : '')
  // 登记表不许腐烂：登记为"未接线"的决策项，若其实已接线 ⇒ 也红
  const 登记了却有反应 = 未接线登记.filter(e => e.项.startsWith('决策.')).map(e => e.项.slice(3)).filter(id => !无消费.includes(id))
  ok(登记了却有反应.length === 0, '登记表不腐烂：登记为"未接线"的决策项确实仍未接线', 登记了却有反应.join(', '))
}

// ── ② 选址六维逐维扰动 ──────────────────────────────────────────────
// 🔴 §28.1-②（D76）**守门加固** —— 起因（假阳性事故）：原判据只用**一组配置**（六维全 3 · week1）做扰动，
//   该基准下出租率**撞 0.98 上限**（`settlement.js:328` `Math.min(baseOccupancy*demandStrength, 0.98)`）
//   ⇒ 凡只作用于"数量级"的维度（如「波动」抬高 demandStrength ⇒ 出租率顶在天花板）**全部看不出变化**
//   ⇒ 被误判"零消费" ⇒ 驱动界面误标「暂不影响结算」⇒ **制造了新的假话**（D76 家族第 15 条 · 方向相反的第一条）。
//   加固（三层，缺一即可能再骗人）：
//     ① **跨多组配置**：任一配置下有反应 ⇒ 判有消费。配置A = 未饱和（week5 · 客流4）· 配置B = 饱和（week1 · 全3）
//     ② ★ **阳性对照自校准**：把**已知有消费**的「租金」送进同一判据 —— 若阳性对照被判"无消费"
//        ⇒ **判据自身红**（治"守门瞎了还给假绿"—— 比漏报更危险的是不知道自己漏报）
//     ③ 「登记表不腐烂」与逐条对账全部用**多配置版**结果重算（不在坏配置上自证）
console.log('\n[2] 选址维度：该维 3 → 5 ⇒ 跨多组配置**任一**有反应即算有消费 + 阳性对照自校准')
{
  // ★ 配置A 用【低属性】：默认属性（60/70/65）+ 基线决策 ⇒ 出租率顶到 **0.98 上限**（occ 98 · 实测）
  //   ⇒ 波动的乘数效应全被天花板吃掉 ⇒ 又会误判"零消费"（这次是守门内部自己复现假阳性根因）。
  //   低属性（40/45/50）⇒ occ 79–93 未饱和 ⇒ 数量级差异可见（实测 波动1→5 营收 151,641→162,631）。
  const 低属性 = { quality: 40, reputation: 45, morale: 50 }
  const 配置A = { ...场地, 客流: 3, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3 }   // 未饱和 · week5 · 低属性
  const 配置B = { 客流: 3, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3 }             // 饱和路径 · week1 · 默认属性
  // ★ 扰动必须【双向】：3→5 与 3→1 都要试，任一可见即算有消费。
  //   实测踩坑（加固过程中的第二个坑）：波动 3→5 在配置A 下恰好落在**平台段**（occ 93→93 ——
  //   事件/上限把差异吃掉）而 3→1 可见（occ 93→90 · 营收 162,631→158,235）⇒ 只扫一个方向又会误判。
  //   ⇒ "改答案必须变"的完整语义 = **从当前值往任一方向扰动**，不是只往高档扰。
  const 扰动 = (k, 配置, week, attrs) => {
    const 基 = { ...配置, [k]: 3 }
    return 跑(基线, { ...配置, [k]: 5 }, week, attrs) !== 跑(基线, 基, week, attrs)
      || 跑(基线, { ...配置, [k]: 1 }, week, attrs) !== 跑(基线, 基, week, attrs)
  }
  const 有消费 = (k) => 扰动(k, 配置A, 5, 低属性) || 扰动(k, 配置B, 1, 属性)
  // ★ 阳性对照自校准（先于结论执行）：已知「租金」必进 rentCost ⇒ 判据必须判它"有消费"；
  //   判不出来 ⇒ 判据瞎了 ⇒ 本套件**自身红**（而不是给维清单一个假的结论）
  const 阳性对照 = 有消费('租金')
  ok(阳性对照, '★ 阳性对照自校准：已知有消费的「租金」被判"有消费"（判据没瞎）',
    '判据在两个配置下都看不出租金的变化 ⇒ 后面所有"零消费"结论都不可信 ⇒ 先修判据')
  const 对照失灵 = !阳性对照
  const 六维 = ['客流', '房价', '租金', '竞争', '人力', '波动']
  const 零消费维 = 对照失灵 ? [] : 六维.filter(k => !有消费(k))
  ok(六维.length === 6, '六维全部被扫（不只查"看起来在用"的那几维）')
  // 波动专项（本条是返修的靶心）：它必须被判"有消费"
  ok(!对照失灵 && !零消费维.includes('波动'), '★ 「波动」被判**有消费**（settlement.js:319-320 volatility→marketWave→demandStrength · 实跑 1→5 营收 123,760→133,280）',
    零消费维.includes('波动') ? '守门仍误判波动零消费 ⇒ 加固未生效' : '')
  const 未登记维 = 零消费维.filter(k => !未接线登记.some(e => e.项 === '选址.' + k))
  ok(未登记维.length === 0, '★ 每个选址维都至少有一个消费点（未接线的 2 维已显式登记）',
     未登记维.length ? '未登记且零消费：' + 未登记维.join(', ') : '')
  const 登记了却有反应 = 未接线登记.filter(e => e.项.startsWith('选址.')).map(e => e.项.slice(3)).filter(k => !零消费维.includes(k))
  ok(登记了却有反应.length === 0, '登记表不腐烂：登记为"未接线"的选址维确实仍未接线（多配置版重算）', 登记了却有反应.join(', '))
  ok(零消费维.length === 未接线登记.filter(e => e.项.startsWith('选址.')).length,
    `零消费维数 ${零消费维.length}（应为 2：房价/人力）=== 登记数（逐条对账）`)
}

// ── ③ 登记表本身的自检 ──────────────────────────────────────────────
console.log('\n[3] 登记表自检（每条必须写清原因与归属 · 不许空登记）')
{
  const 缺原因 = 未接线登记.filter(e => !e.原因 || e.原因.length < 10)
  const 缺归属 = 未接线登记.filter(e => !e.归属 || e.归属.length < 6)
  ok(缺原因.length === 0, '每个未接线项都写了原因', 缺原因.map(e => e.项).join(','))
  ok(缺归属.length === 0, '每个未接线项都写了归属（谁拍板/什么时候）', 缺归属.map(e => e.项).join(','))
  ok(未接线登记.length > 0, `登记表非空（当前 ${未接线登记.length} 条）—— 全空也能过，但那说明判据没在用`)
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('RV 靶子：① 把某个决策项改成"不消费"（如 emergency 的映射删掉）⇒ [1] 必红')
console.log('        ② 把 选址.房价 接进定价（改 settlement 消费它）⇒ [2] 的"登记表腐烂"必红')
console.log('        ③ 把某决策项从基线改到任一选项都不影响输出 ⇒ [1] 必红')
process.exit(fail ? 1 : 0)
