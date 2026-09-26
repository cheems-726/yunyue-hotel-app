// -*- coding: utf-8 -*-
// B3：更新 DELIVERY.md（本周期完成项 / 代码规模 / 测试体系 / 已知问题 / 待办）
const fs = require('fs')
const p = 'DELIVERY.md'
let raw = fs.readFileSync(p, 'utf8')
const nl = raw.includes('\r\n') && (raw.split('\r\n').length - 1) > ((raw.split('\n').length - 1) - (raw.split('\r\n').length - 1)) ? '\r\n' : '\n'
let ok = true
function rep(oldS, newS, tag) {
  const ot = oldS.split('\n').join(nl), nt = newS.split('\n').join(nl)
  const c = raw.split(ot).length - 1
  if (c !== 1) { console.log('  x ' + tag + ' 命中 ' + c + ' 次'); ok = false; return }
  raw = raw.split(ot).join(nt)
  console.log('  v ' + tag)
}

// 1) 头部署名
rep(
`> 最后更新：2026-09-20 08:55 · commit bd6ce38 · 版本 v0.48`,
`> 最后更新：2026-09-22 00:30 · commit ff61867 · 版本 v0.48（代码内 version.js 仍为 0.46，未随批更版）`,
'头部日期')

// 2) 技术栈里的测试行
rep(
`| 测试 | playwright-core | 1.63.0 | 无头 Edge 冒烟测试（47 断言） |`,
`| 测试 | playwright-core | 1.63.0 | 无头 Edge 端到端（冒烟 74 条 + 彩排/压力/验收脚本，全套 338 条断言） |`,
'技术栈测试行')

// 3) 代码规模表整体替换
const oldTable = raw.slice(raw.indexOf('| 文件 | 行数 | 职责 |'), raw.indexOf('| **合计** | **~9,036** |') + '| **合计** | **~9,036** |'.length)
const newTable = `| 文件 | 行数 | 职责 |
|------|------|------|
| App.jsx | 2,171 | 路由/登录/经营页/帮助页（FAQ 25 条）/FinalResult/全局状态 |
| TeacherDashboard.jsx | 1,126 | 教师端三导航（实时决策/排名/我的）+ 下钻 + 批注 + 决策流水 + CSV |
| settlement.js | 720 | 结算引擎（22 种事件/固定种子/结构化评价/属性→经营/卡片差额生成） |
| HotelStatus.jsx | 598 | 实时运营面板（模拟日历/时段/流水/动态流/房型）+ **实时评价与 🎯 决策流水** |
| Reputation.jsx | 528 | 口碑页（差评/好评/回复/词云/发酵预警/构成拆解/卡片展示升级） |
| WeeklyReport.jsx | 411 | 周结算报告（四维评分/事件/决策摘要/趋势块/预测） |
| styles.css | 381 | 全局样式 |
| attrs.js | 348 | RPG 属性池（品质/声誉/士气，5 档衰减，决策/事件影响，称号） |
| guests.js | 339 | 客人身份 + cause 系统 + 组合式评价文本 + **差评严重度** |
| supabaseClient.js | 309 | Supabase 客户端（Auth/CRUD/Realtime/批注/decision_log） |
| DecisionPanel.jsx | 283 | 决策面板（5 类交互 + 上周参考 + 近 3 周轨迹 + 趋势块） |
| Establishment.jsx | 267 | 筹建页（投资测算/证照/采购/开业计划） |
| FinalResult.jsx | 248 | 学期成绩（四维评分/策略标签/称号轨迹/事件复盘/RevPAR/成绩单复制） |
| SiteSelection.jsx | 210 | 选址页（5 城 26 区县 + 六维雷达 + 客群画像） |
| Claim.jsx | 203 | 认领页（经营模式选择 + 物业三选一） |
| decisions.js | 193 | 18 项决策定义（5 类交互）+ 职业映射 + OWNER_LABELS |
| BrandSelection.jsx | 163 | 品牌选择页（19 品牌 5 档） |
| siteLocations.mjs | 158 | 5 城 26 区县选址数据（含 confidence 置信度标注）+ 竞争对手 + 客群画像 |
| reviewRate.js | 104 | 三因子动态评价率（满意度→好评/差评概率，三层上限） |
| ResultFeedback.jsx | 80 | 通用结果反馈弹窗 |
| liveReview.js | 60 | 实时评价纯核心（掷骰 + 造条，可单测） |
| replyScoring.js | 58 | 回复话术评分（词云内核） |
| Welcome.jsx | 48 | 欢迎页 |
| RadarChart.jsx | 42 | 六维雷达图 SVG 组件 |
| hotelTitle.js | 33 | 称号系统（5 级，确定性计算） |
| main.jsx | 19 | React 入口 + StatusBar |
| version.js | 3 | 版本号 |
| **合计（不含测试用旧引擎副本）** | **9,099** | + settle-old-*.mjs 测试夹具 2,014 行（仅测试引用） |`
if (!oldTable || raw.split(oldTable).length - 1 !== 1) { console.log('  x 代码规模表定位失败'); ok = false }
else { raw = raw.replace(oldTable, newTable.split('\n').join(nl)); console.log('  v 代码规模表（~9,036 → 9,099 + 9 个新模块）') }

