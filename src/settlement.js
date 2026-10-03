import { COMPETITORS, CUSTOMER_PERSONAS } from './siteLocations.mjs'
import { applyEventToAttrs, applyWeeklyDecay, normalizeAttrs, applyAttrsDelta } from './attrs.js'
// ★ §32-U4c-R6 决策风险化（代价单源在 decisionRisk.mjs）：不作为惩罚 + 延迟后果
import { 不作为属性扣减, 本周延迟惩罚, 属性清单 } from './decisionRisk.mjs'
// ★ §32-U8-A 老师事件注入：注入通道（周粒度 · 只影响未来 · 全班同步）+ 互斥/离线默认最差
// ★ §32-U8-补 §2③：离线默认标注（补算跨过事件周 ⇒ 周报显著标注）—— 唯一文案生成点在 teacherEvents
import { 注入互斥冲突, 离线默认标注 } from './teacherEvents.mjs'
import { guestsRng, guestOf, causeWeightsOf, pickCause, makeReviewText, CAUSE_SOURCE, reviewSeverityOf } from './guests.js'
// 🔴 Phase D/C2：把周值拆成 7 天（一期：周值已知 → 按确定性权重分摊；二期替换为逐日独立计算）
//    ★ 硬约束：本调用【不消耗结算 rand】—— dayEngine 用 guestsRng 独立流，故随机序列位置不变（零变化前提）
import { simulateWeek } from './dayEngine.js'
import { deptCostWeekly, DEPT_COST_PER_ROOM_DAY } from './deptCosts.mjs'
// 🔴 A-2：资金三数【单源】—— 引擎不再自带一份起始资金/预警线常量（曾落后界面对一个口径版本）
import { SCALE } from './stateMigration.mjs'
// §14.3 G3 二步：加盟两费（管理费 + CRS）进资金流——只对【汉庭 / 全季 / 海友】计费，
//   未接入品牌返回 null ⇒ 本文件对它们的输出【逐字节不变】（水位线；守门 tests/franchiseFees.test.mjs）
//   纪律：计费在 src/franchiseFees.mjs 【唯一计算点】—— 本处只调用，不重写公式（E1 账本单源）
import { franchiseFees, 一次性费用清单 } from './franchiseFees.mjs'
import { TOTAL_WEEKS } from './semester.mjs'
import { 校验等级限制 } from './tierLimit.mjs'   // ★ §31.2-A1 ③：等级限制真强制（超档 ⇒ throw）
import { shouldHotReview, hotCrisisWeeks, hotCrisisActive, hotCrisisPenalties, applyHotReviewImmediate, HOT_REVIEW_CONFIG } from './hotReview.mjs'   // ★ §32-U1 R2：差评上热门三级惩罚
// ★ §32-U3 世界层（三件 · 全确定性：按教学周查表 / 由本周已有信号派生 ⇒ 同周全班同结果 · 不消耗随机位置）
import { 天气, 天气客流系数, 天气文案 } from './weather.mjs'
import { 季节, 季节因子, 季节文案 } from './season.mjs'
import { 平台评分, 渠道流量系数, 违规判定, 违规后果 } from './otaRating.mjs'

// 🔴 A-1（2026-09-27）：租金曲线【唯一表达式】—— 引擎与展示层（认领页报价单）共用这一处。
//   为什么要单源：W3-2 的报价单原来自带一份 `35 + 档×10`，A-1 改曲线时它就【静默漂移】了
//   （报价单的年租金会比引擎高 25%），正是 BL-7"两套算法算出两个数"的同族。
export const rentPerRoomDay = (档, 兜底 = 3) => 25 + (Number.isFinite(档) ? 档 : 兜底) * 5

// 结算引擎（前端模拟版）
// 核心公式（来自设计文档 §7）：
// 客源强度 = 价格竞争力 × 口碑影响 × 促销/营销加成 × 市场波动 × 城市客流
// 出租率 = 基础出租率 × 客源强度
// 营收 = 入住间数 × 房价
// 利润 = 收入 - 成本
// 评价：入住间数 × 8%，好/差由好评率决定
//
// 公平原则：固定随机种子——同一经营日全班同一随机结果，决策相同则结果相同
// v0.29：18项决策全部接入结算；好评率跨周延续；结算差评回流口碑页

// ── R0 属性→经营结果（规格 §12）──────────────────────────────────────
// 归一化原则（关键）：属性取【中性值】时，所有系数必须 = 1.0
//   → 未接入属性的历史存档、以及"什么都没做"的默认档，结果与改前【完全一致】（回归零变化）
//   → 规格原式在中性值上并不等于 1（priceTolerance 0.95 / occFactor 0.9 / cacFactor 1.2），
//     故统一除以中性基准；属性影响体现为"相对中性值上下浮动"
const ATTR_NEUTRAL = { quality: 60, reputation: 70, morale: 65 }
const PT_BASE = 0.95   // priceTolerance 中性基准
const OCC_BASE = 0.9   // occFactor 中性基准
const CAC_BASE = 1.2   // cacFactor 中性基准

// 斜率系数（可调）：属性影响幅度 = 规格原幅度 × ATTR_SLOPE
//   0.5 = 幅度减半（当前采用：差距适中才有"中盘调整"的教学空间；差距过大→省钱型追不回→直接摆烂）
//   1.0 = 规格原幅度
// 只作用于两个【客流乘数】(priceTolerance / occFactor)；cacFactor / morale / negFactor 走成本与口碑链，幅度本就温和，不动
const ATTR_SLOPE = 0.5

// 品质 → 房价容忍度（客流乘数）：斜率减半后 quality 100 → +5.3%，quality 20 → −5.3%
function priceToleranceOf(quality) {
  return 1 + ((0.95 + (quality - 60) / 400) / PT_BASE - 1) * ATTR_SLOPE
}
// 声誉 → 出租率基线：斜率减半后 reputation 100 → +6.7%，reputation 20 → −11.1%
function occFactorOf(reputation) {
  return 1 + ((0.9 + (reputation - 70) / 250) / OCC_BASE - 1) * ATTR_SLOPE
}
// 声誉 → 获客成本：reputation 100 → ×0.875（便宜12.5%），reputation 20 → ×1.208（贵20.8%）
function cacFactorOf(reputation) {
  return (1.2 - (reputation - 70) / 200) / CAC_BASE
}
// 士气 → 好评率（加法；中性士气 = 0 加成）：morale 100 → +2.9 个百分点
function moraleBonusOf(morale) {
  return (morale - 65) / 12 / 100
}
// 品质+士气 → 差评系数（乘性；中性 = 1.0）：quality 20 且 morale 20 → 约 ×1.51
function negFactorOf(quality, morale) {
  return (1 - (quality - 60) / 200) * (1 - (morale - 65) / 175)
}

