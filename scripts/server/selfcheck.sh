#!/bin/bash
# 云悦自检：nginx / 入口 / 后端三端口 / realtime / 证书 / 磁盘 / 静态包完整性
set -u
LOG=/opt/yunyue/logs/selfcheck.log
TS=$(date '+%F %T')
fail=()
code(){ curl -s -o /dev/null -w '%{http_code}' --max-time 8 "$@" 2>/dev/null; }
[ "$(systemctl is-active nginx)" = active ] || fail+=("nginx-inactive")
h1=$(code http://127.0.0.1/health); [ "$h1" = 200 ] || fail+=("local-health=$h1")
h2=$(code --resolve test.2026911301.xyz:443:127.0.0.1 https://test.2026911301.xyz/health); [ "$h2" = 200 ] || fail+=("https-health=$h2")
ANON=$(python3 -c "import json;print(json.load(open('/opt/yunyue/etc/keys.json'))['anon'])" 2>/dev/null)
r=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:3000/ -H "apikey: $ANON" 2>/dev/null)
case "$r" in 200|400|401|404) :;; *) fail+=("postgrest=$r");; esac
for p in 3000 4000 9999; do ss -lnt 2>/dev/null | awk '{print $4}' | grep -q ":$p$" || fail+=("port$p-down"); done
EXP=$(openssl x509 -in /etc/letsencrypt/live/test.2026911301.xyz/fullchain.pem -noout -enddate 2>/dev/null | cut -d= -f2)
DAYS=$(( ( $(date -d "$EXP" +%s) - $(date +%s) ) / 86400 ))
[ "$DAYS" -gt 14 ] || fail+=("cert-${DAYS}d")
USE=$(df -P / | awk 'NR==2{gsub("%","",$5);print $5}')
[ "$USE" -lt 85 ] || fail+=("disk-${USE}pct")
B=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' /var/www/html/index.html | head -1)
[ -n "$B" ] && [ -f "/var/www/html/$B" ] || fail+=("asset-missing")
if [ ${#fail[@]} -eq 0 ]; then ST=OK; else ST=FAIL; fi
echo "$TS $ST bundle=${B:-none} health=$h1/$h2 cert=${DAYS}d disk=${USE}% ${fail[*]:-}" >> $LOG
tail -n 2000 $LOG > $LOG.tmp 2>/dev/null && mv $LOG.tmp $LOG
[ ${#fail[@]} -eq 0 ]
