#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# V130 §10-3 · 数据卫生（权限 + 历史归档 + 保留策略）· 幂等 · 可复跑
#
# ① 权限：public.schema_migrations 对 anon/authenticated 关只读（它没有 RLS，PostgREST 会直接暴露）
# ② 归档：server_tick_log 里 **1 天前的失败记录**（2026-10-18 那批 overbook 事故）导出到
#    /opt/yunyue/bak/archive/tick-log-fail-YYYYMMDD.json.gz 后删除，别混在实时告警里
# ③ 保留：pre_settle_snapshots 删「90 天前 **且** 不在每组最近 30 条内」的行
#    （两条同时满足才删 —— 绝不因为"条数多"就删审计记录）
# 用法：bash housekeeping.sh [--dry]
# 退出码：0 = 全部执行成功
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail
DRY=no; [ "${1:-}" = "--dry" ] && DRY=yes
PSQL="sudo -u postgres psql -d yunyue"
BAK="${YUNYUE_BAK_DIR:-/opt/yunyue/bak}"
ARC="$BAK/archive"
D=$(date +%Y%m%d)
RC=0
run() { if [ "$DRY" = yes ]; then echo "  (dry) $1"; else $PSQL -At -c "$1" 2>&1; fi; }

mkdir -p "$ARC" 2>/dev/null || true

echo "══ 数据卫生 · $(date '+%F %T') ══"

# ① schema_migrations 关权限
echo "① public.schema_migrations 对 anon/authenticated 关 select"
if [ "$DRY" = yes ]; then echo "  (dry) revoke select"; else
  $PSQL -q -c "revoke all on public.schema_migrations from anon, authenticated" 2>&1 | sed 's/^/  /'
  echo "  ✓ 已 revoke"
fi

# ② 归档 1 天前的失败 tick 记录
echo "② 归档 server_tick_log 旧失败记录"
N=$($PSQL -At -c "select count(*) from server_tick_log where ok=false and ran_at < now() - interval '1 day'" 2>/dev/null)
echo "  待归档：${N:-?} 行"
if [ "${N:-0}" -gt 0 ]; then
  F="$ARC/tick-log-fail-$D.json.gz"
  if [ "$DRY" = yes ]; then echo "  (dry) 导出到 $F 并删除"; else
    $PSQL -At -c "select row_to_json(t) from (select * from server_tick_log where ok=false and ran_at < now() - interval '1 day') t" 2>/dev/null | gzip >"$F"
    OKROWS=$(zcat "$F" | wc -l)
    if [ "$OKROWS" -eq "$N" ]; then
      $PSQL -At -c "delete from server_tick_log where ok=false and ran_at < now() - interval '1 day'" | sed 's/^/  删除 /'
      echo "  ✓ 归档 $F（$OKROWS 行，可 zcat 还原）"
    else
      echo "  ✗ 导出行数 $OKROWS ≠ $N ⇒ 不删（防丢数据）"; RC=1
    fi
  fi
else
  echo "  ✓ 无需归档"
fi

# ③ pre_settle_snapshots 保留（90 天 + 每组保底 30 条）
echo "③ pre_settle_snapshots 保留策略（>90 天 且 非每组最近 30 条）"
DELSQL="delete from pre_settle_snapshots p where p.taken_at < now() - interval '90 days' and p.id not in (select id from (select id, row_number() over (partition by group_key order by taken_at desc) rn from pre_settle_snapshots) t where t.rn <= 30)"
N2=$($PSQL -At -c "select count(*) from pre_settle_snapshots p where p.taken_at < now() - interval '90 days' and p.id not in (select id from (select id, row_number() over (partition by group_key order by taken_at desc) rn from pre_settle_snapshots) t where t.rn <= 30)" 2>/dev/null)
TOTAL=$($PSQL -At -c "select count(*) from pre_settle_snapshots" 2>/dev/null)
echo "  待删：${N2:-?} 行（当前总 ${TOTAL:-?} 行）"
if [ "${N2:-0}" -gt 0 ]; then run "$DELSQL" | sed 's/^/  删除 /'; else echo "  ✓ 无超龄行（最早数据未满 90 天 ⇒ 今天不删，机制已就位）"; fi

echo "── 复核 ──"
$PSQL -At -c "select 'pre_settle='||count(*) from pre_settle_snapshots; select 'tick_log='||count(*) from server_tick_log; select 'tick_log_fail='||count(*) from server_tick_log where ok=false"
echo "结果: $([ "$RC" -eq 0 ] && echo '通过' || echo '失败')"
exit "$RC"
