// V113-0.2 判据：**五类投资档位价目齐全**（装修/软装/IT/布草/开办费 × 低/中/高）
//   反例 RV（可证伪）：把任一附加项的比例删掉一档 ⇒ 该档金额 null ⇒ 本套件红；
//                  把装修系数改成非递增（低≥中）⇒ 单调性红；
//                  给无造价品牌补算 ⇒ "缺来源必须待补"红。
import { 档位价目, 投资测算, 档位名, 附加项 } from '../src/establishmentInvest.mjs'
import { FRANCHISE_MODEL } from '../src/franchiseModel.mjs'

const bad = []
let 检查数 = 0
const ok = (cond, msg) => { 检查数++; if (!cond) bad.push(msg) }

const 汉庭 = { name: '汉庭', level: '经济型', standard: '客房70间起' }
const 价 = 档位价目({ brand: 汉庭 })

ok(价.齐全 === true, '有官方单房造价的品牌 ⇒ 价目应齐全')
ok(价.装修.length === 3 && 价.装修.every(x => 档位名.includes(x.档) && x.金额 > 0), '装修档 应 低/中/高 三档均有金额')
ok(价.附加.length === 附加项.length, `附加项应覆盖全部 ${附加项.length} 类（实得 ${价.附加.length}）`)
// 五类 = 装修 + 4 个附加项
ok(1 + 价.附加.length === 5, `五类档位（装修+软装+IT+布草+开办费）应齐（实得 ${1 + 价.附加.length} 类）`)
for (const a of 价.附加) {
  ok(a.档位.length === 3, `${a.key} 应有 低/中/高 三档`)
  ok(a.档位.every(x => Number.isFinite(x.金额) && x.金额 > 0), `${a.key} 每档都应有金额`)
  const [低, 中, 高] = a.档位.map(x => x.金额)
  ok(低 < 中 && 中 < 高, `${a.key} 档位金额应递增（${低}/${中}/${高}）`)
}
{
  const [低, 中, 高] = 价.装修.map(x => x.金额)
  ok(低 < 中 && 中 < 高, `装修档 金额应递增（${低}/${中}/${高}）`)
}

// 单源：价目表的"装修=中"必须 === 投资测算(选择装修=中) 的装修金额
{
  const 测 = 投资测算({ brand: 汉庭, 选择: { 装修: '中', 软装: '中', IT: '中', 布草: '中', 开办费: '中' } })
  const 价中 = 价.装修.find(x => x.档 === '中').金额
  ok(测.明细[0].金额 === 价中, `价目表与投资测算同源（测算 ${测.明细[0].金额} vs 价目 ${价中}）`)
  // 附加项基数 = 装修=中 的额 ⇒ 在"装修=中"组合下，两者应逐项相等
  for (const it of 测.明细.slice(1)) {
    const 价项 = 价.附加.find(a => a.key === it.key)
    const 价中项 = 价项 && 价项.档位.find(x => x.档 === '中').金额
    ok(价中项 === it.金额, `${it.key}：价目(中) 应 === 测算金额（${价中项} vs ${it.金额}）`)
  }
}

// 缺来源 ⇒ 全部 null + 待补文案（不编）
{
  const 无造价 = { name: '不存在的品牌', level: '中档', standard: '客房70间起' }
  const q = 档位价目({ brand: 无造价 })
  ok(q.齐全 === false, '无单房造价 ⇒ 齐全应为 false')
  ok(q.装修.every(x => x.金额 == null) && q.附加.every(a => a.档位.every(x => x.金额 == null)), '无造价 ⇒ 各档金额必须为 null（不编）')
  ok(q.待补.length > 0 && /单房造价/.test(q.待补.join('')), '无造价 ⇒ 待补文案须点名缺"单房造价"')
}

// 有造价品牌的数量（供报告引用；只报不判）
const 有造价 = Object.keys(FRANCHISE_MODEL).filter(n => FRANCHISE_MODEL[n]?.单房造价?.新建?.值)
console.log('══ V113-0.2 投资档位价目明细 ══')
console.log(`  汉庭 70 间：${价.装修.map(x => x.档 + ' ' + (x.金额 / 10000).toFixed(1) + '万').join(' / ')}（装修）`)
console.log(`  附加项：${价.附加.map(a => a.key + '（' + a.档位.map(x => (x.金额 / 10000).toFixed(1)).join('/') + '万）').join(' · ')}`)
console.log(`  有官方单房造价的品牌：${有造价.length} 家 · ${检查数} 条判据`)
for (const b of bad.slice(0, 8)) console.log('  ✗ ' + b)
console.log(`结果: ${检查数 - bad.length} 通过 / ${bad.length} 失败`)
process.exit(bad.length === 0 ? 0 : 1)
