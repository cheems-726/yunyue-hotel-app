# 云悦酒店经营模拟 App · 工程交付全景文档

> 本文档是项目的完整技术交付文件，涵盖使用流程、开发路径、网络设置、数据库设计、测试体系、部署架构和已知问题。
> 最后更新：2026-09-22 00:30 · commit ff61867 · 版本 v0.48（代码内 version.js 仍为 0.46，未随批更版）

---

## 一、项目概述

### 1.1 项目定位

面向酒店管理专业学生的**经营模拟教学系统**。学生以小组为单位经营一家华住系酒店 12 周，通过每周 18 项决策（定价/排班/超售/会员/质检/卫生/OTA/活动/协议/口碑等）体验真实酒店运营中的利润/口碑/出租率/差评处理四方权衡。

### 1.2 技术栈

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 前端框架 | React | 18.3.1 | SPA 单页应用，15 个 JSX 组件 |
| 构建工具 | Vite | 5.4.0 | dev server + production build |
| CSS | 纯 CSS（无框架） | - | styles.css 全局样式 |
| BaaS | Supabase | 2.116.0 (supabase-js) | Auth + PostgreSQL + Realtime + pg_cron |
| Android 封装 | Capacitor | 7.6.9 | Android APK（com.yunyue.hotelsim） |
| 部署 | Vercel | - | GitHub push → 自动构建 → CDN |
| 域名 | 2026911301.xyz | - | 腾讯云注册，Vercel DNS |
| 测试 | playwright-core | 1.63.0 | 无头 Edge 端到端（冒烟 74 条 + 彩排/压力/验收脚本，全套 338 条断言） |

### 1.3 代码规模

| 文件 | 行数 | 职责 |
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
| **合计（不含测试用旧引擎副本）** | **9,099** | + settle-old-*.mjs 测试夹具 2,014 行（仅测试引用） | |

---

## 二、完整使用流程

### 2.1 学生端完整流程

#### Phase 1：登录与身份

```
打开 https://www.2026911301.xyz（或 Android APK）
  → 选择身份（学生 / 老师）
  → 输入学号 + 密码（首次自动注册，邮箱=学号@yunyue.study）
  → 或点「无网络？离线演示」进入离线模式（数据存 localStorage，不上云）
  → 登录成功 → 首次看欢迎页 → 点「开始我的酒店之旅」
```

#### Phase 2：选址（不可逆，选定后整个学期不可换）

```
选址页
  → 地图选点（5 城 22 区县，按真实地理方位摆放）
     - 成都 9 区：都江堰/金牛/青羊/武侯/锦江/高新/双流/龙泉驿/简阳
     - 德阳 4 区：绵竹/旌阳/广汉/中江
     - 绵阳 4 区：江油/游仙/涪城/三台
     - 承德 4 区：双桥/双滦/承德县/围场
     - 重庆 4 区：解放碑/观音桥/南滨路/沙坪坝
  → 每区显示六维属性条（客流/房价/租金/竞争/人力/波动，1-5 档）
     + 六维雷达图 + 客群画像行 + 优势/代价 + 推荐档次
  → 点击选中区县 → 弹出选址反馈（含「决策前想一想」教学提示）
  → 确认选址 → 进入品牌选择
```

#### Phase 3：品牌选择

```
品牌页（19 个华住品牌，5 档）
  → 经济型·国民：汉庭/你好/宜必思/海友/曙辉
  → 中档型：全季/桔子/星程/CitiGo
  → 中高档：桔子水晶/美居/美仑/施柏阁(s)
  → 高档：禧玥/花间堂/施柏阁/诺富特
  → 奢华：宋品/施柏阁大观
  → 每品牌显示：加盟费/投资成本/房价带/品牌标准/描述
  → 点击品牌 → 弹出选择反馈（含经营建议）
  → 确认品牌 → 进入认领
```

#### Phase 4：认领（经营模式 + 物业）

