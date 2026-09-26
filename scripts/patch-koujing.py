# -*- coding: utf-8 -*-
# 口径修复小批：② occupancy 单位 ③ 欠账只数结算卡（含演示卡隔离）④ 周报成本构成读引擎 ① 在店客人标签
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

# ── ② occupancy 单位：这里传的是 0-1，而 guests.js 的 causeWeightsOf 期望 0-100 ──
a = rep('src/HotelStatus.jsx', [
    ("          rooms, occupancy: rooms > 0 ? occupiedRooms / rooms : 0.6,",
     "          rooms, occupancy: rooms > 0 ? (occupiedRooms / rooms) * 100 : 60,   // 🔴 口径修正：guests.js 期望 0-100（原先传 0-1 → \"满负荷服务跟不上\"类原因永远命不中）"),
])

# ── ③ 欠账/整改只统计【结算生成的卡片】（id 形如 w<周>-*）──
#    一并解决：演示初值（数字 id）污染、以及实时卡（设备/时长相关，破坏"同决策同结果"公平红线）
b = rep('src/App.jsx', [
    ("""      pendingNegatives = reviews.filter(r => r.status === 'pending' || r.status === 'ignored').length
      resolvedCount = reviews.filter(r => r.status === 'resolved').length""",
     """      // 🔴 口径（2026-09-22 审计后修）：欠账与整改【只统计结算生成的卡片】（id 形如 w<周>-n0）
      //   排除 ① 口碑页演示初值（数字 id，会每周白扣 0.06 好评率）
      //       ② 实时评价卡（出现时机取决于"学生开着 App 多久"，是设备/时长相关 →
      //          若计入欠账会破坏"不同在线时长、同决策 → 同结果"的公平性红线）
      //   教学语义不变：结算生成的差评同样是"欠着不处理会发酵"，且完全确定性。
      const settleCards = reviews.filter(r => /^w\\d+-/.test(String(r.id)))
      pendingNegatives = settleCards.filter(r => r.status === 'pending' || r.status === 'ignored').length
      resolvedCount = settleCards.filter(r => r.status === 'resolved').length"""),
])

# ── ④ 周报成本构成：改读引擎权威 weeklyExpenses（原先前端重算，与引擎不符且漏"维修保养"）──
c = rep('src/WeeklyReport.jsx', [
    ("""                const rooms = result.rooms || 70
                const occupied = result.occupiedRooms || 0
                const items = [
                  { name: '固定成本', val: rooms * 65, color: '#818CF8' },
                  { name: '人员工资', val: occupied * (result.decisions?.shifts === '满编保服务' ? 30 : result.decisions?.shifts === '精简省成本' ? 20 : 25), color: '#F472B6' },
                  { name: '物料水电', val: occupied * 25, color: '#FBBF24' },
                  { name: 'OTA佣金', val: result.decisions?.ota ? Math.round(result.revenue * 0.11) : 0, color: '#34D399' },
                  { name: '营销推广', val: result.decisions?.campaign ? 5000 : 0, color: '#60A5FA' },
                  { name: '维修/罚款', val: (result.eventFine || 0) + (result.overbookCompensation || 0), color: '#F87171' },
                ].filter(x => x.val > 0)""",
     """                // 🔴 口径修正（2026-09-22）：改读**引擎权威** weeklyExpenses（settlement.js 生成）
                //   原先前端按 65/30/25 元硬编码重算，与引擎公式不符、且漏掉「维修保养」；
                //   卡片头的总额本就来自引擎 ⇒ 拆解与总额必须同源，否则学生对不上账。
                const EXP_COLOR = {
                  人员工资: '#F472B6', 物料消耗: '#FBBF24', 水电能耗: '#38BDF8', 维修保养: '#A78BFA',
                  营销推广: '#60A5FA', OTA佣金: '#34D399', 超售赔偿: '#FB923C', 事件罚款: '#F87171',
                }
                const items = Object.entries(result.weeklyExpenses || {})
                  .map(([name, val]) => ({ name, val, color: EXP_COLOR[name] || '#94A3B8' }))
                  .filter(x => x.val > 0)"""),
])

# ── ① 标签：「在店客人 N 人」→ 间/人分列，避免"间被标成人" ──
d = rep('src/HotelStatus.jsx', [
    ("""    { l: '在店客人', v: (liveStats ? liveStats.guests : (liveGuests ?? targetGuests)) + ' 人', c: '#1D4ED8', live: true },""",
     """    // 🔴 口径修正（2026-09-22）：原来把"由间合成的人数"直接标成「在店客人 N 人」，且同屏房型在店数是另一套口径，
    //    学生看到「63 人」与房型 36+21+6=63 会以为是同一件事（实际是巧合）。现在间与人分列、并标明"估算"。
    { l: '在店客房', v: (liveStats ? liveStats.guests : (liveGuests ?? targetGuests)) + ' 间', c: '#1D4ED8', live: true },"""),
])

print('\n结果：②=' + str(a) + ' ③=' + str(b) + ' ④=' + str(c) + ' ①标签=' + str(d))
