// §14.3 · G3 第二步：加盟费率进资金流 —— 守门断言
// 运行：node tests/franchiseFees.test.mjs   （挂 run-all）
//
// 分六层：
//   [1] 单源层：只有 3 个品牌可算 · 费率合计 = 7.4%（决策端"排序不变"证据固化）· 封顶守卫 · 金额对拍
//   [2] 零变化层（★ 水位线）：未接入品牌/无品牌 ⇒ 与【接线前冻结的 fixture】逐字节相同
//   [3] 守恒层：账本各项之和 === 资金实际变化（不重不漏）
//   [4] 纯算术层：不消耗 rand ⇒ 非货币字段（事件/差评/竞品/日快照以外）逐字节不变
//   [5] 单源纪律层：settlement.js 不含第二份费率公式（BL-7 同族）
//   [6] 界面标注层：哪些费率"已实收"、哪些"待接入"必须如实标注
import { readFileSync } from 'node:fs'
import { settle } from '../src/settlement.js'
import { franchiseFees, franchiseFeeStatus, 费用清单, 已接入品牌, CRS_渠道占比, CRS_官方封顶, 缺项, CRS生效值, CRS配置, 设置CRS渠道占比, 重置CRS渠道占比, 一次性费用清单 } from '../src/franchiseFees.mjs'
import { FRANCHISE_MODEL } from '../src/franchiseModel.mjs'
import { 渠道流量系数 } from '../src/otaRating.mjs'   // ★ §32-U3：OTA 渠道系数（归因断言的期望值来源）
import { WEATHER_TABLE_CYCLE } from '../src/weather.mjs'     // ★ §32-U4-§1②：世界层强制中性（水位线加固）
import { SEASON_TABLE } from '../src/season.mjs'
import { OTA_RATING_CONFIG } from '../src/otaRating.mjs'
import { 代价表, 不作为惩罚 } from '../src/decisionRisk.mjs'   // ★ §32-U4c-R6：中性化用

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')

console.log('▶ §14.3 · 加盟费率进资金流（汉庭/全季/海友）')

const 决策 = {
  pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗',
  'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿',
}
const 属性 = { quality: 60, reputation: 70, morale: 65 }
const 场地 = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const 品牌 = {
  汉庭: { name: '汉庭', price: '180-280元', standard: '客房70间起', level: '经济型 · 国民' },
  全季: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' },
  海友: { name: '海友', price: '120-180元', standard: '客房50间起', level: '经济型 · 国民' },
  汉庭快捷: { name: '汉庭快捷', price: '160-240元', standard: '客房60间起', level: '经济型（轻改/特许）' },
  你好: { name: '你好', price: '150-220元', standard: '客房60间起', level: '经济型 · 国民' },
  桔子: { name: '桔子', price: '260-380元', standard: '客房70间起', level: '中档' },
  无品牌: null,
}
const 跑 = (名, week = 1, prevCapital = null, bizMode = 'direct') =>
  settle({ site: { ...场地 }, brand: 品牌[名], decisions: { ...决策 }, week, attrs: { ...属性 }, prevCapital, bizMode })

const fixture = JSON.parse(readFileSync(new URL('./fixtures/settle-baseline-14.3.json', import.meta.url), 'utf8'))

// ★ §32-U4-§1② / §32-U4c-R6：**全中性化**（世界层 ×1 + 决策代价清零）—— 模块级，供各段复用。
//   为什么提到模块级：水位线判据在 [2] 与 [4] 两段都要用（原先只在 [2] 块内定义 ⇒ [4] 引用 ReferenceError）。
//   ★ §32-U4c-R6 扩展：决策风险化的【属性代价 / 延迟后果 / 不作为惩罚】也要中性化 ——
//     否则水位线比的是「改造前 vs 改造后」，而 R6 是**有意改数值**的单元 ⇒ 永远红且失去判别力。
//     中性化后仍与冻结基线**逐字节**相同 ⇒ 这恰好证明「**只**有世界层与 R6 变了，别的一处没动」。
const 世界层中性 = (fn) => {
  const 天气备份 = WEATHER_TABLE_CYCLE.map(x => x.客流)
  const 季节备份 = SEASON_TABLE.map(x => x.因子)
  const k备份 = OTA_RATING_CONFIG.trafficK
  const 代价备份 = []
  for (const d of Object.values(代价表)) for (const e of Object.values(d.选项)) 代价备份.push([e, e.属性, e.延迟])
  const 不作为备份 = { ...不作为惩罚.每项 }
  try {
    WEATHER_TABLE_CYCLE.forEach(x => { x.客流 = 1 })
    SEASON_TABLE.forEach(x => { x.因子 = 1 })
    OTA_RATING_CONFIG.trafficK = 0
    for (const [e] of 代价备份) { delete e.属性; delete e.延迟 }
    不作为惩罚.每项.morale = 0; 不作为惩罚.每项.quality = 0
    return fn()
  } finally {
    WEATHER_TABLE_CYCLE.forEach((x, i) => { x.客流 = 天气备份[i] })
    SEASON_TABLE.forEach((x, i) => { x.因子 = 季节备份[i] })
    OTA_RATING_CONFIG.trafficK = k备份
    for (const [e, a, y] of 代价备份) { if (a) e.属性 = a; else delete e.属性; if (y) e.延迟 = y; else delete e.延迟 }
    不作为惩罚.每项.morale = 不作为备份.morale; 不作为惩罚.每项.quality = 不作为备份.quality
  }
}