```
认领页
  → 选择经营模式（不可更改！）
     - 自主直营：无佣金/无流量扶持/定价自由/前期获客难
     - OTA平台合作：佣金15%/平台流量扶持/降价受限制/违规处罚
  → 选择物业（按品牌标准匹配候选物业）
  → 走完 6 步认领流程（意向申请→项目初审→实地勘址→项目决策→商务洽谈→合同签署）
  → 确认认领 → 进入筹建
```

#### Phase 5：筹建（4 步，全部需要选择）

```
筹建页
  → Step 1 投资测算
     - 三情景单选（乐观 80%+/基准 65%/悲观 50%）
     - 必须选择才能进入下一步（按钮有门控）
  → Step 2 证照办理
     - 6 张证照点击展开详情
  → Step 3 物资采购
     - 三供应商单选
     - 必须选择
  → Step 4 开业计划
     - 三任务排优先级（按点击顺序 1/2/3）
     - 排满才能开业
  → 完成筹建 → 开业反馈弹窗（含筹建决策汇总）→ 进入经营页
```

#### Phase 6：经营（12 周循环）

```
经营页（核心页面）
  顶部：
    - 模拟日历 + 运营时段 + 酒店状态面板 + 今日入住四宫格 + 实时流水 + 动态流 + 房型结构
  中部：
    - 18 项决策列表（我的职责置顶 + 蓝徽章）
    - 决策面板（近3周轨迹 + 上周参考 + 教学提示）
  底部：
    - 四 tab 导航（经营/报表/口碑/我的）
    - 口碑 tab 数字气泡（待处理差评条数）

每周循环：
  1. 做 18 项决策（做完自动沉底，可修改；满18弹庆祝toast + 结算按钮脉冲）
  2. 点「本周结算」→ 周结算报告（四维评分+事件+决策摘要可展开tip+预测+成绩单复制）
  3. 切口碑 tab → 处理差评（回复/整改/不处理；发酵预警）
  4. 切报表 tab → 查看趋势（盈亏平衡+出租率利润折线）
  5. 切我的 tab → 查看称号（sparkline+轨迹+档案+老师评语+备份）
  6. 点「进入第 N+1 周」→ 循环
```

#### Phase 7：学期总结（12 周结束后）

```
FinalResult 页
  → 总成绩大数字 + 等级
  → 四维评分明细
  → 学期画像回顾（策略风格标签 + 称号轨迹 + 事件统计摘要）
  → 事件应对复盘卡（历次危机 + 应对 + 结果 + 决策完成数）
  → 最值得复盘的一周（波动最大 + 该周事件）
  → 经营总结（RevPAR 教学行）
  → 一键复制成绩单（含班级组号/姓名/策略/轨迹/教师批注摘要）
  → 重新开始经营
```

### 2.2 教师端完整流程

```
登录 → 教师 t001/123456 → 底部三导航

📡 实时决策（默认页）
   - 全班统计条（决策数/人均完成/最近提交时间）
   - 周次筛选chips（实时/第1周~第12周快照回放）
   - 各组决策流卡片（决策chips点击弹详情：学生选择+设计考量+课堂提示）
   - Realtime 自动刷新

🏆 排名
   - 排序维度chips（综合评分/累计利润/平均出租率/口碑）
   - 策略分布统计卡
   - 各组排名卡片（奖牌/称号/轨迹/策略标签/职责完成度/得分环比）
   - 点击展开下钻：
      - 称号进度 + 轨迹（变化周记录）
      - 职责决策完成明细（含负责人姓名 + 去完成深链）
      - 批注时间线（增/改/删）
      - 批注表单（快捷按钮4档/字数软上限）
   - CSV 导出

👤 我的
   - 教师信息卡 + 本班统计摘要（三格可点击跳转）
   - 功能入口（班级总览/分组管理/教学参考）
   - 退出登录

📊 班级总览（从"我的"进入）
   - 全班策略分布chips
   - 教学进度控制（锁周）
   - CSV 导出
   - 各组卡片
```

