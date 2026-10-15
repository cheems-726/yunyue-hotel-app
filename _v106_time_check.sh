#!/bin/bash
# V106 §3④ 时间引擎自检（一条命令输出：classDay / timer 状态 / snapshots 行数 / 最近 tick）
#   用法：bash /opt/yunyue/tick/time_check.sh          （在测试机上跑）
#   退出码：0 = 全项正常
set -uo pipefail
R="runuser -u postgres -- psql -d yunyue -tAc"
fail=0
line() { printf '  %-22s %s\n' "$1" "$2"; }

echo "══ 时间引擎自检 · $(date +'%F %T') ══"

# ① classDay（服务端权威）
CD=$($R "select public.class_day_now()")
SD=$($R "select coalesce(start_date::text,'(空)') from public.class_state where id=1")
OFF=$($R "select teacher_offset_days from public.class_state where id=1")
TODAY=$(date +%F)
# 期望值独立复算：floor(今天-开学日)+1+偏移，下限 1
EXP=$(python3 - "$SD" "$OFF" "$TODAY" <<'PY'
import sys, datetime
sd, off, today = sys.argv[1], int(sys.argv[2] or 0), sys.argv[3]
if sd in ('(空)', ''):
    print(0)
else:
    d = (datetime.date.fromisoformat(today) - datetime.date.fromisoformat(sd)).days + 1
    print(max(1, d + off))
PY
)
line "today / start_date" "$TODAY / $SD (offset=$OFF)"
line "class_day_now()" "$CD  （独立复算=$EXP）$([ "$CD" = "$EXP" ] && echo ✓ || { echo ✗; fail=1; })"

# ② timer 状态
for t in yunyue-tick.timer yunyue-archive.timer; do
  st=$(systemctl is-active "$t" 2>/dev/null || echo inactive)
  nx=$(systemctl list-timers --all 2>/dev/null | awk -v u="$t" '$0 ~ u {print $1" "$2" "$3}' | head -1)
  line "$t" "$st · 下次=$nx"
  [ "$st" = "active" ] || fail=1
done
line "最近 tick 服务结果" "$(systemctl show -p Result --value yunyue-tick.service 2>/dev/null)·$(systemctl show -p Result --value yunyue-archive.service 2>/dev/null)（tick·archive）"

# ③ daily_snapshots
TOT=$($R "select count(*) from public.daily_snapshots")
TOD=$($R "select count(*) from public.daily_snapshots where snapshot_date=current_date")
DAYS=$($R "select count(distinct snapshot_date) from public.daily_snapshots")
line "daily_snapshots 行数" "$TOT（今日 $TOD · 覆盖 $DAYS 个日期）"
[ "$TOD" -ge 1 ] || { line "  ⚠ 今日无快照" "（archive timer 每日 00:05 跑；也可手动 systemctl start yunyue-archive.service）"; }

# ④ 最近 tick
ROWS=$($R "select count(*) from public.server_tick_log")
UNIQ=$($R "select count(distinct tick_key) from public.server_tick_log")
LAST=$($R "select coalesce(max(ran_at)::text,'(无)') from public.server_tick_log")
LC=$($R "select coalesce(max(class_day)::text,'-') from public.server_tick_log")
line "server_tick_log" "$ROWS 行（唯一 tick_key $UNIQ · 最大 classDay=$LC · 最近=$LAST）"
[ "$ROWS" = "$UNIQ" ] || { line "  ✗ 幂等键重复" "行数≠唯一键数"; fail=1; }

# ⑤ 各组推进一致性
STALE=$($R "select count(*) from public.game_states where coalesce((state->>'__lastComputedDay')::int, jsonb_array_length(coalesce(state->'history','[]'::jsonb))*7) < public.class_day_now()")
line "未推进到 classDay 的档" "$STALE 个（口径同教师端：__lastComputedDay 缺则用 history.length×7）"
[ "$STALE" = "0" ] || { line "  ⚠ 有档落后" "跑一次：systemctl start yunyue-tick.service"; }

echo "$([ $fail -eq 0 ] && echo 'PASS —— 时间引擎自检全部正常' || echo 'FAIL —— 见上方 ✗ 项')"
exit $fail
