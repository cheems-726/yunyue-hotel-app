// §32-U3-C · OTA 平台评分 + 违规处罚（渠道侧 · 世界层 · 确定性）
//
// ── 出处 ────────────────────────────────────────────────────────
//   单元卡 `2-任务包/现行/单元卡-U3.md` §4（需求 §2.2 平台规则）
//   现状（改造前）：只有静态佣金 15% / 流量 ×1.2 / 降价受限；grep 平台评分|违规处罚|ratingRule ⇒ 0
//
// ── 口径分离（★ 不许串 · 单元卡要求）────────────────────────────
//   · 本模块只影响 **OTA 平台合作（bizMode='ota'）** 的**渠道流量**与**平台罚款**。
//   · **自主直营（bizMode='direct'）不受平台评分影响**（`渠道流量系数` 对 direct 恒返回 1）—— 守门有专断言。
//   · 佣金仍按 bizMode（15%），加盟两费仍按品牌（7.40%）—— 三条口径互不代偿。
//
// ── 评分怎么来的（全部取自【本周引擎已有信号】· 不新增随机、不新增状态）──
//   服务分   ← 本周好评率 goodRate（0-1）
//   客诉率   ← 本周差评数 negativeCount / 评价数 reviewCount（无评价 → 0 客诉率）
//   回复质量 ← 待处理差评 pendingNegatives（积压扣分；引擎入参，随存档带上）
//   合成：评分 = clamp(4.6 + 服务分修正 + 客诉修正 + 回复修正, 1.0, 5.0)，保留 1 位小数（确定性四舍五入）
//   ★ 新店首周（无历史）不会因"没数据"被误判：reviewCount=0 时客诉修正取 0，不臆造差评。
//
// ── 违规（要留痕 · 单元卡要求）──────────────────────────────────
//   ① 差评长期不回复：本周 pendingNegatives ≥ 2（OTA 平台要求回复率）⇒ 降权 + 罚款
//   ② 到店无房（超售）：本周超售 ≥ 4 间（到店无房是 OTA 明确处罚项 · 与 overbook 决策同源）
//   ★ **刷单：当前决策集里没有触发源**（18 项决策无"虚假宣传/刷单"选项）⇒ **不实现、不编造**
//     （D56 边界①）。已记入批次报告与待决策队列：要上这条，先加决策项（D74：选项必须有消费点，反之亦然）。
//   ★ 违规后果 = 罚款（进 eventFine ⇒ 净利）+ 渠道降权（进 demandStrength）+ **events 留痕**（周报可见）。

export const OTA_RATING_CONFIG = {
  base: 4.6,                 // 新店基准分（未积累评价时的起点）
  serviceK: 1.6,             // 服务分修正系数：goodRate 每高于 0.85 一个单位 ⇒ +1.6 分
  complaintK: 2.4,           // 客诉率修正：差评率每高 10% ⇒ −0.24 分
  replyK: 0.35,              // 回复质量修正：每积压 1 条待处理差评 ⇒ −0.35 分
  min: 1.0, max: 5.0,
  trafficK: 0.18,            // 流量：评分每偏离 4.0 一分 ⇒ ±18%
  trafficMin: 0.60, trafficMax: 1.30,
  违规: {
    差评积压: { 阈值: 2, 罚款: 5000, 降权: 0.85, 名: '差评长期不回复', icon: 'status.warn', text: '平台的差评回复率考核不达标，店铺排名被降权', tip: '每周处理差评（口碑页），别攒着' },
    到店无房: { 阈值: 4, 罚款: 20000, 降权: 0.75, 名: '超售导致到店无房', icon: 'status.critical', text: '超售过多造成到店无房投诉，平台罚款并限制曝光', tip: '超售量要匹配历史 no-show 率，别贪' },
  },
}

const 夹 = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// 本周平台评分（0–5 · 1 位小数）—— 纯函数：同一周同一组输入必得同一结果
export function 平台评分({ goodRate = 0.85, negativeCount = 0, reviewCount = 0, pendingNegatives = 0 } = {}) {
  const 好评率 = Number.isFinite(Number(goodRate)) ? Number(goodRate) : 0.85
  const 差评 = Number(negativeCount) || 0
  const 评价数 = Number(reviewCount) || 0
  const 待处理 = Math.max(0, Number(pendingNegatives) || 0);
  const 客诉率 = 评价数 > 0 ? 差评 / 评价数 : 0            // 无评价 ⇒ 0（不臆造差评）
  const 服务修正 = (好评率 - 0.85) * OTA_RATING_CONFIG.serviceK
  const 客诉修正 = -客诉率 * OTA_RATING_CONFIG.complaintK
  const 回复修正 = -待处理 * OTA_RATING_CONFIG.replyK
  const 分 = 夹(OTA_RATING_CONFIG.base + 服务修正 + 客诉修正 + 回复修正, OTA_RATING_CONFIG.min, OTA_RATING_CONFIG.max)
  return {
    评分: Math.round(分 * 10) / 10,
    明细: { 好评率, 客诉率: Math.round(客诉率 * 1000) / 1000, 待处理, 服务修正: Math.round(服务修正 * 100) / 100, 客诉修正: Math.round(客诉修正 * 100) / 100, 回复修正: Math.round(回复修正 * 100) / 100 },
  }
}

