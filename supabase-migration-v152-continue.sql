-- V152 §2 · 续营 12 周：班级级开关（默认关）
-- 运行：psql 应用本文件（幂等）。沿用 u8 迁移的纪律：加列 default ⇒ 旧行不用回填。
--
-- continue_enabled = false：学生看不到「继续经营」入口（默认状态 = 学期 12 周止）
-- continue_enabled = true ：老师开启 ⇒ 已跑满 12 周的组可在成果页选择继续经营第 13–24 周
--   · 学生端**只读**该列（学期成果仍以前 12 周为准）
--   · 写入口 = src/supabaseClient.js setClassContinue()（RLS 限教师，与 supervisor_auth 同一通道）
--
alter table public.class_state
  add column if not exists continue_enabled boolean not null default false;

-- 回滚（如需）：
-- alter table public.class_state drop column if exists continue_enabled;
