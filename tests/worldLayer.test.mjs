// §32-U3 · 世界层（天气 + 淡旺季 + OTA 平台评分/违规）—— 守门
//
// 判据：① 确定性（同周全班同结果 · 无 Math.random/Date.now · 不消耗随机位置）
//       ② 接线真实性（引擎的 demandStrength 里**确实**乘了三个系数 —— 用"比值恒等式"证明，不是看代码就算）
//       ③ 口径分离（直营不受 OTA 评分/罚款影响）
//       ④ 违规留痕（事件 + 罚款入账 + 降权）
//       ⑤ 表值即规格（天气/季节表的数值与单元卡一致 —— RV「全设 1.0」会在这里变红）
// 运行：node tests/worldLayer.test.mjs   （挂 run-all fast）
import { settle } from '../src/settlement.js'
import { 天气, 天气客流系数, 天气文案, WEATHER_TABLE_CYCLE } from '../src/weather.mjs'
import { 季节, 季节因子, 季节文案, SEASON_TABLE } from '../src/season.mjs'
import { 平台评分, 渠道流量系数, 违规判定, 违规后果, OTA_RATING_CONFIG, OTA_RULES } from '../src/otaRating.mjs'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rd = (p) => { try { return readFileSync(path.join(APP, p), 'utf8') } catch (e) { return '' } }
const 剥注释 = (t) => t.split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const 品牌 = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const 品牌2 = { name: '汉庭', price: '180-280元', standard: '客房70间起', level: '经济' }
const 场 = { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3, city: '成都', district: '春熙路' }
const 决策 = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿' }
const 属性 = { quality: 60, reputation: 70, morale: 65 }
const 跑 = (week, extra = {}) => settle({ site: 场, brand: 品牌, decisions: 决策, week, attrs: { ...属性 }, ...extra })
// 归一化需求强度（剔掉市场波动的周间差异 ⇒ 剩下的差异只可能来自世界层）
const 净需求 = (r, week) => r.demandStrength / (r.marketWave * 天气客流系数(week) * 季节因子(week))

console.log('▶ §32-U3 世界层（天气 / 淡旺季 / OTA 平台）')

console.log('\n[1] 表与纯函数（★ 表值即规格 —— 天气/季节系数就是单元卡口径）')
{
  ok(天气(1).名 === '晴' && 天气客流系数(1) === 1.00, `第 1 周 晴 ×1.00（${天气(1).名}）`)
  ok(天气(2).名 === '阴' && 天气客流系数(2) === 0.96, `第 2 周 阴 ×0.96`)
  ok(天气(3).名 === '雨' && 天气客流系数(3) === 0.90, `第 3 周 雨 ×0.90`)
  ok(天气(4).名 === '暴雨' && 天气客流系数(4) === 0.80, `第 4 周 暴雨 ×0.80（最重惩罚）`)
  ok(天气(5).名 === 天气(1).名 && WEATHER_TABLE_CYCLE.length === 4, '12 教学周 = 4 周循环 × 3 轮（确定性 · 无随机）')
  ok(天气(0).名 === 天气(1).名 && 天气('x').名 === 天气(1).名, '非法周号 ⇒ 按第 1 周（不抛异常）')
  ok(WEATHER_TABLE_CYCLE.every((t, i, a) => i === 0 || t.客流 < a[i - 1].客流), '天气系数严格递减（晴 > 阴 > 雨 > 暴雨 —— 单调性）')
  ok(季节因子(1) === 1.00 && 季节因子(4) === 1.12 && 季节因子(7) === 0.88 && 季节因子(12) === 1.12, `季节：w1 平季 1.00 · w4 旺季 1.12 · w7 淡季 0.88 · w12 旺季 1.12`)
  ok(SEASON_TABLE.length === 12 && SEASON_TABLE.every((r, i) => r.周 === i + 1), '季节表覆盖全部 12 教学周（无缺周）')
  ok(季节(13).越界 === true && 季节因子(13) === 季节因子(12), '越界周号 ⇒ 取末周并标 越界（不静默编值）')
  const 淡 = SEASON_TABLE.filter(r => r.名 === '淡季').map(r => r.因子)
  const 旺 = SEASON_TABLE.filter(r => r.名 === '旺季').map(r => r.因子)
  ok(Math.max(...淡) < Math.min(...旺), `淡季因子整体低于旺季（淡 ${Math.min(...淡)}–${Math.max(...淡)} < 旺 ${Math.min(...旺)}–${Math.max(...旺)}）`)
  ok(天气文案(3).文案.includes('-10%') && 季节文案(7).文案.includes('-12%'), '文案单源：百分比由系数算出（改表 ⇒ 文案自动跟）')
}