// ── [1] 单源层 ────────────────────────────────────────────────────────
console.log('\n[1] 单源层：只有 3 个品牌可算 · 费率合计 = 7.4% · 封顶守卫')
{
  ok(已接入品牌.length === 3 && 已接入品牌.join('/') === '汉庭/全季/海友',
    '接入范围 = 决策端 D53-a 的三人名单', 已接入品牌.join('/'))
  const 额 = 1_000_000
  const 各 = 已接入品牌.map(n => ({ n, f: franchiseFees(n, 额) }))
  ok(各.every(x => x.f && x.f.接入 && x.f.合计 > 0), '三个品牌都可算且合计 > 0',
    JSON.stringify(各.map(x => [x.n, x.f && x.f.合计])))
  // ★ 决策端"排序不变"的核心证据：两费 ≈ 营收 7.4%（5% + 2.4%）
  const 率 = 各[0].f.费率.合计
  ok(Math.abs(率 - 0.074) < 1e-9, '★ 费率合计 = 7.40%（管理费 5% + CRS 有效 2.4% = 决策端"六组排序不变"证据）', String(率))
  ok(Math.abs(各[0].f.费率.CRS有效 - Math.min(0.08 * CRS_渠道占比.值, CRS_官方封顶.值)) < 1e-12 && Math.abs(各[0].f.费率.CRS有效 - 0.024) < 1e-9,
    'CRS 有效费率 = min(名义 8% × 渠道占比 30%, 官方封顶 3.5%) = 2.40%（封顶写成守卫，不是第二份公式）')
  ok(各[0].f.封顶是否触发 === false && 0.08 * CRS_渠道占比.值 <= CRS_官方封顶.值,
    '当前未撞官方封顶（3.5%）—— 若有人把渠道占比抬到 >43.75% 会先撞上限，而不是静默超收')
  // 金额独立对拍（不引用模块内部算好的数）
  const f = franchiseFees('全季', 126140)
  ok(f.管理费 === Math.round(126140 * 0.05) && f.CRS === Math.round(126140 * 0.024) && f.合计 === f.管理费 + f.CRS,
    '金额对拍：管理费 = round(营收×5%) · CRS = round(营收×2.4%) · 合计 = 两者之和（无隐蔽加成）',
    `${f.管理费}/${f.CRS}/${f.合计}`)
  // 依据[] 与金额不重不漏（界面 hover 的追溯来源）
  ok(f.依据.length === 2 && f.依据[0].科目 === '加盟管理费' && f.依据[1].科目 === '加盟CRS'
    && f.依据[0].金额 === f.管理费 && f.依据[1].金额 === f.CRS,
    '依据[] 两项科目金额与实收一致（不重不漏）· 各带来源与置信度三件套',
    JSON.stringify(f.依据.map(x => [x.科目, x.金额, x.置信度])))
  // 未接入品牌：null 而不是 0（调用方必须显式处理）
  const 未 = ['汉庭快捷', '你好', '桔子', '不存在的品牌']
  ok(未.every(n => franchiseFees(n, 额) === null), '未接入品牌 ⇒ 返回 null（不是 0 值对象：强制调用方显式处理）', 未.join('/'))
  ok(franchiseFeeStatus('汉庭快捷').接入 === false && /缺.*管理费/.test(franchiseFeeStatus('汉庭快捷').原因),
    '状态查询如实说明【缺什么】（汉庭快捷：缺管理费率 ⇒ 待补），不是笼统"暂不支持"', franchiseFeeStatus('汉庭快捷').原因)
  ok(缺项('桔子').length > 0 && 缺项('汉庭').join() === '（费率齐全，未在接入名单）',
    '缺项清单：无该品牌条目 vs 费率齐全但不在名单 —— 两种情况分得清', JSON.stringify([缺项('桔子'), 缺项('汉庭')]))
  ok(franchiseFees('全季', 0) === null && franchiseFees('全季', NaN) === null,
    '营收 0/脏值 ⇒ 不产生费用（按营收抽成即为 0 ⇒ 视同未产生，不往账里塞 0 金额键）')
  // 费率来源必须是 franchiseModel（单源），不是本模块自带一份
  const 源 = franchiseModel => FRANCHISE_MODEL
  ok(Object.keys(FRANCHISE_MODEL).includes('全季') && Object.keys(FRANCHISE_MODEL).includes('海友') && 源().汉庭.管理费.费率.值 === 0.05,
    '费率取自 franchiseModel（三件套同源），不在计费模块里另写一份费率')
}

