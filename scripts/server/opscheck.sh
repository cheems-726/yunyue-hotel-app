#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# V130 §2 / V138 §1.2 · 云悦酒店测试机 · 十项只读巡检（opscheck）
#
# 只读契约：本脚本**不改任何状态**（不写文件、不重启服务、不碰库）
# 用法：
#   ① 服务器上直接跑     bash opscheck.sh --local
#   ② 本机（Linux/mac）  YUNYUE_SSH_KEY=<私钥> sh opscheck.sh        # 自动 SSH 过去
#   ③ Windows（本项目）  node tests/opscheck.test.mjs               # 同一份脚本经 ssh 送入
# 输出：十项各一行 ✓/✗（子检查用 · 前缀列出）+ 末尾**标准尾行** `结果: N 通过 / M 失败`
#       N = **项数**（十项），不是断言数 —— run-all 只认尾行。
# 退出码：0 = 十项全绿 · 1 = 有失败 · 2 = 无法执行（非 root）
# 主机/域名/目录可用环境变量覆盖：YUNYUE_HOST / YUNYUE_DOMAIN / YUNYUE_SSH_KEY /
#                                  YUNYUE_BAK_DIR / YUNYUE_WEB_DIR
# ═══════════════════════════════════════════════════════════════════════════

HOST_IP="${YUNYUE_HOST:-121.196.196.37}"
DOMAIN="${YUNYUE_DOMAIN:-test.2026911301.xyz}"
BAK_DIR="${YUNYUE_BAK_DIR:-/opt/yunyue/bak}"
WEB_DIR="${YUNYUE_WEB_DIR:-/var/www/html}"

# ── 非 --local：把自己经 SSH 送到服务器上跑（stdin = 本文件）──────────────
if [ "${1:-}" != "--local" ]; then
  KEY="${YUNYUE_SSH_KEY:-$HOME/.ssh/aliyun-ecs-yunyue}"
  exec ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new \
    "root@${HOST_IP}" "bash -s -- --local" < "$0"
fi

# ── 前置 ────────────────────────────────────────────────────────────────
if [ "$(id -u)" != "0" ]; then
  echo "✗ 需要 root（systemctl/ss/ufw/psql 都要）" >&2
  echo "结果: 0 通过 / 1 失败"
  exit 2
fi

PASS=0
FAIL=0
ITEM_FAIL=0          # 当前项内的子检查失败数
ITEM_NO=0
SUB=()               # 当前项的明细（汇总打印用）

item() {             # item "<标题>"  —— 开一项
  ITEM_NO=$((ITEM_NO + 1))
  ITEM_FAIL=0
  SUB=()
  printf '%s\n' "$1"
}
sub() { SUB+=("$1"); }                      # 只记明细（绿）
sub_bad() { SUB+=("$1"); ITEM_FAIL=$((ITEM_FAIL + 1)); }   # 明细（红）
item_end() {         # 收一项：全绿 ⇒ ✓ 一项；有任一红 ⇒ ✗ 一项
  for s in "${SUB[@]}"; do printf '    · %s\n' "$s"; done
  if [ "$ITEM_FAIL" -eq 0 ]; then
    printf '  ✓ %s\n' "通过"
    PASS=$((PASS + 1))
  else
    printf '  ✗ %s（%s 条子检查红）\n' "失败" "$ITEM_FAIL"
    FAIL=$((FAIL + 1))
  fi
}

Q() { sudo -u postgres psql -d yunyue -At -c "$1" 2>/dev/null; }
now_s=$(date +%s)

echo "══ V130 只读巡检 · $(hostname) · $(date '+%F %T %Z') · 目标 ${DOMAIN} (${HOST_IP}) ══"
echo "   （只读：不改任何状态；十项里任一项 ✗ 即 exit=1）"

# ── ① 服务 ──────────────────────────────────────────────────────────────
item "① 服务（4 个 systemd + 1 个容器）"
for s in postgresql nginx postgrest gotrue; do
  st=$(systemctl is-active "$s" 2>/dev/null)
  if [ "$st" = "active" ]; then sub "$s active"; else sub_bad "$s = ${st:-未知}"; fi
done
# Realtime 是 docker 容器（host 网络），不是 systemd 单元 ⇒ 单独判
rst=$(docker inspect -f '{{.State.Running}}' realtime 2>/dev/null)
if [ "$rst" = "true" ]; then sub "realtime 容器 running"; else sub_bad "realtime 容器未运行（${rst:-容器不存在}）"; fi
item_end

