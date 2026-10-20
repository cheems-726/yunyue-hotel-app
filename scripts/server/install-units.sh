#!/bin/bash
# V130 · 服务器单元安装（幂等）—— 在**服务器上**以 root 跑
# 用法：bash install-units.sh <包含 backup.sh/opscheck.sh/两个 .service/.timer 的目录>
# 作用：① 装 /opt/yunyue/scripts/{backup,opscheck}.sh ② 装 systemd 单元 + 启用 timer
# 不做：不启动备份（由 timer 或手动 systemctl start yunyue-backup.service 触发）
set -euo pipefail

SRC="${1:?用法: install-units.sh <目录>}"
for f in backup.sh opscheck.sh restore-drill.sh yunyue-backup.service yunyue-backup.timer; do
  [ -f "$SRC/$f" ] || { echo "✗ 缺文件：$SRC/$f" >&2; exit 1; }
done

install -d -m 0750 /opt/yunyue/scripts
install -m 0755 "$SRC/backup.sh" /opt/yunyue/scripts/backup.sh
install -m 0755 "$SRC/opscheck.sh" /opt/yunyue/scripts/opscheck.sh
install -m 0755 "$SRC/restore-drill.sh" /opt/yunyue/scripts/restore-drill.sh
install -m 0644 "$SRC/yunyue-backup.service" /etc/systemd/system/yunyue-backup.service
install -m 0644 "$SRC/yunyue-backup.timer" /etc/systemd/system/yunyue-backup.timer

systemctl daemon-reload
systemctl enable yunyue-backup.timer >/dev/null 2>&1
echo "✓ 已安装：/opt/yunyue/scripts/{backup,opscheck}.sh · yunyue-backup.{service,timer} · timer 已 enable"
systemctl list-timers yunyue-backup.timer --no-pager | sed -n '1,3p'
