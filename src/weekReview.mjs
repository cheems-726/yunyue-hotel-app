// V131 §1-D · 周报三问复盘（每题 ≥20 字 · 三问都达标才能进入下一周）
//
// 落库：state.复盘 = [{ week, 三问: [a,b,c], 提交时刻 }]
// 红线：只记录/只进讲评素材；不并入四维评分；不惩罚"想错"，只拦"没想"。
export const 复盘三问 = [
  '本周哪个信号你看到但忽略了？（差评/竞品/天气/入住曲线）',
  '本周哪项决策的代价最大？事后看值不值？',
  '下周只改一件事，改什么？',
]
export const 每题最短 = 20
export const 每题最长 = 300

export function 复盘合格(三问) {
  if (!Array.isArray(三问) || 三问.length !== 3) return false
  return 三问.every(t => {
    const s = String(t == null ? '' : t).trim()
    return s.length >= 每题最短 && s.length <= 每题最长
  })
}

/** 从复盘历史里取某周（没有 ⇒ null） */
export function 复盘Of(复盘历史, week) {
  return (Array.isArray(复盘历史) ? 复盘历史 : []).find(x => x && Number(x.week) === Number(week)) || null
}

/** 三问是否已提交且合格（周报闸门用） */
export function 本周复盘完成(复盘历史, week) {
  const r = 复盘Of(复盘历史, week)
  return !!(r && 复盘合格(r.三问))
}
