// 教师端聚合口径（纯函数 · 供界面与守门共用）
// ★ V127-#2：评分在 summarize() 里已经折成 5 分制（avgGood / 20）—— 班级平均**不得再除一次 20**。
//   历史缺陷：TeacherDashboard 的「平均口碑」写成 (avgRating / 20).toFixed(1) ⇒ 3.7 显示 0.2。
export function 班级平均口碑(值们) {
  const xs = (Array.isArray(值们) ? 值们 : [])
    .filter(v => v !== null && v !== undefined && v !== '')   // Number(null)=0，必须显式排除
    .map(v => Number(v))
    .filter(v => Number.isFinite(v))
  if (!xs.length) return null
  return +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1)
}
