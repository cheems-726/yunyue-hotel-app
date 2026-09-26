// B6 · 数据字典 + 口径静态检查
// 运行：node tests/dataDict.check.mjs   （进 run-all 门禁）
// 字典本身在 src/dataDict.js（代码与文档同源）

// ── 字典（权威口径总表）──
export const DATA_DICT = [
  { key: 'occupancy',       中文名: '出租率',        单位: '0-100（百分比整数）', 权威来源: 'settle() 返回 / 日引擎汇总', 允许用途: '周报/评分/教师端展示', 禁止用途: '组件自行用 occupiedRooms/rooms 重算（口径漂移根源）' },
  { key: 'rooms',           中文名: '房量',          单位: '间（整数）',           权威来源: 'parseRooms(brand.standard)（A3 唯一权威）', 允许用途: '房型结构/在店分摊/投资测算', 禁止用途: 'property.rooms（那是建筑面积话术 72-95，非可排房量）' },
  { key: 'capital',         中文名: '资金',          单位: '元（整数）',           权威来源: 'settle() 返回的 capital（写回 state.capital）', 允许用途: '资金卡/周报期末资金', 禁止用途: '500000−ΣtotalExpenses+Σprofit 等本地公式（双重扣成本已修）' },
  { key: 'goodRate',        中文名: '好评率',        单位: '0-100',                权威来源: 'settle().finalGoodRate（P4 夹取保证 ≥0）', 允许用途: '周报/口碑页/RPG', 禁止用途: '(好评数/评价数) 的组件端重算（与"道歉减半"口径不符）' },
  { key: 'negativeCount',   中文名: '差评数',        单位: '条',                   权威来源: 'settle().negativeCount（P4 后 ≤ reviewCount）', 允许用途: '周报/差评卡目标数', 禁止用途: 'UI 侧自行数星星（星级≤3 是展示口径）' },
  { key: 'handleRate',      中文名: '差评处理率',    单位: '0-100%',               权威来源: 'A4 周快照 handleStats（resolved/(pending+resolved)）', 允许用途: '口碑页/期末 15% 维度/教师端排名', 禁止用途: '实时数口碑页卡片（kept 过滤后只剩当周，会错）' },
  { key: 'attrs',           中文名: '品质/声誉/士气', 单位: '0-100 各项',          权威来源: 'state.attrs（normalizeAttrs 兜底；settle 返回 attrsAfter 写回）', 允许用途: '属性条/飘字/引擎入参', 禁止用途: '从品牌/好评率反推（N2 已统一）' },
  { key: 'classWeek',       中文名: '教学周锚',      单位: '周（1-18）/日（classDay）', 权威来源: '服务端（B2：class_settings，设备时钟零参与）', 允许用途: '结算窗口/事件同步/补算上界', 禁止用途: '本地 new Date() 推算' },
  { key: 'guests(在店)',    中文名: '在店规模',      单位: '间（客房）与 人（估算）严格分列', 权威来源: 'occRooms（间）；fullGuests（人，标注"估算"）', 允许用途: '实时面板（带单位标签）', 禁止用途: '把"间"标成"人"（审计问题①已修）' },
  { key: 'liveReviews',     中文名: '实时评价',      单位: '条（live 标记）',      权威来源: 'liveReview 掷骰（独立流 0x5A17A2）', 允许用途: '口碑页展示/流水', 禁止用途: '计入 pendingNegatives（口径批③：欠账只数结算卡，公平性红线）' },
  { key: 'weeklyExpenses',  中文名: '周成本构成',    单位: '元（分项）',           权威来源: 'settle().weeklyExpenses', 允许用途: '周报成本条形图', 禁止用途: '前端按 65/30/25 元硬编码重算（已修）' },
  { key: 'keptRand/guestsRng', 中文名: '随机流',     单位: '—',                    权威来源: '结算 rand（全班同种子）/ guestsRng 独立流 / liveReview 0x5A17A2', 允许用途: '各自领域', 禁止用途: '交叉调用（污染随机序列=破坏全班可比性）' },
]

// ── 静态检查：找"绕过权威来源自己算"的残留 ──
import { readFileSync, readdirSync } from 'node:fs'

const VIOLATION_PATTERNS = [
  { id: 'V1', desc: '本地重算资金（双重扣成本旧公式）', re: /500000\s*-\s*history\.reduce/g, whitelist: [] },
  { id: 'V2', desc: '房量读 property.rooms（应走 parseRooms）', re: /property\?\.rooms|property\.rooms/g, whitelist: ['src/Claim.jsx'] },   // Claim 物业卡展示话术已标注，允许
  { id: 'V3', desc: '组件端重算成本构成', re: /occupied\s*\*\s*\d+\s*:\s*\d+/g, whitelist: [] },
  // reviewRate.js 的 1 处 = rnd 兜底分支（`typeof rnd === 'function' ? rnd() : Math.random()`），
  // guests.test.mjs 的 T4 断言已精确限制它必须在兜底行 → 这里白名单放行，避免两套口径
  { id: 'V4', desc: '源码出现 Math.random（评价相关模块零容忍，其余 UI 动画允许）', re: /Math\.random/g, whitelist: ['src/HotelStatus.jsx', 'src/App.jsx', 'src/Reputation.jsx', 'src/Establishment.jsx', 'src/WeeklyReport.jsx', 'src/reviewRate.js'] },
  { id: 'V5', desc: '把在店"间"标成"人"', re: /在店客人/, whitelist: [] },
]

const files = readdirSync('src').filter(f => /\.(js|jsx|mjs)$/.test(f) && !f.startsWith('settle-old'))
let violations = []
const codeOnly = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
for (const f of files) {
  const path = 'src/' + f
  const src = codeOnly(readFileSync(path, 'utf8'))   // 剥注释：guests.test.mjs 同款（🔴 注释里提到模式名不算违规）
  for (const v of VIOLATION_PATTERNS) {
    if (v.whitelist.includes(path)) continue
    const hits = src.match(v.re)
    if (hits) violations.push({ file: path, id: v.id, desc: v.desc, count: hits.length })
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('\\').pop())) {
  console.log('▶ B6 数据字典口径检查')
  console.log(`  字典条目：${DATA_DICT.length} 项（occupancy/rooms/capital/goodRate/negativeCount/handleRate/attrs/classWeek/guests/liveReviews/weeklyExpenses/随机流）`)
  if (!violations.length) console.log('  ✅ 现存违规：0 处（A1/A3/A4/口径批 的旧口径已全部清除）')
  else {
    console.log(`  ⚠️ 违规 ${violations.length} 处：`)
    violations.forEach(v => console.log(`   ${v.id} ${v.file} ×${v.count} — ${v.desc}`))
  }
  process.exit(violations.length ? 1 : 0)
}
