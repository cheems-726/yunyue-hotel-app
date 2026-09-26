# -*- coding: utf-8 -*-
# P4 断言口径更新：影子测试允许"旧引擎好评率为负的周"存在差异（P4 夹取的就是那些周）
import io
p = 'tests/shadow-reviews.mjs'
s = io.open(p, encoding='utf-8', newline='').read()
old = """  ok(allSame, `${name}：12 周 出租率/好评率/差评数/利润 逐周完全一致`)"""
new = """  // 🔴 P4（2026-09-22）后口径微调：好评率被夹取到 ≥0（旧引擎会算出 −100%/−50%）。
  //    因此只在【旧引擎好评率为负】的周允许差异 —— 其余周必须仍然逐周完全一致（证明改动是外科手术式的）。
  const clampWeeks = rows.filter(r => r.old.finalGoodRate < 0).map(r => r.w)
  const unexpected = rows.filter(r => r.old.finalGoodRate >= 0 &&
    !(r.old.occupancy === r.new.occupancy && r.old.finalGoodRate === r.new.finalGoodRate &&
      r.old.negativeCount === r.new.negativeCount && r.old.profit === r.new.profit)).map(r => r.w)
  ok(unexpected.length === 0,
    `${name}：数值逐周一致（P4 夹取周除外，旧引擎好评率为负的 ${clampWeeks.length} 周${clampWeeks.length ? '：w' + clampWeeks.join('/w') : ''}）`)"""
assert s.count(old) == 1, s.count(old)
s = s.replace(old, new)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('影子断言已按 P4 口径更新')