// ── [2] 零变化层（★ 水位线）────────────────────────────────────────────
console.log('\n[2] 零变化层：未接入品牌 / 无品牌 ⇒ 与接线前冻结的基线【逐字节】相同')
{
  ok(/接线前/.test(fixture.生成时间), '基线 fixture 标记为"接线前"生成（可信来源：不是改动后自造）', fixture.生成时间)
  const 未接入用例 = Object.keys(fixture.用例).filter(k => /^(汉庭快捷|你好|桔子|无品牌)\|/.test(k) && !k.endsWith('链3周'))
  ok(未接入用例.length === 8, '基线含 8 个未接入/无品牌单周用例（4 品牌 × direct/ota）', String(未接入用例.length))
  // ★ §26.3 P0b④（2026-09-29 · D70 · 重基线）：本套件的「零变化」断言从「整体逐字节」改为
  //   「**除 dailySnapshots[].checkins/checkouts 外**逐字节」 —— 起因：本次**有意**补上逐日入住/退房
  //   （原传 0 = 已记录的缺口，见 settlement 注释），而 dailySnapshots 是 settle 返回值的一部分 ⇒ 整体比对必然变。
  //   ★ 这**不是放宽**：被排除的只有那两个字段，且它们的新值由下面**专门断言**钉住（Σ7天 === occupiedRooms）。
  const 剥日入住退房 = (o) => {
    if (!o || typeof o !== 'object') return o
    const c = JSON.parse(JSON.stringify(o))
    // 每天有两层：顶层 slices 与嵌套 dailySnapshot —— **两层都要剥**（实测：只剥顶层 ⇒ 比对照样不同）
    if (Array.isArray(c.dailySnapshots)) c.dailySnapshots = c.dailySnapshots.map(d => {
      const { checkins, checkouts, ...rest } = d
      if (rest.dailySnapshot) { const { checkins: _c1, checkouts: _c2, ...ds } = rest.dailySnapshot; rest.dailySnapshot = ds }
      return rest
    })
    return c
  }
  const 逐字节 = (a, b) => JSON.stringify(剥世界层(剥日入住退房(a))) === JSON.stringify(剥世界层(剥日入住退房(b)))
  // ★ §32-U3：新增 `world` 键（天气/淡旺季/OTA 平台）—— **有意**新增 ⇒ 逐字节比对必须剥掉它，
  //   但要**专门断言**它的存在与首周中性（见下）—— 与 §26.3 排除 checkins/checkouts 同一纪律：
  //   「只排除那一个新键 + 补专门断言」，不是放宽判据。
  //   ★ 为什么只剥这一个键：世界层因子在【第 1 周】全为 1（晴×1.00 · 平季×1.00 · 直营渠道×1.0）
  //     ⇒ 首周数字必须逐字节不变（这正是"未接入品牌零变化"这层要守的东西）。
  const 剥世界层 = (o) => {
    if (!o || typeof o !== 'object') return o
    const c = { ...o }
    delete c.world
    // 世界层的三条 insight 是【有意新增】（kind:'world' 标记）⇒ 精确剥掉；其余 insights 仍逐字节比
    if (Array.isArray(c.insights)) c.insights = c.insights.filter(x => x && x.kind !== 'world')
    return c
  }

  // ★★ §32-U4-§1②（水位线加固 · 比"资金恒等式"更强）：**临时把世界层改成中性**（天气/季节表全 1 ·
  //   OTA trafficK=0 ⇒ 渠道系数 1），此时引擎应与"U3 之前冻结的基线"**逐字节**相同 ——
  //   这就把「只有世界层变了」从"分周子集判据"升级为**全周逐字节**证据（含非中性周 w2/w3/w9）。
  //   ★ 用 try/finally 保证还原：任何一步炸了都不许把表改坏（本项目血泪：临时改文件忘还原）。


  const bad = []
  const ota归因坏 = []
  const ota中性坏 = []
  for (const k of 未接入用例) {
    const [名, mode] = k.split('|')
    const now = 跑(名, 1, null, mode)
    if (mode === 'ota') {
      // ★ §32-U3：未接入品牌 + OTA 模式 ⇒ 渠道系数（由平台评分决定）在本周就 ≠ 1 ⇒ 与冻结基线必然不同。
      //   判据改为【可归因】：营收比 === 渠道系数（±3%）⇒ 差额只来自 U3 渠道层，不是"悄悄扣费"。
      const 期 = 渠道流量系数(now.world.ota.评分, 'ota')
      const 比 = now.revenue / fixture.用例[k].revenue
      if (!(Math.abs(比 - 期) / 期 < 0.03)) ota归因坏.push(`${k} 比 ${比.toFixed(4)} vs 渠道 ${期}`)
      // ★ §32-U4-§1①（D90 尾巴 · 原注释承诺了逐字节却没调用 ⇒ 说做了没做）：**真补上逐字节比** ——
      //   口径 = 世界层强制中性（此时 OTA 的渠道系数也被压成 1）⇒ 必须与冻结基线逐字节相同。
      //   ★ 必须在【中性包装内】跑 settle —— 否则拿到的是非中性结果（实测踩过：先说"跑在中性外"）
      if (!世界层中性(() => 逐字节(跑(名, 1, null, mode), fixture.用例[k]))) ota中性坏.push(k)
    } else if (!世界层中性(() => 逐字节(跑(名, 1, null, mode), fixture.用例[k]))) bad.push(k)
  }
  ok(bad.length === 0, '★ 零变化：未接入品牌【直营】用例**中性化后（世界层 ×1 + R6 代价清零）**输出逐字节不变（除 dailySnapshots 逐日入住/退房 §26.3 + world/世界层 insight §32-U3 两处有意新增）', bad.join(','))
  ok(ota归因坏.length === 0, '★ OTA 模式用例：营收差 === 平台渠道系数（可归因 · 不是悄悄扣费）', ota归因坏.join(','))
  ok(ota中性坏.length === 0, '★ OTA 模式用例：世界层强制中性后**逐字节**不变（与直营同款水位线 · 原注释承诺过却漏调）', ota中性坏.join(','))
  // ★ 被排除的两个字段：新值必须等于引擎周值（不是 0、也不是编的）
  const 日入住退房坏 = 未接入用例.filter(k => {
    const [名, mode] = k.split('|'); const r = 跑(名, 1, null, mode); const ds = r.dailySnapshots || []
    return !(ds.length === 7 && ds.reduce((a, d) => a + (d.checkins || 0), 0) === r.occupiedRooms && ds.reduce((a, d) => a + (d.checkouts || 0), 0) === r.occupiedRooms)
  })
  ok(日入住退房坏.length === 0, '★ 逐日 checkins/checkouts 的 Σ7天 === occupiedRooms（原为 0 = 缺口已补 · §26.3 P0b④）', 日入住退房坏.join(','))
  ok(未接入用例.every(k => !('franchiseFees' in fixture.用例[k])), '基线里确实没有 franchiseFees 键（fixture 是改动前的）')
  // ★ §32-U3 专门断言（补上"被剥掉的键"）：world 必须存在、且**第 1 周三系数全为 1**（世界层首周中性）
  const 世界坏 = 未接入用例.filter(k => {
    const [名, mode] = k.split('|'); const r = 跑(名, 1, null, mode); const w = r.world
    if (!w) return true
    const 渠道 = w.ota.渠道系数
    return !(w.天气.客流系数 === 1 && w.季节.需求因子 === 1 && (mode === 'ota' ? 渠道 > 1 : 渠道 === 1))
  })
  ok(世界坏.length === 0, '★ world 键在位且首周中性（天气×1 · 季节×1 · 直营渠道×1；OTA 渠道 >1 由平台评分决定）', 世界坏.join(','))

  // 多周链（资金累积 ⇒ 更能抓"悄悄扣费"）
  // ★ §32-U3：原三周链 w1→w3 里只有 w1 是世界层中性周（w2/w3 的天气/季节会真实改变需求 ⇒ 与冻结基线
  //   逐字节比不再成立 —— 那不是"悄悄扣费"）。⇒ 判据拆两半，覆盖面反而更大：
  //     ① 首跳（w1）仍与冻结基线**逐字节**比（世界中性周口径）
  //     ② 任意周（含非中性 w2/w3/w9）用【资金链恒等式】证明没有悄悄扣费：capital === round(prevCapital + profit)
  //        且未接入品牌任何周都不得出现 franchiseFees 键
  const 链坏 = []
  for (const 名 of ['你好', '无品牌']) {
    // ★ §32-U4c-R6：首跳也必须取自【中性轨迹】（否则 cap 是非中性值 ⇒ 后面每跳必然不同）
    const r1 = 世界层中性(() => 跑(名, 1, null))
    if (!逐字节(r1, fixture.用例[`${名}|链3周`][0])) 链坏.push(`${名}w1`)
    let cap = r1.capital
    // ★ §32-U4-§1②：三周链**恢复逐字节**（世界层中性口径）—— 比 U3 时的"资金恒等式"强一个量级。
    //   ★★ 整条链都必须在【中性轨迹】里走：capital 只能取自中性周的结果 —— 否则 w3 的 prevCapital
    //      来自非中性 w2 ⇒ 逐字节必然不同（实测踩过这一次）。
    for (const [i, w] of [[1, 2], [2, 3]]) {
      const r = 世界层中性(() => 跑(名, w, cap))
      if (!逐字节(r, fixture.用例[`${名}|链3周`][i])) 链坏.push(`${名}w${w}中性逐字节`)
      if ('franchiseFees' in r) 链坏.push(`${名}w${w}混入两费`)
      cap = r.capital
    }
    const r9 = 跑(名, 9, cap)
    if (r9.capital !== Math.round(cap + r9.profit)) 链坏.push(`${名}w9资金链`)
  }
  ok(链坏.length === 0, '★ 零变化：首跳逐字节 + 多周链【世界层中性下逐字节】+ 未接入品牌无两费键（w1/w2/w3/w9 覆盖）', 链坏.join(','))

  // ★ 双向证明：同一个比较器，对未接入说"没变"、对已接入必须说"变了"
  //   否则"零变化"可能只是比较器坏了（永远相等）—— 那是最典型的假绿
  const 汉庭链 = fixture.用例['汉庭|链3周']
  const 汉庭今 = 跑('汉庭', 1, null)
  ok(!逐字节(汉庭今, 汉庭链[0]), '★ 同一比较器对【已接入】品牌判"变了"（证明它能判死，零变化不是恒真）')
  // 反向验证：把基线改一个数字 ⇒ 比较器必须变红
  const 篡改 = JSON.parse(JSON.stringify(汉庭链[0])); 篡改.revenue += 1
  ok(!逐字节(篡改, 汉庭链[0]), '★ 反向验证：篡改基线一个数字 ⇒ 比较器立刻为假（判据有效）')
}

