# -*- coding: utf-8 -*-
# W2-1 重新接线（改用单行唯一锚点，避免多行块匹配的脆弱性）
import io, sys

def patch(path, subs, tag):
    s = io.open(path, encoding='utf-8', newline='').read()
    for a, b in subs:
        if a not in s:
            print('MISS %s :: %r' % (tag, a[:70])); sys.exit(1)
        if s.count(a) != 1:
            print('AMBIGUOUS %s :: %r (%d 次)' % (tag, a[:50], s.count(a))); sys.exit(1)
        s = s.replace(a, b, 1)
    io.open(path, 'w', encoding='utf-8', newline='').write(s)
    print('OK ' + tag)

patch('src/settlement.js', [
# 1 import
("import { simulateWeek } from './dayEngine.js'",
 "import { simulateWeek } from './dayEngine.js'\nimport { deptCostWeekly, DEPT_COST_PER_ROOM_DAY } from './deptCosts.mjs'"),
# 2 部门成本
("  // 营销成本 = 做活动才有额外支出",
 "  const dept = deptCostWeekly({ rooms, decisions })\n  const deptCost = dept.total\n\n  // 营销成本 = 做活动才有额外支出"),
# 3 totalCost
("  const totalCost = fixedCost + rentCostWeekly + variableCost + marketingCost",
 "  const totalCost = fixedCost + rentCostWeekly + variableCost + deptCost + marketingCost"),
# 4 gopDeptCost：单行锚点
("  const gopDeptCost = 0",
 "  const gopDeptCost = variableCost + deptCost"),
# 5 netProfit：接在 gopRate 之后
("  const gopRate = revenue > 0 ? gop / revenue : 0",
 "  const gopRate = revenue > 0 ? gop / revenue : 0\n  const netProfit = gop - rentCostWeekly - overbookCompensation - renovationCost - eventFine\n  const netProfitRate = revenue > 0 ? netProfit / revenue : 0"),
# 6 weeklyExpenses：单行锚点（人员工资那一行 → 整块替换需要块，改成分步：先删 4 行）
("    人员工资: Math.round(occupiedRooms * 15 + (decisions.shifts === '满编保服务' ? occupiedRooms * 18 : decisions.shifts === '精简省成本' ? occupiedRooms * 8 : occupiedRooms * 12)),\n", ""),
("    物料消耗: Math.round(occupiedRooms * (decisions.linen === '自洗' ? 8 : 12)),\n", ""),
("    水电能耗: Math.round(occupiedRooms * (energy != null ? (energy - 21) * 3 + 15 : 20)),\n", ""),
("    维修保养: decisions.hygiene === '停房深清洁' ? 3000 : decisions.renovation === '投150万改造' ? 2000 : 500,\n", ""),
("  const weeklyExpenses = {",
 "  const weeklyExpenses = {\n    ...Object.fromEntries(dept.lines.map(l => [l.名称, l.值])),\n    客房变动成本: variableCost,\n    租金: rentCostWeekly,"),
# 7 return 字段
("    gopRate,                    // 0-1",
 "    gopRate,                    // 0-1\n    deptCost,                   // 🔴 W2-1：部门成本（固定/半固定，按可售房）\n    deptCostLines: dept.lines,  // 🔴 W2-1：部门成本拆分\n    netProfit,                  // 🔴 W2-3：净利润（= 既有 profit，正名后显式输出）\n    netProfitRate,              // 0-1"),
], 'settlement.js 接线')

patch('scripts/build-edge-function.mjs', [
("  'serverTick.mjs',", "  'serverTick.mjs',\n  'deptCosts.mjs',"),
], '组装清单加回 deptCosts.mjs')

import os
if os.path.exists('tests/_w2-deptCosts.WIP.mjs'):
    s = io.open('tests/_w2-deptCosts.WIP.mjs', encoding='utf-8', newline='').read()
    i = s.find('// Wave 1 · ') if '// Wave 1 · ' in s else s.find('// Wave 2 · ')
    s = s[i:]
    io.open('tests/deptCosts.test.mjs', 'w', encoding='utf-8', newline='').write(s)
    os.remove('tests/_w2-deptCosts.WIP.mjs')
    print('OK 验收套件已启用')