### 2.3 组队共管机制

```
老师在分组管理页设置学生的 班级+组号
  → 同班级+同组号的学生自动共享一份 game_state（组档）
  → 任何人登录看到的都是同一份进度

角色设定：
  → 小组成员页每人点击职业卡片
  → 写入 profiles.role_in_group（独立字段）
  → 经营页职责决策自动置顶 + 蓝「我的职责」徽章

组档共享 RLS：
  → game_states_group_write: 同组可写
  → game_states_group_read: 同组可读
```

---

## 三、数据库设计

### 3.1 表结构

**profiles（用户档案）**

| 列 | 类型 | 说明 |
|---|---|---|
| user_id | uuid PK | FK→auth.users |
| role | text | 'student' 或 'teacher' |
| display_name | text | 显示名 |
| group_no | integer | 组号 |
| class_name | text | 班级 |
| student_no | text | 学号 |
| role_in_group | text | 组内职业（manager/lobby/finance/ops/hr） |
| created_at | timestamptz | 创建时间 |

**game_states（游戏存档，JSONB 整包）**

| 列 | 类型 | 说明 |
|---|---|---|
| user_id | uuid PK | FK→auth.users |
| state | jsonb | 整包含 location/brand/property/estChoices/doneDecisions/report/week/history/finished/welcomed |
| week | integer | 冗余周次 |
| finished | boolean | 是否结业 |
| group_key | text | 组档共享键（'班级\|组号'） |
| updated_at | timestamptz | 最后更新 |

**teacher_notes（教师批注）**

| 列 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | 自动生成 |
| student_uid | uuid | FK→auth.users |
| teacher_uid | uuid | FK→auth.users |
| week | integer | 周次 |
| note | text | 批注内容 |
| score | integer | 0-100 |
| created_at / updated_at | timestamptz | |

**class_state（教学进度控制）**

| 列 | 类型 | 说明 |
|---|---|---|
| id | integer PK | |
| current_week | integer | 0=不限制 |
| updated_at | timestamptz | |

**settle_runs（pg_cron 防重入）**

| 列 | 类型 | 说明 |
|---|---|---|
| run_date | date PK | |
| status / settled / skipped / results / started_at / finished_at | | 结算日志 |

### 3.2 RLS 策略清单

| 表 | 策略名 | 操作 | 规则 |
|---|---|---|---|
| profiles | profiles_select | SELECT | authenticated |
| profiles | profiles_insert_own | INSERT | user_id = auth.uid() |
| profiles | profiles_update_own | UPDATE | user_id = auth.uid() |
| profiles | profiles_teacher_update | UPDATE | role = 'teacher' |
| game_states | game_states_self | ALL | user_id = auth.uid() |
| game_states | game_states_group_read | SELECT | 组内成员可读组档 |
| game_states | game_states_group_write | ALL | 组内成员可写组档 |
| game_states | game_states_teacher_read | SELECT | role = 'teacher' |
| teacher_notes | teacher_notes_student_read | SELECT | student_uid = auth.uid() |
| teacher_notes | teacher_notes_teacher_all | ALL | teacher_uid = auth.uid() |
| teacher_notes | teacher_notes_teacher_delete | DELETE | teacher_uid = auth.uid() |
| class_state | class_state_read | SELECT | authenticated |
| class_state | class_state_teacher_write | UPDATE | role = 'teacher' |
| settle_runs | settle_runs_teacher_read | SELECT | role = 'teacher' |

---

## 四、测试体系

### 4.1 引擎与专项测试（8 个脚本 · 270 条断言）

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
> acceptance-cloud-save.mjs 与 verify-n8.mjs（需云端凭据，默认跳过）

### 4.2 UI 冒烟测试

