#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# V130 §3 · 云悦测试机 · 每日自动备份（pg_dump + 配置 + 前端快照）
#
# 由 systemd 定时器 yunyue-backup.timer 每天 00:15 拉起（archive 00:05 之后）
# 产物：
#   /opt/yunyue/bak/db/yunyue-YYYYMMDD.dump       数据库（pg_dump -Fc · 保留 7 天）
#   /opt/yunyue/bak/etc/etc-YYYYMMDD.tgz          配置五份（**含密钥** · 0600 · 保留 30 天）
#   /opt/yunyue/bak/web/web-YYYYMMDD.tgz          前端快照（index.html + 当前在用的 assets · 保留 30 天）
# 日志：/var/log/yunyue-backup.log（每次运行追加一行汇总，失败逐项写 FAIL）
# 退出码：0 = 三份都成功；1 = 至少一份失败（systemd 会记 failed，巡检 ⑧ 也会红）
# 手动跑：bash /opt/yunyue/scripts/backup.sh
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail

BAK="${YUNYUE_BAK_DIR:-/opt/yunyue/bak}"
DBD="$BAK/db"
ETCD="$BAK/etc"
WEBD="$BAK/web"
LOG="${YUNYUE_BACKUP_LOG:-/var/log/yunyue-backup.log}"
WEB="${YUNYUE_WEB_DIR:-/var/www/html}"
D=$(date +%Y%m%d)
RC=0

log() { printf '%s %s\n' "$(date '+%F %T')" "$*" >>"$LOG"; }

mkdir -p "$DBD" "$ETCD" "$WEBD"
# ★ bak 根目录必须 0755：恢复演练以 postgres 身份读 dump ⇒ 需要能穿过目录
#   （⚠ 第一版写成 0700 导致 pg_restore "Permission denied"，演练当场抓到）
chmod 0755 "$BAK" "$DBD" "$WEBD"
chmod 0700 "$ETCD"

# ── ① 数据库 ────────────────────────────────────────────────────────────
DBF="$DBD/yunyue-$D.dump"
ERR=$(mktemp)
if sudo -u postgres pg_dump -Fc yunyue >"$DBF" 2>"$ERR"; then
  # ★ 0640 postgres:postgres —— 恢复演练要由 postgres 用户读这份 dump（root 仍可读）
  chown postgres:postgres "$DBF" 2>/dev/null || true
  chmod 0640 "$DBF"
  log "OK   db   $DBF $(stat -c %s "$DBF")B"
else
  log "FAIL db   $(tail -1 "$ERR")"
  rm -f "$DBF"
  RC=1
fi
rm -f "$ERR"

# ── ② 配置（含密钥 ⇒ 0600 + 目录 0700；日志里只写大小，不写内容）────────
ETCF="$ETCD/etc-$D.tgz"
if [ -d /opt/yunyue/etc ] && tar czf "$ETCF" -C /opt/yunyue etc 2>/dev/null; then
  chmod 600 "$ETCF"
  log "OK   etc  $ETCF $(stat -c %s "$ETCF")B（含密钥·0600）"
else
  log "FAIL etc  tar 失败或 /opt/yunyue/etc 不存在"
  RC=1
fi

# ── ③ 前端快照（index.html + 当前在用的 assets）────────────────────────
#   在用 = index.html 直接引用的 index-*.js/.css + 主包里动态 import 的 chunk
WEBSRC="$BAK/.web.list"
#   ★ 判"在用"用【反向引用】而不是猜文件名：assets 里每个文件，只要它的文件名在
#     index.html 或主包里出现过，就算在用（动态 import 的 chunk 名只出现在主包里）。
(
  cd "$WEB" || exit 1
  echo "index.html"
  main=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' index.html | head -1)
  for f in assets/*; do
    [ -f "$f" ] || continue
    b=$(basename "$f")
    if grep -qF "$b" index.html 2>/dev/null || { [ -n "$main" ] && grep -qF "$b" "$main" 2>/dev/null; }; then
      echo "$f"
    fi
  done
) >"$WEBSRC" 2>/dev/null

if [ -s "$WEBSRC" ] && tar czf "$WEBD/web-$D.tgz" -C "$WEB" -T "$WEBSRC" 2>/dev/null; then
  chmod 600 "$WEBD/web-$D.tgz"
  log "OK   web  $WEBD/web-$D.tgz $(stat -c %s "$WEBD/web-$D.tgz")B（$(wc -l <"$WEBSRC") 个文件）"
else
  log "FAIL web  清单为空或 tar 失败"
  RC=1
fi
rm -f "$WEBSRC"

# ── ④ 保留策略：db 7 天 / etc 30 天 / web 30 天（按文件名日期）──────────
DEL_DB=$(find "$DBD" -name 'yunyue-*.dump' -mtime +7 -print -delete 2>/dev/null | wc -l)
DEL_ETC=$(find "$ETCD" -name 'etc-*.tgz' -mtime +30 -print -delete 2>/dev/null | wc -l)
DEL_WEB=$(find "$WEBD" -name 'web-*.tgz' -mtime +30 -print -delete 2>/dev/null | wc -l)

if [ "$RC" -eq 0 ]; then
  log "DONE rc=0 清理: db${DEL_DB} etc${DEL_ETC} web${DEL_WEB}"
else
  log "DONE rc=1 有失败（清理: db${DEL_DB} etc${DEL_ETC} web${DEL_WEB}）"
fi
exit "$RC"