// 固定随机种子：简单伪随机（同一 seed 同一结果）
function seededRandom(seed) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return function () {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// 差评文案池（结算生成差评时取样，文案与决策联动）
export const negativeTexts = [
  '「隔音太差了，隔壁半夜看电视听得一清二楚，完全没睡好。」',
  '「网络太慢，视频会议都开不了。」',
  '「热水等了十分钟才来，洗澡体验差。」',
  '「停车场要绕很远，前台也说不清楚。」',
  '「房间设施老旧，和网上照片差距太大。」',
  '「前台办理入住等了半小时，体验很差。」',
  '「床单上有污渍，看着就不舒服，要求换房还推脱。」',
  '「空调制冷效果差，一夜没睡好。」',
  '「早餐品种太少，还限时间，根本来不及吃。」',
  '「服务员态度冷淡，问个问题爱答不理。」',
  '「房间有异味，闻着像烟味，要求处理也没下文。」',
  '「价格太贵了，就这条件和两百块的快捷酒店没区别。」',
  '「退房查房查了十分钟，押金迟迟不退，什么意思？」',
  '「凌晨还有人走廊里大声喧哗，酒店完全不管。」',
  '「叫醒服务没打，差点误了飞机，赔偿都不谈。」',
  '「马桶堵了报修两次才来人，这服务没谁了。」',
]
export const positiveTexts = [
  '「位置很好，离地铁近，房间干净，下次还来。」',
  '「前台服务很热情，入住体验超出预期。」',
  '「床品舒服，睡了个好觉，性价比高。」',
  '「会员价格实惠，还送了早餐，好评。」',
  '「房间隔音好，设施新，细节满分。」',
  '「退房速度快，还主动帮忙叫车，服务到位。」',
  '「热水又快又足，水压也稳，住得舒心。」',
  '「楼下就有便利店和餐馆，出行太方便了。」',
  '「亲戚来旅游订的这家，全家都说好。」',
  '「卫生做得好，连床底都干干净净，放心。」',
  '「出差常驻这家了，稳定靠谱，前台都记住我了。」',
  '「半夜到店还给留了房间，暖心，五星。」',
]
export const guestNames = ['王先生 · 商务出差', '李女士 · 家庭出游', '张先生 · 旅行', '刘女士 · 亲子', '陈先生 · 商务出差', '赵女士 · 度假', '周先生 · 旅行']

// 18 项决策的 id → 中文名（未完成决策提醒用，避免循环依赖从 decisions.js 引入组件数据）
const DECISION_NAMES = {
  pricing: '动态调价', shifts: '前台排班', overbook: '超额预订', 'member-convert': '会员转化',
  'quality-check': '客房质检', linen: '布草管理', hygiene: '卫生计划', ota: 'OTA优化',
  campaign: '活动策划', corporate: '协议客户', reputation: '口碑管理', 'member-threshold': '会员门槛',
  'report-diagnosis': '月度报表诊断', 'revenue-mgmt': '收益管理', 'hr-optimize': '人力优化',
  energy: '能耗管控', renovation: '改造投资', emergency: '应急预案',
}
const DECISION_IDS = Object.keys(DECISION_NAMES)

// 事件一览（教学参考/图鉴用）：与下方触发逻辑一一对应
export const EVENT_INFO = [
  { icon: 'staff.slow', name: '满负荷·响应慢', type: 'bad', trigger: '出租率≥85% 且排班精简', tip: '旺季保服务' },
  { icon: 'ops.cleaning', name: '卫生敷衍', type: 'bad', trigger: '第4周起未做深清洁', tip: '卫生是口碑底线' },
  { icon: 'money.spend', name: '性价比失衡', type: 'bad', trigger: '房价≥320 且口碑<80%', tip: '价格要和品质匹配' },
  { icon: 'event.competitor', name: '竞店开业', type: 'bad', trigger: '选址竞争≥4档', tip: '靠口碑和会员留客' },
  { icon: 'status.crisis', name: '差评发酵（危机）', type: 'crisis', trigger: '欠2条以上差评不处理', tip: '不处理就上热榜' },
  { icon: 'event.fire', name: '消防检查', type: 'bad', trigger: '第6周起未做深清洁', tip: '合规是底线成本' },
  { icon: 'event.water', name: '市政停水半日', type: 'bad', trigger: '小概率随机（不可抗力）', tip: '谁都会遇到，别慌' },
  { icon: 'event.influencer', name: '网红探店', type: 'good', trigger: '好评率≥85%', tip: '好口碑带来免费流量' },
  { icon: 'guest', name: '会员复购潮', type: 'good', trigger: '会员转化选"强调品质"', tip: '品质转化忠诚度高' },
  { icon: 'nav.review', name: '整改获认可·追加好评', type: 'good', trigger: '整改2条以上差评', tip: '整改不是白干' },
  { icon: 'event.expo', name: '会展旺季', type: 'good', trigger: '选址客流≥4档', tip: '选对选址才接得住红利' },
  { icon: 'achv.badge', name: 'OTA金牌商家', type: 'good', trigger: '投放OTA 且好评率≥80%', tip: '流量倾斜跟着口碑走' },
  { icon: 'role.hr', name: '员工关怀日', type: 'good', trigger: '第3周起满编保服务', tip: '对员工好=对客人好' },
  { icon: 'event.night', name: '深夜噪音投诉', type: 'bad', trigger: '小概率随机', tip: '夜班主动巡场防患未然' },
  { icon: 'achv.title', name: '片区评选获奖', type: 'good', trigger: '上周好评率≥85%', tip: '长期主义会被看见' },
  { icon: 'staff.sick', name: '员工请假', type: 'bad', trigger: '第3周起小概率随机', tip: '关键时刻人员备份很重要' },
  { icon: 'ops.repair', name: '设备故障', type: 'bad', trigger: '第2周起小概率随机', tip: '定期检修预防突发故障' },
  { icon: 'event.holiday', name: '节假日爆单', type: 'good', trigger: '选址客流≥3档', tip: '盈利黄金期，提前备好人力' },
  { icon: 'event.concert', name: '周边突发活动', type: 'good', trigger: '第2周起小概率随机', tip: '关注周边活动动态，提前调价' },
  { icon: 'status.crisis', name: '负面舆情（危机）', type: 'crisis', trigger: '有差评未处理时小概率', tip: '及时回复防舆情扩散' },
  { icon: 'status.critical', name: '资金链断裂（危机）', type: 'crisis', trigger: '资金见底', tip: '资金是生命线，宁少赚别乱花' },
  { icon: 'status.warn', name: '资金预警', type: 'bad', trigger: '资金接近预警线', tip: '立即控成本、增收' },
]

// 事件参数集中配置（调平衡只改这里，不动逻辑）
export const EVENT_CONFIG = {
  fullLoadSlow:    { prob: 0.6 },                       // 满负荷·响应慢（另需 occupancy>=0.85 且 排班精简）
  hygieneSlack:    { prob: 0.3, minWeek: 4 },           // 卫生敷衍（另需未做深清洁）
  valueMismatch:   { prob: 0.4, minPrice: 320, maxGoodRate: 0.8 }, // 性价比失衡
  rivalOpen:       { prob: 0.35, occCut: 0.9, minCompetition: 4 }, // 竞店开业
  influencerVisit: { prob: 0.25, minGoodRate: 0.85, goodRateUp: 0.02 }, // 网红探店
  memberRepurchase:{ prob: 0.3 },                       // 会员复购潮（另需会员转化=强调品质）
  reviewFerment:   { prob: 0.4, minPending: 2, goodRateDown: 0.03 }, // 危机·差评发酵
  renovationPraise:{ prob: 0.5, minResolved: 2, goodRateUp: 0.02 }, // 整改获认可
  fireInspection:  { prob: 0.25, minWeek: 6, fine: 1500 }, // 消防检查（另需未做深清洁）
  waterOutage:     { prob: 0.12, occCut: 0.95 },        // 市政停水半日
  expoSeason:      { prob: 0.3, minFlow: 4, occUp: 0.05 }, // 会展旺季（另需客流>=minFlow）
  otaGoldBadge:    { prob: 0.3, minGoodRate: 0.8, goodRateUp: 0.01 }, // OTA金牌商家（另需投放OTA）
  staffCareDay:    { prob: 0.35, minWeek: 3, goodRateUp: 0.01 }, // 员工关怀日（另需满编保服务）
  noiseComplaint:  { prob: 0.2 },                       // 深夜噪音投诉
  staffAbsent:     { prob: 0.18, minWeek: 3 },          // 员工请假（第3周起）
  equipmentBreak:  { prob: 0.15, minWeek: 2, repairCost: 800 }, // 设备故障（第2周起，维修费）
  holidaySurge:    { prob: 0.2, minFlow: 3 },           // 节假日爆单（客流>=3档）
  districtAward:   { prob: 0.3, minPrevGoodRate: 85, goodRateUp: 0.015 }, // 片区评选获奖（另需上周好评率≥85）
}

// 结算主函数
// 结算管线（每周结算按此顺序执行）：
//   [1-2]  选址客流/租金/竞争 → 价格竞争力（调价/收益管理/协议/改造）
//   [3-4]  口碑（跨周延续+决策修正+欠差评惩罚） → 营销加成
//   [5-7]  市场波动(固定种子) → 客源强度 → 出租率(含超售)
//   [7.5]  条件触发事件（12种，改参数只动 EVENT_CONFIG）
//   [8-10] 营收 → 成本(固定/变动/营销/OTA佣金/超售赔偿/改造分摊/事件罚款) → 利润
//   [11-13] 评价生成(差评回流口碑页) → 差评处理减半 → 最终好评率
//   [14-15] 决策复盘insights → 生成本周评价(回流传入口碑页)
// 输入：site（选址属性1-5档）、brand（品牌）、decisions（决策结果）、week（经营周数）、
//       pendingNegatives（口碑页未处理差评数）、prevGoodRate（上周好评率，跨周延续）
//       crisisResponse（上周危机事件的应对选择，影响本周口碑）
//       resolvedCount（已整改差评数，触发追加好评事件）
// 输出：经营结果 + 生成的差评/好评（供口碑页展示）
export function settle({ site, brand, decisions, week = 1, pendingNegatives = 0, prevGoodRate = null, crisisResponse = null, resolvedCount = 0, resolvedWeight = null, bizMode = 'direct', prevCapital = null, pendingPenalty = null, injectedEvents = null, eventResponses = null, 补算 = false, attrs: attrsIn = null, recentReviewTexts = [], liveNegCount = 0, livePosCount = 0, hotState = null }) {
  // 🔴 B2.5：入口【统一归一化】所有数值入参 —— `X != null` 拦不住 NaN / Infinity，因为 typeof NaN === 'number'。
  //   为什么放在入口而不是逐处补：(B2 只修了 prevCapital::512，用户抽查指出 :227 的 `prevGoodRate != null`
  //   是同一种写法；本套件按【写法】全库扫，又扫出 pendingNegatives:253 与 energy:471 —— 共 3 处)
  //   ⇒ "修一处漏一处"的根因是【逐处补】；改为【入口一次性归一化】后，下游无论怎么写都不会再收到非有限值。
  //   语义：null / undefined / '' → 用缺省值（表示"没有该数据"）；能转成有限数 → 取数；其余（NaN/Infinity/'abc'）
  //         → 也用缺省值。★ 对合法数值【零行为变化】（含数字类字符串，原写法靠隐式转换，结果一致）。
  const numOr = (v, d) => (v === null || v === undefined || v === '' ? d : (Number.isFinite(Number(v)) ? Number(v) : d))
  pendingNegatives = numOr(pendingNegatives, 0)
  resolvedCount = numOr(resolvedCount, 0)
  pendingPenalty = (pendingPenalty && typeof pendingPenalty === 'object' && Array.isArray(pendingPenalty.项)) ? pendingPenalty : null
  // ★ §32-U8-A：本周生效的老师注入事件（只看 week 匹配 ⇒ 天生"只影响未来"——已结算周不会被重算）
  //   互斥冲突（与随机事件双倍）⇒ 延迟到 events 声明后再判定（TDZ 教训：events 在下方才声明 ⇒ 此处只过滤周匹配）
  const 注入事件s = (Array.isArray(injectedEvents) ? injectedEvents : []).filter(e => e && Number(e.week) === week && e.source === 'teacher')
  const 注入互斥跳过 = []
  const 生效注入 = 注入事件s.slice()
  const 生效注入sByName = new Map(生效注入.map(ev => [ev.来源事件, ev]))
  // 事件通道的乘数/后果（E1 客流 / E2 商务区客流 / E4 ota / E5 客流+房价容忍 / E7 士气 / E3 属性）
  const 注入客流系数 = (生效注入sByName.has('E1') ? 0.75 : 1) * (生效注入sByName.has('E5') ? 1.35 : 1) * (生效注入sByName.has('E2') && (s.客流 || 0) >= 3 ? 1.4 : 1)
  const 注入ota系数 = 生效注入sByName.has('E4') && bizMode === 'ota' ? 1.3 : 1
  // ★★ §33-V8（2026-10-03）：E9+ 通用效力通道 —— 事件自带 engine（v8:true 标记），
  //   维度全部是【现行结算已消费】的（客流/变动成本/属性/罚款 —— 不新增引擎通道 · 卡内 §1② 红线）。
  //   幅度受控：生成时已夹在量级带内（客流 ±5–40% · 属性 ∓3–15 · 成本 ±10–30%），面板不开放自由公式。
  //   ★ 纯叙事事件（engine 无任何数值维度）⇒ 本段全零 ⇒ 数字逐字节不变（只有事件卡文案 · 专门断言）。
  //   ★ 与 E1–E8 的关系：E1–E8 走各自专用消费点（上方/下方），带 v8 标记的走本通道 —— 同一 injectedEvents
  //     入参，两套消费点并存但维度不重叠（互斥口径在注入时由面板校验拦截）。
  let 注入v8客流系数 = 1
  let 注入v8成本系数 = 1
  let 注入v8罚款 = 0
  for (const ev of 生效注入) {
    const en = ev && ev.engine
    if (!en || !en.v8) continue
    if (Number.isFinite(Number(en.客流系数))) 注入v8客流系数 *= Number(en.客流系数)
    if (Number.isFinite(Number(en.变动成本系数))) 注入v8成本系数 *= Number(en.变动成本系数)
    if (Number.isFinite(Number(en.罚款))) 注入v8罚款 += Number(en.罚款)
  }
  // ★ §32-U4-R4：有效处理权重（职务匹配 ×1.3）。缺省/非法 ⇒ 回退到 resolvedCount（零变化）
  const 有效处理数 = Number.isFinite(Number(resolvedWeight)) && Number(resolvedWeight) > 0 ? Number(resolvedWeight) : resolvedCount
  prevGoodRate = numOr(prevGoodRate, null)
  prevCapital = numOr(prevCapital, null)
  liveNegCount = numOr(liveNegCount, 0)
  livePosCount = numOr(livePosCount, 0)
  const rand = seededRandom(week * 100 + 7) // 固定种子：同一周全班同结果
  let hotOut = null   // ★ §32-U1 R2：上热门危机期（随结果返回 hotReviewCrisis · 存档回传后下周生效）
  // R0：属性 → 经营系数。attrs 缺失/旧档 → normalizeAttrs 兜底为中性值 → 全部系数 = 1.0（零变化）
  const A0 = normalizeAttrs(attrsIn)
  const fPriceTol = priceToleranceOf(A0.quality)   // 品质 → 客流（房价容忍度）
  const fOcc = occFactorOf(A0.reputation)          // 声誉 → 客流（出租率基线）
  const fCac = cacFactorOf(A0.reputation)          // 声誉 → 获客成本
  const moraleAdd = moraleBonusOf(A0.morale)       // 士气 → 好评率（加法）
  const fNeg = negFactorOf(A0.quality, A0.morale)  // 品质+士气 → 差评系数
  // ★ §32-U1 R2（持续期 · 差评概率 ×2）：危机倍数在此处**先算**（出租率段用同一结果 · 不重复算两份）。
  //   hotState 是结算入参（存档回传 ⇒ 补算同源）；非危机 = {occMul:1, badMul:1} ⇒ 式子逐位一致。
  const hotPen = hotCrisisPenalties(hotState, week)
  let hotActiveThisWeek = false   // §32-U1 R2：危机周标志（事件在 events 声明后统一补推）
  const fNegHot = fNeg * hotPen.badMul
// 🔴 选址数据任务（2026-09-27 · 重大修复）：site 在两条路径上有【两种历史形状】，各自断一半 ——
//   ① 前端 App：传的是 `location.attrs`（六维齐全，但**丢了 district**）⇒ 竞品表/客群表永远查不到（键=''）
//   ② 服务端 serverTick：传的是 `src.location` 原对象（**有 district，但六维散在 .attrs 里**）
//      ⇒ `s.客流`/`s.租金`… 全是 undefined ⇒ 全部落 `|| 3` 默认档（选址六维在服务端被忽略）
//   ⇒ 在引擎【入口统一归一化】：有 `.attrs` 就摊平 + 保留 district。两端从此同一形状（D8 同构）。
//   ★ 影响面：只有"带 district 或带 .attrs 嵌套"的调用方会变（前端/服务端/模拟真实路径的测试）；
//     只传六维平铺对象的调用方（engine-parity / 六组赛季）**逐字节不变**。
const s = (site && typeof site.attrs === 'object' && site.attrs)
  ? { ...site.attrs, district: site.district || site.name }
  : (site || {})

  // ★ §31.2-A1 ③（2026-09-30）：【等级限制真强制】引擎侧校验 —— 归一化之后立即判
  //   （三层强制的第三层：前端禁选 / 点击拒绝 / **结算入口 throw**）。超档 ⇒ 显式报错，绝不静默降级。
  校验等级限制({ site: s, brand })

  // 1. 城市客流系数（选址"客流"属性 1-5 → 0.5-1.5）
  const cityFlow = 0.5 + (s.客流 || 3) * 0.2

  // 1.5 租金成本（选址"租金"属性 1-5 → 单房 30-50 元/间·天）
  //   🔴 A-1（2026-09-27 · D47-e）：曲线由 35+档×10（45-85）改为 25+档×5（30-50）
  //   【标定依据】15 档候选扫描（实测值见批次报告-二期批次A）：
  //     旧曲线死亡选址 24/52 = 46.2%（目标 20–30%）· 30+档×5 ⇒ 32.7% · **25+档×5 ⇒ 23.1% ✅**
  //     20+档×5 ⇒ 19.2%（略低）· 统一 30 元 ⇒ 11.5%（过低：选址失去分量）
  //   【为什么这个取值还算得住】档3 = 40 元/间·天 ≈ 40 元/㎡/月（按约 30㎡/间折算），
  //     与成都住建局《租赁住房平均租金水平信息》的住宅类 40–46 元/㎡/月同量级；
  //     旧的 65（≈65 元/㎡/月）明显高于市场 ⇒ 本次是【向真实租金回归】，不是为过断言调参。
  //   ★ 门禁仍保持 ⏳ 已知红：阈值 ≤15% 与教学目标 20–30% 互不相容（见待决策队列 A-1(i)/(ii)）。
  const rentCost = rentPerRoomDay(s.租金 || 3)

  // 1.6 竞争强度（选址"竞争"属性 1-5 → 客流折减）
  const competition = 1.15 - (s.竞争 || 3) * 0.05 // 竞争越大，客流越被分走

  // 2. 价格竞争力（本店房价 vs 全班均价，简化：用品牌房价带 + 调价决策）
  // 教学规则：竞店降价场景下"不决策"= 没有任何反应，等同"不跟降"流失价格敏感客——不作为不是中立选项
  const basePrice = brand ? parsePrice(brand.price) : 300
  const pricing = decisions.pricing || '不跟降'
  let price = basePrice
  let priceCompetitive = 1.0
  if (pricing === '跟降 10%') { price = basePrice * 0.9; priceCompetitive = 1.2 }
  else if (pricing === '降价 20% 抢客') { price = basePrice * 0.8; priceCompetitive = 1.3 }
  else if (pricing === '不跟降') { priceCompetitive = 0.8 }

  // ★ §33-V4-A8（2026-10-01）：选址【房价】维接线 —— 最后一处"界面标了却不生效"。
  //   ── 口径（先把叠加关系写清再动手 · 卡内 §1① 纪律）────────────────────────
  //   · 含义：房价档 = 该区县的【客源支付力/价格环境】1–5 档（数据里高房价区=核心商圈，低=县域）。
  //   · 挂点：乘在 priceCompetitive 上（ demandStrength 链），**不直接改 price** ——
  //     price 是"你定的价"（品牌带 × 调价决策），房价环境改变的是【你这个价好不好卖】，不是你的定价本身。
  //   · 形态：档3 = 中性 ×1.0；每档 ±3%（0.88–1.12）——与 cityFlow（±20%/档）、竞争（5%/档）同族但更温和，
  //     因为高房价区的【收益】已经通过 basePrice（品牌同价下高支付力=好卖）体现，这里只补"环境修正"。
  //   · ★ 不双扣的三条边界（与本包 §1① 一一对应）：
  //     (a) 与 world 系数（天气/淡旺季/OTA）：那些是【时间维】，本维是【空间维】—— 不同轴，乘法天然正交；
  //     (b) 与竞品压力（competitorPressure）：那是【事件级分流】，本维是【静态环境】—— 独立乘数；
  //     (c) 与 fPriceTol（品质→房价容忍度）：那是【你的客群对价格的容忍】，本维是【市场环境的价格水平】——
  //         一个看你、一个看市场，不重复。★ 数字已按"档3 中性"设计 ⇒ 旧档缺省（|| 3）⇒ ×1.0 ⇒ 逐字节不变。
  const 房价环境 = 1 + ((Number.isFinite(Number(s.房价)) ? Number(s.房价) : 3) - 3) * 0.03
  priceCompetitive *= 房价环境

  // [2.45] 开店模式引擎差异化（OTA平台合作 vs 直营）
let otaCommissionRate = 0
if (bizMode === 'ota') {
  otaCommissionRate = 0.15
  priceCompetitive *= 1.2
  if (pricing === '降价 20% 抢客') { priceCompetitive *= 0.9 }
} else {
  priceCompetitive *= 0.85
}

// 2.5 收益管理（连住优惠稳出租 / 尾房闪购拉出租压价 / 组合套餐提价）
  const revenueMgmt = decisions['revenue-mgmt']
  if (revenueMgmt === '连住优惠') { priceCompetitive *= 1.06 }
  else if (revenueMgmt === '尾房闪购') { price *= 0.93; priceCompetitive *= 1.12 }
  else if (revenueMgmt === '组合套餐') { price *= 1.08 }

  // 2.6 协议客户（让利签约：稳定商务客流，房价略降）
  if (decisions.corporate === '让利签约') { price *= 0.95; priceCompetitive *= 1.08 }

  // 2.7 改造投资（从决策当周起房价逐步提升，每周分摊融资成本）
  let renovationCost = 0
  if (decisions.renovation === '投150万改造') { price *= 1.08; renovationCost = 2000 }

  // 3. 口碑影响（好评率 → 1.2/1.0/0.8/0.5），好评率跨周延续
  // 🔴 B2.5：B2 漏掉的同写法实例（用户抽查指出）—— `prevGoodRate != null ? prevGoodRate / 100 : ...`
  //   NaN / 100 = NaN ⇒ goodRate 变 NaN。入口已归一化，此处再用 Number.isFinite 作第二层防御。
  let goodRate = Number.isFinite(prevGoodRate) ? prevGoodRate / 100 : (brand && brand.name ? 0.85 : 0.82)
  if (decisions['hygiene'] === '停房深清洁') goodRate += 0.03
  if (decisions['quality-check']) {
    // 质检排序：隔音/卫生排进前5 → 口碑提升
    const top5 = decisions['quality-check'].slice(0, 5)
    if (top5.includes('隔音')) goodRate += 0.015
    if (top5.includes('卫生')) goodRate += 0.015
  }
  if (decisions['member-convert'] === '强调品质') goodRate += 0.02
  if (decisions['hr-optimize'] === '全员培训') goodRate += 0.02
  if (decisions['report-diagnosis'] === '解决口碑相关') goodRate += 0.015
  if (decisions.reputation === '道歉+赔偿') goodRate += 0.02
  if (decisions.reputation === '模板回复') goodRate -= 0.03
  // 上周危机应对（限时选择）对本周口碑的影响
  let crisisInsight = null
  if (crisisResponse === '立即公开整改+补偿') { goodRate += 0.02; crisisInsight = { good: true, text: '上周危机应对果断（公开整改+补偿），口碑修复中' } }
  else if (crisisResponse === '逐条真诚回复') { goodRate += 0.01; crisisInsight = { good: true, text: '上周危机逐条真诚回复，口碑小幅修复' } }
  else if (crisisResponse === '不理会') { goodRate -= 0.02; crisisInsight = { good: false, text: '上周危机选择了不理会，口碑持续受损——危机不应对就是最差应对' } }
  if (decisions['hr-optimize'] === '裁员1人') goodRate -= 0.02
  // ★ §33-V4-A8：选址【人力】维接线 —— 服务链：用工环境差（档低 = 服务业人力供给薄弱）⇒ 同样排班下
  //   服务更难到位 ⇒ 好评率微降。挂点：goodRate 加法项（与培训 +0.02 / 裁员 −0.02 同量级 · 每档 0.4 个百分点）。
  //   ★ 与 R6 代价（精简省成本的 morale 扣减）不双扣：R6 惩的是【你的选择】，本项是【市场环境】；
  //     档3 中性 = 0 ⇒ 旧档缺省逐字节不变。
  goodRate -= ((Number.isFinite(Number(s.人力)) ? Number(s.人力) : 3) - 3) * 0.004
  // 能耗管控走极端 → 舒适度差招差评
  // 🔴 B2.5：energy 同样在入口归一化 —— 原写法 `if (energy != null) perRoomVariable += (energy - 23) * 2`
  //   在 energy = NaN/Infinity/'abc' 时会把 NaN 灌进 variableCost → totalCost → profit → capital（实测 4 个字段）
  const energyRaw = decisions.energy
  const energy = (energyRaw === null || energyRaw === undefined || energyRaw === '') ? null
    : (Number.isFinite(Number(energyRaw)) ? Number(energyRaw) : null)
  if (energy != null && (energy <= 21 || energy >= 25)) goodRate -= 0.02
  // 会员门槛适中（4-6晚）→ 会员体验好
  const threshold = decisions['member-threshold']
  if (threshold != null && threshold >= 4 && threshold <= 6) goodRate += 0.01
  // 未处理的差评降低好评率（口碑处理联动）
  goodRate -= pendingNegatives * 0.03
  // 经营投入不足的系统性代价（决策少于一半：服务/维护/营销全面松懈，客人先感知）
  const doneCount = Object.keys(decisions).length
  if (doneCount < 9) goodRate -= 0.02
  // R0：士气 → 好评率（规格 §4.3；中性士气加 0）——会经下方 reputationFactor 阈值进一步影响客流
  goodRate += moraleAdd
  goodRate = Math.max(goodRate, 0.3) // 下限 30%
  goodRate = Math.min(goodRate, 0.95) // 上限 95%
  let reputationFactor = goodRate >= 0.85 ? 1.2 : (goodRate >= 0.7 ? 1.0 : (goodRate >= 0.5 ? 0.8 : 0.5))

  // 4. 促销/营销加成（OTA投放/活动/会员转化）
  let marketingBonus = 0
  if (decisions.campaign) marketingBonus += 0.15
  if (decisions.ota) marketingBonus += 0.08
  if (decisions['member-convert'] === '强调优惠') marketingBonus += 0.05

  // 5. 市场波动（固定种子 0.85-1.15，选址"波动"属性影响波动幅度）
  const volatility = 1 + (s.波动 || 3) * 0.02 // 波动越大，市场起伏越大
  const marketWave = (0.85 + rand() * 0.3) * volatility

  // 6. 客源强度
  // R0：品质→房价容忍度、声誉→出租率基线（两个乘数；中性值均为 1.0）
  // ★ §32-U3 世界层（三件 · 全部确定性；都乘在 demandStrength 上 ⇒ 影响的是"客流"，不动成本口径）：
  //   ① 天气（按教学周查固定表）② 淡旺季（按教学周固定表 · 全班统一）③ OTA 平台渠道系数（仅 bizMode='ota'）
  const 本周天气 = 天气(week)
  const 本周季节 = 季节(week)
  const 天气系数 = 天气客流系数(week)
  const 季节系数 = 季节因子(week)
  // OTA 平台评分：由【本周带入的信号】派生（本周好评率 + 本周实时评价数 + 差评积压）——
  //   ★ 为什么不用"本周生成的 negativeCount"：它在本周结算的后半段才生成 ⇒ 用它算本周流量是【同周循环依赖】，
  //     而且会 TDZ（实测：`Cannot access 'negativeCount' before initialization`）。
  //   本函数不新增随机、不新增状态 ⇒ 同周全班同输入同结果。
  const 平台 = 平台评分({ goodRate, negativeCount: liveNegCount, reviewCount: (liveNegCount + livePosCount), pendingNegatives })
  const 渠道系数 = 渠道流量系数(平台.评分, bizMode)     // ★ direct ⇒ 恒 1（口径不串）
  // OTA 违规（渠道侧 · 只对 ota 模式生效）：①差评长期不回复 ②超售导致到店无房 ⇒ 降权（此处）+ 罚款（下方计入 eventFine）+ 事件留痕
  const ota违规s = bizMode === 'ota' ? 违规判定({ pendingNegatives, overbook: decisions.overbook || 0 }) : []
  const ota后果 = 违规后果(ota违规s)
  const demandStrength = priceCompetitive * reputationFactor * (1 + marketingBonus) * marketWave * cityFlow * competition * fPriceTol * fOcc * 天气系数 * 季节系数 * 渠道系数 * ota后果.降权 * 注入客流系数 * 注入ota系数 * 注入v8客流系数

  // 7. 出租率（基础 0.6 × 客源强度，上限 0.98）
  const baseOccupancy = 0.6
  let occupancy = Math.min(baseOccupancy * demandStrength, 0.98)
  // ★ §32-U1 R2（持续期 · 出租率 −30%）：上热门危机期内逐周施加（相对惩罚 · 下限 30% 仍保）
  //   危机状态从【存档输入】hotState 读（App/服务端随存档带上来 ⇒ 补算同源）；不含 rand（确定性）。
  if (hotPen.occMul !== 1) {
    occupancy = Math.max(occupancy * hotPen.occMul, 0.3)
    hotActiveThisWeek = true   // ★ 事件推入延后（events 数组在下方才声明 ⇒ 此处只记标志，防 TDZ）
  }
  // 超额预订：直接抬高本周满房率
  const overbook = decisions.overbook || 0
  if (overbook > 0) occupancy = Math.min(occupancy + overbook * 0.015, 1.0)
  occupancy = Math.max(occupancy, 0.3) // 下限 30%

  // 7.5 条件触发事件系统（按设计文档：属性条件 + 固定种子概率，非纯随机）
// 负向压力机制：属性推到极端会招来事件，教学生权衡而非刷满
const events = []
if (hotActiveThisWeek) addEvent({ type: 'crisis', icon: 'money.spend', name: '舆情危机期·客流大跌', text: '差评上热门的持续影响：本周出租率 −30%（危机期内每周如此）', impact: '出租率 −30%', tip: '处理差评 + 老师裁量是唯二出路；危机期结束自动恢复' })
// ★ §32-U3-C：OTA 违规留痕（罚款金额此处只入事件文案，钱在下方统一计入 eventFine —— 单一入账点）
for (const v of ota违规s) {
  addEvent({ type: 'bad', icon: v.icon, name: `平台处罚 · ${v.名}`, text: `${v.text}（触发值 ${v.触发值}）`, impact: `罚款 ${v.罚款} 元 · 渠道流量 ×${v.降权}`, tip: v.tip })
}
function addEvent(e) { events.push(e) }
let negativeCount = 0
let eventFine = 0
const negSources = [] // 差评来源追踪（只记录，不消耗rand，不影响随机序列）

// ① 满负荷·响应慢：出租率过高 + 排班精简 → 服务跟不上
if (occupancy >= 0.85 && decisions.shifts === '精简省成本' && rand() < EVENT_CONFIG.fullLoadSlow.prob) {
  negativeCount += 2
  negSources.push({ icon: 'staff.slow', name: '满负荷·响应慢' })
  addEvent({ type: 'bad', icon: 'staff.slow', name: '满负荷·响应慢', text: `出租率 ${Math.round(occupancy * 100)}% 却只留了精简人手，客人投诉入住/退房排队，新增 2 条差评`, impact: '差评 +2', tip: '旺季保服务：高出租率时该满编排班' })
}
// ② 卫生敷衍：连续经营未做深清洁
if (decisions.hygiene !== '停房深清洁' && week >= EVENT_CONFIG.hygieneSlack.minWeek && rand() < EVENT_CONFIG.hygieneSlack.prob) {
  negativeCount += 1
  negSources.push({ icon: 'ops.cleaning', name: '卫生敷衍' })
  addEvent({ type: 'bad', icon: 'ops.cleaning', name: '卫生敷衍', text: '连续多周未做深度清洁，客人发现布草污渍，新增 1 条差评', impact: '差评 +1', tip: '卫生是口碑底线，定期停房深清洁' })
}
// ③ 性价比失衡：高房价 + 口碑平平 → 客人觉得不值
if (price >= EVENT_CONFIG.valueMismatch.minPrice && goodRate < EVENT_CONFIG.valueMismatch.maxGoodRate && rand() < EVENT_CONFIG.valueMismatch.prob) {
  negativeCount += 1
  negSources.push({ icon: 'money.spend', name: '性价比失衡' })
  addEvent({ type: 'bad', icon: 'money.spend', name: '性价比失衡', text: `房价 ${Math.round(price)} 元但口碑平平（好评率 ${Math.round(goodRate * 100)}%），客人吐槽"不值这个价"`, impact: '差评 +1', tip: '价格要和品质匹配，否则招差评' })
}
// ④ 竞店开业：选址竞争激烈时被分流
if ((s.竞争 || 3) >= EVENT_CONFIG.rivalOpen.minCompetition && rand() < EVENT_CONFIG.rivalOpen.prob) {
  occupancy = Math.max(occupancy * EVENT_CONFIG.rivalOpen.occCut, 0.3)
  addEvent({ type: 'bad', icon: 'event.competitor', name: '竞店开业', text: '附近新开一家同类酒店分走客流，本周出租率 -10%', impact: '出租率 -10%', tip: '竞争激烈地段要靠口碑和会员留客' })
}
// ⑤ 网红探店（正面）：口碑好被推荐
if (goodRate >= EVENT_CONFIG.influencerVisit.minGoodRate && rand() < EVENT_CONFIG.influencerVisit.prob) {
  addEvent({ type: 'good', icon: 'event.influencer', name: '网红探店', text: '本地探店博主自发推荐了你家酒店，好评率小幅提升', impact: '口碑 +2%', tip: '好口碑会带来免费流量' })
  goodRate = Math.min(goodRate + EVENT_CONFIG.influencerVisit.goodRateUp, 0.95)
}
// ⑥ 会员复购（正面）：强调品质转化带来回头客
if (decisions['member-convert'] === '强调品质' && rand() < EVENT_CONFIG.memberRepurchase.prob) {
  addEvent({ type: 'good', icon: 'guest', name: '会员复购潮', text: '高品质转化的会员带朋友复购，本周散客口碑提升', impact: '—', tip: '强调品质的会员忠诚度更高' })
}
// ⑦ 危机·差评发酵：欠了2条以上差评没处理，被顶上平台热榜
if (pendingNegatives >= EVENT_CONFIG.reviewFerment.minPending && rand() < EVENT_CONFIG.reviewFerment.prob) {
  goodRate = Math.max(goodRate - EVENT_CONFIG.reviewFerment.goodRateDown, 0.3)
  addEvent({ type: 'crisis', icon: 'status.crisis', name: '差评发酵', text: `${pendingNegatives} 条差评长期未处理，被平台顶上"最近差评"热榜，口碑额外受损`, impact: '口碑 -3%', tip: '差评欠得越多发酵越快——口碑页的处理节奏就是口碑本身' })
}
// ★★ §32-U1 R2 · L3「差评上热门」（三级惩罚顶级 · **必触发非概率**）：
//   触发 = 欠 ≥3 条未处理（pendingNegatives 是结算入参 ⇒ 确定性 · 全班同周同结果）。
//   即时：声誉 ×0.5（落 attrsAfter ⇒ 写回属性池）；持续：建立「舆情危机期」2–3 周
//   （hotOut 随结果返回 ⇒ 存档回传 ⇒ 下周起 hotState 生效：出租率−30% · 差评×2 · 见上方接线）。
//   连续多周欠账 ⇒ 刷新 startWeek 重新计时；R3 降级后再犯 ⇒ 覆盖为新一轮（危机不因降级而免疫）。
if (shouldHotReview({ pendingNegatives })) {
  hotOut = { startWeek: week, weeks: hotCrisisWeeks(week), source: `欠 ${pendingNegatives} 条差评未处理 · 上热门`, override: null }
  goodRate = Math.max(goodRate - 0.05, 0.3)
  addEvent({ type: 'crisis', icon: 'status.critical', name: '差评上热门（全网热榜）', text: `${pendingNegatives} 条差评长期不处理，被顶上本地生活平台热榜第一，全网可见！声誉腰斩，进入 ${hotCrisisWeeks(week)} 周舆情危机期（出租率 −30% · 差评概率 ×2）`, impact: `声誉 ×${HOT_REVIEW_CONFIG.reputationCut} · 危机期 ${hotCrisisWeeks(week)} 周`, tip: '这是口碑页三级警告的最高级——差评处理节奏就是酒店的命' })
}
// ⑧ 整改获认可（正面）：认真整改差评，客人追加好评（设计文档§三闭环的奖励侧）
if (有效处理数 >= EVENT_CONFIG.renovationPraise.minResolved && rand() < EVENT_CONFIG.renovationPraise.prob) {
  // ★ §32-U4-R4（职务加成 ×1.3）：口碑增益 = 基数 × 有效权重比（1.0 或 1.3）
  //   ★ 未设职务/旧存档 ⇒ 权重 = resolvedCount ⇒ 比例 1.0 ⇒ 数字与文案逐字节回到改前
  //   ★ 顺手修真 bug（学生可见）：原文字符串把 `', impact: '口碑 +2%` 混进了正文（引号写崩）—— 一并修正
  const 权重比 = resolvedCount > 0 ? 有效处理数 / resolvedCount : 1
  const 增益 = EVENT_CONFIG.renovationPraise.goodRateUp * 权重比
  goodRate = Math.min(goodRate + 增益, 0.95)
  addEvent({ type: 'good', icon: 'nav.review', name: '整改获认可·追加好评', text: `${resolvedCount} 条差评整改到位（有效处理量 ${有效处理数.toFixed(1)}），客人主动修改评价并追加好评，口碑 +${(增益 * 100).toFixed(1)}%`, impact: `口碑 +${(增益 * 100).toFixed(1)}%`, tip: '整改不是白干——认真处理差评会带来口碑回报；对岗处理（职务匹配）效果 ×1.3' })
}
// ⑨ 消防检查：长期不深清洁/不维护的店容易被查出发隐患
if (decisions.hygiene !== '停房深清洁' && week >= EVENT_CONFIG.fireInspection.minWeek && rand() < EVENT_CONFIG.fireInspection.prob) {
  eventFine = EVENT_CONFIG.fireInspection.fine
  addEvent({ type: 'bad', icon: 'event.fire', name: '消防检查', text: '消防突击检查发现疏散通道堆物，限期整改并罚款 ' + eventFine + ' 元（已计入本周成本）', impact: '成本 +' + eventFine + '元', tip: '合规是底线成本，别抱侥幸心理' })
}
// ⑩ 市政停水半日：任何店都可能碰上（小概率，全班同周同命中）
if (rand() < EVENT_CONFIG.waterOutage.prob) {
  occupancy = Math.max(occupancy * EVENT_CONFIG.waterOutage.occCut, 0.3)
  addEvent({ type: 'bad', icon: 'event.water', name: '市政停水半日', text: '片区管网检修停水半天，部分客人提前退房，出租率 -5%', impact: '出租率 -5%', tip: '不可抗力谁都会遇到，别慌，下周就恢复' })
}
// ⑪ 会展旺季（正面）：客流充沛地段吃到红利
if ((s.客流 || 3) >= EVENT_CONFIG.expoSeason.minFlow && rand() < EVENT_CONFIG.expoSeason.prob) {
  occupancy = Math.min(occupancy + EVENT_CONFIG.expoSeason.occUp, 0.98)
  addEvent({ type: 'good', icon: 'event.expo', name: '会展旺季', text: '片区大型会展开幕，周边酒店全线满房，本周出租率 +5%', impact: '出租率 +5%', tip: '选址选客流，红利期才接得住' })
}
// ⑫ OTA金牌商家（正面）：投放OTA且口碑达标
if (decisions.ota && goodRate >= EVENT_CONFIG.otaGoldBadge.minGoodRate && rand() < EVENT_CONFIG.otaGoldBadge.prob) {
  goodRate = Math.min(goodRate + EVENT_CONFIG.otaGoldBadge.goodRateUp, 0.95)
  addEvent({ type: 'good', icon: 'achv.badge', name: 'OTA金牌商家', text: '平台授予金牌商家标识，线上转化率提升，口碑小幅上涨', impact: '口碑 +1%', tip: '线上渠道的流量倾斜跟着口碑走' })
}
// ⑬ 员工关怀日（正面）：满编经营的店，员工状态好带动服务
if (decisions.shifts === '满编保服务' && week >= EVENT_CONFIG.staffCareDay.minWeek && rand() < EVENT_CONFIG.staffCareDay.prob) {
  goodRate = Math.min(goodRate + EVENT_CONFIG.staffCareDay.goodRateUp, 0.95)
  addEvent({ type: 'good', icon: 'role.hr', name: '员工关怀日', text: '为一线员工办生日会，服务热情度上升，客人感知更好', impact: '口碑 +1%', tip: '对员工好，员工才会对客人好' })
}
// ⑭ 深夜噪音投诉：任何店都可能碰到
if (rand() < EVENT_CONFIG.noiseComplaint.prob) {
  negativeCount += 1
  negSources.push({ icon: 'event.night', name: '深夜噪音投诉' })
  addEvent({ type: 'bad', icon: 'event.night', name: '深夜噪音投诉', text: '深夜隔壁房间聚会喧哗，投诉处理不及时招来差评', impact: '差评 +1', tip: '前台夜班要主动巡场，防患于未然' })
}
// ⑮ 片区评选获奖（正面）：口碑持续优秀被行业协会认可
if (prevGoodRate != null && prevGoodRate >= EVENT_CONFIG.districtAward.minPrevGoodRate && rand() < EVENT_CONFIG.districtAward.prob) {
  goodRate = Math.min(goodRate + EVENT_CONFIG.districtAward.goodRateUp, 0.95)
  addEvent({ type: 'good', icon: 'achv.title', name: '片区评选获奖', text: '酒店行业协会年度评选中获奖，品牌曝光度提升', impact: '口碑 +1.5%', tip: '长期主义会被看见' })
}
// ⑯ 员工请假：人手短缺影响服务
if (week >= 3 && rand() < EVENT_CONFIG.staffAbsent.prob) {
  negativeCount += 1
  negSources.push({ icon: 'staff.sick', name: '员工请假' })
  addEvent({ type: 'bad', icon: 'staff.sick', name: '员工请假', text: '前台员工突发感冒请假，人手短缺导致入住办理变慢，新增1条差评', impact: '差评 +1', tip: '关键时刻人员备份很重要' })
}
// ⑰ 设备故障：热水器/空调坏了需要维修
if (week >= 2 && rand() < EVENT_CONFIG.equipmentBreak.prob) {
  eventFine += EVENT_CONFIG.equipmentBreak.repairCost || 800
  addEvent({ type: 'bad', icon: 'ops.repair', name: '设备故障', text: '热水系统突发故障，紧急维修花费800元，部分客人体验受影响', impact: '成本 +800元', tip: '定期检修可以预防突发故障' })
}
// ⑱ 节假日爆单（正面）：客流>=3的地段节假日客流入涌
if ((site?.客流 || 3) >= 3 && rand() < EVENT_CONFIG.holidaySurge.prob) {
  occupancy = Math.min(occupancy + 0.08, 0.98)
  addEvent({ type: 'good', icon: 'event.holiday', name: '节假日爆单', text: '节假日来临，周边客流量大增，出租率 +8%', impact: '出租率 +8%', tip: '节假日是盈利黄金期，提前备好人力' })
}
// ⑲ 周边突发活动（正面）：演唱会/展会等带动客流
if (week >= 2 && rand() < 0.2) {
  occupancy = Math.min(occupancy + 0.06, 0.98)
  addEvent({ type: 'good', icon: 'event.concert', name: '周边突发活动', text: '附近举办演唱会/展会，大量外地客涌入', impact: '出租率 +6%', tip: '关注周边活动动态，提前调价' })
}
// ⑳ 负面舆情（危机）：有差评且未处理时概率触发
if (pendingNegatives >= 1 && rand() < 0.15) {
  addEvent({ type: 'crisis', icon: 'status.crisis', name: '负面舆情', text: '有客人在社交媒体发布差评帖子，开始被转发议论', impact: '口碑风险', tip: '及时回复差评可以防止舆情扩散' })
}

  // [7.8] 竞品AI动态调价（每个竞品根据侵略性决定本周策略）
  const competitors = COMPETITORS[site?.district || ''] || []
  let competitorPressure = 0
  const competitorActions = competitors.map(c => {
    // AI决策：根据侵略性和随机数决定行为
    const roll = rand()
    let action = 'hold'
    let priceChange = 0
    if (roll < c.aggression * 0.08) { action = '降价'; priceChange = -Math.round(c.basePrice * 0.1); competitorPressure += 0.04 }
    else if (roll < c.aggression * 0.12) { action = '促销'; priceChange = -Math.round(c.basePrice * 0.15); competitorPressure += 0.06 }
    else if (roll > 1 - c.aggression * 0.05) { action = '涨价'; priceChange = Math.round(c.basePrice * 0.08); competitorPressure -= 0.02 }
    return { name: c.name, level: c.level, basePrice: c.basePrice, action, price: c.basePrice + priceChange }
  })
  // 竞品降价 → 客流被分流（出租率下降）
  if (competitorPressure > 0) {
    occupancy = Math.max(occupancy * (1 - competitorPressure), 0.2)
  }

  // ★ §32-U8-A：互斥判定（此时随机事件已全部触发完毕 ⇒ events 里有本周全部随机事件名）
  //   冲突的注入条目从 生效注入 挪到 注入互斥跳过（后面的注入事件卡段会分别渲染/留痕）
  for (const ev of 注入事件s) {
    if (!生效注入.includes(ev)) continue
    if (注入互斥冲突(ev.来源事件, events.map(x => x.name))) {
      生效注入.splice(生效注入.indexOf(ev), 1)
      注入互斥跳过.push(ev)
    }
  }
  // [7.9] 客群画像匹配（客群偏好 vs 酒店决策 → 满意度加/减分）
  // ★★ §33-V6（2026-10-02）：「客群结构加权」—— 把"标签"升级为"结构"（模块七「客群视角」真缺口）。
  //   改前（决策端 grep 实证）：只判 persona.dominant（谁是主力），三档占比数值全项目零使用
  //   ⇒ 90% 商务区与 40% 商务区（同 dominant）加减分完全相同 ⇒ "选址决定客源结构"在结算里没有分量。
  //   ── 新口径 ──────────────────────────────────────────────────────
  //   · **三路并行**：每类客群的偏好命中分**都算**（不许 dominant 判断后再乘占比 —— 那是"标签×占比"，
  //     非主力永远拿不到分）；再按**归一化占比**加权求和：客群加权分 = Σ(各路命中分 × 占比/Σ占比)。
  //   · 各路命中分沿用改前的固定值（±0.01~0.02 · 量级不变 ⇒ 混合效应只改"分配"，不改整体幅度）。
  //   · **混合效应**（卡内 §1②）：30% 游客的商务区，"低价策略"仍拿 0.3×0.02 的可观加分 —— 不退回只看主力。
  //   · **文案保留**（卡内 §1①）：每条反馈文案照出（学生要看得见"为什么"）—— ★ 文案**逐字保持改前形态**
  //     （不带占比后缀）：占比展示归【界面】（选址页 personaLine 百分比 + 周报客群卡整行）；
  //     文案里塞占比会破坏水位线（dominant 独占中性时文案必须 === 旧文案，逐字节判据才成立）。
  //   · 均衡兜底：三路都零命中（占比未命中任何偏好）才走"通用服务质量"（与改前同分值）。
  //   ── 不双扣边界（卡内 §1④ · 与 V4-A8/R4/R6 逐条）──────────────────
  //   · × V4-A8 房价维：房价维乘在 demandStrength（客流**量**），本段加在 goodRate（口碑**质**）—— 不同链不双扣；
  //     且 tourist 路的"价格实惠"看的是 price vs basePrice（你的定价决策），房价维看的是市场环境 —— 一个看你一个看市场。
  //   · × V4-A8 人力维：人力维的成本项在 variableCost/deptCost（钱），服务项是"人力环境"∓goodRate；
  //     本段 shifts 命中分评的是【你选的排班是否合客群口味】，不是【雇人贵不贵】—— 决策评价 vs 环境成本，零交叠。
  //   · × R4 职务加成（×1.3）：R4 乘在【差评处理的口碑权重】（weekInputs 单源），本段是【客群对经营决策的满意度】
  //     —— 处理差评 vs 日常经营偏好，两件事、两条链，无公共项。
  //   · × R6 代价（decisionRisk）：R6 记录"决策自身的属性代价"（未质检/超售/不作为），本段评"决策与客群的匹配"
  //     —— 同一决策可以既有代价（R6）又获客群加分（本段），但两者机制独立、字段独立，不是同一分被算两次。
  const persona = CUSTOMER_PERSONAS[site?.district || ''] || { business: 33, tourist: 33, family: 34 }   // 展示形状与改前一致（缺省三路均分）
  const 有客群表 = !!(CUSTOMER_PERSONAS[site?.district || ''])
  // ★ 缺省形态（V6 水位线的另一半）：site 无 district / 客群表无该区县 ⇒ 三路权重全 0
  //   ⇒ 三路整路跳过 ⇒ 走均衡兜底 —— 与改前（dominant=undefined ⇒ 三路 if 都不进 ⇒ 均衡兜底）**逐字节等价**；
  //   persona 返回值仍给 {33,33,34}（展示形状不变）。不能给"缺省再三路加权"：那会改变无 district 调用方的行为。
  const 占比和 = 有客群表
    ? Math.max(0.0001, (Number(persona.business) || 0) + (Number(persona.tourist) || 0) + (Number(persona.family) || 0))
    : 0
  const 权 = 有客群表
    ? {
        business: (Number(persona.business) || 0) / 占比和,
        tourist: (Number(persona.tourist) || 0) / 占比和,
        family: (Number(persona.family) || 0) / 占比和,
      }
    : { business: 0, tourist: 0, family: 0 }
  let personaBonus = 0
  const personaFeedback = []
  // ── 商务客路（安静+快速入住+商务设施）──
  //   ★ 占比 0% 的路整路跳过（不算分、不出文案）：0% 客群没有份量，提它的反馈是噪音；
  //     这同时是 V6 的水位线形态 —— dominant 独占（100/0/0）⇒ 只跑 dominant 路 ⇒ 与改前 dominant-only **逐字节等价**。
  if (权.business > 0) {
    let 路 = 0
    if (decisions.energy != null && energy >= 22 && energy <= 24) { 路 += 0.02; personaFeedback.push('✅ 温度适中，商务客满意') }
    if (decisions.shifts === '满编保服务') { 路 += 0.015; personaFeedback.push('✅ 快速办理入住，商务客好评') }
    if (decisions.hygiene !== '停房深清洁') { 路 -= 0.01; personaFeedback.push('⚠ 清洁不足，商务客敏感') }
    personaBonus += 路 * 权.business
  }
  // ── 游客路（价格+景区距离+当地特色）──
  if (权.tourist > 0) {
    let 路 = 0
    if (price <= basePrice * 0.9) { 路 += 0.02; personaFeedback.push('✅ 价格实惠，游客满意') }
    if (decisions.hygiene === '停房深清洁') { 路 += 0.015; personaFeedback.push('✅ 卫生好，游客好评') }
    if (decisions.pricing === '降价 20% 抢客') { 路 -= 0.01; personaFeedback.push('⚠ 低价可能吸引低质量客') }
    personaBonus += 路 * 权.tourist
  }
  // ── 家庭客路（空间+安全+亲子设施）──
  if (权.family > 0) {
    let 路 = 0
    if (decisions.energy != null && energy >= 22 && energy <= 25) { 路 += 0.015; personaFeedback.push('✅ 温度适合家庭') }
    if (decisions.shifts === '满编保服务') { 路 += 0.01; personaFeedback.push('✅ 人手充足，家庭安心') }
    if (decisions.linen === '外包') { 路 -= 0.015; personaFeedback.push('⚠ 外包布草品质不稳定，家庭客在意') }
    personaBonus += 路 * 权.family
  }
  // 均衡兜底（三路零命中才走 · 与改前同分值）：通用服务质量决定
  if (personaFeedback.length === 0) {
    if (decisions.hygiene === '停房深清洁') { personaBonus += 0.01; personaFeedback.push('✅ 深清洁提升口碑') }
    if (decisions.reputation === '道歉+赔偿') { personaBonus += 0.01; personaFeedback.push('✅ 优质差评回复提升形象') }
  }
  goodRate = Math.max(Math.min(goodRate + personaBonus, 0.98), 0.25)

  // 8. 营收（房量 × 出租率 × 房价）
  const rooms = brand ? parseRooms(brand.standard) : 70
  let occupiedRooms = Math.round(rooms * occupancy)
  // 🔴 T1.1（D16 拍板）：revenue 是【一晚】口径 → ×7 扩为【一周】
  //   依据：华住样例 100间×90%×200元×365 = 657万/年（详见 3-设计文档/科目时间口径表.md §v2）
  const revenue = Math.round(occupiedRooms * price) * 7

  // 9. 成本（真实酒店成本结构）
  // 🔴 T1.4/B3：租金【单独列示】—— GOP（经营毛利）口径【不含】租金/加盟费/利息（术语表 §B1），
  //    所以必须先把它从 fixedCost 里拆出来，否则 GOP 会被少算一笔租金。
  //    租金 = 可售房 × 单房日租 × 7 天（单房日租由选址"租金"属性决定；65 元 ≈ 华住 52.5 元/间/天量级）
  let rentCostWeekly = rooms * rentCost * 7
  // 报表诊断选"成本相关" → 压降租金支出（谈判降租/换租约）
  if (decisions['report-diagnosis'] === '解决成本相关') rentCostWeekly = Math.round(rentCostWeekly * 0.95)
  // 人力优化：裁员立即降本，培训成本不变
  if (decisions['hr-optimize'] === '裁员1人') rentCostWeekly = Math.round(rentCostWeekly * 0.9)
  // 除租金外的固定成本（折旧 / 基础人工分摊）：当前模型未单列 ⇒ 恒 0，留出科目位
  const fixedCost = 0
  // 变动成本 = 入住数 × 单房变动（布草、易耗品、水电）
  // 布草自洗单件便宜（前提投入已在筹建期）；外包贵
  let perRoomVariable = 60
  if (decisions.linen === '自洗') perRoomVariable = 52
  if (decisions.linen === '外包') perRoomVariable = 66
  // 排班人力跟入住量走（满编多派人手服务到位，精简省人力但服务质量风险由事件体现）
  if (decisions.shifts === '满编保服务') perRoomVariable += 18
  else if (decisions.shifts === '精简省成本') perRoomVariable -= 12
  // ★ §33-V4-A8：选址【人力】维接线 —— 成本链：区县用工环境 1–5 档 → 弹性人力单价。
  //   ── 口径（与 ① 房价维同一张叠加表）─────────────────────────────
  //   · 含义：人力档 = 该区县【服务业用工供给/工资水平】1–5 档（高新区 5 = 工资高 · 中江 1 = 便宜）。
  //   · 挂点①（成本）：乘在【弹性人力部分】（shifts 的 ±18/−12）与 deptCosts 的 laborFixed 单价上；
  //     档3 = 中性 ×1.0，每档 ±4%（0.88–1.16）—— 高工资区雇人贵，便宜县城雇人省。
  //   · ★ 不双扣的两条边界：
  //     (a) 与 shifts/linen/energy 的每间加减：那些是【你选的排班/外包/温度】；本维是【雇同样的人贵不贵】——
  //         乘在"人力类"科目上、不碰布草/能耗；
  //     (b) 与 R4 职务加成（×1.3 口碑权重）、R6 代价（精简的 morale 扣减）：那些是【属性/口碑侧】，
  //         本维只进【成本侧】—— 钱和口碑不同轴，零交叠。
  //   · 缺省（|| 3）⇒ ×1.0 ⇒ 旧档/未选区者逐字节不变。
  const 人力环境 = (Number.isFinite(Number(s.人力)) ? Number(s.人力) : 3)
  const 人力系数 = 1 + (人力环境 - 3) * 0.04
  {
    // 只作用于【人力类】变动部分：shifts 的加减项（+18 / −12）先剥离再乘（布草与能耗不乘）
    // ★ 乘完 Math.round：成本链保持整数口径（人力系数 ±16% × 18 最多 ±2.9 元，取整误差 ≤1 元/间·天）
    const shifts加减 = (decisions.shifts === '满编保服务' ? 18 : decisions.shifts === '精简省成本' ? -12 : 0)
    const 其余 = perRoomVariable - shifts加减
    perRoomVariable = 其余 + Math.round(shifts加减 * 人力系数)
  }
  // 能耗管控：温度设低省电、设高耗电
  if (energy != null) perRoomVariable += (energy - 23) * 2
  // ★ §33-V8：E9+/自定义事件的 变动成本系数（量级带内 ×1.1–1.3 · 缺省 1 ⇒ 零变化）
  if (注入v8成本系数 !== 1) perRoomVariable = Math.round(perRoomVariable * 注入v8成本系数)
  // 🔴 T1.1（D16 拍板）：variableCost 同为【一晚】口径 → ×7
  let variableCost = occupiedRooms * perRoomVariable * 7
  const dept = deptCostWeekly({ rooms, decisions, 人力档: Number.isFinite(Number(s.人力)) ? Number(s.人力) : 3 })   // ★ §33-V4-A8：人力档 → laborFixed 单价
  const deptCost = dept.total

  // 营销成本 = 做活动才有额外支出
  // R0：声誉 → 获客成本（声誉高→同样营销支出更便宜；中性值 = ×1.0）
  let marketingCost = decisions.campaign ? Math.round(5000 * fCac) : 0
  // OTA 佣金：平台合作模式全营收抽成15%，直营只有投放OTA时才有11%佣金
  const otaCommission = bizMode === 'ota' ? Math.round(revenue * otaCommissionRate) : (decisions.ota ? Math.round(revenue * 0.11) : 0)
  // §14.3（D53-a/b）加盟两费：管理费 + CRS，按【营收百分比】计提。
  //   ① 只有 3 个品牌有完整费率来源 ⇒ 其余品牌返 null（不拿别家费率冒充）
  //   ② 纯算术、不消耗 rand() ⇒ 事件/差评/竞品的随机序列不受影响（公平性红线）
  //   ③ 进 totalCost 后 profit→capital 自动受影响；进 weeklyExpenses 则保证「成本构成合计 === totalCost」不破
  const 加盟 = franchiseFees(brand, revenue)
  const 加盟两费 = 加盟 ? 加盟.合计 : 0
  // 超售赔偿：到店无房按间赔偿（每间赔一晚房价）
  let overbookCompensation = 0
  if (overbook > 0) {
    const walkIn = rand() < overbook * 0.08 ? overbook : Math.max(0, Math.round(overbook * 0.4 * rand()))
    overbookCompensation = walkIn * Math.round(price)
  }
  // ★ §22.2-B2（2026-09-29）· 一次性费用进资金流（开业收 · 保证金期末退）
  //    【唯一计算点】在 franchiseFees.一次性费用清单 —— 本处只调用，不重写公式（E1 账本单源）。
  //    · 开业（week === 1）⇒ 加盟费/保证金/筹备费/筹备保证金/PMS初装 **计入 totalCost**
  //      ⇒ "选加盟开局直接少四分之一"（全季 80 间 ≈ 34.9 万 ≈ IC 的 23%）
  //    · 期末（week === TOTAL_WEEKS）⇒ **保证金全额退还**（负成本科目）⇒ 资金自动加回
  //    · 未接入品牌 ⇒ 清单为 null ⇒ 两项都为 0 ⇒ **结算输出逐字节不变**（水位线同 §14.3）
  //    · 幂等：settle 是纯函数（同 week 同结果），且"每周只结算一次"由上层幂等键保证
  //      ⇒ 重复结算同周不会重复收/退
  //    · ★ 口径注：GOP【不含】一次性费用（筹建期费用不属经营毛利）；净利润【含】（学生真金白银）
  const 一次性 = 一次性费用清单(brand)
  const 开业费用 = (week === 1 && 一次性) ? 一次性.合计 : 0
  const 保证金退还 = (week === TOTAL_WEEKS && 一次性) ? (一次性.保证金 ?? 0) : 0
  // ★ §32-U3-C：OTA 平台罚款并入 eventFine（**唯一入账点** —— 在所有事件赋值之后、算总成本之前，
  //   否则会被既有 `eventFine = 消防罚款` 那类"整体赋值"静默清掉）。无违规 ⇒ ota后果.罚款 = 0 ⇒ 逐字节不变。
  // ★ §32-U8-A：E8 消防注入的数值后果（罚款 + 停业砍出租率）—— 在事件卡区之前算好（防 TDZ · U1 同法）
  // ★ §32-U8-补 §2②：E8「是否已整改」判定【单源】—— 数值分支（此处）与事件卡（下方）共用同一标志位，
  //   不许两处各判一次（"两处各写一份"是本项目的老病）。学生应对经 eventResponses 传入；
  //   缺省 ⇒ 与改前逐字节一致（旧调用方/长跑基线不受影响）。
  const 注入E8已整改 = (eventResponses && eventResponses.E8 === '立即整改') || crisisResponse === '立即整改' || crisisResponse === '立即送医+道歉'
  let 注入消防罚款 = 0
  if (生效注入sByName.has('E8')) {
    if (!注入E8已整改) { 注入消防罚款 = 5000; occupancy = Math.max(occupancy * (5 / 7), 0.3) }
    else { 注入消防罚款 = 800 }
  }
  if (ota后果.罚款) eventFine += ota后果.罚款
  if (注入消防罚款) eventFine += 注入消防罚款
  if (注入v8罚款) eventFine += 注入v8罚款   // ★ §33-V8：E9+/自定义事件的罚款/一次性支出（唯一入账点同纪律）
  const totalCost = fixedCost + rentCostWeekly + variableCost + deptCost + marketingCost + otaCommission + overbookCompensation + renovationCost + eventFine + 加盟两费 + 开业费用 - 保证金退还

  // 10. 利润
  const profit = revenue - totalCost
  // 🔴 T1.4/B3：GOP（经营毛利）= 营收 −（变动成本 + 营销 + OTA佣金 + 其他部门成本）
  //    口径【不含】租金 / 加盟费 / 利息（术语表 §B1）；"其他部门成本"本模型尚未建模 ⇒ 记 0。
  //    ⚠️ 因此本项目的 GOP 率会高于华住真实口径 —— 属【模型范围差异】，不是算错（见 §〇.9）。
  //    ★ §22.2-B2：开业一次性费用/保证金退还也【不进 GOP】（筹建期/资产回冲，不属经营毛利）。
  const gopDeptCost = variableCost + deptCost
  const gop = revenue - (gopDeptCost + marketingCost + otaCommission)   // gopDeptCost = 变动+固定部门成本（勿再叠加 variableCost）
  const gopRate = revenue > 0 ? gop / revenue : 0
  const netProfit = gop - rentCostWeekly - overbookCompensation - renovationCost - eventFine - 加盟两费 - 开业费用 + 保证金退还
  const netProfitRate = revenue > 0 ? netProfit / revenue : 0

// [10.5] 资金真实扣减 + 破产判定
// 🔴 A-2（2026-09-27 · D47-f）：资金三数改【单源】—— 从 stateMigration 的 SCALE 取，引擎里不再写死。
//    历史（为什么这里曾写 502 万）：T1.1 按 m=10.0483 抬到 5,020,000（SCALE_STEPS ①），
//      W2-1 部门成本落地后又 ×0.2970 ⇒ 1,490,000（SCALE_STEPS ②）。
//    ★ 病灶：引擎停在【v2 的 502 万】，落后界面对一个口径版本 —— isWarning 线 502,000 实际等于
//      起始资金的 33.7%，而界面「破产预警」线早已是 14.9 万（10%）⇒ 同一条"预警"引擎/界面差一个量级。
//    单源后：initialCapital = SCALE.IC_NEW（1,490,000）· isWarning 线 = SCALE.变红线（149,000）
//    ⚠️ 比例【不动】：仍是代码既有的 0.1×IC。任务包 §五·步骤3 把"预警线"记作 0.2×IC，而 0.2 那一档
//      是 UI 变黄线（SCALE.变黄线）—— 改比例会改破产判定时机，属 A 级 ⇒ 留队列，不擅改。
//    历史自检（T1.1 期，记录用）：① 预警/破产触发周次 vs 改前差异 0 周 ✅ ② 评级分布一致 ✅
const initialCapital = SCALE.IC_NEW
// 🔴 B2-1 故障注入抓到：原先写 `prevCapital != null ? prevCapital : initialCapital`，
//   而 `typeof NaN === 'number'`、`Infinity` 也是 number ⇒ 脏入参会让 capital 直接变 NaN 并外传。
//   改用 Number.isFinite：合法数值行为【完全不变】，只把 NaN/Infinity/null 归到起始资金。
//   ⚠️ 更正（B2.5）：原注释写"同类输入已逐个探过，本处是唯一漏网的"——【该结论是错的】。
//     错在【探测方式】：探的是"想到的输入"，而不是"全库同一种写法"。
//     按写法扫后共发现 3 处：prevGoodRate:227（除法）、pendingNegatives:253（乘法）、energy:471（加减乘）。
//     处置已改为【入口统一归一化】（见函数开头 numOr），并留下常驻守门 tests/nullGuardPattern.test.mjs。
let capital = Number.isFinite(prevCapital) ? prevCapital : initialCapital
capital = capital + profit
const isBankrupt = capital < 0
const isWarning = !isBankrupt && capital < SCALE.变红线
// ⚠️ 与任务包的差异（已记入待决策清单，A-2 起只更新数值不改比例）：任务包把"预警线"记为 0.2×IC，
//    但代码里 0.2 那一档是【UI 变黄线】（SCALE.变黄线 = 29.8 万），引擎 isWarning 实际是 0.1×IC。
//    本处按【代码既有的 0.1 比例】取 SCALE.变红线（14.9 万）。
// ✅ §21.1-A-2（2026-09-28 · D62 已核验）：**这两条线是【刻意保留的语义差异】，不是遗留不一致** ——
//    · `isWarning`（0.1×IC = 14.9 万）= 引擎的【破产预警】语义（与 isBankrupt 同族：决定"是否预警"）
//    · `SCALE.变黄线`（0.2×IC = 29.8 万）= UI 的【资金偏低】提示语义（更早一点的提示，不是预警）
//    ⇒ 二者是【两种不同的话术/时机】，不是"同一件事存了两个值"。**改比例会挪动破产判定时机（A 级）**，
//      故本处**不改**；已同步标注进《待决策队列》并把那条老项标为"已核验"。
//    ★ 写这段的目的：避免后人（含我自己）再把它当"未收口的遗留"重复排查 ——
//      本项目已两次把已核验的事当遗留重做（§16-A1 前提过时、本项同族）。
// 决策复盘容器（必须在使用前声明：本文件下方多处 push，含"决策模式异常一致"的防作弊提醒）
const insights = []
// 防作弊：全部决策选相同模式→可疑警告
const doneKeys = Object.keys(decisions).filter(k => !k.startsWith('__'))
if (doneKeys.length === 18) {
  const vals = Object.values(decisions).filter(v => typeof v === 'string')
  const allSame = vals.length > 0 && vals.every(v => v === vals[0])
  if (allSame) insights.push({ good: false, text: '⚠️ 决策模式异常一致，请确认是经过独立思考的选择' })
}
if (isBankrupt) {
  addEvent({ type: 'crisis', icon: 'status.critical', name: '资金链断裂', text: `资金降至 ${Math.round(capital).toLocaleString()} 元！立即削成本或贷款。`, impact: '破产风险', tip: '减少支出' })
} else if (isWarning) {
  addEvent({ type: 'bad', icon: 'status.warn', name: '资金预警', text: `资金仅 ${Math.round(capital).toLocaleString()} 元。`, impact: '接近破产', tip: '控制成本' })
}

// 11. 评价生成
const reviewCount = Math.round(occupiedRooms * 0.08)
for (let i = 0; i < reviewCount; i++) {
  // R0：差评概率 = (1-好评率) × negFactor
  // ⚠️ 必须写成 r >= 阈值 的等价形式：fNeg=1 时阈值为 goodRate，与改前【逐位一致】
  //    （若写成 r < (1-goodRate)*fNeg，概率虽同但同一颗随机数映射的事件变了 = 换随机序列）
  // ★ §32-U1 R2：fNegHot = fNeg × 危机倍数（危机期差评概率×2 · 非危机=1 ⇒ 式子逐位一致）
  if (rand() >= 1 - (1 - goodRate) * fNegHot) negativeCount++
}
  // 超售到店无房必招差评
  if (overbookCompensation > 0) {
    negativeCount += 1
    negSources.push({ icon: '📋', name: '超售到店无房' })
  }

  // 12. 差评处理影响
  let negativeImpact = negativeCount
  if (decisions.reputation === '道歉+赔偿' || decisions.reputation === '解释原因') {
    negativeImpact = Math.round(negativeCount * 0.5) // 按时回复减半
  }

  // 13. 最终好评率
  // 🔴 P4（2026-09-22）：好评率不得为负。
  //   机制：negativeCount 会被「差评潮」「超售」推高到 reviewCount 之上（差评潮的 +1 在**本行之后**才发生，
  //   所以"先夹 negativeCount 再算"在这里做不到），于是 (reviewCount − negativeImpact)/reviewCount 变负，
  //   学生在周报看到"好评率 83% → -100%"。修法：公式内夹取（分子不低于 0），reviewCount=0 时也不低于 0。
  const finalGoodRate = reviewCount > 0
    ? (reviewCount - Math.min(negativeImpact, reviewCount)) / reviewCount
    : Math.max(0, goodRate)

  // 14. 决策复盘（对关键决策给出评价；insights 已在文件上方声明）
  // 未完成决策提醒（教学：不作为也是一种决策）
  if (doneCount < 18) {
    const undone = DECISION_IDS.filter(id => !(id in decisions))
    insights.push({ good: false, text: `本周只完成 ${doneCount}/18 项决策，${undone.length} 项未处理（含：${undone.slice(0, 4).map(id => DECISION_NAMES[id] || id).join('、')}${undone.length > 4 ? '等' : ''}）——未决策的部分按"维持现状"生效` })
  }

  if (pricing === '跟降 10%') insights.push({ good: occupancy >= 65, text: occupancy >= 65 ? '调价跟降 10% 拉住了客流，出租率达标' : '跟降 10% 客流仍不足，可能需要更大力度降价或提升口碑' })
  if (pricing === '不跟降') insights.push({ good: profit >= 0, text: profit >= 0 ? '不跟降保住了单间利润，本周盈利' : '不跟降保住了单价但客流流失严重，导致亏损' })
  // ★ §32-U3 世界层：本周外部环境（天气/淡旺季）写进决策复盘 —— 文案由各模块单源生成（不在引擎里手拼百分比）
  //   ★ `kind: 'world'` = 可识别标记：水位线比对（franchiseFees 零变化等）据此**精确剥掉这三条新增行**，
  //     而不必放宽整段 insights 的比对（只排除"有意新增"，其余仍逐字节比）。
  insights.push({ kind: 'world', good: 天气系数 >= 1, text: 天气文案(week).文案 + '（天气只影响客流，不影响房价与成本）' })
  insights.push({ kind: 'world', good: 季节系数 >= 1, text: 季节文案(week).文案 + '（淡旺季对全班所有店统一生效）' })
  if (bizMode === 'ota') {
    insights.push({ kind: 'world', good: 渠道系数 >= 1, text: `OTA 平台评分 ${平台.评分} → 渠道流量 ×${渠道系数}${ota违规s.length ? `；本周有 ${ota违规s.length} 项平台处罚（见事件）` : ''}` })
  }
  if (pricing === '降价 20% 抢客') insights.push({ good: profit >= 0, text: profit >= 0 ? '降价抢客拉高了出租率，薄利多销有效' : '降价 20% 客流涨了但利润被压垮，得不偿失' })
  if (decisions.shifts === '满编保服务') insights.push({ good: negativeCount <= 1, text: negativeCount <= 1 ? '满编排班保证了服务质量，差评少' : '满编排班成本高，但服务质量仍没跟上' })
  if (decisions.shifts === '精简省成本') insights.push({ good: negativeCount === 0, text: negativeCount === 0 ? '精简排班省了成本，且没影响服务' : '精简排班省了成本，但服务响应慢招来差评' })
  if (decisions.hygiene === '停房深清洁') insights.push({ good: true, text: '停房深清洁提升了口碑，长期利好' })
  if (decisions.reputation === '道歉+赔偿' || decisions.reputation === '解释原因') insights.push({ good: true, text: '差评处理得当，负面影响减半' })
  if (decisions.reputation === '模板回复') insights.push({ good: false, text: '模板回复显得敷衍，差评负面影响未减半' })
  if (overbook > 2) insights.push({ good: overbookCompensation === 0, text: overbookCompensation === 0 ? `超售 ${overbook} 间全部消化，满房率提高` : `超售 ${overbook} 间导致到店无房，赔偿 ${overbookCompensation} 元` })
  if (energy != null && (energy <= 21 || energy >= 25)) insights.push({ good: false, text: `空调设定 ${energy}℃ 过于极端，客人投诉舒适度，能耗成本也没占到便宜` })
  if (decisions.linen === '自洗') insights.push({ good: true, text: '布草自洗压低了单间变动成本，长期划算' })
  if (decisions.renovation === '投150万改造') insights.push({ good: week >= 2, text: '改造投资拉高房价带，品质与口碑长期受益，但注意回收期' })
  if (decisions.ota) insights.push({ good: true, text: 'OTA 投放带来线上客流，但佣金成本已计入（本周佣金 ' + otaCommission + ' 元）' })
  if (decisions.corporate === '让利签约') insights.push({ good: true, text: '协议客户让利签约，商务客流稳定，出租率更稳' })
  if (crisisInsight) insights.push(crisisInsight)

  // 15. 生成本周评价（差评回流口碑页；事件性差评优先携带来源标签）
  const generatedReviews = []
  // ── 结构化评价生成（评价系统升级 第2步 · 实时联动）────────────────────
  // 【随机流守恒·关键】下面所有 rand() 的抽取【次数与顺序与改前逐次一致】：
  //   · "差评潮"分支的判定值与 negativeCount 增量属于数值口径 → 其抽取值依赖流位置；
  //   · 内容（客人身份/原因/文本）一律改由独立流 randReview 生成，本段只做"占位抽取"。
  //   卡片本身【不在此处生成】，统一在下方按"目标 − 实时已产生"生成差额。
  const randReview = guestsRng(week * 1000 + 137)
  const keptRand = () => { rand() }   // 占位抽取：仅推进结算随机流，值不参与任何内容或数值
  const revWeights = causeWeightsOf(
    decisions,
    { attrs: A0, occupancy: Math.round(occupancy * 100), price: Math.round(price), overbook, flow: s.客流 },
    week
  )
  // 去重范围：① 批内（本次生成的多条互不重复）② 跨周（调用方经 recentReviewTexts 传入历史文本）
  const recentTexts = Array.isArray(recentReviewTexts) ? recentReviewTexts.filter(t => typeof t === 'string').slice(-10) : []
  const mkReview = (starsIn, forceCause = null) => {
    const isNegSlot = starsIn === 'neg'           // 差评占位：星级待 cause 定后按经营状态算
    const guest = guestOf(randReview)             // 每条推进一次独立流（客人身份）
    const cause = forceCause || pickCause(isNegSlot || starsIn <= 3 ? revWeights.negative : revWeights.positive, randReview) || (isNegSlot ? 'misc' : 'praise_misc')
    const stars = isNegSlot ? negStars(cause) : starsIn
    let text = makeReviewText({ cause, persona: guest.persona, stars, rnd: randReview, recent: recentTexts })
    if (!text) {                                  // 兜底：仍保留旧文本池（不出现空文本）
      const pool = stars >= 4 ? positiveTexts : negativeTexts
      text = pool[Math.floor(randReview() * pool.length)]
    }
    recentTexts.push(text)
    return {
      avatar: guest.avatar,
      name: guest.card,                           // 与旧 UI 兼容：name 即"称呼 · 客群"
      guest, cause, stars, text,
      roomType: guest.roomType,
      nights: guest.nights,
      relatedDecision: CAUSE_SOURCE[cause] || null,
    }
  }

  // 差评星级 = 经营状态决定（语气分级），不再随机。
  // 铁律（保随机流位置）：原「抽一次定星级」必须在**原位置**照抽不误 —— negStarsSlot() 就是那次占位，
  //   真正的星级在 cause 抽定之后由 negStars(cause) 算出（只读不抽）→ 独立流位置与改前完全一致。
  const negStarsSlot = () => { randReview(); return 'neg' }
  const negStars = (cause) => reviewSeverityOf({
    quality: A0.quality, morale: A0.morale,
    negRatio: negativeCount / Math.max(1, reviewCount),
    pending: pendingNegatives, cause: cause || '',
  })

  // ① 保留改前的抽取序列（条件判定 + 内容占位），卡片改在下方统一生成
  for (let i = 0; i < Math.min(negativeCount, 3); i++) { keptRand(); keptRand(); keptRand() }
  if (reviewCount - negativeCount > 0 && rand() < 0.6) { keptRand(); keptRand() }
  let surgeAdd = 0
  if (goodRate >= 0.8 && rand() < 0.5) {
    keptRand(); keptRand()
    surgeAdd = 1
    if (rand() < 0.5) { keptRand(); keptRand(); surgeAdd = 2 }
  }
  if (goodRate <= 0.55 && rand() < 0.4) {
    negativeCount += 1 // 差评潮：口碑差时更多客人倾向于写差评（下周经 pendingNegatives 发酵）—— 数值口径保持原样
    negSources.push({ icon: '🌊', name: '差评潮' })
    keptRand(); keptRand(); keptRand()
  }

  // 🔴 P4（2026-09-22）：差评数不可能超过评价数，但「差评潮」「超售」会在此之上额外 +1，
  //    使 finalGoodRate = (reviewCount − negativeImpact)/reviewCount 出现负值
  //    （实测 −100%/−50%，学生会看到"好评率 X% → -100%"这种无意义数字）。
  //    夹取后两个口径同时自洽：差评数 ≤ 评价数、好评率 ≥ 0；差评卡目标随之用夹取后的数量，
  //    卡片数与周报数字仍然严格一致（守恒不破）。
  if (negativeCount > reviewCount) negativeCount = reviewCount

  // ② 卡片生成：目标 − 本周实时已产生 = 差额（数字与卡片严格一致）
  //    差评卡目标 = negativeCount（全展示，不封顶 —— 封顶会让"5 条差评只见 3 张"，痛感被截断）
  //    好评卡目标 = max(0, reviewCount − negativeCount) + 口碑爆发追加
  //    本周实时评价（LiveFeed 已产出的）直接顶替前若干张 → 结算只补差额，不重复
  const liveNeg = Math.max(0, Math.floor(Number(liveNegCount) || 0))
  const livePos = Math.max(0, Math.floor(Number(livePosCount) || 0))
  const negTarget = negativeCount                                  // 含"差评潮/超售"的追加
  const posTarget = Math.max(0, reviewCount - negativeCount) + surgeAdd
  const negToGen = Math.max(0, negTarget - liveNeg)
  const posToGen = Math.max(0, posTarget - livePos)
  const forceNoRoom = overbookCompensation > 0
  for (let i = 0; i < negToGen; i++) {
    generatedReviews.push({
      id: `w${week}-n${i}`,
      bg: 'blue',
      date: `第${week}周`,
      status: 'pending',
      source: negSources[i] || null,
      ...mkReview(negStarsSlot(), i === 0 && forceNoRoom ? 'no_room' : null),
    })
  }
  for (let i = 0; i < posToGen; i++) {
    generatedReviews.push({
      id: `w${week}-g${i}`,
      bg: 'green',
      date: `第${week}周`,
      status: 'good',
      ...(surgeAdd > 0 && i >= posTarget - surgeAdd ? { surge: '口碑爆发' } : {}),
      ...mkReview(5),
    })
  }

  // [16] 资金流水（本周变动）
  // 🔴 W2-1：成本构成改为【与 totalCost 同源】——原先这组数字是另一套公式且漏掉租金与改造投资
  //   ⇒ "成本构成合计 ≠ 引擎总成本"，学生对不上账。现在逐项来自引擎真实科目，合计 === totalCost。
  const weeklyExpenses = {
    ...Object.fromEntries(dept.lines.map(l => [l.名称, l.值])),
    客房变动成本: variableCost,
    租金: rentCostWeekly,
    营销推广: marketingCost || 0,
    OTA佣金: otaCommission || 0,
    超售赔偿: overbookCompensation || 0,
    改造投资: renovationCost || 0,
    事件罚款: eventFine || 0,
    // §14.3：未接入品牌不加任何键（否则输出字节会变）⇒ 用条件展开
    //   键名/金额均取自 franchiseFees 的 依据[]（单源：界面与断言都读同一份）
    ...(加盟 ? Object.fromEntries(加盟.依据.map(x => [x.科目, x.金额])) : {}),
    // ★ §22.2-B2：开业一次性费用 / 保证金退还（负成本）—— 未接入品牌同样不加键（水位线）
    ...(开业费用 ? { 开业一次性费用: 开业费用 } : {}),
    ...(保证金退还 ? { 保证金退还: -保证金退还 } : {}),
  }
  const totalExpenses = Object.values(weeklyExpenses).reduce((a, b) => a + b, 0)

  // ⑧ 事件 → 属性（规格第六节）：只读取已收集的事件名，纯函数、不消耗 rand（公平红线不破）
  //    收尾统一处理：不侵入 ~20 个触发点；attrs.js 表里没有的事件名自动视为无影响
  const attrsBefore = normalizeAttrs(attrsIn)
  // ★ §32-U1 R2：若本周触发上热门（L401 已置 hotOut）⇒ 即时声誉×0.5 必须先落进【事件前基线】，
  //   否则事件→属性与衰减会把它当"从未发生"。attrsAfter 在此声明（let · 触发块只置 hotOut，不碰属性）。
  let attrsAfter = hotOut ? applyHotReviewImmediate(attrsBefore) : attrsBefore
  // ═══ ★ §32-U4c-R6 决策风险化（原则②③）═══════════════════════════════════
  const r6延迟生效 = (() => {
    const 项s = pendingPenalty ? pendingPenalty.项 : []
    const 合计 = {}
    for (const p of 项s) for (const [k, v] of Object.entries((p && p.属性) || {})) {
      if (属性清单.includes(k) && Number.isFinite(Number(v))) 合计[k] = (合计[k] || 0) + Number(v)
    }
    return Object.keys(合计).length ? 合计 : null
  })()
  if (r6延迟生效) attrsAfter = applyAttrsDelta(attrsAfter, r6延迟生效)
  const r6不作为 = 不作为属性扣减(doneCount)
  if (Object.keys(r6不作为).length) attrsAfter = applyAttrsDelta(attrsAfter, r6不作为)
  const r6本周属性后果 = (r6延迟生效 || Object.keys(r6不作为).length)
    ? { ...(r6延迟生效 ? { 延迟惩罚: r6延迟生效, 延迟来源: (pendingPenalty.项 || []).map(x => x.来源) } : {}),
        ...(Object.keys(r6不作为).length ? { 不作为: { ...r6不作为, 缺项数: Math.max(0, 18 - doneCount) } } : {}) }
    : null
  // ★ §32-U8-A：注入事件卡（周报可见 · 标明"老师注入"）+ 互斥跳过留痕 + E3/E7 属性后果 + E8 罚款
  // ★ §32-U8-补 §2②③：注入事件卡增强 —— 来源标识(来源:'teacher')/注入人/学生应对记录/离线补算标注
  //   ★ 条件挂载（水位线）：无注入 ⇒ 本段一个键都不加；补算=false 或已应对 ⇒ 不加 离线标注 键。
  for (const ev of 生效注入) {
    const 应对 = eventResponses && typeof eventResponses === 'object' ? eventResponses[ev.来源事件] : null
    addEvent({
      type: 'bad', icon: ev.icon || '📌',
      name: ev.name.replace('📌 老师注入 · ', '老师注入 · '),
      text: (ev.text || '') + '（这是老师注入的事件 · 30 秒内选择你的应对）' + (ev.injectedBy ? ` ｜ 注入人：${ev.injectedBy}` : ''),
      impact: ev.impact || '见事件说明', tip: ev.tip || '',
      来源: 'teacher',
      ...(应对 ? { 你的应对: 应对 } : {}),
      // 补算 且 无应对记录 ⇒ 按最差计入的显著标注（文案唯一生成点在 teacherEvents.离线默认标注）
      ...(补算 && !应对 ? { 离线标注: 离线默认标注(ev.name.replace(/^老师注入 · /, ''), week) } : {}),
    })
  }
  for (const ev of 注入互斥跳过) {
    addEvent({ type: 'bad', icon: 'status.critical', name: '老师注入事件未生效（与本周随机事件互斥）', text: ev.name + ' 与本周已随机触发的事件同类 —— 按去重口径只生效一条（见事件系统注释）', impact: '无', tip: '同一市场冲击不该叠加成双倍' })
  }
  if (生效注入sByName.has('E3')) {
    const 全额 = (decisions.hygiene || '不停房') === '不停房'
    const 扣 = { quality: 全额 ? -8 : -4, reputation: 全额 ? -5 : -2 }
    attrsAfter = applyAttrsDelta(attrsAfter, 扣)
    addEvent({ type: 'bad', icon: 'ops.cleaning', name: '卫生突检结果', text: 全额 ? '检查发现卫生隐患（卫生计划为"不停房"）⇒ 品质 −8 / 声誉 −5' : '检查基本合格（已有停房深清洁）⇒ 品质 −4 / 声誉 −2（减半）', impact: '品质/声誉下滑', tip: '品质是底线投资：不整改 → 下周差评潮' })
  }
  if (生效注入sByName.has('E7')) {
    const 冷处理 = true   // 离线默认最差 / 30 秒未选 = 冷处理（与危机超时语义一致）
    if (冷处理) {
      attrsAfter = applyAttrsDelta(attrsAfter, { morale: -10 })
      addEvent({ type: 'bad', icon: 'event.resign', name: '员工集体请辞威胁（冷处理）', text: '你没有（或没能）做出应对 ⇒ 团队士气 −10', impact: '士气 −10', tip: '人力是资产不是成本：涨薪（成本+）或招临时工（品质−）都是应对' })
    }
  }
  // ★ §33-V8：E9+/自定义事件的属性效力（品质/声誉/士气 · 加法 · 量级带内 ∓3–15）
  //   缺省/纯叙事 ⇒ 注入v8属性空 ⇒ 零变化。效果说明已在该事件的主卡（生效注入循环）文案里。
  {
    const 注入v8属性 = {}
    for (const ev of 生效注入) {
      const en = ev && ev.engine
      if (!en || !en.v8) continue
      for (const k of ['品质', '声誉', '士气']) {
        if (Number.isFinite(Number(en[k]))) 注入v8属性[k] = (注入v8属性[k] || 0) + Number(en[k])
      }
    }
    if (Object.keys(注入v8属性).length > 0) {
      attrsAfter = applyAttrsDelta(attrsAfter, 注入v8属性)
      const 属性名 = { quality: '品质', reputation: '声誉', morale: '士气' }
      const 明细 = Object.entries(注入v8属性).map(([k, v]) => `${属性名[k] || k} ${v > 0 ? '+' : ''}${v}`).join(' / ')
      addEvent({ type: 注入v8属性.morale < 0 || 注入v8属性.quality < 0 || 注入v8属性.reputation < 0 ? 'bad' : 'good', icon: '⚡', name: '突发事件效力结算', text: `老师注入事件的属性效力：${明细}`, impact: 明细, tip: '事件效力受控在量级带内 —— 影响可测但不一击定生死' })
    }
  }
  if (生效注入sByName.has('E8')) {
    // ★ §32-U8-补 §2②：共用上方数值分支的同一标志位（单源判定，见上方注释）
    if (!注入E8已整改) {
      addEvent({ type: 'bad', icon: 'event.fire', name: '消防检查不达标（老师注入）', text: '未通过检查 ⇒ 罚款 5000 + 停业 2 天（离线/未应对按最差计入）', impact: '罚款 5,000 元 · 出租率 −2/7', tip: '唯一"建议必选"事件：合规成本远低于停业风险' })
    } else {
      addEvent({ type: 'bad', icon: 'event.fire', name: '消防检查（已立即整改）', text: '及时整改 ⇒ 花费 800 元，避免停业', impact: '成本 +800 元', tip: '损失不对称：整改 800 远优于停业 2 天' })
    }
  }
  if (r6延迟生效) addEvent({ type: 'bad', icon: 'staff.slow', name: '上周决策的延迟代价', text: (pendingPenalty.项 || []).map(x => x.文案).filter(Boolean).join('；') || '上周的省成本决策本周显现代价', impact: '属性 ' + Object.entries(r6延迟生效).map(([k, v]) => ({ quality: '品质', reputation: '声誉', morale: '士气' })[k] + ' ' + (v > 0 ? '+' : '') + v).join(' / '), tip: '决策不是只看当周 —— 省下的钱，下周可能用服务与口碑去买单' })
  const r6下周惩罚 = 本周延迟惩罚(decisions)
  const eventAttrEffects = [] // 本周事件对属性的影响（周报展示用）：只含真正产生变化的事件
  for (const ev of events) {
    const mid = applyEventToAttrs(attrsAfter, ev.name)
    const deltas = {}
    let changed = false
    for (const k of ['quality', 'reputation', 'morale']) {
      const d = mid[k] - attrsAfter[k]
      if (d !== 0) { deltas[k] = d; changed = true }
    }
    attrsAfter = mid
    if (changed) eventAttrEffects.push({ name: ev.name, icon: ev.icon || '', deltas })
  }

  // ⑨ 每周自然衰减（规格 §7）：品质按品牌档次衰减 / 声誉 -1 + 品质惩罚(<50 按档次放大) / 士气 -1，下限 20
  //    调用 attrs.js 中已验证的纯函数（不在此重写逻辑）；结果体现在返回的 attrsAfter
  const attrsAfterDecay = applyWeeklyDecay(attrsAfter, brand && brand.level)

  // 🔴 Phase D/C2 · D1：周值 → simulateWeek 拆 7 天（整数分摊 + 余数补偿 ⇒ Σ7天 === 周值，逐项精确）
  //    天数据【不持久化】：算完即弃，不进存档（用户 2026-09-22 约束②）
  //    seed 用 week ⇒ 同周同权重（确定性）；不参与任何数值计算，纯派生
  // ★ §26.3 P0b④（2026-09-29 · 用户投诉「数据之间没有联动」）：**补上逐日入住/退房的真实缺口**
  //   （原传 0 ⇒ 面板「今日已退房/已入住」只能由客户端自己模拟 ⇒ 与引擎不同源）。
  //   模型假设（写清 · 不臆造）：一周内**每间在店客房周转一次**（入/退各 1 次）
  //     ⇒ 周值 checkins = checkouts = occupiedRooms；
  //     逐日分布沿用本引擎既有的 7 天权重（`dayWeights(seed)` ⇒ 与营收同作息），
  //     不另编"周几集中退房"（**无数据支撑**）；日内"上午退房 / 下午入住"由面板时段文案表达。
  //   ★ 水位线自查：`simulateDay` 只把周值拆成快照、**不回流**任何金额或结算结果
  //     ⇒ 本次改动只让 `dailySnapshots[].checkins/checkouts` 由 0 变真实值，**其它输出逐字节不变**。
  const dailySnapshots = simulateWeek({
    decisions,
    state: { price: Math.round(price) },
    seed: week,
    weekTotals: {
      revenue,
      cost: totalCost,
      checkins: occupiedRooms,
      checkouts: occupiedRooms,
      occupied: occupiedRooms,
      reviews: reviewCount,
      cashDelta: profit,
    },
  })

  return {
    week,
    occupancy: Math.round(occupancy * 100),
    rooms,
    occupiedRooms,
    price: Math.round(price),
    revenue,
    totalCost,
    rentCost: rentCostWeekly,   // 🔴 T1.4/B3：租金独立科目（GOP 口径不含它）
    gop,                        // 🔴 T1.4/B3：经营毛利（不含租金/加盟费/利息）
    gopRate,                    // 0-1
    deptCost,                   // 🔴 W2-1：部门成本（固定/半固定，按可售房）
    deptCostLines: dept.lines,  // 🔴 W2-1：部门成本拆分（三件套见 src/deptCosts.mjs）
    netProfit,                  // 🔴 W2-3：净利润（= 既有 profit，正名后显式输出）
    netProfitRate,              // 0-1
    profit,
    goodRate: Math.round(goodRate * 100),
    finalGoodRate: Math.round(finalGoodRate * 100),
    reviewCount,
    negativeCount,
    demandStrength: Math.round(demandStrength * 100) / 100,
    marketWave: Math.round(marketWave * 100) / 100,
    insights,
    events,
    // 属性池：本周事件对属性的影响 + 结算后属性（含每周自然衰减；周报展示用；旧调用方忽略即可）
    eventAttrEffects,
    attrsAfter: attrsAfterDecay,
    ...(hotOut ? { hotReviewCrisis: hotOut } : {}),
    ...(r6本周属性后果 ? { r6属性后果: r6本周属性后果 } : {}),
    ...(r6下周惩罚 ? { pendingPenalty: { ...r6下周惩罚, startWeek: week + 1 } } : {}),   // ★ §32-U1 R2：危机期状态·条件挂载（无危机不添键 ⇒ 零变化水位线保持）
    attrsAfterEvents: attrsAfter,   // 衰减前的值（便于对照"事件影响 vs 自然衰减"）
    decisions: { ...decisions },
    eventFine,
    weeklyExpenses,
    // §14.3：未接入品牌不发这个键 ⇒ 返回值逐字节不变（零变化水位线）
    ...(加盟 ? { franchiseFees: 加盟 } : {}),
  // ★ §22.2-B2：一次性费用随行（UI 标"这笔钱期末会回来"；断言读同一份）—— 未接入品牌不带键（水位线）
  ...(开业费用 || 保证金退还 ? { oneTimeFees: { 开业费用, 保证金退还, 清单: 一次性?.项 ?? [], 合计: 一次性?.合计 ?? 0, 保证金: 一次性?.保证金 ?? 0 } } : {}),
    capital: Math.round(capital),
    isBankrupt, isWarning, bizMode,
    competitors: competitorActions,
    competitorPressure: +(competitorPressure * 100).toFixed(0),
    persona, personaBonus: +(personaBonus * 100).toFixed(1), personaFeedback,
    overbookCompensation,
    generatedReviews,
    weeklyExpenses,
    totalExpenses,
    // ★ §32-U3 世界层（确定性）：天气/淡旺季/OTA 平台 —— 面板与周报的"本周外部环境"唯一数据源。
    //   为什么挂在这里而不是让界面自己查表：界面自己查就是【第二处查表点】，改系数必漏（BL-7 家族）。
    world: {
      天气: { 名: 本周天气.名, 图标: 本周天气.图标, 客流系数: 天气系数 },
      季节: { 名: 本周季节.名, 需求因子: 季节系数 },
      ota: { 评分: 平台.评分, 渠道系数, 适用: bizMode === 'ota', 明细: 平台.明细 },
      违规: ota违规s,                                  // [] = 本周无违规（界面据此不渲染该行）
      违规罚款: ota后果.罚款,
    },
    // 🔴 Phase D/C2 · D2：7 天快照（供第 3 批日报用）；纯派生字段，不参与任何计算、不入存档
    //    ΣdailySnapshots[].revenue === revenue 等逐项成立（dayEngine.splitExact 保证）
    dailySnapshots,
  }
}

// 解析房价带（"180-280元" → 取中值 230）
function parsePrice(priceStr) {
  const m = priceStr && priceStr.match(/(\d+)-(\d+)/)
  return m ? Math.round((Number(m[1]) + Number(m[2])) / 2) : 300
}

// 解析房量（"客房70间起" → 70）
export function parseRooms(standardStr) {   // A3：导出供界面复用（房量唯一权威 = 品牌标准口径）
  const m = standardStr && standardStr.match(/(\d+)间/)
  return m ? Number(m[1]) : 70
}
