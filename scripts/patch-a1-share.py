# -*- coding: utf-8 -*-
# A1：房型「在店 X 间」改为按真实 occRooms 分摊（最大余数法，Σ 严格守恒）
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

a = rep('src/HotelStatus.jsx', [
    # ① 房型结构：在店间数按 occRooms 分摊（写死 0.9/0.75/0.5 的假数据退场）
    ("""      {/* 房型结构（档次越高价格越高，匹配成本） */
      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#A96407', marginBottom: 6 }}>🛏️ 房型结构（共 {rooms} 间）</div>""",
     """      {/* 房型结构（档次越高价格越高，匹配成本）
          🔴 A1（2026-09-22）：「在店 X 间」原为 tp.total × 写死比例(0.9/0.75/0.5)，与真实在店间数
          occRooms 无守恒关系（曾出现"同屏 63 人 vs 36+21+6=63 间"的巧合误导）。
          现按房型总间数比例把 occRooms 分摊到各房型：Σ 各房型在店 === occRooms（严格守恒）。 */}
      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#A96407', marginBottom: 6 }}>🛏️ 房型结构（共 {rooms} 间）</div>"""),
    ("""              <div style={{ fontSize: 9, color: '#9CA3AF' }}>{tp.total} 间 · 在店 {Math.round(tp.total * tp.occRate)}</div>""",
     """              <div style={{ fontSize: 9, color: '#9CA3AF' }}>{tp.total} 间 · 在店 {occByType[idx]}</div>"""),
])

print('\n结果：HotelStatus=' + str(a))
