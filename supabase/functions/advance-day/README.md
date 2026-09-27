# Edge Function · `advance-day`（服务端逐日推进）

> Wave 1（T3.2）· D7 的落地件：**不打开任何客户端，服务端自己推进 1 天**
> ★ 本目录已写好源码与部署脚本；**"实际部署"需你来执行**（见下 §三）

---

## 一、它是什么 / 不是什么

**是**：一个薄适配层，只做三件事 ——
1. 读库（`class_state` 的 classDay + 各组 `game_states.state`）
2. 调逻辑（把每组交给 **同一份引擎** `./engine/serverTick.mjs` 的 `advanceGroupOneDay()`）
3. 写回（`game_states.state` + 幂等流水 `server_tick_log`）

**不是**：第二套结算实现。本目录**不含任何业务计算** —— 结算全部在 `./engine/` 里，
而 `./engine/` 是构建脚本从 `src/` **机械搬运**来的（与浏览器端同一份源码，D8 硬约束）。

```
supabase/functions/advance-day/
  index.ts          ← 薄适配层（读→调→写）
  db.ts             ← 仅 IO（classDayNow / readGroups / writeGroupState / writeTickLog）
  engine/           ← ★ 构建产物：node scripts/build-edge-function.mjs 生成，勿手改
  README.md         ← 本文件
```

---

## 二、为什么需要 `engine/` 这层搬运

Supabase 部署 Edge Function 时**只上传函数目录本身**，所以 `import '../../../src/engine/index.js'`
本地能跑、部署后必然 404。构建脚本把 `src/` 的 15 个引擎模块复制进 `engine/` 并改写相对路径
（`'../x'` → `'./x'`；`'./engine/index.js'` → `'./index.js'`），
并**断言"除 import 路径外逐字节相同"** —— 防止有人在搬运环节塞进第二套逻辑。

重新生成：`node scripts/build-edge-function.mjs`

---

## 三、★ 部署步骤（需你执行 · 本机没有 supabase CLI）

```bash
# 0) 先重新组装 engine/（src/ 改了就必须重跑）
node scripts/build-edge-function.mjs

# 1) 登录（需 Supabase 访问令牌：后台 → Account → Access Tokens）
npx supabase login

# 2) 部署函数（<ref> 换成你的 project ref）
npx supabase functions deploy advance-day --project-ref <ref>

# 3) 应用迁移（建 classDay + 幂等表 + pg_cron）
#    方式 A：Supabase 后台 → SQL Editor → 粘贴 supabase/migrations/20260927_server_tick.sql
#    方式 B：psql "$SUPABASE_PG" -f supabase/migrations/20260927_server_tick.sql
#    ★ 执行前把 SQL 里的 <PROJECT_REF> 与 <SERVICE_ROLE_KEY> 替换掉

# 4) 设函数密钥（后台 → Edge Functions → advance-day → Secrets）
#    SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（Supabase 通常已内建，确认一下）

# 5) 开两个扩展（后台 → Database → Extensions）：pg_cron、pg_net

# 6) 设开学日（否则 classDay = 0，函数会跳过）
#    update public.class_state set start_date = '2026-09-28' where id = 1;
```

### 部署后自检

```bash
# 手动触发一次（dry=1 只算不写）
curl -X POST "https://<ref>.supabase.co/functions/v1/advance-day?dry=1" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"

# 期望返回：{ ok: true, classDay: N, groups: M, advanced: X, dry: true }
```
```sql
-- classDay 对不对
select public.class_day_now();
-- 幂等流水
select tick_key, class_day, ok, ran_at from public.server_tick_log order by ran_at desc limit 10;
-- 定时任务是否在跑
select jobname, schedule, active from public.cron_job where jobname = 'advance-day-tick';
```

---

## 四、幂等与容错（为什么重复触发不会出事）

- **幂等键** = `d<classDay>|<groupKey>`（`server_tick_log` 主键）
- 同一天重复触发：该周已在 `history` 里 ⇒ `advanceGroupOneDay` 返回 `advanced:false`，**不重复结算**，
  快照逐字节相同；写流水时主键冲突（`23505`）被静默忽略，不算错
- **数值越界**（occupancy ∉ [0,100]、capital 非有限等）：只记流水 + 标 `ok:false`，**不写回存档**（不静默改数）
- **`dry=1`**：只算不写，供巡检与联调

---

## 五、已验证 / 未验证（诚实边界）

| 项 | 状态 |
|---|---|
| 引擎逻辑（推进 1 天 / 幂等 / 越界） | ✅ 已验：`tests/serverTick.test.mjs`（不打开浏览器；服务端输出 === 浏览器端周报的日行，逐字节） |
| `engine/` 组装与 import 路径 | ✅ 已验：构建脚本自带"除 import 外逐字节相同"+"无 404 import"两条守门 |
| `index.ts` / `db.ts` 的 SQL 与网络调用 | ⚠️ **未验证** —— 需要真实 Supabase（部署后按 §三 自检） |
| pg_cron 是否真按期触发 | ⚠️ **未验证** —— 同上 |
| classDay 与教学日历的一致性 | ⚠️ 未验证 —— 需要设了 `start_date` 的班级 |

★ 结论：**计算部分已可证（本地等效验证）**；**部署与网络部分需你执行并自检**（本机无 supabase CLI、且不碰生产库）。
