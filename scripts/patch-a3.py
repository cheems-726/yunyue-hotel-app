# -*- coding: utf-8 -*-
# A3：房量唯一权威 = 引擎 parseRooms(brand.standard)
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

# ① 引擎导出 parseRooms
a = rep('src/settlement.js', [
    ("function parseRooms(standardStr) {",
     "export function parseRooms(standardStr) {   // A3：导出供界面复用（房量唯一权威 = 品牌标准口径）"),
])

# ② HotelStatus：rooms 改为品牌口径
b = rep('src/HotelStatus.jsx', [
    ("import { getTitle } from './hotelTitle.js'",
     "import { getTitle } from './hotelTitle.js'\nimport { parseRooms } from './settlement.js'"),
    ("  const rooms = report?.rooms || (property?.rooms && Number(property.rooms.match(/(\\d+)/)?.[1])) || 70",
     "  // A3：房量唯一权威 = 引擎 parseRooms(brand.standard)（与结算同源）。原先结算前用 property.rooms\n  //  （72-95 的\"建筑面积\"话术）、结算后用引擎值 → 「共 X 间」跳变。物业匹配记为二期教学点。\n  const rooms = report?.rooms || parseRooms(brand?.standard) || 70"),
])

# ③ Establishment：投资测算同口径
c = rep('src/Establishment.jsx', [
    ("import { useState } from 'react'",
     "import { useState } from 'react'\nimport { parseRooms } from './settlement.js'"),
    ("              const rooms = (property?.rooms && Number(property.rooms.match(/(\\d+)/)?.[1])) || 70",
     "              const rooms = parseRooms(brand?.standard) || 70   // A3：与结算同源（品牌口径）"),
])

# ④ Claim 物业卡片文案话术化（展示保留、口径讲清）
d = rep('src/Claim.jsx', [
    ("{ name: '社区旁物业', type: '社区型', area: '2600㎡', rooms: '72间', rent: '中等', match: '高' },",
     "{ name: '社区旁物业', type: '社区型', area: '2600㎡', rooms: '72间', rent: '中等', match: '高', note: '可排客房按品牌标准（约50-80间）' },"),
    ("{ name: '交通枢纽物业', type: '枢纽型', area: '3000㎡', rooms: '80间', rent: '低', match: '高' },",
     "{ name: '交通枢纽物业', type: '枢纽型', area: '3000㎡', rooms: '80间', rent: '低', match: '高', note: '可排客房按品牌标准（约50-80间）' },"),
    ("{ name: '商务区物业', type: '商圈型', area: '2800㎡', rooms: '75间', rent: '高', match: '中' },",
     "{ name: '商务区物业', type: '商圈型', area: '2800㎡', rooms: '75间', rent: '高', match: '中', note: '可排客房按品牌标准（约50-80间）' },"),
])

print('\n结果：engine=' + str(a) + ' hotel=' + str(b) + ' est=' + str(c) + ' claim=' + str(d))
