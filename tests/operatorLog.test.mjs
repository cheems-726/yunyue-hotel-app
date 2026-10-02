// §22.3-C3/C2 · 每人操作记录 + 职位分工 断言
// 运行：node tests/operatorLog.test.mjs   （挂 run-all fast）
//
// 验收（任务包 §22.3）：
//   C3：每条记录含操作者 · 旧档兼容（无操作者 ⇒ 标"未记录"、不崩）
//   C2：认领可落盘口径 · 决策按职位归属可见 · owner 直接映射（侦察结论钉住）
//   通用：不进结算路径（纯数据/纯函数）· 覆盖度（18 项决策全覆盖）
import { readFileSync } from 'node:fs'
import { 记录一条, 记录一批, 按人聚合, 按职位聚合, 职位, 职位键, 职位名, 决策职位, 未记录 } from '../src/operatorLog.mjs'
import { decisions, OWNER_LABELS } from '../src/decisions.js'
import { settle } from '../src/settlement.js'
import { ATTR_INIT } from '../src/attrs.js'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

console.log('▶ §22.3-C3/C2 · 每人操作记录 + 职位分工')

console.log('\n[1] C2 侦察结论钉住：owner 五值 === 需求五职位（能直接映射）')
{
  ok(职位键.length === 5, `职位 5 个：${职位键.join(',')}`)
  ok(职位名('manager') === '店长' && 职位名('lobby') === '大堂经理' && 职位名('finance') === '财务' && 职位名('ops') === '运营专员' && 职位名('hr') === '人事专员',
    '五职位中文名与需求原话逐字对应（店长/大堂经理/财务/运营/人事）')
  // 覆盖度：18 项决策全部带合法 owner（表在但没盖全 = BL 族）
  const 无owner = decisions.filter(d => !OWNER_LABELS[d.owner])
  ok(无owner.length === 0, `18 项决策全部带合法 owner（未覆盖 ${无owner.length} 项）`, 无owner.map(d => d.id).join(','))
  const 映射全 = decisions.every(d => 决策职位[d.id] === d.owner)
  ok(映射全 && Object.keys(决策职位).length === decisions.length, '决策职位映射与 decisions.owner 同源且全覆盖（18/18）')
}

console.log('\n[2] C3：每条记录含操作者 + 职位 + 决策上下文')
{
  const r = 记录一条({ decisionId: 'pricing', answer: '不跟降', operatorId: 'stu_03', operatorName: '张三', week: 3, classDay: 17, profitImpact: -1200 })
  ok(!!r && r.operatorId === 'stu_03' && r.operatorName === '张三', '记录含操作者（id + 姓名）')
  ok(r.职位 === 'ops' && r.职位名 === '运营专员', '记录含职位归属（单源 decisions.owner）')
  ok(r.decisionId === 'pricing' && r.决策名 === '动态调价' && r.answer === '不跟降', '记录含决策上下文（id/名称/答案）')
  ok(r.week === 3 && r.classDay === 17, '记录含时间（week/classDay）')
  ok(r.profitImpact === -1200, '记录含营收影响（C4 用，可空）')
  // 答案对象深拷贝（不共享引用）
  const obj = { 渠道名: '抖音', 金额: 5000 }
  const r2 = 记录一条({ decisionId: 'campaign', answer: obj, week: 1 })
  obj.金额 = 999
  ok(r2.answer.金额 === 5000, '答案对象深拷贝（外部改动不污染记录）')
  // 未知决策 id ⇒ null（调用方处理）
  ok(记录一条({ decisionId: '不存在的id', answer: 1, week: 1 }) === null, '未知决策 id ⇒ 不记录（返回 null）')
}

console.log('\n[3] 旧档兼容：无操作者 ⇒ 标"未记录"、不崩')
{
  const r = 记录一条({ decisionId: 'pricing', answer: '不跟降', week: 1 })
  ok(r.operatorId === 未记录 && r.operatorName === null, `无操作者 ⇒ operatorId = "${未记录}"（如实标，不编人名）`)
  const 一批 = 记录一批({ answers: { pricing: '不跟降', shifts: '满编保服务' }, week: 1 })   // 完全不给 operator
  ok(一批.length === 2 && 一批.every(x => x.operatorId === 未记录), '批量也不崩（2 条全标未记录）')
  ok(按人聚合(一批).length === 1 && 按人聚合(一批)[0].operatorId === 未记录, '按人聚合把"未记录"当成一个人（可查、不混入真人）')
}

console.log('\n[4] 聚合：按人（C4 数据面）+ 按职位（C2 数据面）')
{
  const 记录 = [
    记录一条({ decisionId: 'pricing', answer: '不跟降', operatorId: 's1', operatorName: '甲', week: 1, profitImpact: 100 }),
    记录一条({ decisionId: 'ota', answer: '全渠道上架', operatorId: 's1', operatorName: '甲', week: 2, profitImpact: 200 }),
    记录一条({ decisionId: 'shifts', answer: '满编保服务', operatorId: 's2', operatorName: '乙', week: 2 }),
  ]
  const 人 = 按人聚合(记录)
  ok(人.length === 2, '按人聚合 = 2 人')
  const s1 = 人.find(x => x.operatorId === 's1')
  ok(s1.条数 === 2 && s1.净利影响 === 300 && JSON.stringify(s1.周) === '[1,2]', `s1：2 条 · 净利影响 +300 · 周 [1,2]`)
  ok(s1.职位['运营专员'] === 2, 's1 的职位分布（运营专员 ×2）')
  const 职 = 按职位聚合(记录)
  // pricing/ota 的 owner 都是 ops（decisions.js）；shifts 的 owner 是 hr ⇒ 2 个职位
  const ops = 职.find(x => x.职位 === 'ops')
  // ★ 操作者集合【去重】（s1 两条 ops 决策仍算一个人）⇒ join = 's1'
  ok(职.length === 2 && ops.条数 === 2 && ops.操作者.join() === 's1',
    `按职位聚合 = 2 个职位 · ops 2 条（s1 pricing+ota，s2 shifts→hr）`, JSON.stringify(职.map(x => x.职位)))
  ok(职.find(x => x.职位 === 'hr')?.操作者?.includes('s2'), 's2 的 shifts 归 hr（owner 单源）')
  ok(职.every(x => x.决策.length === x.条数), '每职位决策去重（条数 = 决策数 ⇒ 无重复计）')
}

console.log('\n[5] 不越界：纯数据模块 · 不进结算路径')
{
  ok(!/operatorLog/.test(strip(src('settlement.js'))), 'settlement.js 不引用 operatorLog（静态证明：不进结算路径）')
  ok(!/Math\.random|localStorage/.test(strip(src('operatorLog.mjs'))), '纯函数：不抽随机、不碰存储')
  // 引擎锚点仍为 §22.2 重基线（本模块不参与结算）
  const r = settle({ site: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }, brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }, decisions: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } })
  // ★ §33-V4-A8 重基线：房价档 4 接线 ⇒ 锚点数字前进（126140/430087/−303947 → 128520/430753/−302233）
  ok(r.revenue === 128520 && r.totalCost === 430753 && r.netProfit === -302233,
    '引擎锚点（§22.2+A8 重基线：128520/430753/−302233 ⇒ 本模块没碰结算）', `${r.revenue}/${r.totalCost}/${r.netProfit}`)
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：每条记录含操作者 · 职位归属单源 · 旧档标"未记录" · 不进结算路径')
process.exit(fail ? 1 : 0)