# ── ② 定时器 ────────────────────────────────────────────────────────────
item "② 定时器（tick / archive / certbot）"
for t in yunyue-tick.timer yunyue-archive.timer certbot.timer; do
  st=$(systemctl is-active "$t" 2>/dev/null)
  nxt=$(systemctl show "$t" -p NextElapseUSecRealtime --value 2>/dev/null)
  if [ "$st" = "active" ]; then sub "$t active（下次 ${nxt:--}）"; else sub_bad "$t = ${st:-未知}"; fi
done
item_end

# ── ③ 资源 ──────────────────────────────────────────────────────────────
item "③ 资源（根分区 / 内存 / swap）"
use=$(df -P / | awk 'NR==2{gsub("%","",$5); print $5}')
avail=$((100 - use))
if [ "$avail" -ge 10 ]; then sub "根分区可用 ${avail}%（已用 ${use}%，阈值 ≥10%）"; else sub_bad "根分区可用仅 ${avail}%"; fi
mem=$(awk '/^MemAvailable:/{print int($2/1024)}' /proc/meminfo)
if [ "${mem:-0}" -ge 150 ]; then sub "内存可用 ${mem} MB（阈值 ≥150）"; else sub_bad "内存可用仅 ${mem:-?} MB"; fi
swap=$(free -m | awk '/^Swap:/{print $3}')
if [ "${swap:-1}" -eq 0 ]; then sub "swap 占用 0（未开始换页）"; else sub_bad "swap 已占用 ${swap} MB（开始换页 = 内存吃紧）"; fi
item_end

# ── ④ 端口面 ────────────────────────────────────────────────────────────
item "④ 端口面（对公网只许 22/80/443；3000/4000/9999/5432 不许直露）"
ufw_on=no
ufw status 2>/dev/null | head -1 | grep -q "Status: active" && ufw_on=yes
viol=""
blocked=""
looponly=""
for ap in $(ss -lntH 2>/dev/null | awk '{print $4}'); do
  addr=${ap%:*}
  port=${ap##*:}
  case "$addr" in
    127.* | "[::1]" | "[::ffff:127.0.0.1]" | *%lo) looponly="$looponly $port"; continue ;;
  esac
  case "$port" in
    22 | 80 | 443) continue ;;
  esac
  # 非白名单端口且绑在全接口 ⇒ 只有被 ufw 挡住才算"不对公网"
  if [ "$ufw_on" = "yes" ] && ! ufw status 2>/dev/null | grep -qE "^${port}(/tcp)?[[:space:]]+ALLOW"; then
    blocked="$blocked ${port}"
  else
    viol="$viol ${port}@${addr}"
  fi
done
if [ -n "$viol" ]; then
  sub_bad "对公网暴露非白名单端口：${viol}（ufw=${ufw_on}）"
else
  sub "仅 22/80/443 对外"
  if [ -n "$blocked" ]; then
    sub "容器全接口但被 ufw 拦住：$(echo "$blocked" | tr ' ' '\n' | sort -un | tr '\n' ' ')"
  fi
  sub "回环端口：$(echo "$looponly" | tr ' ' '\n' | sort -un | tr '\n' ' ')"
fi
item_end

# ── ⑤ 证书 ──────────────────────────────────────────────────────────────
item "⑤ 证书与解析"
CERT="/etc/letsencrypt/live/${DOMAIN}/cert.pem"
if [ -f "$CERT" ]; then
  end=$(openssl x509 -enddate -noout -in "$CERT" 2>/dev/null | cut -d= -f2-)
  if openssl x509 -checkend $((20 * 86400)) -noout -in "$CERT" >/dev/null 2>&1; then
    sub "证书 ≥20 天（到期 ${end}）"
  else
    sub_bad "证书将 <20 天到期（到期 ${end}）"
  fi
else
  sub_bad "找不到证书 $CERT"
fi
resolved=$(dig +short A "$DOMAIN" 2>/dev/null | tail -1)
if [ "$resolved" = "$HOST_IP" ]; then sub "DNS ${DOMAIN} → ${resolved}"; else sub_bad "DNS ${DOMAIN} → ${resolved:-解析失败}（应为 ${HOST_IP}）"; fi
item_end

