// V128-#3 批3 · 教师端「今天谁没做委托」（纯函数 · 不排名、不计分）
//   口径：今天 = classDay 在第几周的第几天（classDay 0 = 教学日历未同步 ⇒ 不判定）
//   缺做 = 该组当天的 weekInputs.每日委托 里没有一条 天 === 今天
//   ★ 只提示缺做，不做排名、不进四维评分（红线）
export function 今日天数(classDay) {
  const d = Number(classDay)
  if (!Number.isFinite(d) || d <= 0) return 0
  return ((Math.round(d) - 1) % 7) + 1
}

/**
 * @param {{组s?:Array<{组:string, 每日委托?:Array<{天:number}>}>, classDay?:number}} p
 * @returns {{可判:boolean, 天:number, 缺做:Array<{组:string}>, 已做:Array<{组:string}>}}
 */
export function 今日缺做({ 组s = [], classDay = 0 } = {}) {
  const 天 = 今日天数(classDay)
  const 组们 = Array.isArray(组s) ? 组s : []
  if (!天) return { 可判: false, 天: 0, 缺做: [], 已做: [] }
  const 已做 = 组们.filter(g => Array.isArray(g && g.每日委托) && g.每日委托.some(r => Number(r && r.天) === 天))
  const 缺做 = 组们.filter(g => !已做.includes(g))
  return { 可判: true, 天, 缺做, 已做 }
}
