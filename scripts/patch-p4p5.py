# -*- coding: utf-8 -*-
# P4 好评率负值夹取（settlement）+ P5 周报"期末资金"行 + 两侧断言
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

# ── P4：夹取（差评潮/超售追加之后、卡片生成之前） ──
p4 = rep('src/settlement.js', [
    ("""  // ② 卡片生成：目标 − 本周实时已产生 = 差额（数字与卡片严格一致）""",
     """  // 🔴 P4（2026-09-22）：差评数不可能超过评价数，但「差评潮」「超售」会在此之上额外 +1，
  //    使 finalGoodRate = (reviewCount − negativeImpact)/reviewCount 出现负值
  //    （实测 −100%/−50%，学生会看到"好评率 X% → -100%"这种无意义数字）。
  //    夹取后两个口径同时自洽：差评数 ≤ 评价数、好评率 ≥ 0；差评卡目标随之用夹取后的数量，
  //    卡片数与周报数字仍然严格一致（守恒不破）。
  if (negativeCount > reviewCount) negativeCount = reviewCount

  // ② 卡片生成：目标 − 本周实时已产生 = 差额（数字与卡片严格一致）"""),
])

# ── P4 断言：彩排（6 组×12 周）与压力（含极端组）都必须满足"差评数 ≤ 评价数、好评率 ≥ 0" ──
p4b = rep('tests/rehearsal.mjs', [
    ("""// ── ⑤ 属性区间 + 衰减痕迹 ──""",
     """// ── ④b 口径自洽（P4）：差评数 ≤ 评价数、好评率 ≥ 0 ──
{
  const bad = []
  for (const { key, rows } of all) for (const r of rows) {
    if (r.negativeCount > r.reviewCount) bad.push(`${key} 第${r.w}周 差评${r.negativeCount} > 评价${r.reviewCount}`)
    if (r.goodRate < 0) bad.push(`${key} 第${r.w}周 好评率 ${r.goodRate}% < 0`)
  }
  ok(bad.length === 0, `差评数 ≤ 评价数 且 好评率 ≥ 0（${all.length * WEEKS} 周）${bad.length ? ' → ' + bad.slice(0, 3).join('；') : ''}`)
}

// ── ⑤ 属性区间 + 衰减痕迹 ──"""),
])
p4c = rep('tests/rehearsal-stress.mjs', [
    ("""// ── 全局结论 ──""",
     """// ── P4 口径自洽：夹取后差评数不得超过评价数（否则差评卡会多于"评价数"）──
ok([...long, ...ob, ...empty, ...harsh, ...(typeof low !== 'undefined' ? low : []), ...(typeof high !== 'undefined' ? high : [])]
  .every(r => r.negativeCount <= r.reviewCount),
  '全部压力场景：差评数 ≤ 评价数（P4 夹取生效）')

// ── 全局结论 ──"""),
])

# ── P5：周报「经营明细」加期末资金一行 ──
p5 = rep('src/WeeklyReport.jsx', [
    ("""          <div>⭐ 好评率 {result.goodRate}% → {result.finalGoodRate}%</div>""",
     """          <div>⭐ 好评率 {result.goodRate}% → {result.finalGoodRate}%</div>
          {/* P5：资金唯一权威 = settle 返回的 capital（资金卡同源，可对账） */}
          {typeof result.capital === 'number' && <div>💰 期末资金 {result.capital.toLocaleString()} 元</div>}"""),
])

# ── P5 断言：资金卡显示值 === 周报期末资金（含显示精度容差），state === 周报值（精确）──
p5b = rep('tests/verify-capital.mjs', [
    ("""  // ── ④ 进入下一周 → 资金卡显示累积值（不再是每周重置的 50 万+本周）──""",
     """  // ── P5 对账：周报「期末资金」=== 权威 state（精确）=== 资金卡显示（容差 ±500，显示为 x.x 万）──
  {
    const mCap = wr.match(/💰 期末资金\\s*([\\d,]+)\\s*元/)
    ok(`周报显示「期末资金」（${mCap ? mCap[1] : '未匹配'}）`, !!mCap)
    if (mCap) {
      const wrCap = Number(mCap[1].replace(/,/g, ''))
      ok(`周报期末资金 === 权威 state（${wrCap} vs ${st2.capital}）`, wrCap === st2.capital)
      const cardNow = await readCardCap()
      ok(`资金卡显示 ≈ 周报期末资金（${cardNow} vs ${wrCap}，容差 ±500）`, cardNow != null && Math.abs(cardNow - wrCap) <= 500)
    }
  }

  // ── ④ 进入下一周 → 资金卡显示累积值（不再是每周重置的 50 万+本周）──"""),
])

print('\n结果：P4=' + str(p4) + ' P4断言彩排=' + str(p4b) + ' P4断言压力=' + str(p4c) + ' P5=' + str(p5) + ' P5断言=' + str(p5b))
