// §16.2-B7 · 周结算的【周内输入】单一来源（补算 === 在线 的前置）
//
import { 有效处理权重 } from './roleBonus.mjs'   // ★ §32-U4-R4：职务加成（×1.3）—— 唯一判定点（本模块只调用，不重写规则）
// ── 为什么需要本模块（问题陈述）──────────────────────────────────
//   `settle()` 除站点/品牌/决策外，还吃 5 个【周内产生】的输入：
//     pendingNegatives（未处理差评欠账，压口碑）· resolvedCount（已整改数，触发追加好评）
//     liveNegCount / livePosCount（本周实时流水里已产出的评价 ⇒ 结算只补差额，不重复出卡）
//     crisisResponse（上周危机应对选择，±口碑）
//   客户端从 localStorage（评价流水 + 危机选择）现算；**服务端原来一个都拿不到** ⇒
//   "补算 === 在线"在这些输入非零的周**不成立**（§15 报告 §七 已如实挂账）。
//
// ── 本模块的定位（单源，不许各写一份）────────────────────────────
//   ★ 本文件是这 5 个输入的**唯一派生点**。客户端（落存档 / 上传云端）与服务端（补算）都调它。
//   ★ 为什么"存档里的 weekInputs"而不是"让服务端自己算"：
//     服务端只有存档，**看不到 localStorage**（评价流水与危机选择都不在存档载荷里）
//     ⇒ 必须由客户端把派生结果随存档带上去（`cloudState.weekInputs`）。
//   ★ 公平性红线（D2）不受影响 —— 这是**实测**不是推断：
//     实时评价数（liveNeg/livePos）只决定"哪些卡在实时里已经出过"，
//     **不改变任何业务数字**（营收/利润/出租率/好评率全同）。
//     ⇒ 守门 `tests/weeklyAuto.test.mjs` 有专门断言钉住这条（防止将来有人改坏）。
//
// ── 与 App.jsx 的历史口径逐字一致（迁移不改行为）──────────────────
//   ① 只数【结算生成的卡片】（id 形如 `w<周>-n0`）—— 排除口碑页演示初值（数字 id）与实时卡；
//      实时卡若计入欠账会变成"开 App 越久欠账越多" ⇒ 破坏公平性。
//   ② 本周实时评价按 `live === true && liveWeek === week` 取。
//   ③ 危机选择只在 `crisis.week === week - 1` 时生效（上周选、这周结算时用）。

// ★ §32-U8-补 §2②（2026-10-01）：注入事件的「30 秒应对」—— 本模块是它的唯一派生点（同 5 输入纪律）
//   学生在本周经营页应对老师注入的事件 ⇒ 存 localStorage `hotel-sim-event-response`（形状 {week, 事件id, choice}）
//   ⇒ 结算时经本函数派生成 `注入应对`（{事件id: choice}）喂进 settle（E8 的整改/侥幸分支消费）。
//   ★ 与危机通道的分工（不同周语义，别混）：
//     · 危机通道（crisis）：**上周选、本周用**（crisis.week === week - 1）
//     · 注入应对（eventResponse）：**当周选、当周用**（eventResponse.week === week —— 事件就是本周的）
//   ★ 版本兼容：字段为加法扩展，`版本` 保持 1（旧载荷无此字段 ⇒ null ⇒ 行为与改前逐字节一致）。
export const WEEK_INPUTS_VERSION = 1

// 缺省（没有存档输入时）：全 0 / 无危机 —— 与服务端补算的兜底口径一致
export const 空周输入 = (week) => ({
  版本: WEEK_INPUTS_VERSION, week: Number(week),
  pendingNegatives: 0, resolvedCount: 0, liveNegCount: 0, livePosCount: 0, crisisResponse: null, 注入应对: null,
})

const 非负整数 = (v) => Math.max(0, Math.floor(Number(v) || 0))

/**
 * 从「评价流水 + 危机选择」派生本周结算输入（纯函数）
 * @param {{reviews?:Array, week:number, crisis?:{week:number,choice:string}|null}} p
 * @returns {{版本:number, week:number, pendingNegatives:number, resolvedCount:number,
 *            liveNegCount:number, livePosCount:number, crisisResponse:string|null}}
 */
