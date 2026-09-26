# R0 收尾轮：① 系数斜率减半 ② 接 applyWeeklyDecay（settlement.js，LF 文件）
import io

P = 'src/settlement.js'
s = io.open(P, encoding='utf-8', newline='').read()

def rep(old, new, tag):
    global s
    assert old in s, f'{tag} 锚点未命中'
    s = s.replace(old, new, 1)
    print(f'  ✓ {tag}')

# ── ① 斜率系数 + 两个乘数改为斜率减半形式 ──
rep("""const CAC_BASE = 1.2   // cacFactor 中性基准""",
"""const CAC_BASE = 1.2   // cacFactor 中性基准

// 斜率系数（可调）：属性影响幅度 = 规格原幅度 × ATTR_SLOPE
//   0.5 = 幅度减半（当前采用：差距适中才有"中盘调整"的教学空间；差距过大→省钱型追不回→直接摆烂）
//   1.0 = 规格原幅度
// 只作用于两个【客流乘数】（priceTolerance / occFactor）；morale、negFactor、cacFactor 走口碑/成本链，幅度本就温和，不动
const ATTR_SLOPE = 0.5""", '① ATTR_SLOPE 常量')

rep("""// 品质 → 房价容忍度（客流乘数）：quality 100 → +10.5%，quality 20 → −10.5%
function priceToleranceOf(quality) {
  return (0.95 + (quality - 60) / 400) / PT_BASE
}""",
"""// 品质 → 房价容忍度（客流乘数）：斜率减半后 quality 100 → +5.3%，quality 20 → −5.3%
function priceToleranceOf(quality) {
  return 1 + ((0.95 + (quality - 60) / 400) / PT_BASE - 1) * ATTR_SLOPE
}""", '① priceTolerance 斜率减半')

rep("""// 声誉 → 出租率基线：reputation 100 → +13.3%，reputation 20 → −22.2%
function occFactorOf(reputation) {
  return (0.9 + (reputation - 70) / 250) / OCC_BASE
}""",
"""// 声誉 → 出租率基线：斜率减半后 reputation 100 → +6.7%，reputation 20 → −11.1%
function occFactorOf(reputation) {
  return 1 + ((0.9 + (reputation - 70) / 250) / OCC_BASE - 1) * ATTR_SLOPE
}""", '① occFactor 斜率减半')

# ── ② import applyWeeklyDecay ──
rep("import { applyEventToAttrs, normalizeAttrs } from './attrs.js'",
    "import { applyEventToAttrs, applyWeeklyDecay, normalizeAttrs } from './attrs.js'", '② import applyWeeklyDecay')

# ── ③ 事件块之后接衰减 ──
rep("""    attrsAfter = mid
    if (changed) eventAttrEffects.push({ name: ev.name, icon: ev.icon || '', deltas: ev.deltas || deltas })
  }""",
"""    attrsAfter = mid
    if (changed) eventAttrEffects.push({ name: ev.name, icon: ev.icon || '', deltas: ev.deltas || deltas })
  }

  // ⑨ 每周自然衰减（规格 §7）：品质按品牌档次衰减 / 声誉 -1 + 品质惩罚 / 士气 -1，下限 20
  //    调用 attrs.js 的验证过的纯函数（不在此重写逻辑）；结果体现在返回的 attrsAfter
  const attrsAfterDecay = applyWeeklyDecay(attrsAfter, brand && brand.level)""", '③ 接 applyWeeklyDecay')

# 返回字段：attrsAfter 用衰减后的值（并保留衰减前值便于对照）
rep("""    // 属性池：本周事件对属性的影响 + 结算后属性（周报展示用；旧调用方忽略即可）
    eventAttrEffects,
    attrsAfter,""",
"""    // 属性池：本周事件对属性的影响 + 结算后属性（含每周自然衰减；周报展示用；旧调用方忽略即可）
    eventAttrEffects,
    attrsAfter: attrsAfterDecay,
    attrsAfterEvents: attrsAfter,   // 衰减前的值（便于对照"事件影响 vs 自然衰减"）""", '③ 返回字段')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('✅ ①②③ 完成')