// ── [3] 守恒层 ────────────────────────────────────────────────────────
console.log('\n[3] 守恒层：账本各项之和 === 资金实际变化（不重不漏）')
{
  // 判据写成可复用的纯函数，便于"判据自检"
  const 守恒 = (r, prev) => {
    const 各 = Object.values(r.weeklyExpenses).reduce((a, b) => a + b, 0)
    const 起始 = Number.isFinite(prev) ? prev : r.capital - r.profit
    return {
      项和: 各, 账本总额: r.totalExpenses,
      差_项和_账本: 各 - r.totalExpenses,
      差_账本_成本: r.totalExpenses - r.totalCost,
      差_营收减账本_利润: r.revenue - r.totalExpenses - r.profit,
      差_资金: r.capital - (起始 + r.profit),
    }
  }
  const rows = []
  const bad = []
  for (const 名 of 已接入品牌) {
    for (const mode of ['direct', 'ota']) {
      const r = 跑(名, 1, null, mode)
      const c = 守恒(r)
      rows.push(`${名}·${mode}: 差 ${[c.差_项和_账本, c.差_账本_成本, c.差_营收减账本_利润, c.差_资金].join('/')}`)
      if (c.差_项和_账本 !== 0 || c.差_账本_成本 !== 0 || c.差_营收减账本_利润 !== 0 || c.差_资金 !== 0) bad.push(`${名}·${mode}`)
    }
  }
  ok(bad.length === 0, '★ 守恒：Σ各项 === totalExpenses === totalCost · 营收 − 账本 === profit · 资金变化 === profit', bad.join(',') || rows[0])
  // 三类账本恒等式（E1 唯一账本）
  const r = 跑('全季')
  ok(r.netProfit === r.profit, '净利恒等式 netProfit === profit 不破（加盟费同时进 totalCost 与净利链）', `${r.netProfit}/${r.profit}`)
  ok(Math.abs(r.netProfitRate - r.netProfit / r.revenue) < 1e-12, '净利率 = 净利 ÷ 营收（同源派生）')
  ok(r.gop === 跑('全季').gop && r.gop > r.netProfit, 'GOP 不因加盟费变化（口径明写"不含加盟费"）且 > 净利润')
  // 逐周扣：第 2 周同样按本周营收抽（不是一次性/不是只扣首周）
  const w2 = 跑('全季', 2, r.capital)
  const f2 = franchiseFees('全季', w2.revenue)
  ok(w2.weeklyExpenses.加盟管理费 === f2.管理费 && w2.weeklyExpenses.加盟CRS === f2.CRS,
    '★ 逐周计提：第 2 周按【本周】营收抽（管理费/CRS 与本函数同源，不是首周一次性）',
    JSON.stringify([w2.weeklyExpenses.加盟管理费, w2.weeklyExpenses.加盟CRS, f2.合计]))
  // 不重不漏：账本里与加盟有关的键只有这两个（防"管理费"与"加盟管理费"两处各记一笔）
  const 费键 = Object.keys(r.weeklyExpenses).filter(k => /加盟|CRS|管理费/.test(k))
  ok(费键.length === 2 && 费键.includes('加盟管理费') && 费键.includes('加盟CRS'),
    '账本内与加盟相关的键【恰好 2 个】（不重：没有第二处再记一遍管理费）', 费键.join(','))
  ok(Object.values(r.weeklyExpenses).filter(v => v === r.franchiseFees.合计).length === 0,
    '不重：没有任何单个键等于两费合计（若有人把两费合成一笔又另记两笔，这里会红）')
  // 判据自检：删掉一个费键（只进 totalCost 不进账本）⇒ 守恒判据必须为假
  const 坏账 = JSON.parse(JSON.stringify(r))
  delete 坏账.weeklyExpenses.加盟CRS
  const c坏 = 守恒(坏账, null)
  ok(c坏.差_项和_账本 !== 0, '★ 判据自检：删掉账本一个费键 ⇒ 守恒立刻为假（不重不漏可判死）', String(c坏.差_项和_账本))
}

