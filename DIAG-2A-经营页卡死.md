# 2A 诊断报告：经营页"卡死 / 拖不动 / 底部导航栏消失"

> 诊断时间：2026-09-20（只诊断，未改任何业务代码）
> 复现载体：`tests/_fixture12w.json`（真实 settle 引擎产出的第 12 周存档，21.8 KB）+ Playwright/Edge 移动视口 412×915 + CDP CPU 降频
> 工具链：`tests/_perf-probe2.mjs`（动画 A/B）、`tests/_perf-layout.mjs`（几何+截图）、`tests/_perf-fixcheck.mjs`（修复注入）、`tests/_perf-final.mjs`（display:contents 反证）、`tests/_perf-teacher.mjs`（教师端）

---

## 结论（先看这个）

**不是 JS 崩溃、不是数据库、不是主线程被计算吃满 —— 是一个 2026-09-19 引入的 CSS flex 布局回归。**

经营页的中间包装层 `<div key={...} style={{animation:'pageIn ...'}}>` 是 `.app`（`display:flex; flex-direction:column; height:100dvh; overflow:hidden`）的直接子元素，用的是默认样式 **`flex: 0 1 auto` + `min-height: auto`**。因为它的内容（整个经营页）高 3061px，自动最小尺寸 = 内容高度，**它拒绝收缩**，于是：

| 症状 | 机制 | 实测 |
|---|---|---|
| **拖不动** | `.content` 的框高被撑到 3061px，`scrollHeight === clientHeight` → **内部零滚动区间**；而 `body { overflow: hidden }` 又堵死了整页滚动 | `canScrollContent: false`、`canScrollWindow: false` |
| **底部导航栏消失** | `.tabbar` 被顶到 y=3105（视口只有 915），再被 `.app { overflow: hidden }` 裁掉 → 物理不可见 | `tabbar.top=3105, bottom=3196`，`tabbarVisible: false` |
| **卡死** | 页面看起来"死了"：下半屏内容永远够不到、导航栏永远不出现 | 截图 `tests/_shot-biz-top.png`（无导航栏）|

**注入一行修复即复活**（`flex:1 1 0; min-height:0; display:flex; flex-direction:column`）：

```
修复前：content h=3061 scrollH=3061 | tabbar top=3105 | 可见 false | 可滚动 false
修复后：content h=780  scrollH=3061 | tabbar top=824 bottom=915 | 可见 true | 可滚动 true
```
对照截图：`tests/_shot-fixed.png`（导航栏"经营/报表/口碑/我的"正常贴底）

---

## 逐条回应你列的 5 个排查方向

### ① HotelStatus LiveFeed 实时循环 —— **实测排除（数据见下）**

| 你的问题 | 实测结果 |
|---|---|
| a. 每秒触发几次？是否超预期？ | **0.47 次/秒**（15s 内 `setTimeout(2000)` 创建 7 次 = 每 2.14s 一次），与设计 1 次/2s 完全一致 |
| b. `persist()` 单次耗时 | **0.3 ms**（7 次共 2.1 ms，写 0.8 KB） |
| c. 是否存在多个 loop 定时器并存？ | **不存在**。`T2000` 计数 = 循环次数，若是双实例会翻倍；14 秒内含 7 次 persist 与 7 次 setItem 一一对应 |
| d. `occupiedRooms/price` 是否每次渲染都变？ | **稳定**。经营页 `report=null`，取 `history[末条].occupiedRooms`（66）与 `price` 回落 230 → effect 依赖不变，`[occupiedRooms,price,week]` 未反复重建（`T1500` 只创建 1 次） |
| e. 第 12 周 `occupiedRooms` 是否异常大？ | **正常**：66 间（页面显示"在店客人 129 人"= 66×2−3 ✓）；循环体是 O(1) 运算 + 极小数组 filter，**计算量不随周数增长** |

CPU Profile 归因：经营页静置 12s 采样中**没有任何以 `persist`/`loop`/`setStats` 为主的样本**，长任务 0 个（`tests/_perf-diag.mjs` 阶段 A）。

### ② 其它高频定时器 —— **排除**
全库定时器清点（`grep setInterval`）：App 30s ×1、HotelStatus clock 30s ×1、liveGuests 6s ×1、LiveFeed 2s ×1、周报 rAF 仅结算动画期间。插桩实测：**各 1 个实例，无叠加**；15s 静置窗口内长任务 0 个、LoAF 0 个。

### ③ 经营页 vs 周报页组件树 diff —— **这就是根因所在**

