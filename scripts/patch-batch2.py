# -*- coding: utf-8 -*-
# Batch2：T3 三条假绿断言替换 + T4 评价相关模块"随机源纪律"源码级断言
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

# ── T3-1：guests.test.mjs 恒真式 → 真实校验 ──
a = rep('tests/guests.test.mjs', [
    ("""const personaHit = new Set(texts.map((_, i) => i)).size
ok(personaHit === 10, '10 条均成功生成')""",
     """// 🔴 原写法 `new Set(texts.map((_, i) => i)).size === 10` 是恒真式（下标集大小必为 10）——
//    见《测试质量审计》附录"假绿 + 功能失效互相掩护"典型案例。改成真有判别力的校验：
const genBad = texts.filter(t => typeof t !== 'string' || t.length < 12 || /undefined|NaN|\\[object/.test(t))
ok(texts.length === 10 && genBad.length === 0,
  `10 条均真实生成且无脏内容（条数 ${texts.length}，脏 ${genBad.length}，最短 ${Math.min(...texts.map(t => String(t).length))} 字）`)"""),
])

# ── T3-2：liveReview.test.mjs 近似恒真 → 补非空 + 口径交叉校验 ──
b = rep('tests/liveReview.test.mjs', [
    ("""  ok(neg + pos === cls.n, `实时条数可按星级拆分（差 ${neg} + 好 ${pos} = ${cls.n}）← App 传给 settle 的 liveNeg/livePos`)""",
     """  ok(cls.n > 0 && neg + pos === cls.n, `实时条数可按星级拆分（差 ${neg} + 好 ${pos} = ${cls.n}）← App 传给 settle 的 liveNeg/livePos`)
  // 交叉校验：App 用 stars 判 liveNeg/livePos，而卡片 status 也必须同口径（否则两处会自相矛盾）
  ok(cls.list.every(e => (Number(e.stars) <= 3) === (e.status === 'pending')),
    '星级与状态口径一致（≤3 星 ⇔ pending / ≥4 星 ⇔ good）')"""),
])

# ── T3-3：verify-severity.mjs 空数组 .every 恒真 → 仅在真有 no_room 卡时断言 ──
c = rep('tests/verify-severity.mjs', [
    ("""  const noRoom = neg.filter(x => x.cause === 'no_room')
  ok(noRoom.every(x => x.stars === 1), `${name}：到店无房差评恒 1 星（${noRoom.length} 条）`)""",
     """  const noRoom = neg.filter(x => x.cause === 'no_room')
  // 🔴 原写法对空数组恒真（实测 3 组里 2 组"0 条"空转通过）→ 改为"真有才断言，没有就明说跳过"
  if (noRoom.length) ok(noRoom.every(x => x.stars === 1), `${name}：到店无房差评恒 1 星（${noRoom.length} 条）`)
  else console.log(`     （${name} 本季无 no_room 卡 → 该断言跳过，不计入通过数）`)"""),
])

# ── T4：评价相关模块的随机源纪律（源码级）──
d = rep('tests/guests.test.mjs', [
    ("""console.log('\\n[严重度] reviewSeverityOf')""",
     """// ── T4：随机源纪律（源码级）——评价相关模块不得偷偷用全局 Math.random ──
console.log('\\n[随机源纪律] 评价相关模块不得依赖 Math.random')
{
  const read = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')
  const codeOnly = (src) => src.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '').split('\\n').map(l => l.replace(/\\/\\/.*$/, '')).join('\\n')
  const g = codeOnly(read('guests.js'))
  const rr = codeOnly(read('reviewRate.js'))
  ok(!/Math\\.random/.test(g), 'guests.js 无 Math.random（自带 guestsRng 独立流）')
  ok(!/Math\\.random/.test(rr), 'reviewRate.js 无 Math.random（纯概率计算）')
  // liveReview.js 允许 1 处，且必须只是"未传 rnd"时的兜底（关键路径由调用方传独立流）
  const lr = codeOnly(read('liveReview.js'))
  const hits = (lr.match(/Math\\.random/g) || []).length
  const hitLines = lr.split('\\n').filter(l => /Math\\.random/.test(l))
  ok(hits === 1 && hitLines.every(l => /typeof\\s+rnd\\s*===\\s*'function'/.test(l)),
    `liveReview.js 仅 1 处 Math.random 且位于 rnd 兜底分支（实测 ${hits} 处）`)
}

console.log('\\n[严重度] reviewSeverityOf')"""),
])

print('\n结果：T3-1=' + str(a) + ' T3-2=' + str(b) + ' T3-3=' + str(c) + ' T4=' + str(d))
