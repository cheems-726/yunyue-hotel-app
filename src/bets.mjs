// V131 §1-A · 先押注后揭晓（纯逻辑 · 评分写死便于断言）
//
// 字段：state.本周押注 = { week, 出租率, 净利方向, 提交时刻 }
//       state.押注历史 = [{ week, 出租率, 净利方向, 实际出租率, 实际净利, 出租率得分, 方向得分, 总分 }]
// 红线：押注只进过程分台账（第五列），**不并入四维评分、不改引擎数值**；错得离谱不扣分，空白不能过。
//
// 评分（照卡 §1-A 写死）：
//   出租率误差 ≤3→10 · ≤6→7 · ≤10→5 · ≤15→2 · 其余 0
//   方向押中 5 · 差一档 2 · 差两档以上 0
export const 净利方向们 = ['明显亏损', '小幅亏损', '小幅盈利', '明显盈利']
export const 押注满分 = 15

/** 净利（元）→ 四档（卡内阈值：-5万 / 0 / +5万） */
export function 净利档Of(净利) {
  const v = Number(净利)
  if (!Number.isFinite(v)) return null
  if (v < -50000) return '明显亏损'
  if (v < 0) return '小幅亏损'
  if (v <= 50000) return '小幅盈利'
  return '明显盈利'
}

export function 出租率得分(预测, 实际) {
  const p = Number(预测), a = Number(实际)
  if (!Number.isFinite(p) || !Number.isFinite(a)) return 0
  const d = Math.abs(p - a)
  if (d <= 3) return 10
  if (d <= 6) return 7
  if (d <= 10) return 5
  if (d <= 15) return 2
  return 0
}

export function 方向得分(预测方向, 实际净利) {
  const 实际 = 净利档Of(实际净利)
  const i = 净利方向们.indexOf(String(预测方向))
  const j = 净利方向们.indexOf(String(实际))
  if (i < 0 || j < 0) return 0
  const d = Math.abs(i - j)
  return d === 0 ? 5 : d === 1 ? 2 : 0
}

/**
 * 结算后打分
 * @param {{week:number, 出租率:number, 净利方向:string, 提交时刻?:string}} 押注
 * @param {{occupancy:number, netProfit?:number, profit?:number}} 结果
 */
export function 判押注(押注, 结果) {
  const 实际出租率 = Math.round(Number(结果 && 结果.occupancy) || 0)
  const 实际净利 = Number(结果 && (Number.isFinite(Number(结果.netProfit)) ? 结果.netProfit : 结果.profit)) || 0
  const 实 = 净利档Of(实际净利)
  const 出租 = 出租率得分(押注 && 押注.出租率, 实际出租率)
  const 方向 = 方向得分(押注 && 押注.净利方向, 实际净利)
  return {
    week: Number(押注 && 押注.week) || 0,
    出租率: Number(押注 && 押注.出租率),
    净利方向: String((押注 && 押注.净利方向) || ''),
    提交时刻: String((押注 && 押注.提交时刻) || ''),
    实际出租率,
    实际净利,
    实际方向: 实,
    误差: Math.abs(Number(押注 && 押注.出租率) - 实际出租率),
    出租率得分: 出租,
    方向得分: 方向,
    总分: 出租 + 方向,
  }
}

/** 本周押注是否有效（周锁定：week 必须等于本周；出租率 0–100 整数；方向在四档内） */
export function 押注有效(押注, week) {
  if (!押注 || typeof 押注 !== 'object') return false
  if (Number(押注.week) !== Number(week)) return false
  const o = Number(押注.出租率)
  if (!Number.isInteger(o) || o < 0 || o > 100) return false
  return 净利方向们.includes(String(押注.净利方向))
}

/** 结算时用：补押（迟押）不计分，只记录 */
export function 结算押注(押注, 结果) {
  const r = 判押注(押注, 结果)
  if (押注 && 押注.迟押) return { ...r, 出租率得分: 0, 方向得分: 0, 总分: 0, 迟押: true }
  return r
}

/** 台账第五列「押注校准」：从押注历史里找本周；没有 ⇒ null（显 —） */
export function 押注校准(押注历史, week) {
  const hit = (Array.isArray(押注历史) ? 押注历史 : []).find(x => x && Number(x.week) === Number(week))
  if (!hit) return null
  const n = Number(hit.总分)
  return Number.isFinite(n) ? n : null
}
