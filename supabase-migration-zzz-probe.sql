-- ⚠️ V168§3 临时探针（#216 补验）—— 部署第⑥步真跑后【必须删除本文件】
-- 预期：单行写法 ⇒ 扫描声明 1 条 ⇒ ⑥ 报「缺失 1 项：class_state.__probe_v168__」且 exit 1（修前假绿 0 条）
alter table public.class_state add column if not exists __probe_v168__ text;