console.log('\n[2] OTA 平台评分与渠道系数（纯函数）')
{
  const 好 = 平台评分({ goodRate: 0.95, negativeCount: 0, reviewCount: 20, pendingNegatives: 0 })
  const 差 = 平台评分({ goodRate: 0.70, negativeCount: 6, reviewCount: 20, pendingNegatives: 2 })
  ok(好.评分 > 差.评分, `好评率高/客诉少 ⇒ 评分更高（${好.评分} > ${差.评分}）`)
  const 无评价 = 平台评分({ goodRate: 0.85, negativeCount: 0, reviewCount: 0, pendingNegatives: 0 })
  ok(无评价.明细.客诉率 === 0 && 无评价.评分 === OTA_RATING_CONFIG.base, '无评价 ⇒ 客诉率 0、评分 = 基准（不臆造差评）')
  const 积压0 = 平台评分({ goodRate: 0.85, pendingNegatives: 0 }).评分
  const 积压3 = 平台评分({ goodRate: 0.85, pendingNegatives: 3 }).评分
  ok(Math.abs((积压0 - 积压3) - 3 * OTA_RATING_CONFIG.replyK) < 0.051, `积压 3 条待处理差评 ⇒ 评分 −${(3 * OTA_RATING_CONFIG.replyK).toFixed(2)}（${积压0} → ${积压3}）`)
  ok(渠道流量系数(4.6, 'direct') === 1 && 渠道流量系数(1.0, 'direct') === 1 && 渠道流量系数(5.0, 'direct') === 1, '★ 直营（direct）渠道系数恒 1 —— 平台评分与直营无关（口径分离）')
  ok(渠道流量系数(4.6, 'ota') > 1 && 渠道流量系数(3.0, 'ota') < 1, `OTA 模式：高评分加分、低评分减分（4.6→×${渠道流量系数(4.6, 'ota')} · 3.0→×${渠道流量系数(3.0, 'ota')}）`)
  ok(渠道流量系数(1.0, 'ota') === OTA_RATING_CONFIG.trafficMin, `低评分被下限夹紧（评分 1.0 → ×${渠道流量系数(1.0, 'ota')} = 下限 ${OTA_RATING_CONFIG.trafficMin}）`)
  ok(渠道流量系数(9.0, 'ota') === OTA_RATING_CONFIG.trafficMax && 渠道流量系数(5.0, 'ota') < OTA_RATING_CONFIG.trafficMax, `上限只在越界时生效（评分 9 → ×${渠道流量系数(9.0, 'ota')} = 上限；评分 5.0 → ×${渠道流量系数(5.0, 'ota')}）`)
  const 违规 = 违规判定({ pendingNegatives: 2, overbook: 4 })
  ok(违规.length === 2 && 违规.every(v => v.罚款 > 0 && v.降权 < 1), `两条违规都可触发（差评积压 + 到店无房）`)
  const 后果 = 违规后果(违规)
  ok(后果.罚款 === 25000 && 后果.降权 === 0.6375, `罚款合计 25,000 元 · 降权连乘 ×0.6375（${后果.罚款}/${后果.降权}）`)
  ok(违规判定({ pendingNegatives: 1, overbook: 3 }).length === 0, '未达阈值 ⇒ 无违规（不误伤）')
  ok(OTA_RULES.length >= 4 && OTA_RULES.some(r => r.includes('自主直营')), `规则说明可被界面引用（${OTA_RULES.length} 条 · 含直营口径分离说明）`)
}

