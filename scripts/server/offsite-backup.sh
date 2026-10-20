#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# V130 §10-1 · 异地备份（OSS）—— **卡外部输入：桶名 / AK 未给，本脚本待接**
#
# 前置（二选一）：
#   A. ossutil 已装且配置好：/root/.ossutilconfig（endpoint + accessKeyID/Secret）
#   B. 环境变量：OSS_BUCKET / OSS_ENDPOINT / ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET
#
# 做法：取最新 db dump ⇒ gzip ⇒ 上传 oss://<bucket>/yunyue/db/YYYYMMDD.dump.gz
#       ⇒ 回读 HEAD 校验大小一致 ⇒ 写一行日志；OSS 侧用生命周期规则留 30 天
# 用法：bash offsite-backup.sh [dump 路径]
# 退出码：0 = 上传且校验通过；2 = 未配置（跳过、不算成功）；1 = 上传/校验失败
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail
DUMP="${1:-$(ls -1t /opt/yunyue/bak/db/*.dump 2>/dev/null | head -1)}"
LOG=/var/log/yunyue-backup.log
log() { printf '%s %s\n' "$(date '+%F %T')" "$*" >>"$LOG"; }

BUCKET="${OSS_BUCKET:-}"
if [ -z "$BUCKET" ] || [ -z "${DUMP:-}" ] || [ ! -f "${DUMP:-}" ]; then
  echo "⛔ 未配置（OSS_BUCKET 为空或没有 dump）⇒ 跳过，不算成功"
  echo "   配置示例：export OSS_BUCKET=yunyue-backup OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com"
  exit 2
fi

D=$(date +%Y%m%d)
TMP=$(mktemp /tmp/yunyue-db-XXXX.dump.gz)
gzip -c "$DUMP" >"$TMP"
OBJ="oss://$BUCKET/yunyue/db/$D.dump.gz"
LOCAL_SIZE=$(stat -c %s "$TMP")

if command -v ossutil >/dev/null 2>&1; then
  UP="ossutil cp -f $TMP $OBJ"
  HEAD="ossutil stat $OBJ"
elif command -v aliyun >/dev/null 2>&1; then
  UP="aliyun oss cp $TMP $OBJ --force"
  HEAD="aliyun oss stat $OBJ"
else
  echo "✗ 既没有 ossutil 也没有 aliyun-cli ⇒ 先装其一（apt 里没有，需官方安装包）"
  log "FAIL offsite 缺 ossutil/aliyun-cli"
  rm -f "$TMP"; exit 1
fi

if $UP >/dev/null 2>&1; then
  OUT=$($HEAD 2>&1 | grep -oE 'Content-Length[^0-9]*[0-9]+' | grep -oE '[0-9]+$' | head -1)
  if [ "${OUT:-0}" = "$LOCAL_SIZE" ]; then
    log "OK   offsite $OBJ $(($LOCAL_SIZE / 1024))KB（远端大小一致）"
    echo "✓ 已上传并校验：$OBJ"
    rm -f "$TMP"; exit 0
  fi
  log "FAIL offsite 远端大小 ${OUT:-?} ≠ 本地 $LOCAL_SIZE"
  echo "✗ 远端大小不一致（${OUT:-?} vs $LOCAL_SIZE）"; rm -f "$TMP"; exit 1
fi

log "FAIL offsite 上传失败 $OBJ"
echo "✗ 上传失败"; rm -f "$TMP"; exit 1
