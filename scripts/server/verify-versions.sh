#!/bin/bash
# V130 §5 · 版本台账核对（/opt/yunyue/VERSIONS.md ↔ 线上实际文件 sha256）
# 台账行格式（| 分隔，脚本只认"以日期开头"的行）：
#   2026-10-20 12:38 | frontend | /var/www/html/assets/index-XXXX.js | <sha256> | 来源 a02fdc6 | DSH
# 目录按"排序后逐文件 sha256 再取 sha256"算（与建档时同一算法）
# 判据：每行都能在线上复算出同值；抽 2 条一致即可（本脚本核全部）
# 退出码：0 = 全部一致；1 = 有不一致/文件缺失
set -uo pipefail
VER="${1:-/opt/yunyue/VERSIONS.md}"
[ -f "$VER" ] || { echo "✗ 找不到台账 $VER"; echo "结果: 0 通过 / 1 失败"; exit 1; }

digest() {  # digest <文件或目录>
  local p="$1"
  if [ -d "$p" ]; then
    (cd "$p" && find . -type f | sort | xargs -r sha256sum 2>/dev/null | sha256sum | awk '{print $1}')
  elif [ -f "$p" ]; then
    sha256sum "$p" | awk '{print $1}'
  else
    echo "MISSING"
  fi
}

PASS=0; FAIL=0
echo "══ VERSIONS.md 核对 · $(date '+%F %T') ══"
while IFS='|' read -r t mod path sha owner who; do
  mod=$(echo "$mod" | xargs); path=$(echo "$path" | xargs); sha=$(echo "$sha" | xargs)
  case "$path" in /*) ;; *) continue ;; esac
  [ -n "$sha" ] || continue
  real=$(digest "$path")
  if [ "$real" = "$sha" ]; then
    echo "  ✓ $mod  $(basename "$path")  ${sha:0:16}…"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $mod  $path"
    echo "      台账 ${sha:0:16}… ≠ 实际 ${real:0:16}…"
    FAIL=$((FAIL + 1))
  fi
done < <(grep -E '^\|\s*[0-9]{4}-[0-9]{2}-[0-9]{2}' "$VER" | sed 's/^|//')

echo "结果: ${PASS} 通过 / ${FAIL} 失败"
[ "$FAIL" -eq 0 ] && [ "$PASS" -gt 0 ] && exit 0 || exit 1
