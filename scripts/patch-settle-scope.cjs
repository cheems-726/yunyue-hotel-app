// -*- coding: utf-8 -*-
// 修：doSettle 里 reviews 越界（结算生成卡片从未入库）+ E2E 断言加强（防同类潜伏）
const fs = require('fs')
function patch(path, pairs) {
  let raw = fs.readFileSync(path, 'utf8')
  const crlf = raw.split('\r\n').length - 1
  const nl = crlf > 0 && crlf > raw.split('\n').length - 1 - crlf ? '\r\n' : '\n'
  let ok = true
  pairs.forEach(([o, n], i) => {
    const ot = o.split('\n').join(nl), nt = n.split('\n').join(nl)
    const c = raw.split(ot).length - 1
    if (c !== 1) { console.log(`  x ${path} 锚点${i + 1} 命中 ${c} 次：${ot.split(nl)[0].slice(0, 56)}`); ok = false; return }
    raw = raw.split(ot).join(nt)
    console.log(`  v ${path} 锚点${i + 1}：${ot.split(nl)[0].slice(0, 56)}`)
  })
  if (!ok) { console.log(`  -> 未写盘 ${path}`); return false }
  fs.writeFileSync(path, raw, 'utf8')
  console.log(`  -> 已写盘 ${path}`)
  return true
}

const A = patch('src/App.jsx', [[
`  function doSettle() {
    const site = location?.attrs || { 客流: 3 }
    // 读取口碑页差评状态：未处理数压口碑，已整改数给奖励
    let pendingNegatives = 0
    let resolvedCount = 0
    let liveNegCount = 0
    let livePosCount = 0
    try {
      const reviews = JSON.parse(localStorage.getItem('hotel-sim-reviews') || '[]')
      pendingNegatives = reviews.filter(r => r.status === 'pending' || r.status === 'ignored').length`,
`  function doSettle() {
    const site = location?.attrs || { 客流: 3 }
    // 口碑页数据读一次，供本函数全程使用。
    // 🔴 历史 bug：原先 reviews 声明在下方第一个 try 内部，而"结算卡片入库"那段在另一个 try 里引用它
    //    → ReferenceError 被自己的 catch(e){} 吞掉 → **结算生成的评价卡片从未写进口碑页**（潜伏已久，
    //    2026-09-22 因 bizMode 激活后出现真差评、断言才暴露）。作用域提到函数顶层，杜绝复发。
    let reviews = []
    try { reviews = JSON.parse(localStorage.getItem('hotel-sim-reviews') || '[]') } catch (e) { reviews = [] }
    // 读取口碑页差评状态：未处理数压口碑，已整改数给奖励
    let pendingNegatives = 0
    let resolvedCount = 0
    let liveNegCount = 0
    let livePosCount = 0
    try {
      pendingNegatives = reviews.filter(r => r.status === 'pending' || r.status === 'ignored').length`],
])

const B = patch('tests/verify-live-review-ui.mjs', [[
`    console.log('    [本周卡片明细] ' + card.map(r => \`\${r.id}/\${r.live ? 'live' : 'settle'}/⭐\${r.stars}/\${r.status}\`).join('  '))
    const negCards = card.filter(r => Number(r.stars) <= 3).length
    ok(\`【数字=卡片】本周差评卡 \${negCards} 张 === 周报差评数 \${m[2]}（不封顶 → 恒等）\`, negCards === Number(m[2]))
    const surge = card.length - Number(m[1])
    ok(\`【守恒】本周卡片 \${card.length} 张 = 评价数 \${m[1]} + 口碑爆发追加 \${surge}（0~2）\`, surge >= 0 && surge <= 2)
    ok('实时卡片未被结算覆盖（仍在库里）', card.some(r => r.live))`,
`    console.log('    [本周卡片明细] ' + card.map(r => \`\${r.id}/\${r.live ? 'live' : 'settle'}/⭐\${r.stars}/\${r.status}\`).join('  '))
    const negCards = card.filter(r => Number(r.stars) <= 3).length
    const settleCards = card.filter(r => !r.live)
    // ⚠️ 新增（2026-09-22）：证明"结算差额卡片确实入库了"——旧断言在差评数为 0 时空转通过（假绿），
    //    曾让"结算卡片从未入库"的越界 bug 潜伏至今
    ok(\`结算差额卡片已入库（\${settleCards.length} 张，differential 生成）\`,
      settleCards.length > 0 || (Number(m[1]) === 0 && Number(m[2]) === 0))
    ok(\`【数字=卡片】本周差评卡 \${negCards} 张 === 周报差评数 \${m[2]}（不封顶 → 恒等）\`, negCards === Number(m[2]))
    // 口碑爆发会上浮；另外"实时好评数 > 目标好评数"时实时会多送（设计如此：实时已足够则不重复生成），
    // 故总数取 >= 口径，并单独断言"结算补的差评一张不少"
    const surge = card.length - Number(m[1])
    ok(\`【守恒】本周卡片 \${card.length} 张 ≥ 评价数 \${m[1]}（差额生成；口碑爆发追加 \${surge}）\`, card.length >= Number(m[1]) && surge >= 0)
    ok('实时卡片未被结算覆盖（仍在库里）', card.some(r => r.live))`],
])

console.log(`\n结果：App=${A} E2E=${B}`)
process.exit(A && B ? 0 : 1)
