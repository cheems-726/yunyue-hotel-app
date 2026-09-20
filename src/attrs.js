// RPG 属性池（品质 / 声誉 / 士气）：让决策与事件"有记忆、会积累、实时变化"
//
// 依据：D:\教学app\RPG属性系统-开发规格.md v1.0
// 定位：属性是"中间变量"——决策不直接改钱，决策改属性，属性再决定钱。
//       这样"省钱的代价"才有地方沉淀，而不是立即消失。
//
// 第3批边界（本文件只做"存、变"）：
//   ✅ 实现：决策/事件 → 属性增量、按品牌档次的每周衰减、称号综合分
//   ❌ 不接：结算公式（属性→出租率/利润）属第4批；事件接线属第6批；决策风险化属第5批
//   因此 applyEventToAttrs / applyWeeklyDecay 本批"只实现、不调用"，由后续批次接入
//
// 纯函数模块：无副作用、不 import React、不碰 DOM、不读写 localStorage

// ───────────────────────── 常量区（调参入口，改这里即可）─────────────────────────

// 属性初始值（规格 §一）
export const ATTR_INIT = { quality: 60, reputation: 70, morale: 65 }

// 属性上下限（规格 §7：下限 20 避免归零死局）
// ★补充规则：下限对"决策/事件/衰减"三处一律生效——决策本身也不突破下限，与 §7 口径统一
export const ATTR_MAX = 100
export const ATTR_MIN = 20

// 品牌档次 → 品质每周衰减 + "品质伤害声誉"的放大系数（规格 §2.4）
// 逻辑：档次越高维护投入越大 → 衰减越慢；客人期望越高 → 品质下滑时声誉损失越重（"高端难做"）
const TIERS = {
  economy: { decay: 3, mult: 0.8, label: '经济型' },
  mid: { decay: 2, mult: 1.0, label: '中档型' },
  upperMid: { decay: 2, mult: 1.2, label: '中高档' },
  upscale: { decay: 1, mult: 1.4, label: '高档型' },
  luxury: { decay: 1, mult: 1.6, label: '奢华型' },
}

// 每周自然衰减（规格 §3.4 声誉自然遗忘 / §4.4 士气自然消耗）
const REP_DECAY_WEEKLY = 1
const MORALE_DECAY_WEEKLY = 1

// 品质差 → 声誉额外惩罚（规格 §5.2）：quality < 50 时 (50 - quality) / 10 × 档次放大系数
const QUALITY_PENALTY_BELOW = 50
const QUALITY_PENALTY_DIVISOR = 10

// 能耗管控温度阈值（规格 §4.2）：≤21℃ 员工冻得没干劲 / ≥25℃ 舒适
const ENERGY_COLD = 21
const ENERGY_WARM = 25

// 活动策划：员工激励渠道占比阈值（★补充规则：规格只写"占比高"，此处定为 ≥25%）
const CAMPAIGN_INCENTIVE_HIGH = 0.25

// 称号综合分权重（规格 §九：品质30% + 声誉40% + 士气30%）
const TITLE_WEIGHT = { quality: 0.3, reputation: 0.4, morale: 0.3 }

// ───────────────────────── 档位判断 ─────────────────────────

// brandLevel（来自品牌数据，实际取值：'经济型 · 国民' / '中档' / '精选 · 中高档' / '高档' / '奢华'）
// → 档次键。⚠️ 判断顺序是硬要求："精选 · 中高档"含"高档"子串，必须先判中高档/精选，
//    否则中高档会被高档吃掉（口径与 TeacherDashboard.jsx:46 一致）。未识别时按中档兜底。
export function tierOf(brandLevel) {
  const lv = String(brandLevel || '')
  if (lv.includes('经济')) return 'economy'
  if (lv.includes('中高') || lv.includes('精选')) return 'upperMid'
  if (lv.includes('高档')) return 'upscale'
  if (lv.includes('奢华')) return 'luxury'
  if (lv.includes('中档')) return 'mid'
  return 'mid'
}

// 该档次的品质每周衰减值（经济 3 / 中档 2 / 中高 2 / 高档 1 / 奢华 1）
export function tierDecay(brandLevel) {
  return TIERS[tierOf(brandLevel)].decay
}

// 该档次的"品质伤害声誉"放大系数（经济 0.8 / 中档 1.0 / 中高 1.2 / 高档 1.4 / 奢华 1.6）
export function tierMultiplier(brandLevel) {
  return TIERS[tierOf(brandLevel)].mult
}