console.log('\n[3] 引擎接线：因果由"比值恒等式"证明（不是看代码就算）')
{
  const r1 = 跑(1), r2 = 跑(2), r7 = 跑(7)
  ok(r1.world.天气.客流系数 === 天气客流系数(1) && r1.world.季节.需求因子 === 季节因子(1), 'world.天气/季节 === 模块值（结果的"外部环境"只有一处查表点）')
  const 比2 = 净需求(r2, 2) / 净需求(r1, 1)
  const 比7 = 净需求(r7, 7) / 净需求(r1, 1)
  ok(Math.abs(比2 - 1) < 0.01, `★ 天气真的进了需求链：（净需求 w2 / w1）≈ 1.00（剔除天气后无差异 · 实测 ${比2.toFixed(4)}）`)
  const 期2 = (r2.demandStrength / r2.marketWave) / (r1.demandStrength / r1.marketWave)
  ok(Math.abs(期2 - 天气客流系数(2) / 天气客流系数(1)) < 0.012, `★ 天气因子精确生效：（需求/波动）w2 ÷ w1（=1.00）=== 天气系数 0.96（实测 ${期2.toFixed(4)}）`)
  const 期7 = (r7.demandStrength / r7.marketWave) / (r1.demandStrength / r1.marketWave)
  ok(Math.abs(期7 - (天气客流系数(7) * 季节因子(7)) / (天气客流系数(1) * 季节因子(1))) < 0.02, `★ 天气×季节 同时生效：w7 ÷ w1 === 0.90×0.88 = 0.792（实测 ${期7.toFixed(4)}）`)
  // OTA 渠道系数：同周同输入，ota vs direct（比值里既有既存的 1.2/0.85，也有新的渠道系数）
  const 直 = 跑(4), 平 = 跑(4, { bizMode: 'ota' })
  const 渠道比 = (平.demandStrength / 平.marketWave) / (直.demandStrength / 直.marketWave)
  const 期望比 = (1.2 / 0.85) * 渠道流量系数(平.world.ota.评分, 'ota')
  ok(Math.abs(渠道比 - 期望比) < 0.03, `★ OTA 渠道系数精确生效：ota÷direct === (1.2/0.85)×渠道系数（期望 ${期望比.toFixed(4)} · 实测 ${渠道比.toFixed(4)}）`)
  ok(直.world.ota.适用 === false && 直.world.ota.渠道系数 === 1, '直营：world.ota 标 适用=false 且系数 1（界面据此显示"不受影响"）')
}

console.log('\n[4] 违规留痕 + 口径分离（罚款入账 / 事件可查 / 直营不受影响）')
{
  const 违规跑 = 跑(3, { bizMode: 'ota', pendingNegatives: 3, decisions: { ...决策, overbook: 5 } })
  const 平台事件 = 违规跑.events.filter(e => e.name.includes('平台处罚'))
  ok(平台事件.length === 2, `★ 两条违规都进了 events（留痕）：${平台事件.map(e => e.name.replace('平台处罚 · ', '')).join(' / ')}`)
  ok(违规跑.eventFine === 25000, `罚款计入 eventFine（${违规跑.eventFine} = 5,000 + 20,000）`)
  ok(违规跑.world.违规罚款 === 25000 && 违规跑.world.违规.length === 2, 'world 里可查罚款与违规明细（界面渲染用）')
  const 同输入直营 = 跑(3, { bizMode: 'direct', pendingNegatives: 3, decisions: { ...决策, overbook: 5 } })
  ok(同输入直营.events.every(e => !e.name.includes('平台处罚')) && 同输入直营.eventFine === 0, '★ 同样欠 3 条差评 + 超售 5 间，直营**零平台处罚、零罚款**（口径分离）')
  ok(同输入直营.world.违规.length === 0 && 同输入直营.world.ota.渠道系数 === 1, '直营 world.违规 为空（界面不渲染处罚行）')
}

