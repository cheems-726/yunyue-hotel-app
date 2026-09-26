# -*- coding: utf-8 -*-
# A4：15% 维度改「真差评处理率」—— ① 周快照 ② 新公式三处 ③ 文案 ④ 旧档回退
import io

def rep(path, pairs):
    s = io.open(path, encoding='utf-8', newline='').read()
    okall = True
    for i, (old, new) in enumerate(pairs, 1):
        n = s.count(old)
        print(('  v ' if n == 1 else '  x ') + path + ' 锚点' + str(i) + ' 命中 ' + str(n) + ' 次：' + old.split('\n')[0][:52])
        if n != 1:
            okall = False
            continue
        s = s.replace(old, new)
    if okall:
        io.open(path, 'w', encoding='utf-8', newline='').write(s)
        print('  -> 已写盘 ' + path)
    else:
        print('  -> 未写盘 ' + path)
    return okall

# ① doSettle：结算卡统计后写 result.handleStats（随 report → history 持久化）
a = rep('src/App.jsx', [
    ("""    if (result.attrsAfter) setAttrs(result.attrsAfter)
    if (typeof result.capital === 'number') setCapital(result.capital)   // 资金唯一权威：引擎返回即权威""",
     """    if (result.attrsAfter) setAttrs(result.attrsAfter)
    if (typeof result.capital === 'number') setCapital(result.capital)   // 资金唯一权威：引擎返回即权威
    // A4（2026-09-22）：把当周"差评处理口径"快照进周报对象（随 history 持久化/云端同步）。
    //   🔴 前置坑：口碑页 kept 过滤只留当周卡 ⇒ 期末拿不到全学期处理率，必须逐周快照。
    //   只数结算生成的卡片（id 以 w<周>- 开头），与 pendingNegatives 同一规则（确定性）。
    result.handleStats = { pending: pendingNegatives, resolved: resolvedCount }"""),
])

# ② FinalResult：negScore 改真处理率（含旧档回退）
b = rep('src/FinalResult.jsx', [
    ("""  const totalNegative = history.reduce((s, h) => s + h.negativeCount, 0)""",
     """  const totalNegative = history.reduce((s, h) => s + h.negativeCount, 0)
  // A4：差评处理率（每快照周 resolved/(pending+resolved)）；旧档无 handleStats → 该周不计入平均（回退不惩罚）
  const handleWeeks = history.filter(h => h.handleStats && (h.handleStats.pending + h.handleStats.resolved) > 0)
  const avgHandleRate = handleWeeks.length
    ? handleWeeks.reduce((s, h) => s + h.handleStats.resolved / (h.handleStats.pending + h.handleStats.resolved), 0) / handleWeeks.length
    : null"""),
    ("""  // 差评处理率（简化：无差评满分，有差评看处理情况）
  const negativeScore = totalNegative === 0 ? 100 : totalNegative <= 5 ? 80 : totalNegative <= 10 ? 65 : 50""",
     """  // A4：15% 维度 = 真差评处理率（有差评的周取平均；全学期零差评 → 100，不惩罚；
  //     旧档无快照 → 按原"差评条数"口径回退，不惩罚历史档）
  const negativeScore = totalNegative === 0
    ? 100
    : avgHandleRate != null
      ? (avgHandleRate >= 0.9 ? 95 : avgHandleRate >= 0.7 ? 85 : avgHandleRate >= 0.5 ? 70 : avgHandleRate >= 0.3 ? 55 : 40)
      : (totalNegative <= 5 ? 80 : totalNegative <= 10 ? 65 : 50)"""),
])

# ③ TeacherDashboard：排名分同口径
c = rep('src/TeacherDashboard.jsx', [
    ("""  const totalNeg = history.reduce((a, h) => a + (h.negativeCount || 0), 0)""",
     """  const totalNeg = history.reduce((a, h) => a + (h.negativeCount || 0), 0)
  // A4：真差评处理率（与 FinalResult 同口径；旧档无快照回退原口径）
  const handleWeeks = history.filter(h => h.handleStats && (h.handleStats.pending + h.handleStats.resolved) > 0)
  const avgHandleRate = handleWeeks.length
    ? handleWeeks.reduce((s, h) => s + h.handleStats.resolved / (h.handleStats.pending + h.handleStats.resolved), 0) / handleWeeks.length
    : null"""),
    ("""  const negScore = totalNeg === 0 ? 100 : totalNeg <= 5 ? 80 : totalNeg <= 10 ? 65 : 50""",
     """  const negScore = totalNeg === 0
    ? 100
    : avgHandleRate != null
      ? (avgHandleRate >= 0.9 ? 95 : avgHandleRate >= 0.7 ? 85 : avgHandleRate >= 0.5 ? 70 : avgHandleRate >= 0.3 ? 55 : 40)
      : (totalNeg <= 5 ? 80 : totalNeg <= 10 ? 65 : 50)"""),
    ("""              { label: '差评处理', weight: 15, rule: '0条差评=100分 / ≤5条=80 / ≤10条=65 / >10条=50' },""",
     """              { label: '差评处理', weight: 15, rule: '按各周处理率平均：≥90%=95 / ≥70%=85 / ≥50%=70 / ≥30%=55 / >0%=40；零差评=100' },"""),
])

print('\n结果：app=' + str(a) + ' final=' + str(b) + ' teacher=' + str(c))
