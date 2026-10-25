// V156 阶段二 · 结算幂等（单一入口 = weekSegments.settleWeekSegmented）
//
// 🔴 背景（卡 §2）：同一 (group, week) 重复结算 ⇒ history 多条、金额翻倍，且不可逆。
//   服务端 advanceGroupOneDay 已有 history.find(week) 幂等（V126-#4），但那只盖服务端 tick；
//   客户端 doSettle（手动/自动）没有同款闸 ⇒ 双开标签/断线重试/快速双击都可能双结算。
//
// 做法：把幂等闸下沉到【两端共用的唯一结算入口】settleWeekSegmented：
//   入参带 week + history ⇒ history 已有该周 ⇒ 直接返回既有周报（__idempotent 标记），
//   不再进引擎 —— 客户端 doSettle 与服务端 serverTick 从此同一道闸。
//   ⚠ 零变化水位线：history 缺省/无该周 ⇒ 走原路径，输出逐字节不变（既有调用方不受影响）。
export function 幂等检查({ week, history = [] }) {
  const w = Number(week)
  if (!Number.isFinite(w)) return { hit: false, 已有: null }
  const 已有 = (Array.isArray(history) ? history : []).find(h => Number(h && h.week) === w)
  return 已有 ? { hit: true, 已有 } : { hit: false, 已有: null }
}

/** 包一层：给 settleWeekSegmented 加 (group, week) 幂等（返回既有结果，不再结算） */
export function withIdempotent(settleWeekSegmentedImpl) {
  return (输入 = {}) => {
    const { history, week, ...rest } = 输入
    const gate = 幂等检查({ week, history })
    if (gate.hit) {
      // 幂等命中：返回既有周报（引擎不再跑）—— 形状与正常结果同源（就是那份存档对象）
      return { ...gate.已有, __idempotent: true }
    }
    return settleWeekSegmentedImpl({ ...rest, week, ...(history !== undefined ? {} : {}) })
  }
}