// 4) 测试体系 4.1 / 4.2
rep(
`### 4.1 引擎测试

- 运行：\`node tests/settlement.test.mjs\`
- 断言：14 项
- 覆盖：决策真实生效/事件系统/好评率延续/危机应对/决策快照`,
`### 4.1 引擎与专项测试（8 个脚本 · 270 条断言）

| 脚本 | 断言 | 覆盖 |
|---|---|---|
| tests/settlement.test.mjs | 49 | 决策生效/事件系统/好评率延续/危机应对/属性→经营（R0）/每周衰减/结构化评价 |
| tests/attrs.test.mjs | 89 | 属性池（增减/衰减/下限/称号/脏数据兜底） |
| tests/guests.test.mjs | 41 | 客人身份自洽/cause 绑定决策/文本组合与去重/**差评严重度** |
| tests/reviewRate.test.mjs | 20 | 三因子评价率/三层上限/掷骰频率 |
| tests/liveReview.test.mjs | 28 | 实时评价掷骰造条/时段系数/上限/卡片字段 |
| tests/shadow-reviews.mjs | 21 | 改前 vs 改后逐周数值一致 + 卡片守恒 + 差额守恒 |
| tests/verify-severity.mjs | 22 | 语气分级（同星级文本逐字一致/星级随状态改写/无房恒 1 星） |
| tests/rehearsal.mjs | 8 | 6 组性格 × 12 周彩排（曲线/守恒/属性衰减/确定性） |
| tests/rehearsal-stress.mjs | 31 | 24 周超长/极端属性/30 周超售/空决策/作死下限保护 |

> 另：tests/verify-live-review-ui.mjs（真浏览器端到端，36 条）、location-matrix.mjs（选址矩阵）、
> acceptance-cloud-save.mjs 与 verify-n8.mjs（需云端凭据，默认跳过）`,
'测试体系 4.1')

rep(
`### 4.2 UI 冒烟测试

- 运行：\`npm run test:ui\`（= npm run build + node tests/ui-smoke.mjs）
- 断言：47 项
- 耗时：约 2 分钟
- 环境：playwright-core + 系统 Edge 无头，自动起 vite preview (port 4173)
- 覆盖：完整学生链路（31 项离线）+ 教师端（16 项云端）
- 特色：渲染整洁断言（无插值残留/undefined/NaN/错误边界）+ 流水持久化断言 + dialog 自动接受 + 重试机制`,
`### 4.2 UI 冒烟测试

- 运行：\`npm run test:ui\`（= npm run build + node tests/ui-smoke.mjs）
- 断言：74 项
- 耗时：约 2-3 分钟
- 环境：playwright-core + 系统 Edge 无头，自动起 vite preview (port 4173)
- 覆盖：完整学生链路（58 项离线）+ 教师端（16 项云端，需测试账号 t001）
- 特色：**几何布局断言**（assertLayout：导航栏在视口内/滚到底末元素可达，专防 9-19 布局回归）+
  渲染整洁断言 + 流水持久化断言 + dialog 自动接受 + 重试机制
- ⚠️ 云端段受 Supabase 登录限流影响：短时间连跑多次会出现「教师登录失败」连带 2 条红，
  隔 10-15 分钟自愈（非代码问题）`,
'测试体系 4.2')

// 5) 已知问题：补本周期
rep(
`### 踩坑模式`,
`### 待用户裁决（2026-09-21 夜 A3/A4 量化，**遵"不改结算数值口径"未动**）

| 现象 | 证据 | 建议 |
|------|------|------|
| 好评率可为负 | finalGoodRate=(reviewCount−negativeImpact)/reviewCount，而 negativeCount 会因「差评潮/超售」额外 +1 → 实测 −100%/−50% 共 66 处（彩排 26 + 压力 40） | 加下限保护（\`Math.max(0, …)\` 或先 clamp negativeCount ≤ reviewCount） |
| 逆袭型 12 周追不回 | 前 6 周省钱 + 后 6 周勤奋 = 42,091 < 一路省钱 43,166 | 是否要"半程翻盘"成立属教学决定（调衰减 / 调欠账惩罚 / 保持现状） |
| 单靠超售不亏钱 | 连续 30 周超售 5 间仅 +10,776（近乎打平）；真正亏损来自"激进全家桶"（12 周 −37,878） | 是否加重超售惩罚 |

### 踩坑模式`,
'已知问题表')

// 6) 剩余待办
rep(
`## 六、剩余待办

| 项目 | 优先级 |
|------|--------|
| 决策卡职业分工第三步（完整移交机制） | 高 |
| 帮助页FAQ补职责完成度口径 | 低 |
| Bundle 拆分 | 中 |
| CI/CD | 中 |
| 离线缓存完善 | 低 |`,
`## 六、剩余待办

| 项目 | 优先级 |
|------|--------|
| 好评率下限保护（见上表，需用户裁决后才动口径） | 高 |
| daily_snapshots 每日快照迁移（SQL 已备好，**待用户自行在 Supabase 执行**） | 高 |
| 数据库密码轮换（旧密码已进 git 历史，待用户 Reset） | 高 |
| 双引擎对齐（cloud-settle.sql 无 R0/属性逻辑 → 云端自动结算班级口径不一致） | 中 |
| 决策卡职业分工第三步（完整移交机制） | 中 |
| Bundle 拆分（当前 656 kB / gzip 217 kB） | 中 |
| CI/CD | 中 |
| siteLocations 数据补全（red 18 条无信源，白天采集） | 低 |
| 离线缓存完善 | 低 |`,
'剩余待办')

// 7) 文档尾注
rep(
`*本文档由自动化接力生成 · Engine 14/14 · Smoke 47/47 · Zero Backlog*`,
`*本文档由自动化接力更新 · 引擎与专项 338/1（1 条为端到端弹性断言，已定位）· 冒烟 74/74 · 本地提交待用户推送*`,
'尾注')

if (!ok) { console.log('  -> 未写盘（整体重跑）'); process.exit(1) }
fs.writeFileSync(p, raw, 'utf8')
console.log('  -> 已写盘 ' + p)