- 运行：`npm run test:ui`（= npm run build + node tests/ui-smoke.mjs）
- 断言：74 项
- 耗时：约 2-3 分钟
- 环境：playwright-core + 系统 Edge 无头，自动起 vite preview (port 4173)
- 覆盖：完整学生链路（58 项离线）+ 教师端（16 项云端，需测试账号 t001）
- 特色：**几何布局断言**（assertLayout：导航栏在视口内/滚到底末元素可达，专防 9-19 布局回归）+
  渲染整洁断言 + 流水持久化断言 + dialog 自动接受 + 重试机制
- ⚠️ 云端段受 Supabase 登录限流影响：短时间连跑多次会出现「教师登录失败」连带 2 条红，
  隔 10-15 分钟自愈（非代码问题）

---

## 五、开发路径与迭代历史

| 阶段 | 时间 | 交付 |
|------|------|------|
| Phase 1 核心框架 | 9/8-9/9 | React+Vite+Supabase / 6步开店 / 12周循环 / 结算引擎v1 / 教师端基础 |
| Phase 2 内容丰富 | 9/9-9/11 | 决策18项/事件15种/口碑页/周报/帮助页/组队共管/Realtime |
| Phase 3 深度打磨 | 9/12-9/16 | 词云评分/轨迹/事件来源/策略分布/发酵预警/实时面板/CSV/帮助FAQ |
| Phase 4 稳定性 | 9/16-9/20 | 修复6个真bug/渲染整洁断言/流水持久化/RLS补齐/排序切换/策略分布/路径/清洁闭环 |

---

## 六、已知问题与教训

### 已修复

| Bug | 根因 | 提交 |
|-----|------|------|
| 选址页承德/重庆白屏 | cityGeo 缺数据 | 3b4ebd8 |
| 品牌页白屏 | location 变量污染 | 3b4ebd8 |
| 实时流水刷新回退 | 数据只在内存 | 9fb4320 |
| 侧滑返回退出 | 无 popstate 拦截 | 同上 |
| 改名 prompt 移动端不弹 | window.prompt 兼容性 | 自定义弹窗 |
| 运营动态乱码 | 转义残留 14 处 | fd92bb0 |
| 删除批注静默失败 | RLS 缺 delete 策略 | _add-note-delete.cjs |
| me 视图缺闭合 div | 补丁半途失败 | 1032794 |
| preOpen 缺 state 声明 | 同上 | 072afcd |
| cloudLogin 缺 dialog handler | 同上 | ea1d448 |

### 待用户裁决（2026-09-21 夜 A3/A4 量化，**遵"不改结算数值口径"未动**）

| 现象 | 证据 | 建议 |
|------|------|------|
| 好评率可为负 | finalGoodRate=(reviewCount−negativeImpact)/reviewCount，而 negativeCount 会因「差评潮/超售」额外 +1 → 实测 −100%/−50% 共 66 处（彩排 26 + 压力 40） | 加下限保护（`Math.max(0, …)` 或先 clamp negativeCount ≤ reviewCount） |
| 逆袭型 12 周追不回 | 前 6 周省钱 + 后 6 周勤奋 = 42,091 < 一路省钱 43,166 | 是否要"半程翻盘"成立属教学决定（调衰减 / 调欠账惩罚 / 保持现状） |
| 单靠超售不亏钱 | 连续 30 周超售 5 间仅 +10,776（近乎打平）；真正亏损来自"激进全家桶"（12 周 −37,878） | 是否加重超售惩罚 |

### 踩坑模式

1. python patch 多段替换：assert 失败整个不写盘
2. build 结果必须独立确认（grep ✓ built）
3. 转义修复后 grep 同批衍生物
4. CronUpdate 传 interval 会锚定漂移
5. 弹 dialog 的页面必须挂 handler
6. 会弹全屏面板的断言放最后或确认面板已关闭

---

## 六、剩余待办

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
| 离线缓存完善 | 低 |

---

*本文档由自动化接力更新 · 引擎与专项 338/1（1 条为端到端弹性断言，已定位）· 冒烟 74/74 · 本地提交待用户推送*
