-- V191 · game_states 加乐观锁版本号 rev
-- 目的：客户端保存时带旧 rev 做条件更新；影响 0 行 = 冲突（不静默覆盖）
-- 幂等：可重复执行

ALTER TABLE public.game_states
  ADD COLUMN IF NOT EXISTS rev integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.game_states.rev IS
  '乐观锁版本号：客户端保存需带旧值（?rev=eq.N），成功则 rev=rev+1；影响 0 行 = 冲突';

-- 兼容：历史行统一归零（DEFAULT 已保证，这里只兜 null）
UPDATE public.game_states SET rev = 0 WHERE rev IS NULL;

-- 回滚（随时可用）：
--   ALTER TABLE public.game_states DROP COLUMN IF EXISTS rev;
