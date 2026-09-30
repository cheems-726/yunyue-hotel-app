// 一次性：TDZ 修复（用完即删）—— 危机事件推入延后到 events 声明后
import { readFileSync, writeFileSync } from 'node:fs'
const p = 'D:/教学app/hotel-app/src/settlement.js'
let t = readFileSync(p, 'utf8')

const 旧块 = `if (hotPen.occMul !== 1) {
    occupancy = Math.max(occupancy * hotPen.occMul, 0.3)
    addEvent({ type: 'crisis', icon: '📉', name: '舆情危机期·客流大跌', text: \`差评上热门的持续影响：本周出租率 −\${Math.round(HOT_REVIEW_CONFIG.occPenalty * 100)}%（危机期内每周如此）\`, impact: \`出租率 −\${Math.round(HOT_REVIEW_CONFIG.occPenalty * 100)}%\`, tip: '处理差评 + 老师裁量是唯二出路；危机期结束自动恢复' })
  }`
const 新块 = `if (hotPen.occMul !== 1) {
    occupancy = Math.max(occupancy * hotPen.occMul, 0.3)
    hotActiveThisWeek = true   // ★ 事件推入延后（events 数组在下方才声明 ⇒ 此处只记标志，防 TDZ）
  }`
if (!t.includes(旧块)) { console.log('❌ 旧块未命中'); process.exit(1) }
t = t.replace(旧块, 新块)

const 声明锚 = "  const hotPen = hotCrisisPenalties(hotState, week)\n"
if (!t.includes(声明锚)) { console.log('❌ hotPen 声明锚未命中'); process.exit(1) }
t = t.replace(声明锚, 声明锚 + "  let hotActiveThisWeek = false   // §32-U1 R2：危机周标志（事件在 events 声明后统一补推）\n")

const events锚 = "const events = []\n"
if (!t.includes(events锚)) { console.log('❌ events 锚未命中'); process.exit(1) }
t = t.replace(events锚, events锚 + "if (hotActiveThisWeek) addEvent({ type: 'crisis', icon: '📉', name: '舆情危机期·客流大跌', text: '差评上热门的持续影响：本周出租率 −30%（危机期内每周如此）', impact: '出租率 −30%', tip: '处理差评 + 老师裁量是唯二出路；危机期结束自动恢复' })\n")

writeFileSync(p, t, 'utf8')
console.log('✓ TDZ 修复（标志延后推事件）')
