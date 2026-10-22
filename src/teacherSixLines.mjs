// V144 §2 · 教师端「六组一句话」纯格式化（不排名、不打分；数字全部来自 groups 行）
export function 六组一句话(rows) {
  return (rows || [])
    .filter(g => g && Number(g.historyCount) > 0)
    .map(g => {
      const 净利率 = Number(g.revenue) > 0 ? Math.round(Number(g.gop) / Number(g.revenue) * 100) : null
      const 好评率 = Number.isFinite(Number(g.rating)) ? Math.round(Number(g.rating) * 20) : null
      return `${g.name} · ${g.historyCount} 周经营利润 ${Number(g.gop) >= 0 ? '+' : ''}${g.gop} 万 · ` +
        `净利率 ${净利率 == null ? '—' : 净利率}% · 出租率 ${g.occ}% · 好评率 ${好评率 == null ? '—' : 好评率}% · ` +
        `开店投入 ${g.oneTime != null ? g.oneTime : '待补'} 万`
    })
}