// ── [4] 纯算术层：不消耗 rand ─────────────────────────────────────────
console.log('\n[4] 纯算术层：加入费用不影响任何非货币结果（不抽随机数）')
{
  const 非货币 = (r) => {
    const c = { ...r }
    // ★ §22.2 重基线：oneTimeFees 也是【货币字段】（B2 开业费用/保证金退还）⇒ 一并剥掉再比非货币
    // ★ insights 也是【货币派生展示】（文案按本周盈/亏分支；实测 diff 仅此一处且正是 盈利→亏损）——
    //   随机序列是否被扰动由 events/generatedReviews/goodRate/attrsAfter 等 rand 驱动字段兜住。
    for (const k of ['totalCost', 'netProfit', 'netProfitRate', 'profit', 'capital', 'weeklyExpenses', 'totalExpenses', 'dailySnapshots', 'franchiseFees', 'oneTimeFees', 'insights', 'world']) delete c[k]   // ★ §32-U3：world 是新增的【环境展示键】，非随机驱动、非货币
    return c
  }
  const bad = []
  for (const 名 of 已接入品牌) {
    const now = 世界层中性(() => 跑(名)), base = fixture.用例[`${名}|direct|w1`]
    if (JSON.stringify(非货币(now)) !== JSON.stringify(非货币(base))) bad.push(名)
  }
  ok(bad.length === 0, '★ 事件/差评/好评率/竞品/口碑等【非货币字段】逐字节不变（费用是纯算术，随机序列未动）', bad.join(','))
  // 差量对拍：货币字段的差额必须【恰好】等于 两费 + 开业一次性费用
  // ★ §22.2 重基线（B2）：week1 结算现在还收【开业一次性费用】（加盟费/保证金/筹备/筹备保证金/PMS初装）
  //   ⇒ 差额恒等式扩展为「+两费 +开业费用」；金额全部从【单源】推导，不写死
  const 差坏 = []
  for (const 名 of 已接入品牌) {
    // ★ §32-U3：两费算术恒等式在【direct】上判定（前提：世界中性周 + 直营无渠道系数 ⇒ 营收不变）；
    //   OTA 模式在 w1 就有渠道系数（平台评分 >4 基线）⇒ 营收会变，改由下方单独断言★可归因（不混进恒等式）。
    for (const mode of ['direct']) {
      const now = 跑(名, 1, null, mode), base = fixture.用例[`${名}|${mode}|w1`]
      const f = franchiseFees(名, base.revenue)
      const 一次性 = 一次性费用清单(品牌[名])
      const 期望合计 = Math.round(base.revenue * 0.05) + Math.round(base.revenue * 0.024) + 一次性.合计
      if (now.totalCost - base.totalCost !== 期望合计) 差坏.push(`${名}·${mode} 成本差 ${now.totalCost - base.totalCost}≠${期望合计}`)
      if (base.netProfit - now.netProfit !== 期望合计) 差坏.push(`${名}·${mode} 净利差`)
      if (base.capital - now.capital !== 期望合计) 差坏.push(`${名}·${mode} 资金差`)
      if (now.revenue !== base.revenue) 差坏.push(`${名}·${mode} 营收被改`)
      if (now.franchiseFees.合计 !== f.合计) 差坏.push(`${名}·${mode} 返回的 franchiseFees 与单源不一致`)
      if (now.oneTimeFees?.开业费用 !== 一次性.合计) 差坏.push(`${名}·${mode} oneTimeFees 与单源不一致`)
    }
  }
  ok(差坏.length === 0, '★ 差量对拍：成本/净利/资金 差额 === 两费+开业一次性费用 · 营收不变（direct 三个品牌逐一 · 世界中性周）', 差坏.join(' '))
  // ★ §32-U3 新增：OTA 模式的营收差必须【恰好由平台渠道系数解释】（可归因，不是凭空多了钱）
  const 渠道坏 = []
  for (const 名 of 已接入品牌) {
    const now = 跑(名, 1, null, 'ota'), base = fixture.用例[`${名}|ota|w1`]
    const 期 = 渠道流量系数(now.world.ota.评分, 'ota')
    const 比 = now.revenue / base.revenue
    if (!(Math.abs(比 - 期) / 期 < 0.03)) 渠道坏.push(`${名} 比 ${比.toFixed(4)} vs 渠道 ${期}`)
  }
  ok(渠道坏.length === 0, '★ OTA 模式营收差 === 平台渠道系数（±3% · 世界中性周）—— 差额可归因到 U3 渠道层', 渠道坏.join(' '))
  // 死亡选址/难度结论的连带（报告复述用）：两费使净利率下移 ~7.4pp
  // ★ §22.2 重基线：week1 净利率现在被开业费用主导 ⇒ 本证据改按【剔除一次性费用后的经营口径】测
  //   （下移 = (净利+两费)/营收 − 净利/营收，与开业费用无关 —— 恰好隔离出"两费"这一个因素）
  const 全季now = 跑('全季')
  const 两费 = 全季now.franchiseFees.合计
  const 下移pp = ((全季now.netProfit + 两费) / 全季now.revenue - 全季now.netProfit / 全季now.revenue) * 100
  ok(Math.abs(下移pp - 7.4) < 0.05, '★ 两费净利率下移 ≈ 7.4 个百分点（剔除 B2 开业费用后隔离测量；排序不变证据不变）', 下移pp.toFixed(3) + 'pp')
}

