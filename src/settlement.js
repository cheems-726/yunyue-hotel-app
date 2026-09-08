// 结算引擎（前端模拟版）
// 核心公式（来自设计文档 §7）：
// 客源强度 = 价格竞争力 × 口碑影响 × 促销/营销加成 × 市场波动 × 城市客流
// 出租率 = 基础出租率 × 客源强度
// 营收 = 入住间数 × 房价
// 利润 = 收入 - 成本
// 评价：入住间数 × 8%，好/差由好评率决定
//
// 公平原则：固定随机种子——同一经营日全班同一随机结果，决策相同则结果相同
// v0.29：18项决策全部接入结算；好评率跨周延续；结算差评回流口碑页

// 固定随机种子：简单伪随机（同一 seed 同一结果）
function seededRandom(seed) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return function () {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// 差评文案池（结算生成差评时取样，文案与决策联动）
const negativeTexts = [
  '「隔音太差了，隔壁半夜看电视听得一清二楚，完全没睡好。」',
  '「前台办理入住等了半小时，体验很差。」',
  '「房间卫生一般，床品有异味，期望落差大。」',
  '「空调忽冷忽热，半夜被冻醒。」',
  '「热水等了十分钟才来，洗澡体验差。」',
  '「网络太慢，视频会议都开不了。」',
  '「停车场要绕很远，前台也说不清楚。」',
  '「房间设施老旧，和网上照片差距太大。」',
]
const positiveTexts = [
  '「位置很好，离地铁近，房间干净，下次还来。」',
  '「前台服务很热情，入住体验超出预期。」',
  '「床品舒服，睡了个好觉，性价比高。」',
  '「会员价格实惠，还送了早餐，好评。」',
]
const guestNames = ['王先生 · 商务出差', '李女士 · 家庭出游', '张先生 · 旅行', '刘女士 · 亲子', '陈先生 · 商务出差', '赵女士 · 度假', '周先生 · 旅行']

// 结算主函数
// 输入：site（选址属性1-5档）、brand（品牌）、decisions（决策结果）、week（经营周数）、
//       pendingNegatives（口碑页未处理差评数）、prevGoodRate（上周好评率，跨周延续）
//       crisisResponse（上周危机事件的应对选择，影响本周口碑）
// 输出：经营结果 + 生成的差评/好评（供口碑页展示）
export function settle({ site, brand, decisions, week = 1, pendingNegatives = 0, prevGoodRate = null, crisisResponse = null }) {
  const rand = seededRandom(week * 100 + 7) // 固定种子：同一周全班同结果
  const s = site || {}

  // 1. 城市客流系数（选址"客流"属性 1-5 → 0.5-1.5）
  const cityFlow = 0.5 + (s.客流 || 3) * 0.2

  // 1.5 租金成本（选址"租金"属性 1-5 → 单房固定成本 35-85 元）
  const rentCost = 35 + (s.租金 || 3) * 10

  // 1.6 竞争强度（选址"竞争"属性 1-5 → 客流折减）
  const competition = 1.15 - (s.竞争 || 3) * 0.05 // 竞争越大，客流越被分走

  // 2. 价格竞争力（本店房价 vs 全班均价，简化：用品牌房价带 + 调价决策）
  const basePrice = brand ? parsePrice(brand.price) : 300
  const pricing = decisions.pricing
  let price = basePrice
  let priceCompetitive = 1.0
  if (pricing === '跟降 10%') { price = basePrice * 0.9; priceCompetitive = 1.2 }
  else if (pricing === '降价 20% 抢客') { price = basePrice * 0.8; priceCompetitive = 1.3 }
  else if (pricing === '不跟降') { priceCompetitive = 0.8 }

  // 2.5 收益管理（连住优惠稳出租 / 尾房闪购拉出租压价 / 组合套餐提价）
  const revenueMgmt = decisions['revenue-mgmt']
  if (revenueMgmt === '连住优惠') { priceCompetitive *= 1.06 }
  else if (revenueMgmt === '尾房闪购') { price *= 0.93; priceCompetitive *= 1.12 }
  else if (revenueMgmt === '组合套餐') { price *= 1.08 }

  // 2.6 协议客户（让利签约：稳定商务客流，房价略降）
  if (decisions.corporate === '让利签约') { price *= 0.95; priceCompetitive *= 1.08 }

  // 2.7 改造投资（从决策当周起房价逐步提升，每周分摊融资成本）
  let renovationCost = 0
  if (decisions.renovation === '投150万改造') { price *= 1.08; renovationCost = 2000 }

  // 3. 口碑影响（好评率 → 1.2/1.0/0.8/0.5），好评率跨周延续
  let goodRate = prevGoodRate != null ? prevGoodRate / 100 : (brand && brand.name ? 0.85 : 0.82)
  if (decisions['hygiene'] === '停房深清洁') goodRate += 0.03
  if (decisions['quality-check']) {
    // 质检排序：隔音/卫生排进前5 → 口碑提升
    const top5 = decisions['quality-check'].slice(0, 5)
    if (top5.includes('隔音')) goodRate += 0.015
    if (top5.includes('卫生')) goodRate += 0.015
  }
  if (decisions['member-convert'] === '强调品质') goodRate += 0.02
  if (decisions['hr-optimize'] === '全员培训') goodRate += 0.02
  if (decisions['report-diagnosis'] === '解决口碑相关') goodRate += 0.015
  if (decisions.reputation === '道歉+赔偿') goodRate += 0.02
  if (decisions.reputation === '模板回复') goodRate -= 0.03
  // 上周危机应对（限时选择）对本周口碑的影响
  let crisisInsight = null
  if (crisisResponse === '立即公开整改+补偿') { goodRate += 0.02; crisisInsight = { good: true, text: '上周危机应对果断（公开整改+补偿），口碑修复中' } }
  else if (crisisResponse === '逐条真诚回复') { goodRate += 0.01; crisisInsight = { good: true, text: '上周危机逐条真诚回复，口碑小幅修复' } }
  else if (crisisResponse === '不理会') { goodRate -= 0.02; crisisInsight = { good: false, text: '上周危机选择了不理会，口碑持续受损——危机不应对就是最差应对' } }
  if (decisions['hr-optimize'] === '裁员1人') goodRate -= 0.02
  // 能耗管控走极端 → 舒适度差招差评
  const energy = decisions.energy
  if (energy != null && (energy <= 21 || energy >= 25)) goodRate -= 0.02
  // 会员门槛适中（4-6晚）→ 会员体验好
  const threshold = decisions['member-threshold']
  if (threshold != null && threshold >= 4 && threshold <= 6) goodRate += 0.01
  // 未处理的差评降低好评率（口碑处理联动）
  goodRate -= pendingNegatives * 0.03
  goodRate = Math.max(goodRate, 0.3) // 下限 30%
  goodRate = Math.min(goodRate, 0.95) // 上限 95%
  let reputationFactor = goodRate >= 0.85 ? 1.2 : (goodRate >= 0.7 ? 1.0 : (goodRate >= 0.5 ? 0.8 : 0.5))

  // 4. 促销/营销加成（OTA投放/活动/会员转化）
  let marketingBonus = 0
  if (decisions.campaign) marketingBonus += 0.15
  if (decisions.ota) marketingBonus += 0.08
  if (decisions['member-convert'] === '强调优惠') marketingBonus += 0.05

  // 5. 市场波动（固定种子 0.85-1.15，选址"波动"属性影响波动幅度）
  const volatility = 1 + (s.波动 || 3) * 0.02 // 波动越大，市场起伏越大
  const marketWave = (0.85 + rand() * 0.3) * volatility

  // 6. 客源强度
  const demandStrength = priceCompetitive * reputationFactor * (1 + marketingBonus) * marketWave * cityFlow * competition

  // 7. 出租率（基础 0.6 × 客源强度，上限 0.98）
  const baseOccupancy = 0.6
  let occupancy = Math.min(baseOccupancy * demandStrength, 0.98)
  // 超额预订：直接抬高本周满房率
  const overbook = decisions.overbook || 0
  if (overbook > 0) occupancy = Math.min(occupancy + overbook * 0.015, 1.0)
  occupancy = Math.max(occupancy, 0.3) // 下限 30%

  // 7.5 条件触发事件系统（按设计文档：属性条件 + 固定种子概率，非纯随机）
// 负向压力机制：属性推到极端会招来事件，教学生权衡而非刷满
const events = []
function addEvent(e) { events.push(e) }
let negativeCount = 0

// ① 满负荷·响应慢：出租率过高 + 排班精简 → 服务跟不上
if (occupancy >= 0.85 && decisions.shifts === '精简省成本' && rand() < 0.6) {
  negativeCount += 2
  addEvent({ type: 'bad', icon: '🐢', name: '满负荷·响应慢', text: `出租率 ${Math.round(occupancy * 100)}% 却只留了精简人手，客人投诉入住/退房排队，新增 2 条差评`, tip: '旺季保服务：高出租率时该满编排班' })
}
// ② 卫生敷衍：连续经营未做深清洁
if (decisions.hygiene !== '停房深清洁' && week >= 4 && rand() < 0.3) {
  negativeCount += 1
  addEvent({ type: 'bad', icon: '🧹', name: '卫生敷衍', text: '连续多周未做深度清洁，客人发现布草污渍，新增 1 条差评', tip: '卫生是口碑底线，定期停房深清洁' })
}
// ③ 性价比失衡：高房价 + 口碑平平 → 客人觉得不值
if (price >= 320 && goodRate < 0.8 && rand() < 0.4) {
  negativeCount += 1
  addEvent({ type: 'bad', icon: '💸', name: '性价比失衡', text: `房价 ${Math.round(price)} 元但口碑平平（好评率 ${Math.round(goodRate * 100)}%），客人吐槽"不值这个价"`, tip: '价格要和品质匹配，否则招差评' })
}
// ④ 竞店开业：选址竞争激烈时被分流
if ((s.竞争 || 3) >= 4 && rand() < 0.35) {
  occupancy = Math.max(occupancy * 0.9, 0.3)
  addEvent({ type: 'bad', icon: '🏪', name: '竞店开业', text: '附近新开一家同类酒店分走客流，本周出租率 -10%', tip: '竞争激烈地段要靠口碑和会员留客' })
}
// ⑤ 网红探店（正面）：口碑好被推荐
if (goodRate >= 0.85 && rand() < 0.25) {
  addEvent({ type: 'good', icon: '📸', name: '网红探店', text: '本地探店博主自发推荐了你家酒店，好评率小幅提升', tip: '好口碑会带来免费流量' })
  goodRate = Math.min(goodRate + 0.02, 0.95)
}
// ⑥ 会员复购（正面）：强调品质转化带来回头客
if (decisions['member-convert'] === '强调品质' && rand() < 0.3) {
  addEvent({ type: 'good', icon: '🔁', name: '会员复购潮', text: '高品质转化的会员带朋友复购，本周散客口碑提升', tip: '强调品质的会员忠诚度更高' })
}
// ⑦ 危机·差评发酵：欠了2条以上差评没处理，被顶上平台热榜
if (pendingNegatives >= 2 && rand() < 0.4) {
  goodRate = Math.max(goodRate - 0.03, 0.3)
  addEvent({ type: 'crisis', icon: '🔥', name: '差评发酵', text: `${pendingNegatives} 条差评长期未处理，被平台顶上"最近差评"热榜，口碑额外受损`, tip: '差评欠得越多发酵越快——口碑页的处理节奏就是口碑本身' })
}

// 8. 营收（房量 × 出租率 × 房价）
  const rooms = brand ? parseRooms(brand.standard) : 70
  let occupiedRooms = Math.round(rooms * occupancy)
  const revenue = Math.round(occupiedRooms * price)

  // 9. 成本（真实酒店成本结构）
  // 固定成本 = 可售房 × 单房固定（含租金、折旧、基础人工分摊），单房成本由选址"租金"属性决定
  let fixedCost = rooms * rentCost
  // 排班决策影响人工成本：满编多招人，精简省人工
  if (decisions.shifts === '满编保服务') fixedCost = Math.round(fixedCost * 1.3)
  if (decisions.shifts === '精简省成本') fixedCost = Math.round(fixedCost * 0.8)
  // 报表诊断选"成本相关" → 压降固定成本
  if (decisions['report-diagnosis'] === '解决成本相关') fixedCost = Math.round(fixedCost * 0.95)
  // 人力优化：裁员立即降本，培训成本不变
  if (decisions['hr-optimize'] === '裁员1人') fixedCost = Math.round(fixedCost * 0.9)
  // 变动成本 = 入住数 × 单房变动（布草、易耗品、水电）
  // 布草自洗单件便宜（前提投入已在筹建期）；外包贵
  let perRoomVariable = 60
  if (decisions.linen === '自洗') perRoomVariable = 52
  if (decisions.linen === '外包') perRoomVariable = 66
  // 能耗管控：温度设低省电、设高耗电
  if (energy != null) perRoomVariable += (energy - 23) * 2
  let variableCost = occupiedRooms * perRoomVariable
  // 营销成本 = 做活动才有额外支出
  let marketingCost = decisions.campaign ? 5000 : 0
  // OTA 佣金（按营收 8-15%，取 11%）
  const otaCommission = decisions.ota ? Math.round(revenue * 0.11) : 0
  // 超售赔偿：到店无房按间赔偿（每间赔一晚房价）
  let overbookCompensation = 0
  if (overbook > 0) {
    const walkIn = rand() < overbook * 0.08 ? overbook : Math.max(0, Math.round(overbook * 0.4 * rand()))
    overbookCompensation = walkIn * Math.round(price)
  }
  const totalCost = fixedCost + variableCost + marketingCost + otaCommission + overbookCompensation + renovationCost

  // 10. 利润
  const profit = revenue - totalCost

// 11. 评价生成
const reviewCount = Math.round(occupiedRooms * 0.08)
for (let i = 0; i < reviewCount; i++) {
  if (rand() >= goodRate) negativeCount++
}
  // 超售到店无房必招差评
  if (overbookCompensation > 0) negativeCount += 1

  // 12. 差评处理影响
  let negativeImpact = negativeCount
  if (decisions.reputation === '道歉+赔偿' || decisions.reputation === '解释原因') {
    negativeImpact = Math.round(negativeCount * 0.5) // 按时回复减半
  }

  // 13. 最终好评率
  const finalGoodRate = reviewCount > 0 ? (reviewCount - negativeImpact) / reviewCount : goodRate

  // 14. 决策复盘（对关键决策给出评价）
  const insights = []
  if (pricing === '跟降 10%') insights.push({ good: occupancy >= 65, text: occupancy >= 65 ? '调价跟降 10% 拉住了客流，出租率达标' : '跟降 10% 客流仍不足，可能需要更大力度降价或提升口碑' })
  if (pricing === '不跟降') insights.push({ good: profit >= 0, text: profit >= 0 ? '不跟降保住了单间利润，本周盈利' : '不跟降保住了单价但客流流失严重，导致亏损' })
  if (pricing === '降价 20% 抢客') insights.push({ good: profit >= 0, text: profit >= 0 ? '降价抢客拉高了出租率，薄利多销有效' : '降价 20% 客流涨了但利润被压垮，得不偿失' })
  if (decisions.shifts === '满编保服务') insights.push({ good: negativeCount <= 1, text: negativeCount <= 1 ? '满编排班保证了服务质量，差评少' : '满编排班成本高，但服务质量仍没跟上' })
  if (decisions.shifts === '精简省成本') insights.push({ good: negativeCount === 0, text: negativeCount === 0 ? '精简排班省了成本，且没影响服务' : '精简排班省了成本，但服务响应慢招来差评' })
  if (decisions.hygiene === '停房深清洁') insights.push({ good: true, text: '停房深清洁提升了口碑，长期利好' })
  if (decisions.reputation === '道歉+赔偿' || decisions.reputation === '解释原因') insights.push({ good: true, text: '差评处理得当，负面影响减半' })
  if (decisions.reputation === '模板回复') insights.push({ good: false, text: '模板回复显得敷衍，差评负面影响未减半' })
  if (overbook > 2) insights.push({ good: overbookCompensation === 0, text: overbookCompensation === 0 ? `超售 ${overbook} 间全部消化，满房率提高` : `超售 ${overbook} 间导致到店无房，赔偿 ${overbookCompensation} 元` })
  if (energy != null && (energy <= 21 || energy >= 25)) insights.push({ good: false, text: `空调设定 ${energy}℃ 过于极端，客人投诉舒适度，能耗成本也没占到便宜` })
  if (decisions.linen === '自洗') insights.push({ good: true, text: '布草自洗压低了单间变动成本，长期划算' })
  if (decisions.renovation === '投150万改造') insights.push({ good: week >= 2, text: '改造投资拉高房价带，品质与口碑长期受益，但注意回收期' })
  if (decisions.ota) insights.push({ good: true, text: 'OTA 投放带来线上客流，但佣金成本已计入（本周佣金 ' + otaCommission + ' 元）' })
  if (decisions.corporate === '让利签约') insights.push({ good: true, text: '协议客户让利签约，商务客流稳定，出租率更稳' })
  if (crisisInsight) insights.push(crisisInsight)

  // 15. 生成本周评价（差评回流口碑页）
  const generatedReviews = []
  for (let i = 0; i < Math.min(negativeCount, 3); i++) {
    generatedReviews.push({
      id: `w${week}-n${i}`,
      avatar: '🧑',
      bg: 'blue',
      name: guestNames[Math.floor(rand() * guestNames.length)],
      date: `第${week}周`,
      stars: rand() < 0.5 ? 1 : 2,
      text: negativeTexts[Math.floor(rand() * negativeTexts.length)],
      status: 'pending',
    })
  }
  if (reviewCount - negativeCount > 0 && rand() < 0.6) {
    generatedReviews.push({
      id: `w${week}-g0`,
      avatar: '👩',
      bg: 'green',
      name: guestNames[Math.floor(rand() * guestNames.length)],
      date: `第${week}周`,
      stars: 5,
      text: positiveTexts[Math.floor(rand() * positiveTexts.length)],
      status: 'good',
    })
  }

  return {
    week,
    occupancy: Math.round(occupancy * 100),
    rooms,
    occupiedRooms,
    price: Math.round(price),
    revenue,
    totalCost,
    profit,
    goodRate: Math.round(goodRate * 100),
    finalGoodRate: Math.round(finalGoodRate * 100),
    reviewCount,
    negativeCount,
    demandStrength: Math.round(demandStrength * 100) / 100,
    marketWave: Math.round(marketWave * 100) / 100,
    insights,
    events,
    generatedReviews,
  }
}

// 解析房价带（"180-280元" → 取中值 230）
function parsePrice(priceStr) {
  const m = priceStr && priceStr.match(/(\d+)-(\d+)/)
  return m ? Math.round((Number(m[1]) + Number(m[2])) / 2) : 300
}

// 解析房量（"客房70间起" → 70）
function parseRooms(standardStr) {
  const m = standardStr && standardStr.match(/(\d+)间/)
  return m ? Number(m[1]) : 70
}