console.log('\n[5] 公平性与确定性（红线）')
{
  const A = 跑(3), B = settle({ site: { ...场, 客流: 2, 竞争: 5, 波动: 5 }, brand: 品牌2, decisions: 决策, week: 3, attrs: { ...属性 } })
  ok(A.world.天气.名 === B.world.天气.名 && A.world.天气.客流系数 === B.world.天气.客流系数, '★ 同周不同组（不同选址/品牌）⇒ 天气完全相同')
  ok(A.world.季节.名 === B.world.季节.名 && A.world.季节.需求因子 === B.world.季节.需求因子, '★ 同周不同组 ⇒ 淡旺季完全相同（时间维度 · 全班统一）')
  ok(JSON.stringify(跑(5)) === JSON.stringify(跑(5)), '确定性：同输入两跑逐字节一致')
  const 源 = ['src/weather.mjs', 'src/season.mjs', 'src/otaRating.mjs'].map(f => 剥注释(rd(f))).join('\n')
  ok(!/Math\.random|Date\.now|new Date/.test(源), '★ 三个新模块零 Math.random / Date.now（公平红线）')
  ok(!/seededRandom|guestsRng/.test(源), '新模块不消耗任何随机流（不改变既有随机位置）')
}

console.log('\n[6] 接线结构（防"悄悄删")+ Edge 组装登记')
{
  const st = 剥注释(rd('src/settlement.js'))
  ok(/\* 天气系数/.test(st) && /\* 季节系数/.test(st) && /\* 渠道系数/.test(st) && /\* ota后果\.降权/.test(st), 'settlement 需求链里四个世界层乘数都在（删任一 ⇒ 本行红）')
  ok(/world: \{/.test(st) && /违规罚款: ota后果\.罚款/.test(st), '结果里挂了 world（界面唯一数据源）')
  const be = rd('scripts/build-edge-function.mjs')
  ok(/weather\.mjs/.test(be) && /season\.mjs/.test(be) && /otaRating\.mjs/.test(be), '★ 三个新模块已登记 Edge 组装清单（漏登 = 部署后 404 · 已踩 5 次）')
  const wr = rd('src/WeeklyReport.jsx')
  ok(/本周外部环境/.test(wr) && /world\.ota/.test(wr) && /world\.违规/.test(wr), '周报渲染「本周外部环境」（天气/季节/平台 + 处罚明细）')
  // ★ 单元卡 §3③：淡旺季与既有「🎆 节假日爆单事件」的关系必须**写清且不许含糊** ⇒ 机器钉住「叠加」：
  //   两条路径各自独立存在（季节是每周确定性因子；爆单是 site.客流≥3 + rand()<0.2 的条件事件）——
  //   若有人把季节做成"和爆单互斥"（例如 season 里读事件/事件里查季节），本行即红。
  ok(/holidaySurge/.test(st) && /season\.mjs/.test(rd('src/settlement.js')) && !/holidaySurge|EVENT_CONFIG|rand\(\)/.test(剥注释(rd('src/season.mjs'))),
    '淡旺季与「节假日爆单」是【叠加】两条独立路径（季节=确定性因子 · 爆单=条件随机事件 · 互不读取）')
  const claim = rd('src/Claim.jsx')
  ok(/OTA_RULES/.test(claim), '认领页在【选模式之前】明示平台规则（规则文案单源）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('RV（可执行 · 需实测）：node tests/_rv-32u3.mjs —— 天气/季节/渠道系数全设 1、或删接线 ⇒ 本套件必红')
process.exit(fail ? 1 : 0)