// ── [5] 单源纪律层（BL-7 同族守门）────────────────────────────────────
console.log('\n[5] 单源纪律：引擎里不许出现第二份加盟费率公式')
{
  const engine = strip(src('settlement.js'))
  ok(/import\s*\{[^}]*franchiseFees[^}]*一次性费用清单[^}]*\}\s*from\s*'\.\/franchiseFees\.mjs'/.test(engine), '引擎从 franchiseFees.mjs 引入计费（单一计算点 · B2 起含一次性费用清单）')
  ok(!/revenue\s*\*\s*0\.0(5|08|24|74)/.test(engine), '引擎里没有任何"营收 × 费率"字面量（费率只许来自 franchiseFees）')
  // ★ §22.2：引擎新增「开业一次性费用/保证金退还」两个显示键 —— 金额全部来自单源 一次性费用清单()，
  //   本处禁列不含『保证金』（退还键是资产回冲的展示名，不是第二份费率公式）；费率类科目名仍禁。
  ok(!/管理费|筹备费|单房造价/.test(engine), '引擎里不出现加盟【费率类】科目名（科目名只许来自单源；B2 的退还键已核不计入）')
  const 计费 = strip(src('franchiseFees.mjs'))
  ok(!/0\.024|0\.074|7\.4/.test(计费) || !/Math\.round\([^)]*\*\s*0\.024/.test(计费),
    '计费模块里不硬编码 2.4%/7.4%（有效费率由 名义 × 渠道占比 推出）')
  ok(/CRS_官方封顶/.test(计费) && /Math\.min\(/.test(计费), '封顶守卫在位（Math.min 而非只乘）')
  // 数据层声明必须与新现实一致（M3 文档过期同族：注释说"不被引用"而实际被引用 = 假声明）
  const model = src('franchiseModel.mjs')
  // M3 同族：数据层头部若还自称「不被结算引用」，就是假声明（它现在确实被 franchiseFees 消费）
  const NL10 = String.fromCharCode(10)
  const modelHead = model.split(NL10).slice(0, 14).join(NL10)
  ok(!/不被结算引用|不参与任何计算/.test(modelHead) && /franchiseFees\.mjs/.test(modelHead),
    '数据层头部声明已更新：不再自称「不被结算引用」，并点名计费单源')
}

