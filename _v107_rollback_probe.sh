#!/bin/bash
# V107-E3 回滚探针（可复跑）：① 跑一次 tick ⇒ ② 从**不可变快照**取回该档结算前的原始行 ⇒
#   ③ 在**事务里**执行回滚并验证资金回到结算前（完毕 ROLLBACK，不留副作用）
# 用法（测试机）：bash /opt/yunyue/tick/rollback_probe.sh [group_key]
set -uo pipefail
GK="${1:-酒管2401|1}"
R="runuser -u postgres -- psql -d yunyue -tAc"
runuser -u postgres -- psql -d yunyue -q -c "update public.class_state set teacher_offset_days=1 where id=1" >/dev/null   # classDay 7→8，强制推进一次
CD=$($R "select public.class_day_now()")

echo "══ V107-E3 回滚探针 · group=$GK · classDay=$CD ══"
BEFORE=$($R "select state->>'capital' from public.game_states where group_key='$GK'")
echo "① tick 前 capital = $BEFORE"

echo "② 跑 tick（写库前会先落不可变快照）"
TICKOUT=$(cd /opt/yunyue/tick && node tick.mjs 2>&1); echo "   $(echo "$TICKOUT" | grep -oE '"advanced":[0-9]+,"groups":[0-9]+' | head -1)"
AFTER=$($R "select state->>'capital' from public.game_states where group_key='$GK'")
echo "   tick 后 capital = $AFTER"

echo "③ 从不可变快照取回**结算前**原始行（这就是回滚点）"
$R "select '   快照: tick_key='||coalesce(tick_key,'-')||' | taken_at='||to_char(taken_at,'HH24:MI:SS')||' | capital_before='||coalesce(capital_before::text,'-')||' | history_len_before='||coalesce(history_len_before::text,'-') from public.pre_settle_snapshots where group_key='$GK' order by id desc limit 1"
SNAP_CAP=$($R "select capital_before from public.pre_settle_snapshots where group_key='$GK' order by id desc limit 1")
[ "$SNAP_CAP" = "$BEFORE" ] && echo "   ✓ 快照里的 capital_before === tick 前值（$BEFORE）—— 回滚点成立" || echo "   ✗ 快照值 $SNAP_CAP ≠ tick 前值 $BEFORE"

echo "④ 在不留副作用的前提下验证「回滚一条档」可执行（事务内执行后 ROLLBACK）"
runuser -u postgres -- psql -d yunyue -tA <<SQL
begin;
update public.game_states g
   set state = s.state_before, week = coalesce((s.state_before->>'week')::int, g.week), updated_at = now()
  from (select state_before from public.pre_settle_snapshots where group_key='$GK' order by id desc limit 1) s
 where g.group_key = '$GK';
select '   回滚后 capital（事务内）= '||(state->>'capital') from public.game_states where group_key='$GK';
rollback;
select '   事务已回滚 · 线上现值 capital = '||(state->>'capital') from public.game_states where group_key='$GK';
SQL
runuser -u postgres -- psql -d yunyue -q -c "update public.class_state set teacher_offset_days=0 where id=1" >/dev/null   # 还原偏移
echo "⑤ 已还原 teacher_offset_days=0 ⇒ classDay=$($R 'select public.class_day_now()')"
echo
echo "【回滚一条档 · 可执行步骤（正式用法，去掉 begin/rollback 即生效）】"
echo "  update public.game_states g set state = s.state_before, week = (s.state_before->>'week')::int, updated_at = now()"
echo "    from (select state_before from public.pre_settle_snapshots where group_key='<组键>' order by id desc limit 1) s"
echo "   where g.group_key = '<组键>';"
echo "【保留策略】pre_settle_snapshots 只追加；建议保留 60 天（archive 每日清理 taken_at < now()-'60 days'）"
