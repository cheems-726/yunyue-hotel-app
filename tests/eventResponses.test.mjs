// V118 判据：应对映射的语义正确 + **"接不进引擎"必须可编程检查**
//   ① E7 涨薪 vs 冷处理 ⇒ 效力不同（成本 +8000 vs 士气 −10）
//   ② E3 立即整改 vs 停房深清洁 ⇒ 半额 vs 全额
//   ③ E8 花钱整改 vs 托关系 ⇒ 停业 0 vs 2 天，罚款同 5800
//   ④ 未知应对值 ⇒ 可执行 false + 原因「未知应对值」（**不许静默回退**）
//   ⑤ 无 `条件` 的事件 ⇒ 原因「无应对空间」（不是漏填）
//   ⑥ **通道标注必须真实**：凡标 v8可表达 的效力键，必须 ⊆ settlement 实际读取的键（客流系数/变动成本系数/罚款）
//   反例 RV：把 E7 的通道改成 v8可表达 ⇒ ⑥ 红（因为它用了"变动成本加/士气"，引擎不认）
import { 应对映射, 应对效力Of, 无应对空间, 映射统计 } from '../src/eventResponses.mjs'
import { 注入事件库 } from '../src/teacherEvents.mjs'
import { readFileSync } from 'node:fs'

const 坏 = []
let 检查数 = 0
const ok = (c, m) => { 检查数++; if (!c) 坏.push(m) }

// ① E7
{
  const 涨 = 应对效力Of('E7', '涨薪', 注入事件库)
  const 冷 = 应对效力Of('E7', '冷处理', 注入事件库)
  ok(涨.可执行 && 冷.可执行, 'E7 两种应对都应可执行')
  ok(涨.效力.变动成本加 === 8000 && !('士气' in 涨.效力), `涨薪 ⇒ 成本 +8000 且不扣士气（实得 ${JSON.stringify(涨.效力)}）`)
  ok(冷.效力.士气 === -10 && !('变动成本加' in 冷.效力), `冷处理 ⇒ 士气 −10（实得 ${JSON.stringify(冷.效力)}）`)
  ok(JSON.stringify(涨.效力) !== JSON.stringify(冷.效力), '两种应对的效力必须不同（否则"接不接"没意义）')
}

// ② E3 半额 vs 全额
{
  const 立即 = 应对效力Of('E3', '立即整改', 注入事件库)
  const 停房 = 应对效力Of('E3', '停房深清洁', 注入事件库)
  ok(立即.效力.品质 === -4 && 停房.效力.品质 === -8, `E3：立即整改品质 −4 / 停房 −8（实得 ${立即.效力.品质}/${停房.效力.品质}）`)
  ok(Math.abs(立即.效力.品质) === Math.abs(停房.效力.品质) / 2, '立即整改 = 停房的一半（照库里"减半"）')
}

// ③ E8 停业天数
{
  const 花 = 应对效力Of('E8', '花钱整改', 注入事件库)
  const 拖 = 应对效力Of('E8', '托关系拖一拖', 注入事件库)
  ok(花.效力.罚款 === 5800 && 拖.效力.罚款 === 5800, 'E8 两种应对罚款都是 5800（5000+800）')
  ok(花.效力.停业天数 === 0 && 拖.效力.停业天数 === 2, `E8：整改不停业 / 拖延停 2 天（实得 ${花.效力.停业天数}/${拖.效力.停业天数}）`)
}

// ④ 未知值必须报错
{
  const x = 应对效力Of('E7', '随便乱填', 注入事件库)
  ok(x.可执行 === false && x.原因 === '未知应对值', `未知应对值必须报错（实得 ${JSON.stringify(x)}）`)
  ok(!/涨薪|冷处理/.test(x.文案), '未知值不得静默回退到某个已知选项')
}

// ⑤ 无应对空间
{
  const 无 = 注入事件库.find(e => !e.条件 && !应对映射[e.id])
  ok(!!无, '事件库里应有"无应对空间"的事件（否则本判据失效）')
  const x = 应对效力Of(无.id, '任意', 注入事件库)
  ok(x.可执行 === false && x.原因 === '无应对空间', `无应对空间的事件应显式声明（实得 ${JSON.stringify(x)}）`)
  ok(无应对空间(无.id, 注入事件库) === true, '无应对空间() 应返回 true')
}

// ⑥ 通道标注必须真实（★ V128-#2 起 E7/E3 已接线）：
//    · 「危机分支已有」⇒ settlement 里必须有 注入E8已整改 分支读 eventResponses.E8
//    · 「已接线」⇒ settlement 必须真的读 应对效力Of 并落四个出口（成本加/士气/品质/声誉）
{
  const SRC = readFileSync("src/settlement.js", "utf8")
  ok(SRC.includes("注入E8已整改") && SRC.includes("eventResponses"), "settlement 有 E8 应对分支（读 eventResponses）")
  ok(/应对效力Of\('E7'/.test(SRC) && /应对效力Of\('E3'/.test(SRC), "E7/E3 已接线（settlement 读应对效力Of）")
  ok(/注入应对成本加/.test(SRC) && /variableCost \+= 注入应对成本加/.test(SRC), "出口①：变动成本加（元·总额）已入账")
  ok(/applyAttrsDelta\(attrsAfter, \{ morale: Number\(E7效力\.士气\) \}\)/.test(SRC), "出口②：士气 delta 已落属性")
  ok(/quality: Number\(效力E3\.品质\), reputation: Number\(效力E3\.声誉\)/.test(SRC), "出口③④：品质/声誉 delta 已落属性")
  ok(应对映射.E7.通道 === '已接线' && 应对映射.E3.通道 === '已接线', "映射表的通道标注与实现一致（E7/E3=已接线）")
  const 代码 = SRC.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
  ok(!/8000/.test(代码), "★ 幅度单源：settlement 代码里不得写死 8000（必须从 eventResponses 读）")
}
// ⑦ 统计
{
  const s = 映射统计()
  ok(s.事件数 === Object.keys(应对映射).length, `映射统计事件数 = ${s.事件数}`)
  ok((s.已接线 || []).includes('E7') && (s.已接线 || []).includes('E3'), `已接线应含 E7/E3（实得 ${(s.已接线 || []).join('/')}）`)
  ok((s.需扩引擎 || []).length === 0, `需扩引擎应清零（实得 ${(s.需扩引擎 || []).join('/')}）—— V128-#2 已把四个出口接上`)
  ok((s.已通 || []).includes('E8'), '现有通道仍通 E8（危机分支）')
}

console.log('══ V118 应对 → 引擎效力（映射语义 + 通道真伪）══')
console.log('  映射事件 ' + 映射统计().事件数 + ' 条 · 现有通道已通 ' + (映射统计().已通 || []).join('/') + ' · 需扩引擎 ' + 映射统计().需扩引擎.join('/'))
for (const b of 坏.slice(0, 8)) console.log('  ✗ ' + b)
console.log(`结果: ${检查数 - 坏.length} 通过 / ${坏.length} 失败`)
process.exit(坏.length === 0 ? 0 : 1)
