#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# V154 批4 ① · 从 OSS 拉最新 dump ⇒ restore 对账（异地备份的"恢复演练"闭环）
#
# 做法：ossutil 拉取 oss://$BUCKET/yunyue/db/ 最新一份 ⇒ gzip -d ⇒ 交 restore-drill.sh
#       （restore-drill：临时库 yunyue_restore ⇒ 六表计数与生产逐表比对 ⇒ 删临时库）
# 判据：restore-drill 逐表计数相等（退出码 0）
# 用法：bash drill-from-oss.sh
# 退出码：0 = 演练通过；2 = OSS 未配置/无对象（跳过，不算成功）；1 = 拉取或对账失败
# 前置：ossutil 已装并配置（/root/.ossutilconfig）+ OSS_BUCKET/OSS_ENDPOINT 环境变量
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail
BUCKET="${OSS_BUCKET:-}"
UTIL="${OSS_UTIL:-ossutil}"
LOG=/var/log/yunyue-backup.log
log() { printf '%s %s\n' "$(date '+%F %T')" "$*" >>"$LOG"; }

if [ -z "$BUCKET" ]; then
  echo "⛔ OSS_BUCKET 未配置 ⇒ 跳过（不算成功）"; exit 2
fi

TMP=$(mktemp /tmp/yunyue-oss-XXXX)
if ! $UTIL ls "oss://$BUCKET/yunyue/db/" 2>"$TMP.err" | awk '{print $NF}' | grep -E 'yunyue/db/.*\.dump\.gz$' | sort | tail -1 >"$TMP.obj"; then
  log "FAIL offsite-drill 列对象失败"
  echo "✗ 列 OSS 对象失败：$(head -1 "$TMP.err")"; rm -f "$TMP"*; exit 1
fi
OBJ=$(cat "$TMP.obj")
if [ -z "$OBJ" ]; then
  log "SKIP offsite-drill 桶里没有 dump"
  echo "⛔ 桶里没有 dump ⇒ 跳过"; rm -f "$TMP"*; exit 2
fi

LOCAL="$(mktemp /tmp/yunyue-drill-XXXX.dump.gz)"
if ! $UTIL cp "$OBJ" "$LOCAL" 2>>"$LOG"; then
  log "FAIL offsite-drill 下载失败 $OBJ"
  echo "✗ 下载失败：$OBJ"; rm -f "$TMP"* "$LOCAL"; exit 1
fi
DUMP="${LOCAL%.gz}"
gzip -dc "$LOCAL" >"$DUMP"
rm -f "$LOCAL" "$TMP"*

echo "▶ 对账对象：$OBJ（$(stat -c %s "$DUMP")B）"
bash /opt/yunyue/scripts/restore-drill.sh "$DUMP"
RC=$?
rm -f "$DUMP"
if [ $RC = 0 ]; then
  log "OK   offsite-drill $OBJ 对账通过"
  echo "✓ 异地恢复演练通过：$OBJ"
else
  log "FAIL offsite-drill 对账失败（exit $RC）"
  echo "✗ 对账失败（exit $RC）"
fi
exit $RC