// ───────────────────────── 内部工具 ─────────────────────────

const KEYS = ['quality', 'reputation', 'morale']

// 单项 clamp：整数化 + [ATTR_MIN, ATTR_MAX]
function clampVal(v) {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return ATTR_MIN
  return Math.max(ATTR_MIN, Math.min(ATTR_MAX, n))
}

// 取数值：只有"真的数字"或"非空数字字符串"才认，其余（null/undefined/''/布尔/对象/NaN）视为缺失
// ⚠️ 必须区分 null 与 0：Number(null) === 0 会把"字段缺失"误判成"属性为 0"（旧档兼容的坑）
function toAttrNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

// 旧档兼容：把任意来源的 attrs 规整成完整对象（缺字段/脏数据用 ATTR_INIT 补、越界值 clamp）
// 3-B 读取存档时用它兜底，保证任何旧存档都不会 NaN / 报错
export function normalizeAttrs(attrs) {
  const src = attrs && typeof attrs === 'object' ? attrs : {}
  const out = {}
  for (const k of KEYS) {
    const n = toAttrNumber(src[k])
    out[k] = n === null ? ATTR_INIT[k] : clampVal(n)
  }
  return out
}

// 不可变地应用增量：返回新对象，所有值 clamp 到 [20, 100]
function applyDelta(attrs, delta) {
  const base = normalizeAttrs(attrs)
  const out = { ...base }
  for (const k of KEYS) {
    const d = Number(delta && delta[k])
    if (Number.isFinite(d) && d !== 0) out[k] = clampVal(base[k] + d)
  }
  return out
}

// 增量缩放：dir=1 应用 / dir=-1 撤销
// 用途：学生"修改决策"时先撤销旧答案的增量、再应用新答案，避免同一决策反复累加
function scaleDelta(delta, dir) {
  if (dir === 1 || !delta) return delta
  const out = {}
  for (const k of KEYS) {
    const d = Number(delta[k])
    if (Number.isFinite(d) && d !== 0) out[k] = -d
  }
  return out
}

// ───────────────────────── 决策 → 属性（规格 §2.2 / §3.2 / §4.2）─────────────────────────
// 键 = decisions.js 的决策 id；选项键 = 选项 label 原文（必须与 decisions.js 一致）
// 说明：每张表只登记规格明确给出的组合，未登记的选项视为无属性变化
const DECISION_EFFECTS = {
  // 客房质检（type: sort，answer 为排序数组）——规格 §2.2「完成整改 +5」
  // ★补充规则：提交即 +5，不判定排序好坏（排序质量留给第5批风险化 / 课堂点评）
  // ⚠️ 本项目前属"无风险决策"（只有收益、没有代价），待第5批风险化改造
  'quality-check': { quality: 5 },

  // 改造投资（option）——规格 §2.2
  renovation: {
    '投150万改造': { quality: 15 },
    '不投': { quality: -2 },
  },

  // 卫生计划（option）——规格 §2.2 + §3.2
  hygiene: {
    '停房深清洁': { quality: 4, reputation: 2 },
    '不停房': { quality: -3, reputation: -2 },
  },

  // 口碑管理（option）——规格 §3.2
  reputation: {
    '道歉+赔偿': { reputation: 5 },
    '解释原因': { reputation: 3 },
    '模板回复': { reputation: -5 },
  },

  // 前台排班（option）——规格 §3.2 + §4.2
  shifts: {
    '满编保服务': { reputation: 2, morale: 5 },
    '精简省成本': { reputation: -2, morale: -5 },
  },

  // 人力优化（option）——规格 §3.2 + §4.2（裁员重罚，教"人要养"）
  'hr-optimize': {
    '裁员1人': { morale: -15 },
    '全员培训': { morale: 8, reputation: 2 },
  },

  // 会员转化（option）——规格 §3.2 + §4.2（不主动推销：规格未给规则，视为无变化）
  'member-convert': {
    '强调品质': { reputation: 2, morale: 1 },
    '强调优惠': { reputation: -1 },
  },

  // 物资采购（筹建期一次性选择，非周决策）——规格 §2.2 的"高品质供应商 +4 / 低价供应商 -3"
  // 伪 id：est-supplier，由筹建完成时调用一次；answer 兼容选项 key（buy-a/b/c）与文案原文
  // ★补充规则：规格只给两档数值，中间档（指定供应商）取 0——它的代价体现在采购成本而非品质
  'est-supplier': {
    'buy-a': { quality: 4 },
    'buy-b': { quality: 0 },
    'buy-c': { quality: -3 },
    '华住易购': { quality: 4 },
    '指定供应商': { quality: 0 },
    '自行采购': { quality: -3 },
  },
}

