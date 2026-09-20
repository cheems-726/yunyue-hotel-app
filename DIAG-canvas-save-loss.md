# 诊断报告：学生决策后云端数据丢失

> 诊断时间：2026-09-20 08:55
> 现象：学生做决策后本地状态有变化，但刷新页面后云端 game_states 没有更新，等于白做。

---

## 根因排序（最可能 → 最不可能）

### 🔴 根因 1：云端同步防抖 1.5s 窗口内刷新 → 保存被取消，无兜底

**证据**：App.jsx 第 1673-1680 行

```js
useEffect(() => {
  if (!user?.cloud || !user?.uid || restoring) return
  const t = setTimeout(() => {
    import('./supabaseClient.js').then(({ saveGameState }) =>
      saveGameState(...).catch(() => {})
    )
  }, 1500)
  return () => clearTimeout(t)   // ← 刷新时 React 卸载组件，clearTimeout 取消保存
}, [user?.uid, JSON.stringify(cloudState), restoring])
```

**机制**：学生做完决策 → `doneDecisions` state 变化 → 触发 useEffect → 设置 1.5 秒防抖定时器。如果用户在 1.5 秒内刷新/关闭页面，React 卸载组件时执行 cleanup `clearTimeout(t)`，**保存永远不发生**。

**整个代码库没有以下任何一个兜底机制**：
- ❌ 无 `window.beforeunload` 监听
- ❌ 无 `document.visibilitychange` 监听
- ❌ 无 `pagehide` 监听
- ❌ 无 `navigator.sendBeacon()` 调用
- ❌ 无同步 XHR 强制发送

**这是"决策后刷新丢数据"的直接根因。**

---

### 🔴 根因 2：saveGameState 错误被静默吞掉，用户不知道保存失败了

**证据**：App.jsx 第 1676 行

```js
saveGameState(user.uid, cloudState, groupKeyOf(...)).catch(() => {})
```

`.catch(() => {})` 把所有 Supabase 错误（网络超时/RLS 拒绝/JWT 过期/连接失败）**全部静默吞掉**。用户不知道保存失败了，UI 上也没有任何错误提示（没有 toast、没有红点、没有断网标记）。

同时，`saveGameState` 返回 `!error`（布尔值），但调用方用 `.catch()` 而不是 `.then(result => ...)` 检查，**返回值从未被使用**。

---

### 🟡 根因 3：restoring 标志竞态可能阻止首次同步

**证据**：App.jsx 第 1630 行 / 第 1673 行 / 第 1657 行

```js
const [restoring, setRestoring] = useState(true)  // 初始为 true
// ...
if (!user?.cloud || !user?.uid || restoring) return  // restoring=true 时跳过云端同步
```

`restoring` 初始值为 `true`，只在 Supabase 会话恢复 useEffect 的 finally 块中设为 `false`（第 1657 行）。如果用户通过 `handleLogin`（手动输入密码登录）而非会话恢复进入系统，`restoring` 已经是 `false`（启动时设过了），不会有问题。

**但存在一个边缘场景**：如果 Supabase 会话恢复网络超时（catch 分支），`setRestoring(false)` 在 finally 中执行。用户随后手动登录成功。此时 `restoring` 已为 false，云端同步应正常工作。**竞态风险低**，但如果 Supabase 初始化异常导致 restoring 永远为 true，则云端同步永远不会触发。

---

### 🟡 根因 4：组档 upsert 时 user_id 被覆盖为写入者

**证据**：supabaseClient.js saveGameState 函数 + RLS 策略

```js
const payload = {
  user_id: userId,      // ← 当前写入者的 ID
  group_key: groupKey,
  ...
}
const { error } = groupKey
  ? await supabase.from('game_states').upsert(payload, { onConflict: 'group_key' })
  : await supabase.from('game_states').upsert(payload)
```

当组队共管模式下，第一个创建组档的学生 A 的 `user_id` 被写入。之后学生 B 保存时，upsert 匹配 `group_key`，将 `user_id` **覆盖为 B 的 ID**。

**RLS 影响链**：
- `game_states_self: ALL (user_id = auth.uid())` → A 的这条策略失效（user_id 已变成 B）
- `game_states_group_write: ALL` → 但组写策略仍然允许 A 访问
- **不会直接丢数据，但 user_id 字段语义错误**

---

### 🟢 根因 5：冒烟测试从未覆盖云端保存路径

**证据**：tests/ui-smoke.mjs 全文

冒烟测试的学生流程使用 **离线演示模式**（`cloud: false`），`saveGameState` 从未被调用。教师登录（t001）不产生决策。**整个云端保存路径（saveGameState + group_key upsert + RLS 策略）自动化测试覆盖率为零。**

---

## 修复建议（按优先级）

### P0：添加 beforeunload / visibilitychange 强制保存

在 App 根组件加一个 useEffect，使用 `navigator.sendBeacon()` 或同步 `fetch` 在页面卸载前尽力发送最后一次数据。同时在 `visibilitychange`（`document.hidden === true`）时触发保存。这能覆盖"刷新"和"切后台后杀进程"两种场景。

### P1：移除 .catch(() => {}) 并加错误反馈

`saveGameState` 的错误应该触发 toast 提示（"云端同步失败，进度已保存在本机"），让用户至少知道数据没有上云。已有的断网横幅（offline state）只监听 `navigator.onLine`，无法感知 Supabase 层面的错误。

### P2：缩短防抖到 500ms 并加最大重试

1.5 秒 → 500 毫秒能大幅缩小丢数据窗口。另可加一个简单的重试计数（失败后 3 秒重试一次）。

### P3：组档 upsert 的 user_id 不应覆盖

组档场景下 payload 中移除 `user_id` 字段，或者在 Supabase 端建一个 trigger 保持原 user_id 不变。当前行为是"最后写入者变成行属主"，虽然 RLS 组写策略能兜住，但语义上是错的。

---

## 补充说明

| 问题 | 影响范围 | 严重性 |
|------|---------|--------|
| 防抖窗口刷新丢数据 | 所有云端学生 | 🔴 每次都可能 |
| 错误静默吞掉 | 所有云端学生 | 🔴 持续性风险 |
| 组档 user_id 覆盖 | 组队共管模式 | 🟡 语义错误但 RLS 兜住 |
| 冒烟未覆盖云端保存 | 测试盲区 | 🟡 已确认的测试缺口 |
| 离线演示模式误解 | 用户可能以为在云端 | 🟢 UI 有标注但需醒目 |
