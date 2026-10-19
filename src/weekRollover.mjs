// 周滚动的纯函数（★ V127-#4 / D326）
//   口径（实读 App.handleNextWeek 后定稿）：
//     · 进入下一周 = 客户端 `week + 1` + `doneDecisions` 清空 + 本周结果追加进 history
//     · **不碰 classDay / teacher_offset_days**（那是服务端日历，客户端没有任何写入口）
//   ⇒ 旧交接包写的「点完 classDay +7」与实现不符，已由 D326 更正为本口径。
export function 下一周状态({ history = [], report = null, week = 1, 总周数 = 12 } = {}) {
  const 旧历史 = Array.isArray(history) ? history : []
  const 本周 = Number(week) || 1
  const 新历史 = report ? [...旧历史, report] : [...旧历史]
  const 学期数 = Number(总周数) || 12
  if (本周 >= 学期数) {
    return { history: 新历史, week: 本周, doneDecisions: {}, finished: true, report: null }
  }
  return { history: 新历史, week: 本周 + 1, doneDecisions: {}, finished: false, report: null }
}
