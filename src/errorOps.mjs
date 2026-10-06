// V39 · 教师端「错误操作高亮」规则单源（纯函数 · 判据先行 · 批1 写死后才有的实现）
// 需求原文（模块六-5）：老师后台可查看各组错误操作（乱定价、乱招人、乱选址）。
// 与既有「亏损周」标签的关系：亏损周 = 结果维（净利<0）；本模块 = 行为维（决策本身错在哪）· 不同轴互补。
// ★ 规则阈值全部有依据（卡内红线：不许凭感觉）· 每条依据随返回值走（UI 悬停可读）。

// 依据基线：
//   · 消费力代理 = 150 + 房价档 × 30（V46 零单同源 · settlement.js 缺口②段）
//   · 45 = 四维评分出租率最低带下沿（metricDefs.mjs occupancyScore 阶梯 45/55/65/75）
//   · 260 = 品牌带中档下沿分界（汉庭 230 之下 · 全季 280 之上）
export function 错误操作标记({ pricing, price, 房价档, shifts, occupancy, brandBasePrice }) {
  const out = []
  const 档 = Number.isFinite(Number(房价档)) ? Number(房价档) : 3
  // ① 乱定价：提价远超区域消费力 ⇒ 引擎已判「直接零单」（出租率钳 3%）
  if (typeof pricing === 'string' && pricing.startsWith('提价') && Number.isFinite(Number(price))) {
    const 消费力 = 150 + 档 * 30
    if (price / 消费力 >= 2) {
      out.push({ 类别: '乱定价', 标签: `零单断崖定价（${pricing}）`, 依据: `有效价 ${price} ÷ 区域消费力 ${消费力} ≥ 2 ⇒ 引擎已触发零单断崖（出租率钳 3% · 需求 3.2-5 · V46 机制）` })
    }
  }
  // ② 乱招人：低入住还付满编人力（编制远超出租率需求）。反向（≥85% 还精简）已由引擎「满负荷·响应慢」事件管辖 ⇒ 不重复。
  if (shifts === '满编保服务' && Number.isFinite(Number(occupancy)) && occupancy < 45) {
    out.push({ 类别: '乱招人', 标签: `低入住满编（${occupancy}%）`, 依据: `出租率 ${occupancy}% 低于四维评分最低带 45% 仍选满编保服务 —— 人力成本超出收入承载力（精简省成本可省 · 需求 5.1 编制匹配）` })
  }
  // ③ 乱选址：中高档错配低消费区（硬禁由 tierLimit throw 承担 ⇒ 本规则覆盖"合法但错"的灰区）
  if (Number.isFinite(Number(brandBasePrice)) && brandBasePrice >= 260 && 档 <= 2) {
    out.push({ 类别: '乱选址', 标签: `高档错配低消区`, 依据: `品牌基准价 ${brandBasePrice} 元落进房价档 ${档}（消费力代理 ${150 + 档 * 30}）的低消费区 —— 涨价空间全无、错配断崖风险（需求 1.2-6 · 硬禁档位由 tierLimit 强制）` })
  }
  return out
}

// 逐周扫描（教师端下钻用）：history 行（week/occupancy/price/decisions）+ 区位房价档 + 品牌基准价
export function 扫描错误操作(history, { 房价档, brandBasePrice }) {
  const out = []
  for (const h of Array.isArray(history) ? history : []) {
    const d = h.decisions || {}
    for (const flag of 错误操作标记({ pricing: d.pricing, price: h.price, 房价档, shifts: d.shifts, occupancy: h.occupancy, brandBasePrice })) {
      out.push({ week: h.week, ...flag })
    }
  }
  return out
}

// 品牌价带字符串（'280-400元'）→ 基准价（取下沿 · 与 settlement parsePrice 同法）
export function parseBrandBase(priceStr) {
  const m = typeof priceStr === 'string' ? priceStr.match(/(\d+)/) : null
  return m ? Number(m[1]) : null
}
