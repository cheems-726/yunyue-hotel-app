# -*- coding: utf-8 -*-
# 修正 T4：按实测（reviewRate.js 有 1 处 rnd 兜底；liveReview.js 为 0 处）
import io
p = 'tests/guests.test.mjs'
s = io.open(p, encoding='utf-8', newline='').read()
old = """  const g = codeOnly(read('guests.js'))
  const rr = codeOnly(read('reviewRate.js'))
  ok(!/Math\\.random/.test(g), 'guests.js 无 Math.random（自带 guestsRng 独立流）')
  ok(!/Math\\.random/.test(rr), 'reviewRate.js 无 Math.random（纯概率计算）')
  // liveReview.js 允许 1 处，且必须只是"未传 rnd"时的兜底（关键路径由调用方传独立流）
  const lr = codeOnly(read('liveReview.js'))
  const hits = (lr.match(/Math\\.random/g) || []).length
  const hitLines = lr.split('\\n').filter(l => /Math\\.random/.test(l))
  ok(hits === 1 && hitLines.every(l => /typeof\\s+rnd\\s*===\\s*'function'/.test(l)),
    `liveReview.js 仅 1 处 Math.random 且位于 rnd 兜底分支（实测 ${hits} 处）`)"""
new = """  // 口径（2026-09-22 实测）：guests.js / liveReview.js = 0 处；reviewRate.js 允许 1 处，
  // 且必须只出现在 `typeof rnd === 'function' ? rnd() : Math.random()` 的兜底分支
  const countRandom = (src) => (codeOnly(src).match(/Math\\.random/g) || []).length
  const g = read('guests.js'), rr = read('reviewRate.js'), lr = read('liveReview.js')
  ok(countRandom(g) === 0, `guests.js 无 Math.random（实测 ${countRandom(g)} 处，自带 guestsRng 独立流）`)
  ok(countRandom(lr) === 0, `liveReview.js 无 Math.random（实测 ${countRandom(lr)} 处，未传 rnd 时用常量兜底）`)
  const rrLines = codeOnly(rr).split('\\n').filter(l => /Math\\.random/.test(l))
  ok(countRandom(rr) <= 1 && rrLines.every(l => /typeof\\s+rnd\\s*===\\s*'function'/.test(l)),
    `reviewRate.js 的 Math.random 仅在 rnd 兜底分支（实测 ${countRandom(rr)} 处）`)"""
assert s.count(old) == 1, s.count(old)
s = s.replace(old, new)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('T4 已按实测修正')
