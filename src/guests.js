// 客人身份 + 原因系统 + 组合式评价文本生成（纯函数）
//
// 规格：D:\教学app\评价系统-完整规格.md §1~§3；素材：D:\教学app\评价语料库.md
// 定位：把评价从"随机文本池"升级为【绑定学生决策的结构化生成】—— 评价 = 学生决策的镜子
//
// ── 硬约束（重要）──────────────────────────────────────────────
// 1. 本文件【绝不调用结算的全局 rand()】——那是结算共享的随机序列，动它会改变数值结果。
//    所有随机都走本文件自带的独立随机源（由调用方传入 rnd = () => [0,1) 的函数）。
// 2. 纯函数：无副作用、不 import React、不碰 DOM、不读写 localStorage。
// 3. 性别只影响【称呼与语气】，绝不由性别决定评价内容（规格 §零「避免刻板印象」）。
// 4. 语料库用法：提取【句式结构 + 细节词】再组合生成；不照抄整句、不堆池子随机抽。
//
// ── 补充规格（规格文档未含，经用户确认后加入，便于追溯）─────────────
// · praise_value（性价比好）纳入为第 5 个好评 cause（语料库§三有、规格§2.2表未列）
// · noise（隔音/硬件）绑定：renovation==='不投' 或 品质<50 时权重升高（规格§2.1未给来源）

