// V170 §1 · 弱网提交队列（纯层 · 零网络 · localStorage 持久由调用方注入）
// 语义：提交失败 ⇒ 入队（不弹失败重试）⇒ online/15s ⇒ 按序补交 ⇒ 成功一条减一条。
// 幂等：结算路径本身走 settleIdempotent（(group,week) 闸）· 队列只重放"保存"动作（同 state 覆盖天然幂等）。

export const QUEUE_KEY = 'hotel-sim-sync-queue'

/** 入队（去重：同 key 已在队 ⇒ 覆盖 payload 不重复计） */
export function 入队(queue, item) {
  const k = item.key
  const rest = (queue || []).filter(x => x.key !== k)
  return [...rest, { ...item, 次数: ((queue || []).find(x => x.key === k)?.次数 || 0) + 1 }]
}

/** 出队头部（补交成功后） */
export function 出队(queue, key) {
  return (queue || []).filter(x => x.key !== key)
}

/** 按序补交：逐条执行 exec(item)，成功 ⇒ 移除并持久化；失败 ⇒ 停在该条（保序）。
 *  @param {Array} queue      队列（每项 {key, exec:()=>Promise<boolean>, ...}）
 *  @param {Function} persist (队列) => void
 *  @returns {{剩余:Array, 成功:number, 失败:boolean}} 失败=false 表示全清 */
export async function 补交(queue, persist) {
  let 剩余 = [...(queue || [])]
  let 成功 = 0
  while (剩余.length) {
    const item = 剩余[0]
    let ok = false
    try { ok = await item.exec() } catch (e) { ok = false }
    if (!ok) return { 剩余, 成功, 失败: true }
    剩余 = 出队(剩余, item.key)
    成功++
    try { if (persist) persist(剩余) } catch (e) { /* 静默理由：持久化失败不阻断补交，下次事件会再存 */ }
  }
  return { 剩余, 成功, 失败: false }
}

/** 指数退避（§2：一次自动重试 1s/3s） */
export const 退避 = (attempt) => (attempt === 0 ? 1000 : 3000)

/** 8 秒请求超时信号（§2）——供 fetch/REST 直调包装 */
export const 超时信号 = (ms = 8000) => (typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined)
