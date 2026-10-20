#!/bin/bash
# V130 · 服务器单元安装（幂等）—— 在**服务器上**以 root 跑
# 用法：bash install-units.sh <包含本目录文件的目录>
# 作用：① 装 /opt/yunyue/scripts/{backup,opscheck,restore-drill,housekeeping}.sh + monitor.mjs
#       ② 装 systemd 单元（yunyue-backup / yunyue-monitor）+ 启用 timer
#       ③ 装 fail2ban jail.local 并 reload
# 不做：不启动备份/监测（由 timer 触发，或手动 systemctl start <unit>）
set -euo pipefail

SRC="${1:?用法: install-units.sh <目录>}"
for f in backup.sh opscheck.sh restore-drill.sh housekeeping.sh offsite-backup.sh monitor.mjs \
         yunyue-backup.service yunyue-backup.timer \
         yunyue-monitor.service yunyue-monitor.timer jail.local; do
  [ -f "$SRC/$f" ] || { echo "✗ 缺文件：$SRC/$f" >&2; exit 1; }
done

install -d -m 0750 /opt/yunyue/scripts
for f in backup.sh opscheck.sh restore-drill.sh housekeeping.sh; do
  install -m 0755 "$SRC/$f" "/opt/yunyue/scripts/$f"
done
install -m 0755 "$SRC/monitor.mjs" /opt/yunyue/scripts/monitor.mjs

install -m 0644 "$SRC/yunyue-backup.service" /etc/systemd/system/yunyue-backup.service
install -m 0644 "$SRC/yunyue-backup.timer" /etc/systemd/system/yunyue-backup.timer
install -m 0644 "$SRC/yunyue-monitor.service" /etc/systemd/system/yunyue-monitor.service
install -m 0644 "$SRC/yunyue-monitor.timer" /etc/systemd/system/yunyue-monitor.timer

install -m 0644 "$SRC/jail.local" /etc/fail2ban/jail.local
systemctl reload fail2ban 2>/dev/null || systemctl restart fail2ban 2>/dev/null || true

systemctl daemon-reload
systemctl enable yunyue-backup.timer yunyue-monitor.timer >/dev/null 2>&1
systemctl start yunyue-backup.timer yunyue-monitor.timer 2>/dev/null || true

echo "✓ 已安装：/opt/yunyue/scripts/{backup,opscheck,restore-drill,housekeeping}.sh · monitor.mjs"
echo "✓ 单元：yunyue-backup.{service,timer} · yunyue-monitor.{service,timer} · fail2ban jail.local"
systemctl list-timers yunyue-backup.timer yunyue-monitor.timer --no-pager | sed -n '1,4p'
