-- ============================================================================
-- 云悦酒店教学系统 · 迁移：class_state 扩展（老师注入事件 + AI 领班全班默认授权）
-- ============================================================================
-- 用途：§32-U8-补 —— 老师端「事件注入面板」与「AI 领班授权页」的云端通道。
--
-- 为什么放在 class_state（而不是各组 game_states）：
--   · 学生端每次保存是【整包 PATCH state】⇒ 老师写进学生 state 的字段会被学生
--     下一次自动保存**静默覆盖**（同 crisis override 的隐患，U8-补 侦察时定因）。
--   · class_state 已有 RLS：老师可 update（is_teacher）、全体登录用户可 select
--     ⇒ 天然的「老师写 / 全班读」通道 + 天然全班同步（一行数据，无组间差异）。
--
-- 【与结算严格分离】本文件只加两列数据字段，不含任何出租率/利润/属性/衰减计算。
--   学生端读不到这两列（迁移未应用）时会优雅回退（fetchClassState 回退只读 current_week，
--   通道字段返回空）—— 不阻塞任何现有功能。
--
-- ⚠️ 需人工执行：本文件不由 AI 执行，AI 也不会连接线上库。
-- 执行方式：Supabase 控制台 → 项目 yunyue-hotel → SQL Editor → 粘贴本文件全文 → Run
--
-- 幂等性：add column if not exists（可重复执行；已存在则跳过）。
-- 回滚：见文件末 §3（drop column —— 注意会丢注入记录/授权设置）。
--
-- 定稿：2026-10-01（§32-U8-补）
-- ============================================================================

-- 1) 加两列 -------------------------------------------------------------------
-- injected_events：老师注入事件（数组，元素形状见 src/teacherEvents.mjs 构建注入事件()）
--   元素：{ id, 来源事件, name, icon, type, week, source:'teacher', injectedBy, injectedAt, text, tip, targets|null }
--   targets = null ⇒ 全班；否则为 group_key 数组（'班级|组号'，与 groupKeyOf 同口径）
alter table public.class_state
  add column if not exists injected_events jsonb not null default '[]'::jsonb;

-- supervisor_auth：AI 领班【全班默认授权】（null = 默认全关 = 公平基准）
--   形状：{ price_adj?: {ok:boolean, clamp?}, overbook?: {ok:boolean}, energy?: {ok:boolean} }
--   （与 src/aiSupervisor.mjs 生效授权() 的「全班默认」入参同形状）
alter table public.class_state
  add column if not exists supervisor_auth jsonb;

-- 2) 执行后自检（只读，可单独跑一遍确认）--------------------------------------
-- 两列是否就位（应返回 2 行）：
--   select column_name, data_type, column_default
--   from information_schema.columns
--   where table_schema='public' and table_name='class_state'
--     and column_name in ('injected_events','supervisor_auth');
-- 默认值是否为空数组（应返回 []）：
--   select injected_events, supervisor_auth from public.class_state where id = 1;
-- 既有策略是否仍覆盖新列（class_state_read / class_state_teacher_write —— 列级不受影响，应返回 2 行）：
--   select policyname, cmd from pg_policies where tablename = 'class_state' order by policyname;

-- 3) 回滚（如需；⚠️ 会丢注入记录与授权设置）-----------------------------------
-- alter table public.class_state drop column if exists injected_events;
-- alter table public.class_state drop column if exists supervisor_auth;