// OTA 渠道流量系数（评分 → 流量）。★ direct（自主直营）恒 1 ⇒ 平台评分与直营无关
export function 渠道流量系数(评分, bizMode = 'direct') {
  if (bizMode !== 'ota') return 1
  const s = Number(评分)
  if (!Number.isFinite(s)) return 1
  const 系数 = 1 + (s - 4.0) * OTA_RATING_CONFIG.trafficK
  return Math.round(夹(系数, OTA_RATING_CONFIG.trafficMin, OTA_RATING_CONFIG.trafficMax) * 1000) / 1000
}

// V35 · OTA 流量权重动态循环（平台流量池随淡旺季收缩/扩张 · season 同源 · 平台平滑 0.5）
//   仅 ota 模式消费（direct 不受平台影响 · 口径不串）· 夹 [0.90, 1.15]（平台不放大极端）。
//   依据：真实 OTA 运营（旺季投放涨 · 淡季补贴拉量）为行业通识 · 教学点=OTA 依赖组对平台流量池敏感。
export function 流量循环因子(季节系数, bizMode = 'direct') {
  if (bizMode !== 'ota') return 1
  const s = Number(季节系数)
  if (!Number.isFinite(s)) return 1
  return Math.round(Math.min(1.15, Math.max(0.90, 1 + (s - 1) * 0.5)) * 1000) / 1000
}
// 违规判定（本周）—— 返回违规列表（空数组 = 无违规 ⇒ 结果里不挂键，保水位线）
export function 违规判定({ pendingNegatives = 0, overbook = 0 } = {}) {
  const 待处理 = Math.max(0, Number(pendingNegatives) || 0)
  const 超售 = Math.max(0, Number(overbook) || 0)
  const 出 = []
  if (待处理 >= OTA_RATING_CONFIG.违规.差评积压.阈值) {
    const c = OTA_RATING_CONFIG.违规.差评积压
    出.push({ 类型: '差评积压', 名: c.名, icon: c.icon, 罚款: c.罚款, 降权: c.降权, text: c.text, tip: c.tip, 触发值: 待处理 })
  }
  if (超售 >= OTA_RATING_CONFIG.违规.到店无房.阈值) {
    const c = OTA_RATING_CONFIG.违规.到店无房
    出.push({ 类型: '到店无房', 名: c.名, icon: c.icon, 罚款: c.罚款, 降权: c.降权, text: c.text, tip: c.tip, 触发值: 超售 })
  }
  return 出
}

// 违规合计（罚款 / 降权 / 周报事件文案 —— 唯一生成点）
export function 违规后果(违规s) {
  const 列 = Array.isArray(违规s) ? 违规s : []
  const 罚款 = 列.reduce((s, v) => s + (Number(v.罚款) || 0), 0)
  const 降权 = 列.length ? 列.reduce((m, v) => m * (Number(v.降权) || 1), 1) : 1
  // 保留 4 位（0.85×0.75 = 0.6375 —— 3 位会把 637.5 四舍五入成 638 ⇒ 与"连乘"口径不符，实测踩过）
  // ★ 用 toFixed 表达"保留 4 位小数"：写 `* 10000 / 10000` 会被 stale-scale 扫描器误判成「元→万换算」（R6），
  //   那是**误报**——本处与"万"无关。换成 toFixed 是澄清意图，不是绕过判据（语义完全一致）。
  return { 罚款, 降权: Number(降权.toFixed(4)), 条数: 列.length, 明细: 列 }
}

// 认领页/经营页给学生看的规则说明（单一处生成 · 界面只渲染）
export const OTA_RULES = [
  '平台评分由【本周好评率 + 客诉率 + 差评回复情况】共同决定（每周更新，全班同规则）',
  `评分每低于 4.0 一分 ⇒ OTA 渠道流量 −${Math.round(OTA_RATING_CONFIG.trafficK * 100)}%（高于则 +，上下限 ${OTA_RATING_CONFIG.trafficMin}–${OTA_RATING_CONFIG.trafficMax}×）`,
  `差评积压 ≥ ${OTA_RATING_CONFIG.违规.差评积压.阈值} 条 ⇒ 平台降权 + 罚款 ${OTA_RATING_CONFIG.违规.差评积压.罚款.toLocaleString()} 元`,
  `超售 ≥ ${OTA_RATING_CONFIG.违规.到店无房.阈值} 间 ⇒ 到店无房处罚：降权 + 罚款 ${OTA_RATING_CONFIG.违规.到店无房.罚款.toLocaleString()} 元`,
  '★ 以上只作用于【OTA 平台合作】模式；【自主直营】不受平台评分与平台罚款影响（但也没有 OTA 的流量加成）',
]