// ★ §27.3-②a（2026-09-29 · D75）：`emergency`（突发事件处置 · 决策面板会渲染的**计时决策**）
//   此前**零消费** —— 选项落实审计（D74）判为"装饰品"：学生会答，但没有任何后果。
//   现在**接进既有危机机制**（与 WeeklyReport 那套危机应对**合并**，不另立第二套）：
//     · 优先级：WeeklyReport 危机卡**已选** ⇒ 以它为准（不覆盖学生的显式选择）；
//       危机卡未选（或周号对不上）⇒ 用 emergency 的处置作为本周的危机应对。
//     · 映射按**语义**（处置得当 / 态度好但可能延误 / 推卸责任 ↔ 公开整改 / 逐条回复 / 不理会）——
//       三个落点都是 `settle` **已有**的消费值 ⇒ **不为它改引擎**（§27.6 边界）。
//   ★ 放在本函数（唯一派生点）的理由：doSettle 与面板预览都从这里取
//     ⇒ 两端天然一致（§16.2-B7 立的"口径单源"纪律）。
const 突发处置映射 = {
  '立即送医+道歉': '立即公开整改+补偿',
  '先安抚再处理': '逐条真诚回复',
  '推卸责任': '不理会',
}

export function settleInputsFrom({ reviews, week, crisis = null, eventResponse = null, decisions = {}, 处理人职务 = null } = {}) {
  const 流水 = Array.isArray(reviews) ? reviews : []
  const w = Number(week)
  // ① 结算卡（跨周累计）—— 欠账/整改只认它们（确定性；实证见文件头 ①）
  const 结算卡 = 流水.filter(r => /^w\d+-/.test(String(r && r.id)))
  const pendingNegatives = 结算卡.filter(r => r.status === 'pending' || r.status === 'ignored').length
  const resolvedCount = 结算卡.filter(r => r.status === 'resolved').length
  // ★ §32-U4-R4：有效处理权重（已处理卡的 Σ 权重；匹配职务 ×1.3）
  //   ★ 传空职务 ⇒ 全 1.0 ⇒ 与旧行为逐字节一致（未设职务的组/旧存档照常）
  const resolvedWeight = 有效处理权重(结算卡.filter(r => r.status === 'resolved'), 处理人职务)
  // ② 本周实时流水已产出的评价 ⇒ 结算只补差额
  const 本周实时 = 流水.filter(r => r && r.live === true && Number(r.liveWeek) === w)
  const liveNegCount = 本周实时.filter(r => Number(r.stars) <= 3).length
  const livePosCount = 本周实时.filter(r => Number(r.stars) >= 4).length
  // ③ 危机应对：上周选、本周用
  //   ★ §27.3-②a：危机卡**未选**时回落到 `emergency`（突发事件处置）的映射值 —— 让那个决策有真实后果
  const 危机卡选 = (crisis && Number(crisis.week) === w - 1 && crisis.choice) ? crisis.choice : null
  const 处置 = 突发处置映射[decisions && decisions.emergency] || null
  const crisisResponse = 危机卡选 || 处置
  // ★ §32-U8-补 §2②：注入事件应对（当周选、当周用）—— 周号不符/无事件id ⇒ null（不猜）
  const 注入应对 = (eventResponse && Number(eventResponse.week) === w && eventResponse.事件id && eventResponse.choice)
    ? { [String(eventResponse.事件id)]: String(eventResponse.choice) }
    : null
  return { 版本: WEEK_INPUTS_VERSION, week: w, pendingNegatives, resolvedCount, resolvedWeight, liveNegCount, livePosCount, crisisResponse, 注入应对 }
}

// 从存档里取【本周】的输入：版本/周号对不上 ⇒ 视为没有（返回 null，由调用方决定兜底）
export function weekInputsOf(save, week) {
  const w = save && save.weekInputs
  if (!w || typeof w !== 'object') return null
  if (Number(w.week) !== Number(week)) return null          // 存档里的是别的周 ⇒ 不敢拿来用
  if (w.版本 != null && Number(w.版本) !== WEEK_INPUTS_VERSION) return null
  return {
    pendingNegatives: 非负整数(w.pendingNegatives), resolvedCount: 非负整数(w.resolvedCount),
    liveNegCount: 非负整数(w.liveNegCount), livePosCount: 非负整数(w.livePosCount),
    crisisResponse: typeof w.crisisResponse === 'string' ? w.crisisResponse : null,
    // ★ §32-U8-补：注入应对（加法扩展 · 旧载荷无此字段 ⇒ null ⇒ 与改前逐字节一致）
    注入应对: (w.注入应对 && typeof w.注入应对 === 'object') ? { ...w.注入应对 } : null,
  }
}