// ───────────────────────── 独立随机源 ─────────────────────────
// mulberry32：自包含、可复现、不依赖任何外部状态；与结算的 seededRandom 相互独立
export function guestsRng(seed = 1) {
  let a = (Math.floor(Math.abs(Number(seed))) || 1) >>> 0
  return function rnd() {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pickOne = (arr, rnd) => arr[Math.min(arr.length - 1, Math.floor(rnd() * arr.length))]
// 抽 n 个互不相同的元素（保持顺序稳定）
function pickDistinct(arr, n, rnd) {
  const pool = arr.slice()
  const out = []
  while (out.length < n && pool.length) out.push(...pool.splice(Math.min(pool.length - 1, Math.floor(rnd() * pool.length)), 1))
  return out
}

// ───────────────────────── 客人身份 ─────────────────────────
export const SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '林', '何', '高', '罗', '郑', '梁', '谢', '宋', '唐']
export const PERSONAS = ['商务出差', '家庭出游', '旅行散客', '会议客人']
export const ROOM_TYPES = ['大床房', '标准双床', '套房']

// 客人身份：字段与规格 §1.1 一致；avatar/name/card 为派生值（avatar 严格由 gender 决定）
export function guestOf(rnd) {
  const r = typeof rnd === 'function' ? rnd : guestsRng(1)
  const surname = pickOne(SURNAMES, r)
  const gender = r() < 0.5 ? 'male' : 'female'
  const title = gender === 'male' ? '先生' : '女士'   // ← 称呼由 gender 决定，不再随机
  const avatar = gender === 'male' ? '🧑' : '👩'      // ← 与 gender 严格一致（避免"王先生配👩"）
  const persona = pickOne(PERSONAS, r)
  const roomType = pickOne(ROOM_TYPES, r)
  const nights = 1 + Math.floor(r() * 5)              // 1~5 晚
  const name = `${surname}${title}`
  return { surname, gender, title, avatar, persona, roomType, nights, name, card: `${name} · ${persona}` }
}

// ───────────────────────── 原因系统 ─────────────────────────
export const CAUSE_NEGATIVE = ['front_slow', 'hygiene', 'cold', 'hot', 'facility', 'overprice', 'no_room', 'busy_service', 'noise', 'misc']
export const CAUSE_POSITIVE = ['praise_clean', 'praise_service', 'praise_member', 'praise_location', 'praise_value', 'praise_misc']

// cause → 主要来源决策（供展示层做「🔍 关联经营」反查）
export const CAUSE_SOURCE = {
  front_slow: 'shifts',
  busy_service: 'shifts',
  hygiene: 'hygiene',
  cold: 'energy',
  hot: 'energy',
  facility: 'linen',
  overprice: 'pricing',
  no_room: 'overbook',
  noise: 'renovation',
  misc: null,
  praise_clean: 'hygiene',
  praise_service: 'shifts',
  praise_member: 'member-convert',
  praise_location: null,      // 来自选址（非周决策）
  praise_value: 'pricing',
  praise_misc: null,
}

// 造成负面评价的原因 → 权重（规格 §2.1；补充项见文件头）
// state 需要的字段：{ attrs:{quality,reputation,morale}, occupancy(0-100), price, overbook }
export function causeWeightsOf(decisions = {}, state = {}, week = 1) {
  const d = decisions || {}
  const attrs = state.attrs || {}
  const quality = Number.isFinite(attrs.quality) ? attrs.quality : 60
  const occupancy = Number.isFinite(state.occupancy) ? state.occupancy : 60
  const price = Number.isFinite(state.price) ? state.price : 230
  const overbook = Number(d.overbook) || 0

  const neg = { front_slow: 1, hygiene: 1, cold: 0, hot: 0, facility: 1, overprice: 1, no_room: 0, busy_service: 0, noise: 1, misc: 1 }
  // 人力：精简排班 / 裁员 → 前台慢（+满房时服务跟不上）
  if (d.shifts === '精简省成本') { neg.front_slow += 3; neg.busy_service += 1 }
  if (d['hr-optimize'] === '裁员1人') neg.front_slow += 2
  // 卫生：不停房深清洁 → 卫生差
  if (d.hygiene !== '停房深清洁') neg.hygiene += 3
  else neg.hygiene = 0.4
  // 能耗：温度走极端
  const energy = Number(d.energy)
  if (Number.isFinite(energy)) {
    if (energy <= 21) neg.cold += 3
    if (energy >= 25) neg.hot += 3
  }
  // 采购/布草：低价渠道 → 设施与用品差
  if (d.linen === '外包') neg.facility += 1.5
  if (d.renovation === '不投') neg.facility += 1.5
  // 房价过高（>320）→ 性价比差
  if (price > 320) neg.overprice += 3
  // 超售 → 到店无房（权重给足；结算侧另有"必触发"保证）
  if (overbook > 0) neg.no_room += 4 + overbook
  // 高出租率 + 少人手 → 服务跟不上
  if (occupancy >= 85 && d.shifts === '精简省成本') neg.busy_service += 3
  // 【补充规格】硬件/隔音：未投改造 或 品质<50
  if (d.renovation === '不投') neg.noise += 2
  if (quality < 50) { neg.noise += 1.5; neg.facility += 1.5; neg.hygiene += 1 }
  if (quality >= 80) { neg.hygiene = 0.2; neg.facility = 0.3; neg.noise = 0.3 }   // 品质高：硬件类差评显著减少

  const pos = { praise_clean: 1, praise_service: 1, praise_member: 0.5, praise_location: 1, praise_value: 1, praise_misc: 1 }
  if (quality >= 80) pos.praise_clean += 4
  if (quality < 50) pos.praise_clean = 0.2
  if (d.shifts === '满编保服务') pos.praise_service += 3
  if (d.shifts === '精简省成本') pos.praise_service = 0.2
  if (d['member-convert'] === '强调品质') pos.praise_member += 2
  if (d['hr-optimize'] === '全员培训') pos.praise_service += 1.5
  if (d.pricing === '不跟降' && price <= 320) pos.praise_value += 1.5
  if (price > 320) pos.praise_value = 0.3
  // 位置好（选址客流高）→ 位置类好评
  const flow = Number(state.flow)
  if (Number.isFinite(flow) && flow >= 4) pos.praise_location += 3

  return { negative: neg, positive: pos }
}

// 按权重抽一个 cause（weights 里非正数的项不会被抽到）
export function pickCause(weights, rnd) {
  const r = typeof rnd === 'function' ? rnd : guestsRng(2)
  const entries = Object.entries(weights || {}).filter(([, w]) => Number(w) > 0)
  if (!entries.length) return null
  const total = entries.reduce((s, [, w]) => s + Number(w), 0)
  let t = r() * total
  for (const [k, w] of entries) { t -= Number(w); if (t <= 0) return k }
  return entries[entries.length - 1][0]
}

// ───────────────────────── 文本素材（句式 + 具体细节词）─────────────────────────
// 三段式：差评 = 场景开头 + 具体问题(2-3细节) + 影响/诉求；好评 = 满意点 + 细节 + 复购意愿
// 细节词来自《评价语料库.md》：灯罩发霉 / 马桶圈是黄的 / 地砖防滑差 / 食物夹生 / 排了二十分钟 …
const TONE = (stars) => (stars <= 2 ? 'harsh' : stars === 3 ? 'mid' : 'soft')

// 共享收尾池：cause 专属 impact 已表达因果，这里补充"真人还会这么说"的收尾，降低结尾重复感
const SHARED_NEG_IMPACTS = {
  harsh: ['下次出差不会再考虑这家了。', '已经跟同行的人说了别订这家。', '希望店家真的能看到这条评价。', '该说的都说了，希望能改进。', '这次算了，但不会有下次。', '花钱买教训，写出来给大家参考。'],
  mid: ['希望能改进一下。', '建议加强一下管理。', '期待下次能好一些。', '细节上还能做得更好。'],
  soft: ['总体还行，细节上可以更好。', '不算差，但也没什么惊喜。', '其他都还好。'],
}
const SHARED_POS_IMPACTS = {
  harsh: [],   // 好评不用
  mid: ['整体挺满意的。', '会推荐给朋友。'],
  soft: ['会推荐给同事。', '下次还住这家。', '已经收藏了这家店。'],
}

const NEG = {
  front_slow: {
    openers: {
      商务出差: ['出差住一晚，前台就一个人，', '下午三点到的，前台空无一人，'],
      家庭出游: ['带着孩子来的，', '拖着行李带着娃，'],
      旅行散客: ['来旅游住的，刚到就有点上火：', '大包小包到了前台，'],
      会议客人: ['我们一队人一起办的入住，', '会前一天到的，本想早点休息，'],
    },
    details: ['排了快二十分钟才办上入住', '等了十分钟才有人从后面慢慢出来', '前台队伍排到门口，孩子又累又困', '想加个枕头，电话打了半天没人接', '晚上想借个充电器，前台说没人手', '隔壁排队的客人也在抱怨', '前台就一两个人，根本忙不过来'],
    impacts: {
      harsh: ['第二天还要赶早班机，真是耽误事。', '孩子在旁边闹得不行，体验很差。', '这种效率，下次不会再选了。'],
      mid: ['希望能多配点人手。', '等得确实有点久。', '建议高峰期多加个人。'],
      soft: ['整体还行，就是这个环节拖了后腿。', '其他都还好，就是办理太慢。'],
    },
  },
  hygiene: {
    openers: {
      商务出差: ['入住就发现卫生环境很差，', '出差图个干净，结果：'],
      家庭出游: ['带孩子住最在意卫生，结果一进门就傻眼：', '带着孩子，卫生真的不敢恭维：'],
      旅行散客: ['房间看着就没认真打扫，', '进门第一眼就不太行：'],
      会议客人: ['团队入住，房间卫生参差不齐：', '会务订的房，卫生状况不理想：'],
    },
    details: ['灯罩发霉、马桶圈是黄的', '墙角还有头发，被子掀开一股味道', '茶杯上有水渍，浴巾有股怪味', '卫生间地漏反味，洗漱台一圈黄渍', '毛巾发硬，完全不像消过毒', '地毯上有明显污渍', '床单有褶皱，像没换过'],
    impacts: {
      harsh: ['这种卫生条件真的不敢住第二晚。', '孩子健康是第一位的，这没法接受。', '冲着品牌来的，很失望。'],
      mid: ['希望能彻底清洁一次。', '建议加强客房检查。', '这个卫生水平不该出现在这个价位。'],
      soft: ['其他还行，就是卫生要跟上。', '位置服务都可以，卫生差了点。'],
    },
  },
  cold: {
    openers: { 商务出差: ['房间太冷了，', '晚上回房间像进了冰窖，'], 家庭出游: ['带孩子住的，房间冷得不行，', '室温太低了，'], 旅行散客: ['房间冷得睡不着，', '屋里温度不对劲，'], 会议客人: ['团队房间温度都偏低，', '开完会回房，冷得不行，'] },
    details: ['空调温度锁死调不上去', '找前台说也没法调', '被子薄，孩子晚上冻醒好几次', '窗户还漏风', '洗澡热水也不够热'],
    impacts: { harsh: ['一晚上没睡好，第二天状态全无。', '孩子冻感冒了就麻烦了。'], mid: ['希望把温度调正常。', '建议检查一下空调。'], soft: ['其他都挺好，就是房间里有点冷。'] },
  },
  hot: {
    openers: { 商务出差: ['房间闷热不透气，', '晚上热得睡不着，'], 家庭出游: ['带娃住的，屋里太闷了，', '房间像蒸笼，'], 旅行散客: ['房间太热了，', '屋里闷得慌，'], 会议客人: ['团队房间都比较闷，', '房间温度偏高，'] },
    details: ['空调出风口吹的还是热风', '空调遥控器按了没反应', '窗户只能开一条缝', '被褥又厚又闷', '一整晚都在出汗'],
    impacts: { harsh: ['一晚上基本没睡。', '孩子热得一直哭闹。'], mid: ['希望把空调修一下。', '建议提前检查制冷。'], soft: ['其他都还行，就是太闷。'] },
  },
  facility: {
    openers: { 商务出差: ['设施明显老旧，', '房间设备跟不上：'], 家庭出游: ['带孩子的，设施老旧让人不放心：', '房间设施太旧了，'], 旅行散客: ['设施老旧，', '房间一看就很久没翻新：'], 会议客人: ['会务用房设施偏旧，', '会议室设备也不行：'] },
    details: ['墙皮脱落、家具边角都磨白了', '毛巾薄得透光，拖鞋一撕就破', '电梯有异响', '房间门锁失灵了两次，刷半天刷不开', '淋浴花洒出水忽冷忽热', '插座松得插不住充电器'],
    impacts: { harsh: ['这个价不值。', '安全隐患太多，不敢再住。', '第二天就换了酒店。'], mid: ['设施该维护了。', '建议做一次整体翻新。'], soft: ['服务还可以，硬件确实该换了。'] },
  },
  overprice: {
    openers: { 商务出差: ['这个价格配这个条件，', '差旅标准内订的，结果：'], 家庭出游: ['带着孩子花了这个价，', '一家人住的，'], 旅行散客: ['这个价位不该是这样：', '花了这个钱，'], 会议客人: ['团队协议价也不便宜，', '会务成本不低，'] },
    details: ['实在不值，隔壁同价位的条件好太多', '花了四百多，房间小得转不开身', '早餐很一般，种类少', '所谓的升级房型就是换个楼层', '配套几乎为零'],
    impacts: { harsh: ['性价比太低，不会再来。', '下次宁可多花点住别家。'], mid: ['希望价格和条件匹配一点。', '建议把早餐做扎实。'], soft: ['位置不错，就是价格偏高。'] },
  },
  no_room: {
    openers: { 商务出差: ['提前订好的房间，到店说没有了，', '订好的房，到店被告知没房，'], 家庭出游: ['带着孩子大晚上到店，说没房了，', '订的是大床房，到店被告知没房，'], 旅行散客: ['到店说没房，', '订好了却没房，'], 会议客人: ['团队订的房到店说安排不下，', '会前一周就订好了，到店说没房，'] },
    details: ['说要给我换到另一家', '安排去了隔壁快捷酒店，条件差一大截', '前台只说"系统问题"，没有解释', '等了快一个小时才给方案', '行李还得自己搬过去'],
    impacts: { harsh: ['大晚上带着行李，这叫什么事？', '这种体验真的不能接受。', '零容忍，必须差评。'], mid: ['希望以后做好房态管理。', '补偿方案也谈不上诚意。'], soft: ['最后给换了房，但过程太折腾。'] },
  },
  busy_service: {
    openers: { 商务出差: ['入住率太高，', '满房是好事，但：'], 家庭出游: ['人太多了，', '周末满房，'], 旅行散客: ['满房的时候，', '住的人太多，'], 会议客人: ['赶上高峰期，', '会期人多，'] },
    details: ['走廊里的餐盘放了一晚上没人收', '打电话要个吹风机，等了四十分钟', '早餐要排队，电梯要等', '房间打扫排到了下午三点', '前台电话一直占线'],
    impacts: { harsh: ['体验大打折扣。', '花了钱却像住青旅。'], mid: ['建议高峰期多派人。', '希望服务能跟上入住量。'], soft: ['能理解忙，但体验确实受影响。'] },
  },
  noise: {
    openers: { 商务出差: ['隔音太差了，', '本来想安静休息，结果：'], 家庭出游: ['带孩子的，晚上根本睡不好，', '隔音不行，'], 旅行散客: ['太吵了，', '隔音差，'], 会议客人: ['会期需要休息，但房间太吵，', '晚上休息受影响：'] },
    details: ['隔壁说话听得一清二楚', '半夜还有人在走廊大声打电话', '靠马路的房间，车流声一直响到凌晨，窗户关紧也没用', '楼上拖椅子的声音持续到半夜', '空调外机嗡嗡响'],
    impacts: { harsh: ['一晚上基本没睡。', '第二天开会完全没精神。', '睡眠质量太差，不会再选。'], mid: ['希望能加隔音处理。', '建议安排安静点的房间。'], soft: ['其他都可以，就是晚上吵。'] },
  },
  misc: {
    openers: { 商务出差: ['整体一般，', '住下来感觉平平：'], 家庭出游: ['这次体验一般，', '带娃住的，'], 旅行散客: ['体验一般，', '综合下来：'], 会议客人: ['会务体验一般，', '整体一般：'] },
    details: ['早餐偏少', '前台态度一般', '电梯等太久', '房间里没有矿泉水', '退房时系统还出了问题'],
    impacts: { harsh: ['不太推荐。', '下次会考虑别家。'], mid: ['希望能改进。', '细节上还能更好。'], soft: ['凑合住一晚还行。'] },
  },
}

const POS = {
  praise_clean: {
    openers: { 商务出差: ['房间干净整洁，', '出差住最怕不干净，这家放心：'], 家庭出游: ['带孩子的，房间很干净，', '卫生做得不错，'], 旅行散客: ['房间很干净，', '住得挺舒服：'], 会议客人: ['会务订的房，卫生不错，', '房间干净，'] },
    details: ['床品很舒服，一看就是认真打扫过的', '设施很新，卫生没得挑', '浴巾都是蓬松的', '卫生间一点异味都没有', '细节到位，连杯具都是密封的'],
    extras: ['住得踏实。', '这点很加分。'],
  },
  praise_service: {
    openers: { 商务出差: ['前台效率很高，', '办理入住特别快，'], 家庭出游: ['服务很贴心，', '前台小姐姐很热情，'], 旅行散客: ['服务态度很好，', '前台很热情：'], 会议客人: ['会务对接很顺畅，', '团队入住安排得很快，'] },
    details: ['办理入住很快就办好了', '还主动推荐了附近好吃的', '要什么马上送到，响应特别快', '看我们带娃主动给了儿童牙刷', '行李帮忙送到了房间'],
    extras: ['服务真的加分。', '很暖心。'],
  },
  praise_location: {
    openers: { 商务出差: ['位置太方便了，', '出差首选：'], 家庭出游: ['位置很方便，', '带孩子出门很省事：'], 旅行散客: ['位置超好，', '就在商圈边上：'], 会议客人: ['离会场很近，', '位置对会务很友好：'] },
    details: ['出门就是地铁', '周边吃饭购物都近', '走两步就到，晚上逛完街直接回酒店', '打车去机场也快', '楼下就有便利店'],
    extras: ['很省心。', '出行完全不折腾。'],
  },
  praise_value: {
    openers: { 商务出差: ['这个价位能有这个条件，', '出差标准内找到这家，'], 家庭出游: ['一家三口住的，', '带孩子出来玩，'], 旅行散客: ['性价比很高，', '这价格很值：'], 会议客人: ['会务预算内，', '团队价住到这个条件，'] },
    details: ['性价比很高，下次还来', '物超所值，房间比想象中大', '早餐也丰盛', '比同价位的干净不少', '该有的都有，没有多余收费'],
    extras: ['推荐。', '很划算。'],
  },
  praise_member: {
    openers: { 商务出差: ['老会员了，', '常驻这家，'], 家庭出游: ['办了会员，', '会员权益不错：'], 旅行散客: ['办了张会员卡，', '会员挺实在：'], 会议客人: ['团队会员，', '会务常订这家：'] },
    details: ['每次来都有小惊喜，感觉被记住、被照顾', '会员价确实便宜，还送了欢迎水果', '积分兑换很方便', '老客户还给升了房型'],
    extras: ['回头客是有道理的。', '会一直住下去。'],
  },
  praise_misc: {
    openers: { 商务出差: ['整体很满意，', '这次住得很顺：'], 家庭出游: ['一家人都住得挺满意，', '带孩子住得挺开心：'], 旅行散客: ['整体体验不错，', '这次挺满意：'], 会议客人: ['会务整体顺畅，', '团队都挺满意：'] },
    details: ['早餐种类多，味道也在线', '安静，晚上睡得很好', '房间采光不错', '停车方便', '续住手续很简单'],
    extras: ['会推荐给同事。', '下次还住这家。'],
  },
}

// ───────────────────────── 组合式文本生成 ─────────────────────────
// 组装策略（±长度不一）：20% 短句（开头+1细节）/ 60% 标准（开头+2细节+影响）/ 20% 完整（开头+3细节+影响）
function composeNeg(cause, persona, stars, rnd) {
  const c = NEG[cause] || NEG.misc
  const tone = TONE(stars)
  const opener = pickOne(c.openers[persona] || c.openers['旅行散客'], rnd)
  const nDetail = rnd() < 0.2 ? 1 : rnd() < 0.75 ? 2 : 3
  const details = pickDistinct(c.details, nDetail, rnd)
  const body = details.join('，')
  const impactPool = [...(c.impacts[tone] || []), ...(SHARED_NEG_IMPACTS[tone] || [])]
  const impact = impactPool.length ? pickOne(impactPool, rnd) : ''
  return `${opener}${body}。${impact}`.replace(/。。/g, '。')
}
function composePos(cause, persona, stars, rnd) {
  const c = POS[cause] || POS.praise_misc
  const opener = pickOne(c.openers[persona] || c.openers['旅行散客'], rnd)
  const nDetail = rnd() < 0.25 ? 1 : 2
  const details = pickDistinct(c.details, nDetail, rnd)
  const extraPool = [...c.extras, ...(SHARED_POS_IMPACTS[TONE(stars)] || [])]
  const extra = rnd() < 0.75 ? pickOne(extraPool, rnd) : ''
  const stars_flavor = stars >= 5 ? '非常满意，' : ''
  return `${stars_flavor}${opener}${details.join('，')}。${extra}`.replace(/。。/g, '。')
}

// 生成一条评价文本；recent = 最近的文本数组（去重：最近 10 条内不出现完全相同的句子）
export function makeReviewText({ cause, persona = '旅行散客', stars = 3, rnd, recent = [] } = {}) {
  const r = typeof rnd === 'function' ? rnd : guestsRng(3)
  const isNeg = CAUSE_NEGATIVE.includes(cause)
  const recent10 = (recent || []).slice(-10)
  let text = ''
  for (let attempt = 0; attempt < 8; attempt++) {
    text = isNeg ? composeNeg(cause, persona, stars, r) : composePos(cause, persona, stars, r)
    if (!recent10.includes(text)) break        // 去重：撞了就换变体重抽
  }
  return text
}

// 一条结构化评价（规格 §实施步骤2 要求每条携带的字段）
export function makeReview({ decisions = {}, state = {}, week = 1, stars = 3, cause = null, rnd, recent = [] } = {}) {
  const r = typeof rnd === 'function' ? rnd : guestsRng(7)
  const weights = causeWeightsOf(decisions, state, week)
  const c = cause || pickCause(stars >= 4 ? weights.positive : weights.negative, r)
    || (stars >= 4 ? 'praise_misc' : 'misc')
  const guest = guestOf(r)
  const text = makeReviewText({ cause: c, persona: guest.persona, stars, rnd: r, recent })
  return {
    guest,                                  // 身份（含 avatar/name/card 派生值）
    cause: c,                               // 原因（绑定决策）
    stars,
    text,
    roomType: guest.roomType,
    nights: guest.nights,
    relatedDecision: CAUSE_SOURCE[c] || null,  // 供展示层做「🔍 关联经营」反查
  }
}