```
经营页  .app > [statusbar, ★包装层div, toast栈, tabbar]
                        └─ .content（唯一滚动区）
周报页  .app > [statusbar, .content]        ← 早返回分支，没有包装层、没有 tabbar
```
`WeeklyReport.jsx:111` 的根元素直接就是 `<div className="content">`，是 `.app` 的 flex 子项，`overflow-y:auto` 使它的 `min-height` 自动归零 → **正常收缩 + 正常滚动**。经营页多了那个包装层 → 整条 flex 链断掉。

### ④ App.jsx 云端同步 `JSON.stringify(cloudState)` —— **排除（不是放大器）**
12 周存档实测 **21.8 KB**；静置 15s 内 `JSON.stringify` 共调用 **7 次 / 合计 0.3 ms**（均值 0.04 ms）。App 级 localStorage 持久化写入同为 0 次（静置无状态变化）。量级上不可能参与卡死。

### ⑤ 12 周大存档复现 —— **稳定复现（第 1 周也复现）**

| 存档 | 包装层高 | content 框高 | tabbar top | 可见 | 可滚动 |
|---|---|---|---|---|---|
| 第 12 周（history 11 条） | 3061 | 3061 | 3105 | ❌ | ❌ |
| 第 1 周（history 空） | 2494 | 2494 | 2538 | ❌ | ❌ |

**结论：与周数无关**——只要页面内容超过视口高度就必现（经营页内容恒为 2500-3100px，手机视口 ~800-900px）。

**最小复现条件**：任意学生账号 → 进入经营页（任何周）→ 底部导航栏不在视口内 + 内容区完全无法滚动。桌面 Chrome 同样复现（几何完全一致），并非手机专属。

---

## 回归溯源：哪个改动引入的

```
git blame src/App.jsx:2069
cc0931b9 (2026-09-19 00:07)  style: 导航切换动画统一（导航打磨队列）
  - 学生端tab/子页切换、教师端view切换：内容区统一 pageIn 0.25s（fade+上移）
  - 用 key 重挂载触发
```

改动前 `AppErrorBoundary` 用 `return this.props.children`（App.jsx:1545，**不产生 DOM 节点**），所以结构是 `.app > .content`，flex 链完整 → **布局本来是好的**。该提交为了让切换有动画，插入了一个带 `animation` 的包装 `<div>`，**没有同步给它 flex 约束**，从此布局断链。

反证实验（`tests/_perf-final.mjs`）：只给包装层加 `display: contents`（= 让它的盒子不参与布局，等价于改坏前的结构）→ `content h=780 / tabbar 可见 / 可滚动` **立刻恢复正常**。**证明包装层是唯一根因。**

### 教师端同样中招（同一提交）
`TeacherDashboard.jsx:521` 是同款包装层，但教师端 `.tabbar` 在 **`.content` 内部**（父链 `DIV.tabbar < DIV.content < DIV.app`），实测：

| 教师视图 | 包装层高 | tabbar top | 可见 |
|---|---|---|---|
| 实时决策 | 826 | 957 | ❌ |
| 排名 | 820 | 953 | ❌ |
| 我的（内容短） | 527 | 648 | ✅ |

教师端滚动时 tabbar 跟着移动（957 → 748），即"导航栏被放在滚动内容的最底部"，长页面时必须滚到底才能看见。

---

## 次要放大器（不是"拖不动/导航栏消失"的原因，但让手机更"卡"）

**`pulseBorder` 无限动画** — `App.jsx:464` 给"下一项待决策"卡挂内联样式：
```jsx
style={{ border:'2px solid #E8940F', animation:'pulseBorder 1.5s ease-in-out infinite' }}
```
`@keyframes pulseBorder`（styles.css:373）动的是 **`border-color` + `box-shadow`（含 4px 扩散）**——两者都不是合成层属性，**每帧都要重绘**，且 `infinite` 永不停止。A/B 对照实验（CPU 降频 10×，同存档、同视口）：

| 场景 | FPS | 长任务 / 长动画帧 |
|---|---|---|
| 经营页静置 · 动画开 | **114.5** | 0 |
| 经营页静置 · 动画全关 | **179** | 0 |
| 经营页滚动 · 动画开 | **104.6** | 1 个 82ms 长任务 + **1 个 100ms 长动画帧（阻塞 47ms）** |
| 经营页滚动 · 动画全关 | **178.6** | **0** |
| 周报页静置 | 177.2 | 0 |

