#!/bin/bash
# V130 §6-① · 前端旧包清理（一次性 · 可复跑）
#   保留：① 当前在用的（index.html / 主包引用到的）② 最近 2 个构建批次（按 mtime 聚类，间隔 >10 分钟算另一批）
#   其余移到 /var/www/_old/（**不删**，观察一周后再删）+ 写清单留证
#   判据：assets 文件数 ≤ 12
# 用法：bash prune-assets.sh [--dry]
set -uo pipefail
WEB="${YUNYUE_WEB_DIR:-/var/www/html}"
OLD="${YUNYUE_OLD_DIR:-/var/www/_old}"
DRY=no; [ "${1:-}" = "--dry" ] && DRY=yes

cd "$WEB" || { echo "✗ 没有 $WEB"; exit 1; }
main=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' index.html | head -1)
[ -n "$main" ] || { echo "✗ index.html 里找不到主包"; exit 1; }

# 在用清单（文件名命中 index.html 或主包即算在用）
keep=()
for f in assets/*; do
  [ -f "$f" ] || continue
  b=$(basename "$f")
  if grep -qF "$b" index.html || grep -qF "$b" "$main"; then keep+=("$f"); fi
done

# 其余按 mtime 倒序聚类，取最近 2 批
mapfile -t rest < <(for f in assets/*; do
  [ -f "$f" ] || continue
  b=$(basename "$f")
  printf '%s\n' "$b" | grep -qxF "$b" || true
  case " ${keep[*]} " in *" $f "*) continue ;; esac
  printf '%s\t%s\n' "$(stat -c %Y "$f")" "$f"
done | sort -rn | awk -F'\t' '{print $1"\t"$2}')

prev_ts=0; batch=0
for line in "${rest[@]}"; do
  ts=${line%%$'\t'*}; f=${line#*$'\t'}
  if [ "$prev_ts" -eq 0 ] || [ $((prev_ts - ts)) -gt 600 ]; then batch=$((batch + 1)); prev_ts=$ts; fi
  [ "$batch" -le 2 ] && keep+=("$f")
done

# 待移清单
mkdir -p "$OLD"
moved=0
for f in assets/*; do
  [ -f "$f" ] || continue
  case " ${keep[*]} " in *" $f "*) continue ;; esac
  if [ "$DRY" = yes ]; then echo "  (dry) mv $f"; else
    mv -n "$f" "$OLD/"; moved=$((moved + 1))
  fi
done

echo "在用/近两批保留：${#keep[@]} 个 → ${keep[*]}"
echo "移入 $OLD：${moved} 个"
if [ "$DRY" = no ]; then
  ls -1 "$OLD" >"$OLD/MOVED-$(date +%Y%m%d-%H%M).txt"
  echo "清单：$OLD/MOVED-$(date +%Y%m%d-%H%M).txt"
fi
echo "现 assets 文件数：$(find assets -maxdepth 1 -type f | wc -l)"
