// §33-V2 · R7 强制移交 —— 守门断言（挂 run-all）
// 判据（单元卡-V2 §2）：
//   ① 条件挂载：无移交/代提交 ⇒ operatorLogs 无该键（旧档零变化 · 水位线）
//   ② 形状：handover 四字段 / proxy 三字段（by_uid=代提交人 与 owner_uid=责任人【两个字段独立】）
//   ③ 移交不改数值（★ 推荐口径的机器证明）：同一输入 settle 两次，带/不带移交信息 ⇒ 逐字节相同
//   ④ 单源：owner 复用 decisions.js（不另立命名）· settlement 不得 import handover（结算零接触）
import { readFileSync } from 'node:fs'
import { settle } from '../src/settlement.js'
import { mountHandover, mountProxy, handoverOf, decisionOwnerOf, 代提交阈值说明 } from '../src/handover.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

console.log('▶ V2 · R7 强制移交（移交不改数值）')

// ① 条件挂载 + 幂等
{
  const e0 = {}
  ok(handoverOf(e0, 'pricing') === null, '① 无移交 ⇒ 读出 null（条件挂载：不添键）')
  const e1 = mountHandover(e0, { decisionId: 'pricing', from_uid: 'stuA', to_uid: 'role:ops', at: '2026-10-05T06:00:00Z' })
  ok(e0 && Object.keys(e0).length === 0, '① mountHandover 不改入参（纯函数 · 无副作用）')
  const h = handoverOf(e1, 'pricing')
  ok(h && h.decisionId === 'pricing' && h.from_uid === 'stuA' && h.to_uid === 'role:ops' && !!h.at,
    '① handover 四字段齐（decisionId/from_uid/to_uid/at —— 路线图原形）', JSON.stringify(h))
  const e2 = mountHandover(e1, { decisionId: 'pricing', from_uid: 'stuA', to_uid: 'role:ops', at: '2026-10-05T06:30:00Z' })
  ok(e2 === e1, '① 同甲乙重复移交 ⇒ 幂等（不重写）')
}

// ② 代提交：代提交人 / 责任人 两个字段独立（★ 混写即红）
{
  const p = mountProxy({}, { decisionId: 'shifts', by_uid: 'stuB', owner_uid: 'role:hr', at: '2026-10-05T06:00:00Z' }).shifts
  ok(p.by_uid === 'stuB' && p.owner_uid === 'role:hr', '② proxy：by_uid=代提交人 / owner_uid=责任人 两字段独立', JSON.stringify(p))
  ok(!('from_uid' in p) && !('to_uid' in p), '② proxy 不借 handover 字段名（不混写）')
  ok(/by_uid=代提交人/.test(src('handover.mjs')) && /owner_uid=责任人/.test(src('handover.mjs')),
    '② 阈值/字段语义在源码注释写明（卡 §2③）')
  ok(typeof 代提交阈值说明 === 'string' && 代提交阈值说明.length > 10, '② 代提交阈值常量在位并说明', 代提交阈值说明.slice(0, 20))
}

// ③ 单源 + 结算零接触（★ 移交不改数值的机器证明）
{
  ok(decisionOwnerOf('pricing') === 'ops' && decisionOwnerOf('shifts') === 'hr' && decisionOwnerOf('overbook') === 'manager',
    '③ owner 复用 decisions.js 词表（pricing=ops / shifts=hr / overbook=manager）')
  const 入参 = { site: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }, brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }, decisions: { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 } }
  const a = JSON.stringify(settle({ ...入参 }))
  const b = JSON.stringify(settle({ ...入参, handover: { pricing: { decisionId: 'pricing', from_uid: 'x', to_uid: 'y', at: 'z' } }, operatorLogs: [{ type: 'proxy', by_uid: 'x', owner_uid: 'y' }] }))
  ok(a === b, '③★ 移交/代提交信息进不入参 ⇒ settle 输出逐字节相同（移交不改数值）')
  ok(!/from '\.\/handover\.mjs'|from "\.\/handover\.mjs"/.test(strip(src('settlement.js'))), '③ settlement.js 不 import handover（结算路径零接触）')
}

// ④ 界面入口（非负责人视图 · 不阻断）：静态扫 App.jsx
{
  const app = strip(src('App.jsx'))
  ok(/⚠️ 本项由/.test(app) && /移交给他/.test(app) && /代提交/.test(app), '④ 决策卡非负责人视图有「移交给他 / 代提交」入口（不是死路）')
  ok(/onOperatorLog/.test(app) && /stopPropagation/.test(app.split('本项由')[0].slice(-500)), '④ 入口容器 stopPropagation（不误触卡片跳转）')
  ok(/type: 'handover'/.test(app) && /type: 'proxy'/.test(app), '④ 留痕写入 operatorLog（handover/proxy 两型）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：条件挂载 · 代提交人/责任人分立 · 移交不改数值（settle 逐字节）· 入口不阻断')
process.exit(fail ? 1 : 0)