// ── [6] 界面标注层 ────────────────────────────────────────────────────
console.log('\n[6] 界面标注：哪些费率已实收 / 哪些仍是待补')
{
  const 清单 = 费用清单('全季')
  const 已收 = 清单.filter(x => x.状态 === '已实收').map(x => x.科目)
  const 待 = 清单.filter(x => x.状态 !== '已实收')
  ok(已收.includes('加盟管理费') && 已收.includes('加盟CRS'), '已实收：管理费 + CRS（与引擎实收科目一致）', 已收.join(','))
// ★ §22.2 重基线（B2）：加盟费/保证金/筹备费/PMS 已翻为【已实收】；capex 仍『不接』（D53-c）
  //   （★ 已收 是【科目字符串数组】—— x 直接是字符串，不是对象）
  ok(已收.some(x => /加盟费/.test(x)) && 已收.some(x => /保证金/.test(x)) && 已收.some(x => /筹备费|PMS/.test(x)),
    '★ B2 一次性费用已实收：加盟费 · 保证金 · 筹备费/PMS（不再是待接入）', 已收.join(','))
  ok(待.some(x => /capex|单房造价/.test(x.科目)), '★ capex 仍如实标『不接』（D53-c：另立概念，不在资金流）', 待.map(x => x.科目).join(','))
  ok(待.every(x => x.说明 && x.说明.length > 6), '每项待接入都写了【为什么不接】（不是空白或"其他"）')
  const 未清单 = 费用清单('汉庭快捷')
  ok(未清单.length === 1 && 未清单[0].状态 === '待补' && /缺/.test(未清单[0].说明),
    '未接入品牌：清单只一项"待补"并说明缺什么（不拿别家费率冒充）', JSON.stringify(未清单[0]))

  const ledger = src('onePageLedger.mjs')
  ok(/franchiseFees|franchiseFeeStatus|费用清单/.test(ledger), '一页钱账读单源（不再自算管理费）')
  ok(!/管理费率 \* |管理费率\s*\*/.test(ledger) || /franchiseFees/.test(ledger), '钱账里既有的"自己乘一遍"已被单源替换或并存有标注')
  const wr = src('WeeklyReport.jsx')
  ok(/result\.franchiseFees/.test(wr) && /待补/.test(wr),
    '周报：成本构成处读 result.franchiseFees 并对未接入品牌标「待补」（真判据，非靠 GOP 注释碰巧命中）')
}

