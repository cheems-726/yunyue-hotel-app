// 缺周识别与展示（T2.4 / Phase E2）
//
// ── 背景 ────────────────────────────────────────────────────────
// 老师可以跳过若干周（服务端 classWeek 前进、学生没经营那几周）⇒ 存档 history 里
// 会出现【周号缺口】（例如 1-4 周有、5-6 周没有、7-12 周有）。
//
// ── 硬约束（E2 的判定口径）──────────────────────────────────────
//   ★ 缺周【不参与任何平均值分母】。
//     即：所有均值/处理率/评分继续只用【真实经营过的周】作分母（现状已是如此），
//     本模块只负责【把它们显示出来】，绝不向 history 里塞占位条目。
//     所以 missingWeeks/weekRows 都是【只读、产出展示行】，调用方不得把结果回写 history。
//
// ── 为什么不在 history 里补零 ────────────────────────────────────
//   补零会让 avgOcc / avgGood / handleRate 的分母变大 ⇒ 分数被稀释 ⇒ 相当于"跳周=受罚"，
//   与"老师跳过不算学生失职"的教学意图相反。因此展示与统计必须分家。

// 缺口周号（升序）。范围 = 1 .. max(week)，只看真实周号之间的洞
export function missingWeeks(history) {
  const arr = Array.isArray(history) ? history : []
  const weeks = arr.map(h => Number(h && h.week)).filter(n => Number.isFinite(n) && n > 0)
  if (!weeks.length) return []
  const have = new Set(weeks)
  const max = Math.max(...weeks)
  const out = []
  for (let w = 1; w <= max; w++) if (!have.has(w)) out.push(w)
  return out
}

// 展示行：真实周 + 缺口占位行（按周号升序）。占位行 { week, real:false }
// ★ 真实行数恒 === history.length（分母不变）；占位行不得进入任何统计
export function weekRows(history) {
  const arr = Array.isArray(history) ? history : []
  const miss = new Set(missingWeeks(arr))
  const rows = []
  const max = arr.length ? Math.max(...arr.map(h => Number(h && h.week) || 0)) : 0
  for (let w = 1; w <= max; w++) {
    const h = arr.find(x => Number(x && x.week) === w)
    if (h) rows.push({ week: w, real: true, h })
    else if (miss.has(w)) rows.push({ week: w, real: false, h: null })
  }
  return rows
}

// 缺周提示文案（三处组件共用，保证口径一致）
export function missingLabel(week) {
  return `第 ${week} 周 · 未经营（老师跳过）`
}
