#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# 云悦测试机 · 邮件告警发送（QQ 邮箱 SMTP）
#
# 用法：notify.sh "主题" "正文"        （正文可含多行，用 $'a\nb' 或管道）
#       echo "正文" | notify.sh "主题"
#
# 配置：/opt/yunyue/etc/notify.env（0600，不进 git）
#   ALERT_TO=2127356007@qq.com
#   SMTP_URL=smtps://smtp.qq.com:465
#   SMTP_USER=2127356007@qq.com
#   SMTP_PASS=<QQ邮箱 SMTP 授权码 16 位，不是登录密码>
#
# 退出码：0 已发送 / 2 未配置（不算失败，但会在日志里留一行）/ 1 发送失败
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail
CONF="${YUNYUE_NOTIFY_ENV:-/opt/yunyue/etc/notify.env}"
LOG=/var/log/yunyue-notify.log

log() { printf '%s %s\n' "$(date '+%F %T')" "$*" >>"$LOG"; }

SUBJECT="${1:-云悦服务器告警}"
if [ "$#" -ge 2 ]; then BODY="$2"; else BODY="$(cat)"; fi
[ -n "$BODY" ] || BODY="$SUBJECT"

if [ ! -f "$CONF" ]; then
  echo "⛔ 未配置 $CONF（缺 QQ 邮箱 SMTP 授权码）⇒ 不发送"
  log "SKIP 未配置（缺 $CONF）"
  exit 2
fi
# shellcheck disable=SC1090
. "$CONF"

if [ -z "${SMTP_PASS:-}" ] || [ -z "${SMTP_USER:-}" ] || [ -z "${ALERT_TO:-}" ]; then
  echo "⛔ notify.env 里 SMTP_USER/SMTP_PASS/ALERT_TO 不全 ⇒ 不发送"
  log "SKIP 配置不全"
  exit 2
fi
if [ "${SMTP_PASS}" = "CHANGE_ME" ]; then
  echo "⛔ SMTP_PASS 还是占位符 ⇒ 先填 QQ 邮箱授权码"
  log "SKIP 占位符未替换"
  exit 2
fi

MAIL=$(mktemp /tmp/yunyue-mail-XXXX.eml)
{
  printf 'From: 云悦服务器 <%s>\r\n' "$SMTP_USER"
  printf 'To: %s\r\n' "$ALERT_TO"
  printf 'Subject: %s\r\n' "$SUBJECT"
  printf 'Date: %s\r\n' "$(date -R)"
  printf 'MIME-Version: 1.0\r\n'
  printf 'Content-Type: text/plain; charset=UTF-8\r\n'
  printf '\r\n'
  printf '%s\r\n' "$BODY"
  printf '\r\n-- \r\n主机 %s · %s\r\n' "$(hostname)" "$(date '+%F %T %Z')"
} >"$MAIL"

OUT=$(curl -sS --url "${SMTP_URL:-smtps://smtp.qq.com:465}" \
  --user "${SMTP_USER}:${SMTP_PASS}" \
  --mail-from "$SMTP_USER" --mail-rcpt "$ALERT_TO" \
  --upload-file "$MAIL" 2>&1)
RC=$?
rm -f "$MAIL"

if [ "$RC" -eq 0 ]; then
  echo "✓ 已发送 → $ALERT_TO"
  log "OK 发送成功 → $ALERT_TO : $SUBJECT"
  exit 0
fi
echo "✗ 发送失败(rc=$RC)：${OUT:0:200}"
log "FAIL 发送失败 rc=$RC ${OUT:0:200}"
exit 1
