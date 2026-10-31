// V163 §1 · 一键收口四步纯层（无 IO · 执行器注入 ⇒ 浏览器/单测同一份源码）
//
// 设计要点（卡 §1）：
//   · 顺序 = [snapshot, coldbackup, finish, archive]，任一步失败 ⇒ 停在该步（不许跳步）
//   · 幂等：steps[键].state === '成功' 的步骤直接跳过（重跑不产生第二份产物）
//   · 断点续跑：steps 由调用方从服务端读入（semester_closeouts 表）· 本层不关心持久化
//   · 可证伪 RV：opts.continueOnFailure = true（"失败继续往下"）⇒ 测试必红

export const STEPS = ['snapshot', 'coldbackup', 'finish', 'archive']

export const STEP_LABELS = {
  snapshot: '① 生成结课快照（六组 history + 成绩单 CSV）',
  coldbackup: '② 数据冷备（应用层 DB 逻辑备份 + 服务器脚本清单）',
  finish: '③ 置 finished（学生端转只读）',
  archive: '④ 置 archived（可下载归档）',
}

/** 规范化服务端读入的 steps（缺省 = 待执行） */
export function normalizeSteps(steps) {
  const out = {}
  for (const k of STEPS) {
    const s = (steps || {})[k]
    out[k] = s && typeof s === 'object' ? { ...s } : { state: '待执行' }
    if (!['待执行', '执行中', '成功', '失败'].includes(out[k].state)) out[k].state = '待执行'
  }
  return out
}

/** 该步现在可执行吗（前序全部成功才轮到它 · 已成功 ⇒ 不再执行（幂等）） */
export function canRun(steps, key) {
  const i = STEPS.indexOf(key)
  if (i < 0) return { ok: false, reason: '未知步骤' }
  if (steps[key].state === '成功') return { ok: false, reason: '已完成（幂等跳过）' }
  for (let j = 0; j < i; j++) {
    if (steps[STEPS[j]].state !== '成功') return { ok: false, reason: `前置「${STEP_LABELS[STEPS[j]]}」未成功 —— 不许跳步` }
  }
  return { ok: true }
}

/**
 * 跑一键收口（含重试单步模式）。
 * @param {object} opts
 *   steps           服务端读入的进度（会被本函数更新并逐步回调 persist）
 *   executors       {snapshot: async()=>({files,note}), coldbackup, finish, archive} —— 抛错 = 失败
 *   persist         async (steps) => void   每步结束落服务端（断点续跑的"存"）
 *   only            只重试某一步（「重试本步」按钮 · 仍要求前序成功）
 *   continueOnFailure 仅测试 RV 用：true = 失败也往下走（正常流程绝不许传）
 * @returns {{steps, ran:string[], stoppedAt:string|null}}
 */
export async function runOneTouch({ steps: stepsIn, executors, persist, only, continueOnFailure = false }) {
  const steps = normalizeSteps(stepsIn)
  const ran = []
  let stoppedAt = null
  for (const key of STEPS) {
    if (only && key !== only) continue
    if (steps[key].state === '成功') continue
    const gate = canRun(steps, key)
    if (!gate.ok) {
      // continueOnFailure（仅 RV 用）= 被禁的"失败也继续往下"语义 ⇒ 连跳步闸一起绕过（否则不算复现该行为）
      if (!continueOnFailure) { if (!only) stoppedAt = stoppedAt || key; continue }
    }
    steps[key] = { ...steps[key], state: '执行中' }
    try { if (persist) await persist(steps) } catch (e) { /* 静默理由：进度暂存失败不改变本步执行，写失败会在下一步重试时再落 */ }
    try {
      const res = await executors[key]()
      steps[key] = { state: '成功', at: new Date().toISOString(), ...(res || {}) }
      ran.push(key)
      try { if (persist) await persist(steps) } catch (e) { /* 静默理由：成功态暂存失败 → 重跑时该步会因幂等重做，不产生错误产物 */ }
    } catch (e) {
      steps[key] = { state: '失败', at: new Date().toISOString(), reason: String((e && e.message) || e).slice(0, 300) }
      if (persist) { try { await persist(steps) } catch { /* 静默理由：同上 */ } }
      if (!continueOnFailure) { stoppedAt = key; break }
    }
  }
  return { steps, ran, stoppedAt }
}

/** 收口报告文本（卡 §1：四步结果 + 文件清单 + sha256 前 8 位） */
export function 收口报告(steps) {
  const 行 = STEPS.map(k => {
    const s = steps[k] || {}
    const 状态 = s.state === '成功' ? '✅ 成功' : s.state === '失败' ? `❌ 失败（${s.reason || ''}）` : s.state
    return `${STEP_LABELS[k]}：${状态}`
  })
  const 文件 = Object.entries((steps.snapshot && steps.snapshot.files) || {}).map(([名, f]) => `${名} · ${(f.size / 1024).toFixed(1)}KB · sha256 ${String(f.sha256).slice(0, 8)}`)
  const 文件2 = Object.entries((steps.coldbackup && steps.coldbackup.files) || {}).map(([名, f]) => `${名} · ${(f.size / 1024).toFixed(1)}KB · sha256 ${String(f.sha256).slice(0, 8)}`)
  return [...行, '', `文件清单：`, ...文件, ...文件2].join('\n')
}

/** 校验冷备记录（卡 §2【校验】按钮 · 客户端可跑）：重算 content 的 sha256 与清单比对 ⇒ 改坏必报 */
export async function 校验冷备(files, sha256Hex) {
  const 结果 = []
  for (const [名, f] of Object.entries(files || {})) {
    if (!f || !f.sha256) { 结果.push({ 名, ok: false, why: '清单缺 sha256' }); continue }
    if (f.content == null) { 结果.push({ 名, ok: true, why: '外置件（服务器脚本产物 · 用 verify-closeout.sh 校验）' }); continue }
    const 实 = await sha256Hex(f.content)
    结果.push({ 名, ok: 实 === f.sha256, why: 实 === f.sha256 ? '' : `清单 ${String(f.sha256).slice(0, 8)} ≠ 实算 ${String(实).slice(0, 8)}` })
  }
  const 通过 = 结果.filter(r => r.ok).length
  return { 通过, 总数: 结果.length, 全过: 通过 === 结果.length, 明细: 结果 }
}
