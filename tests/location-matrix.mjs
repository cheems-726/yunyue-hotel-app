// 选址 × 策略 可行性矩阵：找出"死亡选址"（勤奋策略也持续大亏的区县）
import { settle } from '../src/settlement.js'
import { districts } from '../src/siteLocations.mjs'

const BRANDS = [
  { name: '汉庭', price: '180-280元', standard: '客房70间起', level: '经济型 · 国民' },
  { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' },
]

const DILIGENT = { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'member-convert': '强调品质', corporate: '让利签约', 'member-threshold': 5, energy: 23, overbook: 2, ota: {}, reputation: '道歉+赔偿', 'hr-optimize': '全员培训' }
const LAZY = {}

let rows = []
let 超档拦截 = 0
for (const [city, list] of Object.entries(districts)) {
  for (const d of list) {
    for (const brand of BRANDS) {
      let prev = null, total = 0
      let 超档 = false
      for (let w = 1; w <= 12; w++) {
        // 🔴 2026-09-27：把 district 传进引擎 —— 不改的话本套件模拟的是"竞品/客群失效"的旧路径，
        //   与真机行为不符（真机已修：App 传 district）。矩阵必须模拟【真实路径】。
        let r
        try {
          r = settle({ site: { ...d.attrs, district: d.name }, brand, decisions: DILIGENT, week: w, prevGoodRate: prev })
        } catch (e) {
          // ★ V14批1-M2 活案例修复：A1 等级限制 throw（超档开店被引擎拒绝 = 正确产品行为）——
          //   本套件曾因 knownRed 豁免而**掩盖了"启动即崩"**（0.4s 退出 · 无计数行）。
          //   口径：超档组合 = 教学语义上【不该开的组合】⇒ 排除出矩阵（不进分母/分子），单独计数留痕。
          if (String(e.message).includes('等级限制')) { 超档 = true; break }
          throw e
        }
        prev = r.finalGoodRate
        // ★ §22.2-B2（2026-09-29）：本矩阵量的是【选址 × 策略的经营可行性】——
        //   开业一次性费用（week1 收）与保证金退还（week12 退）是**期初一次性的钱**，
        //   不属于"这个区县经营得好不好" ⇒ 计入会污染指标（实测：含开办费 78.8% vs 剔除后 46.2%）。
        //   ⇒ 累计值按【经营口径】剔除（净额加回）；口径仍走引擎实收（oneTimeFees 单源），不改引擎。
        //   ★ 阈值与判据一个字没改（46.2% 与 B2 前"死亡选址"完全同口径可比）。
        total += r.profit + (r.oneTimeFees ? r.oneTimeFees.开业费用 - r.oneTimeFees.保证金退还 : 0)
      }
      if (超档) { 超档拦截++; continue }
      rows.push({ loc: `${city}·${d.name}`, brand: brand.name, profit: total })
    }
  }
}

// 输出最差12个组合
rows.sort((a, b) => a.profit - b.profit)
console.log('最差12个组合（勤奋策略12周）:')
rows.slice(0, 12).forEach(r => console.log(`  ${r.loc} [${r.brand}] ${r.profit >= 0 ? '+' : ''}${r.profit} 元`))
const dead = rows.filter(r => r.profit < -20000)
console.log(`\n重亏组合（<-2万）: ${dead.length}/${rows.length}`)
console.log(`超档自动不可行（A1 拦截 · 排除出矩阵）: ${超档拦截} 组`)
// ★ V14批1-M2：补断言计数行（本套件原只有 exit 1 无"X 通过 / Y 失败" ⇒ run-all 解析不出 fail ⇒
//   perSuite 无基线 ⇒ M2 豁免边界对本套件失效）。断言本体一个字没改 —— 只加汇总行。
const 断言总数 = rows.length
const 断言失败 = dead.length            // 每个重亏组合 = 1 条"该选址不可行"失败断言（knownRed 口径不变）
console.log(`\n结果: ${断言总数 - 断言失败} 通过 / ${断言失败} 失败`)
if (dead.length > rows.length * 0.15) {
  console.error('❌ 死亡选址过多（>15%），需要调整租金成本曲线')
  process.exit(1)
}
console.log('✅ 可行性检查完成')
