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
  // ★ 本守门**首跑就抓到第三处**（决策端 D74 只点到两处）：选址"波动"同样零消费 ⇒ 一并登记并按要求标"暂不影响结算"
  { 项: '选址.波动', 原因: '选址六维里"波动"未进入任何路径（引擎的随机性由 seed 决定，不读该维）', 归属: '待决策端拍板：接线（= 重基线）或永久移除该维 · §27.3-②b' },
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
const 跑 = (dec, site = 场地) => {
  const 输入 = settleInputsFrom({ reviews: [], week: 1, crisis: null, decisions: dec })
  const r = settle({ site: { ...site }, brand: 品牌, decisions: { ...dec }, week: 1, attrs: { ...属性 }, crisisResponse: 输入.crisisResponse })
  // 业务输出（吃口径变化的那几项）：钱 / 口碑 / 出租 / 属性 / 差评数 / 成本构成
  return JSON.stringify({
    revenue: r.revenue, totalCost: r.totalCost, deptCost: r.deptCost, rentCost: r.rentCost,
    gop: r.gop, profit: r.profit, netProfit: r.netProfit, capital: r.capital,
    occupancy: r.occupancy, occupiedRooms: r.occupiedRooms, finalGoodRate: r.finalGoodRate,
    negativeCount: r.negativeCount, reviewCount: r.reviewCount,
    attrs: r.attrsAfter, gopRate: r.gopRate,
  })
}

console.log('▶ §27.3 决策项/选址维【消费点】守门（改答案 ⇒ 输出必须变）')

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
console.log('\n[2] 选址维度：该维 3 → 5 ⇒ 业务输出必须至少变一处')
{
  const 基准输出 = 跑(基线, { ...场地, 客流: 3, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3 })
  const 六维 = ['客流', '房价', '租金', '竞争', '人力', '波动']
  const 零消费维 = 六维.filter(k => 跑(基线, { ...场地, 客流: 3, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3, [k]: 5 }) === 基准输出)
  ok(六维.length === 6, '六维全部被扫（不只查"看起来在用"的那几维）')
  const 未登记维 = 零消费维.filter(k => !未接线登记.some(e => e.项 === '选址.' + k))
  ok(未登记维.length === 0, '★ 每个选址维都至少有一个消费点（未接线的 2 维已显式登记）',
     未登记维.length ? '未登记且零消费：' + 未登记维.join(', ') : '')
  const 登记了却有反应 = 未接线登记.filter(e => e.项.startsWith('选址.')).map(e => e.项.slice(3)).filter(k => !零消费维.includes(k))
  ok(登记了却有反应.length === 0, '登记表不腐烂：登记为"未接线"的选址维确实仍未接线', 登记了却有反应.join(', '))
  ok(零消费维.length === 未接线登记.filter(e => e.项.startsWith('选址.')).length,
    `零消费维数 ${零消费维.length} === 登记数 ${未接线登记.filter(e => e.项.startsWith('选址.')).length}（逐条对账）`)
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