即：单个无限动画就吃掉约 **36% 的帧预算**，并在滚动时制造 100ms 长动画帧。桌面 headless 无 GPU 压力时尚且如此，真机（中低端安卓）会明显放大——这是"卡死"体感的来源，但**它不会让导航栏消失、也不会让页面拖不动**。

---

## 附带发现（同组件，与本次卡死无关）

**LiveFeed 流水明细永远为空**：`HotelStatus.jsx:93` 声明组件级 `const flowsRef = React.useRef([])`，而 `HotelStatus.jsx:134` 在 effect 内又声明了同名的局部 `const flowsRef = { current: st.flows }` **把外层遮蔽**。写入只落在 effect 内那份，JSX（233-235 行）读的却是永远为 `[]` 的组件级 ref。实证（`tests/_perf-flows.mjs`）：预置 2 条流水 → 点开"今日入账" → 显示"暂无流水记录"，预置流水不显示。`setFlows` state 设了但渲染侧从不读它，属纯展示失效。

---

## 为什么之前的测试完全没抓到

1. **断言全部用 JS `element.click()`**：程序化点击**不做可操作性/可见性检查**，元素被裁在视口外 2000px 也能点。冒烟里 `!!document.querySelector('.tabbar')` 只是"存在性"断言——DOM 里有这个节点，断言就绿。
2. **断言只读 `document.body.innerText`**（文本内容），**零布局几何断言**：从没断言过"导航栏在视口内"或"内容区可滚动"。
3. **无性能断言**：FPS、长任务、长动画帧从未纳入。
4. **测试视口 480×915 + 内容恒 2500px+**：其实从第 1 周就已经坏了（h=2494），但没有任何一条断言会因此失败。
5. **桌面 headless 无 GPU 压力**：`pulseBorder` 的 36% 帧预算损失在桌面几乎无感，触摸滚动也没模拟。
6. **时间差**：回归 9-19 00:07 引入，此后所有验证都是无头自动化（看文本不看布局），直到这次真机试用才暴露。

## 为什么"结算后就正常"这条线索直指它

`App.jsx:1991` 的渲染分支：
```jsx
if (report) return <div className="app">…<WeeklyReport /* 根元素就是 .content */ /></div>
```
周报页是**独立早返回分支**：没有包装层（布局天然正确）+ 没有底部导航栏（没有东西可"消失"）+ 内容更短。所以点完结算，页面一换，症状全消。

这条线索的价值：**它把 LiveFeed/定时器这类"经营页独有的组件"和"经营页独有的 DOM 结构"并列成了嫌疑**。如果是前者（CPU/定时器），插桩应能测到长任务——实测为 0；而后者（结构差异）一测几何就抓到。**"换页即好"更多指向结构性问题，而不是计算问题。**

---

## 2B 修复方案（待你确认后动手，一次只修一项）

**第 1 项（主修，布局）**
- `App.jsx:2069` 包装层加样式：`flex: 1 1 0; min-height: 0; display: flex; flex-direction: column`
  （已实测有效：`content` 恢复到 780px 可滚动、tabbar 回到视口内）
- `TeacherDashboard.jsx:521` 同款包装层加同样约束，并把 `.tabbar` 移出 `.content`（或给教师端 `.app` 与学生端一致的结构）
- 验收：几何断言（tabbar 在视口内 + `.content` 可滚动）+ 冒烟 47 断言 + 真机 8 周以上账号

**第 2 项（放大器，可选，等第 1 项验证通过再做）**
- `pulseBorder` 降开销：去掉 `box-shadow` 扩散（只留 `border-color`），或改用 `::after` + `opacity` 做合成层动画；顺带考虑 `@media (prefers-reduced-motion)` 与"页面不可见时暂停动画"
- 验收：A/B FPS 对照（预期滚动 FPS 回到 ~178）+ 无 100ms 长动画帧

**第 3 项（附带 bug）**
- LiveFeed `flowsRef` 遮蔽修正：删掉 effect 内的重名局部变量，统一写组件级 ref（或渲染侧改读 `flows` state）
- 顺带：LiveFeed 循环在 `document.hidden` 时暂停（省电，非必需）

**新增防回归断言（建议进 `tests/ui-smoke.mjs`）**
- 断言 `.tabbar` 底边 ≤ 视口高 且 顶边 > 0（可见性）
- 断言 `.content` 可滚动（内容溢出时 `scrollHeight > clientHeight` 且能滚）
- 断言无 `iterations: Infinity` 的动画（或至少白名单化）