// 能耗管控（slider，answer 为温度数值）——规格 §4.2
function energyDelta(answer) {
  const t = Number(answer)
  if (!Number.isFinite(t)) return null
  if (t <= ENERGY_COLD) return { morale: -3 }
  if (t >= ENERGY_WARM) return { morale: 2 }
  return null // 22-24℃：节能与舒适平衡，无属性变化
}

// 活动策划（budget，answer = { 渠道名: 金额 }）——规格 §4.2
// ★补充规则：规格只写"员工激励占比高 +3 / =0 → -3"，此处把"高"定为 ≥25%（CAMPAIGN_INCENTIVE_HIGH）
function campaignDelta(answer) {
  if (!answer || typeof answer !== 'object') return null
  const vals = Object.values(answer).map(Number).filter(Number.isFinite)
  const total = vals.reduce((a, b) => a + b, 0)
  if (total <= 0) return null
  const incentive = Number(answer['员工激励']) || 0
  const ratio = incentive / total
  if (ratio <= 0) return { morale: -3 }
  if (ratio >= CAMPAIGN_INCENTIVE_HIGH) return { morale: 3 }
  return null
}

// 学生确认一项决策时调用：返回新的属性对象（不可变）。
//   dir = 1（默认）应用增量；dir = -1 撤销该答案的增量（学生改答案时用，防重复累加）
// 未知决策 / 未知选项 / 答案为空 → 原样返回（规整后的新对象），绝不抛错
export function applyDecisionToAttrs(attrs, decisionId, answer, dir = 1) {
  try {
    if (decisionId === 'energy') {
      const d = energyDelta(answer)
      return d ? applyDelta(attrs, scaleDelta(d, dir)) : normalizeAttrs(attrs)
    }
    if (decisionId === 'campaign') {
      const d = campaignDelta(answer)
      return d ? applyDelta(attrs, scaleDelta(d, dir)) : normalizeAttrs(attrs)
    }
    const table = DECISION_EFFECTS[decisionId]
    if (!table) return normalizeAttrs(attrs)

    // sort 型（客房质检）：提交即生效
    if (decisionId === 'quality-check') {
      const done = Array.isArray(answer) ? answer.length > 0 : answer != null && answer !== ''
      return done ? applyDelta(attrs, scaleDelta(table, dir)) : normalizeAttrs(attrs)
    }

    // option 型：按 label 原文精确匹配
    if (typeof answer !== 'string') return normalizeAttrs(attrs)
    const delta = table[answer]
    if (delta) return applyDelta(attrs, scaleDelta(delta, dir))

    // 物资采购的容错匹配（存档里存的是文案，如"供应商 A：华住易购（官方）"）
    if (decisionId === 'est-supplier') {
      if (answer.includes('华住易购') || /供应商\s*A/.test(answer)) return applyDelta(attrs, scaleDelta(table['buy-a'], dir))
      if (answer.includes('自行采购') || /供应商\s*C/.test(answer)) return applyDelta(attrs, scaleDelta(table['buy-c'], dir))
      if (answer.includes('指定供应商') || /供应商\s*B/.test(answer)) return applyDelta(attrs, scaleDelta(table['buy-b'], dir))
    }
    return normalizeAttrs(attrs)
  } catch (e) {
    return normalizeAttrs(attrs)
  }
}

// ───────────────────────── 事件 → 属性（规格 §6）─────────────────────────
// 键 = settlement.js 的事件 name 原文
// 第3批只实现、不调用（规格 §11 把"事件影响属性"划给第6批）
const EVENT_EFFECTS = {
  '卫生敷衍': { quality: -2, reputation: -3 },
  '负面舆情': { reputation: -4, morale: -2 },
  '负面舆情（危机）': { reputation: -4, morale: -2 },
  '员工请假': { reputation: -1, morale: -3 },
  '网红探店': { reputation: 3 },
  '员工关怀日': { morale: 4 },
  '设备故障': { quality: -2, reputation: -1 },
  '整改获认可·追加好评': { quality: 2, reputation: 1, morale: 1 }, // 规格作"质检获认可（正面）"
  '竞店开业': { morale: -1 },
  '会展旺季': { morale: 2 },
  '资金链断裂': { reputation: -3, morale: -5 },
  '资金链断裂（危机）': { reputation: -3, morale: -5 },
  '深夜噪音投诉': { quality: -1, reputation: -2 },
}