# ── ⑥ 入口 ──────────────────────────────────────────────────────────────
item "⑥ 入口（本机回环 + Host 头，不走 DNS）"
for path in /health /auth/v1/health; do
  code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 10 -H "Host: ${DOMAIN}" "https://127.0.0.1${path}" 2>/dev/null)
  if [ "$code" = "200" ]; then sub "GET ${path} → 200"; else sub_bad "GET ${path} → ${code:-超时/不可达}"; fi
done
item_end

# ── ⑦ 业务新鲜度 ────────────────────────────────────────────────────────
item "⑦ 业务新鲜度（tick / 教学日 / history 突变）"
last=$(systemctl show yunyue-tick.timer -p LastTriggerUSec --value 2>/dev/null)
last_s=$(date -d "$last" +%s 2>/dev/null || echo 0)
if [ "$last_s" -gt 0 ]; then
  age=$(((now_s - last_s) / 60))
  if [ "$age" -le 30 ]; then sub "tick 近 ${age} 分钟跑过（上轮 ${last}）"; else sub_bad "tick 已 ${age} 分钟没跑（上轮 ${last}）"; fi
else
  sub_bad "取不到 yunyue-tick.timer 上次触发时间（${last:-空}）"
fi
day=$(Q "select class_day_now()")
case "$day" in
  '' | *[!0-9]*) sub_bad "class_day_now() 不是数字：${day:-取不到}" ;;
  *) sub "class_day_now() = ${day}" ;;
esac
# history 是"周"粒度：长度应落在 [week-1, week]；多出/少了一周以上视为跳变
badrow=$(Q "select count(*) from game_states where jsonb_array_length(coalesce(state->'history','[]'::jsonb)) > week or jsonb_array_length(coalesce(state->'history','[]'::jsonb)) < week - 1")
if [ "${badrow:-x}" = "0" ]; then
  sub "history 长度无突变（各组均落 [week-1, week]）"
else
  sub_bad "history 长度异常的行数 = ${badrow:-取不到}"
fi
item_end

# ── ⑧ 备份 ──────────────────────────────────────────────────────────────
item "⑧ 备份（/opt/yunyue/bak/db 最新一份 <48h）"
newest=$(ls -1t "${BAK_DIR}"/db/*.dump 2>/dev/null | head -1)
if [ -n "$newest" ]; then
  age_h=$(((now_s - $(stat -c %Y "$newest")) / 3600))
  if [ "$age_h" -lt 48 ]; then sub "最新 ${newest##*/}（${age_h}h 前，阈值 <48h）"; else sub_bad "最新已 ${age_h}h（${newest##*/}，阈值 <48h）"; fi
else
  sub_bad "没有任何 db dump（${BAK_DIR}/db/*.dump）"
fi
item_end

# ── ⑨ 磁盘垃圾 ──────────────────────────────────────────────────────────
item "⑨ 磁盘垃圾（前端旧包 / 引擎旧包）"
n=$(find "${WEB_DIR}/assets" -maxdepth 1 -type f 2>/dev/null | wc -l)
if [ "$n" -le 12 ]; then sub "assets 文件数 ${n}（≤12）"; else sub_bad "assets 文件数 ${n}（>12 ⇒ 旧包堆积）"; fi
old=$(find "${BAK_DIR}" -maxdepth 1 -name '*.tgz' 2>/dev/null | wc -l)
if [ "$old" -le 3 ]; then sub "引擎包 ${old} 份（≤3）"; else sub_bad "引擎包 ${old} 份（>3 ⇒ 按 §6-② 只留最近 3 版）"; fi
item_end

# ── ⑩ 前端包指向（V138：2026-10-22 事故 —— 包指回旧云端 supabase.co）────
item "⑩ 前端包指向（不得残留旧云端地址）"
old_cloud=$(grep -h -c 'jgytwxaeeezmdbxfsyvs' "${WEB_DIR}"/assets/index-*.js 2>/dev/null | awk '{s+=$1} END{print s+0}')
if [ "${old_cloud:-0}" = "0" ]; then
  sub "入口包旧云端地址 0 处"
else
  sub_bad "入口包残留旧云端地址 ${old_cloud} 处 ⇒ 学生登录会全失败"
fi
item_end

# ── 标准尾行 ────────────────────────────────────────────────────────────
echo "───────────────────────────────────────────────"
echo "结果: ${PASS} 通过 / ${FAIL} 失败"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
