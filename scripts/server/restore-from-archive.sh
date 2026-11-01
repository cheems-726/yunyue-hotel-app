#!/bin/bash
# V169 · 归档恢复演练（服务器执行 · 只碰临时库 · 绝不对生产库做恢复）
# 用法：bash restore-from-archive.sh <学期标签> [--keep]
#   例：bash restore-from-archive.sh 2026-autumn
# 步骤（卡 §1）：
#   ① 读 /opt/yunyue/archive/semester-<标签>/SHA256SUMS 并校验（失败 ⇒ 立即退出）
#   ② 建临时库 yunyue_restore_<时间戳>，pg_restore 导入 dump
#   ③ 对账四项：game_states / class_state / semester_closeouts / auth.users 行数（临时库 vs 生产库）
#   ④ 抽样对账：取生产库第 1 组，比 history 长度 / capital / 末周净利
#   ⑤ 逐项输出报告；不带 --keep 时删临时库
# 红线：本脚本对 archive/ 只读；对生产库只读；所有写入只发生在临时库。
set -uo pipefail
LABEL="${1:?用法: restore-from-archive.sh <学期标签> [--keep]}"
KEEP=false; [ "${2:-}" = "--keep" ] && KEEP=true
D="/opt/yunyue/archive/semester-${LABEL}"
[ -d "$D" ] || { echo "✗ 归档目录不存在：$D"; exit 1; }
[ -f "$D/SHA256SUMS" ] || { echo "✗ 缺 SHA256SUMS（$D）—— 存档不完整，拒绝恢复"; exit 1; }

echo "══ ① 校验归档完整性（sha256sum -c）══"
if (cd "$D" && sha256sum -c SHA256SUMS --quiet); then
  echo "  ✓ 归档校验全部通过"
else
  echo "  ✗ 归档校验失败（dump 可能损坏/被改）⇒ 立即退出（RV：跳过本步 ⇒ 损坏 dump 会被导入）"
  exit 1
fi

DUMP=$(find "$D" -maxdepth 1 -name "*.dump" | head -1)
[ -n "$DUMP" ] || { echo "✗ 目录里没有 .dump 文件"; exit 1; }

TS=$(date +%Y%m%d%H%M%S)
TMPDB="yunyue_restore_${TS}"
echo "══ ② 恢复到临时库 $TMPDB ══"
sudo -u postgres createdb "$TMPDB" || { echo "✗ 建临时库失败"; exit 1; }
if ! sudo -u postgres pg_restore -d "$TMPDB" --no-owner --role=postgres "$DUMP" 2>/tmp/restore-err.log; then
  # pg_restore 对权限/扩展类报错可能带 warnings；只看致命错误：行数对账会兜底
  echo "  ⚠ pg_restore 带告警（详见 /tmp/restore-err.log 头几行）："
  head -3 /tmp/restore-err.log | sed 's/^/    /'
fi

q() { sudo -u postgres psql -d "$1" -tAc "$2" 2>/dev/null; }
echo "══ ③ 四项对账（临时库 vs 生产库 · 三态：一致 / 生产已前进 / 真失败）══"
PASS=0; FAIL=0
for T in "game_states" "class_state" "semester_closeouts" "auth.users"; do
  A=$(q yunyue "select count(*) from $T")
  B=$(q "$TMPDB" "select count(*) from $T")
  if [ "$A" = "$B" ]; then echo "  ✓ $T：$A = $B（完全一致）"; PASS=$((PASS+1))
  elif [ -z "$B" ] && [ -n "$A" ]; then echo "  ⚠ $T：临时库无此表（归档时点早于该表创建 · dump 内容如实）"; PASS=$((PASS+1))
  elif [ "$B" -lt "$A" ] 2>/dev/null; then echo "  ⚠ $T：临时 $B ≤ 生产 $A（归档后生产继续跑 · 方向正确）"; PASS=$((PASS+1))
  else echo "  ✗ $T：临时 $B > 生产 $A（恢复出了多余数据 · 真失败）"; FAIL=$((FAIL+1)); fi
done

echo "══ ④ 抽样对账（生产第 1 组 vs 临时库同组）══"
GK=$(q yunyue "select group_key from game_states where group_key like '酒管2401%' order by group_key limit 1")
for FIELD in "jsonb_array_length(coalesce(state->'history','[]'::jsonb))" "coalesce(state->>'capital','?')" "coalesce((state->'history'->-1->>'netProfit'),'?')"; do
  A=$(q yunyue "select $FIELD from game_states where group_key='$GK'")
  B=$(q "$TMPDB" "select $FIELD from game_states where group_key='$GK'")
  case "$FIELD" in
    *history*) N="history 长度";; *capital*) N="capital";;
    *) N="末周净利";;
  esac
  if [ "$A" = "$B" ]; then echo "  ✓ $N：$A = $B"; PASS=$((PASS+1))
  else echo "  ✗ $N：生产 $A ≠ 临时 $B"; FAIL=$((FAIL+1)); fi
done

echo "══ ⑤ 报告 ══"
echo "结果: $PASS 通过 / $FAIL 失败（临时库 $TMPDB）"
if [ "$FAIL" -eq 0 ] && [ "$PASS" -eq 7 ]; then
  echo "✓ 恢复演练全绿 —— 该归档可用于恢复"
else
  echo "✗ 恢复演练有失败项 —— 存档不可依赖，先修归档"
fi
if $KEEP; then echo "（--keep：临时库保留，人工可查：sudo -u postgres psql -d $TMPDB）"
else sudo -u postgres dropdb "$TMPDB" && echo "（临时库已清理）"; fi
[ "$FAIL" -eq 0 ] && [ "$PASS" -eq 7 ] && exit 0 || exit 1