export function applyEventToAttrs(attrs, eventName) {
  try {
    const delta = EVENT_EFFECTS[String(eventName || '')]
    return delta ? applyDelta(attrs, delta) : normalizeAttrs(attrs)
  } catch (e) {
    return normalizeAttrs(attrs)
  }
}

// ───────────────────────── 每周衰减（规格 §7）─────────────────────────
// 第3批只实现、不调用：规格 §11 把"结算读属性 + 按档次衰减"划给第4批
// 品质 -= 该档次衰减；声誉 -= 自然遗忘 + 品质惩罚（<50 时按档次放大）；士气 -= 自然消耗
export function applyWeeklyDecay(attrs, brandLevel) {
  const base = normalizeAttrs(attrs)
  const tier = TIERS[tierOf(brandLevel)]
  const penalty = base.quality < QUALITY_PENALTY_BELOW
    ? ((QUALITY_PENALTY_BELOW - base.quality) / QUALITY_PENALTY_DIVISOR) * tier.mult
    : 0
  return {
    quality: clampVal(base.quality - tier.decay),
    reputation: clampVal(base.reputation - REP_DECAY_WEEKLY - penalty),
    morale: clampVal(base.morale - MORALE_DECAY_WEEKLY),
  }
}

// ───────────────────────── 统一品质来源（N2）─────────────────────────
// 品质分唯一来源 = 属性池（品牌差异体现在衰减速度与放大系数，不体现在起点值）
// 入参兼容两种：state 对象（{attrs:{...}}）或裸 attrs 对象（{quality,...}）
// 旧档/脏数据一律经 normalizeAttrs 兜底 → 回退初值 60，绝不 NaN
export function qualityOf(stateOrAttrs) {
  const a = stateOrAttrs && stateOrAttrs.attrs !== undefined ? stateOrAttrs.attrs : stateOrAttrs
  return normalizeAttrs(a).quality
}

// ───────────────────────── 反馈文案（规格 §8 格式）─────────────────────────
// 属性中文名（面板与反馈文案共用，避免多处各写一份）
export const ATTR_LABELS = { quality: '品质', reputation: '声誉', morale: '士气' }

// 生成"真实属性变化"文案：如 "品质 +5（60→65）"；多项变化用「，」连接
// 无变化返回 ''（调用方保留原有描述文本，避免出现空反馈）
export function formatAttrDelta(before, after) {
  const b = normalizeAttrs(before)
  const a = normalizeAttrs(after)
  const parts = []
  for (const k of KEYS) {
    const d = a[k] - b[k]
    if (d !== 0) parts.push(`${ATTR_LABELS[k]} ${d > 0 ? '+' : ''}${d}（${b[k]}→${a[k]}）`)
  }
  return parts.join('，')
}

// ───────────────────────── 称号（规格 §九）─────────────────────────
// 综合分 = 品质30% + 声誉40% + 士气30%
// 第3批只实现、不接 UI：称号目前仍走 hotelTitle.getTitle(出租率, 好评率, 品质分) 老口径
export function attrsComposite(attrs) {
  const a = normalizeAttrs(attrs)
  const c = a.quality * TITLE_WEIGHT.quality + a.reputation * TITLE_WEIGHT.reputation + a.morale * TITLE_WEIGHT.morale
  return Math.round(c)
}

// 附带返回档位判定，便于后续接 UI 时与 hotelTitle.TITLES 对齐
export function attrsToTitle(attrs, titles) {
  const composite = attrsComposite(attrs)
  if (!Array.isArray(titles) || !titles.length) return { composite, title: null, nextAt: null }
  const tier = titles.find(t => composite >= t.min) || titles[titles.length - 1]
  const idx = titles.indexOf(tier)
  const next = titles[idx - 1] || null
  return {
    composite,
    title: tier.name,
    icon: tier.icon,
    nextAt: next ? next.min : null,
    progress: next ? Math.round(((composite - tier.min) / (next.min - tier.min)) * 100) : 100,
  }
}
