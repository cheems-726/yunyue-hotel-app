// V78 · 事件库 35 条内容补全守门（2026-10-08 · 挂 run-all fast）
// 判据（卡①③④）：
//   [1] 每条事件六项齐：名称/描述/影响/持续周/教学点/触发方式（+ 既有五件套不回归）
//   [2] 与引擎实际生效一致：
//       · E1–E8 在 settlement.js 各有专用消费点（E6 本轮修复：原 engine 全项目 0 消费）
//       · E9–E35 全部走 v8 通用通道（engine.v8:true · 维度 ⊆ 现行已消费白名单）
//       · 持续周一律 1（注入周单周生效——引擎无跨周持续机制 ⇒ 文案不许再声称"持续/连续 2 周"）
//   [3] 学生端能看到「发生了什么+影响」（构建注入事件 text 带描述）
//   [4] 教师端详情行渲染六项（源码接线断言）
import { readFileSync } from 'node:fs'
import { 注入事件库, 构建注入事件 } from '../src/teacherEvents.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

console.log('▶ V78 事件库 35 条内容补全')

// [1] 六项齐
{
  ok(注入事件库.length === 35, `事件库 35 条（实读 ${注入事件库.length}）`)
  const 缺 = 注入事件库.filter(e => !e.name || !(e.描述 || '').length || !e.影响 || e.持续周 !== 1 || !e.教学点 || !e.触发方式)
  ok(缺.length === 0, '35 条全带 描述/影响/持续周(=1)/教学点/触发方式', 缺.map(e => e.id).join(','))
  const 短描 = 注入事件库.filter(e => (e.描述 || '').length < 10)
  ok(短描.length === 0, '描述成句（≥10 字）', 短描.map(e => e.id).join(','))
  // 学生端：text 带描述（发生了什么）
  const ev = 构建注入事件({ 事件id: 'E5', 周: 3 })
  ok(ev && ev.text.includes('探店视频爆火') && ev.text.includes('影响：'), '学生端事件卡 text = 描述 + 影响幅度')
  // 教师端：详情行渲染接线（源码断言）
  const td = src('TeacherDashboard.jsx')
  ok(/触发方式：\{当前事件\.触发方式/.test(td) && /持续：\{当前事件\.持续周/.test(td) && /描述：\{当前事件\.描述/.test(td), '教师端详情行渲染 描述/持续/触发方式')
}

// [2] 与引擎实际生效一致
{
  const eng = src('settlement.js')
  // E1–E8 专用消费点（E6 走 v8 通道后无需字面，但 E1–E5/E7/E8 有硬编码消费）
  for (const id of ['E1', 'E2', 'E3', 'E4', 'E5', 'E7', 'E8']) ok(eng.includes(`'${id}'`), `引擎存在 ${id} 专用消费点`)
  const E6 = 注入事件库.find(e => e.id === 'E6')
  ok(E6.engine && E6.engine.v8 === true && E6.engine['客流系数'] === 0.85, '★ E6 已接 v8 通用通道（原 engine 竞争强度加档/持续周 全项目 0 消费 → 本轮修复）')
  const te剥 = src('teacherEvents.mjs').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
  ok(!/竞争强度加档|持续周: 2/.test(te剥), '文档性假 engine（竞争强度加档/持续周:2）已清除（剥注释判 · 注释里的修复记录不算）')
  // E9–E35 全 v8 · 维度白名单（= 现行结算已消费维度）
  const 白 = new Set(['客流系数', '变动成本系数', '品质', '声誉', '士气', '罚款'])
  const E9上 = 注入事件库.filter(e => Number(e.id.slice(1)) >= 9)
  ok(E9上.every(e => e.engine && e.engine.v8), 'E9–E35 全部 v8 通道')
  // 只判【数值维度】——『条件』是叙述键（说明文字），引擎不消费数字以外的键
  const 越维 = E9上.filter(e => Object.entries(e.engine).some(([k, v]) => k !== 'v8' && Number.isFinite(Number(v)) && !白.has(k)))
  ok(越维.length === 0, 'E9–E35 engine 维度 ⊆ 现行已消费白名单', 越维.map(e => e.id).join(','))
  // ★ V81②（2026-10-08）：『消费点存在』断言覆盖【全部】v8 事件（不只 E6）——
  //   每条 v8:true 至少带 1 个白名单效力键 + 四通道在引擎各有真消费点
  //   ⇒ 谁再写出"定义了但没人消费"的事件/删掉消费点，门禁立刻红（可证伪 RV）
  const v8全部 = 注入事件库.filter(e => e.engine && e.engine.v8)
  ok(v8全部.length === 28, `v8 事件全集 = E6 + E9–E35（实读 ${v8全部.length}）`)
  const 零效力 = v8全部.filter(e => ![...白].some(k => Number.isFinite(Number(e.engine[k]))))
  ok(零效力.length === 0, '每条 v8 事件 ≥1 白名单效力键（零「只出文案无数值」）', 零效力.map(e => e.id).join(','))
  for (const [通道, 字面] of [['客流系数', '注入v8客流系数'], ['变动成本系数', '注入v8成本系数'], ['罚款', '注入v8罚款'], ['品质/声誉/士气', '注入v8属性']]) {
    ok(eng.includes(字面), `引擎消费点在：「${通道}」→ ${字面}`)
  }
  // ★ V81③：周报预测文案与引擎单周语义一致（随机「竞店开业」也是当周单周生效 · 无跨周机制）
  ok(!src('WeeklyReport.jsx').includes('持续 1-2 周'), '周报预测不再声称「竞店分流持续 1-2 周」（引擎单周生效 · 两处说法一致）')
  // 持续周语义：引擎无跨周机制 ⇒ 全库持续周=1 且文案不再声称 2 周
  ok(注入事件库.every(e => e.持续周 === 1), '持续周全=1（注入周单周生效 · 引擎现实）')
  const 声称2周 = 注入事件库.filter(e => /持续 2 周|连续 2 周/.test(e.影响 + e.描述))
  ok(声称2周.length === 0, '无「持续/连续 2 周」失实文案', 声称2周.map(e => e.id).join(','))
  // 幅度带（卡内量级带 · 不许一击定生死）
  const 客流越带 = 注入事件库.filter(e => e.engine && Number.isFinite(Number(e.engine['客流系数'])) && (Number(e.engine['客流系数']) < 0.6 || Number(e.engine['客流系数']) > 1.4))
  ok(客流越带.length === 0, '客流系数夹在量级带 [0.6, 1.4]')
  const 属性越带 = 注入事件库.filter(e => ['品质', '声誉', '士气'].some(k => e.engine && Math.abs(Number(e.engine[k]) || 0) > 15))
  ok(属性越带.length === 0, '属性效力夹在 ±15')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：35 条六项齐 · 引擎一致性钉死（E6 修复不回归 · 持续周如实 · 幅度带受控）· 两端看得见')
process.exit(fail ? 1 : 0)
