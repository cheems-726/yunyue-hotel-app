# -*- coding: utf-8 -*-
# W2-1 重新接线（§五）：5 处改动点，与 Wave2-进度报告 §五 逐条对应
import io, sys

def patch(path, subs, tag):
    s = io.open(path, encoding='utf-8', newline='').read()
    for a, b in subs:
        if a not in s:
            print('MISS %s :: %s' % (tag, a[:70])); sys.exit(1)
        s = s.replace(a, b, 1)
    io.open(path, 'w', encoding='utf-8', newline='').write(s)
    print('OK ' + tag)

# ① settlement.js：import + 部门成本 + totalCost + GOP/净利润 + weeklyExpenses + 返回字段
patch('src/settlement.js', [
("import { simulateWeek } from './dayEngine.js'",
 "import { simulateWeek } from './dayEngine.js'\n// 🔴 W2-1（W14）：部门成本科目（按可售房的固定/半固定成本），与 variableCost 计费基数不同、不重复\nimport { deptCostWeekly, DEPT_COST_PER_ROOM_DAY } from './deptCosts.mjs'"),

("  // 营销成本 = 做活动才有额外支出",
 """  // 🔴 W2-1（W14 裁决）：部门成本（固定/半固定，按【可售房】计）——
  //   口径：客房部固定 + 人力固定 + 公区能耗 + 行政管理 + 维修保养
  //   ★ 与 variableCost 的去重：variableCost 随【入住量】发生，本科目按【可售房】发生
  //     （入住率为 0 也照样发生）⇒ 计费基数不同、语义互斥，不重复计。
  //   ★ 目标：部门成本 / 营收 ≈ 45%（与华住 55% 毛利率同口径，不含租金）
  const dept = deptCostWeekly({ rooms, decisions })
  const deptCost = dept.total

  // 营销成本 = 做活动才有额外支出"""),

("  const totalCost = fixedCost + rentCostWeekly + variableCost + marketingCost + otaCommission + overbookCompensation + renovationCost + eventFine",
 "  const totalCost = fixedCost + rentCostWeekly + variableCost + deptCost + marketingCost + otaCommission + overbookCompensation + renovationCost + eventFine"),

("""  const gopDeptCost = 0
  const gop = revenue - (variableCost + marketingCost + otaCommission + gopDeptCost)
  const gopRate = revenue > 0 ? gop / revenue : 0""",
 """  // 🔴 W2-1/W2-3：GOP 口径纳入【部门成本】（variableCost 变动部分 + deptCost 固定部分）
  //   W10 定义：GOP = 营收 − 部门成本 − 营销 − OTA佣金（不含租金 / 加盟费 / 利息）
  const gopDeptCost = variableCost + deptCost
  const gop = revenue - (gopDeptCost + marketingCost + otaCommission)
  const gopRate = revenue > 0 ? gop / revenue : 0
  // 🔴 W2-3（W10 正名）：净利润 = GOP − 租金 − 加盟管理费 − 利息 − 税（后三项未建模）
  //   注意：净利润 === 既有 `profit`（revenue − totalCost）——本次是【正名】，不改数值语义。
  const netProfit = gop - rentCostWeekly - overbookCompensation - renovationCost - eventFine
  const netProfitRate = revenue > 0 ? netProfit / revenue : 0"""),

("""  const weeklyExpenses = {
    人员工资: Math.round(occupiedRooms * 15 + (decisions.shifts === '满编保服务' ? occupiedRooms * 18 : decisions.shifts === '精简省成本' ? occupiedRooms * 8 : occupiedRooms * 12)),
    物料消耗: Math.round(occupiedRooms * (decisions.linen === '自洗' ? 8 : 12)),
    水电能耗: Math.round(occupiedRooms * (energy != null ? (energy - 21) * 3 + 15 : 20)),
    维修保养: decisions.hygiene === '停房深清洁' ? 3000 : decisions.renovation === '投150万改造' ? 2000 : 500,
    营销推广: marketingCost || 0,
    OTA佣金: otaCommission || 0,
    超售赔偿: overbookCompensation || 0,
    事件罚款: eventFine || 0,
  }""",
 """  // 🔴 W2-1：成本构成改为【与 totalCost 同源】——
  //   原先这组数字是【另一套公式】且漏掉租金与改造投资 ⇒ "成本构成合计 ≠ 引擎总成本"，学生对不上账。
  //   现在逐项来自引擎真实科目，合计 === totalCost（有断言守着）。
  const weeklyExpenses = {
    ...Object.fromEntries(dept.lines.map(l => [l.名称, l.值])),
    客房变动成本: variableCost,
    租金: rentCostWeekly,
    营销推广: marketingCost || 0,
    OTA佣金: otaCommission || 0,
    超售赔偿: overbookCompensation || 0,
    改造投资: renovationCost || 0,
    事件罚款: eventFine || 0,
  }"""),

("""    gop,                        // 🔴 T1.4/B3：经营毛利（不含租金/加盟费/利息）
    gopRate,                    // 0-1""",
 """    gop,                        // 🔴 T1.4/B3：经营毛利（不含租金/加盟费/利息）
    gopRate,                    // 0-1
    deptCost,                   // 🔴 W2-1：部门成本（固定/半固定，按可售房）
    deptCostLines: dept.lines,  // 🔴 W2-1：部门成本拆分（三件套见 src/deptCosts.mjs）
    netProfit,                  // 🔴 W2-3：净利润（= 既有 profit，正名后显式输出）
    netProfitRate,              // 0-1"""),
], '① settlement.js 接线（5 处）')

# ② 组装清单加回 deptCosts（现在真的被引用了）
patch('scripts/build-edge-function.mjs', [
("  'serverTick.mjs',", "  'serverTick.mjs',\n  'deptCosts.mjs',"),
], '② 组装清单加回 deptCosts.mjs')

# ③ 启用 W2-1 验收套件
import os
if os.path.exists('tests/_w2-deptCosts.WIP.mjs'):
    s = io.open('tests/_w2-deptCosts.WIP.mjs', encoding='utf-8', newline='').read()
    s = s.replace('// ⚠️【WIP · 未挂门禁】W2-1 的验收套件 —— 仅在 settlement.js 接上部门成本后才通过。\n//   当前 W2-1 已按 §二十一 回滚接线（保留 src/deptCosts.mjs 设计+标定），故本文件暂不进门禁。\n//   启用条件：接线 + 配套重基线完成（见 4-审计与报告/Wave2-进度报告.md）。\n', '')
    io.open('tests/deptCosts.test.mjs', 'w', encoding='utf-8', newline='').write(s)
    os.remove('tests/_w2-deptCosts.WIP.mjs')
    print('OK ③ W2-1 验收套件已启用（tests/deptCosts.test.mjs）')
else:
    print('skip ③ WIP 套件不存在（已启用过）')
