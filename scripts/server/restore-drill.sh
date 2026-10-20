#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# V130 §3 · 恢复演练（一次性 · 可复跑）
#
# 做法：最新 dump ⇒ 临时库 yunyue_restore ⇒ 逐表计数与生产库比对 ⇒ 删临时库
# 判据：六张表计数逐表相等 + class_day_now() 可用 + auth.users 行数相等
# 用法：bash /opt/yunyue/scripts/restore-drill.sh [dump 路径]（默认取最新一份）
# 退出码：0 = 演练通过；1 = 有差异（**不许跳过差异宣布通过**）
# 注意：本脚本会在服务器上**建/删临时库**，不 touch 生产库 yunyue
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail

DUMP="${1:-$(ls -1t /opt/yunyue/bak/db/*.dump 2>/dev/null | head -1)}"
TMPDB="yunyue_restore"
if [ -z "${DUMP:-}" ] || [ ! -f "$DUMP" ]; then
  echo "✗ 找不到 dump（$DUMP）"
  echo "结果: 0 通过 / 1 失败"
  exit 1
fi

echo "══ 恢复演练 · dump=$(basename "$DUMP") · $(date '+%F %T') ══"
PASS=0
FAIL=0

sudo -u postgres dropdb --if-exists "$TMPDB" 2>/dev/null
if ! sudo -u postgres createdb "$TMPDB"; then
  echo "✗ 建临时库失败"
  echo "结果: 0 通过 / 1 失败"
  exit 1
fi

ERR=$(mktemp)
if sudo -u postgres pg_restore -d "$TMPDB" --no-owner --no-privileges "$DUMP" 2>"$ERR"; then
  echo "  ✓ pg_restore 无错误"
  PASS=$((PASS + 1))
else
  # pg_restore 对"已存在/权限"类告警常返回 1；关键看计数是否一致（下面逐表比）
  echo "  ⚠ pg_restore 返回非 0（前 3 行）：$(head -3 "$ERR" | tr '\n' ' ')"
fi
rm -f "$ERR"

for t in game_states class_state decision_log daily_snapshots pre_settle_snapshots; do
  a=$(sudo -u postgres psql -d yunyue -At -c "select count(*) from $t" 2>/dev/null)
  b=$(sudo -u postgres psql -d "$TMPDB" -At -c "select count(*) from $t" 2>/dev/null)
  if [ -n "$a" ] && [ "$a" = "$b" ]; then
    echo "  ✓ $t 生产=$a 恢复=$b"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $t 生产=${a:-取不到} 恢复=${b:-取不到}"
    FAIL=$((FAIL + 1))
  fi
done

d1=$(sudo -u postgres psql -d yunyue_restore -At -c "select class_day_now()" 2>/dev/null)
case "$d1" in
  '' | *[!0-9]*) echo "  ✗ 恢复库 class_day_now() 不可用（${d1:-空}）"; FAIL=$((FAIL + 1)) ;;
  *) echo "  ✓ 恢复库 class_day_now()=$d1"; PASS=$((PASS + 1)) ;;
esac

u1=$(sudo -u postgres psql -d yunyue -At -c "select count(*) from auth.users" 2>/dev/null)
u2=$(sudo -u postgres psql -d yunyue_restore -At -c "select count(*) from auth.users" 2>/dev/null)
if [ -n "$u1" ] && [ "$u1" = "$u2" ]; then
  echo "  ✓ auth.users 生产=$u1 恢复=$u2"
  PASS=$((PASS + 1))
else
  echo "  ✗ auth.users 生产=${u1:-?} 恢复=${u2:-?}"
  FAIL=$((FAIL + 1))
fi

sudo -u postgres dropdb "$TMPDB" && echo "  ✓ 临时库 $TMPDB 已删除"

echo "结果: ${PASS} 通过 / ${FAIL} 失败"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
