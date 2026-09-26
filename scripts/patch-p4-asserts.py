# -*- coding: utf-8 -*-
# 修两处：verify-severity 采用 P4 口径；verify-capital 的 P5 断言改到"卡片可见"的时机
import io

def rep(path, pairs):
    s = io.open(path, encoding='utf-8', newline='').read()
    okall = True
    for i, (old, new) in enumerate(pairs, 1):
        n = s.count(old)
        print(('  v ' if n == 1 else '  x ') + path + ' 锚点' + str(i) + ' 命中 ' + str(n) + ' 次：' + old.split('\n')[0][:50])
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

# ── a) verify-severity：把"12 周数值逐周完全一致"改为 P4 口径（首次夹取周之前必须一致）──
a = rep('tests/verify-severity.mjs', [
    ("""  const numDiff = rows.filter(r => numKeys.some(k => JSON.stringify(r.old[k]) !== JSON.stringify(r.new[k])))
  ok(numDiff.length === 0, `${name}：12 周数值逐周完全一致（出租率/好评率/差评数/条数/利润/资金）`)""",
     """  // 🔴 P4（2026-09-22）口径：好评率被夹取到 ≥0，且经 prevGoodRate 跨周传导
  //    ⇒ 断言 = 【首次夹取周之前必须逐周完全一致】；夹取周及其后为预期差异
  const clampWeeks = rows.filter(r => r.old.finalGoodRate < 0).map(r => r.w)
  const firstClamp = clampWeeks.length ? Math.min(...clampWeeks) : Infinity
  const numDiff = rows.filter(r => r.w < firstClamp && numKeys.some(k => JSON.stringify(r.old[k]) !== JSON.stringify(r.new[k])))
  ok(numDiff.length === 0,
    `${name}：首次夹取周(${firstClamp === Infinity ? '—' : 'w' + firstClamp})之前数值逐周完全一致；夹取周 ${clampWeeks.length} 周`)"""),
])

# ── b) verify-capital：P5 断言拆分 —— 报表页只比"周报 ↔ 权威 state"，卡片比对挪到卡片可见时 ──
b = rep('tests/verify-capital.mjs', [
    ("""  {
    const mCap = wr.match(/💰 期末资金\\s*([\\d,]+)\\s*元/)
    ok(`周报显示「期末资金」（${mCap ? mCap[1] : '未匹配'}）`, !!mCap)
    if (mCap) {
      const wrCap = Number(mCap[1].replace(/,/g, ''))
      ok(`周报期末资金 === 权威 state（${wrCap} vs ${st2.capital}）`, wrCap === st2.capital)
      const cardNow = await readCardCap()
      ok(`资金卡显示 ≈ 周报期末资金（${cardNow} vs ${wrCap}，容差 ±500）`, cardNow != null && Math.abs(cardNow - wrCap) <= 500)
    }
  }""",
     """  let wrCap = null
  {
    const mCap = wr.match(/💰 期末资金\\s*([\\d,]+)\\s*元/)
    ok(`周报显示「期末资金」（${mCap ? mCap[1] : '未匹配'}）`, !!mCap)
    if (mCap) {
      wrCap = Number(mCap[1].replace(/,/g, ''))
      ok(`周报期末资金 === 权威 state（${wrCap} vs ${st2.capital}）`, wrCap === st2.capital)
    }
  }"""),
    ("""  ok(`第 2 周资金卡仍显示累积值（显示 ${card2} ≈ 权威 ${st3.capital}）`, card2 != null && Math.abs(card2 - st3.capital) <= 500 && st3.capital > 500000)""",
     """  ok(`第 2 周资金卡仍显示累积值（显示 ${card2} ≈ 权威 ${st3.capital}）`, card2 != null && Math.abs(card2 - st3.capital) <= 500 && st3.capital > 500000)
  // P5 对账（卡片可见时才比）：资金卡显示 === 上一份周报的「期末资金」（容差 ±500 = x.x 万显示精度）
  if (wrCap != null) ok(`资金卡显示 ≈ 周报期末资金（${card2} vs ${wrCap}）`, card2 != null && Math.abs(card2 - wrCap) <= 500)"""),
])

print('\n结果：verify-severity=' + str(a) + ' verify-capital=' + str(b))