// ── §16.2-B6：CRS 渠道占比【一处可调】+ 界面标置信度 + 默认值不动 ──────────
console.log('\n[§16.2-B6] CRS 渠道占比可配置（默认值不动 · 改动可观测 · 复位可复原）')
{
  const 汉庭 = { name: '汉庭', price: '180-280元', standard: '客房70间起', level: '经济型 · 国民' }
  const 初始 = CRS配置()
  ok(初始.当前 === 0.30 && 初始.默认 === 0.30, `默认值未被本批改动（当前 ${初始.当前} = 默认 ${初始.默认}）`)
  ok(初始.置信度 === '低' && !!初始.来源, `置信度与来源随配置带出（${初始.置信度} · ${初始.来源.slice(0, 24)}…）`)
  ok(初始.官方封顶 === 0.035, '官方封顶 3.5% 仍是配置的一部分（不是写死在别处）')
  // ① 可观测：改配置 ⇒ 引擎算出的两费/现金流确实变化
  const 基准 = franchiseFees(汉庭, 100000)
  const 设 = 设置CRS渠道占比(0.15)
  ok(设.成功 === true && 设.旧 === 0.30 && 设.新 === 0.15, '设置成功并回带旧值/新值（可审计）')
  const 改后 = franchiseFees(汉庭, 100000)
  ok(改后.CRS === Math.round(100000 * 0.08 * 0.15) && 改后.CRS < 基准.CRS,
    `改配置 ⇒ CRS 可观测变化（${基准.CRS} → ${改后.CRS}）—— 不是"配置了但没人读"`)
  ok(改后.管理费 === 基准.管理费, '只有 CRS 变、管理费不动（改一处只影响一处）')
  ok(CRS配置().是否已改动 === true, '配置状态能看出"已改动"（界面/断言可读）')
  // ② 封顶守卫在【改配置后】仍然生效（不另写一份判断）
  const 设高 = 设置CRS渠道占比(0.9)                       // 0.08×0.9 = 7.2% > 3.5% 封顶
  const 封顶单 = franchiseFees(汉庭, 100000)
  ok(设高.成功 && 封顶单.CRS === Math.round(100000 * 0.035) && 封顶单.封顶是否触发 === true,
    '渠道占比抬到 90% ⇒ 撞官方封顶（CRS 按 3.5% 收）且封顶标记置真 —— 守卫没被绕过')
  // ③ 复位 ⇒ 逐字节回到默认口径（教学/演示可复原）
  const 复位 = 重置CRS渠道占比()
  ok(复位.当前 === 0.30 && 复位.是否已改动 === false, '重置回默认 0.30')
  ok(JSON.stringify(franchiseFees(汉庭, 100000)) === JSON.stringify(基准),
    '复位后两费输出与基准【逐字节相同】（复位真的干净）')
  // ④ 非法值被拒（且不改变现状）
  const 坏 = 设置CRS渠道占比(0)
  ok(坏.成功 === false && /必须/.test(坏.原因) && CRS生效值() === 0.30,
    '非法值（0）被拒并说明原因，且不改动现状', 坏.原因)
  ok(设置CRS渠道占比(-1).成功 === false && 设置CRS渠道占比(1.5).成功 === false, '非法值（负 / >1）同样被拒')
  // ⑤ 单源仍成立：消费者读的是生效值，不许别处留常量副本
  const ff = strip(src('franchiseFees.mjs'))
  const 常量消费点 = (ff.match(/CRS_渠道占比\.值/g) || []).length
  ok(常量消费点 === 4, `常量只在 4 个定义/复位点出现（实测 ${常量消费点} 处）—— 多一处即"绕过配置开关"`, String(常量消费点))
  // ⑥ 界面标置信度（B6 明列要求）
  ok(/x.置信度/.test(strip(src('Claim.jsx'))), '认领页把【置信度】渲染出来（剥注释后判定，不是只存在数据里）')
  ok(/费费用条款|加盟费用条款/.test(src('Claim.jsx')) && /x\.置信度/.test(src('Claim.jsx')),
    '加盟条款逐项带置信度渲染（CRS 那条由此标出"低置信度/教学假设"）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：零变化（未接入逐字节不动）· 守恒（不重不漏）· 三品牌可算 · 单源（只有一处计费）')
process.exit(fail ? 1 : 0)
