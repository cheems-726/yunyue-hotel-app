#!/bin/bash
# V163 §1② · 学期收口服务器全量冷备（管理员经 SSH 执行 · 与 V162 手工产物同构）
# 用法：bash closeout-semester.sh <学期标签，如 2026秋>
# 产物：/opt/yunyue/archive/semester-<标签>/{db-<标签>.dump, frontend-assets/, snapshot/, SHA256SUMS, README.md}
# 红线：目录只增不改 —— 已存在的学期归档目录直接退出（no-clobber），绝不覆盖。
# 说明：教师端一键收口的第②步=应用层 DB 逻辑备份（semester_closeouts 表）；本脚本补 pg_dump 全库
#       + 前端包快照（教师端无法 SSH，属管理员项）—— 两层合起来 = V162 手工产物全集。
set -uo pipefail
LABEL="${1:?用法: closeout-semester.sh <学期标签>}"
D="/opt/yunyue/archive/semester-${LABEL}"
if [ -d "$D" ]; then echo "✗ $D 已存在（目录只增不改 · 不覆盖已有学期归档）——如确需重做请先人工移走"; exit 1; fi
mkdir -p "$D/frontend-assets" "$D/snapshot"

# ① DB 全库冷备
sudo -u postgres pg_dump -Fc yunyue > "$D/db-${LABEL}.dump" || { echo "✗ pg_dump 失败"; exit 1; }

# ② 前端包快照（当前入口 + 带哈希 assets + 部署台账）
cp /var/www/html/index.html "$D/frontend-assets/"
cp -r /var/www/html/assets "$D/frontend-assets/"
[ -f /opt/yunyue/VERSIONS.md ] && cp /opt/yunyue/VERSIONS.md "$D/frontend-assets/"

# ③ 归档 JSON：教师端一键收口第①步已下载快照件（JSON+CSV）——由操作者放入 snapshot/ 后重跑清单
#    （教师端无法 SSH，此步不自动化；应用层逻辑备份已在 semester_closeouts 表内联）

# ④ 清单与说明
cd "$D"
find . -type f ! -name SHA256SUMS ! -name README.md -exec sha256sum {} \; > SHA256SUMS
cat > README.md <<EOF
# 学期冷备 · ${LABEL}（closeout-semester.sh · V163）

- db-${LABEL}.dump      : 全库冷备（pg_dump -Fc）· $(date '+%F %T') · 管理员执行
- frontend-assets/      : 部署时点前端包快照（index.html + assets + VERSIONS.md）
- snapshot/             : 教师端一键收口第①步下载的学期快照 JSON/CSV（由操作者放入）
- 应用层 DB 逻辑备份    : semester_closeouts 表（教师端向导第②步自动写入 · files jsonb 含 sha256）
- 校验：sha256sum -c SHA256SUMS ；应用层校验走教师端「冷备状态卡 → 校验」按钮
- 红线：本目录只增不改；恢复演练在临时库进行，不写回生产库
EOF
echo "── 文件数: $(find . -type f | wc -l) · 大小: $(du -sh . | cut -f1)"
sha256sum -c SHA256SUMS | grep -c OK
echo "✓ 冷备完成：$D （snapshot/ 请放入教师端第①步下载的快照件后重跑 sha256sum 更新清单）"
